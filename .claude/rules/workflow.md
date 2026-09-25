# Workflow — ALOHA Baby

## Đặt lịch & Đặt cọc

Lịch chỉ chính thức khi đã cọc; trước khi cọc, khung giờ chỉ giữ tạm trong thời gian ngắn (độ dài: `tech-defaults.md`). Dùng một chuẩn dữ liệu chung cho khách tự đặt online và khách đặt qua hotline/inbox (nhân viên nhập hộ).

**Luồng (đủ bước, có Đặt cọc sau bước xác nhận):** Trang chủ/Dịch vụ/Concept/nút Đặt lịch → Đăng nhập/Đăng ký → Tạo hồ sơ CRM → (1) Chọn dịch vụ & gói → (2) Chọn concept hoặc "Cần studio tư vấn" → (3) Chọn ngày & khung giờ → (4) Nhập thông tin bé & xác nhận → (5) Đặt cọc → Đặt lịch thành công → Sales xác nhận → Điều phối phân công → Nhắc lịch.

**Chọn ngày giờ:** chỉ hiện khung giờ còn trống, khung giờ kín hiển thị mờ; tính đến phòng, photographer, makeup, thời lượng dịch vụ; newborn cần thời gian đệm. Ví dụ minh họa khung giờ trong ngày: 08:00, 09:30, 11:00, 13:30, 15:00, 16:30 (số lượng/mốc giờ cụ thể tùy cấu hình studio, không phải giá trị cứng).

**Real-time (bắt buộc):** trạng thái khung giờ phải cập nhật tức thời cho mọi khách đang xem cùng lúc, không cần tải lại trang — nếu khách A vừa giữ/đặt một khung giờ, khách B đang xem cùng ngày phải thấy khung đó chuyển sang "đang giữ"/"đã đầy" ngay, không có độ trễ đủ lâu để B vẫn bấm chọn được khung đã mất. Đây là yêu cầu chống double-booking ở tầng giao diện, bổ sung cho cơ chế khóa dữ liệu ở tầng backend (`tech-defaults.md`). Bản demo trên site tĩnh hiện tại mô phỏng bằng JS phía client (không có backend thật) — xem ghi chú trong `tech-defaults.md`.

**Form thông tin (bước 4) bắt buộc:** dịch vụ, gói, concept, ngày, giờ, ngày sinh/dự sinh của bé, số người trong ảnh, lưu ý sức khỏe, ghi chú. Validate đủ trường trước khi sang bước cọc; tự tính tuổi bé tại ngày chụp nếu đủ dữ liệu; cấp mã đơn duy nhất (dùng xuyên suốt, kể cả đặt tên folder ảnh gốc ở khâu chụp).

**Đặt cọc (bước 5):** QR chuyển khoản/ví điện tử chứa đúng số tiền + nội dung theo mã đơn, có đếm ngược giữ khung giờ, mức cọc là tham số cấu hình (không hard-code). Thất bại/hết giờ giữ → nhả khung giờ, lịch về trạng thái chưa cọc, khách thanh toán lại được nếu khung giờ còn trống.

**Đặt lịch hộ qua hotline/inbox:** Sales/CSKH tạo hồ sơ khách (ghi nguồn) rồi tạo lịch hộ theo đúng bước 1–4 trong Admin; hệ thống gửi link/QR đặt cọc qua Zalo hoặc SMS cho khách. Khách cọc xong thì đơn tiếp tục quy trình như đặt online — cùng một chuẩn dữ liệu, không tách luồng riêng.

**Xử lý nội bộ sau khi có cọc (lịch chuyển Sắp đến):**
1. Sales/CSKH đối soát cọc, gọi xác nhận lại thông tin bé và concept.
2. Điều phối gán photographer, makeup, stylist, phòng chụp.
3. Hệ thống tự sinh checklist chuẩn bị (concept, trang phục theo tuổi bé, số người) gửi cho Concept/Stylist — không cần Sales truyền tay lại thông tin đã nhập ở bước 4.
4. Hệ thống tự nhắc lịch cho khách trước 1–2 ngày.
5. Trợ lý/Photographer check-in khách, chuyển trạng thái Đã đến/Đang chụp → Đã chụp khi kết thúc buổi.

