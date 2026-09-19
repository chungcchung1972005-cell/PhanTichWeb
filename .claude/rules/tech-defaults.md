# Tech Defaults — ALOHA Baby

## Kiến trúc

Chưa có stack công nghệ được chỉ định — không tự chọn framework/database thay người dùng khi chưa xác nhận; khi cần quyết định kỹ thuật, đề xuất kèm lý do hoặc hỏi lại thay vì âm thầm chọn.

Nguyên tắc áp dụng bất kể stack nào được chọn:
- Một nguồn dữ liệu CRM duy nhất cho khách hàng, lịch hẹn, ảnh, thanh toán — phân hệ khách hàng và Admin đọc/ghi cùng dữ liệu này, không lệch pha qua các bảng/API riêng biệt.
- Cơ chế đặt lịch phải chống race-condition khi giữ/khóa khung giờ (chống double-booking phòng, ekip, photographer), **và** đẩy cập nhật trạng thái khung giờ tới mọi client đang xem theo thời gian thực (WebSocket/SSE hoặc polling tần suất đủ ngắn) — xem yêu cầu real-time trong `workflow.md`.
- Trạng thái (status) là enum dùng chung, định nghĩa một nơi, tái sử dụng ở cả hai phân hệ (xem Status System bên dưới).
- Mã đơn hàng là định danh xuyên suốt: dùng để đặt tên folder ảnh gốc, gắn việc chỉnh sửa, nội dung chuyển khoản cọc — không dùng nhiều mã khác nhau cho cùng một đơn.
- Các tham số nghiệp vụ phải là cấu hình (settings), không hard-code trong logic (xem Cấu hình chưa xác định bên dưới).

**Giới hạn của bản hiện tại (site tĩnh HTML/CSS/JS, không backend cho CRM/booking):** tính năng real-time đặt lịch vẫn chỉ có UI + hành vi mô phỏng bằng JavaScript phía client (dữ liệu giả lập, không đồng bộ thật giữa nhiều người dùng). Đây là giới hạn tạm thời của giai đoạn demo — khi có backend cho CRM/booking, phải thay bằng WebSocket/SSE thật.

**Chatbot AI (đã có phần thật, cập nhật 2026-09-19):** bước chọn dịch vụ/gợi ý concept ban đầu vẫn là kịch bản quick-reply dựng sẵn (chủ động, nhất quán với bảng giá tham khảo). Khung nhập tự do bên dưới đã nối sang **server proxy cục bộ thật** (`server/server.js`, chạy `npm start` riêng, không phải site tĩnh) gọi **Claude API thật** — khi server này chạy và có `ANTHROPIC_API_KEY` hợp lệ, câu trả lời tự do là AI thật, không còn mô phỏng. Nếu server không chạy/thiếu key, giao diện báo lỗi thân thiện thay vì giả vờ đang có AI. Model + system prompt (giới hạn phạm vi tư vấn, không bịa số liệu cọc/chính sách, không tự chốt lịch trong chat) nằm trong `server/server.js`. Server này **tách biệt hoàn toàn** khỏi CRM/booking — không dùng làm tiền đề cho backend CRM/booking sau này, phạm vi và stack cho CRM/booking vẫn là quyết định riêng, chưa chốt.

## Data Model CRM

Hồ sơ khách hàng là trung tâm dữ liệu — mọi tính năng mới (booking, chọn ảnh, chat, dời lịch...) phải đọc/ghi vào cùng hồ sơ này, không tạo nguồn dữ liệu khách hàng song song. Gồm 7 nhóm:

1. **Liên hệ:** họ tên, SĐT, email, Zalo/Facebook.
2. **Nguồn khách:** website, Facebook, TikTok, Instagram, hotline, giới thiệu, đối tác bệnh viện/spa.
3. **Thông tin bé:** tên, ngày sinh hoặc ngày dự sinh, lưu ý sức khỏe/dị ứng.
4. **Lịch sử lịch hẹn:** đã đặt/dời/hủy/đã chụp, dịch vụ, gói, concept.
5. **Thanh toán:** tiền cọc, đã thanh toán, còn lại, phí mua thêm ảnh/album.
6. **Ảnh & chỉnh sửa:** bộ ảnh gốc, ảnh đã chọn, yêu cầu chỉnh sửa, ảnh hoàn thiện.
7. **Chăm sóc:** ghi chú tư vấn, đánh giá, văn bản đồng ý dùng ảnh marketing, mốc chụp tiếp theo.

## Status System

Dùng đúng cùng một bộ tên trạng thái xuyên suốt Admin và giao diện khách hàng — không tạo tên khác nhau cho cùng một ý nghĩa ở hai nơi.

- **Trạng thái lịch hẹn:** Chưa cọc → Chờ xác nhận → (Chờ duyệt dời lịch, nếu có) → Sắp đến → Đã đến/Đang chụp → Đã chụp → Hoàn thành; nhánh Đã hủy khi áp dụng.
- **Trạng thái chỉnh sửa ảnh:** Chờ khách chọn ảnh → Chờ xử lý → Đang thực hiện → Hoàn thành. (Đã bỏ bước "Chờ QC" riêng — 2026-09-19, người dùng xác nhận quy trình thật của Thợ ảnh chỉ 3 bước: xác nhận yêu cầu → đang sửa ảnh → tải ảnh đã sửa lên là hoàn thành, tự kiểm tra chất lượng trong lúc sửa chứ không qua một vai trò QC riêng duyệt trước khi hoàn thành. Trước đó tài liệu này ghi có bước QC riêng do tham khảo mô tả lý tưởng hoá trong `workflow.md`/`design.md`, nay đã sửa cho khớp thực tế — xem `workflow.md` mục "Chọn & chỉnh sửa ảnh".)
- **Trạng thái phễu khách hàng (CRM):** Khách quan tâm → Đã tư vấn → Đã đặt lịch → Đã chụp → Hoàn thành; nhánh rẽ: Không quan tâm.

Số liệu dashboard/phễu phải giảm dần hợp lý qua từng trạng thái và nhất quán với các thẻ chỉ số — không để trạng thái sau có số liệu lớn hơn trạng thái trước (ví dụ lỗi thực tế cần tránh: `design.md`).

## Cấu hình chưa xác định (không tự đặt số)

Các thông số sau **chưa được xác định** trong tài liệu nghiệp vụ — coi là cấu hình cần business xác nhận trước khi hard-code hoặc thiết kế UI phụ thuộc vào giá trị cụ thể:

- Mức cọc (số tiền hoặc phần trăm).
- Thời gian giữ khung giờ trước khi cọc.
- Thời hạn cho phép dời lịch ("trong hạn" là bao nhiêu ngày/giờ trước buổi chụp).
- Số lần khách được dời lịch miễn phí.
- Chính sách hoàn cọc (khi hủy, khi dời quá hạn).
- Số lần chỉnh sửa ảnh miễn phí cho khách.
- Thời hạn lưu trữ ảnh trước khi chuyển archive.
- Số ảnh chỉnh sửa mặc định theo từng gói dịch vụ.
- Đơn giá mỗi ảnh chỉnh sửa vượt gói.

Khi triển khai, để các giá trị này ở dạng cấu hình/settings, không hard-code, và đánh dấu rõ trong code/UI rằng giá trị là placeholder chờ xác nhận.

## Phạm vi chưa chốt

Khác với mục trên (giá trị số chưa xác định), đây là các **tính năng** chưa được xác nhận có triển khai hay không trong dự án này — không tự ý code cho đến khi được xác nhận phạm vi:

- Module theo dõi trạng thái in ấn/thành phẩm (khâu 8 trong `operations.md`: dàn trang album, in thử soi màu, ép gỗ, đóng khung) — hiện chỉ là đề xuất từ phía studio, chưa nằm trong yêu cầu chính thức.
