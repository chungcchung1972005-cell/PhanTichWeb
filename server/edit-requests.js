// ALOHA Baby — API yêu cầu chỉnh ảnh dùng chung Khách / Thợ ảnh / Sếp (thêm 2026-10-15).
// Gắn vào server.js tại /api/edit-requests.
//
// LƯU TRỮ (server/edit-requests-store.js, tách 2026-10-15 trên nhánh feat/edit-sync-demo):
//  - Mặc định RAM: server khởi động lại là mất hết - chỉ dùng phát triển/kiểm thử với dữ liệu giả.
//  - MongoDB CHỈ khi có biến RIÊNG EDIT_REQUESTS_MONGODB_URI (database mặc định "aloha_edit_demo",
//    collection "edit_requests"). KHÔNG đọc MONGODB_URI của chat Sale; từ chối database / collection
//    của chat. Không tự chuyển dữ liệu RAM cũ sang MongoDB.
// Frontend nối vào qua js/edit-sync.js NHƯNG chỉ khi bật cờ editSync (js/features.js, mặc định BẬT):
// khách, Thợ ảnh (ghi) và Sếp (chỉ đọc). Cờ tắt thì các trang vẫn đọc/ghi localStorage như trước.
//
// Xác thực dùng chung token của server/sale-chat.js (requireAuth, ký bằng AUTH_SECRET).
// Phân quyền kiểm ở server:
//  - Khách (role khach-hang, SĐT thật): chỉ tạo/đọc/nhắn trong yêu cầu CỦA CHÍNH MÌNH (SĐT lấy
//    từ token, không lấy từ dữ liệu gửi lên). Khách vãng lai (token "khach-vang-lai-...") bị từ chối.
//  - Thợ ảnh (tho-anh): đọc mọi yêu cầu, đánh dấu ảnh xong, lưu link, Hoàn tất, nhắn khách.
//  - Sếp (sep): CHỈ ĐỌC.
//  - Sale và mọi vai trò khác: bị từ chối.
//  - Tài khoản THỬ NGHIỆM (EDIT_DEMO_ACCOUNTS, token scope "edit-demo"): dùng được router này theo đúng
//    vai trò trên; mọi route chat Sale từ chối token có scope (xem requireAuth trong sale-chat.js).
//  - Thợ ảnh/Sếp demo CÔNG KHAI (0900000003 / 0900000004): bị chặn 403 public_demo_staff_blocked, trừ khi
//    đặt EDIT_REQUESTS_ALLOW_PUBLIC_DEMO_STAFF=1 (bản demo nhiều máy; khi studio dùng thật thì bỏ). Khách demo 0900000001 không bị chặn.
// Link ảnh GỐC (resultLinkOriginal) chỉ dùng nội bộ: KHÔNG BAO GIỜ có trong phản hồi gửi khách.
// Tin nhắn from 'ai' KHÔNG nhận từ client: người gửi luôn suy ra từ vai trò trong token.
// Chống ghi đè: mỗi yêu cầu có "rev" (tăng mỗi lần đổi dữ liệu nghiệp vụ: link, Hoàn tất, ảnh đã
// xong; "đã xem" và tin nhắn không tăng, chỉ đổi updatedAt); lưu link / Hoàn tất phải gửi kèm rev
// đang có, lệch thì trả 409 kèm bản mới nhất để trang tải lại. Kho cập nhật CÓ ĐIỀU KIỆN theo rev
// trong 1 lệnh nên 2 phiên ghi cùng lúc (kể cả trên MongoDB) chỉ 1 phiên thắng.
const crypto = require('crypto');
const express = require('express');
const { requireAuth, EDIT_DEMO_SCOPE, isPublicDemoPhone } = require('./sale-chat');
const { createStoreFromEnv, safeError } = require('./edit-requests-store');