## Dời lịch

Khách vào Quản lý lịch hẹn → Đổi lịch hẹn. Hệ thống kiểm tra thời gian còn lại trước buổi chụp, số lần đã dời, chính sách hiện hành (ngưỡng: `tech-defaults.md`). Khách chọn ngày/khung giờ mới (chỉ hiện khung giờ trống phù hợp dịch vụ) và lý do (bé ốm, sinh sớm/muộn, bận việc, khác). Giao diện phải hiển thị: lịch cũ, lịch mới, khung giờ, lý do dời, trạng thái/điều kiện duyệt.

- **Trong hạn:** nhả lịch cũ → giữ lịch mới → chuyển cọc sang lịch mới → về trạng thái Chờ xác nhận → cập nhật thông báo.
- **Quá hạn:** tạo yêu cầu Chờ duyệt dời lịch — **Sales/CSKH duyệt**, sau đó **Điều phối phân công lại ekip**; giữ nguyên lịch cũ đến khi duyệt; có thể áp phụ phí/mất cọc theo chính sách cấu hình.
- **Studio chủ động dời:** đề xuất 1–3 khung giờ thay thế, khách chọn; không tính vào số lần dời của khách, không áp phụ phí.
- Lưu lịch sử dời lịch trong CRM cho mọi trường hợp.

## Chọn & chỉnh sửa ảnh

Photographer tải ảnh gốc (gắn mã đơn) → Khách xem "Ảnh của tôi" → thả tim chọn ảnh → gửi yêu cầu chỉnh sửa → Chờ xử lý → Thợ ảnh (Retoucher) thực hiện, tự kiểm tra chất lượng ảnh trong lúc sửa → tải ảnh đã sửa lên là Hoàn thành → Khách nhận ảnh. (Không qua bước "Chờ QC" do một vai trò riêng duyệt — 2026-09-19, người dùng xác nhận quy trình thật chỉ 3 bước, xem `tech-defaults.md` mục Status System.)

- Khách lọc ảnh theo buổi chụp, theo dõi số ảnh đã chọn so với gói; vượt gói → hiển thị phí mua thêm, báo Sales.
- Yêu cầu chỉnh sửa có thể là chung hoặc riêng cho từng ảnh (làm da sáng, xóa vết chàm, ghép người vắng mặt...). Gửi yêu cầu → khóa danh sách ảnh đã chọn, tạo việc ở trạng thái Chờ xử lý.

**Giao diện chọn ảnh (bắt buộc có các thành phần sau):**
- Lưới ảnh gốc của buổi chụp, mỗi ảnh có nút thả tim để chọn/bỏ chọn — thao tác chọn phải phản hồi ngay (không cần submit mới thấy cập nhật).
- Bộ đếm luôn hiển thị: "Đã chọn X / Y ảnh" (Y = số ảnh trong gói đã mua), dạng thanh tiến trình.
- Khi X > Y: hiển thị rõ số ảnh vượt gói và phí phát sinh tương ứng (số ảnh vượt × đơn giá/ảnh vượt gói — đơn giá là cấu hình, xem `tech-defaults.md`), không chỉ báo chung chung "có phí thêm".
- Nút gửi yêu cầu chỉnh sửa chỉ bật khi đã chọn ít nhất 1 ảnh; sau khi gửi, khóa toàn bộ lựa chọn (không cho bỏ chọn ảnh đã gửi) đúng theo luồng ở trên.
- Thợ ảnh tự kiểm tra 100% file trước khi tải lên (màu da, đường thẳng, lỗi hình ảnh) — không qua bước duyệt riêng của một vai trò QC khác trước khi chuyển Hoàn thành (đã bỏ, xem ghi chú ở luồng phía trên).
- Khách nhận ảnh: xem/tải bản web; tải bản in nếu đủ điều kiện (cân nhắc gắn điều kiện với đã thanh toán đủ phần còn lại, khớp khâu thu nốt tiền); yêu cầu chỉnh lại trong số lần cho phép (`tech-defaults.md`). Ảnh lưu trữ trong thời hạn quy định (`tech-defaults.md`); hệ thống hiển thị dung lượng đã dùng; hết hạn chuyển archive phải báo trước cho khách tải về.

