# Google Drive: ảnh gốc công khai theo liên kết

Quyết định của người dùng ngày **2026-10-29**: thư mục ảnh gốc đặt **“Bất kỳ ai có đường liên kết đều xem được”**. Đây là ngoại lệ có chủ đích với quy tắc riêng tư ảnh gốc: dùng link dài khó đoán, không index và không đưa vào trang/danh mục công khai. Người có liên kết vẫn xem được ảnh. Khách không cần đăng nhập Google; thợ không chia sẻ riêng cho email khách.

1. Bật Google Drive API trong Google Cloud, tạo API key và giới hạn key cho Drive API.
2. Đặt `GOOGLE_DRIVE_API_KEY` trong môi trường máy chủ (Render), rồi khởi động lại. Key chỉ ở máy chủ, không đặt vào HTML/JS trình duyệt.
3. Thợ chọn buổi chụp đã hoàn tất do mình phụ trách, dán link thư mục. Ảnh phải nằm trực tiếp trong thư mục đó.
4. `GET /api/edit-requests/drive-folder?url=...` cho Thợ ảnh/Sếp xem trước. `POST /api/edit-requests/albums` tự đọc lại Drive và bỏ qua `photos` của trình duyệt. Khách và mã đơn lấy từ đơn Sale.
5. Khách mở “Ảnh của tôi”, chọn ảnh, tích yêu cầu và nhập ghi chú. Thumbnail công khai dùng `sz=w1000`, xem lớn dùng `sz=w2000`; không có bước OAuth cho ảnh gốc.

Máy chủ đọc Drive API v3 files.list, sắp theo tên, phân trang 1.000 ảnh/trang, tối đa 2.000 ảnh, timeout tổng 10 giây; truyền resource key của thư mục nếu có. `GOOGLE_DRIVE_API_BASE` mặc định https://www.googleapis.com; chỉ đổi cho máy chủ Google giả trong test. Thiếu key, thư mục không truy cập được, thư mục rỗng và lỗi mạng đều báo lỗi, không tạo album giả.

Picker đính kèm chat là tính năng riêng, tùy chọn. Chỉ khi `window.AlohaDriveConfig` đủ clientId, apiKey, appId thì nút “Chọn ảnh từ Drive” xuất hiện; Picker vẫn dùng OAuth drive.file. Luồng ảnh gốc không cần cấu hình trình duyệt này.

Đồng bộ máy chủ mặc định bật. `?editSync=0` lưu lựa chọn tắt trên trình duyệt, `?editSync=1` xóa lựa chọn tắt. Chế độ local vẫn cần máy chủ để đọc Drive, và dữ liệu local không đồng bộ giữa máy.

Bản demo nhiều máy (người dùng chốt 2026-10-29) đặt `EDIT_REQUESTS_ALLOW_PUBLIC_DEMO_STAFF=1` trên Render; khi studio dùng thật thì bỏ. Thợ demo 0900000003 đã có trong seed nhân sự; seed nhân sự không tạo tài khoản đăng nhập mới. Không thay đổi cơ chế chặn tài khoản demo.

MongoDB riêng EDIT_REQUESTS_MONGODB_URI giữ dữ liệu qua lần khởi động máy chủ; thiếu URI thì dữ liệu chỉ ở RAM. Các instance máy chủ cần cơ chế giao dịch/unique constraint dùng chung để bảo đảm khóa tạo lượt giữa instance.

Giá khách: lượt đầu miễn 10 ảnh, thêm 50.000đ/ảnh; lượt sau 50.000đ/ảnh và lượt trước phải hoàn tất. API kiểm tra ảnh thuộc manifest của đúng khách/đơn. Link resultLinkOriginal nội bộ của yêu cầu cũ vẫn không trả cho khách.

Tham chiếu: https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list
