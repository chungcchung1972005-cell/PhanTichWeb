// ALOHA Baby — chat THẬT Khách <-> Sale qua server (thêm 2026-09-27, người dùng chọn
// "làm chat thật qua server" + MongoDB Atlas). Gắn vào server.js tại /api/sale-chat.
//
// Gồm 3 phần:
// 1. Đăng nhập kiểm tra ở server: tài khoản demo (khớp DEMO_ACCOUNTS trong login.html)
//    + khách đăng ký thật (mật khẩu băm scrypt, lưu trong database). Đăng nhập đúng thì
//    cấp token ký HMAC (AUTH_SECRET), trình duyệt gửi kèm "Authorization: Bearer <token>".
// 2. Lưu trữ: MongoDB nếu có MONGODB_URI, không có thì lưu trong bộ nhớ (chỉ để chạy
//    thử local/test - server khởi động lại là mất hết).
// 3. API chat: khách chỉ đọc/ghi cuộc trò chuyện CỦA CHÍNH MÌNH (định danh lấy từ token,
//    không lấy từ dữ liệu client gửi lên); mọi tài khoản Sale đọc + trả lời mọi cuộc trò
//    chuyện; Sếp chỉ xem; Thợ ảnh không có quyền.
//
// Trình duyệt tự hỏi tin mới vài giây một lần (polling) - đơn giản, chạy ổn trên Render.
//
// Đăng nhập bằng Google (thêm 2026-09-27, người dùng chọn "Google trước, Facebook sau"):
// trang gửi ID token Google lên, server hỏi Google kiểm tra (tokeninfo) rồi tìm tài khoản
// theo googleSub. Lần đầu: bắt nhập SĐT một lần (người dùng chốt) - SĐT vẫn là mã định danh
// khách ở mọi nơi (chat, hồ sơ, ảnh). SĐT đã có tài khoản thì KHÔNG cho gắn Google vào (chống
// người khác gõ SĐT của mình để chiếm tài khoản). Chỉ bật khi đặt GOOGLE_CLIENT_ID.
const crypto = require('crypto');
const express = require('express');

// ---------------------------------------------------------------- Cấu hình
// Khớp DEMO_ACCOUNTS trong login.html (tài khoản demo công khai trên trang đăng nhập).
const DEMO_ACCOUNTS = {
  '0900000001': { password: 'khach123', role: 'khach-hang', name: 'Khách demo' },
  '0900000002': { password: 'sale123', role: 'sale', name: 'Sale demo' },
  '0900000005': { password: 'sale123', role: 'sale', name: 'Sale demo 2' },
  '0900000006': { password: 'sale123', role: 'sale', name: 'Sale demo 3' },
  '0900000003': { password: 'anh123', role: 'tho-anh', name: 'Thợ ảnh demo' },
  '0900000004': { password: 'sep123', role: 'sep', name: 'Sếp demo' }
};
const TOKEN_TTL_MS = 30 * 24 * 3600 * 1000;
const MAX_TEXT = 2000;
const MAX_MESSAGES = 500;          // mỗi cuộc trò chuyện giữ tối đa bấy nhiêu tin gần nhất
const MAX_TOPIC = 60;
const RATE_LIMIT = { windowMs: 60 * 1000, max: 30 }; // tối đa 30 tin / phút / tài khoản

// Google: Client ID lấy ở Google Cloud Console (xem DEPLOY.md). Để trống = ẩn nút Google.
const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || '').trim();
// Chỉ đổi khi chạy test (trỏ tới máy chủ Google giả lập).
const GOOGLE_TOKENINFO_URL = process.env.GOOGLE_TOKENINFO_URL || 'https://oauth2.googleapis.com/tokeninfo';
const GOOGLE_SIGNUP_TTL_MS = 15 * 60 * 1000; // thời gian để khách nhập SĐT sau khi chọn Google

let AUTH_SECRET = process.env.AUTH_SECRET;
if (!AUTH_SECRET) {
  AUTH_SECRET = crypto.randomBytes(32).toString('hex');
  console.warn('CẢNH BÁO: chưa đặt AUTH_SECRET - dùng khoá ngẫu nhiên, mỗi lần server khởi động lại mọi người phải đăng nhập lại. Bắt buộc đặt trên Render.');
}

