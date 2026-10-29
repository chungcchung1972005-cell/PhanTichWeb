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
// editSync defaults ON for multi-device demo (2026-10-29).
// ?editSync=0 persists this browser's opt-out; ?editSync=1 clears it.
(function (window) {
  // Đồng bộ mặc định bật, kể cả khi localStorage bị chặn.
  const EDIT_SYNC_KEY = 'aloha_edit_sync';
  let editSyncOptIn = true;
  try {
    const q = new URLSearchParams(window.location.search).get('editSync');
    editSyncOptIn = q !== '0';
    if (q === '1') window.localStorage.removeItem(EDIT_SYNC_KEY);
    else if (q === '0') window.localStorage.setItem(EDIT_SYNC_KEY, '0');
    editSyncOptIn = window.localStorage.getItem(EDIT_SYNC_KEY) !== '0';
  } catch (e) {
    // Keep the URL choice for this page when browser storage is unavailable.
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
