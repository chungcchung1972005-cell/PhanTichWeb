// ALOHA Baby — API yêu cầu chỉnh ảnh dùng chung Khách / Thợ ảnh / Sếp (bước backend đầu tiên,
// thêm 2026-10-15). Gắn vào server.js tại /api/edit-requests.
//
// CHỈ LƯU TRONG RAM (trưởng nhóm chốt 2026-10-15): router này KHÔNG dùng MongoDB, kể cả khi
// server có MONGODB_URI (chat Sale vẫn dùng MongoDB như cũ, không liên quan). Server khởi động
// lại là mất hết - chỉ dùng để phát triển/kiểm thử với dữ liệu giả. Frontend đã nối vào đây qua
// js/edit-sync.js NHƯNG chỉ khi bật cờ editSync (js/features.js, mặc định TẮT): khách, Thợ ảnh (ghi)
// và Sếp (chỉ đọc). Cờ tắt thì các trang vẫn đọc/ghi localStorage (js/data-store.js) như trước.
//
// Xác thực dùng chung token của server/sale-chat.js (requireAuth, ký bằng AUTH_SECRET).
// Phân quyền kiểm ở server:
//  - Khách (role khach-hang, SĐT thật): chỉ tạo/đọc/nhắn trong yêu cầu CỦA CHÍNH MÌNH (SĐT lấy
//    từ token, không lấy từ dữ liệu gửi lên). Khách vãng lai (token "khach-vang-lai-...") bị từ chối.
//  - Thợ ảnh (tho-anh): đọc mọi yêu cầu, đánh dấu ảnh xong, lưu link, Hoàn tất, nhắn khách.
//  - Sếp (sep): CHỈ ĐỌC.
//  - Sale và mọi vai trò khác: bị từ chối.
// Link ảnh GỐC (resultLinkOriginal) chỉ dùng nội bộ: KHÔNG BAO GIỜ có trong phản hồi gửi khách.
// Tin nhắn from 'ai' KHÔNG nhận từ client: người gửi luôn suy ra từ vai trò trong token.
// Chống ghi đè: mỗi yêu cầu có "rev" (tăng mỗi lần đổi dữ liệu nghiệp vụ: link, Hoàn tất, ảnh đã
// xong; "đã xem" và tin nhắn không tăng, chỉ đổi updatedAt); lưu link / Hoàn tất phải gửi kèm rev
// đang có, lệch thì trả 409 kèm bản mới nhất để trang tải lại.
const crypto = require('crypto');
const express = require('express');
const { requireAuth } = require('./sale-chat');

// ---------------------------------------------------------------- Cấu hình / giới hạn
const STATUS_FLOW = ['Chờ xử lý', 'Đang thực hiện', 'Hoàn thành']; // khớp js/data-store.js
const MAX_REQUESTS = 2000;          // tổng số yêu cầu giữ trong RAM
const MAX_PHOTOS = 200;             // số ảnh tối đa trong 1 yêu cầu
const MAX_NOTE = 500;               // ghi chú chung / ghi chú từng ảnh
const MAX_MESSAGE = 1500;           // khớp addRequestMessage trong js/data-store.js
const MAX_MESSAGES = 500;           // mỗi yêu cầu giữ tối đa bấy nhiêu tin gần nhất
const MAX_URL = 2048;
const RATE = { windowMs: 60 * 1000, create: 5, message: 30 }; // theo tài khoản

