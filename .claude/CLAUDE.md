# CLAUDE.md — ALOHA Baby

Bộ não trung tâm của dự án. Đọc trước mọi task. Chi tiết chuyên biệt nằm ở `.claude/rules/`, `.claude/agents/`, `.claude/skills/` — chỉ đọc file liên quan khi task thực sự chạm tới lĩnh vực đó.

## Project Overview

Website studio chụp ảnh **ALOHA Baby** (35 Lê Văn Thiêm, Thanh Xuân, Hà Nội — hotline 0938.125.222): nền tảng vận hành tích hợp CRM + đặt lịch/dời lịch + quản lý/chỉnh sửa ảnh, không phải website giới thiệu thuần túy. Hai phân hệ dùng chung một nguồn dữ liệu: **Phân hệ khách hàng** và **Phân hệ Admin/CRM** (Sales/CSKH, Điều phối, Photographer, Retoucher/QC, Quản lý).

Repo Git trên GitHub (`origin`), frontend public trên GitHub Pages + Vercel (`ahola-baby.vercel.app`), server chatbot trên Render. HTML/CSS/JS thuần, chưa có backend CRM/booking thật. Quy trình Git và cách làm việc với người dùng: xem "Ghi nhớ nhanh" ngay bên dưới.

## Ghi nhớ nhanh (đọc trước mỗi phiên, cập nhật 2026-09-29)

**Cách người dùng muốn Claude làm việc (áp dụng mặc định, không cần nhắc lại):**
- Sau mỗi lần sửa xong, tự mở trang web vừa sửa trong trình duyệt cho người dùng (yêu cầu ngày 2026-09-26).
- Câu hỏi dạng hỏi đáp/tư vấn ("làm sao để...", "sao nó lại...", "có nên...") -> **chỉ trả lời bằng chữ, KHÔNG tự sửa file/chạy thao tác** ("t hỏi m chỉ cần trả lời thôi, đừng làm"). Chỉ làm khi người dùng giao việc rõ ràng.
- **Không bịa, không đánh giá lạc quan.** Chưa kiểm chứng thì nói rõ là chưa kiểm chứng (từng bị hỏi "m có bịa thông tin không" khi báo model Gemini chạy ổn nhưng thực tế không).
- Trả lời tiếng Việt, ngắn gọn; thinking bằng tiếng Việt.
- Yêu cầu mới mâu thuẫn quyết định cũ -> hỏi 1 câu ngắn trước khi làm (vd: gate đăng nhập Album/Concept).
- Việc giao diện: làm xong phải test Puppeteer + chụp màn hình desktop/mobile, báo file đã sửa và cách thêm nội dung về sau.
- Ảnh/video stock (Pexels) phải xem bằng mắt trước khi dùng, ghi nguồn vào sources.json, trên trang ghi rõ "minh hoạ, không phải khách thật".
- Không commit/push khi chưa được yêu cầu; KHÔNG bao giờ commit `server/.env`.
- **KHÔNG nhắc đổi mật khẩu/key** (`GEMINI_API_KEY`, mật khẩu user MongoDB `chungcchung1972005_db_user`) dù từng lộ trong chat: người dùng chốt 2026-09-27 "không cần đổi, đừng nhắc lại nữa".

**Đầu mỗi phiên mới:** đọc "Việc cần làm tiếp theo" ngay bên dưới + chạy `git status`/`git log -3`; người dùng chỉ nói "làm tiếp" thì tóm tắt 2-3 việc đầu danh sách và hỏi làm việc nào (không tự làm việc cần người dùng quyết). Server chat local tắt khi đóng máy: cần thì `cd server && npm start` (không có `AUTH_SECRET` trong `server/.env` nên mỗi lần bật lại phải đăng nhập lại).

**Quy trình Git hiện tại:** làm trên nhánh riêng (của người dùng: `Chungcook`), gửi Pull Request vào `main`. `main` có branch protection: cần 1 approve từ người có quyền Write (tác giả không tự duyệt được; Admin có ô "bypass rules" dùng từng lần). Nhóm 3 người. Người dùng tự commit bằng công cụ riêng -> luôn `git status`/`git log` trước khi đụng Git.

**Quyết định đã chốt gần đây:** logo là wordmark chữ "aloha ♥ BABY STUDIO" (không dùng biểu tượng máy ảnh); khối đầu trang = "DỊCH VỤ" theo bố cục alohababy.vn (tiêu đề giữa, lưới ảnh 3 cột ô Bầu cao gấp đôi; đổi 2026-09-27. Từ 2026-09-29 BỎ dòng 5 dịch vụ dưới tiêu đề (người dùng chê xấu trên điện thoại), thay bằng 1 dòng mô tả; điện thoại xếp 4 ô ảnh đứng bằng nhau tỉ lệ 2:3 + Newborn cả hàng cuối), không có danh sách đánh số 01-05; album 3 tầng Dịch vụ -> Concept -> Ảnh (`js/albums.js`); tầng nội dung chi tiết `#/noi-dung/<slug>` (`js/content.js`); nội dung chi tiết xem công khai; **từ 2026-09-28: 5 ảnh + dòng dịch vụ đầu trang mở album `#/album/<dịch vụ>`, mọi album/concept xem CÔNG KHAI (kể cả 5 ảnh này — gate đăng nhập riêng ở `js/albums.js` đã GỠ theo yêu cầu người dùng, đảo lại quyết định cũ cùng ngày); chatbot AI BẬT LẠI: trang chủ máy tính tự mở (điện thoại: bong bóng lời chào), lời chào đổi theo album dịch vụ/concept đang xem, **khách vãng lai (chưa đăng nhập) chat được ngay, không bị đẩy sang đăng nhập** (đảo quyết định cũ cùng ngày "mọi nút trong khung chatbot đều bắt đăng nhập"); chatbot chủ động hỏi tuần tự 5 thông tin (tuổi/dự sinh, giới tính, cân nặng, concept quan tâm, lưu ý đặc biệt) rồi gợi ý album + giá tham khảo (`startLeadIntake` trong `js/script.js`); nút "Nhắn Sale" chuyển sang chat thật với Sale NGAY TRONG khung chatbot (**vẫn bắt đăng nhập** vì tin lưu theo SĐT trên server, không ẩn danh được), Sale nhận tin hệ thống tóm tắt khách đã xem/hỏi gì (kèm thông tin bé nếu có). Đăng nhập giờ chỉ còn bắt buộc khi: khách chủ động bấm nút "Đăng nhập" trên menu, chuyển sang chat thật với Sale, hoặc vào Đặt lịch/Ảnh của tôi. Đặt lịch còn TẠM TẮT bằng cờ `js/features.js`** (chỉ ẩn, code giữ nguyên để bật lại).

