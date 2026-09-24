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
      customerSeenDone: false
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

  window.AlohaData = {
    getCustomerRecord,
    createEditRequest,
    getEditRequests,
    advanceRequestStatus,
    togglePhotoDone,
    markStaffSeen,
    markCustomerSeenDone,
    STATUS_FLOW
  };
})(window);
