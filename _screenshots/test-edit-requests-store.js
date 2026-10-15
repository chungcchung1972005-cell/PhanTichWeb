// Test kho dữ liệu yêu cầu chỉnh ảnh (server/edit-requests-store.js) + API chạy trên kho MongoDB.
// KHÔNG chụp ảnh, KHÔNG mở trình duyệt, KHÔNG kết nối MongoDB / Atlas thật, chỉ dữ liệu giả.
//
// GIỚI HẠN (ghi rõ): chế độ MongoDB được kiểm bằng 1 COLLECTION GIẢ LẬP trong bộ nhớ (FakeCollection
// bên dưới) mô phỏng đúng các lệnh driver mongodb 6 mà kho dùng: insertOne, findOne, find().sort()
// .toArray(), countDocuments, findOneAndUpdate (returnDocument 'after') với $set / $inc / $push
// ($each + $slice) / $addToSet / $pull và bộ lọc so bằng / $ne / $gt. Đây là kiểm tra ĐÚNG LỆNH
// kho gửi xuống, KHÔNG thay được việc chạy trên MongoDB thật (cần database thử nghiệm riêng).
//   node _screenshots/test-edit-requests-store.js
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
// Môi trường cho module server: không MongoDB nào (kể cả chat), khoá ký token cố định
process.env.AUTH_SECRET = 'test-secret';
delete process.env.MONGODB_URI;
delete process.env.EDIT_REQUESTS_MONGODB_URI;
const express = require(path.join(ROOT, 'server/node_modules/express'));
const storeLib = require(path.join(ROOT, 'server/edit-requests-store.js'));
const { createEditRequestsRouter } = require(path.join(ROOT, 'server/edit-requests.js'));
const saleChat = require(path.join(ROOT, 'server/sale-chat.js'));

let pass = 0, fail = 0;
const check = (name, ok, extra) => {
  if (ok) { pass++; console.log('✓', name); } else { fail++; console.log('✗', name, extra !== undefined ? '→ ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : ''); }
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- Collection MongoDB giả lập
class FakeCollection {
  constructor() { this.docs = new Map(); this.ops = []; this.indexes = []; }
  static copy(x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x)); }
  static match(doc, filter) {
    return Object.entries(filter).every(([k, cond]) => {
      const v = doc[k];
      if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
        return Object.entries(cond).every(([op, x]) => {
          if (op === '$ne') return v !== x;
          if (op === '$gt') return v > x;
          throw new Error('FakeCollection: toán tử lọc chưa hỗ trợ ' + op);
        });
      }
      return v === cond;
    });
  }
  async createIndex(spec) { this.indexes.push(spec); return 'ok'; }
  async insertOne(doc) {
    this.ops.push('insertOne');
    if (this.docs.has(doc._id)) { const e = new Error('E11000 duplicate key'); e.code = 11000; throw e; }
    this.docs.set(doc._id, FakeCollection.copy(doc));
    return { acknowledged: true, insertedId: doc._id };
  }
  async findOne(filter) { this.ops.push('findOne'); return FakeCollection.copy([...this.docs.values()].find((d) => FakeCollection.match(d, filter)) || null); }
  async countDocuments(filter) { return [...this.docs.values()].filter((d) => FakeCollection.match(d, filter || {})).length; }
  find(filter) {
    this.ops.push('find');
    let list = [...this.docs.values()].filter((d) => FakeCollection.match(d, filter || {}));
    const cur = {
      sort(spec) { const [[k, dir]] = Object.entries(spec); list = list.slice().sort((a, b) => (a[k] - b[k]) * dir); return cur; },
      async toArray() { return list.map(FakeCollection.copy); }
    };
    return cur;
  }
  // Đồng bộ trong 1 lượt (không await giữa đọc và ghi) => nguyên tử như MongoDB trên 1 document
  async findOneAndUpdate(filter, update, opts) {
    this.ops.push('findOneAndUpdate');
    if (!opts || opts.returnDocument !== 'after') throw new Error('FakeCollection: kho phải yêu cầu returnDocument after');
    const doc = [...this.docs.values()].find((d) => FakeCollection.match(d, filter));
    if (!doc) return null;
    for (const [op, fields] of Object.entries(update)) {
      for (const [k, val] of Object.entries(fields)) {
        if (op === '$set') doc[k] = FakeCollection.copy(val);
        else if (op === '$inc') doc[k] = (doc[k] || 0) + val;
        else if (op === '$push') {
          const each = val && val.$each ? val.$each : [val];
          doc[k] = (doc[k] || []).concat(FakeCollection.copy(each));
          if (val && val.$slice !== undefined) doc[k] = val.$slice < 0 ? doc[k].slice(val.$slice) : doc[k].slice(0, val.$slice);
        } else if (op === '$addToSet') { if (!(doc[k] || []).includes(val)) doc[k] = (doc[k] || []).concat([val]); }
        else if (op === '$pull') doc[k] = (doc[k] || []).filter((x) => x !== val);
        else throw new Error('FakeCollection: toán tử cập nhật chưa hỗ trợ ' + op);
      }
    }
    return FakeCollection.copy(doc);
  }
}
const fakeMongoStore = (col) => storeLib.mongoStoreFromCollection(async () => col);