// ---------------------------------------------------------------- Tiện ích
const b64url = (buf) => Buffer.from(buf).toString('base64url');
const normPhone = (s) => String(s || '').replace(/\D/g, '');
const isPhone = (p) => /^0\d{9,10}$/.test(p);

function signToken(payload) {
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac('sha256', AUTH_SECRET).update(body).digest());
  return body + '.' + sig;
}
function verifyToken(token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const expected = b64url(crypto.createHmac('sha256', AUTH_SECRET).update(body).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return p && p.exp > Date.now() ? p : null;
  } catch (e) {
    return null;
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}
function checkPassword(password, user) {
  if (!user.salt || !user.hash) return false; // tài khoản tạo bằng Google, không có mật khẩu
  const hash = crypto.scryptSync(password, user.salt, 64);
  const stored = Buffer.from(user.hash, 'hex');
  return stored.length === hash.length && crypto.timingSafeEqual(stored, hash);
}
function samePassword(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// from: 'khach' | 'sale' | 'he-thong' (tin hệ thống, vd bản tóm tắt hành trình khách gửi kèm
// khi khách chuyển từ trợ lý AI sang Sale - chỉ Sale/Sếp đọc, trang khách không hiện).
function newMessage(from, senderName, text, kind) {
  const msg = { id: 'MSG-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex'), from, senderName, text, at: Date.now() };
  if (kind) msg.kind = kind;
  return msg;
}

// Bản tóm tắt cho danh sách hộp thư của Sale (không gửi cả lịch sử tin).
function summarize(chat) {
  const last = chat.messages[chat.messages.length - 1] || null;
  return {
    phone: chat.phone, customerName: chat.customerName, topic: chat.topic || '',
    staffUnread: chat.staffUnread || 0, customerUnread: chat.customerUnread || 0,
    updatedAt: chat.updatedAt, last
  };
}
function publicChat(chat) {
  if (!chat) return null;
  const { _id, createdAt, ...rest } = chat;
  return rest;
}

// ---------------------------------------------------------------- Lưu trữ
// Cả 2 kiểu lưu có cùng bộ hàm async, phần API không cần biết đang dùng kiểu nào.
function memoryStore() {
  const users = new Map();
  const chats = new Map();
  const clone = (x) => (x ? JSON.parse(JSON.stringify(x)) : null);
  return {
    kind: 'memory',
    async getUser(phone) { return clone(users.get(phone)); },
    async getUserByGoogle(sub) { return clone([...users.values()].find((u) => u.googleSub === sub)); },
    async createUser(user) {
      if (users.has(user.phone)) return false;
      if (user.googleSub && [...users.values()].some((u) => u.googleSub === user.googleSub)) return false;
      users.set(user.phone, clone(user));
      return true;
    },
    async getChat(phone) { return clone(chats.get(phone)); },
    async listChats() {
      return [...chats.values()].sort((a, b) => b.updatedAt - a.updatedAt).map(summarize);
    },
    async appendMessage(phone, fields, msg) {
      const chat = chats.get(phone) || { phone, customerName: 'Khách hàng', topic: '', messages: [], staffUnread: 0, customerUnread: 0, updatedAt: 0, createdAt: msg.at };
      if (fields.customerName) chat.customerName = fields.customerName;
      if (fields.topic) chat.topic = fields.topic;
      chat.messages.push(msg);
      if (chat.messages.length > MAX_MESSAGES) chat.messages.splice(0, chat.messages.length - MAX_MESSAGES);
      if (msg.from === 'sale') chat.customerUnread += 1; else chat.staffUnread += 1;
      chat.updatedAt = msg.at;
      chats.set(phone, chat);
      return clone(chat);
    },
    async markRead(phone, side) {
      const chat = chats.get(phone);
      if (chat) chat[side === 'sale' ? 'staffUnread' : 'customerUnread'] = 0;
      return clone(chat);
    }
  };
}

function mongoStore(uri, dbName) {
  const { MongoClient } = require('mongodb');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  let ready = null;
  // Kết nối lần đầu khi có request cần tới; lỗi thì lần sau thử kết nối lại.
  const db = () => {
    if (!ready) {
      ready = client.connect().then(async () => {
        const d = client.db(dbName);
        // 1 tài khoản Google chỉ gắn với 1 SĐT (bỏ qua tài khoản không có googleSub).
        await d.collection('users').createIndex({ googleSub: 1 }, { unique: true, sparse: true })
          .catch((e) => console.error('Không tạo được index googleSub:', e.message));
        return d;
      }).catch((e) => { ready = null; throw e; });
    }
    return ready;
  };
  const users = async () => (await db()).collection('users');
  const chats = async () => (await db()).collection('chats');
  return {
    kind: 'mongodb',
    async getUser(phone) { return (await users()).findOne({ _id: phone }); },
    async getUserByGoogle(sub) { return (await users()).findOne({ googleSub: sub }); },
    async createUser(user) {
      try {
        await (await users()).insertOne({ _id: user.phone, ...user });
        return true;
      } catch (e) {
        if (e && e.code === 11000) return false; // SĐT (hoặc tài khoản Google) đã có
        throw e;
      }
    },
    async getChat(phone) { return (await chats()).findOne({ _id: phone }); },
    async listChats() {
      const list = await (await chats()).find({}, { projection: { messages: { $slice: -1 } } })
        .sort({ updatedAt: -1 }).limit(300).toArray();
      return list.map(summarize);
    },
    async appendMessage(phone, fields, msg) {
      const set = { phone, updatedAt: msg.at };
      const onInsert = { createdAt: msg.at };
      if (fields.customerName) set.customerName = fields.customerName; else onInsert.customerName = 'Khách hàng';
      if (fields.topic) set.topic = fields.topic; else onInsert.topic = '';
      const inc = msg.from === 'sale' ? { customerUnread: 1 } : { staffUnread: 1 };
      if (msg.from === 'sale') onInsert.staffUnread = 0; else onInsert.customerUnread = 0;
      return (await chats()).findOneAndUpdate(
        { _id: phone },
        { $push: { messages: { $each: [msg], $slice: -MAX_MESSAGES } }, $inc: inc, $set: set, $setOnInsert: onInsert },
        { upsert: true, returnDocument: 'after' }
      );
    },
    async markRead(phone, side) {
      return (await chats()).findOneAndUpdate(
        { _id: phone },
        { $set: { [side === 'sale' ? 'staffUnread' : 'customerUnread']: 0 } },
        { returnDocument: 'after' }
      );
    }
  };
}

const store = process.env.MONGODB_URI
  ? mongoStore(process.env.MONGODB_URI, process.env.MONGODB_DB || 'aloha_baby')
  : memoryStore();
if (store.kind === 'memory') {
  console.warn('CẢNH BÁO: chưa đặt MONGODB_URI - tin nhắn chat lưu trong bộ nhớ, server khởi động lại là MẤT HẾT. Chỉ dùng để chạy thử local.');
}

// ---------------------------------------------------------------- API
const router = express.Router();
const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
  console.error('sale-chat error:', err && err.message);
  res.status(503).json({ error: 'store_unavailable' });
});

