// ALOHA Baby — kho dữ liệu cho API yêu cầu chỉnh ảnh (server/edit-requests.js). Thêm 2026-10-15.
//
// 2 kiểu lưu, cùng 1 bộ hàm async (router không cần biết đang dùng kiểu nào):
//  - RAM (mặc định): như trước, server khởi động lại là mất hết - chỉ dùng phát triển/kiểm thử.
//  - MongoDB: CHỈ bật khi có biến RIÊNG EDIT_REQUESTS_MONGODB_URI (KHÔNG đọc MONGODB_URI của chat
//    Sale). Database mặc định "aloha_edit_demo", collection mặc định "edit_requests"; đổi được bằng
//    EDIT_REQUESTS_DB / EDIT_REQUESTS_COLLECTION. Chốt chặn: từ chối database của chat Sale
//    (MONGODB_DB, mặc định "aloha_baby") và tên collection của chat ("chats", "users") -> dùng RAM
//    + báo lỗi cấu hình, không bao giờ ghi vào dữ liệu chat.
// Không tự chuyển dữ liệu RAM sang MongoDB. Không ghi URI / mật khẩu ra log.
//
// Mọi hàm trả bản SAO (không có _id của MongoDB), sửa bản sao không đổi dữ liệu trong kho.
// Các thao tác dễ đè nhau (lưu link, Hoàn tất) cập nhật CÓ ĐIỀU KIỆN theo rev ngay trong 1 lệnh
// (MongoDB: findOneAndUpdate với { _id, rev }) nên 2 phiên cùng ghi chỉ 1 phiên thắng.
const DONE = 'Hoàn thành';
const CHAT_COLLECTIONS = ['chats', 'users'];
const clone = (x) => (x ? JSON.parse(JSON.stringify(x)) : null);
const strip = (doc) => { if (!doc) return null; const { _id, ...rest } = doc; return clone(rest); };
const byCreated = (a, b) => a.createdAt - b.createdAt;

// Bỏ mọi chuỗi kết nối mongodb:// / mongodb+srv:// khỏi thông báo lỗi trước khi ghi log
function safeError(e) {
  const msg = String((e && e.message) || e || 'lỗi không rõ');
  return msg.replace(/mongodb(\+srv)?:\/\/\S+/gi, '<uri ẩn>').slice(0, 300);
}

// ---------------------------------------------------------------- RAM
function memoryStore() {
  const map = new Map(); // id -> bản ghi
  const get = (id) => map.get(id) || null;
  return {
    kind: 'memory',
    async count() { return map.size; },
    async insert(rec) { map.set(rec.id, clone(rec)); return clone(rec); },
    async get(id) { return clone(get(id)); },
    async listByPhone(phone) { return [...map.values()].filter((r) => r.phone === phone).sort(byCreated).map(clone); },
    // Xoá mọi yêu cầu chỉnh của 1 SĐT, giữ bộ ảnh gốc (dùng để làm mới tài khoản khách demo)
    async removeRequestsByPhone(phone) { let n = 0; for (const [id, r] of map) if (r.phone === phone && r.kind !== 'source-album') { map.delete(id); n++; } return n; },
    async listAll(since) {
      return [...map.values()].filter((r) => !Number.isFinite(since) || r.updatedAt > since).sort(byCreated).map(clone);
    },
    // Thêm 1 tin, giữ tối đa max tin gần nhất; KHÔNG tăng rev, chỉ đổi updatedAt
    async addMessage(id, msg, max) {
      const r = get(id); if (!r) return null;
      r.messages.push(clone(msg));
      if (r.messages.length > max) r.messages.splice(0, r.messages.length - max);
      r.updatedAt = Date.now();
      return clone(r);
    },
    // Đặt các cờ "đã xem"; chỉ đổi updatedAt khi có cờ thật sự đổi; KHÔNG tăng rev
    async markSeen(id, patch) {
      const r = get(id); if (!r) return null;
      const changed = Object.keys(patch).some((k) => r[k] !== patch[k]);
      if (changed) { Object.assign(r, patch); r.updatedAt = Date.now(); }
      return clone(r);
    },
    // Đánh dấu / bỏ đánh dấu 1 ảnh xong khi đơn CHƯA Hoàn thành; tăng rev. { doc } | { completed: doc } | null
    async setPhotoDone(id, photoId, done) {
      const r = get(id); if (!r) return null;
      if (r.status === DONE) return { completed: clone(r) };
      const has = r.doneIds.includes(photoId);
      if (done && !has) r.doneIds.push(photoId);
      if (!done && has) r.doneIds = r.doneIds.filter((x) => x !== photoId);
      r.rev += 1; r.updatedAt = Date.now();
      return { doc: clone(r) };
    },
    // Cập nhật có điều kiện: chỉ khi rev === expectedRev (và notDone: đơn chưa Hoàn thành). Tăng rev.
    // { doc } | { conflict: doc } | null (không có yêu cầu)
    async updateIfRev(id, expectedRev, set, opts) {
      const r = get(id); if (!r) return null;
      if (r.rev !== expectedRev || ((opts && opts.notDone) && r.status === DONE)) return { conflict: clone(r) };
      Object.assign(r, clone(set));
      r.rev += 1; r.updatedAt = Date.now();
      return { doc: clone(r) };
    }
  };
}

