// ALOHA Baby — cờ bật/tắt tạm thời một số tính năng phía khách hàng
// (người dùng yêu cầu 2026-09-27: "tạm thời ẩn ảnh trong album, các nút đặt
// lịch, chatbot AI" - khách chưa đăng nhập vẫn lướt web, bấm ảnh dịch vụ thì
// đăng nhập rồi vào thẳng chat với Sale).
//
// Chỉ ẨN, không xoá code: muốn bật lại tính năng nào thì đổi false -> true ngay dưới đây.
// Lưu ý: 5 ảnh + dòng dịch vụ đầu trang chủ LUÔN dẫn tới #/chat-sale (yêu cầu mới, không
// phụ thuộc cờ). Bật lại albumPages thì các thẻ album khác bấm được lại, còn 5 ảnh đầu trang
// muốn quay về album thì sửa href trong index.html. Bật lại aiChat thì khung chat nổi là
// chatbot như cũ và #/chat-sale mở chatbot đó (không còn chat Sale).
//   booking    : nút/link Đặt lịch + trang #/dat-lich
//   aiChat     : chatbot kịch bản + AI Gemini (tắt thì khung chat nổi là chat với Sale)
//   albumPages : trang album #/album/... (ảnh bìa trên trang chủ vẫn hiện)
//
// Nạp trong <head> để class trên <html> có trước khi trang vẽ, tránh nút đã
// ẩn vẫn nháy lên một nhịp. Test có thể đặt sẵn window.ALOHA_FEATURES (qua
// evaluateOnNewDocument) để bật lại mọi tính năng khi kiểm tra luồng cũ.
(function (window) {
  const FEATURES = Object.assign({
    booking: false,
    aiChat: false,
    albumPages: false
  }, window.ALOHA_FEATURES || {});
  window.ALOHA_FEATURES = FEATURES;

  const cls = document.documentElement.classList;
  cls.toggle('feat-no-booking', !FEATURES.booking);
  cls.toggle('feat-no-ai', !FEATURES.aiChat);
  cls.toggle('feat-no-album', !FEATURES.albumPages);
})(window);
