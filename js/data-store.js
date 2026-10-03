
// ALOHA Baby — kho dữ liệu demo dùng chung giữa Khách hàng và Ban quản trị
// (window.AlohaData), lưu trong localStorage CỦA CÙNG TRÌNH DUYỆT. Đây vẫn là
// mô phỏng phía client (site tĩnh, chưa có backend/CRM thật) — dữ liệu KHÔNG
// đồng bộ giữa các thiết bị/trình duyệt khác nhau, chỉ dùng để demo luồng
// "khách gửi yêu cầu chỉnh sửa -> Thợ ảnh nhìn thấy" trên cùng một máy.
(function (window) {
  const DB_KEY = 'aloha_demo_db';

  // Khách hàng demo có sẵn (tài khoản 0900000001 trong login.html) coi như đã
  // từng chụp ít nhất 1 buổi -> có ảnh để xem ngay khi đăng nhập, đúng với
  // việc login.html hiển thị tài khoản này như một khách quay lại.
  // Khách MỚI đăng ký sẽ KHÔNG có trong danh sách này -> chưa có ảnh nào.
  const SEED_CUSTOMERS = {
    '0900000001': {
      hasShoot: true,
      orderCode: '#AB240915',
      serviceLabel: 'Newborn',
      packageLabel: 'Premium',
      packageCount: 10,
      photoCount: 16
    }
  };

  function readDb() {
    try {
      const raw = window.localStorage.getItem(DB_KEY);
      const db = raw ? JSON.parse(raw) : {};
      if (!db.customers) db.customers = {};
      if (!db.editRequests) db.editRequests = [];
      // Chat Khách <-> Sale từng lưu ở đây (db.chats, bản localStorage 2026-09-27) - nay đã
      // chuyển lên server (server/sale-chat.js) -> bỏ dữ liệu cũ đi, không còn dùng.
      if (db.chats) { delete db.chats; writeDb(db); }
      return db;
    } catch (e) {
      return { customers: {}, editRequests: [] };
    }
  }

  function writeDb(db) {
    window.localStorage.setItem(DB_KEY, JSON.stringify(db));
  }

  function getCustomerRecord(phone) {
    if (!phone) return null;
    const db = readDb();
    if (db.customers[phone]) {
      // Đảm bảo số ảnh trong gói cập nhật chuẩn 10 ảnh theo quy định mới
      if (db.customers[phone].packageCount === 15) {
        db.customers[phone].packageCount = 10;
        writeDb(db);
      }
      return db.customers[phone];
    }
    if (SEED_CUSTOMERS[phone]) {
      db.customers[phone] = Object.assign({}, SEED_CUSTOMERS[phone]);
      writeDb(db);
      return db.customers[phone];
    }
    return null;
  }

  function createEditRequest(data) {
    const db = readDb();
    const req = {
      id: 'REQ-' + Date.now(),
      phone: data.phone || '',
      customerName: data.customerName || 'Khách hàng',
      orderCode: data.orderCode || '',
      serviceLabel: data.serviceLabel || '',
      photoCount: data.photoCount || 0,
      extraCount: data.extraCount || 0,
      extraFee: data.extraFee || 0,
      paymentStatus: data.paymentStatus || (data.extraCount > 0 ? 'Chờ kiểm tra chuyển khoản' : 'Trong gói (0đ)'),
      note: data.note || '',
      photoNotes: Array.isArray(data.photoNotes) ? data.photoNotes : [],
      // Danh sách ĐẦY ĐỦ ảnh trong yêu cầu (không chỉ ảnh có ghi chú riêng như
      // photoNotes ở trên) -> Thợ ảnh/Sếp xem được "yêu cầu này gồm ảnh nào".
      photos: Array.isArray(data.photos) ? data.photos : [],
      // Các photo.id mà Thợ ảnh đã đánh dấu xử lý xong -> theo dõi tiến độ
      // trong lúc đang ở trạng thái "Đang thực hiện", để Sếp quan sát được.
      doneIds: [],
      status: 'Chờ xử lý',
      createdAt: Date.now(),
      // 2 cờ thông báo 1 chiều, độc lập nhau - Thợ ảnh chưa mở xem yêu cầu mới
      // (staffSeen) và khách chưa mở xem thông báo khi ảnh đã Hoàn thành
      // (customerSeenDone). Cả 2 mặc định false khi tạo yêu cầu mới.
      staffSeen: false,
      customerSeenDone: false,
      // Link thư mục ảnh đã chỉnh Thợ ảnh gửi khách + tin nhắn 2 bên (tab "Ảnh đã chỉnh").
      // Bản ghi cũ không có 2 trường này: nơi đọc tự coi như '' và [].
      resultLink: '',
      resultLinkOriginal: '',
      resultLinkAt: null,
      messages: [],
      customerSeenEditedSig: ''
    };
    db.editRequests.push(req);
    writeDb(db);
    return req;
  }

  function getEditRequests() {
    return readDb().editRequests;
  }

  // Bỏ bước "Chờ QC" riêng (2026-09-19, theo xác nhận của người dùng): quy
  // trình thật của Thợ ảnh chỉ có 3 bước - xác nhận yêu cầu (Chờ xử lý) ->
  // đang sửa ảnh (Đang thực hiện) -> tải ảnh đã sửa lên là xong (Hoàn thành),
  // không qua một vai trò QC riêng biệt để duyệt trước khi hoàn thành.
  const STATUS_FLOW = ['Chờ xử lý', 'Đang thực hiện', 'Hoàn thành'];

  function advanceRequestStatus(id) {
    const db = readDb();
    const req = db.editRequests.find(r => r.id === id);
    if (!req) return null;
    // "Tải ảnh đã sửa lên là Hoàn thành": chưa gửi link ảnh đã chỉnh thì chưa được Hoàn thành
    // (người dùng chốt 2026-09-27, xem rules/workflow.md)
    if (req.status === 'Đang thực hiện' && !req.resultLink) return req;
    const idx = STATUS_FLOW.indexOf(req.status);
    if (idx >= 0 && idx < STATUS_FLOW.length - 1) {
      req.status = STATUS_FLOW[idx + 1];
      writeDb(db);
    }
    return req;
  }

  // Thợ ảnh bật/tắt trạng thái "đã xử lý xong" cho từng ảnh trong 1 yêu cầu -
  // đây là cách để họ tự confirm tiến độ, Sếp xem cùng dữ liệu này ở chế độ
  // chỉ đọc (xem crm/js/admin.js).
  function togglePhotoDone(requestId, photoId) {
    const db = readDb();
    const req = db.editRequests.find(r => r.id === requestId);
    if (!req) return null;
    if (!Array.isArray(req.doneIds)) req.doneIds = [];
    const i = req.doneIds.indexOf(photoId);
    if (i === -1) req.doneIds.push(photoId); else req.doneIds.splice(i, 1);
    writeDb(db);
    return req;
  }

  // Thợ ảnh đã mở xem yêu cầu này rồi -> tắt badge "Mới/chưa xem" phía Thợ ảnh.
  function markStaffSeen(requestId) {
    const db = readDb();
    const req = db.editRequests.find(r => r.id === requestId);
    if (!req) return null;
    req.staffSeen = true;
    writeDb(db);
    return req;
  }

  // Khách đã mở xem thông báo lúc yêu cầu đang ở trạng thái Hoàn thành -> tắt
  // chấm đỏ báo "ảnh đã sửa xong" phía khách cho riêng yêu cầu đó.
  function markCustomerSeenDone(requestId) {
    const db = readDb();
    const req = db.editRequests.find(r => r.id === requestId);
    if (!req) return null;
    req.customerSeenDone = true;
    writeDb(db);
    return req;
  }

  // Link thư mục ảnh đã chỉnh Thợ ảnh gửi cho khách (tab "Ảnh đã chỉnh" trong
  // "Ảnh của tôi"). Chỉ nhận http(s) để không chèn được link javascript:... vào
  // trang khách, và chỉ https (Google Drive luôn là https). Chuỗi rỗng = gỡ link.
  // Trả null nếu link không hợp lệ.
  function setResultLink(requestId, url, urlOriginal) {
    const clean = String(url || '').trim();
    const cleanOrig = String(urlOriginal || '').trim();
    if (clean && !/^https:\/\/[^\s<>"']+$/i.test(clean)) return null;
    if (cleanOrig && !/^https:\/\/[^\s<>"']+$/i.test(cleanOrig)) return null;
    const db = readDb();
    const req = db.editRequests.find(r => r.id === requestId);
    if (!req) return null;
    req.resultLink = clean;
    req.resultLinkOriginal = cleanOrig;
    req.resultLinkAt = (clean || cleanOrig) ? Date.now() : null;
    writeDb(db);
    return req;
  }

  // Tin nhắn trong khung chat của yêu cầu chỉnh sửa (1 nguồn dữ liệu, không tạo kho chat
  // riêng). from: 'customer' | 'staff' | 'ai' (Trợ lý AI trả lời trước). Tin của khách có
  // needsStaff: mặc định true (thợ cần xem), Trợ lý AI trả lời đủ thì đặt lại false.
  function addRequestMessage(requestId, from, name, text) {
    const body = String(text || '').trim().slice(0, 1500);
    if (!body || ['customer', 'staff', 'ai'].indexOf(from) === -1) return null;
    const db = readDb();
    const req = db.editRequests.find(r => r.id === requestId);
    if (!req) return null;
    if (!Array.isArray(req.messages)) req.messages = [];
    const msg = { id: 'M' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), from, name: String(name || '').slice(0, 60), text: body, at: Date.now() };
    if (from === 'customer') msg.needsStaff = true;
    req.messages.push(msg);
    writeDb(db);
    return req;
  }

  function setMessageNeedsStaff(requestId, messageId, needsStaff) {
    const db = readDb();
    const req = db.editRequests.find(r => r.id === requestId);
    const msg = req && Array.isArray(req.messages) && req.messages.find(m => m.id === messageId);
    if (!msg) return null;
    msg.needsStaff = !!needsStaff;
    writeDb(db);
    return req;
  }

  // Khách đã mở tab "Ảnh đã chỉnh" xem link / tin nhắn mới nhất của Thợ ảnh: lưu "chữ ký"
  // (link + số tin của thợ) đã xem để tắt chấm báo trên tab. Cùng kiểu với customerSeenDone.
  function markCustomerSeenEdited(requestId, sig) {
    const db = readDb();
    const req = db.editRequests.find(r => r.id === requestId);
    if (!req) return null;
    req.customerSeenEditedSig = String(sig || '');
    writeDb(db);
    return req;
  }

  // Đọc 1 lần ngay khi nạp để việc bỏ db.chats cũ (xem readDb) chạy cả khi trang
  // không đọc gì thêm (khách chưa đăng nhập...).
  readDb();

  window.AlohaData = {
    getCustomerRecord,
    createEditRequest,
    getEditRequests,
    advanceRequestStatus,
    togglePhotoDone,
    markStaffSeen,
    markCustomerSeenDone,
    setResultLink,
    addRequestMessage,
    setMessageNeedsStaff,
    markCustomerSeenEdited,
    STATUS_FLOW
  };
})(window);