// ---------------------------------------------------------------- Làm sạch đầu vào
// Lưu dạng CHỮ THUẦN (bỏ ký tự điều khiển, cắt độ dài). Không tự "escape" HTML ở đây: trang hiển
// thị luôn phải escape khi in ra (crm/js/admin.js, js/chon-anh.js đang làm vậy).
const CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
function cleanStr(v, max) {
  if (typeof v !== 'string') return '';
  return v.replace(/\r\n/g, '\n').replace(CTRL, '').trim().slice(0, max);
}
// Chuỗi bắt buộc: rỗng hoặc vượt giới hạn -> null (để báo lỗi thay vì cắt ngầm)
function requiredText(v, max) {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\r\n/g, '\n').replace(CTRL, '').trim();
  return t && t.length <= max ? t : null;
}
const isHttpsUrl = (s) => typeof s === 'string' && s.length <= MAX_URL && /^https:\/\/[^\s<>"']+$/i.test(s);
// Ảnh khách chọn: link Google Photos (https) hoặc ảnh demo trong dự án ("images/...")
const isPhotoSrc = (s) => isHttpsUrl(s) || (typeof s === 'string' && s.length <= 300 && /^images\/[\w\-./]+$/.test(s) && !s.includes('..'));
const isPhotoId = (s) => typeof s === 'string' && /^[\w-]{1,40}$/.test(s);
const isPhone = (p) => /^0\d{9,10}$/.test(String(p || ''));
const nonNegInt = (v, max) => (Number.isInteger(v) && v >= 0 && v <= max ? v : null);

// ---------------------------------------------------------------- Kho RAM
const requests = new Map(); // id -> bản ghi
const newId = () => 'ER-' + Date.now().toString(36) + '-' + crypto.randomBytes(4).toString('hex');
const clone = (x) => JSON.parse(JSON.stringify(x));

function touch(req) {
  req.rev += 1;
  req.updatedAt = Date.now();
}

// Bản gửi cho KHÁCH: bỏ link ảnh gốc + các trường nội bộ (thợ phụ trách, ưu tiên, cờ "thợ đã xem",
// cờ "cần thợ trả lời" trên từng tin).
function customerView(req) {
  const v = clone(req);
  delete v.resultLinkOriginal;
  delete v.photographer;
  delete v.priority;
  delete v.staffSeen;
  v.messages = v.messages.map(({ needsStaff, ...m }) => m);
  return v;
}
const staffView = (req) => clone(req);
const viewFor = (user, req) => (user.role === 'khach-hang' ? customerView(req) : staffView(req));

// ---------------------------------------------------------------- Giới hạn tần suất
const hits = new Map(); // key -> [thời điểm]
function limited(key, max) {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < RATE.windowMs);
  list.push(now);
  hits.set(key, list);
  return list.length > max;
}

// ---------------------------------------------------------------- Middleware
const router = express.Router();

// Khách phải có SĐT thật trong token (chặn khách vãng lai "khach-vang-lai-...")
function realCustomerOnly(req, res, next) {
  if (req.user.role === 'khach-hang' && !isPhone(req.user.phone)) return res.status(403).json({ error: 'guest_not_allowed' });
  next();
}
const auth = (roles) => [requireAuth(roles), realCustomerOnly];

// Tìm yêu cầu theo :id; khách chỉ thấy yêu cầu của mình (của người khác trả 404, không lộ là có tồn tại)
function loadRequest(req, res, next) {
  const id = String(req.params.id || '');
  const found = /^ER-[a-z0-9]+-[a-f0-9]{8}$/.test(id) ? requests.get(id) : null;
  if (!found || (req.user.role === 'khach-hang' && found.phone !== req.user.phone)) {
    return res.status(404).json({ error: 'not_found' });
  }
  req.editRequest = found;
  next();
}

// rev bắt buộc cho các thao tác dễ ghi đè nhau (lưu link, Hoàn tất)
function checkRev(req, res) {
  const rev = req.body && req.body.rev;
  if (!Number.isInteger(rev)) { res.status(400).json({ error: 'rev_required' }); return false; }
  if (rev !== req.editRequest.rev) {
    res.status(409).json({ error: 'conflict', request: viewFor(req.user, req.editRequest) });
    return false;
  }
  return true;
}

const body = (req) => (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {});

// ---------------------------------------------------------------- API
// Không cần đăng nhập: cho test/giám sát biết router này lưu ở đâu.
router.get('/health', (req, res) => res.json({ ok: true, store: 'memory', count: requests.size }));

// ---- Khách
router.get('/me', auth(['khach-hang']), (req, res) => {
  const mine = [...requests.values()].filter((r) => r.phone === req.user.phone)
    .sort((a, b) => a.createdAt - b.createdAt).map(customerView);
  res.json({ requests: mine, at: Date.now() });
});

