Báo cáo đợt 1b | Chungcook, nền 8d63f37 | không commit/push hoặc sửa server/.env; CLAUDE.md có diff phát sinh ngoài tác vụ, giữ nguyên.
File sửa: css/pages.css, css/admin.css, js/chon-anh.js, crm/js/admin.js và 11 test đầu bảng; 6 test cuối bảng giữ nguyên.
Thêm: _screenshots/workflow-fixture.js; output/dot1b-* gồm runner, log trước/sau, ảnh, số đo, kiểm kê assert và báo cáo này.
A1: tên file và link gốc thành hai hàng riêng; token màu/bo góc sẵn có; link và tim tối thiểu 44px.
A2: giữ khối đếm nổi; cắt phần lưới cuộn dưới khối đếm, đặt scroll-margin theo chiều cao thực để tim hiển thị không bị khối đếm chắn.
A3: nút chép tên file dạng viên thuốc, viền hồng; hàng flex có gap; trạng thái nhỏ màu phụ.
A4: Drive dạng viên thuốc một dòng >=44px; filename xuống hàng riêng; tùy chọn chỉnh sửa có badge nền/viền hồng.
ĐÃ CHẠY: tuần tự đủ 17 file, 16 PASS và 1 FAIL ứng dụng; các lần sửa fixture/bộ chọn có chạy lại. Log: dot1b-before/after-<tên>.log.
Ảnh cuối: dot1b-customer-{1440,390}.png và dot1b-worker-{1440,390}.png; khách chọn 3 ảnh, khối đếm đã nổi; thumbnail dùng ảnh JPEG local qua interception.
Bảng: K = số dòng ✓/✗ thực chạy (lần trước có thể dừng sớm); A = số assert trong nguồn cho bộ không in từng bước. Tên đều có tiền tố test- và hậu tố .js.
| File | Bước trước → sau | Trước → sau |
|---|---:|---|
| edit-requests-api | 16K → 114K | FAIL → PASS |
| edit-requests-store | 85K → 85K | FAIL → PASS |
| edit-demo-accounts | 49K → 85K | FAIL → PASS |
| edit-sync | 39K → 64K | FAIL → PASS |
| edit-sync-optin | 15K → 29K | FAIL → PASS |
| edited-photos | 6K → 48K | FAIL → PASS |
| tho-anh | 4K → 40K | FAIL → PASS |
| customer-edit-sync | 2K → 39K | FAIL → FAIL |
| tho-anh-edit-sync | 4K → 34K | FAIL → PASS |
| sep-edit-sync | 1K → 29K | FAIL → PASS |
| e2e-edit-sync | 2K → 35K | FAIL → PASS |
| workflow | 30A → 30A | PASS → PASS |
| workflow-api | 33A → 33A | PASS → PASS |
| workflow-regressions | 2A → 2A | PASS → PASS |
| workflow-ui | 15A → 15A | PASS → PASS |
| drive-api | 27A → 27A | PASS → PASS |
| multidevice-demo | 16A → 16A | PASS → PASS |
Bảo toàn: dot1b-assert-counts.json đếm từng file trước/sau từ HEAD và workspace; không giảm check/assert nào, giữ kiểm link gốc, rev 409, vai trò và chặn demo công khai.
Đổi kỳ vọng optin A3: #AB240915 tự có → chờ thợ gửi ảnh; B12: “Chưa có buổi chụp” → “Chờ thợ gửi ảnh gốc”, do PR #33 dùng album được giao.
Optin B6: health.count 1 → 3 vì kho có 1 yêu cầu + 2 album; B3/B9 giữ mã #ABTN0103/0104 nhưng dữ liệu nay được chuẩn bị qua workflow, không tự sinh hồ sơ.
edit-sync, bước trang admin cuối: có thẻ ảnh khi kho trống → 0 thẻ; PR #33 bỏ tự ghép đơn minh họa vào danh sách thật.
tho-anh: worker tho1/“Thợ chỉnh 1” → SĐT 0900000003/“Thợ ảnh demo”; tho/sep/e2e-sync: nhãn yêu cầu và hoàn tất “Chưa phân công” → thợ được gán từ booking.
tho/sep-sync, các check thẻ #AB240701 kể cả lúc offline: có → không có, vì danh sách hiện chỉ trả yêu cầu thật; bộ lọc worker đổi selector theo SĐT.
edited-photos, check thẻ minh họa: ghi chú minh họa + không chat → fixture album thật + chat trống chỉ đọc, vẫn cấm form ghi của Sếp; loại thẻ minh họa đã bị bỏ.
Dữ liệu/bộ chọn: ph-* → drive-fixture-file-*; mã đơn theo fixture; chat p → div; khách chưa có album kiểm lưới rỗng/select khóa; chờ cuộn xong trước click, không bỏ kiểm kết quả.
LỖI APP GIỮ ĐỎ: customer-edit-sync 38/39; khi /me lỗi nhưng /albums/me thành công, showSourceAlbum() xóa class show của banner lỗi. Nút vẫn khóa nhưng lỗi bị ẩn; giữ nguyên check khóa nút + hiện lỗi.
ĐÃ ĐO: cả 4 màn scrollWidth = innerWidth (1440 hoặc 390); tim nhìn thấy 44×44, elementFromPoint trúng nút; nút chép ~47.6px, link Drive >=44px. Số đo: dot1b-visual-metrics.json.
ĐOÁN: không dùng suy đoán thay PASS; chưa kiểm MongoDB thật, Drive thật hoặc nhiều thiết bị vật lý. Test dùng RAM/FakeCollection và Drive HTTP fixture.
