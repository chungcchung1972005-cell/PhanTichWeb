# Deploy chatbot AI lên internet (để mọi thiết bị dùng được)

Ghi chú nội bộ, không phải nội dung khách hàng thấy. Mục tiêu: đưa `server/server.js`
lên một địa chỉ public (không còn `localhost`) để chatbot AI hoạt động từ bất kỳ máy
tính/điện thoại nào, không chỉ máy đang chạy server.

Code đã chuẩn bị sẵn (xong phần Claude làm được):
- `js/script.js`: tự nhận biết đang mở local (file:// hoặc localhost) hay đã public,
  chọn đúng địa chỉ server tương ứng (`CHAT_API_URL`).
- `server/server.js`: CORS đọc từ biến môi trường `ALLOWED_ORIGINS`, mặc định mở cho
  mọi nơi nếu chưa đặt (chỉ chấp nhận được khi test local).

Phần dưới đây **cần bạn tự làm** vì phải đăng nhập tài khoản riêng (GitHub, Render).

## Bước 1 — Đẩy code lên GitHub (nếu chưa)

Repo đã có remote GitHub (`chungcchung1972005-cell/PhanTichWeb`). Chỉ cần đảm bảo
nhánh `main` đang có bản mới nhất:
```
git add -A
git commit -m "Chuẩn bị deploy"
git push
```
(Bạn tự commit theo cách bạn vẫn làm — Claude không tự ý commit/push nếu không được yêu cầu.)

## Bước 2 — Deploy server chat lên Render (miễn phí)

1. Vào https://render.com, bấm "Get Started" và đăng nhập bằng tài khoản GitHub của bạn.
2. Sau khi vào Dashboard, bấm **New +** (góc trên phải) → chọn **Web Service**.
3. Chọn **Build and deploy from a Git repository**, bấm **Next**, chọn kết nối tới
   repo `PhanTichWeb` (nếu chưa thấy repo, bấm "Configure account" để cấp quyền cho
   Render truy cập repo đó).
4. Điền cấu hình:
   - **Name:** tuỳ bạn đặt, ví dụ `aloha-baby-chat` (tên này sẽ nằm trong URL).
   - **Root Directory:** `server`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** chọn **Free**.
5. Kéo xuống mục **Environment Variables**, bấm **Add Environment Variable**, thêm:
   - `GEMINI_API_KEY` = khoá API Gemini thật của bạn (lấy tại
     https://aistudio.google.com/apikey — nên tạo khoá MỚI, đừng dùng lại khoá cũ đã
     từng dán vào khung chat lúc test).
   - `GEMINI_MODEL` = `gemini-3.1-flash-lite` (không bắt buộc, server tự dùng giá trị
     này nếu bỏ trống).
   - `ALLOWED_ORIGINS`: **để trống ở bước này**, sẽ quay lại điền sau khi có URL
     frontend ở Bước 3.
6. Bấm **Create Web Service**. Render sẽ build và chạy tự động, mất khoảng 1-2 phút.
7. Khi trạng thái chuyển sang **Live**, bạn sẽ thấy 1 URL dạng
   `https://aloha-baby-chat-xxxx.onrender.com` ở đầu trang. **Copy URL này lại.**
8. Kiểm tra nhanh: mở `https://<url-của-bạn>/api/health` trên trình duyệt, phải thấy
   `{"ok":true,"hasKey":true}`. Nếu `hasKey:false` thì quay lại bước 5 kiểm tra đã điền
   đúng `GEMINI_API_KEY` chưa.

   Lưu ý gói Free của Render: server sẽ "ngủ" sau ~15 phút không có ai gọi tới, lần gọi
   đầu tiên sau đó có thể mất 30-60 giây để "thức dậy" — bình thường, không phải lỗi.

## Bước 3 — Deploy trang web (frontend) lên GitHub Pages (miễn phí)

1. Vào repo trên GitHub: https://github.com/chungcchung1972005-cell/PhanTichWeb
2. Vào tab **Settings** → mục **Pages** (menu bên trái).
3. Ở **Build and deployment** → **Source**, chọn **Deploy from a branch**.
4. **Branch:** chọn `main`, thư mục chọn `/ (root)` (vì `index.html` đang nằm ở gốc repo).
5. Bấm **Save**. Đợi khoảng 1-2 phút, tải lại trang Settings → Pages sẽ thấy dòng
   "Your site is live at `https://chungcchung1972005-cell.github.io/PhanTichWeb/`".

## Bước 4 — Báo lại cho Claude 2 địa chỉ vừa có

Sau khi xong Bước 2 và 3, nhắn lại cho Claude:
- URL server (Bước 2), ví dụ `https://aloha-baby-chat-xxxx.onrender.com`
- URL trang web (Bước 3), ví dụ `https://chungcchung1972005-cell.github.io/PhanTichWeb/`

Claude sẽ tự làm nốt phần code còn lại:
- Điền URL server thật vào `PROD_CHAT_API_URL` trong `js/script.js` (đang để giá trị
  giữ chỗ `REPLACE-WITH-YOUR-RENDER-URL`).
- Điền URL trang web vào biến môi trường `ALLOWED_ORIGINS` trên Render (khoá CORS lại,
  chỉ cho đúng website của bạn gọi vào server, không cho web khác gọi ké).
- Commit lại code, bạn chỉ cần push và chờ Render/GitHub Pages tự deploy lại
  (khoảng 1-2 phút mỗi bên).

## Sau này muốn cập nhật code

- Sửa code → `git push` → GitHub Pages tự cập nhật frontend, Render tự deploy lại
  server (nếu file trong `server/` có thay đổi). Không cần làm lại các bước trên.

## Thanh toán tự động qua SePay (phí ảnh chọn thêm ngoài gói)

Khi khách chọn quá 10 ảnh, trang "Ảnh của tôi" hiện mã QR chuyển khoản kèm một
**mã thanh toán riêng** trong nội dung CK (vd `AB240915CS2GB6C`). Ngân hàng báo
tiền về → SePay gọi `POST /api/sepay-webhook` của server này → trang của khách
hỏi `GET /api/payment-status` mỗi 4 giây, thấy đủ tiền là **tự gửi ảnh tới Thợ
ảnh**. Chưa thanh toán thì ảnh không được gửi đi.

1. Đăng ký tại <https://my.sepay.vn>, vào **Ngân hàng → Kết nối tài khoản**, liên
   kết đúng tài khoản nhận tiền của studio (trong code đang để MB Bank
   `0967237146`, tên `ALOHA BABY STUDIO`; đổi ở `js/chon-anh.js`, hàm
   `openQrPaymentModal`, nếu tài khoản thật khác).
2. Vào **Tích hợp WebHooks → Thêm webhook**:
   - URL: `https://phantichweb.onrender.com/api/sepay-webhook`
   - Sự kiện: **Có tiền vào**
   - Kiểu chứng thực: **API Key**, tự đặt một chuỗi bí mật dài (vd 32 ký tự ngẫu nhiên).
3. Trên Render → service → **Environment** → thêm biến `SEPAY_WEBHOOK_KEY` = đúng
   chuỗi vừa đặt ở bước 2 → Save (Render tự khởi động lại server).
4. Kiểm tra: `https://phantichweb.onrender.com/api/health` phải có `"hasSepayKey":true`.

**Thử mà không cần chuyển tiền thật** (giả lập đúng request SePay gửi; đổi KEY,
mã và số tiền cho khớp mã QR đang hiện trên trang):

```powershell
Invoke-RestMethod -Method Post -Uri https://phantichweb.onrender.com/api/sepay-webhook `
  -Headers @{ Authorization = "Apikey KEY_CUA_BAN" } -ContentType "application/json" `
  -Body '{"id":"thu-1","transferType":"in","transferAmount":100000,"content":"AB240915CS2GB6C"}'
```

**Giới hạn cần biết:**
- Server không có database: giao dịch nhận được chỉ lưu trong bộ nhớ. Render free
  "ngủ" sau ~15 phút không có request thì mất lịch sử này. Trong lúc khách đang
  chờ thanh toán, trang gọi server mỗi 4 giây nên server không ngủ.
- Mã QR có hạn 30 phút. Khách chuyển khoản **sau khi mã hết hạn** thì trang không
  tự gửi ảnh nữa, Sale cần đối soát tay trên SePay.
- Yêu cầu chỉnh sửa vẫn lưu bằng localStorage như cũ: Thợ ảnh chỉ thấy khi dùng
  chung trình duyệt với khách (giới hạn chung của bản demo, chưa có backend CRM).

## Chat thật Khách <-> Sale (MongoDB Atlas) — thêm 2026-09-27

Khách nhắn từ màn chat trên web (`#/chat-sale`), mọi tài khoản Sale trả lời trong
`crm/admin.html` mục **Tin nhắn**, khác máy/khác trình duyệt vẫn thấy nhau (trang tự
hỏi server tin mới vài giây một lần). Đăng nhập được kiểm tra ở server
(`server/sale-chat.js`), khách chỉ đọc được tin của chính mình.

Tin nhắn + tài khoản khách đăng ký lưu ở **MongoDB Atlas**. Chưa cài thì server vẫn
chạy nhưng lưu tạm trong bộ nhớ: Render ngủ/deploy lại là **mất hết tin nhắn**.

> Các bước Atlas dưới đây viết theo hiểu biết của Claude, **chưa kiểm chứng lại trên
> giao diện Atlas hiện tại** - tên nút có thể khác đôi chút. Gói miễn phí và giới hạn
> của nó hãy xem trực tiếp trên trang của MongoDB trước khi tạo.

1. Đăng ký tại <https://www.mongodb.com/cloud/atlas/register> → tạo **cluster gói
   miễn phí (M0)**, chọn vùng gần Việt Nam (vd Singapore).
2. **Database Access** → thêm user (vd `aloha`) + mật khẩu tự sinh (chỉ chữ và số cho
   dễ dán vào chuỗi kết nối). Quyền: *Read and write to any database*.
3. **Network Access** → *Add IP Address* → `0.0.0.0/0` (cho phép mọi nơi). Render bản
   miễn phí không có IP cố định nên phải mở như vậy; bảo vệ bằng user/mật khẩu ở bước 2.
4. **Connect → Drivers (Node.js)** → copy chuỗi dạng
   `mongodb+srv://aloha:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority`,
   thay `<password>` bằng mật khẩu ở bước 2.
5. Render → service → **Environment** → thêm:
   - `MONGODB_URI` = chuỗi ở bước 4
   - `AUTH_SECRET` = chuỗi bí mật dài ngẫu nhiên (tạo bằng
     `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
     **Không đổi chuỗi này sau khi đã dùng**, đổi là mọi người phải đăng nhập lại.
   - `ALLOWED_ORIGINS` phải có domain frontend thật (vd
     `https://ahola-baby.vercel.app,https://<ten>.github.io`) để trình duyệt gọi được API chat.
   → Save (Render tự khởi động lại).
6. Kiểm tra `https://phantichweb.onrender.com/api/health` có `"chatStore":"mongodb"`.
   Thử: 1 máy đăng nhập khách `0900000001/khach123` → bấm ảnh dịch vụ → nhắn; máy khác
   (hoặc cửa sổ ẩn danh) đăng nhập Sale `0900000002/sale123` → mục Tin nhắn → trả lời.

**Giới hạn cần biết:**
- Render free ngủ sau ~15 phút không có ai dùng; lần mở đầu tiên sau đó server cần vài
  chục giây để dậy (trang đăng nhập tự "đánh thức" server ngay khi mở, màn chat báo
  "Đang kết nối..." trong lúc chờ). Tin nhắn KHÔNG mất vì đã lưu ở Atlas.
- Tài khoản demo (mật khẩu công khai trên trang đăng nhập) chỉ để thử; trước khi dùng
  thật cần đổi sang tài khoản nhân viên thật (sửa `DEMO_ACCOUNTS` ở cả `login.html` và
  `server/sale-chat.js`).
- Chạy local: `npm start` trong `server/` (không cần Atlas, lưu tạm trong bộ nhớ), mở
  `index.html` từ máy là trang tự gọi `http://localhost:3001`.

## Đăng nhập bằng Google — thêm 2026-09-27

Khách bấm **"Đăng nhập bằng Google"** trên `login.html`. Lần đầu phải nhập số điện thoại một
lần (SĐT vẫn là mã khách dùng cho chat, hồ sơ, ảnh); lần sau chỉ cần bấm Google. SĐT đã có
tài khoản (đăng ký bằng mật khẩu) thì KHÔNG gắn Google vào được, để người khác không gõ SĐT
của bạn mà chiếm tài khoản. Tài khoản nội bộ (Sale/Thợ ảnh/Sếp) vẫn đăng nhập bằng SĐT + mật khẩu.

Chưa đặt `GOOGLE_CLIENT_ID` thì trang đăng nhập không hiện nút Google, mọi thứ khác chạy như cũ.

> Các bước Google Cloud dưới đây viết theo hiểu biết của Claude, **chưa kiểm chứng lại trên
> giao diện hiện tại** - tên menu có thể khác đôi chút.

1. Vào <https://console.cloud.google.com/> → tạo project mới (vd `ALOHA Baby`).
2. Menu **APIs & Services → OAuth consent screen** (giao diện mới tên **Google Auth Platform**):
   - Tên ứng dụng `ALOHA Baby`, email hỗ trợ + email liên hệ = Gmail của bạn.
   - Đối tượng (Audience / User type): **External**.
   - Không cần thêm scope (mặc định đã có email, profile). **Đừng tải logo lên**: có logo là
     Google bắt xét duyệt thương hiệu.
   - Mục **Audience → Publishing status**: bấm **Publish app** (chuyển sang *In production*).
     Để ở *Testing* thì chỉ những email bạn thêm vào "Test users" mới đăng nhập được.
3. Mục **Credentials → Create credentials → OAuth client ID** (hoặc **Clients → Create client**):
   - Application type: **Web application**.
   - **Authorized JavaScript origins** thêm đúng 2 dòng (không có `/` ở cuối, không có `/PhanTichWeb`):
     - `https://ahola-baby.vercel.app`
     - `https://chungcchung1972005-cell.github.io`
   - **Authorized redirect URIs**: để trống (nút Google mở cửa sổ nhỏ, không chuyển trang).
   - Bấm Create → copy **Client ID** (dạng `1234-abc.apps.googleusercontent.com`). Không cần Client secret.
4. Render → service → **Environment** → thêm `GOOGLE_CLIENT_ID` = Client ID ở bước 3 → Save.
5. Kiểm tra: mở `https://ahola-baby.vercel.app/login.html`, dưới nút Đăng nhập có chữ "hoặc"
   và nút Google. Bấm thử bằng một Gmail, nhập SĐT chưa từng đăng ký → vào màn chat với Sale.

**Giới hạn cần biết:**
- Mở `login.html` trực tiếp từ máy (`file://`) hoặc bản Preview của Vercel (domain khác) thì
  nút Google không chạy được, vì Google chỉ cho các domain đã khai báo ở bước 3.
- Mất tài khoản Google thì chưa có cách tự lấy lại (chưa có "quên mật khẩu"), Sale phải hỗ trợ tay.
- Facebook: chưa làm (người dùng chọn làm Google trước).