router.post('/', auth(['khach-hang']), (req, res) => {
  const b = body(req);
  if (!Array.isArray(b.photos) || !b.photos.length || b.photos.length > MAX_PHOTOS) return res.status(400).json({ error: 'bad_photos' });
  const seen = new Set();
  const photos = [];
  for (const p of b.photos) {
    if (!p || typeof p !== 'object' || !isPhotoId(p.id) || !isPhotoSrc(p.src) || seen.has(p.id)) return res.status(400).json({ error: 'bad_photos' });
    seen.add(p.id);
    photos.push({ id: p.id, src: p.src, note: cleanStr(p.note, MAX_NOTE), isExtra: p.isExtra === true });
  }
  const orderCode = cleanStr(b.orderCode, 30);
  if (orderCode && !/^#?[A-Za-z0-9-]{3,29}$/.test(orderCode)) return res.status(400).json({ error: 'bad_order_code' });
  // Số ảnh/phí chỉnh thêm: trình duyệt tính theo cấu hình gói (chưa có bảng giá ở server) - server chỉ
  // kiểm khoảng hợp lệ. extraCount suy ra từ chính danh sách ảnh để không lệch nhau.
  const extraFee = b.extraFee === undefined ? 0 : nonNegInt(b.extraFee, 100000000);
  if (extraFee === null) return res.status(400).json({ error: 'bad_extra_fee' });
  // Chỉ đếm lượt tạo hợp lệ (lượt gửi sai đã bị từ chối ở trên, không ghi gì vào kho)
  if (limited('create:' + req.user.phone, RATE.create)) return res.status(429).json({ error: 'too_many_requests' });
  if (requests.size >= MAX_REQUESTS) return res.status(503).json({ error: 'store_full' });

  const now = Date.now();
  const rec = {
    id: newId(),
    phone: req.user.phone,               // từ token, KHÔNG từ dữ liệu gửi lên
    customerName: req.user.name || 'Khách hàng',
    orderCode,
    serviceLabel: cleanStr(b.serviceLabel, 40),
    note: cleanStr(b.note, MAX_NOTE),
    photos,
    photoNotes: photos.filter((p) => p.note).map((p) => ({ id: p.id, note: p.note })),
    photoCount: photos.length,
    extraCount: photos.filter((p) => p.isExtra).length,
    extraFee,
    paymentStatus: cleanStr(b.paymentStatus, 60),
    status: STATUS_FLOW[0],
    doneIds: [],
    photographer: null,                  // "Chưa phân công"
    priority: null,                      // trang quản trị tự suy theo ngưỡng tạm khi chưa gán
    resultLink: '',
    resultLinkOriginal: '',
    resultLinkAt: null,
    messages: [],
    staffSeen: false,
    customerSeenDone: false,
    customerSeenEditedSig: '',
    rev: 1,
    createdAt: now,
    updatedAt: now
  };
  requests.set(rec.id, rec);
  res.status(201).json({ request: customerView(rec) });
});

// ---- Nhân viên: danh sách (Thợ ảnh + Sếp). ?since=<ms> chỉ trả yêu cầu đổi sau mốc đó.
router.get('/', auth(['tho-anh', 'sep']), (req, res) => {
  const since = Number(req.query.since);
  const list = [...requests.values()]
    .filter((r) => !Number.isFinite(since) || r.updatedAt > since)
    .sort((a, b) => a.createdAt - b.createdAt).map(staffView);
  res.json({ requests: list, at: Date.now() });
});

// ---- 1 yêu cầu: khách (của mình) / Thợ ảnh / Sếp
router.get('/:id', auth(['khach-hang', 'tho-anh', 'sep']), loadRequest, (req, res) => {
  res.json({ request: viewFor(req.user, req.editRequest) });
});

// ---- Tin nhắn: khách -> 'customer', Thợ ảnh -> 'staff'. Trường "from" gửi lên bị BỎ QUA
// (không giả được tin 'ai'). Sếp chỉ xem.
router.post('/:id/messages', auth(['khach-hang', 'tho-anh']), loadRequest, (req, res) => {
  const text = requiredText(body(req).text, MAX_MESSAGE);
  if (!text) return res.status(400).json({ error: 'bad_text' });
  if (limited('msg:' + req.user.phone, RATE.message)) return res.status(429).json({ error: 'too_many_messages' });
  const r = req.editRequest;
  const from = req.user.role === 'khach-hang' ? 'customer' : 'staff';
  const msg = { id: 'M-' + Date.now().toString(36) + '-' + crypto.randomBytes(3).toString('hex'), from, name: cleanStr(req.user.name, 60), text, at: Date.now() };
  if (from === 'customer') msg.needsStaff = true;
  r.messages.push(msg);
  if (r.messages.length > MAX_MESSAGES) r.messages.splice(0, r.messages.length - MAX_MESSAGES);
  // Tin nhắn KHÔNG tăng rev (sửa 2026-10-15): chỉ thêm vào cuối danh sách tin, không đổi link /
  // trạng thái / ảnh đã xong mà lưu link / Hoàn tất kiểm tra bằng rev -> tăng rev chỉ gây 409 giả
  // khi khách nhắn trong lúc Thợ ảnh đang mở yêu cầu. Vẫn đổi updatedAt để ?since= lấy được tin mới.
  r.updatedAt = Date.now();
  res.json({ request: viewFor(req.user, r) });
});

// ---- Đánh dấu đã xem: khách (thông báo Hoàn thành / dấu đã xem tab Ảnh đã chỉnh), Thợ ảnh (Mới)
// "Đã xem" KHÔNG tăng rev (sửa 2026-10-15): rev chỉ đại diện dữ liệu nghiệp vụ mà lưu link /
// Hoàn tất kiểm tra. 3 cờ đã xem (staffSeen, customerSeenDone, customerSeenEditedSig) không bao giờ
// bị lưu link / Hoàn tất ghi lại, nên không thể đè nhau; tăng rev ở đây chỉ làm Thợ ảnh nhận 409 giả
// mỗi khi khách mở tab xem. Vẫn cập nhật updatedAt (khi có cờ thật sự đổi) để ?since= lấy được thay đổi.
router.post('/:id/seen', auth(['khach-hang', 'tho-anh']), loadRequest, (req, res) => {
  const r = req.editRequest;
  const before = [r.staffSeen, r.customerSeenDone, r.customerSeenEditedSig].join('|');
  if (req.user.role === 'tho-anh') {
    r.staffSeen = true;
  } else {
    const b = body(req);
    if (b.done === true && r.status === 'Hoàn thành') r.customerSeenDone = true;
    if (typeof b.editedSig === 'string') r.customerSeenEditedSig = cleanStr(b.editedSig, 300);
  }
  if ([r.staffSeen, r.customerSeenDone, r.customerSeenEditedSig].join('|') !== before) r.updatedAt = Date.now();
  res.json({ request: viewFor(req.user, r) });
});

// ---- Thợ ảnh: đánh dấu / bỏ đánh dấu 1 ảnh đã xong. Thao tác theo từng ảnh nên 2 người đánh dấu
// 2 ảnh khác nhau cùng lúc không đè nhau (không cần rev).
router.post('/:id/done-photos', auth(['tho-anh']), loadRequest, (req, res) => {
  const b = body(req);
  const r = req.editRequest;
  if (!isPhotoId(b.photoId) || !r.photos.some((p) => p.id === b.photoId) || typeof b.done !== 'boolean') {
    return res.status(400).json({ error: 'bad_photo' });
  }
  if (r.status === 'Hoàn thành') return res.status(409).json({ error: 'already_completed', request: staffView(r) });
  const has = r.doneIds.includes(b.photoId);
  if (b.done && !has) r.doneIds.push(b.photoId);
  if (!b.done && has) r.doneIds = r.doneIds.filter((x) => x !== b.photoId);
  touch(r);
  res.json({ request: staffView(r) });
});

// ---- Thợ ảnh: lưu 2 link (ảnh đã chỉnh: khách thấy; ảnh gốc: CHỈ nội bộ). Cần rev.
// Chuỗi rỗng = gỡ link; không gửi trường nào thì giữ nguyên link đó.
router.post('/:id/links', auth(['tho-anh']), loadRequest, (req, res) => {
  const b = body(req);
  const r = req.editRequest;
  const has = (k) => Object.prototype.hasOwnProperty.call(b, k);
  if (!has('resultLink') && !has('resultLinkOriginal')) return res.status(400).json({ error: 'no_links' });
  for (const k of ['resultLink', 'resultLinkOriginal']) {
    if (has(k) && b[k] !== '' && !isHttpsUrl(b[k])) return res.status(400).json({ error: 'bad_link', field: k });
  }
  if (r.status === 'Hoàn thành' && has('resultLink') && !b.resultLink) return res.status(409).json({ error: 'cannot_remove_after_complete' });
  if (!checkRev(req, res)) return;
  if (has('resultLink')) {
    r.resultLink = b.resultLink;
    r.resultLinkAt = b.resultLink ? Date.now() : null;
  }
  if (has('resultLinkOriginal')) r.resultLinkOriginal = b.resultLinkOriginal;
  touch(r);
  res.json({ request: staffView(r) });
});

// ---- Thợ ảnh: Hoàn tất (1 bước ở server): bắt buộc có link ảnh đã chỉnh hợp lệ, đánh dấu xong
// mọi ảnh, chuyển thẳng sang "Hoàn thành". Cần rev.
router.post('/:id/complete', auth(['tho-anh']), loadRequest, (req, res) => {
  const r = req.editRequest;
  if (r.status === 'Hoàn thành') return res.status(409).json({ error: 'already_completed', request: staffView(r) });
  if (!isHttpsUrl(r.resultLink)) return res.status(422).json({ error: 'edited_link_required' });
  if (!checkRev(req, res)) return;
  r.doneIds = r.photos.map((p) => p.id);
  r.status = 'Hoàn thành';
  touch(r);
  res.json({ request: staffView(r) });
});

module.exports = { router, storeKind: 'memory' };