// ---------------------------------------------------------------- Cấu hình / giới hạn
const STATUS_FLOW = ['Chờ xử lý', 'Đang thực hiện', 'Hoàn thành']; // khớp js/data-store.js
const MAX_REQUESTS = 2000;          // tổng số yêu cầu tối đa trong kho
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
const isPhotoId = (s) => typeof s === 'string' && /^[\w-]{1,200}$/.test(s);
const isPhone = (p) => /^0\d{9,10}$/.test(String(p || ''));
const nonNegInt = (v, max) => (Number.isInteger(v) && v >= 0 && v <= max ? v : null);

const newId = () => 'ER-' + Date.now().toString(36) + '-' + crypto.randomBytes(4).toString('hex');
const clone = (x) => JSON.parse(JSON.stringify(x));

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
const body = (req) => (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {});

// Tạo router dùng 1 kho cho trước (test truyền kho giả lập vào; server dùng kho chọn theo biến môi trường).
// opts.allowPublicDemoStaff: true = vẫn cho Thợ ảnh/Sếp demo CÔNG KHAI (0900000003/0900000004, mật khẩu in
// trên login.html) dùng API này - chỉ để chạy test/phát triển local. Mặc định false = chặn (403).
function createEditRequestsRouter(store, opts) {
  const workflow = opts && opts.workflowService || require('./workflow').service;
  workflow.attachRequestsStore(store);
  const allowPublicDemoStaff = !!(opts && opts.allowPublicDemoStaff);
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
  // Lỗi kho (vd mất kết nối MongoDB) -> 503, không lộ chi tiết; log đã bỏ chuỗi kết nối
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error('edit-requests error:', safeError(err));
    if (!res.headersSent) res.status(503).json({ error: 'store_unavailable' });
  });

  // Khách phải có SĐT thật trong token (chặn khách vãng lai "khach-vang-lai-...")
  function realCustomerOnly(req, res, next) {
    if (req.user.role === 'khach-hang' && !isPhone(req.user.phone)) return res.status(403).json({ error: 'guest_not_allowed' });
    next();
  }
  // Tài khoản thử nghiệm (token scope "edit-demo", xem EDIT_DEMO_ACCOUNTS trong sale-chat.js) CHỈ được
  // phép ở router này; vẫn theo đúng vai trò như tài khoản thường (Thợ ảnh ghi, Sếp chỉ đọc, khách của mình).
  // Thợ ảnh/Sếp demo CÔNG KHAI (token không có scope, SĐT nằm trong DEMO_ACCOUNTS) bị chặn: ai cũng biết
  // mật khẩu nên không được ghi/đọc dữ liệu demo đồng bộ. Kiểm theo SĐT LÚC NHẬN YÊU CẦU nên token cũ
  // cũng bị chặn. Tài khoản thử nghiệm (scope edit-demo) và khách (kể cả khách demo) không bị ảnh hưởng.
  function noPublicDemoStaff(req, res, next) {
    if (!allowPublicDemoStaff && !req.user.scope && (req.user.role === 'tho-anh' || req.user.role === 'sep') && isPublicDemoPhone(req.user.phone)) {
      return res.status(403).json({ error: 'public_demo_staff_blocked' });
    }
    next();
  }
  const auth = (roles) => [requireAuth(roles, { allowScopes: [EDIT_DEMO_SCOPE] }), realCustomerOnly, noPublicDemoStaff];

  // Tìm yêu cầu theo :id; khách chỉ thấy yêu cầu của mình (của người khác trả 404, không lộ là có tồn tại)
  const loadRequest = wrap(async (req, res, next) => {
    const id = String(req.params.id || '');
    const found = /^ER-[a-z0-9]+-[a-f0-9]{8}$/.test(id) ? await store.get(id) : null;
    if (!found || (req.user.role === 'khach-hang' && found.phone !== req.user.phone)) {
      return res.status(404).json({ error: 'not_found' });
    }
    req.editRequest = found;
    if (req.user.role === 'tho-anh' && found.editorPhone && found.editorPhone !== req.user.phone) return res.status(403).json({error:'forbidden'});
    next();
  });

  // rev bắt buộc cho các thao tác dễ ghi đè nhau (lưu link, Hoàn tất). Kiểm trước theo bản vừa đọc;
  // kho còn kiểm lại có điều kiện khi ghi (chống 2 phiên ghi cùng lúc).
  function checkRev(req, res) {
    const rev = req.body && req.body.rev;
    if (!Number.isInteger(rev)) { res.status(400).json({ error: 'rev_required' }); return false; }
    if (rev !== req.editRequest.rev) {
      res.status(409).json({ error: 'conflict', request: viewFor(req.user, req.editRequest) });
      return false;
    }
    return true;
  }
  // Kết quả cập nhật có điều kiện của kho -> phản hồi (409 kèm bản mới nhất nếu rev đã đổi)
  function sendConditional(req, res, result) {
    if (!result) return res.status(404).json({ error: 'not_found' });
    if (result.conflict) return res.status(409).json({ error: 'conflict', request: viewFor(req.user, result.conflict) });
    return res.json({ request: staffView(result.doc) });
  }

  // ---------------------------------------------------------------- API
  // Không cần đăng nhập: cho test/giám sát biết router này lưu ở đâu.
  router.get('/health', wrap(async (req, res) => res.json({ ok: true, store: store.kind, count: await store.count() })));

  // ---- Khách
  router.get('/me', auth(['khach-hang']), wrap(async (req, res) => {
    const mine = (await store.listByPhone(req.user.phone)).filter(r => r.kind !== 'source-album').map(customerView);
    res.json({ requests: mine, at: Date.now() });
  }));

  // Delivery happens before the customer can create an editing request.
  router.get('/albums/me', auth(['khach-hang']), wrap(async (req, res) => {
    const albums=(await store.listByPhone(req.user.phone)).filter(r=>r.kind==='source-album');
    if(req.query.force==='1') for(let i=0;i<albums.length;i++) {
      const a=albums[i],manifest=await require('./drive').readFolder(a.folderUrl);
      const result=await store.updateIfRev(a.id,a.rev,{photos:manifest.photos});
      if(!result?.doc) return res.status(409).json({error:'conflict'});
      albums[i]=result.doc;
    }
    res.json({albums});
  }));
  router.get('/albums', auth(['tho-anh', 'sep']), wrap(async (req, res) => {
    res.json({albums:(await store.listAll()).filter(r => r.kind === 'source-album' && (req.user.role==='sep' || !r.shooterPhone || [r.shooterPhone,r.editorPhone].includes(req.user.phone)))});
  }));
  router.get('/drive-folder', auth(['tho-anh','sep']), wrap(async (req,res) => {
    try { res.json(await require('./drive').readFolder(req.query.url)); }
    catch(e) { res.status(400).json({error:'drive_folder_error',message:e.message}); }
  }));
  router.post('/albums', auth(['tho-anh']), wrap(async (req, res) => {
    const b = body(req);
    let order;
    try { order=await workflow.sourceOrder(req.user,b.workflowOrderId); } catch(e) { return res.status(400).json({error:'shoot_order_required',message:e.message}); }
    const phone = order.phone, orderCode = order.code;
    let manifest;
    try { manifest=await require('./drive').readFolder(b.folderUrl); }
    catch(e) { return res.status(400).json({error:'drive_folder_error',message:e.message}); }
    const {photos,folderId,folderUrl}=manifest;
    if ((await store.count()) >= MAX_REQUESTS) return res.status(503).json({error:'store_full'});
    const now = Date.now();
    const album = await store.insert({id:'AL-' + crypto.randomBytes(12).toString('hex'), kind:'source-album', phone, orderCode,
      workflowOrderId:order.id,shooterPhone:order.shooterPhone,editorPhone:order.editorPhone,
      customerName:order.customerName, serviceLabel:order.service, folderUrl, folderId, photos,
      staffName:req.user.name || 'Thợ ảnh', createdAt:now, updatedAt:now, rev:1});
    await workflow.originalDelivered(order.id,album.id);
    res.status(201).json({album});
  }));

  const creatingForPhone = new Set();
  function serializeCreate(req, res, next) {
    if (creatingForPhone.has(req.user.phone)) return res.status(409).json({ error: 'request_in_progress' });
    creatingForPhone.add(req.user.phone);
    res.once('finish', () => creatingForPhone.delete(req.user.phone));
    res.once('close', () => creatingForPhone.delete(req.user.phone));
    next();
  }
  router.post('/', auth(['khach-hang']), serializeCreate, wrap(async (req, res) => {
    const b = body(req);
    if (!Array.isArray(b.photos) || !b.photos.length || b.photos.length > MAX_PHOTOS) return res.status(400).json({ error: 'bad_photos' });
    const seen = new Set();
    const photos = [];
    for (const p of b.photos) {
      if (!p || typeof p !== 'object' || !isPhotoId(p.id) || !isPhotoSrc(p.src) || seen.has(p.id)) return res.status(400).json({ error: 'bad_photos' });
      seen.add(p.id);
      photos.push({ id: p.id, src: p.src, note: cleanStr(p.note, MAX_NOTE), editOptions: [...new Set((Array.isArray(p.editOptions)?p.editOptions:[]).filter(x=>['Chỉnh da','Chỉnh màu','Ánh sáng','Xóa chi tiết thừa','Khác'].includes(x)))], isExtra: p.isExtra === true });
    }
    const orderCode = cleanStr(b.orderCode, 30);
    if (orderCode && !/^#?[A-Za-z0-9-]{3,29}$/.test(orderCode)) return res.status(400).json({ error: 'bad_order_code' });
    const sourceAlbum = typeof b.sourceAlbumId === 'string' ? await store.get(b.sourceAlbumId) : null;
    if (!sourceAlbum || sourceAlbum.kind !== 'source-album' || sourceAlbum.phone !== req.user.phone || sourceAlbum.orderCode !== orderCode) return res.status(400).json({error:'source_album_required'});
    const sourcePhotos = new Map(sourceAlbum.photos.map(p => [p.id, p]));
    for (const p of photos) {
      const source = sourcePhotos.get(p.id);
      if (!source) return res.status(400).json({error:'photo_not_in_album'});
      Object.assign(p, source); // authoritative file identity and filename, never a client-supplied image URL
    }
    const history = (await store.listByPhone(req.user.phone)).filter(r => r.kind !== 'source-album' && r.orderCode === orderCode).sort((a, b) => b.createdAt - a.createdAt);
    const previous = history[0];
    const parentRequestId = cleanStr(b.parentRequestId, 80);
    const openIds = new Set(history.filter(r => r.status !== STATUS_FLOW[2]).flatMap(r => r.photos.map(p => p.id)));
    if (photos.some(p => openIds.has(p.id))) return res.status(409).json({error:'photo_already_submitted'});
    const round = previous ? Math.max(...history.map(r => r.round || 1)) + 1 : 1;
    const freeCount = round === 1 ? 10 : 0;
    photos.forEach((p, i) => { p.isExtra = i >= freeCount; });
    const extraFee = Math.max(0, photos.length - freeCount) * 50000;
    if (b.extraFee !== extraFee) return res.status(400).json({ error: 'bad_extra_fee' });
    if(extraFee>0 && !b.paymentCode) return res.status(402).json({error:'payment_required'});
    let verifiedPayment=null;
    if(extraFee>0 && b.paymentCode) {
      const receipts=require('./payment-receipts'),code=receipts.normalize(b.paymentCode);
      const tx=code.startsWith(receipts.normalize(orderCode)+'CS'+Math.max(0,photos.length-freeCount)) && receipts.find(code,extraFee);
      if(!tx) return res.status(402).json({error:'payment_required'});
      const reference='sepay:'+tx.id;
      if((await workflow.read()).orders.some(o=>o.payments.some(p=>p.reference===reference))) return res.status(400).json({error:'payment_already_used'});
      verifiedPayment={reference,amount:extraFee};
    }
    // Chỉ đếm lượt tạo hợp lệ (lượt gửi sai đã bị từ chối ở trên, không ghi gì vào kho)
    if (limited('create:' + req.user.phone, RATE.create)) return res.status(429).json({ error: 'too_many_requests' });
    if ((await store.count()) >= MAX_REQUESTS) return res.status(503).json({ error: 'store_full' });

    const now = Date.now();
    const rec = {
      id: newId(),
      phone: req.user.phone,               // từ token, KHÔNG từ dữ liệu gửi lên
      customerName: req.user.name || 'Khách hàng',
      orderCode,
      parentRequestId,
      sourceAlbumId:sourceAlbum.id,
      workflowOrderId:sourceAlbum.workflowOrderId,
      editorPhone:sourceAlbum.editorPhone,
      sourceFolderUrl:sourceAlbum.folderUrl,
      round,
      serviceLabel: cleanStr(b.serviceLabel, 40),
      note: cleanStr(b.note, MAX_NOTE),
      photos,
      photoNotes: photos.filter((p) => p.note).map((p) => ({ id: p.id, note: p.note })),
      photoCount: photos.length,
      extraCount: photos.filter((p) => p.isExtra).length,
      extraFee,
      paymentStatus: cleanStr(b.paymentStatus, 60),
      verifiedPayment,
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
    const saved = await store.insert(rec);
    if(saved.workflowOrderId) await workflow.progress(saved,'selected');
    res.status(201).json({ request: customerView(saved) });
  }));

  // ---- Nhân viên: danh sách (Thợ ảnh + Sếp). ?since=<ms> chỉ trả yêu cầu đổi sau mốc đó.
  router.get('/', auth(['tho-anh', 'sep']), wrap(async (req, res) => {
    const since = Number(req.query.since);
    const list = (await store.listAll(Number.isFinite(since) ? since : undefined)).filter(r => r.kind !== 'source-album' && (req.user.role==='sep' || !r.editorPhone || r.editorPhone===req.user.phone)).map(staffView);
    res.json({ requests: list, at: Date.now() });
  }));

  // ---- 1 yêu cầu: khách (của mình) / Thợ ảnh / Sếp
  router.post('/:id/feedback', auth(['khach-hang']), loadRequest, wrap(async(req,res)=>{
    const r=req.editRequest, feedback=body(req).feedback;
    if(r.status!==STATUS_FLOW[2] || !['satisfied','revision'].includes(feedback)) return res.status(400).json({error:'bad_feedback'});
    const result=await store.updateIfRev(r.id,r.rev,{customerFeedback:feedback,customerFeedbackAt:Date.now()});
    if(!result?.doc) return res.status(409).json({error:'conflict'});
    if(r.workflowOrderId) await workflow.progress(result.doc,'delivered');
    res.json({request:customerView(result.doc)});
  }));
  router.get('/:id', auth(['khach-hang', 'tho-anh', 'sep']), loadRequest, (req, res) => {
    res.json({ request: viewFor(req.user, req.editRequest) });
  });

  // ---- Tin nhắn: khách -> 'customer', Thợ ảnh -> 'staff'. Trường "from" gửi lên bị BỎ QUA
  // (không giả được tin 'ai'). Sếp chỉ xem.
  // Tin nhắn KHÔNG tăng rev (sửa 2026-10-15): chỉ thêm vào cuối danh sách tin, không đổi link /
  // trạng thái / ảnh đã xong mà lưu link / Hoàn tất kiểm tra bằng rev -> tăng rev chỉ gây 409 giả
  // khi khách nhắn trong lúc Thợ ảnh đang mở yêu cầu. Vẫn đổi updatedAt để ?since= lấy được tin mới.
  router.post('/:id/messages', auth(['khach-hang', 'tho-anh']), loadRequest, wrap(async (req, res) => {
    const text = requiredText(body(req).text, MAX_MESSAGE);
    if (!text) return res.status(400).json({ error: 'bad_text' });
    if (limited('msg:' + req.user.phone, RATE.message)) return res.status(429).json({ error: 'too_many_messages' });
    const from = req.user.role === 'khach-hang' ? 'customer' : 'staff';
    const msg = { id: 'M-' + Date.now().toString(36) + '-' + crypto.randomBytes(3).toString('hex'), from, name: cleanStr(req.user.name, 60), text, at: Date.now() };
    if (from === 'customer') msg.needsStaff = true;
    const r = await store.addMessage(req.editRequest.id, msg, MAX_MESSAGES);
    if (!r) return res.status(404).json({ error: 'not_found' });
    res.json({ request: viewFor(req.user, r) });
  }));

  // ---- Đánh dấu đã xem: khách (thông báo Hoàn thành / dấu đã xem tab Ảnh đã chỉnh), Thợ ảnh (Mới)
  // "Đã xem" KHÔNG tăng rev (sửa 2026-10-15): rev chỉ đại diện dữ liệu nghiệp vụ mà lưu link /
  // Hoàn tất kiểm tra. 3 cờ đã xem (staffSeen, customerSeenDone, customerSeenEditedSig) không bao giờ
  // bị lưu link / Hoàn tất ghi lại, nên không thể đè nhau; tăng rev ở đây chỉ làm Thợ ảnh nhận 409 giả
  // mỗi khi khách mở tab xem. Vẫn cập nhật updatedAt (khi có cờ thật sự đổi) để ?since= lấy được thay đổi.
  router.post('/:id/seen', auth(['khach-hang', 'tho-anh']), loadRequest, wrap(async (req, res) => {
    const r = req.editRequest;
    const patch = {};
    if (req.user.role === 'tho-anh') {
      patch.staffSeen = true;
    } else {
      const b = body(req);
      if (b.done === true && r.status === 'Hoàn thành') patch.customerSeenDone = true;
      if (typeof b.editedSig === 'string') patch.customerSeenEditedSig = cleanStr(b.editedSig, 300);
    }
    const updated = Object.keys(patch).length ? await store.markSeen(r.id, patch) : r;
    if (!updated) return res.status(404).json({ error: 'not_found' });
    res.json({ request: viewFor(req.user, updated) });
  }));

  // ---- Thợ ảnh: đánh dấu / bỏ đánh dấu 1 ảnh đã xong. Thao tác theo từng ảnh nên 2 người đánh dấu
  // 2 ảnh khác nhau cùng lúc không đè nhau (không cần rev).
  router.post('/:id/done-photos', auth(['tho-anh']), loadRequest, wrap(async (req, res) => {
    const b = body(req);
    const r = req.editRequest;
    if (!isPhotoId(b.photoId) || !r.photos.some((p) => p.id === b.photoId) || typeof b.done !== 'boolean') {
      return res.status(400).json({ error: 'bad_photo' });
    }
    if (r.status === 'Hoàn thành') return res.status(409).json({ error: 'already_completed', request: staffView(r) });
    const result = await store.setPhotoDone(r.id, b.photoId, b.done);
    if (!result) return res.status(404).json({ error: 'not_found' });
    if (result.completed) return res.status(409).json({ error: 'already_completed', request: staffView(result.completed) });
    res.json({ request: staffView(result.doc) });
  }));

  // ---- Thợ ảnh: lưu 2 link (ảnh đã chỉnh: khách thấy; ảnh gốc: CHỈ nội bộ). Cần rev.
  // Chuỗi rỗng = gỡ link; không gửi trường nào thì giữ nguyên link đó.
  router.post('/:id/links', auth(['tho-anh']), loadRequest, wrap(async (req, res) => {
    const b = body(req);
    const r = req.editRequest;
    const has = (k) => Object.prototype.hasOwnProperty.call(b, k);
    if (!has('resultLink') && !has('resultLinkOriginal')) return res.status(400).json({ error: 'no_links' });
    for (const k of ['resultLink', 'resultLinkOriginal']) {
      if (has(k) && b[k] !== '' && !isHttpsUrl(b[k])) return res.status(400).json({ error: 'bad_link', field: k });
    }
    if (r.status === 'Hoàn thành' && has('resultLink') && !b.resultLink) return res.status(409).json({ error: 'cannot_remove_after_complete' });
    if (!checkRev(req, res)) return;
    const set = {};
    if (has('resultLink')) {
      set.resultLink = b.resultLink;
      set.resultLinkAt = b.resultLink ? Date.now() : null;
    }
    if (has('resultLinkOriginal')) set.resultLinkOriginal = b.resultLinkOriginal;
    sendConditional(req, res, await store.updateIfRev(r.id, b.rev, set));
  }));

  // ---- Thợ ảnh: Hoàn tất (1 bước ở server): bắt buộc có link ảnh đã chỉnh hợp lệ, đánh dấu xong
  // mọi ảnh, chuyển thẳng sang "Hoàn thành". Cần rev.
  router.post('/:id/complete', auth(['tho-anh']), loadRequest, wrap(async (req, res) => {
    const r = req.editRequest;
    if (r.status === 'Hoàn thành') return res.status(409).json({ error: 'already_completed', request: staffView(r) });
    if (!isHttpsUrl(r.resultLink)) return res.status(422).json({ error: 'edited_link_required' });
    if (!checkRev(req, res)) return;
    // Điều kiện rev (+ chưa Hoàn thành) kiểm lại khi ghi: link bị gỡ / đơn bị Hoàn tất ở phiên khác
    // trong lúc này đều làm rev đổi -> 409, không Hoàn tất nhầm.
    const result=await store.updateIfRev(r.id, req.body.rev, { doneIds: r.photos.map((p) => p.id), status: 'Hoàn thành', completedAt:Date.now() }, { notDone: true });
    if(result && result.doc && result.doc.workflowOrderId) await workflow.progress(result.doc,'delivered');
    sendConditional(req, res, result);
  }));

  return router;
}

// Kho mặc định chọn theo biến môi trường (xem server/edit-requests-store.js)
const { store, configError } = createStoreFromEnv(process.env);
// Bản demo nhiều máy (người dùng chốt 2026-10-29) đặt EDIT_REQUESTS_ALLOW_PUBLIC_DEMO_STAFF=1; khi studio dùng thật thì bỏ.
const ALLOW_PUBLIC_DEMO_STAFF = process.env.EDIT_REQUESTS_ALLOW_PUBLIC_DEMO_STAFF === '1';
if (configError) console.error('edit-requests: cấu hình MongoDB riêng KHÔNG hợp lệ (' + configError + ') -> dùng RAM.');
if (store.kind === 'mongodb') console.log('edit-requests: lưu MongoDB riêng (database "' + store.dbName + '", collection "' + store.collectionName + '").');

if (ALLOW_PUBLIC_DEMO_STAFF) console.warn('edit-requests: EDIT_REQUESTS_ALLOW_PUBLIC_DEMO_STAFF=1 -> Thợ ảnh/Sếp demo công khai VẪN dùng được API này (bản demo nhiều máy; khi studio dùng thật thì bỏ).');
module.exports = { router: createEditRequestsRouter(store, { allowPublicDemoStaff: ALLOW_PUBLIC_DEMO_STAFF }), storeKind: store.kind, createEditRequestsRouter };
