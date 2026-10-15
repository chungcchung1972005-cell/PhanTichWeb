// ALOHA Baby — dữ liệu nền cho Không gian Sale (crm/sale.html).
// Từ 2026-10-15 KHÔNG còn khách mẫu: chỉ giữ cấu hình, tài khoản sale, phòng, thợ ảnh.
// Khách + hội thoại lấy từ chat thật trên website (xem crm/js/sale.js "Khách từ web"). Mọi thay đổi trên giao diện (kéo thả lead, xác
// nhận cọc, tạo lịch nhanh...) chỉ sống trong bộ nhớ trang đang mở.
//
// Quy tắc hiển thị (xem crm/js/sale.js):
// - customers / conversations / deposits / orders có field `owner` = id sale
//   phụ trách -> mỗi sale CHỈ thấy bản ghi của chính mình.
// - appointments (lịch chụp) là lịch chung của studio -> mọi sale đều thấy cả
//   tuần, nhưng chỉ sale phụ trách mới xem được thông tin liên hệ của khách.
//
// Dữ liệu viết quanh ngày gốc `now` (Thứ Sáu 25/09/2026). Khi mở trang, crm/js/sale.js
// dời MỌI ngày trong dữ liệu (dạng 2026-09-25 và 25/09) theo đúng số ngày từ ngày gốc
// tới hôm nay thật, nên lịch luôn khớp ngày hiện tại (người dùng yêu cầu 2026-09-27).
// Giờ giữ lịch của các yêu cầu cọc đang chờ tính từ lúc mở trang (field holdLeftMin).
(function (window) {
  // Tham số nghiệp vụ CHƯA được studio xác nhận (rules/tech-defaults.md):
  // để dạng cấu hình + placeholder, không tự đặt số.
  const CONFIG = {
    holdHours: 1,                 // giữ khung giờ tối đa 1 tiếng trước khi cọc, hết giờ tự nhả lịch (người dùng chốt 2026-09-27)
    depositText: '[Số tiền cọc]', // mức cọc chưa chốt
    packagePriceText: '[Giá gói]',
    bankText: '[Số tài khoản] · [Ngân hàng]',
    studioAddress: '35 Lê Văn Thiêm, Thanh Xuân, Hà Nội',
    hotline: '0938.125.222'
  };

  // 3 tài khoản Sale — đăng nhập ở login.html, nhận diện qua số điện thoại.
  // target = mục tiêu tháng (triệu, placeholder); achieved/responseMin chưa có nguồn số liệu thật -> 0 / null.
  const sales = [
    { id: 'ngoc-anh', name: 'Ngọc Anh', phone: '0900000002', target: 200, achieved: 0, responseMin: null },
    { id: 'minh-thu', name: 'Minh Thư', phone: '0900000005', target: 180, achieved: 0, responseMin: null },
    { id: 'thu-ha',   name: 'Thu Hà',   phone: '0900000006', target: 180, achieved: 0, responseMin: null }
  ];

  const photographers = ['Tuấn', 'Hùng', 'Long', 'Minh'];
  const rooms = [
    { id: 'P1', label: 'Phòng 1', warm: true },
    { id: 'P2', label: 'Phòng 2' },
    { id: 'P3', label: 'Phòng 3' },
    { id: 'Ngoài', label: 'Tại nhà khách' }
  ];

  // DỮ LIỆU KHÁCH ĐỂ TRỐNG (người dùng yêu cầu 2026-10-15: "chưa có data khách, nào có từ web
  // đẩy về mới được"). Khách thật đến từ chat trên website: crm/js/sale.js hỏi server
  // (/api/sale-chat/inbox) vài giây một lần và tự tạo hồ sơ + hội thoại cho mỗi khách nhắn.
  // Lịch chụp / đặt cọc / đơn ảnh / chuyển giao chỉ có khi Sale tự tạo trên trang (chưa lưu
  // lên server, tải lại trang là mất) cho tới khi CRM/booking có backend thật.
  //
  // Quy ước field (giữ để thêm lại dữ liệu sau này):
  // customers: { id, owner, name, short, title, phone, area, service, source, stage, since,
  //   status: { text, tone }, baby?, tags: [], note, task?, lost?, history?, referrals? }
  //   stage: moi | tu-van | bao-gia | cho-coc | da-chot | null (khách cũ); tone: red | amber | blue | green | muted
  // appointments: { id, date, start, dur (giờ), service, label, room, photographer, status, owner, customerId }
  //   status: checkin | da-coc | chua-thu-du | giu-cho
  // deposits: { code, owner, customerId, appointmentId, channels, state, sentAt, ..., log: [] }
  //   state: sent | opened | paid | short | confirmed
  // orders: { code, owner, customer, customerId, service, pkg, date, status, progress, due }
  //   status: cho-chon | dang-chinh | qua-han | cho-duyet | da-giao
  // conversations: { id, owner, customerId, channel, time, unread, messages: [{ from: 'kh'|'sale', text, time, by }] }
  // transfers: { id, from, to, customerIds, names, reason, mode, until, revenue, note, status, createdAt }
  const customers = [];
  const appointments = [];
  const deposits = [];
  const unmatched = []; // giao dịch ngân hàng không chứa mã đơn
  const orders = [];
  const conversations = [];
  const transfers = [];

  window.ALOHA_SALE_DATA = {
    now: '2026-09-25T10:30:00',
    config: CONFIG,
    sales, photographers, rooms,
    customers, appointments, deposits, unmatched, orders, conversations, transfers
  };
})(window);
