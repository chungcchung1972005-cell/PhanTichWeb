# Operations — ALOHA Baby

Bối cảnh vận hành thực tế (offline) của studio — giải thích lý do các luồng trong `workflow.md`/`design.md` được thiết kế như vậy. Đây là ngữ cảnh nghiệp vụ, không phải chỉ dẫn kỹ thuật.

## 9 khâu vận hành hiện tại

Một đơn chụp đi qua 9 khâu nối tiếp nhau, đầu ra khâu trước là đầu vào khâu sau:

1. **Marketing/Content** — chạy fanpage, TikTok, ảnh mẫu, hợp tác bệnh viện/spa bầu → tạo lead. Khó khăn: lead rải rác nhiều kênh, khó tính chi phí/đơn.
2. **Sales/CSKH** — tư vấn gói, báo giá, chốt cọc, ghi nhận thông tin bé/concept/số người/sức khỏe → phiếu đơn hàng. Khâu dễ vỡ nhất: sai thông tin ở đây thì cả dây chuyền sau sai theo.
3. **Điều phối/Sản xuất** — xếp lịch phòng, ghép ekip (photographer, makeup, stylist), nhắc khách trước 1–2 ngày. Khó khăn: dễ trùng giờ, dời lịch phải sửa tay nhiều nơi.
4. **Concept/Stylist & kho đạo cụ** — set bối cảnh, chọn trang phục theo size bé, tiệt trùng đồ chạm da bé, chuẩn bị nhiệt độ phòng newborn. Khó khăn: phụ thuộc checklist truyền tay, dễ thiếu thông tin.
5. **Buổi chụp** — makeup, chụp, trợ lý giữ an toàn bé → backup ảnh ra ổ cứng/NAS. Khó khăn: mã đơn không thống nhất gây khó tìm file.
6. **Chọn ảnh (culling)** — lọc ảnh lỗi, khách chọn ảnh trong gói, Sales upsell thêm ảnh/album. Khó khăn: khách gửi danh sách qua tin nhắn, dễ nhầm tên file.
7. **Hậu kỳ — Retoucher + QC** — chỉnh màu/da bé/phông, ghép ảnh, QC soi 100% file trước khi giao. Khó khăn: khách và studio không nắm được tiến độ chỉnh sửa.
8. **In ấn & thành phẩm** — dàn trang album, in thử soi màu, ép gỗ, đóng khung, photobook; có thể thuê ngoài. Khó khăn: tiến độ nhà in theo dõi rời rạc. *(Chưa có module số hóa chính thức — xem "Phạm vi chưa chốt" trong `tech-defaults.md`.)*
9. **Bàn giao & sau bán** — giao ảnh/album, thu nốt tiền, xin review và văn bản đồng ý dùng ảnh, lưu trữ, nhắc mốc chụp tiếp theo. Khó khăn: dữ liệu khách cũ không được khai thác, dễ quên nhắc mốc.

## Khâu nào được số hóa bằng module nào

| Khâu | Module số hóa |
|---|---|
| 1. Marketing | Trang công khai + CRM ghi nhận nguồn (`tech-defaults.md`) |
| 2. Sales/CSKH | CRM + Đặt lịch & cọc online (`workflow.md`) |
| 3. Điều phối | Lịch hẹn + Dời lịch (`workflow.md`) |
| 4. Concept/Stylist | Checklist chuẩn bị tự sinh từ đơn, kho concept (`workflow.md`, `design.md`) |
| 5. Buổi chụp | Mã đơn thống nhất, cập nhật trạng thái buổi chụp (`tech-defaults.md`) |
| 6. Chọn ảnh | "Ảnh của tôi" — thả tim chọn ảnh (`workflow.md`) |
| 7. Hậu kỳ | Quản lý chỉnh sửa ảnh + QC (`workflow.md`) |
| 8. In ấn | Chưa có module chính thức — đề xuất, chưa chốt (`tech-defaults.md`) |
| 9. Bàn giao & sau bán | Nhận ảnh, thanh toán phần còn lại, CRM tự nhắc mốc tiếp theo (`workflow.md`) |