**Phiên 2026-09-28 đã làm (ĐÃ lên `main` qua PR #19, merge 28/09; chi tiết: `docs/changelog.md`):**
1. 5 ảnh + dòng dịch vụ đầu trang -> đăng nhập -> album dịch vụ -> concept -> ảnh; bật lại toàn bộ trang album.
2. Bật lại chatbot AI: tự mở ở trang chủ (máy tính) / bong bóng (điện thoại), lời chào đổi theo album dịch vụ/concept; "Nhắn Sale" chat tiếp với Sale ngay trong khung chatbot; Sale nhận tóm tắt hành trình khách (endpoint server mới `/me/handoff`, Render cần deploy lại khi merge). Test `test-chatbot-greeting` 18/18, `test-sale-chat` 52/52. Câu trả lời Gemini thật chưa kiểm lại trong phiên này.
3. Đổi ảnh bìa 5 ô Dịch vụ đầu trang chủ sang bộ ảnh Pexels tông sáng hồng kem: `images/services/<dịch vụ>.jpg` (+ `sources.json`), khai báo bằng trường `cover` trong `js/albums.js`; ảnh cũ `images/service-*.jpg` giữ cho album concept.

**Phiên 2026-09-29 đã làm (CHƯA commit/push; chi tiết từng lượt: `docs/changelog.md`):**
1. Khối Dịch vụ đầu trang: bỏ dòng 5 dịch vụ dưới tiêu đề (xấu trên điện thoại), tiêu đề "DỊCH VỤ" to hơn + 2 vạch hồng có chấm + dòng mô tả `.svc-sub`; điện thoại: 4 ô ảnh đứng bằng nhau tỉ lệ 2:3 (thấy trọn ảnh) + Newborn cả hàng cuối; sửa nhãn trên ảnh bị bóp hẹp (`width: max-content`).
2. Chuyển cảnh dùng chung (`js/router.js` `veilTo`): TỪ TRANG CHỦ vào album / trang nội dung / Ảnh của tôi = màn trắng hồng loang tròn từ chỗ bấm, giữa màn là tên trang, tan đi thì trang mới trồi lên; đi tiếp BÊN TRONG album/nội dung = chỉ trồi nhẹ (`.view-enter`); về Trang chủ / neo cuộn / trợ lý AI tự chuyển / chưa đăng nhập / giảm chuyển động = không hiệu ứng (người dùng: "thêm vào chỗ cần thiết, tránh spam").
3. Điện thoại: nút chatbot lắc nhẹ + vòng sóng hồng 5 giây/lần khi khung chat đang đóng (`css/style.css` `fabShake`/`fabRing`).
4. Đầu khung chatbot gọn 1 hàng: logo chữ "aloha♥" trắng + dòng trạng thái ("Trợ lý tư vấn" / "Đang chat với Sale") | nút "Nhắn Sale" (chế độ Sale: "Trợ lý AI"), nút gọi tròn, nút đóng; bỏ thanh "Nhắn Sale / Gọi" dưới thân khung, phần tin nhắn cao thêm ~60px.
5. Chatbot "khách bảo gì làm nấy" (đổi quyết định cũ, xem "Quyết định đã chốt"): server `/api/chat` trả thêm `do`; khách đòi gặp Sale/nhân viên/đặt lịch -> tự chuyển sang Sale; bảo mở album/trang -> tự mở; gõ "quay lại trợ lý AI" khi đang chat Sale -> về trợ lý. Nút "Trợ lý AI" ở chế độ Sale nổi bật (hồng đậm, viền trắng, nhấp nháy 3 lần). Đã thử Gemini thật 9/9 câu + trình duyệt thật 6/6.
Kiểm tra cuối phiên: cả 18 bộ test PASS sau mục 1-3; sau mục 4-5 chạy lại 8 bộ liên quan chatbot đều PASS. Test sửa theo: `test-service-albums` 134, `test-sale-chat` 52, `test-interest-gate` (chờ 900ms vì màn chuyển cảnh ~0.5s), `test-photos-chat` (nút gọi ở đầu khung chat).

**Trạng thái git (chốt phiên 2026-09-29):** nhánh `Chungcook` khớp `origin/Chungcook` ở `6a18d99`; `origin/main` đi trước 3 commit (merge PR #19 + commit rỗng `f2b8128`, không đổi file) nên không xung đột. Toàn bộ việc phiên 29/09 CHƯA commit: 15 file code/tài liệu (`index.html`, `css/style.css`, `css/pages.css`, `js/router.js`, `js/albums.js`, `js/script.js`, `js/sale-chat.js`, `server/server.js`, 4 file test, `CLAUDE.md`, `changelog.md`, `rules/tech-defaults.md`) + 61 ảnh chụp test `_screenshots/*.png` bị chụp lại (tuỳ người dùng có commit hay không).

**Phiên 2026-09-27 đã làm (chi tiết từng lượt: `docs/changelog.md`):**
1. Khối đầu trang chủ theo bố cục "DỊCH VỤ" của alohababy.vn (tiêu đề giữa + dòng 5 dịch vụ + lưới ảnh 3 cột).
2. Tạm tắt Đặt lịch, trang album, chatbot AI bằng cờ `js/features.js` (chỉ ẩn; bật lại = đổi `false` -> `true`).
3. Bấm 5 ảnh / dòng dịch vụ -> đăng nhập -> màn chat riêng `#/chat-sale/<dịch vụ>` với Sale: ảnh phóng to chuyển trang, 3 tin chào tự động đến lần lượt có "Tư vấn viên đang trả lời…", 4 nút gợi ý; đã bỏ cột trái theo yêu cầu.
4. **Chat THẬT qua server** (`server/sale-chat.js` + MongoDB Atlas, người dùng chọn): đăng nhập/đăng ký kiểm tra ở server, Admin có mục "Tin nhắn" (Sale trả lời, Sếp chỉ xem), thêm 2 tài khoản Sale demo `0900000005`/`0900000006` (`sale123`).
5. Git: commit `188ca83` + merge `origin/main` (13 commit của nhóm: "Chat với thợ chỉnh ảnh", tab "Ảnh đã chỉnh"...) thành `55aed00`, xử lý conflict giữ cả 2 phía, đã push, **PR #15 đã merge vào `main`** (`e7a8b95`), Vercel/GitHub Pages/Render đã chạy bản mới.
6. **MongoDB Atlas đã cài xong, chat Sale chạy thật trên bản public:** cluster M0 `Chungcook` (AWS Hong Kong), IP `0.0.0.0/0`; Render đã có `MONGODB_URI`, `AUTH_SECRET`, `ALLOWED_ORIGINS` (Vercel + GitHub Pages). `/api/health` → `"chatStore":"mongodb"`. Claude đã test bằng trình duyệt thật trên cả Vercel lẫn GitHub Pages: khách ↔ Sale 2 cửa sổ ẩn danh chat qua lại, tải lại trang tin vẫn còn, không lỗi CORS (16/16 PASS).
7. **Đăng nhập/đăng ký bằng Google** (người dùng chọn: Google trước, Facebook sau; Google lần đầu bắt nhập SĐT 1 lần; giữ SĐT + mật khẩu như cũ, không OTP): nút Google trên `login.html`, server kiểm tra token qua Google tokeninfo, SĐT đã có tài khoản không gắn Google được (chống chiếm tài khoản). Test `test-google-login` 19/19 (giả lập Google). **Code CHƯA commit/push; bản public chưa có nút Google** cho tới khi người dùng tạo OAuth Client ID + đặt `GOOGLE_CLIENT_ID` trên Render (`server/DEPLOY.md` mục "Đăng nhập bằng Google"). Luồng với Google thật CHƯA kiểm chứng.

**Việc cần làm tiếp theo (chốt phiên 2026-09-29, theo thứ tự):**
1. **Commit + push phiên 29/09** lên `Chungcook`, mở PR vào `main` (chỉ làm khi người dùng bảo; hỏi có commit 61 ảnh chụp test không).
2. **Sau khi merge: kiểm tra Render đã deploy server mới** (`server/server.js` có trường `do` - "khách bảo gì làm nấy") rồi thử trên bản public (Vercel): hỏi thông tin vẫn ở AI, "gặp nhân viên" tự sang Sale, "mở album newborn" tự mở, chuyển cảnh, đầu khung chatbot mới. Đồng thời kiểm luôn phần 28/09 đã lên public nhưng CHƯA kiểm chứng: gợi ý 2 nút do AI chọn (`/api/chat-suggest`), "Nhắn Sale" + bản tóm tắt cho Sale (`/me/handoff`).
3. **Đăng nhập Google:** code đã có trên `main`; người dùng tạo OAuth Client ID + đặt `GOOGLE_CLIENT_ID` trên Render (`server/DEPLOY.md`), rồi nhờ Claude thử bằng Google thật. Sau đó: đăng nhập Facebook.
4. Các việc lớn hơn: xem "Việc còn mở" trong phần Trạng thái dự án. Việc nhỏ người dùng tự làm khi muốn: xoá tin test trong chat của `0900000001` (Atlas -> `aloha_baby.chats`); cài SePay; thêm `AUTH_SECRET` vào `server/.env` để khỏi phải đăng nhập lại mỗi lần bật server local.

**Đang chờ người dùng quyết (hỏi trước khi làm, không tự làm):**
- **Chữ còn quảng cáo "đặt lịch/cọc online" khi Đặt lịch đang tắt:** chip "Đặt lịch & cọc online", section "Đặt lịch chỉ trong 4 bước", bullet "Đặt lịch, đặt cọc... trực tuyến", bài "Cách đặt lịch và đặt cọc chụp ảnh online" -> ẩn tạm / viết lại thành "nhắn Sale giữ lịch" / giữ nguyên.
- **Nút "Tin nhắn" trong Không gian Sale** (`crm/sale.html`): hiện Sale phải tự mở `crm/admin.html#tin-nhan` mới thấy khách nhắn + bản tóm tắt. Đề xuất thêm nút có số tin chưa đọc vào menu.
- **Nhãn tên dịch vụ trên 5 ảnh đầu trang:** nền xám đậm hơi nặng với ảnh sáng -> đề xuất đổi sang trắng mờ chữ navy.
- **Menu "Dịch vụ" trên thanh nav:** 5 mục con vẫn chỉ cuộn tới khối Dịch vụ -> có cho mở thẳng album từng dịch vụ (kèm chuyển cảnh) không.

## Kiến trúc hệ thống & danh sách file (giữ nguyên — xem guardrail đầu tiên bên dưới)

Site tĩnh HTML/CSS/JS thuần, không framework, không build step. Mọi trạng thái/dữ liệu là mô phỏng phía client (localStorage), không có backend CRM/booking thật. Chỉ có **3 file HTML**: `index.html`, `login.html`, `crm/admin.html`.

**Trang khách hàng (public):**
- `index.html` — SPA nhỏ bằng `location.hash`, gồm các view: Trang chủ, Đặt lịch (`#/dat-lich`), Ảnh của tôi (`#/chon-anh`), Album (`#/album/...`), Nội dung chi tiết (`#/noi-dung/...`). `#/chat-sale[/<dịch vụ>]` không còn là trang riêng (2026-09-28): chỉ bắt đăng nhập rồi mở chat Sale ở góc. Lightbox dùng chung nằm cuối `<main>`; khung chatbot `#chatPanel` + bong bóng `#chatTeaser` + khung chat Sale riêng `#saleChatPanel` (chỉ dùng khi tắt `aiChat`) nằm cuối `<body>`.
- `login.html` — cổng đăng nhập chung cho cả 4 vai trò demo (không chọn vai trò bằng tay). Có thêm nút "Đăng nhập bằng Google" cho khách (2026-09-27, chỉ hiện khi server có `GOOGLE_CLIENT_ID`; lần đầu hiện bước nhập SĐT `#googleForm`).
- `js/features.js` (thêm 2026-09-27, nạp trong `<head>` của `index.html` + `login.html`) — `window.ALOHA_FEATURES = { booking, aiChat, albumPages }`; từ 2026-09-28 chỉ `booking: false` (tạm tắt), `aiChat` + `albumPages` đã bật lại. Đặt class `feat-no-*` lên `<html>` để CSS cuối `style.css` ẩn nút. Test cũ bật lại đủ cờ bằng `launchAllFeatures` trong `_screenshots/test-env.js` (kèm coi như khách đã đóng lời chào chatbot).
- `js/router.js` — router hash-based (parse route, gate quyền, chuyển view, dừng video/đóng lightbox khi rời trang). `#/dat-lich`, `#/chon-anh`, `#/chat-sale[/<dịch vụ>]` bắt đăng nhập khách; `#/chat-sale` mở chat Sale ngay trên trang đang xem (trả địa chỉ về route trước đó); route đang tắt theo cờ (`#/dat-lich`) về Trang chủ. Có `window.AlohaJourney` (2026-09-28): ghi hành trình khách trong phiên (album dịch vụ, concept, trang nội dung; `js/albums.js` ghi ảnh mở lớn, `js/script.js` ghi câu hỏi chatbot) để tóm tắt cho Sale.
- `js/sale-chat.js` (thêm 2026-09-27) — `window.AlohaSaleChat`: chat Khách ↔ Sale qua server. **Mặc định (aiChat bật, 2026-09-28) chạy NHÚNG trong khung chatbot**: `embed()` vẽ tin Sale vào `.chat-sale-live` của `#chatPanel`, `pause()` khi thu nhỏ, `unembed()` khi quay lại trợ lý AI, `handoff()` gửi Sale bản tóm tắt (`summaryText()` dựng từ `AlohaJourney`). Tắt `aiChat` thì dùng khung riêng `#saleChatPanel` ở góc (`open/close`). Mở đầu là 3 **tin chào tự động** của Sale đến lần lượt (nhịp "đang nhập", chỉ hiển thị, không lưu, ghi "Tin nhắn tự động") rồi 4 nút gợi ý theo dịch vụ. **Tin nhắn đi qua server** (`AlohaAuth.api` → `server/sale-chat.js`), hỏi tin mới 2.5 giây khi đang mở chat Sale (20 giây lúc đóng, để bật chấm đỏ nút chat); tin gửi lỗi có "Gửi lại", dòng trạng thái "Đang kết nối…" / "Đăng nhập lại". Tin hệ thống (tóm tắt) không hiện cho khách.
- `js/albums.js` — `window.AlohaAlbums`: dữ liệu album 3 tầng Dịch vụ → Concept → Ảnh (5 dịch vụ × 7 concept; thêm ảnh = thêm đường dẫn vào `photos` của concept; concept chưa có ảnh tự ẩn) + render view album + **lightbox dùng chung** (`openViewer(items, i)`, phát được cả video) + `lookup('dịch vụ/concept')` cho trang khác lấy ảnh. Cũng điền số concept/ảnh bìa cho Hero.
- `js/content.js` — `window.AlohaContent`: trang nội dung chi tiết `#/noi-dung/<slug>` (5 concept, video "Một ngày tại ALOHA Baby", giới thiệu studio, chụp tại nhà, 3 bài tin tức). Thêm trang = thêm 1 object vào `PAGES` (khối heading/text/list/steps/image/video/gallery/albums/note), xem skill `add-content`.
- `js/script.js` — tương tác trang chủ: nav/mobile menu, scroll-reveal, chatbot (kịch bản + AI thật + trả lời dự phòng cục bộ), Tìm kiếm, Thông báo.
- `js/auth.js` — `window.AlohaAuth`: session (`login/logout/getSession/requireRole/roleHome/roleLabel`) + gọi server chat (`api`, `serverLogin`, `serverRegister`, `wakeServer`, `serverConfig`, `serverGoogle`, `serverGoogleComplete`; `API_BASE` = `localhost:3001` khi mở từ máy, Render khi public).
- `js/data-store.js` — `window.AlohaData`: kho dữ liệu demo dùng chung Khách hàng ↔ Admin.
- `js/dat-lich.js` — logic đặt lịch, mô phỏng khung giờ real-time.
- `js/chon-anh.js` — logic chọn ảnh, ghi chú chung + riêng từng ảnh, gửi yêu cầu chỉnh sửa.
- `css/style.css` — design token (`--pink-*`, `--navy-*`, `--radius-*`, `--shadow-*`, `--caption-shadow`, `--font-heading`/`--font-body`) + style dùng chung (nav, hero, logo chữ `.wordmark`, footer, chatbot...).
- `css/pages.css` — style các view phụ: Đặt lịch, Ảnh của tôi, Album, Nội dung, lightbox.

**Ban quản trị (nội bộ):**
- `crm/admin.html`, `crm/js/admin.js`, `css/admin.css` — dùng chung cho Thợ ảnh + Sếp. Sale đăng nhập mặc định vào `crm/sale.html`, nhưng vẫn vào được đây để dùng mục **Tin nhắn** (chat thật với khách qua `server/sale-chat.js`); các mục khác của Sếp/Thợ ảnh bị xoá khỏi DOM như cũ (gộp 2026-09-27).
- `crm/sale.html`, `crm/js/sale.js`, `crm/js/sale-data.js`, `css/sale.css` — **Không gian Sale** (thêm 2026-09-25, theo file thiết kế "ALOHA Sale Workspace" người dùng đưa): SPA hash (`#tong-quan`, `#hop-thu`, `#khach-hang`, `#lich-chup`, `#dat-coc`, `#don-anh`, `#chuyen-giao`, `#bao-cao`), sidebar + bottom nav mobile. 5 tài khoản sale (`0900000002`, `0900000005`…`0900000008` / `sale123`: Ngọc Anh, Minh Thư, Thu Hà, Quốc Bảo, Hải Yến). Hộp thư/Khách hàng/Đặt cọc/Đơn & ảnh/Chuyển giao hiện khách của MỌI sale, có bộ lọc "Sale phụ trách" (mặc định Tất cả sale); khách của sale khác chỉ xem, thao tác chỉ sale phụ trách làm được (đổi 2026-09-27). Tổng quan/Báo cáo/Tìm kiếm vẫn chỉ khách của mình. Ngày giờ dùng đồng hồ thật: dữ liệu demo (viết quanh 25/09/2026) được dời theo hôm nay khi mở trang, qua nửa đêm tự đổi "hôm nay"; lịch Sale tạo giữ tối đa 1 tiếng, quá giờ chưa cọc tự nhả khung giờ; Tổng quan không còn lời chào tên sale (2026-09-27). Lịch chụp là lịch chung cả studio (thấy mọi khách, nhưng liên hệ chỉ sale phụ trách xem). Dữ liệu demo tĩnh trong `sale-data.js`, thao tác chỉ sống trong bộ nhớ trang (KHÔNG thêm key localStorage mới, chưa nối `aloha_demo_db`). **Khách hàng gộp với Khách tiềm năng** (2026-09-25, theo file thiết kế "ALOHA Sale Workspace (3)"): 1 trang `#khach-hang` có nút chuyển "Bảng giai đoạn" (kanban phễu mở, như trang Khách tiềm năng cũ) / "Danh sách" (mọi khách + hồ sơ bên phải; màn ≤1180px mở hồ sơ dạng modal); link cũ `#khach-tiem-nang` tự chuyển về Bảng giai đoạn. Nhóm ở Danh sách (Tiềm năng/Chờ cọc/Đã chốt/Đã chụp/Khách quen/Không mua) tự suy ra từ dữ liệu, không nhập tay; field mới tuỳ chọn trên khách: `lost {reason}` (không mua), `history` (lịch sử với studio, `shoot:true` tính là 1 đơn đã chụp), `referrals`. **Chuyển giao khách** (`#chuyen-giao`, thêm 2026-09-25): chọn nhiều khách + người nhận + lý do + tạm thời/chuyển hẳn + cách tính doanh số + ghi chú bàn giao (tự gợi ý từ CRM); luồng BẮT BUỘC Sale gửi → Quản lý duyệt → người nhận bấm "Nhận khách" thì hồ sơ/hội thoại/lịch/cọc/đơn mới đổi `owner` (trước đó khách vẫn thuộc sale cũ, bị khoá không gửi yêu cầu trùng). Nút "Chuyển người khác" trong Hộp thư giờ dẫn sang màn này, không chuyển thẳng nữa. Chưa có màn duyệt của Quản lý và dữ liệu không dùng chung giữa các phiên đăng nhập nên 2 bước phía người khác dùng nút "Mô phỏng". Dữ liệu: mảng `transfers` + field `leave` (nghỉ phép, không nhận khách) trong `sale-data.js`.
- `coc.html` — trang khách mở từ link cọc Sale gửi (QR/placeholder mức cọc, nút "Mô phỏng tiền về" chỉ để demo, tải file .ics).
- Test: `_screenshots/test-sale.js` (137 case: lọc theo sale + chỉ xem khách sale khác, phân quyền 5 sale, lịch chung, xác nhận cọc, tạo lịch nhanh chống trùng phòng, kanban, hộp thư, chuyển giao khách qua duyệt, mobile 320/390/768, coc.html; hồ sơ cọc mở bằng nút mắt, ghi chú đơn ảnh).

**Server (tách biệt khỏi CRM/booking):** `server/server.js` (proxy gọi **Gemini API**, chuỗi model dự phòng `MODEL_CHAIN`, whitelist action gợi ý; `/api/chat-suggest` AI chọn 2 nút gợi ý cho menu kịch bản (2026-09-28); webhook SePay) + `server/sale-chat.js` (thêm 2026-09-27, mount `/api/sale-chat`: **chat thật Khách ↔ Sale + đăng nhập kiểm tra ở server** - tài khoản demo khớp `login.html` + khách đăng ký thật (mật khẩu scrypt), cấp token HMAC ký bằng `AUTH_SECRET`; khách chỉ đọc chat của mình, Sale đọc/trả lời mọi chat, Sếp chỉ xem; lưu **MongoDB Atlas** (`MONGODB_URI`, collection `users` + `chats`, `_id` = SĐT), không có thì lưu bộ nhớ) + `package.json` (express, cors, dotenv, mongodb), `package-lock.json`, `.env.example`, `.gitignore`, `DEPLOY.md`. Deploy trên Render (`https://phantichweb.onrender.com`), chạy local bằng `npm start` (cổng 3001). `server/.env` chứa key thật, KHÔNG commit.

**Ảnh, video, logo:**
- `images/` — ảnh trang chủ (hero, service-*, concept-*, album-*, news-*, about-studio, services-main, video-poster).
- `images/albums/<dịch vụ>/<concept>/` — 256 ảnh album (~40MB), nguồn từng ảnh ở `images/albums/sources.json`.
- `images/videos/` — 3 video minh hoạ 720p + poster `.jpg` cùng tên, nguồn ở `sources.json`.
- `images/my-photos/` — 16 ảnh demo cho "Ảnh của tôi".
- `images/logo-mark.svg` (trái tim: favicon + ảnh đại diện chat), `images/logo.svg` (logo chữ dùng ngoài web), `images/favicon-32.png`, `images/apple-touch-icon.png`. Logo trên web là chữ HTML `.wordmark`, không phải file ảnh.
- Toàn bộ ảnh/video là **stock miễn phí bản quyền (Pexels License)**, là ảnh MINH HOẠ, không phải khách hàng thật.

**Test/tiện ích (`_screenshots/*.js`, chạy tay, Puppeteer điều khiển Chrome cài sẵn):**
- Test không cần server (ưu tiên chạy): `test-auth` (17 case), `test-interest-gate` (11), `test-photos-chat` (9), `test-photo-notes` (5), `test-ai-chat` (1), `test-suggestion-nav` (9), `test-service-albums` (134), `test-chat-concepts` (28), `test-content-pages` (59), `test-booking-required` (68), `test-google-login` (19, tự bật server cổng 3001 + máy chủ Google giả cổng 3009, nút Google giả; tắt `npm start` trước), `test-sale-chat` (52, tự bật `server/server.js` ở cổng 3001 lưu bộ nhớ - tắt `npm start` của bạn trước; khách/Sale ở các cửa sổ ẩn danh riêng như 2 máy; chạy với cờ mặc định), `test-chatbot-greeting` (18, 2026-09-28, tự bật server như trên với `GEMINI_API_KEY` rỗng: chatbot tự mở, lời chào theo trang, chuyển Sale + tóm tắt, bong bóng mobile). Các test còn lại bật lại đủ cờ qua `launchAllFeatures`.
- Test cần server/AI thật (tốn hạn mức Gemini): `test-ai-faq-menu`, `test-chat-navigate`, `test-prod-chat` (chạy trên bản public).
- Chụp/kiểm tra: `shoot.js`, `shoot-all.js`, `shoot-viewport.js`, `audit-responsive.js`, `inspect.js`.
- Tải ảnh/xuất logo: `fetch-album-photos.js` (ảnh album), `fetch-images.js`, `fetch-my-photos.js` (đã dùng xong, giữ tham khảo), `make-logo-png.js` (xuất PNG favicon từ SVG).

**Có ở thư mục gốc nhưng KHÔNG thuộc kiến trúc trên:** `alohababy.vn.png` (ảnh chụp website thật của studio, người dùng cung cấp, dùng đối chiếu bố cục), `skills-lock.json` (hệ thống skill quản lý).

**2 "database" mô phỏng (localStorage, KHÔNG phải backend thật — xem guardrail real-time trong `rules/tech-defaults.md`):**
- **`aloha_auth`** (`js/auth.js`) — 1 object session hiện tại: `{ role: 'khach-hang'|'tho-anh'|'sale'|'sep', name, phone, loginAt, token? }`. `token` (thêm 2026-09-27) là mã đăng nhập server cấp cho chat thật; không có (đăng nhập lúc server tắt) thì mọi phần khác vẫn chạy, riêng chat báo "Đăng nhập lại".
- **sessionStorage (2026-09-28, chỉ trong tab đang mở, không phải dữ liệu nghiệp vụ):** `aloha_journey` (`js/router.js`, hành trình khách để tóm tắt cho Sale, tối đa 60 mục `{ type: 'service'|'concept'|'photo'|'page'|'ask', service?, concept?, label?, at }`) và `aloha_chat_ui` (`js/script.js`, `{ dismissed, mode: 'ai'|'sale', saleTopic, openAfterLogin, pendingSale }`: khách đã đóng lời chào chưa, đang chat với ai, vừa bị đưa đi đăng nhập từ khung chat).
- **`aloha_admin_ui`** (`crm/admin.html` + `crm/js/admin.js`, thêm 2026-09-25) — 1 chuỗi `collapsed`/`expanded`: cột menu khu quản trị đang thu gọn hay mở rộng. Chỉ là tuỳ chọn hiển thị, không phải dữ liệu nghiệp vụ, mất đi cũng không ảnh hưởng gì (mặc định là mở rộng).
- **`aloha_demo_db`** (`js/data-store.js`) — `{ customers: { [phone]: { hasShoot, orderCode, serviceLabel, packageLabel, packageCount, photoCount } }, editRequests: [{ id, phone, customerName, orderCode, serviceLabel, photoCount, note, photoNotes: [{id, note}], extraCount, extraFee, paymentStatus, photos: [{id, src, note, isExtra}], doneIds: [photoId], staffSeen, customerSeenDone, status, createdAt, resultLink, resultLinkAt, messages: [{id, from: 'customer'|'staff'|'ai', name, text, at, needsStaff}], customerSeenEditedSig }] }`. `resultLink` (chỉ https) là link thư mục Drive ảnh đã chỉnh Thợ ảnh gửi, `messages` là chat Khách ↔ Thợ ảnh của đúng yêu cầu đó, `customerSeenEditedSig` là dấu khách đã xem link/tin mới (tắt chấm báo trên tab "Ảnh đã chỉnh"); bản ghi cũ thiếu các field này thì nơi đọc tự coi như rỗng (thêm 2026-09-27). `status` dùng đúng enum trong `rules/tech-defaults.md` — **chỉ còn 3 giá trị** (Chờ xử lý → Đang thực hiện → Hoàn thành; đã bỏ "Chờ QC" riêng ngày 2026-09-19, xem `docs/changelog.md`). `photos` là danh sách ĐẦY ĐỦ ảnh trong yêu cầu (khác `photoNotes` chỉ chứa ảnh có ghi chú riêng); `doneIds` là các `photo.id` Thợ ảnh đã đánh dấu xử lý xong, đổi qua `AlohaData.togglePhotoDone(requestId, photoId)`; `staffSeen`/`customerSeenDone` (thêm 2026-09-19) là 2 cờ thông báo 1 chiều độc lập nhau, đổi qua `AlohaData.markStaffSeen()`/`markCustomerSeenDone()` — xem `docs/changelog.md`. (Chat Khách ↔ Sale từng lưu ở đây dạng `chats` trong 1 buổi 2026-09-27, nay đã chuyển lên server; `readDb()` tự xoá key `chats` cũ.)

**Dữ liệu chat trên server** (MongoDB, `server/sale-chat.js`): `chats` = `{ _id: phone, phone, customerName, topic, messages: [{ id, from: 'khach'|'sale'|'he-thong', senderName, text, at, kind? }] (giữ 500 tin gần nhất; `he-thong` + `kind: 'summary'` = bản tóm tắt hành trình khách gửi khi chuyển từ chatbot sang Sale qua `POST /me/handoff` (2026-09-28), chỉ Sale/Sếp thấy), staffUnread, customerUnread, updatedAt, createdAt }`; `users` (khách tự đăng ký) = `{ _id: phone, phone, name, salt, hash, role: 'khach-hang', createdAt }`; khách đăng ký bằng Google (2026-09-27) không có `salt/hash`, có thêm `provider: 'google', googleSub, email` (index unique sparse trên `googleSub`: 1 tài khoản Google chỉ gắn 1 SĐT). **Chưa nối vào hồ sơ CRM** (`customers`/bảng Khách hàng tĩnh), cùng việc mở #2.

## Trạng thái dự án (cập nhật 2026-09-27)

Chi tiết từng lượt thay đổi, lỗi đã gặp, lý do quyết định: **`docs/changelog.md`** (đọc khi cần bối cảnh; ghi mục mới lên đầu file đó sau mỗi thay đổi đáng kể).

**Đã có:**
- Trang chủ: khối "DỊCH VỤ" 5 dịch vụ (bố cục alohababy.vn, lưới 3 cột) → album 3 tầng; các thẻ Album/Concept/Video/Tin tức/Giới thiệu/Chụp tại nhà mở tầng nội dung chi tiết; Tìm kiếm + Thông báo dùng thật; logo chữ "aloha ♥ BABY STUDIO".
- Đăng nhập/phân quyền demo 4 vai trò (`login.html`, `js/auth.js`); Đặt lịch 4 bước: Dịch vụ & concept (giá riêng từng concept + "Khác" tự lên ý tưởng cùng Sale), Ngày giờ, Xác nhận (validate ô bắt buộc), Đặt cọc 50% (tự nhận diện thanh toán nhưng là MÔ PHỎNG, chưa có cổng/webhook thật, xem `docs/tich-hop-thanh-toan.md`); Ảnh của tôi (toàn bộ album Google Photos, lightbox xem/thu phóng/lướt, thả tim + ghi chú ngay trong lightbox, nút Chọn tất cả (báo phí trước) / Bỏ chọn tất cả (có Hoàn tác), gửi yêu cầu chỉnh sửa; tab "Ảnh đã chỉnh": link Drive Thợ ảnh gửi (công khai) + "Chat với thợ chỉnh ảnh" (trợ lý tự động trả lời trước với giọng thợ, câu khó mới chuyển thợ thật; không nói dối nếu khách hỏi thẳng là người hay máy); chọn quá 10 ảnh thì phải thanh toán qua QR, SePay báo tiền về thì ảnh tự gửi tới Thợ ảnh).
- Admin `crm/admin.html`: menu dọc bên trái thu gọn/mở rộng được (nhớ trạng thái trong `aloha_admin_ui`); Dashboard Sếp (KPI, phễu, biểu đồ) + mục Doanh thu (KPI sparkline, biểu đồ đường 3 tab, mục tiêu tháng), hiệu ứng chạy lại mỗi lần bấm menu; Lịch hẹn dạng lịch tháng có popup chi tiết, vừa khung màn hình, nổi bật ngày hôm nay; bảng Khách hàng có avatar chữ viết tắt tự sinh từ tên (màu theo SĐT); CRM + Lịch hẹn vẫn là dữ liệu tĩnh; đã bỏ mục Concept khỏi Admin; kanban chỉnh ảnh 3 bước nối dữ liệu thật (Thợ ảnh tick từng ảnh, Sếp xem chỉ đọc), thông báo 2 chiều Khách ↔ Thợ ảnh (polling 5 giây, chỉ trong cùng trình duyệt).
- Chatbot AI (BẬT LẠI 2026-09-28; **mọi menu gợi ý tối đa 2 nút, AI chọn theo hoàn cảnh** qua `/api/chat-suggest`, quá 3 giây/lỗi thì 2 nút mặc định): kịch bản quick-reply (tư vấn dịch vụ, concept & ảnh mẫu, quy trình, FAQ, nhắn Sale) + khung gõ tự do gọi Gemini qua server Render, AI trả kèm 3 nút gợi ý dẫn trang; AI lỗi thì trả lời cục bộ theo từ khoá (ghi rõ "Trợ lý AI đang bận"). Trang chủ máy tính tự mở sau 1.5 giây, điện thoại hiện bong bóng lời chào; lời chào đổi theo album dịch vụ/concept đang xem (khách chưa trò chuyện thì thay hẳn, đã trò chuyện thì chỉ nói thêm khi sang dịch vụ khác); khách bấm × thì không tự mở lại trong lần truy cập. Chưa đăng nhập bấm vào chatbot -> đăng nhập -> quay lại mở tiếp. Đặt lịch đang tắt nên gợi ý "đặt lịch" chuyển sang Sale.
- Chat trực tiếp Khách ↔ Sale (2026-09-27, đổi giao diện 2026-09-28): nút "Nhắn Sale" trong khung chatbot -> chat tiếp với Sale ngay trong khung đó (tin với trợ lý AI giữ phía trên, quay lại trợ lý AI được); Sale nhận **bản tóm tắt tự động** khách đã xem/hỏi gì (thẻ vàng trong hộp thư). Admin có mục "Tin nhắn" (Sale trả lời, Sếp chỉ xem, Thợ ảnh không có), badge tin chưa đọc. **Chat THẬT qua server** (MongoDB Atlas): khác máy/khác trình duyệt vẫn chat qua lại, polling vài giây một lần (chưa phải WebSocket). Đăng ký khách tạo tài khoản thật trên server. Test: `test-sale-chat` (52), `test-chatbot-greeting` (18). Bản public đã kiểm chứng chat thật trên Vercel + GitHub Pages (2026-09-27, bản cũ trước khi nhúng vào chatbot).

**Quyết định đã chốt (không hỏi lại trừ khi người dùng đổi ý):**
- Đăng nhập 1 trang, KHÔNG chọn vai trò bằng tay (6 tài khoản demo hardcode trong `login.html`: 1 khách, 3 Sale `0900000002/05/06`, 1 Thợ ảnh, 1 Sếp). Đăng ký mới không có `next` → vào `#/dat-lich` (hoặc `#/chat-sale` khi Đặt lịch đang tắt); có `next` thì tôn trọng `next`.
- 3 vai trò nội bộ dùng chung `crm/admin.html`, phân quyền bằng `data-roles`, phần không thuộc quyền bị **xoá khỏi DOM**.
- Khách hàng gộp 1 file `index.html` (SPA hash); giữ riêng `login.html` và `crm/admin.html`.
- Nội dung chi tiết xem **công khai** (2026-09-25). Từ 2026-09-28: trang album bật lại, MỌI thẻ album/concept (kể cả 5 ảnh dịch vụ đầu trang) xem công khai, không cần đăng nhập. Nút chat nổi và mọi thao tác chat với trợ lý AI cũng không cần đăng nhập (đảo lại quyết định cũ "vẫn bắt đăng nhập" cùng ngày, người dùng đổi ý). Đăng nhập chỉ còn bắt buộc khi: khách chủ động bấm nút "Đăng nhập" trên menu, chuyển sang chat THẬT với Sale ("Nhắn Sale", vì tin lưu theo SĐT trên server), hoặc vào Đặt lịch/Ảnh của tôi.
- Chỉnh sửa ảnh chỉ 3 bước (Chờ xử lý → Đang thực hiện → Hoàn thành), KHÔNG có vai trò QC riêng. Yêu cầu thật chỉ được chuyển sang Hoàn thành khi Thợ ảnh đã gửi link ảnh đã chỉnh (2026-09-27).
- Link ảnh đã chỉnh để CÔNG KHAI cho khách gửi người thân: ngoại lệ có chủ đích với nguyên tắc riêng tư ảnh trẻ em, người dùng chốt 2026-09-27 (chi tiết `rules/workflow.md`).
- Chatbot dùng Gemini (free tier). **Từ 2026-09-29 "khách bảo gì làm nấy"** (thay quy tắc cũ "chỉ chuyển khi khách bấm nút gợi ý"): tin khách là yêu cầu làm ngay (gặp Sale, đặt lịch, mở album/trang) thì tự làm luôn; câu hỏi thông tin thì chỉ trả lời + 2 nút gợi ý. Server tự thử chuỗi model dự phòng khi quá tải.
- Logo chỉ dùng chữ (wordmark); khối Dịch vụ đầu trang theo bố cục alohababy.vn, không có danh sách đánh số 01-05.

**Việc còn mở (theo thứ tự ưu tiên gợi ý):**
(Đã xong 2026-09-27: merge PR #15, cài MongoDB Atlas + biến Render, chat Sale public đã kiểm chứng trên Vercel + GitHub Pages.)
1. Sau khi tạm tắt Đặt lịch/album/chatbot (2026-09-27), vẫn còn chữ nhắc tới chúng, **cần hỏi người dùng có sửa không**: chip "Đặt lịch & cọc online" ở phần giới thiệu, section "Đặt lịch chỉ trong 4 bước", meta description, các bài trong `js/content.js` ("đặt lịch online", "trợ lý trong khung chat"), thẻ "Xem trọn album" trong trang nội dung còn mũi tên nhưng không bấm được.
2. Đăng nhập Facebook (sau Google, người dùng đã chọn thứ tự này): cần người dùng tạo app Meta for Developers + trang Chính sách bảo mật + chuyển app sang Live; làm cùng cách "lần đầu nhập SĐT" như Google. Chưa có "quên mật khẩu" / lấy lại tài khoản.
3. Chat Sale (đã chạy thật trên public), phần chưa làm: tin nhắn ghi vào hồ sơ CRM, tài khoản nhân viên thật thay tài khoản demo (mật khẩu demo đang công khai trên trang đăng nhập), thông báo đẩy khi Sale không mở trang.
4. Nối bảng CRM/Lịch hẹn của Sale (`CUSTOMERS`/`APPOINTMENTS` trong `crm/js/admin.js`, đang là mảng tĩnh) vào `aloha_demo_db`.
5. Thợ ảnh: chưa có tải ảnh gốc / công cụ chỉnh sửa thật. Sale: chưa có ghi chú tư vấn / đổi trạng thái phễu.
6. Người dùng tự cài SePay (không gấp, `/api/health` đang `"hasSepayKey":false`): liên kết MB `0967237146`, tạo webhook `https://phantichweb.onrender.com/api/sepay-webhook`, đặt `SEPAY_WEBHOOK_KEY` trên Render (từng bước: `server/DEPLOY.md`).
7. Tab "Đổi lịch hẹn" chưa có màn hình thật.
8. **Chưa chốt, không tự làm:** đồng bộ real-time đa thiết bị cho ĐẶT LỊCH/CRM cần backend thật (server + database + WebSocket/SSE), người dùng nói "để sau". (Riêng chat Sale đã có server + MongoDB từ 2026-09-27, cập nhật bằng polling 2.5-3 giây.)
9. `test-qr-flow` cần server thanh toán chạy ở cổng 3001 (không thuộc nhóm test không cần server); `test-sale-chat` tự bật server nên phải tắt `npm start` trước khi chạy.

## Mục tiêu & Context quan trọng

- **CRM là xương sống:** một thông tin khách hàng chỉ nhập một lần, tái sử dụng ở mọi khâu (tư vấn → đặt lịch → chụp → chỉnh ảnh → chăm sóc). Data model đầy đủ: `rules/tech-defaults.md`.
- Mục tiêu chuyển đổi: từ vận hành thủ công qua điện thoại/tin nhắn sang một hệ thống tập trung mà khách tự thao tác và nhân sự dùng chung dữ liệu. Studio hiện vận hành qua 9 khâu nối tiếp (marketing → sales → điều phối → concept/stylist → buổi chụp → chọn ảnh → hậu kỳ → in ấn → bàn giao); mỗi luồng trên website tương ứng với một khâu cụ thể. Chi tiết: `rules/operations.md`.
- 5 nhóm dịch vụ cố định: Bé lớn, Sinh nhật, Bầu, Gia đình, Newborn.
- Ngoài CRM/booking/ảnh cốt lõi, dự án còn có 3 tính năng: **chatbot AI tư vấn** (kịch bản → concept → báo giá → dẫn vào luồng đặt lịch), **giao diện chọn ảnh hậu kỳ** (đếm ảnh đã chọn so với gói, tính phí khi vượt), **đặt lịch real-time** (khung giờ cập nhật tức thời cho mọi người xem cùng lúc). Chi tiết: `rules/workflow.md`.

## Tech Stack

Chưa được chỉ định trong tài liệu nghiệp vụ. **Không tự chọn framework/database thay người dùng** — đề xuất kèm lý do hoặc hỏi lại. Nguyên tắc kiến trúc áp dụng bất kể stack nào: `rules/tech-defaults.md`.

## Nguyên tắc phát triển cốt lõi

- Đọc và hiểu context của task trước khi sửa code.
- Không tự ý thêm chức năng ngoài phạm vi yêu cầu, xóa file/thư mục, hay đổi kiến trúc nếu không có lý do kỹ thuật rõ ràng.
- Không đụng vào phần không liên quan đến task; giữ nhất quán giữa dữ liệu, UI và workflow.
- Thay đổi ảnh hưởng nhiều module → kiểm tra các module liên quan trước khi coi là xong.
- Task lớn/nhiều thay đổi → phân tích và lập kế hoạch trước khi code; task nhỏ → không cần plan dài dòng.
- Sau thay đổi lớn phải kiểm tra kết quả thực tế; không báo hoàn thành chỉ dựa trên giả định code chạy đúng. Với thay đổi giao diện: bắt buộc chụp screenshot và đối chiếu định hướng thiết kế — xem skill `verify-ui-change`.
- Lỗi phát sinh do chính thay đổi vừa thực hiện → phải xử lý trước khi báo hoàn thành.
- Yêu cầu mới mâu thuẫn với requirement hiện tại (kể cả trong file này) → chỉ rõ mâu thuẫn trước khi thực hiện thay đổi lớn, không âm thầm ghi đè.

## Guardrail bắt buộc

- **[Quyết định quan trọng nhất, do người dùng chốt trực tiếp] Giữ nguyên kiến trúc hệ thống hiện tại và các "database" (localStorage) đã thiết kế** — KHÔNG tái cấu trúc, đổi kiến trúc, đổi lược đồ dữ liệu, gộp/tách lại file nếu không có yêu cầu mới rõ ràng từ người dùng. Kiến trúc hiện tại: site tĩnh HTML/CSS/JS thuần (không framework), `index.html` là SPA nhỏ dùng `location.hash` cho 3 view khách hàng, `crm/admin.html` là 1 file dùng chung cho 3 vai trò nội bộ, `server/` là server Node/Express riêng phục vụ chatbot AI + nhận webhook thanh toán SePay cho phí ảnh chọn thêm (người dùng chọn 2026-09-25) + chat thật Khách ↔ Sale có đăng nhập kiểm tra ở server và database MongoDB Atlas chỉ cho chat (người dùng chọn 2026-09-27; vẫn tách biệt khỏi CRM/booking, CRM/booking vẫn chưa có database), dữ liệu mô phỏng lưu trong 2 key localStorage `aloha_auth` và `aloha_demo_db`. Danh sách đầy đủ file đã tạo + lược đồ 2 "database" này: xem mục "Kiến trúc hệ thống & danh sách file" ngay bên dưới.
- **Thương hiệu luôn là ALOHA Baby**, không dùng tên/logo "Memory Studio".
- **Trạng thái (status) dùng chung một bộ tên** giữa Admin và khách hàng; số liệu dashboard/phễu phải giảm dần hợp lý và nhất quán.
- **Ảnh trẻ em là dữ liệu nhạy cảm** — chỉ xem qua tài khoản chính chủ, chỉ dùng marketing khi có văn bản đồng ý, không public không xác thực. Chi tiết: `rules/workflow.md`.
- **Không tự đặt thông số nghiệp vụ chưa xác định** (thời gian giữ chỗ, thời hạn dời lịch...) — để dạng cấu hình. Danh sách đầy đủ: `rules/tech-defaults.md`.
- **UI/UX theo đúng định hướng đã có** (hồng-trắng-navy, dashboard dạng card, mô tả trong `rules/design.md`) — không tự tạo design system khác. Chi tiết: `rules/design.md`.
- **Giao diện phải mobile-friendly và mọi section phải có animation khi scroll** — bắt buộc cho cả hai phân hệ, không phải tùy chọn. Chi tiết: `rules/design.md`.
- **Đặt lịch real-time hiện chỉ là UI + mô phỏng bằng JS phía client** (site tĩnh, chưa có backend CRM/booking) — không được báo cáo hay hiển thị như thể đã đồng bộ real-time thật giữa nhiều người dùng. **Chatbot AI:** quick-reply là kịch bản dựng sẵn; khung nhập tự do gọi **Gemini API thật** qua server riêng (`server/`, deploy trên Render, local chạy `npm start`, cần `GEMINI_API_KEY`). Chỉ được gọi là "AI thật" khi server chạy và key hợp lệ; khi AI lỗi, frontend trả lời cục bộ theo từ khoá và **phải ghi rõ "Trợ lý AI đang bận"**, không giả vờ đó là câu trả lời của AI. Chi tiết: `rules/tech-defaults.md`.

## Cách Claude nên làm việc với dự án

| Việc đang làm | Đọc / dùng |
|---|---|
| Giao diện, màn hình, phong cách thiết kế | `rules/design.md` |
| Quy trình đặt lịch/dời lịch/chọn-chỉnh ảnh, automation CRM, Git | `rules/workflow.md` |
| Data model, status enum, kiến trúc, config/phạm vi chưa chốt | `rules/tech-defaults.md` |
| Bối cảnh vận hành offline thực tế của studio (9 khâu) | `rules/operations.md` |
| Cần biết vì sao một thứ được làm vậy / lỗi cũ đã gặp; ghi nhật ký sau thay đổi | `docs/changelog.md` |
| Trước khi đổi một khái niệm dùng chung (status, field CRM, config) | agent `researcher` — rà soát mọi nơi đang phụ thuộc vào nó |
| Trước khi báo hoàn thành task đụng CRM/booking/ảnh | agent `reviewer` — rà soát tính nhất quán nghiệp vụ |
| Xây một tính năng CRM/booking/ảnh mới từ đầu | skill `implement-business-feature` |
| Thêm ảnh/concept album, trang nội dung, bài viết, video | skill `add-content` |
| Sau khi code/sửa bất kỳ màn hình nào | skill `verify-ui-change` — screenshot, đối chiếu định hướng thiết kế, kiểm tra mobile-friendly & animation |

## Ghi chú làm việc

Luôn thể hiện phần suy nghĩ (thinking) bằng tiếng Việt.
