---
name: implement-business-feature
description: Quy trình chuẩn khi xây dựng một tính năng mới liên quan đến CRM, đặt lịch/dời lịch, hoặc quản lý/chỉnh sửa ảnh cho dự án ALOHA Baby, đảm bảo nhất quán với business rules đã định nghĩa. Dùng skill này trước khi bắt đầu code một tính năng thuộc các nhóm trên.
---

# Implement Business Feature — ALOHA Baby

Quy trình khi triển khai một tính năng chạm vào CRM, booking/dời lịch, hoặc ảnh:

1. **Đọc rule liên quan trước khi code:** giao diện/UI → `rules/design.md`; quy trình nghiệp vụ (booking, dời lịch, ảnh, automation) → `rules/workflow.md`; data model, status enum, cấu hình → `rules/tech-defaults.md`.
2. **Trước khi đổi một khái niệm dùng chung** (status, field CRM, tham số cấu hình) → chạy agent `researcher` để rà soát mọi nơi đang phụ thuộc vào nó, tránh phá vỡ tính nhất quán giữa hai phân hệ.
3. **Tái sử dụng, không tạo mới:** dùng lại status enum và các field hồ sơ CRM đã định nghĩa trong `rules/tech-defaults.md`.
4. **Kiểm tra mục "Cấu hình chưa xác định" trong `rules/tech-defaults.md`** trước khi cần một con số nghiệp vụ (mức cọc, thời gian giữ chỗ...). Nếu chưa xác định: implement dưới dạng config/setting, đánh dấu rõ là placeholder, không tự chọn số cố định, và nêu rõ điều này khi báo cáo lại cho người dùng.
5. **Nếu tính năng đụng đến ảnh khách hàng:** áp dụng phần "Quyền riêng tư" trong `rules/workflow.md`.
6. **Nếu tính năng đụng đến nhiều module:** rà soát các module liên quan trước khi coi task là xong.
7. **Trước khi báo hoàn thành:** chạy agent `reviewer` để rà soát checklist nhất quán nghiệp vụ.
8. **Không tự thêm phạm vi ngoài yêu cầu**, không đổi kiến trúc nếu không có lý do kỹ thuật rõ ràng.