// ---------------------------------------------------------------- Dữ liệu giả
const rec = (id, phone, createdAt, extra) => Object.assign({
  id, phone, customerName: 'Khach gia', orderCode: '#ABFAKE', serviceLabel: 'Newborn', note: '', photos: [{ id: 'ph-1', src: 'images/a.jpg', note: '', isExtra: false }, { id: 'ph-2', src: 'images/b.jpg', note: '', isExtra: false }],
  photoNotes: [], photoCount: 2, extraCount: 0, extraFee: 0, paymentStatus: '', status: 'Chờ xử lý', doneIds: [], photographer: null, priority: null,
  resultLink: '', resultLinkOriginal: '', resultLinkAt: null, messages: [], staffSeen: false, customerSeenDone: false, customerSeenEditedSig: '', rev: 1, createdAt, updatedAt: createdAt
}, extra || {});

// Cùng 1 bộ kiểm tra cho cả 2 kho
async function contract(label, store) {
  const t0 = 1000;
  await store.insert(rec('ER-a-00000001', '0900000001', t0));
  await store.insert(rec('ER-b-00000002', '0911111111', t0 + 10));
  await store.insert(rec('ER-c-00000003', '0900000001', t0 + 5));
  check(`[${label}] count = 3`, (await store.count()) === 3);
  const g = await store.get('ER-a-00000001');
  check(`[${label}] get trả bản ghi, không có _id`, g && g.phone === '0900000001' && !('_id' in g), g && Object.keys(g));
  g.status = 'BỊ SỬA NGOÀI KHO';
  check(`[${label}] get trả bản SAO (sửa bản sao không đổi kho)`, (await store.get('ER-a-00000001')).status === 'Chờ xử lý');
  check(`[${label}] get id không có -> null`, (await store.get('ER-x-99999999')) === null);
  check(`[${label}] listByPhone: đúng khách, theo createdAt tăng dần`, (await store.listByPhone('0900000001')).map((r) => r.id).join() === 'ER-a-00000001,ER-c-00000003');
  check(`[${label}] listAll: tất cả theo createdAt`, (await store.listAll()).map((r) => r.id).join() === 'ER-a-00000001,ER-c-00000003,ER-b-00000002');

  // Tin nhắn: không tăng rev, đổi updatedAt, giữ tối đa max tin
  let r = await store.addMessage('ER-a-00000001', { id: 'M1', from: 'customer', text: 'tin 1', at: 1 }, 3);
  check(`[${label}] addMessage: lưu tin, rev KHÔNG đổi, updatedAt đổi`, r.messages.length === 1 && r.rev === 1 && r.updatedAt > t0);
  for (let i = 2; i <= 5; i++) r = await store.addMessage('ER-a-00000001', { id: 'M' + i, from: 'staff', text: 'tin ' + i, at: i }, 3);
  check(`[${label}] addMessage: giữ 3 tin GẦN NHẤT đúng thứ tự`, r.messages.map((m) => m.id).join() === 'M3,M4,M5', r.messages.map((m) => m.id));
  check(`[${label}] addMessage id không có -> null`, (await store.addMessage('ER-x-99999999', { id: 'X' }, 3)) === null);

  // Đã xem: không tăng rev; không đổi gì thì updatedAt giữ nguyên
  const upd = (await store.get('ER-a-00000001')).updatedAt;
  await wait(3);
  r = await store.markSeen('ER-a-00000001', { staffSeen: true });
  check(`[${label}] markSeen: lưu cờ, rev KHÔNG đổi, updatedAt đổi`, r.staffSeen === true && r.rev === 1 && r.updatedAt > upd);
  const upd2 = r.updatedAt;
  await wait(3);
  r = await store.markSeen('ER-a-00000001', { staffSeen: true });
  check(`[${label}] markSeen không đổi gì -> updatedAt giữ nguyên`, r.updatedAt === upd2);
  check(`[${label}] listAll(since) lấy được thay đổi`, (await store.listAll(upd)).map((x) => x.id).join() === 'ER-a-00000001');

  // Ảnh xong: tăng rev
  r = (await store.setPhotoDone('ER-a-00000001', 'ph-1', true)).doc;
  check(`[${label}] setPhotoDone true: thêm ảnh, rev 2`, r.doneIds.join() === 'ph-1' && r.rev === 2);
  r = (await store.setPhotoDone('ER-a-00000001', 'ph-1', true)).doc;
  check(`[${label}] setPhotoDone lặp lại: không trùng ảnh, rev vẫn tăng (như trước)`, r.doneIds.join() === 'ph-1' && r.rev === 3);
  r = (await store.setPhotoDone('ER-a-00000001', 'ph-1', false)).doc;
  check(`[${label}] setPhotoDone false: bỏ ảnh, rev 4`, r.doneIds.length === 0 && r.rev === 4);

  // Cập nhật có điều kiện theo rev
  let u = await store.updateIfRev('ER-a-00000001', 4, { resultLink: 'https://drive.google.com/x', resultLinkAt: 5 });
  check(`[${label}] updateIfRev đúng rev: ghi, rev 5`, u.doc && u.doc.resultLink === 'https://drive.google.com/x' && u.doc.rev === 5);
  u = await store.updateIfRev('ER-a-00000001', 4, { resultLink: 'https://de.de' });
  check(`[${label}] updateIfRev rev cũ: conflict kèm bản mới nhất, KHÔNG ghi`, u.conflict && u.conflict.rev === 5 && u.conflict.resultLink === 'https://drive.google.com/x');
  check(`[${label}] updateIfRev id không có -> null`, (await store.updateIfRev('ER-x-99999999', 1, { a: 1 })) === null);
  const both = await Promise.all([
    store.updateIfRev('ER-a-00000001', 5, { resultLink: 'https://p1.example' }),
    store.updateIfRev('ER-a-00000001', 5, { resultLink: 'https://p2.example' })
  ]);
  check(`[${label}] 2 lệnh cùng rev chạy song song: đúng 1 thắng, 1 conflict`, both.filter((x) => x.doc).length === 1 && both.filter((x) => x.conflict).length === 1);
  const winner = both.find((x) => x.doc).doc.resultLink;
  check(`[${label}] giá trị giữ lại là của lệnh thắng`, (await store.get('ER-a-00000001')).resultLink === winner);

  // Hoàn tất (notDone) rồi các thao tác sau bị chặn
  u = await store.updateIfRev('ER-a-00000001', 6, { doneIds: ['ph-1', 'ph-2'], status: 'Hoàn thành' }, { notDone: true });
  check(`[${label}] Hoàn tất có điều kiện: status Hoàn thành, đủ ảnh, rev 7`, u.doc && u.doc.status === 'Hoàn thành' && u.doc.doneIds.length === 2 && u.doc.rev === 7);
  u = await store.updateIfRev('ER-a-00000001', 7, { status: 'Hoàn thành' }, { notDone: true });
  check(`[${label}] Hoàn tất lần 2 (đúng rev nhưng đã xong) -> conflict, không ghi`, !!u.conflict && u.conflict.rev === 7);
  const pd = await store.setPhotoDone('ER-a-00000001', 'ph-1', false);
  check(`[${label}] setPhotoDone sau Hoàn thành -> completed, không đổi`, !!pd.completed && pd.completed.doneIds.length === 2 && pd.completed.rev === 7);
  check(`[${label}] setPhotoDone id không có -> null`, (await store.setPhotoDone('ER-x-99999999', 'ph-1', true)) === null);
  check(`[${label}] yêu cầu khác không bị ảnh hưởng`, (await store.get('ER-b-00000002')).rev === 1 && (await store.get('ER-c-00000003')).messages.length === 0);
}

