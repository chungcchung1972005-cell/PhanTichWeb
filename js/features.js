// ALOHA Baby — cờ bật/tắt tạm thời một số tính năng phía khách hàng
// (người dùng yêu cầu 2026-09-27: "tạm thời ẩn ảnh trong album, các nút đặt
// lịch, chatbot AI" - khách chưa đăng nhập vẫn lướt web, bấm ảnh dịch vụ thì
// đăng nhập rồi vào thẳng chat với Sale).
//
// Chỉ ẨN, không xoá code: muốn bật lại tính năng nào thì đổi false -> true ngay dưới đây.
// 2026-09-28: bật lại albumPages theo yêu cầu người dùng - 5 ảnh + dòng dịch vụ đầu trang chủ
// mở album #/album/<dịch vụ> (bắt đăng nhập, js/albums.js), các thẻ album khác xem công khai.
// 2026-09-28 (lượt sau): bật lại aiChat - khung chat nổi là chatbot AI, tự mở ở trang chủ,
// lời chào đổi theo dịch vụ đang xem; khách bấm "Nhắn trực tiếp với Sale" thì chat tiếp với
// Sale ngay trong khung đó (js/script.js + js/sale-chat.js). Tắt aiChat thì khung chat nổi
// là chat với Sale riêng (#saleChatPanel).
//   booking    : nút/link Đặt lịch + trang #/dat-lich
//   aiChat     : chatbot kịch bản + AI Gemini (tắt thì khung chat nổi là chat với Sale)
//   albumPages : trang album #/album/... (ảnh bìa trên trang chủ vẫn hiện)
//   editSync   : (2026-10-15, mặc định TẮT) cho phép js/edit-sync.js (AlohaEditSync) gọi API yêu cầu
//                chỉnh ảnh trên server (server/edit-requests.js; RAM, hoặc MongoDB RIÊNG khi có EDIT_REQUESTS_MONGODB_URI;
//                server khởi động lại). BẬT: "Ảnh của tôi" + chuông thông báo (khách), khu Ảnh & chỉnh sửa
//                (Thợ ảnh đọc/ghi, Sếp chỉ đọc) đọc/ghi qua API thay localStorage. TẮT (mặc định): mọi
//                trang giữ nguyên luồng AlohaData/localStorage cũ. Không gắn class lên <html>.
//
//                Bật RIÊNG cho 1 trình duyệt (2026-10-15, nhánh feat/edit-sync-demo): mở trang bất kỳ có
//                nạp file này (index.html, login.html, crm/admin.html) với ?editSync=1 (vd
//                login.html?editSync=1, hoặc index.html?editSync=1#/chon-anh - tham số đứng TRƯỚC dấu #).
//                Trình duyệt đó nhớ trong localStorage key "aloha_edit_sync" (giá trị "1") nên đổi trang /
//                đăng nhập vẫn giữ. ?editSync=0 xoá key -> tắt lại. Khách khác không có key -> vẫn TẮT.
//                Đây chỉ là công tắc giao diện, KHÔNG phải hàng rào bảo mật: quyền do server kiểm.
//
// Nạp trong <head> để class trên <html> có trước khi trang vẽ, tránh nút đã
// ẩn vẫn nháy lên một nhịp. Test có thể đặt sẵn window.ALOHA_FEATURES (qua
// evaluateOnNewDocument) để bật lại mọi tính năng khi kiểm tra luồng cũ.
(function (window) {
  // Công tắc editSync theo trình duyệt. localStorage bị chặn (chế độ riêng tư...) -> coi như TẮT.
  const EDIT_SYNC_KEY = 'aloha_edit_sync';
  let editSyncOptIn = false;
  try {
    const q = new URLSearchParams(window.location.search).get('editSync');
    if (q === '1') window.localStorage.setItem(EDIT_SYNC_KEY, '1');
    else if (q === '0') window.localStorage.removeItem(EDIT_SYNC_KEY);
    editSyncOptIn = window.localStorage.getItem(EDIT_SYNC_KEY) === '1';
  } catch (e) {
    editSyncOptIn = false;
  }

  // window.ALOHA_FEATURES đặt sẵn (test) vẫn được ưu tiên hơn công tắc trên.
  const FEATURES = Object.assign({
    booking: false,
    aiChat: true,
    albumPages: true,
    editSync: editSyncOptIn
  }, window.ALOHA_FEATURES || {});
  window.ALOHA_FEATURES = FEATURES;

  const cls = document.documentElement.classList;
  cls.toggle('feat-no-booking', !FEATURES.booking);
  cls.toggle('feat-no-ai', !FEATURES.aiChat);
  cls.toggle('feat-no-album', !FEATURES.albumPages);
})(window);