function requireAuth(roles) {
  return (req, res, next) => {
    const m = /^Bearer (.+)$/.exec(req.get('authorization') || '');
    const user = m && verifyToken(m[1]);
    if (!user) return res.status(401).json({ error: 'unauthorized' });
    if (roles && !roles.includes(user.role)) return res.status(403).json({ error: 'forbidden' });
    req.user = user;
    next();
  };
}

const hits = new Map(); // phone -> [thời điểm gửi tin gần đây]
function rateLimited(phone) {
  const now = Date.now();
  const list = (hits.get(phone) || []).filter((t) => now - t < RATE_LIMIT.windowMs);
  list.push(now);
  hits.set(phone, list);
  return list.length > RATE_LIMIT.max;
}

function cleanText(s) {
  const text = String(s || '').replace(/\r\n/g, '\n').trim();
  return text && text.length <= MAX_TEXT ? text : null;
}

function issue(res, session) {
  const token = signToken({ ...session, exp: Date.now() + TOKEN_TTL_MS });
  res.json({ token, session });
}

router.post('/auth/login', wrap(async (req, res) => {
  const phone = normPhone(req.body.phone);
  const password = String(req.body.password || '');
  const demo = DEMO_ACCOUNTS[phone];
  if (demo) {
    if (!samePassword(password, demo.password)) return res.status(401).json({ error: 'wrong_credentials' });
    return issue(res, { phone, role: demo.role, name: demo.name });
  }
  const user = isPhone(phone) ? await store.getUser(phone) : null;
  if (user && !user.hash && user.googleSub) return res.status(401).json({ error: 'use_google' });
  if (!user || !checkPassword(password, user)) return res.status(401).json({ error: 'wrong_credentials' });
  return issue(res, { phone, role: 'khach-hang', name: user.name });
}));