(async () => {
  let server = null;
  try {
    // =============================================================== A. Chọn kho theo biến môi trường
    let s = storeLib.createStoreFromEnv({});
    check('Không có biến nào -> RAM', s.store.kind === 'memory' && !s.configError);
    s = storeLib.createStoreFromEnv({ MONGODB_URI: 'mongodb://chat-sale.invalid/aloha_baby' });
    check('CHỈ có MONGODB_URI của chat -> vẫn RAM (không bao giờ dùng kết nối chat)', s.store.kind === 'memory' && !s.configError);
    s = storeLib.createStoreFromEnv({ EDIT_REQUESTS_MONGODB_URI: 'mongodb://127.0.0.1:1' });
    check('Có EDIT_REQUESTS_MONGODB_URI -> MongoDB riêng, mặc định aloha_edit_demo / edit_requests (chưa kết nối khi khởi tạo)', s.store.kind === 'mongodb' && s.store.dbName === 'aloha_edit_demo' && s.store.collectionName === 'edit_requests' && !s.configError, s.store);
    s = storeLib.createStoreFromEnv({ EDIT_REQUESTS_MONGODB_URI: 'mongodb://127.0.0.1:1', EDIT_REQUESTS_DB: 'aloha_baby' });
    check('EDIT_REQUESTS_DB trùng database chat (aloha_baby) -> từ chối, dùng RAM + báo lỗi', s.store.kind === 'memory' && /chat/.test(s.configError || ''), s.configError);
    s = storeLib.createStoreFromEnv({ EDIT_REQUESTS_MONGODB_URI: 'mongodb://127.0.0.1:1', MONGODB_DB: 'db_chat_rieng', EDIT_REQUESTS_DB: 'db_chat_rieng' });
    check('EDIT_REQUESTS_DB trùng MONGODB_DB tuỳ chỉnh của chat -> từ chối', s.store.kind === 'memory' && !!s.configError);
    for (const c of ['chats', 'users']) {
      s = storeLib.createStoreFromEnv({ EDIT_REQUESTS_MONGODB_URI: 'mongodb://127.0.0.1:1', EDIT_REQUESTS_COLLECTION: c });
      check(`Collection "${c}" (của chat) -> từ chối, dùng RAM`, s.store.kind === 'memory' && !!s.configError);
    }
    s = storeLib.createStoreFromEnv({ EDIT_REQUESTS_MONGODB_URI: 'mongodb://127.0.0.1:1', EDIT_REQUESTS_COLLECTION: 'a b$' });
    check('Tên collection không hợp lệ -> từ chối', s.store.kind === 'memory' && !!s.configError);
    const srcStore = fs.readFileSync(path.join(ROOT, 'server/edit-requests-store.js'), 'utf8');
    const srcRouter = fs.readFileSync(path.join(ROOT, 'server/edit-requests.js'), 'utf8');
    const readsChatUri = (src) => /(^|[^_A-Z])MONGODB_URI/.test(src.replace(/\/\/.*$/gm, ''));
    check('Mã nguồn kho + router KHÔNG đọc biến MONGODB_URI của chat (bỏ chú thích)', !readsChatUri(srcStore) && !readsChatUri(srcRouter));
    check('Router không tự nạp driver mongodb (chỉ kho MongoDB nạp khi được chọn)', !/require\(['"]mongodb['"]\)/.test(srcRouter));
    const masked = storeLib.safeError(new Error('connect failed mongodb+srv://u:matkhau-bi-mat@cluster.example/db?x=1 timeout'));
    check('safeError che chuỗi kết nối + mật khẩu trong log', !masked.includes('matkhau-bi-mat') && !masked.includes('mongodb+srv://') && masked.includes('<uri ẩn>'), masked);
    check('Mặc định module (không biến) -> storeKind = memory', require(path.join(ROOT, 'server/edit-requests.js')).storeKind === 'memory');

    // =============================================================== B. Cùng bộ kiểm tra cho 2 kho
    await contract('RAM', storeLib.memoryStore());
    const colB = new FakeCollection();
    await contract('MongoDB giả lập', fakeMongoStore(colB));
    check('[MongoDB giả lập] mọi thay đổi đi qua lệnh ghi của collection (insertOne / findOneAndUpdate)', colB.ops.includes('insertOne') && colB.ops.filter((o) => o === 'findOneAndUpdate').length >= 10);

    // =============================================================== C. Dữ liệu thật sự nằm trong collection, còn sau "khởi động lại"
    const colC = new FakeCollection();
    const s1 = fakeMongoStore(colC);
    await s1.insert(rec('ER-p-00000001', '0900000001', 2000));
    await s1.addMessage('ER-p-00000001', { id: 'M1', from: 'customer', text: 'xin chao', at: 1 }, 500);
    await s1.updateIfRev('ER-p-00000001', 1, { resultLink: 'https://drive.google.com/edit', resultLinkOriginal: 'https://drive.google.com/orig' });
    await s1.updateIfRev('ER-p-00000001', 2, { doneIds: ['ph-1', 'ph-2'], status: 'Hoàn thành' }, { notDone: true });
    await s1.markSeen('ER-p-00000001', { customerSeenDone: true });
    const raw = colC.docs.get('ER-p-00000001');
    check('Collection lưu đủ: tin nhắn, 2 link, trạng thái Hoàn thành, ảnh xong, cờ đã xem, rev', raw && raw.messages.length === 1 && raw.resultLink.includes('edit') && raw.resultLinkOriginal.includes('orig') && raw.status === 'Hoàn thành' && raw.doneIds.length === 2 && raw.customerSeenDone === true && raw.rev === 3, raw);
    const s2 = fakeMongoStore(colC); // kho MỚI trên cùng collection = server khởi động lại
    const again = await s2.get('ER-p-00000001');
    check('Kho mới trên cùng collection (giả lập khởi động lại) đọc lại đủ dữ liệu', again && again.status === 'Hoàn thành' && again.messages[0].text === 'xin chao' && again.rev === 3);

    // =============================================================== D. API thật qua HTTP trên kho MongoDB giả lập
    const colD = new FakeCollection();
    const app = express();
    app.use(express.json({ limit: '200kb' }));
    app.use('/api/sale-chat', saleChat.router);
    app.use('/api/edit-requests', createEditRequestsRouter(fakeMongoStore(colD), { allowPublicDemoStaff: true })); // test dùng Thợ ảnh/Sếp demo công khai
    // Kho lỗi (giả lập mất kết nối MongoDB, thông báo lỗi chứa chuỗi kết nối)
    app.use('/api/edit-requests-broken', createEditRequestsRouter(storeLib.mongoStoreFromCollection(async () => { throw new Error('getaddrinfo failed mongodb+srv://u:matkhau-lo@x.example'); })));
    server = await new Promise((resolve) => { const sv = app.listen(0, () => resolve(sv)); });
    const API = 'http://127.0.0.1:' + server.address().port;
    const call = async (p, t, b, base = '/api/edit-requests') => {
      const r = await fetch(API + base + p, { method: b ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(t ? { authorization: 'Bearer ' + t } : {}) }, body: b ? JSON.stringify(b) : undefined });
      const text = await r.text();
      let data = null; try { data = JSON.parse(text); } catch (e) { /* */ }
      return [r.status, data, text];
    };
    const login = async (phone, pw) => (await (await fetch(API + '/api/sale-chat/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, password: pw }) })).json()).token;
    const khach = await login('0900000001', 'khach123');
    const tho = await login('0900000003', 'anh123');
    const sep = await login('0900000004', 'sep123');
    const sale = await login('0900000002', 'sale123');

    let [st, d, raw2] = await call('/health');
    check('API health báo store "mongodb" khi dùng kho MongoDB', st === 200 && d.store === 'mongodb' && d.count === 0, d);
    [st, d] = await call('/', khach, { orderCode: '#ABFAKE1', serviceLabel: 'Newborn', note: 'ghi chu', photos: [{ id: 'ph-1', src: 'images/my-photos/photo-1.jpg', note: 'lam sang' }, { id: 'ph-2', src: 'images/my-photos/photo-2.jpg' }], extraFee: 0 });
    const rid = d && d.request && d.request.id;
    check('Khách tạo yêu cầu -> 201, ghi vào collection', st === 201 && colD.docs.has(rid) && colD.docs.get(rid).phone === '0900000001');
    [st, d] = await call('/', sale); check('Sale -> 403 (phân quyền giữ nguyên)', st === 403);
    [st, d] = await call('/me', khach); check('Khách /me đọc từ kho MongoDB', st === 200 && d.requests.length === 1);
    [st, d] = await call('/' + rid + '/messages', khach, { text: 'Khach nhan', from: 'ai' });
    check('Tin nhắn ghi vào collection, from "ai" bị bỏ qua, rev không đổi', st === 200 && colD.docs.get(rid).messages[0].from === 'customer' && colD.docs.get(rid).rev === 1);
    [st, d] = await call('/' + rid + '/seen', tho, {}); check('Thợ ảnh đã xem -> staffSeen lưu trong collection, rev không đổi', st === 200 && colD.docs.get(rid).staffSeen === true && colD.docs.get(rid).rev === 1);
    [st, d] = await call('/' + rid + '/done-photos', tho, { photoId: 'ph-1', done: true }); check('Đánh dấu ảnh xong -> collection doneIds, rev 2', st === 200 && colD.docs.get(rid).doneIds.join() === 'ph-1' && colD.docs.get(rid).rev === 2);
    [st, d] = await call('/' + rid + '/complete', tho, { rev: 2 }); check('Hoàn tất khi chưa có link ảnh đã chỉnh -> 422, collection không đổi', st === 422 && colD.docs.get(rid).status === 'Chờ xử lý');
    [st, d] = await call('/' + rid + '/links', tho, { resultLink: 'https://drive.google.com/edit', resultLinkOriginal: 'https://drive.google.com/goc-NOIBO', rev: 2 });
    check('Lưu 2 link -> collection có 2 link, rev 3', st === 200 && colD.docs.get(rid).resultLink.endsWith('/edit') && colD.docs.get(rid).resultLinkOriginal.includes('NOIBO') && colD.docs.get(rid).rev === 3);
    [st, d] = await call('/' + rid + '/links', tho, { resultLink: 'https://drive.google.com/de', rev: 2 });
    check('Lưu link với rev cũ -> 409 kèm bản mới nhất, collection không đổi', st === 409 && d.error === 'conflict' && d.request.rev === 3 && colD.docs.get(rid).resultLink.endsWith('/edit'));
    const duo = await Promise.all([call('/' + rid + '/links', tho, { resultLink: 'https://drive.google.com/p1', rev: 3 }), call('/' + rid + '/links', tho, { resultLink: 'https://drive.google.com/p2', rev: 3 })]);
    check('2 phiên cùng lưu link cùng rev -> 1 phiên 200, 1 phiên 409', JSON.stringify(duo.map((x) => x[0]).sort()) === '[200,409]', duo.map((x) => x[0]));
    [st, d, raw2] = await call('/' + rid, khach);
    check('Khách đọc yêu cầu: KHÔNG có link ảnh gốc', st === 200 && !('resultLinkOriginal' in d.request) && !raw2.includes('NOIBO'));
    [st, d] = await call('/' + rid, sep); check('Sếp đọc được link ảnh gốc (nội bộ)', st === 200 && d.request.resultLinkOriginal.includes('NOIBO'));
    [st, d] = await call('/' + rid + '/links', sep, { resultLink: 'https://x.example', rev: 4 }); check('Sếp lưu link -> 403', st === 403);
    [st, d] = await call('/' + rid + '/complete', tho, { rev: 4 });
    check('Hoàn tất đúng rev -> collection Hoàn thành, đủ ảnh', st === 200 && colD.docs.get(rid).status === 'Hoàn thành' && colD.docs.get(rid).doneIds.length === 2, d);
    [st, d] = await call('/' + rid + '/complete', tho, { rev: 5 }); check('Hoàn tất lần 2 -> 409 already_completed', st === 409 && d.error === 'already_completed');
    [st, d] = await call('/' + rid + '/seen', khach, { done: true }); check('Khách xem thông báo Hoàn thành -> collection customerSeenDone', st === 200 && colD.docs.get(rid).customerSeenDone === true);
    [st, d] = await call('/?since=0', tho); check('Danh sách nhân viên (?since) đọc từ kho MongoDB', st === 200 && d.requests.length === 1);

    // =============================================================== E. Kho lỗi -> 503, log không lộ chuỗi kết nối
    const logs = [];
    const origErr = console.error;
    console.error = (...a) => logs.push(a.join(' '));
    try {
      [st, d] = await call('/me', khach, null, '/api/edit-requests-broken');
      const [st2] = await call('/health', null, null, '/api/edit-requests-broken');
      check('Kho MongoDB lỗi -> 503 store_unavailable (không sập server)', st === 503 && d.error === 'store_unavailable' && st2 === 503);
    } finally { console.error = origErr; }
    check('Log lỗi KHÔNG chứa chuỗi kết nối / mật khẩu', logs.length > 0 && logs.every((l) => !l.includes('matkhau-lo') && !l.includes('mongodb+srv://')), logs);
  } catch (e) {
    fail++;
    console.log('✗ Lỗi khi chạy test:', e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e);
  } finally {
    if (server) server.close();
  }
  console.log(`\n${pass}/${pass + fail} PASS`);
  process.exit(fail ? 1 : 0);
})();
