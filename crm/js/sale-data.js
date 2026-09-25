// ALOHA Baby — dữ liệu minh hoạ cho Không gian Sale (crm/sale.html).
// Đây là dữ liệu demo tĩnh, KHÔNG phải số liệu thật của studio, và chưa nối vào
// backend CRM nào (site tĩnh). Mọi thay đổi trên giao diện (kéo thả lead, xác
// nhận cọc, tạo lịch nhanh...) chỉ sống trong bộ nhớ trang đang mở.
//
// Quy tắc hiển thị (xem crm/js/sale.js):
// - customers / conversations / deposits / orders có field `owner` = id sale
//   phụ trách -> mỗi sale CHỈ thấy bản ghi của chính mình.
// - appointments (lịch chụp) là lịch chung của studio -> mọi sale đều thấy cả
//   tuần, nhưng chỉ sale phụ trách mới xem được thông tin liên hệ của khách.
//
// "Hôm nay" của bản demo cố định là Thứ Sáu 25/09/2026 10:30 để dữ liệu nhất quán.
(function (window) {
  // Tham số nghiệp vụ CHƯA được studio xác nhận (rules/tech-defaults.md):
  // để dạng cấu hình + placeholder, không tự đặt số.
  const CONFIG = {
    holdHours: 2,                 // thời gian giữ khung giờ trước khi cọc (placeholder)
    depositText: '[Số tiền cọc]', // mức cọc chưa chốt
    packagePriceText: '[Giá gói]',
    bankText: '[Số tài khoản] · [Ngân hàng]',
    studioAddress: '35 Lê Văn Thiêm, Thanh Xuân, Hà Nội',
    hotline: '0938.125.222'
  };

  // 5 tài khoản Sale — đăng nhập ở login.html, nhận diện qua số điện thoại.
  const sales = [
    { id: 'ngoc-anh', name: 'Ngọc Anh', phone: '0900000002', target: 200, achieved: 142, responseMin: 6 },
    { id: 'minh-thu', name: 'Minh Thư', phone: '0900000005', target: 180, achieved: 96, responseMin: 9 },
    { id: 'thu-ha',   name: 'Thu Hà',   phone: '0900000006', target: 180, achieved: 121, responseMin: 7 },
    { id: 'quoc-bao', name: 'Quốc Bảo', phone: '0900000007', target: 150, achieved: 88, responseMin: 11 },
    { id: 'hai-yen',  name: 'Hải Yến',  phone: '0900000008', target: 160, achieved: 134, responseMin: 5,
      leave: { from: '2026-09-26', until: '2026-09-27' } } // nghỉ phép -> không nhận khách chuyển giao trong thời gian này
  ];

  const photographers = ['Tuấn', 'Hùng', 'Long', 'Minh'];
  const rooms = [
    { id: 'P1', label: 'Phòng 1', warm: true },
    { id: 'P2', label: 'Phòng 2' },
    { id: 'P3', label: 'Phòng 3' },
    { id: 'Ngoài', label: 'Tại nhà khách' }
  ];

  // stage: moi | tu-van | bao-gia | cho-coc | da-chot | null (khách cũ, không nằm trong phễu mở)
  // status.tone: red | amber | blue | green | muted
  // task (tuỳ chọn): việc gọi lại / chăm sóc gắn với khách, hiện ở "Việc cần làm ngay"
  const customers = [
    // ---------- Ngọc Anh ----------
    { id: 'na-trang', owner: 'ngoc-anh', name: 'Chị Thu Trang', short: 'Trang', title: 'chị', phone: '0912456456', area: 'Thanh Xuân, Hà Nội',
      service: 'Newborn', source: 'Trợ lý web', stage: 'tu-van', since: '2 phút trước', status: { text: 'Chờ gửi khung giờ', tone: 'amber' },
      baby: { kind: 'due', date: '2026-10-15' }, tags: ['Khách mới'], note: 'Mẹ thích tông kem, trắng. Hỏi thêm về ưu đãi đặt sớm.',
      task: { type: 'goi-lai', badge: 'Quá hạn 25 phút', tone: 'red', desc: 'Lead từ Trợ lý web · hỏi giá gói Newborn, dự sinh 15/10', prio: 1 } },
    { id: 'na-duc', owner: 'ngoc-anh', name: 'Anh Minh Đức', short: 'Đức', title: 'anh', phone: '0983222731', area: 'Cầu Giấy, Hà Nội',
      service: 'Sinh nhật', source: 'Form đặt lịch', stage: 'cho-coc', since: 'Giữ 28/09 09:00', status: { text: 'Hết hạn giữ 14:30', tone: 'red' },
      baby: { kind: 'birth', date: '2025-09-28' }, tags: ['Sinh nhật 1 tuổi'], note: '' },
    { id: 'na-linh', owner: 'ngoc-anh', name: 'Chị Hà Linh', short: 'Linh', title: 'chị', phone: '0987654321', area: 'Đống Đa, Hà Nội',
      service: 'Newborn', source: 'Chat trực tiếp', stage: 'da-chot', since: 'Cọc 1.000.000đ', status: { text: 'Chờ xác nhận cọc', tone: 'blue' },
      baby: { kind: 'birth', date: '2026-09-18' }, tags: [], note: 'Bé sinh 18/09, muốn chụp trước 14 ngày tuổi.' },
    { id: 'na-nhung', owner: 'ngoc-anh', name: 'Chị Hồng Nhung', short: 'Nhung', title: 'chị', phone: '0978111222', area: 'Long Biên, Hà Nội',
      service: 'Tại nhà', source: 'Trợ lý web', stage: 'moi', since: '2 giờ trước', status: { text: 'Chưa liên hệ', tone: 'red' }, tags: ['Khách mới'], note: '' },
    { id: 'na-quang', owner: 'ngoc-anh', name: 'Anh Quang', short: 'Quang', title: 'anh', phone: '0904333444', area: 'Hà Đông, Hà Nội',
      service: 'Gia đình', source: 'Trợ lý web', stage: 'moi', since: '3 giờ trước', status: { text: 'Chưa liên hệ', tone: 'red' }, tags: ['Khách mới'], note: '' },
    { id: 'na-van', owner: 'ngoc-anh', name: 'Chị Vân', short: 'Vân', title: 'chị', phone: '0915777888', area: 'Hoàng Mai, Hà Nội',
      service: 'Bầu', source: 'Hotline', stage: 'moi', since: 'Hôm nay', status: { text: 'Gọi lúc 15:00', tone: 'muted' }, tags: [], note: '' },
    { id: 'na-thao', owner: 'ngoc-anh', name: 'Chị Thảo', short: 'Thảo', title: 'chị', phone: '0936123987', area: 'Ba Đình, Hà Nội',
      service: 'Bé lớn', source: 'Chat trực tiếp', stage: 'tu-van', since: 'Hôm qua', status: { text: 'Hẹn gọi lại 10:00', tone: 'red' }, tags: [], note: '',
      task: { type: 'goi-lai', badge: 'Quá hạn 30 phút', tone: 'red', desc: 'Hẹn gọi lại 10:00 · tư vấn concept Bé lớn', prio: 2 } },
    { id: 'na-bich', owner: 'ngoc-anh', name: 'Chị Bích', short: 'Bích', title: 'chị', phone: '0967456123', area: 'Tây Hồ, Hà Nội',
      service: 'Sinh nhật', source: 'Form đặt lịch', stage: 'tu-van', since: '2 ngày', status: { text: 'Đã gửi concept', tone: 'muted' }, tags: [], note: '' },
    { id: 'na-tuananh', owner: 'ngoc-anh', name: 'Anh Tuấn Anh', short: 'Tuấn Anh', title: 'anh', phone: '0989000111', area: 'Nam Từ Liêm, Hà Nội',
      service: 'Gia đình', source: 'Khách giới thiệu', stage: 'bao-gia', since: 'Hôm qua', status: { text: 'Khách so sánh giá', tone: 'amber' }, tags: [], note: '' },
    { id: 'na-yen', owner: 'ngoc-anh', name: 'Chị Yến', short: 'Yến', title: 'chị', phone: '0912888999', area: 'Thanh Xuân, Hà Nội',
      service: 'Newborn', source: 'Chat trực tiếp', stage: 'bao-gia', since: '3 ngày', status: { text: 'Nhắc lại hôm nay', tone: 'red' }, tags: [], note: '',
      task: { type: 'goi-lai', badge: 'Nhắc lại hôm nay', tone: 'amber', desc: 'Đã báo giá Newborn 3 ngày trước · chưa phản hồi', prio: 6 } },
    { id: 'na-maianh', owner: 'ngoc-anh', name: 'Chị Mai Anh', short: 'Mai Anh', title: 'chị', phone: '0943567890', area: 'Cầu Giấy, Hà Nội',
      service: 'Bầu', source: 'Trợ lý web', stage: 'cho-coc', since: 'Giữ 02/10 10:00', status: { text: 'Còn 1 ngày', tone: 'amber' }, tags: [], note: '' },
    { id: 'na-ngan', owner: 'ngoc-anh', name: 'Chị Ngân', short: 'Ngân', title: 'chị', phone: '0971234555', area: 'Thanh Xuân, Hà Nội',
      service: 'Bầu', source: 'Form đặt lịch', stage: 'da-chot', since: 'Chụp 25/09', status: { text: 'Đã cọc', tone: 'green' }, tags: [], note: 'Mai chị mang thêm váy riêng.' },
    { id: 'na-phuong', owner: 'ngoc-anh', name: 'Chị Phương', short: 'Phương', title: 'chị', phone: '0918765432', area: 'Hai Bà Trưng, Hà Nội',
      service: 'Newborn', source: 'Chat trực tiếp', stage: null, since: 'Đơn #AB240902', status: { text: 'Đã chụp', tone: 'green' }, tags: ['Khách cũ'], note: '' },
    { id: 'na-lan', owner: 'ngoc-anh', name: 'Chị Lan', short: 'Lan', title: 'chị', phone: '0906543210', area: 'Cầu Giấy, Hà Nội',
      service: 'Newborn', source: 'Khách giới thiệu', stage: null, since: '3 tuần trước', status: { text: 'Khách cũ', tone: 'muted' },
      baby: { kind: 'birth', date: '2025-10-10', name: 'Bé Su' }, tags: ['Khách cũ'], referrals: 1,
      note: 'Thích concept nhẹ nhàng, tông kem. Bé Su sợ đèn nháy, nên chụp ánh sáng tự nhiên.',
      // history (tuỳ chọn): lịch sử với studio; shoot = true là một buổi chụp đã xong (tính "Đơn đã chụp")
      history: [
        { date: '04/2026', text: 'Chụp Bé lớn · đã giao ảnh', shoot: true },
        { date: '10/2025', text: 'Chụp Newborn · đã giao ảnh, khách để lại đánh giá', shoot: true },
        { date: '09/2025', text: 'Hỏi qua Trợ lý web, chốt cọc sau 2 ngày', shoot: false }
      ],
      task: { type: 'cham-soc', badge: 'Cơ hội bán thêm', tone: 'accent', title: 'Bé Su nhà chị Lan · tròn 1 tuổi 10/10', desc: 'Đã chụp Newborn năm ngoái · chưa có lịch sinh nhật', action: 'uu-dai', prio: 9 } },
    // lost: đã tư vấn nhưng không mua (nhánh rẽ của phễu), kèm lý do
    { id: 'na-tung', owner: 'ngoc-anh', name: 'Anh Tùng', short: 'Tùng', title: 'anh', phone: '0909555473', area: 'Hoàng Mai, Hà Nội',
      service: 'Gia đình', source: 'Hotline', stage: null, since: '2 tuần trước', status: { text: 'Không mua', tone: 'muted' },
      lost: { reason: 'Chê giá' }, tags: [], note: 'Thấy gói gia đình cao hơn dự tính, hẹn báo lại khi có khuyến mại.' },

    // ---------- Minh Thư ----------
    { id: 'mt-dieulinh', owner: 'minh-thu', name: 'Chị Diệu Linh', short: 'Diệu Linh', title: 'chị', phone: '0913555666', area: 'Đống Đa, Hà Nội',
      service: 'Newborn', source: 'Trợ lý web', stage: 'moi', since: '40 phút trước', status: { text: 'Chưa liên hệ', tone: 'red' },
      baby: { kind: 'due', date: '2026-10-20' }, tags: ['Khách mới'], note: '',
      task: { type: 'goi-lai', badge: 'Quá hạn 10 phút', tone: 'red', desc: 'Lead từ Trợ lý web · hỏi gói Newborn, dự sinh 20/10', prio: 1 } },
    { id: 'mt-nam', owner: 'minh-thu', name: 'Anh Hoàng Nam', short: 'Nam', title: 'anh', phone: '0902111333', area: 'Long Biên, Hà Nội',
      service: 'Gia đình', source: 'Hotline', stage: 'tu-van', since: 'Hôm qua', status: { text: 'Hẹn gọi lại 14:00', tone: 'amber' }, tags: [], note: 'Gia đình 5 người, có ông bà.' },
    { id: 'mt-oanh', owner: 'minh-thu', name: 'Chị Kim Oanh', short: 'Oanh', title: 'chị', phone: '0948222777', area: 'Hoàng Mai, Hà Nội',
      service: 'Bầu', source: 'Form đặt lịch', stage: 'bao-gia', since: '2 ngày', status: { text: 'Đã gửi báo giá', tone: 'muted' }, tags: [], note: '' },
    { id: 'mt-dung', owner: 'minh-thu', name: 'Chị Thùy Dung', short: 'Dung', title: 'chị', phone: '0976444888', area: 'Cầu Giấy, Hà Nội',
      service: 'Sinh nhật', source: 'Chat trực tiếp', stage: 'cho-coc', since: 'Giữ 30/09 15:00', status: { text: 'Hết hạn giữ 13:00', tone: 'amber' }, tags: [], note: '' },
    { id: 'mt-haianh', owner: 'minh-thu', name: 'Chị Hải Anh', short: 'Hải Anh', title: 'chị', phone: '0981999000', area: 'Ba Đình, Hà Nội',
      service: 'Newborn', source: 'Khách giới thiệu', stage: 'da-chot', since: 'Chụp 21/09', status: { text: 'Đã chụp', tone: 'green' }, tags: [], note: '' },

    // ---------- Thu Hà ----------
    { id: 'th-phuongthao', owner: 'thu-ha', name: 'Chị Phương Thảo', short: 'Thảo', title: 'chị', phone: '0917333222', area: 'Tây Hồ, Hà Nội',
      service: 'Bé lớn', source: 'Trợ lý web', stage: 'moi', since: '1 giờ trước', status: { text: 'Chưa liên hệ', tone: 'red' }, tags: ['Khách mới'], note: '' },
    { id: 'th-hang', owner: 'thu-ha', name: 'Chị Minh Hằng', short: 'Hằng', title: 'chị', phone: '0935666111', area: 'Thanh Xuân, Hà Nội',
      service: 'Newborn', source: 'Chat trực tiếp', stage: 'tu-van', since: 'Hôm nay', status: { text: 'Chờ gửi concept', tone: 'amber' },
      baby: { kind: 'due', date: '2026-11-02' }, tags: [], note: '' },
    { id: 'th-ducanh', owner: 'thu-ha', name: 'Anh Đức Anh', short: 'Đức Anh', title: 'anh', phone: '0961777444', area: 'Hà Đông, Hà Nội',
      service: 'Gia đình', source: 'Khách giới thiệu', stage: 'bao-gia', since: '2 ngày', status: { text: 'Nhắc lại ngày mai', tone: 'muted' }, tags: [], note: '' },
    { id: 'th-ngocmai', owner: 'thu-ha', name: 'Chị Ngọc Mai', short: 'Ngọc Mai', title: 'chị', phone: '0909123123', area: 'Đống Đa, Hà Nội',
      service: 'Newborn', source: 'Trợ lý web', stage: 'cho-coc', since: 'Giữ 03/10 09:00', status: { text: 'Tiền đã về', tone: 'blue' }, tags: [], note: '' },
    { id: 'th-hoa', owner: 'thu-ha', name: 'Chị Hoa', short: 'Hoa', title: 'chị', phone: '0914000999', area: 'Hai Bà Trưng, Hà Nội',
      service: 'Bầu', source: 'Hotline', stage: 'da-chot', since: 'Chụp 21/09', status: { text: 'Đã chụp', tone: 'green' }, tags: [], note: '' },
    { id: 'th-kimbich', owner: 'thu-ha', name: 'Chị Kim Bích', short: 'Bích', title: 'chị', phone: '0966321987', area: 'Tây Hồ, Hà Nội',
      service: 'Sinh nhật', source: 'Chat trực tiếp', stage: 'tu-van', since: '23/09', status: { text: 'Đã gửi concept', tone: 'muted' },
      tags: ['Chuyển từ Ngọc Anh'], note: '[Bàn giao từ Ngọc Anh] Chị muốn Thu Hà tư vấn vì từng chụp bé đầu với Thu Hà.',
      transfer: { from: 'ngoc-anh', mode: 'han', until: null, revenue: 'nguoi-nhan' } },
    { id: 'th-khanhvy', owner: 'thu-ha', name: 'Chị Khánh Vy', short: 'Vy', title: 'chị', phone: '0977888123', area: 'Cầu Giấy, Hà Nội',
      service: 'Bé lớn', source: 'Chat trực tiếp', stage: 'da-chot', since: 'Chụp 24/09', status: { text: 'Đã chụp', tone: 'green' }, tags: [], note: '' },

    // ---------- Quốc Bảo ----------
    { id: 'qb-kien', owner: 'quoc-bao', name: 'Anh Trung Kiên', short: 'Kiên', title: 'anh', phone: '0903444555', area: 'Nam Từ Liêm, Hà Nội',
      service: 'Gia đình', source: 'Hotline', stage: 'moi', since: 'Hôm nay', status: { text: 'Gọi lúc 16:00', tone: 'muted' }, tags: ['Khách mới'], note: '' },
    { id: 'qb-baongoc', owner: 'quoc-bao', name: 'Chị Bảo Ngọc', short: 'Bảo Ngọc', title: 'chị', phone: '0938777666', area: 'Long Biên, Hà Nội',
      service: 'Tại nhà', source: 'Trợ lý web', stage: 'tu-van', since: '20 phút trước', status: { text: 'Chờ gửi khung giờ', tone: 'amber' }, tags: [], note: '',
      task: { type: 'goi-lai', badge: 'Chờ phản hồi 20 phút', tone: 'amber', desc: 'Hỏi chụp tại nhà Long Biên · chờ gửi khung giờ', prio: 2 } },
    { id: 'qb-quyen', owner: 'quoc-bao', name: 'Chị Lệ Quyên', short: 'Quyên', title: 'chị', phone: '0968555222', area: 'Thanh Xuân, Hà Nội',
      service: 'Newborn', source: 'Form đặt lịch', stage: 'bao-gia', since: 'Hôm qua', status: { text: 'Khách so sánh giá', tone: 'amber' }, tags: [], note: '' },
    { id: 'qb-son', owner: 'quoc-bao', name: 'Anh Sơn', short: 'Sơn', title: 'anh', phone: '0985111777', area: 'Ba Đình, Hà Nội',
      service: 'Gia đình', source: 'Khách giới thiệu', stage: 'da-chot', since: 'Chụp 22/09', status: { text: 'Đã chụp', tone: 'green' }, tags: [], note: '' },
    { id: 'qb-tam', owner: 'quoc-bao', name: 'Chị Thanh Tâm', short: 'Tâm', title: 'chị', phone: '0916222888', area: 'Tây Hồ, Hà Nội',
      service: 'Tại nhà', source: 'Trợ lý web', stage: 'da-chot', since: 'Chụp 24/09', status: { text: 'Đã chụp', tone: 'green' }, tags: [], note: '' },
    { id: 'qb-hanh', owner: 'quoc-bao', name: 'Chị Hạnh', short: 'Hạnh', title: 'chị', phone: '0947333999', area: 'Hoàng Mai, Hà Nội',
      service: 'Gia đình', source: 'Chat trực tiếp', stage: 'da-chot', since: 'Chụp 27/09', status: { text: 'Đã cọc', tone: 'green' }, tags: [], note: '' },

    // ---------- Hải Yến ----------
    { id: 'hy-quynh', owner: 'hai-yen', name: 'Chị Như Quỳnh', short: 'Quỳnh', title: 'chị', phone: '0919444111', area: 'Đống Đa, Hà Nội',
      service: 'Sinh nhật', source: 'Chat trực tiếp', stage: 'moi', since: '1 giờ trước', status: { text: 'Chưa liên hệ', tone: 'red' }, tags: ['Khách mới'], note: '',
      task: { type: 'goi-lai', badge: 'Quá hạn 1 giờ', tone: 'red', desc: 'Nhắn qua chat · hỏi concept sinh nhật 2 tuổi', prio: 1 } },
    { id: 'hy-huong', owner: 'hai-yen', name: 'Chị Thanh Hương', short: 'Hương', title: 'chị', phone: '0932888555', area: 'Cầu Giấy, Hà Nội',
      service: 'Newborn', source: 'Trợ lý web', stage: 'tu-van', since: 'Hôm nay', status: { text: 'Hẹn gọi lại 11:00', tone: 'amber' },
      baby: { kind: 'due', date: '2026-10-08' }, tags: [], note: '' },
    { id: 'hy-maiphuong', owner: 'hai-yen', name: 'Chị Mai Phương', short: 'Mai Phương', title: 'chị', phone: '0963111444', area: 'Thanh Xuân, Hà Nội',
      service: 'Bầu', source: 'Form đặt lịch', stage: 'bao-gia', since: '2 ngày', status: { text: 'Đã gửi báo giá', tone: 'muted' }, tags: [], note: '' },
    { id: 'hy-tien', owner: 'hai-yen', name: 'Anh Tiến', short: 'Tiến', title: 'anh', phone: '0908666333', area: 'Hà Đông, Hà Nội',
      service: 'Gia đình', source: 'Hotline', stage: 'cho-coc', since: 'Giữ 29/09 10:00', status: { text: 'Hết hạn giữ 16:00', tone: 'amber' }, tags: [], note: '' },
    { id: 'hy-uyen', owner: 'hai-yen', name: 'Chị Tố Uyên', short: 'Uyên', title: 'chị', phone: '0974555666', area: 'Hai Bà Trưng, Hà Nội',
      service: 'Newborn', source: 'Trợ lý web', stage: 'da-chot', since: 'Chụp 23/09', status: { text: 'Đã chụp', tone: 'green' }, tags: [], note: '' },
    { id: 'hy-hongvan', owner: 'hai-yen', name: 'Chị Hồng Vân', short: 'Vân', title: 'chị', phone: '0988222444', area: 'Thanh Xuân, Hà Nội',
      service: 'Sinh nhật', source: 'Chat trực tiếp', stage: 'da-chot', since: 'Chụp 25/09', status: { text: 'Chưa thu đủ', tone: 'amber' }, tags: [], note: '' },
    { id: 'hy-lanchi', owner: 'hai-yen', name: 'Chị Lan Chi', short: 'Lan Chi', title: 'chị', phone: '0921777000', area: 'Ba Đình, Hà Nội',
      service: 'Newborn', source: 'Khách giới thiệu', stage: null, since: 'Tháng 7', status: { text: 'Khách cũ', tone: 'muted' },
      baby: { kind: 'birth', date: '2026-06-27', name: 'Bé Bin' }, tags: ['Khách cũ'], note: '',
      task: { type: 'cham-soc', badge: 'Cơ hội bán thêm', tone: 'accent', title: 'Bé Bin nhà chị Lan Chi · tròn 100 ngày 05/10', desc: 'Đã chụp Newborn tháng 7 · chưa có lịch 100 ngày', action: 'uu-dai', prio: 9 } }
  ];

  // Lịch chụp chung của studio (mọi sale đều thấy). dur tính bằng giờ.
  // status: checkin | da-coc | chua-thu-du | giu-cho
  const appointments = [
    { id: 'ap1',  date: '2026-09-21', start: '09:00', dur: 1.5, service: 'Newborn', label: 'Bé Na', room: 'P1', photographer: 'Tuấn', status: 'da-coc', owner: 'minh-thu', customerId: 'mt-haianh' },
    { id: 'ap2',  date: '2026-09-21', start: '14:00', dur: 1.5, service: 'Bầu', label: 'C. Hoa', room: 'P3', photographer: 'Hùng', status: 'da-coc', owner: 'thu-ha', customerId: 'th-hoa' },
    { id: 'ap3',  date: '2026-09-22', start: '10:00', dur: 2, service: 'Gia đình', label: 'A. Sơn', room: 'P2', photographer: 'Long', status: 'da-coc', owner: 'quoc-bao', customerId: 'qb-son' },
    { id: 'ap4',  date: '2026-09-23', start: '08:30', dur: 1.5, service: 'Newborn', label: 'Bé Tôm', room: 'P1', photographer: 'Tuấn', status: 'da-coc', owner: 'hai-yen', customerId: 'hy-uyen' },
    { id: 'ap5',  date: '2026-09-23', start: '15:00', dur: 1.5, service: 'Sinh nhật', label: 'Bé Cốm', room: 'P2', photographer: 'Hùng', status: 'chua-thu-du', owner: 'minh-thu' },
    { id: 'ap6',  date: '2026-09-24', start: '09:00', dur: 1.5, service: 'Bé lớn', label: 'Bé Khoai', room: 'P2', photographer: 'Minh', status: 'da-coc', owner: 'thu-ha', customerId: 'th-khanhvy' },
    { id: 'ap7',  date: '2026-09-24', start: '16:00', dur: 1.5, service: 'Tại nhà', label: 'Tây Hồ', room: 'Ngoài', photographer: 'Long', status: 'da-coc', owner: 'quoc-bao', customerId: 'qb-tam' },
    { id: 'ap8',  date: '2026-09-25', start: '08:30', dur: 1.5, service: 'Newborn', label: 'Bé Bơ', room: 'P1', photographer: 'Tuấn', status: 'checkin', owner: 'ngoc-anh' },
    { id: 'ap9',  date: '2026-09-25', start: '10:00', dur: 2, service: 'Gia đình', label: 'Nhà chị Mai', room: 'P2', photographer: 'Hùng', status: 'da-coc', owner: 'ngoc-anh' },
    { id: 'ap10', date: '2026-09-25', start: '13:30', dur: 1.5, service: 'Bầu', label: 'Chị Ngân', room: 'P3', photographer: 'Tuấn', status: 'da-coc', owner: 'ngoc-anh', customerId: 'na-ngan' },
    { id: 'ap11', date: '2026-09-25', start: '15:00', dur: 1.5, service: 'Sinh nhật', label: 'Bé Gạo', room: 'P2', photographer: 'Hùng', status: 'chua-thu-du', owner: 'hai-yen', customerId: 'hy-hongvan' },
    { id: 'ap12', date: '2026-09-25', start: '17:00', dur: 1, service: 'Tại nhà', label: 'Bé Mít', room: 'Ngoài', place: 'Cầu Giấy', photographer: 'Long', status: 'da-coc', owner: 'minh-thu' },
    { id: 'ap13', date: '2026-09-26', start: '09:00', dur: 2, service: 'Gia đình', label: 'A. Huy', room: 'P2', photographer: 'Hùng', status: 'da-coc', owner: 'ngoc-anh' },
    { id: 'ap14', date: '2026-09-26', start: '09:00', dur: 1.5, service: 'Newborn', label: 'Bé Sóc', room: 'P1', photographer: 'Tuấn', status: 'da-coc', owner: 'ngoc-anh' },
    { id: 'ap15', date: '2026-09-26', start: '10:30', dur: 1.5, service: 'Bầu', label: 'C. Lụa', room: 'P3', photographer: 'Minh', status: 'da-coc', owner: 'ngoc-anh' },
    { id: 'ap16', date: '2026-09-26', start: '14:00', dur: 1.5, service: 'Bé lớn', label: 'Bé Xoài', room: 'P3', photographer: 'Minh', status: 'da-coc', owner: 'ngoc-anh' },
    { id: 'ap17', date: '2026-09-27', start: '09:00', dur: 1.5, service: 'Newborn', label: 'Chị Hà Linh', room: 'P1', photographer: 'Tuấn', status: 'giu-cho', owner: 'ngoc-anh', customerId: 'na-linh', depositCode: 'AB240931' },
    { id: 'ap18', date: '2026-09-27', start: '15:00', dur: 2, service: 'Gia đình', label: 'C. Hạnh', room: 'P2', photographer: 'Hùng', status: 'da-coc', owner: 'quoc-bao', customerId: 'qb-hanh' },
    { id: 'ap19', date: '2026-09-28', start: '09:00', dur: 1.5, service: 'Sinh nhật', label: 'A. Minh Đức', room: 'P2', photographer: 'Hùng', status: 'giu-cho', owner: 'ngoc-anh', customerId: 'na-duc', depositCode: 'AB240933' },
    { id: 'ap20', date: '2026-09-29', start: '10:00', dur: 2, service: 'Gia đình', label: 'A. Tiến', room: 'P2', photographer: 'Long', status: 'giu-cho', owner: 'hai-yen', customerId: 'hy-tien', depositCode: 'AB240932' },
    { id: 'ap21', date: '2026-09-30', start: '15:00', dur: 1.5, service: 'Sinh nhật', label: 'C. Thùy Dung', room: 'P2', photographer: 'Hùng', status: 'giu-cho', owner: 'minh-thu', customerId: 'mt-dung', depositCode: 'AB240927' },
    { id: 'ap22', date: '2026-10-02', start: '10:00', dur: 1.5, service: 'Bầu', label: 'C. Mai Anh', room: 'P3', photographer: 'Minh', status: 'giu-cho', owner: 'ngoc-anh', customerId: 'na-maianh', depositCode: 'AB240929' },
    { id: 'ap23', date: '2026-10-03', start: '09:00', dur: 1.5, service: 'Newborn', label: 'C. Ngọc Mai', room: 'P1', photographer: 'Tuấn', status: 'giu-cho', owner: 'thu-ha', customerId: 'th-ngocmai', depositCode: 'AB240934' }
  ];

  // state: sent (đã gửi link) | opened (khách mở link) | paid (tiền về, khớp mã, chờ sale xác nhận)
  //        | short (tiền về nhưng thiếu) | confirmed (lịch đã xác nhận)
  const deposits = [
    { code: 'AB240931', owner: 'ngoc-anh', customerId: 'na-linh', appointmentId: 'ap17', channels: ['Messenger'], state: 'paid',
      sentAt: '08:40', openedAt: '08:47', paidAt: '09:12', received: 1000000,
      log: [
        { time: '09:12', who: 'auto', text: 'Nhận 1.000.000đ từ ngân hàng, nội dung chứa mã AB240931' },
        { time: '08:47', who: 'auto', text: 'Khách mở link đặt cọc' },
        { time: '08:40', who: 'sale', text: 'Ngọc Anh gửi link cọc qua Messenger' }
      ] },
    { code: 'AB240933', owner: 'ngoc-anh', customerId: 'na-duc', appointmentId: 'ap19', channels: ['Zalo'], state: 'sent',
      sentAt: '12:30 hôm qua', holdUntil: '14:30', log: [{ time: 'Hôm qua', who: 'sale', text: 'Ngọc Anh gửi link cọc qua Zalo' }] },
    { code: 'AB240929', owner: 'ngoc-anh', customerId: 'na-maianh', appointmentId: 'ap22', channels: ['Chat web'], state: 'short',
      sentAt: '08:05', openedAt: '08:20', paidAt: '09:40', received: 500000,
      log: [
        { time: '09:40', who: 'auto', text: 'Nhận 500.000đ, nội dung khớp mã AB240929 nhưng thiếu so với số tiền cọc' },
        { time: '08:20', who: 'auto', text: 'Khách mở link đặt cọc' },
        { time: '08:05', who: 'sale', text: 'Ngọc Anh gửi link cọc qua Chat web' }
      ] },
    { code: 'AB240927', owner: 'minh-thu', customerId: 'mt-dung', appointmentId: 'ap21', channels: ['Chat web', 'SMS'], state: 'opened',
      sentAt: '09:00', openedAt: '09:35', holdUntil: '13:00',
      log: [{ time: '09:35', who: 'auto', text: 'Khách mở link đặt cọc' }, { time: '09:00', who: 'sale', text: 'Minh Thư gửi link cọc qua Chat web, SMS' }] },
    { code: 'AB240934', owner: 'thu-ha', customerId: 'th-ngocmai', appointmentId: 'ap23', channels: ['Zalo'], state: 'paid',
      sentAt: '09:10', openedAt: '09:30', paidAt: '10:02', received: 1000000,
      log: [
        { time: '10:02', who: 'auto', text: 'Nhận 1.000.000đ từ ngân hàng, nội dung chứa mã AB240934' },
        { time: '09:30', who: 'auto', text: 'Khách mở link đặt cọc' },
        { time: '09:10', who: 'sale', text: 'Thu Hà gửi link cọc qua Zalo' }
      ] },
    { code: 'AB240926', owner: 'quoc-bao', customerId: 'qb-hanh', appointmentId: 'ap18', channels: ['Messenger'], state: 'confirmed',
      sentAt: 'Hôm qua', openedAt: 'Hôm qua', paidAt: '08:15', received: 1000000,
      log: [
        { time: '08:15', who: 'auto', text: 'Lịch 27/09 15:00 chuyển sang "Đã cọc"' },
        { time: '08:15', who: 'auto', text: 'Nhận 1.000.000đ từ ngân hàng, nội dung chứa mã AB240926' },
        { time: 'Hôm qua', who: 'sale', text: 'Quốc Bảo gửi link cọc qua Messenger' }
      ] },
    { code: 'AB240932', owner: 'hai-yen', customerId: 'hy-tien', appointmentId: 'ap20', channels: ['SMS'], state: 'sent',
      sentAt: '08:00', holdUntil: '16:00', log: [{ time: '08:00', who: 'sale', text: 'Hải Yến gửi link cọc qua SMS' }] }
  ];

  // Giao dịch ngân hàng không chứa mã đơn: chưa thuộc sale nào -> mọi sale thấy để nhận về.
  const unmatched = [
    { id: 'tx1', amount: 800000, time: '10:05', content: 'CK chup anh be Bo' }
  ];

  // status: cho-chon | dang-chinh | qua-han | cho-duyet | da-giao ; due = còn nợ (0 = đã thanh toán đủ)
  const orders = [
    { code: 'AB240902', owner: 'ngoc-anh', customer: 'Chị Phương', customerId: 'na-phuong', service: 'Newborn', pkg: 'Premium', date: '15/09', status: 'cho-chon', progress: '4/15 ảnh · 5 ngày chưa chọn', picked: 4, total: 15, idleDays: 5, due: 0 },
    { code: 'AB240908', owner: 'ngoc-anh', customer: 'Chị Lan Hương', service: 'Sinh nhật', pkg: 'Tiêu chuẩn', date: '18/09', status: 'dang-chinh', progress: '8/12 ảnh xong · hạn 25/09', due: 1200000 },
    { code: 'AB240911', owner: 'ngoc-anh', customer: 'Anh Việt', service: 'Gia đình', pkg: 'Premium', date: '19/09', status: 'qua-han', progress: 'Hạn 24/09 · trễ 1 ngày', due: 0 },
    { code: 'AB240915', owner: 'ngoc-anh', customer: 'Chị Hà My', service: 'Bầu', pkg: 'Tiêu chuẩn', date: '20/09', status: 'cho-duyet', progress: 'Đã gửi bản chỉnh lần 1', due: 0 },
    { code: 'AB240920', owner: 'ngoc-anh', customer: 'Chị Ngọc', service: 'Bé lớn', pkg: 'Cơ bản', date: '21/09', status: 'cho-chon', progress: '0/10 ảnh · gửi link 2 ngày trước', picked: 0, total: 10, idleDays: 2, due: 800000 },
    { code: 'AB240887', owner: 'ngoc-anh', customer: 'Chị Thanh', service: 'Newborn', pkg: 'Premium', date: '08/09', status: 'da-giao', progress: 'Khách đã tải về', due: 0, action: 'Xin đánh giá' },
    { code: 'AB240879', owner: 'ngoc-anh', customer: 'Anh Khoa', service: 'Gia đình', pkg: 'Tiêu chuẩn', date: '05/09', status: 'da-giao', progress: 'In album · nhận 28/09', due: 0, action: 'Báo lịch nhận' },

    { code: 'AB240905', owner: 'minh-thu', customer: 'Chị Hải Anh', customerId: 'mt-haianh', service: 'Newborn', pkg: 'Premium', date: '21/09', status: 'cho-chon', progress: '2/15 ảnh · 2 ngày chưa chọn', picked: 2, total: 15, idleDays: 2, due: 0 },
    { code: 'AB240906', owner: 'minh-thu', customer: 'Bé Cốm', service: 'Sinh nhật', pkg: 'Tiêu chuẩn', date: '23/09', status: 'dang-chinh', progress: '3/12 ảnh xong · hạn 30/09', due: 900000 },
    { code: 'AB240883', owner: 'minh-thu', customer: 'Chị Mỹ Duyên', service: 'Bầu', pkg: 'Tiêu chuẩn', date: '06/09', status: 'da-giao', progress: 'Khách đã tải về', due: 0, action: 'Xin đánh giá' },

    { code: 'AB240904', owner: 'thu-ha', customer: 'Chị Hoa', customerId: 'th-hoa', service: 'Bầu', pkg: 'Tiêu chuẩn', date: '21/09', status: 'dang-chinh', progress: '5/10 ảnh xong · hạn 28/09', due: 600000 },
    { code: 'AB240912', owner: 'thu-ha', customer: 'Chị Khánh Vy', customerId: 'th-khanhvy', service: 'Bé lớn', pkg: 'Cơ bản', date: '24/09', status: 'cho-chon', progress: '0/10 ảnh · gửi link 1 ngày trước', picked: 0, total: 10, idleDays: 1, due: 0 },
    { code: 'AB240890', owner: 'thu-ha', customer: 'Chị Quế', service: 'Newborn', pkg: 'Premium', date: '10/09', status: 'cho-duyet', progress: 'Đã gửi bản chỉnh lần 2', due: 0 },

    { code: 'AB240907', owner: 'quoc-bao', customer: 'Anh Sơn', customerId: 'qb-son', service: 'Gia đình', pkg: 'Premium', date: '22/09', status: 'cho-chon', progress: '0/20 ảnh · 3 ngày chưa chọn', picked: 0, total: 20, idleDays: 3, due: 1500000 },
    { code: 'AB240910', owner: 'quoc-bao', customer: 'Chị Thanh Tâm', customerId: 'qb-tam', service: 'Tại nhà', pkg: 'Tiêu chuẩn', date: '24/09', status: 'dang-chinh', progress: '2/12 ảnh xong · hạn 01/10', due: 0 },

    { code: 'AB240909', owner: 'hai-yen', customer: 'Chị Tố Uyên', customerId: 'hy-uyen', service: 'Newborn', pkg: 'Premium', date: '23/09', status: 'cho-chon', progress: '6/15 ảnh · 4 ngày chưa chọn', picked: 6, total: 15, idleDays: 4, due: 0 },
    { code: 'AB240895', owner: 'hai-yen', customer: 'Anh Phong', service: 'Gia đình', pkg: 'Tiêu chuẩn', date: '12/09', status: 'qua-han', progress: 'Hạn 23/09 · trễ 2 ngày', due: 0 },
    { code: 'AB240880', owner: 'hai-yen', customer: 'Chị Hà Vy', service: 'Bầu', pkg: 'Premium', date: '04/09', status: 'da-giao', progress: 'Khách đã tải về', due: 0, action: 'Xin đánh giá' }
  ];

  // Hộp thư: tin nhắn khách gửi trên website (qua Trợ lý web = bot chuyển, hoặc chat trực tiếp).
  const conversations = [
    { id: 'cv-na1', owner: 'ngoc-anh', customerId: 'na-trang', channel: 'Trợ lý web', bot: true, time: '2 phút', unread: true, online: true,
      botSummary: 'Dịch vụ: Newborn · Dự sinh: 15/10/2026 · SĐT: 0912 *** 456 · Quan tâm: concept nhẹ nhàng, chụp tại studio',
      messages: [
        { from: 'kh', text: 'Cho em hỏi gói newborn bao nhiêu ạ, bé nhà em dự sinh 15/10', time: '09:41' },
        { from: 'sale', text: 'Dạ ALOHA Baby chào chị Trang ạ! Bé dự sinh 15/10 thì thời điểm đẹp nhất để chụp newborn là khi bé được 7–14 ngày tuổi. Em gửi chị bảng giá và vài concept nhẹ nhàng nhé.', time: '09:43' },
        { from: 'kh', text: 'Studio có khung nào cuối tháng 10 không em, chị muốn đặt trước', time: '09:44' }
      ] },
    { id: 'cv-na2', owner: 'ngoc-anh', customerId: 'na-duc', channel: 'Chat trực tiếp', time: '12 phút', unread: true,
      messages: [{ from: 'sale', text: 'Dạ em đã gửi link cọc qua Zalo cho anh rồi ạ, lịch giữ tới 14:30 hôm nay.', time: '10:05' }, { from: 'kh', text: 'Ok em, tối anh chuyển cọc nhé', time: '10:18' }] },
    { id: 'cv-na3', owner: 'ngoc-anh', customerId: 'na-linh', channel: 'Chat trực tiếp', time: '25 phút', unread: true,
      messages: [{ from: 'kh', text: '[Ảnh] Em gửi bill chuyển khoản', time: '09:13' }] },
    { id: 'cv-na4', owner: 'ngoc-anh', customerId: 'na-ngan', channel: 'Chat trực tiếp', time: '1 giờ', unread: true,
      messages: [{ from: 'kh', text: 'Mai chị mang thêm váy được không em?', time: '09:30' }] },
    { id: 'cv-na5', owner: 'ngoc-anh', customerId: 'na-nhung', channel: 'Trợ lý web', bot: true, time: '2 giờ', unread: true,
      botSummary: 'Dịch vụ: Chụp tại nhà · Khu vực: Long Biên · Chưa để lại ngày mong muốn',
      messages: [{ from: 'kh', text: 'Studio có chụp tại nhà ở Long Biên không em?', time: '08:31' }] },
    { id: 'cv-na6', owner: 'ngoc-anh', customerId: 'na-quang', channel: 'Trợ lý web', bot: true, time: '3 giờ', unread: true,
      botSummary: 'Dịch vụ: Gia đình · 4 người · Chưa chọn concept',
      messages: [{ from: 'kh', text: 'Gói gia đình 4 người giá thế nào', time: '07:40' }] },
    { id: 'cv-na7', owner: 'ngoc-anh', customerId: 'na-phuong', channel: 'Chat trực tiếp', time: 'Hôm qua', unread: true,
      messages: [{ from: 'sale', text: 'Chị ơi bộ ảnh của bé đã lên "Ảnh của tôi", chị chọn giúp em 15 ảnh nhé.', time: 'Hôm qua' }, { from: 'kh', text: 'Chị bận quá, cuối tuần chị chọn ảnh', time: 'Hôm qua' }] },

    { id: 'cv-mt1', owner: 'minh-thu', customerId: 'mt-dieulinh', channel: 'Trợ lý web', bot: true, time: '40 phút', unread: true,
      botSummary: 'Dịch vụ: Newborn · Dự sinh: 20/10/2026 · Quan tâm: concept tông trắng',
      messages: [{ from: 'kh', text: 'Em muốn đặt trước lịch chụp newborn cho bé ạ', time: '09:50' }] },
    { id: 'cv-mt2', owner: 'minh-thu', customerId: 'mt-nam', channel: 'Chat trực tiếp', time: 'Hôm qua',
      messages: [{ from: 'kh', text: 'Nhà anh có ông bà nữa, tổng 5 người được không em?', time: 'Hôm qua' }, { from: 'sale', text: 'Dạ được ạ, chiều nay em gọi lại tư vấn anh nhé.', time: 'Hôm qua' }] },
    { id: 'cv-mt3', owner: 'minh-thu', customerId: 'mt-dung', channel: 'Chat trực tiếp', time: '55 phút', unread: true,
      messages: [{ from: 'kh', text: 'Em ơi chị mở link rồi, chiều chị chuyển nhé', time: '09:36' }] },

    { id: 'cv-th1', owner: 'thu-ha', customerId: 'th-phuongthao', channel: 'Trợ lý web', bot: true, time: '1 giờ', unread: true,
      botSummary: 'Dịch vụ: Bé lớn · Bé 3 tuổi · Quan tâm: concept Hàn Quốc',
      messages: [{ from: 'kh', text: 'Bé 3 tuổi chụp concept Hàn Quốc được không ạ', time: '09:25' }] },
    { id: 'cv-th2', owner: 'thu-ha', customerId: 'th-hang', channel: 'Chat trực tiếp', time: '30 phút', unread: true,
      messages: [{ from: 'kh', text: 'Em gửi chị xem thêm concept newborn nhé', time: '10:00' }] },
    { id: 'cv-th3', owner: 'thu-ha', customerId: 'th-khanhvy', channel: 'Chat trực tiếp', time: 'Hôm qua', done: true,
      messages: [{ from: 'kh', text: 'Cảm ơn em, hôm nay bé chụp vui lắm', time: 'Hôm qua' }, { from: 'sale', text: 'Dạ em cảm ơn chị, ảnh sẽ lên "Ảnh của tôi" trong vài ngày tới ạ.', time: 'Hôm qua' }] },

    { id: 'cv-qb1', owner: 'quoc-bao', customerId: 'qb-baongoc', channel: 'Trợ lý web', bot: true, time: '20 phút', unread: true,
      botSummary: 'Dịch vụ: Chụp tại nhà · Khu vực: Long Biên · Muốn chụp cuối tuần',
      messages: [{ from: 'kh', text: 'Cuối tuần sau studio còn lịch chụp tại nhà không ạ?', time: '10:10' }] },
    { id: 'cv-qb2', owner: 'quoc-bao', customerId: 'qb-quyen', channel: 'Chat trực tiếp', time: 'Hôm qua',
      messages: [{ from: 'kh', text: 'Để chị cân nhắc thêm với chồng nhé em', time: 'Hôm qua' }] },

    { id: 'cv-hy1', owner: 'hai-yen', customerId: 'hy-quynh', channel: 'Chat trực tiếp', time: '1 giờ', unread: true,
      messages: [{ from: 'kh', text: 'Sinh nhật bé 2 tuổi có concept nào xinh không em?', time: '09:28' }] },
    { id: 'cv-hy2', owner: 'hai-yen', customerId: 'hy-huong', channel: 'Trợ lý web', bot: true, time: '2 giờ', unread: true,
      botSummary: 'Dịch vụ: Newborn · Dự sinh: 08/10/2026 · Hẹn gọi lại 11:00',
      messages: [{ from: 'kh', text: '11h em gọi lại chị nhé, giờ chị đang bận', time: '08:40' }] },
    { id: 'cv-hy3', owner: 'hai-yen', customerId: 'hy-hongvan', channel: 'Chat trực tiếp', time: '3 giờ',
      messages: [{ from: 'kh', text: 'Chiều nay chị qua chụp cho bé Gạo nhé em', time: '07:30' }] }
  ];

  // Chuyển giao khách giữa các sale. Luồng: sale gửi -> Quản lý duyệt (cho-duyet)
  // -> người nhận bấm "Nhận khách" (cho-nhan) -> hồ sơ + hội thoại + lịch + cọc + đơn
  // chuyển owner (da-chuyen). Trước bước cuối khách vẫn thuộc sale cũ.
  // mode: tam-thoi (hết `until` khách quay về sale cũ) | han ; revenue: giu (đơn đã cọc
  // vẫn tính cho sale cũ) | nguoi-nhan. `names` là tên lúc gửi, để hiển thị sau khi đã chuyển.
  const transfers = [
    { id: 'tr-4', from: 'quoc-bao', to: 'minh-thu', customerIds: ['qb-quyen'], names: ['Chị Lệ Quyên'], reason: 'Quá tải', mode: 'han', until: null, revenue: 'nguoi-nhan',
      note: 'Chị Quyên đang so sánh giá gói Newborn, cần gọi lại trong tuần.', status: 'cho-duyet', createdAt: '25/09 09:15' },
    { id: 'tr-3', from: 'hai-yen', to: 'quoc-bao', customerIds: ['hy-maiphuong'], names: ['Chị Mai Phương'], reason: 'Nghỉ phép', mode: 'tam-thoi', until: '2026-09-27', revenue: 'giu',
      note: 'Đã gửi báo giá gói Bầu, chị hẹn trả lời cuối tuần.', status: 'cho-nhan', createdAt: '24/09 17:40', approvedAt: '25/09 08:30' },
    { id: 'tr-1', from: 'minh-thu', to: 'ngoc-anh', customerIds: ['mt-nam'], names: ['Anh Hoàng Nam'], reason: 'Khách yêu cầu', mode: 'han', until: null, revenue: 'nguoi-nhan',
      note: 'Anh Nam muốn làm việc với Ngọc Anh vì vợ anh từng chụp bầu với bạn. Gia đình 5 người, có ông bà, hẹn gọi lại 14:00.', status: 'cho-nhan', createdAt: '24/09 15:10', approvedAt: '24/09 16:20' },
    { id: 'tr-2', from: 'ngoc-anh', to: 'thu-ha', customerIds: ['th-kimbich'], names: ['Chị Kim Bích'], reason: 'Khách yêu cầu', mode: 'han', until: null, revenue: 'nguoi-nhan',
      note: 'Chị muốn Thu Hà tư vấn vì từng chụp bé đầu với Thu Hà.', status: 'da-chuyen', createdAt: '22/09 10:00', approvedAt: '22/09 14:00', doneAt: '23/09' }
  ];

  window.ALOHA_SALE_DATA = {
    now: '2026-09-25T10:30:00',
    config: CONFIG,
    sales, photographers, rooms,
    customers, appointments, deposits, unmatched, orders, conversations, transfers
  };
})(window);