// ---------------------------------------------------------------- MongoDB
// getCollection: async () => collection kiểu driver mongodb (test truyền collection giả lập vào đây).
function mongoStoreFromCollection(getCollection) {
  const col = getCollection;
  const after = { returnDocument: 'after' };
  // Driver mongodb 6 (server/package.json) trả thẳng document (hoặc null) từ findOneAndUpdate
  return {
    kind: 'mongodb',
    async count() { return (await col()).countDocuments({}); },
    async insert(rec) { await (await col()).insertOne({ _id: rec.id, ...clone(rec) }); return clone(rec); },
    async get(id) { return strip(await (await col()).findOne({ _id: id })); },
    async listByPhone(phone) { return (await (await col()).find({ phone }).sort({ createdAt: 1 }).toArray()).map(strip); },
    async removeRequestsByPhone(phone) { return (await (await col()).deleteMany({ phone, kind: { $ne: 'source-album' } })).deletedCount; },
    async listAll(since) {
      const filter = Number.isFinite(since) ? { updatedAt: { $gt: since } } : {};
      return (await (await col()).find(filter).sort({ createdAt: 1 }).toArray()).map(strip);
    },
    async addMessage(id, msg, max) {
      const res = await (await col()).findOneAndUpdate(
        { _id: id },
        { $push: { messages: { $each: [clone(msg)], $slice: -max } }, $set: { updatedAt: Date.now() } },
        after
      );
      return strip(res);
    },
    async markSeen(id, patch) {
      const c = await col();
      const cur = await c.findOne({ _id: id });
      if (!cur) return null;
      const changed = Object.keys(patch).some((k) => cur[k] !== patch[k]);
      if (!changed) return strip(cur);
      return strip((await c.findOneAndUpdate({ _id: id }, { $set: { ...patch, updatedAt: Date.now() } }, after)));
    },
    async setPhotoDone(id, photoId, done) {
      const c = await col();
      const op = done ? { $addToSet: { doneIds: photoId } } : { $pull: { doneIds: photoId } };
      const res = (await c.findOneAndUpdate(
        { _id: id, status: { $ne: DONE } },
        { ...op, $inc: { rev: 1 }, $set: { updatedAt: Date.now() } },
        after
      ));
      if (res) return { doc: strip(res) };
      const cur = await c.findOne({ _id: id });
      return cur ? { completed: strip(cur) } : null;
    },
    async updateIfRev(id, expectedRev, set, opts) {
      const c = await col();
      const filter = { _id: id, rev: expectedRev };
      if (opts && opts.notDone) filter.status = { $ne: DONE };
      const res = (await c.findOneAndUpdate(filter, { $set: { ...clone(set), updatedAt: Date.now() }, $inc: { rev: 1 } }, after));
      if (res) return { doc: strip(res) };
      const cur = await c.findOne({ _id: id });
      return cur ? { conflict: strip(cur) } : null;
    }
  };
}

// Kết nối thật bằng driver mongodb (đã có trong server/package.json). Chỉ nạp driver khi cần.
// Kết nối lần đầu khi có request; lỗi thì lần sau thử lại. Tạo index phone, updatedAt.
function mongoStore(uri, dbName, collectionName) {
  const { MongoClient } = require('mongodb');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  let ready = null;
  const getCollection = () => {
    if (!ready) {
      ready = client.connect().then(async () => {
        const c = client.db(dbName).collection(collectionName);
        await Promise.all([c.createIndex({ phone: 1 }), c.createIndex({ updatedAt: 1 })])
          .catch((e) => console.error('edit-requests: không tạo được index:', safeError(e)));
        return c;
      }).catch((e) => { ready = null; console.error('edit-requests: lỗi kết nối MongoDB:', safeError(e)); throw new Error('store_unavailable'); });
    }
    return ready;
  };
  return Object.assign(mongoStoreFromCollection(getCollection), { dbName, collectionName });
}

// Chọn kho theo biến môi trường. KHÔNG đọc MONGODB_URI (chat). Trả { store, configError? }.
function createStoreFromEnv(env) {
  const e = env || {};
  const uri = String(e.EDIT_REQUESTS_MONGODB_URI || '').trim();
  if (!uri) return { store: memoryStore() };
  const dbName = String(e.EDIT_REQUESTS_DB || 'aloha_edit_demo').trim();
  const collectionName = String(e.EDIT_REQUESTS_COLLECTION || 'edit_requests').trim();
  const chatDb = String(e.MONGODB_DB || 'aloha_baby').trim();
  let configError = '';
  if (!/^[A-Za-z0-9_-]{1,60}$/.test(dbName) || !/^[A-Za-z0-9_-]{1,60}$/.test(collectionName)) configError = 'tên database/collection không hợp lệ';
  else if (dbName === chatDb) configError = 'EDIT_REQUESTS_DB trùng database chat Sale (' + chatDb + ')';
  else if (CHAT_COLLECTIONS.includes(collectionName)) configError = 'EDIT_REQUESTS_COLLECTION trùng collection chat Sale';
  if (configError) return { store: memoryStore(), configError };
  return { store: mongoStore(uri, dbName, collectionName) };
}

module.exports = { memoryStore, mongoStoreFromCollection, createStoreFromEnv, safeError, CHAT_COLLECTIONS };
