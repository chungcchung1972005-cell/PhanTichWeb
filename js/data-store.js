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
      packageCount: 15,
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
    if (db.customers[phone]) return db.customers[phone];
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
      note: data.note || '',
      photoNotes: Array.isArray(data.photoNotes) ? data.photoNotes : [],
      status: 'Chờ xử lý',
      createdAt: Date.now()
    };
    db.editRequests.push(req);
    writeDb(db);
    return req;
  }

  function getEditRequests() {
    return readDb().editRequests;
  }

  const STATUS_FLOW = ['Chờ xử lý', 'Đang thực hiện', 'Chờ QC', 'Hoàn thành'];

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

  window.AlohaData = {
    getCustomerRecord,
    createEditRequest,
    getEditRequests,
    advanceRequestStatus,
    STATUS_FLOW
  };
})(window);