**Quyền riêng tư (bắt buộc trong toàn bộ luồng này):** ảnh trẻ em là dữ liệu nhạy cảm — chỉ xem được qua tài khoản chính chủ; studio chỉ đăng/dùng ảnh khi có văn bản đồng ý; không dùng link công khai không xác thực, không để search engine index, không để URL đoán được.

## Chatbot AI tư vấn

Widget chat nổi trên toàn bộ trang khách hàng, hỗ trợ tư vấn theo kịch bản trước khi khách vào luồng đặt lịch chính thức:

1. Chào hỏi, hỏi nhu cầu (chọn 1 trong 5 dịch vụ qua quick-reply, không bắt gõ tự do bước đầu).
2. Gợi ý concept phù hợp dịch vụ đã chọn (tái dùng dữ liệu concept trong `design.md`, không tạo kho concept riêng cho chatbot).
3. Báo giá theo dịch vụ/gói đã chọn (tái dùng bảng giá/gói đã cấu hình trong Admin, không hard-code giá trong kịch bản chat).
4. "Chốt đơn" — không tự chốt lịch/cọc ngay trong khung chat; dẫn khách sang đúng luồng "Đặt lịch & Đặt cọc" ở trên (bước 1 đã có sẵn dịch vụ/concept do chatbot gợi ý), để không tạo luồng đặt lịch song song.

**Ràng buộc:** mọi thông tin khách cung cấp qua chatbot (nhu cầu, SĐT nếu để lại) phải ghi vào cùng hồ sơ CRM — chatbot là một kênh nhập liệu, không phải nguồn dữ liệu riêng (**lưu ý:** phần trả lời tự do hiện gọi Gemini API thật qua `server/` (deploy trên Render), nhưng server đó chưa nối vào CRM nào — đây vẫn là việc cần làm khi có backend CRM thật, không tự coi là đã xong). Bước chọn dịch vụ/gợi ý concept vẫn là quick-reply/kịch bản dựng sẵn; khung nhập tự do là AI thật khi server chạy, AI lỗi thì trả lời cục bộ có ghi rõ "Trợ lý AI đang bận" — xem kiến trúc trong `tech-defaults.md`.

## Tự động hóa CRM

- Tự tạo hồ sơ khách khi đăng ký, đặt lịch, hoặc để lại số điện thoại; ghi nhận nguồn khách từ mã kênh quảng cáo.
- Nhắc Sales khi lead "Khách quan tâm" chưa được tư vấn sau một khoảng thời gian (cấu hình).
- Nhắc khách trước buổi chụp 1–2 ngày; nhắc mốc chụp tiếp theo dựa theo ngày sinh bé (100 ngày, 6 tháng, thôi nôi, sinh nhật...).
- Sau bàn giao: gửi lời mời đánh giá, gửi mẫu đồng ý sử dụng ảnh cho marketing.

## Git

Repo GitHub (`origin`), nhóm 3 người, quy trình **branch riêng + Pull Request** (cập nhật 2026-09-25):
- Mỗi người làm trên nhánh riêng (nhánh của người dùng chính: `Chungcook`), xong thì mở Pull Request vào `main`.
- `main` có branch protection: phải qua PR, checks phải pass (vd bản preview của Vercel), cần **1 approve** từ người có quyền Write khác tác giả. Admin có ô "bypass rules" dùng cho từng lần merge.
- Review PR: đọc tab **Files changed**, bấm thử link **Preview của Vercel** trong PR; muốn chạy test thì `git fetch` + `git switch <nhánh>` (commit hoặc `git stash` thay đổi đang dở trước khi đổi nhánh).
- Push lên `main` (qua merge PR) là GitHub Pages/Vercel/Render tự deploy lại, không cần cấu hình dashboard lại.
- Người dùng tự commit bằng công cụ riêng: luôn chạy `git status`/`git log` trước khi làm gì với Git.
- Claude KHÔNG tự commit/push/merge khi chưa được yêu cầu rõ ràng; không thao tác Git có nguy cơ mất dữ liệu (reset --hard, force push...); không bao giờ commit `server/.env`.
