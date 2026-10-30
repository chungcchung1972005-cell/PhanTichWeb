BÁO CÁO ALOHA Baby — 2026-10-29
ĐÃ CHẠY: triển khai mục 1–5 tại workspace; giữ các sửa đổi code chưa commit, không sửa .claude/CLAUDE.md hoặc server/.env, không commit/push.
File frontend sửa: js/drive.js, js/chon-anh.js, js/edit-sync.js, js/features.js, js/workflow-core.js.
File CRM sửa: crm/js/admin.js, crm/js/sale.js, crm/js/workflow-ui.js.
File server sửa/thêm: server/drive.js (mới), server/edit-requests.js, server/.env.example.
Tài liệu sửa: server/DRIVE-SETUP.md, server/WORKFLOW.md, server/DEPLOY.md.
Test sửa: _screenshots/test-workflow.js, test-workflow-api.js, test-workflow-ui.js, test-workflow-regressions.js, test-edit-sync.js, test-edit-sync-optin.js, test-env.js.
Test thêm: _screenshots/drive-fixture.js, test-drive-api.js, test-multidevice-demo.js.
Artifact: _screenshots/before-*.log, after-*.log; test-workflow-ui tự cập nhật workflow-worker-desktop.png.
1. Drive: API key chỉ ở server; đọc đủ trang, resourcekey, giới hạn 2.000 ảnh/10 giây, API_BASE cho test, lỗi tiếng Việt; preview có auth; POST albums bỏ qua photos client.
1. Khách dùng thumbnail w1000/w2000, bỏ OAuth ảnh gốc; Picker chỉ hiện khi đủ cấu hình; chế độ local thiếu server báo lỗi; tài liệu ghi ngoại lệ công khai 2026-10-29.
2. Thợ thấy thumbnail/tên gốc/nhãn editOptions/ghi chú/link đúng file; chép tên file từng dòng. Nối editOptions qua cả local và sync; server lọc đúng 5 nhãn, bỏ trùng.
3. editSync mặc định bật; ?editSync=0 nhớ key 0, ?editSync=1 xóa opt-out; cờ đặt sẵn ưu tiên. Giữ cơ chế chặn demo; cập nhật chú thích/tài liệu; danh sách thợ hiện tên và SĐT demo.
4. Thợ chỉnh theo thợ chụp khi trống hoặc trùng người cũ, giữ lựa chọn đổi tay; kiểm chứng qua UI với 2 thợ.
5. Seed Sale 5% mẫu mọi gói; sale-extra tính round(% × extraFee), ID theo request chống trùng; lọc sổ đúng người/vai trò; duyệt/chi vẫn cần khách trả đủ. UI Sale %, thợ cố định; giữ snapshot cũ.
KẾT QUẢ ĐÃ CHẠY — PASS/FAIL trước → sau (theo check/nhóm in log; test dừng sớm chỉ tính phần đã chạy):
| File trong _screenshots/ | Trước PASS/FAIL | Sau PASS/FAIL |
|---|---:|---:|
| test-workflow.js | 1/0 nhóm | 2/0 nhóm |
| test-workflow-api.js | 1/0 nhóm | 1/0 nhóm |
| test-workflow-regressions.js | 4/0 nhóm | 4/0 nhóm |
| test-edit-requests-api.js | 14/2 | 14/2 |
| test-edit-requests-store.js | 70/15 | 70/15 |
| test-edit-demo-accounts.js | 47/2 | 47/2 |
| test-edit-sync.js | 32/3 | 37/2 |
| test-edit-sync-optin.js | 10/4 | 11/4 |
| test-drive-api.js (mới) | — | 13/0 |
| test-multidevice-demo.js (mới, Chrome) | — | 3/0 nhóm |
| test-workflow-ui.js (chạy bổ sung, Chrome) | — | 1/0 nhóm |
Test mới chứng minh: Drive 2 trang/resourcekey/403/404/rỗng/thiếu key/timeout/ảnh giả; lưu 5 options; local offline; ẩn Picker. Luồng 3 browser context độc lập dùng API chung và Drive giả đã PASS.
Core test bổ sung: 5% gói + phí ảnh thêm, gọi lại không trùng, Sale chỉ thấy khoản mình, thợ không thấy khoản Sale kể cả trùng SĐT.
Test cũ đổi: workflow/UI kỳ vọng 100k → 75k; workflow-api dùng Drive giả vì server tự đọc; regressions/test-env đặt editSync=false cho local.
Test sync/optin đổi: kiểm tra default ON, opt-out 0/clear 1 và override; local đặt cờ rõ; payload thêm editOptions; số hàm AlohaData cập nhật 12→14. Không xóa/rút gọn test.
CHƯA XỬ LÝ: lỗi có sẵn trước sửa — API/store/demo/sync thiếu fixture album nguồn gây source_album_required và lỗi dây chuyền; optin còn mong hồ sơ/ảnh demo cũ. Các phần sau chỗ dừng chưa kiểm chứng.
ĐÃ CHẠY: Chrome không bị sandbox chặn; cú pháp 10 file JS và git diff --check đạt. Một lượt Node Windows lỗi đóng handle sau test-sync; chạy lại đã ra 37/39, không lặp lỗi native.
CHƯA KIỂM CHỨNG: Drive thật, key thật, Render, MongoDB thật và 3 thiết bị vật lý; test mới dùng RAM, Google giả và 3 browser context.
ĐOÁN: Không có kết luận triển khai thực tế từ fixture; cần cấu hình GOOGLE_DRIVE_API_KEY và EDIT_REQUESTS_ALLOW_PUBLIC_DEMO_STAFF=1 trên Render, thư mục công khai theo link. Chưa thay môi trường triển khai.
