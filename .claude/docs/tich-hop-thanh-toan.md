# Tích hợp tự nhận diện thanh toán cọc (làm thật, khi có backend)

Hiện trạng (2026-09-26): bước Đặt cọc trong `#/dat-lich` đã **tự nhận diện** thanh toán nhưng chỉ là **mô phỏng phía trình duyệt**: `PaymentStatus.check()` trong `js/dat-lich.js` trả "đã nhận tiền" sau `PAYMENT_CONFIG.demoDetectMs` (8 giây), không kiểm tra tiền thật. Trang ghi rõ "Bản demo: mô phỏng". Tài liệu này ghi các bước để thay phần mô phỏng bằng xác nhận thật.

> Chi tiết API của bên thứ ba bên dưới ghi theo hiểu biết chung, **chưa kiểm chứng với tài liệu chính thức**. Đọc lại docs của PayOS/SePay/VNPay trước khi code.

## 1. Nguyên lý

Trình duyệt **không** tự biết tiền đã về. Luồng thật:

1. Khách quét QR / chuyển khoản với nội dung = mã đơn (`AB...`).
2. Ngân hàng hoặc cổng thanh toán gọi **webhook** về server của studio: "tài khoản vừa nhận X đồng, nội dung Y".
3. Server đối chiếu: nội dung chứa mã đơn đang chờ + số tiền ≥ tiền cọc → đánh dấu đơn **đã cọc**, lưu vào database.
4. Trang đặt lịch hỏi server định kỳ (`GET /api/payments/<mã đơn>/status`, 2 giây/lần, đúng như `payPollTimer` đang làm) hoặc nghe SSE/WebSocket → thấy `paid` thì hiện màn thành công.

Frontend đã viết sẵn theo đúng khuôn này: chỉ cần thay thân hàm `PaymentStatus.check()` bằng `fetch` và bỏ `demoDetectMs`.

## 2. Những thứ cần có trước (việc của studio + nhóm, chưa có)

- **Tài khoản ngân hàng thật của studio** (thay dòng "(minh hoạ, studio cập nhật)").
- **Chọn 1 dịch vụ nhận biến động số dư / cổng thanh toán**, gợi ý:
  - **SePay** hoặc **Casso**: theo dõi tài khoản ngân hàng hiện có, bắn webhook khi có giao dịch vào. Hợp với chuyển khoản VietQR thường.
  - **PayOS**: tạo link/QR thanh toán theo từng đơn, trả webhook có chữ ký. Mã đơn của PayOS phải là **số**, cần bảng ánh xạ với mã `AB...`.
  - **VNPay / MoMo / ZaloPay (cổng chính thức)**: cho thẻ và ví, có IPN (webhook) + returnUrl, cần đăng ký merchant, có hợp đồng.
- **Database** lưu đơn và trạng thái cọc. Render bản free không giữ file lâu dài, nên cần DB riêng (Postgres/Supabase/MongoDB Atlas...). **Stack chưa chốt**, người dùng quyết định.
- **Quyết định kiến trúc:** `server/` hiện chỉ phục vụ chatbot, "tách biệt hoàn toàn khỏi CRM/booking". Thêm thanh toán vào đó hay dựng server riêng là thay đổi kiến trúc, cần người dùng đồng ý.

## 3. API server cần thêm (gợi ý)

| Endpoint | Việc |
|---|---|
| `POST /api/bookings` | Tạo đơn khi khách bấm "Xác nhận đặt lịch": server sinh mã đơn (không để client tự sinh như bản demo), tính tiền cọc từ bảng giá phía server, lưu trạng thái `Chưa cọc`, giữ khung giờ. |
| `POST /api/payments/webhook` | Nhận webhook từ SePay/PayOS/VNPay. Xác thực, đối chiếu, cập nhật đơn thành đã cọc (lịch sang `Chờ xác nhận`). |
| `GET /api/payments/:orderCode/status` | Trả `{ status: 'pending' \| 'paid' \| 'expired', amount }` cho trang đặt lịch hỏi định kỳ. |

Frontend đổi `PaymentStatus.check`:

```js
async check(code) {
  const r = await fetch(`${API}/api/payments/${code}/status`);
  return r.ok ? r.json() : { status: 'pending' };
}
```

## 4. Bắt buộc về an toàn

- **Xác thực webhook:** kiểm tra chữ ký (PayOS: checksum key) hoặc API key trong header (SePay). Webhook không hợp lệ thì bỏ qua.
- **Không tin client:** số tiền cọc, mã đơn, trạng thái đều lấy từ server/DB, không lấy từ trình duyệt.
- **Đối chiếu đủ 3 điều:** đúng mã đơn đang chờ, đủ số tiền, giao dịch tiền vào (không phải tiền ra).
- **Chống xử lý trùng:** lưu mã giao dịch của ngân hàng, webhook gửi lại lần 2 thì không cộng lần 2.
- **Hết giờ giữ chỗ:** tiền về sau khi khung giờ đã nhả → không tự xác nhận lịch, chuyển Sale xử lý (hoàn cọc/chọn giờ khác theo chính sách, chính sách hoàn cọc **chưa chốt**, xem `rules/tech-defaults.md`).
- Khoá API/checksum để trong biến môi trường (`.env` trên Render), **không commit**.

## 5. Checklist khi làm thật

- [ ] Người dùng chốt: dịch vụ (SePay/PayOS/...), database, đặt API trong `server/` hay server mới.
- [ ] Studio cung cấp tài khoản ngân hàng + đăng ký dịch vụ, lấy API key/checksum key.
- [ ] Viết 3 endpoint ở mục 3 + bảng đơn trong DB.
- [ ] Đổi `PaymentStatus.check()` sang `fetch`, xoá `demoDetectMs` và dòng "Bản demo: mô phỏng..." trong `setPayStatus()`.
- [ ] Thay QR minh hoạ `fakeQrSvg()` bằng QR thật (VietQR theo số tài khoản + số tiền + nội dung, hoặc QR do PayOS trả về).
- [ ] Test bằng giao dịch thật số tiền nhỏ + test webhook giả mạo (sai chữ ký phải bị từ chối).
- [ ] Cập nhật `_screenshots/test-booking-required.js`: các case tự nhận diện hiện dựa vào mô phỏng 8 giây.