// ---- Đăng nhập bằng Google
// Trang hỏi Client ID ở đây (không ghi cứng trong HTML): đổi/bật/tắt chỉ cần sửa biến trên Render.
router.get('/auth/config', (req, res) => {
  res.json({ googleClientId: GOOGLE_CLIENT_ID || null });
});

// Nhờ Google kiểm tra ID token (chữ ký + hạn dùng), rồi tự kiểm tra token cấp cho ĐÚNG web này.
async function verifyGoogleCredential(credential) {
  if (!credential || typeof credential !== 'string' || credential.length > 4096) return null;
  try {
    const r = await fetch(GOOGLE_TOKENINFO_URL + '?id_token=' + encodeURIComponent(credential),
      { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const info = await r.json();
    const issOk = info.iss === 'accounts.google.com' || info.iss === 'https://accounts.google.com';
    if (info.aud !== GOOGLE_CLIENT_ID || !issOk || !info.sub) return null;
    return { sub: String(info.sub), email: String(info.email || ''), name: String(info.name || '').slice(0, 80) };
  } catch (e) {
    console.error('Google tokeninfo lỗi:', e.message);
    return null;
  }
}

router.post('/auth/google', wrap(async (req, res) => {
  if (!GOOGLE_CLIENT_ID) return res.status(503).json({ error: 'google_disabled' });
  const g = await verifyGoogleCredential(req.body.credential);
  if (!g) return res.status(401).json({ error: 'bad_google_token' });
  const user = await store.getUserByGoogle(g.sub);
  if (user) return issue(res, { phone: user.phone, role: 'khach-hang', name: user.name });
  // Lần đầu: cấp "vé" ngắn hạn để khách nhập SĐT. Vé không có role nên không dùng được
  // thay mã đăng nhập (requireAuth kiểm tra role).
  const ticket = signToken({ kind: 'google-signup', sub: g.sub, email: g.email, name: g.name, exp: Date.now() + GOOGLE_SIGNUP_TTL_MS });
  res.json({ needPhone: true, ticket, name: g.name, email: g.email });
}));

router.post('/auth/google/complete', wrap(async (req, res) => {
  const t = verifyToken(req.body.ticket);
  if (!t || t.kind !== 'google-signup' || !t.sub) return res.status(401).json({ error: 'ticket_expired' });
  const phone = normPhone(req.body.phone);
  const name = String(req.body.name || t.name || '').trim().slice(0, 80);
  if (!name) return res.status(400).json({ error: 'bad_name', message: 'Vui lòng nhập họ tên.' });
  if (!isPhone(phone)) return res.status(400).json({ error: 'bad_phone', message: 'Số điện thoại chưa đúng (10-11 số, bắt đầu bằng 0).' });
  const linked = await store.getUserByGoogle(t.sub); // bấm Hoàn tất 2 lần
  if (linked) return issue(res, { phone: linked.phone, role: 'khach-hang', name: linked.name });
  if (DEMO_ACCOUNTS[phone]) return res.status(409).json({ error: 'phone_taken' });
  const created = await store.createUser({
    phone, name, role: 'khach-hang', provider: 'google', googleSub: t.sub, email: t.email || '', createdAt: Date.now()
  });
  if (!created) return res.status(409).json({ error: 'phone_taken' });
  return issue(res, { phone, role: 'khach-hang', name });
}));

router.post('/auth/register', wrap(async (req, res) => {
  const phone = normPhone(req.body.phone);
  const name = String(req.body.name || '').trim().slice(0, 80);
  const password = String(req.body.password || '');
  if (!name) return res.status(400).json({ error: 'bad_name', message: 'Vui lòng nhập họ tên.' });
  if (!isPhone(phone)) return res.status(400).json({ error: 'bad_phone', message: 'Số điện thoại chưa đúng (10-11 số, bắt đầu bằng 0).' });
  if (password.length < 6) return res.status(400).json({ error: 'weak_password', message: 'Mật khẩu cần ít nhất 6 ký tự.' });
  if (DEMO_ACCOUNTS[phone]) return res.status(409).json({ error: 'phone_taken' });
  const created = await store.createUser({ phone, name, ...hashPassword(password), role: 'khach-hang', createdAt: Date.now() });
  if (!created) return res.status(409).json({ error: 'phone_taken' });
  return issue(res, { phone, role: 'khach-hang', name });
}));

// ---- Khách hàng: chỉ cuộc trò chuyện của chính mình (SĐT lấy từ token)
router.get('/me', requireAuth(['khach-hang']), wrap(async (req, res) => {
  res.json({ chat: publicChat(await store.getChat(req.user.phone)) });
}));

router.post('/me/messages', requireAuth(['khach-hang']), wrap(async (req, res) => {
  const text = cleanText(req.body.text);
  if (!text) return res.status(400).json({ error: 'bad_text' });
  if (rateLimited(req.user.phone)) return res.status(429).json({ error: 'too_many_messages' });
  const topic = String(req.body.topic || '').trim().slice(0, MAX_TOPIC);
  const chat = await store.appendMessage(req.user.phone, { customerName: req.user.name, topic },
    newMessage('khach', req.user.name, text));
  res.json({ chat: publicChat(chat) });
}));

// Khách chuyển từ trợ lý AI sang chat với Sale: lưu bản tóm tắt các mục khách đã xem / đã hỏi
// (trình duyệt dựng chữ từ hành trình trong phiên, js/sale-chat.js) thành 1 tin hệ thống để Sale
// đọc trước khi trả lời. Cuộc trò chuyện chưa có thì tạo mới, Sale thấy ngay trong hộp thư.
router.post('/me/handoff', requireAuth(['khach-hang']), wrap(async (req, res) => {
  const text = cleanText(req.body.summary);
  if (!text) return res.status(400).json({ error: 'bad_summary' });
  if (rateLimited(req.user.phone)) return res.status(429).json({ error: 'too_many_messages' });
  const topic = String(req.body.topic || '').trim().slice(0, MAX_TOPIC);
  const chat = await store.appendMessage(req.user.phone, { customerName: req.user.name, topic },
    newMessage('he-thong', 'Tóm tắt tự động', text, 'summary'));
  res.json({ chat: publicChat(chat) });
}));

router.post('/me/read', requireAuth(['khach-hang']), wrap(async (req, res) => {
  res.json({ chat: publicChat(await store.markRead(req.user.phone, 'khach')) });
}));

// ---- Nhân viên: Sale đọc + trả lời, Sếp chỉ xem
router.get('/inbox', requireAuth(['sale', 'sep']), wrap(async (req, res) => {
  res.json({ chats: await store.listChats() });
}));

router.get('/inbox/:phone', requireAuth(['sale', 'sep']), wrap(async (req, res) => {
  const chat = await store.getChat(normPhone(req.params.phone));
  if (!chat) return res.status(404).json({ error: 'not_found' });
  res.json({ chat: publicChat(chat) });
}));

router.post('/inbox/:phone/messages', requireAuth(['sale']), wrap(async (req, res) => {
  const phone = normPhone(req.params.phone);
  const text = cleanText(req.body.text);
  if (!text) return res.status(400).json({ error: 'bad_text' });
  if (!(await store.getChat(phone))) return res.status(404).json({ error: 'not_found' });
  if (rateLimited(req.user.phone)) return res.status(429).json({ error: 'too_many_messages' });
  const chat = await store.appendMessage(phone, {}, newMessage('sale', req.user.name, text));
  res.json({ chat: publicChat(chat) });
}));

router.post('/inbox/:phone/read', requireAuth(['sale']), wrap(async (req, res) => {
  const chat = await store.markRead(normPhone(req.params.phone), 'sale');
  if (!chat) return res.status(404).json({ error: 'not_found' });
  res.json({ chat: publicChat(chat) });
}));

module.exports = { router, storeKind: store.kind };
