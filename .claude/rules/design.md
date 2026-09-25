# Design — ALOHA Baby

## User Roles

**Khách hàng:** mẹ bầu, bố mẹ có con nhỏ/sơ sinh/trẻ các mốc tuổi, gia đình nhiều thế hệ — tự thao tác trên phân hệ khách hàng.

**Nhân sự Admin/CRM** (phân quyền theo vai trò, không gộp chung một giao diện khi nghiệp vụ khác nhau rõ rệt):
- Sales/CSKH — quản lý hồ sơ khách, tư vấn, xác nhận cọc, **duyệt yêu cầu dời lịch quá hạn**, upsell ảnh/album.
- Điều phối — xem lịch theo ngày, phân công/phân công lại ekip và phòng chụp (kể cả sau khi Sales/CSKH duyệt dời lịch).
- Photographer — xem lịch được giao, cập nhật buổi chụp, tải ảnh gốc lên hệ thống.
- Retoucher/QC — nhận việc chỉnh sửa, cập nhật tiến độ, duyệt chất lượng.
- Quản lý studio — xem báo cáo, cấu hình hệ thống.

## UI/UX Direction (nguồn: 4 ảnh tham chiếu)

4 ảnh tham chiếu (màn hình Admin/CRM: dashboard, hồ sơ khách hàng, lịch/booking, tin nhắn khách hàng; **file ảnh gốc không còn trong repo**, chỉ còn mô tả dưới đây, đối chiếu theo mô tả này + `alohababy.vn.png` cho bố cục trang chủ) là **nguồn tham chiếu chính** cho visual direction — không tự bịa design system khác khi ảnh đã thể hiện rõ hướng thiết kế. Ảnh có độ phân giải thấp (~150x90px), chỉ dùng để xác định định hướng tổng thể (màu sắc, bố cục, loại component); không dùng để suy ra giá trị pixel-perfect — xin thêm asset độ phân giải cao nếu cần chi tiết mức đó.

- **Màu sắc:** Hồng/rose chủ đạo (nền nhạt, header, badge trạng thái, biểu đồ) phối nền trắng cho card, chữ chính xanh navy/đen nhạt, xanh dương cho link/nút phụ/chat bubble — tông "hồng – xanh" khớp định hướng nghiệp vụ, ưu tiên đúng bảng màu này.
- **Layout:** Dashboard dạng card, nội dung chia lưới nhiều cột. Điều hướng khu quản trị là **cột dọc cố định bên trái** (logo trên cùng, các mục có icon, khối người dùng + Đăng xuất ở đáy; màn ≤1000px thì trượt ra từ mép trái kèm lớp phủ) - người dùng chốt 2026-09-25, thay cho top navigation bar mà 4 ảnh tham chiếu gốc thể hiện. Cột menu **thu gọn/mở rộng được tuỳ ý** (nút mũi tên cạnh logo): thu lại còn dải 72px chỉ có icon, rê chuột hiện tooltip tên mục, trạng thái nhớ trong localStorage key `aloha_admin_ui` (tuỳ chọn hiển thị, không thuộc 2 kho dữ liệu mô phỏng). Nếu sau này muốn quay lại thanh ngang thì đó là đảo ngược quyết định này, cần hỏi rõ. Trang khách hàng vẫn dùng nav ngang, không đổi.
- **Component pattern lặp lại:** card hồ sơ khách hàng (ảnh + bảng field–value), bảng dữ liệu kèm badge trạng thái theo màu, biểu đồ nhỏ (bar/donut) cho KPI, grid ảnh thumbnail vuông, panel chat dạng bubble gắn trong hồ sơ CRM, card đôi side-by-side.
- **Typography:** **Montserrat** cho toàn bộ site, cả tiêu đề lẫn nội dung (người dùng chốt 2026-09-26, thay Quicksand + Nunito dùng trước đó). Phân biệt tiêu đề với nội dung bằng độ đậm và cỡ chữ chứ không bằng hai họ chữ khác nhau. Vẫn giữ 2 token riêng `--font-heading` / `--font-body` trong `css/style.css` để sau này muốn quay lại dùng 2 họ chữ thì không phải sửa khắp file; **luôn dùng token, không viết thẳng tên font vào rule** (trước khi đổi, toàn dự án chỉ có đúng 2 chỗ khai báo tên font nên đổi rất gọn, giữ nguyên nếp đó). Mật độ chữ dày theo phong cách admin tool/CRM chuyên nghiệp.
- **Bo góc & spacing:** bo góc mềm (rounded), khoảng cách khối gọn, tối ưu hiển thị nhiều thông tin trong một màn hình.
- **Phân hệ khách hàng:** cùng ngôn ngữ màu sắc/typography với Admin nhưng layout thoáng và đơn giản hơn — "Trải nghiệm đơn giản – Đẹp mắt – Dễ sử dụng".

Danh mục dịch vụ chính hiển thị trên trang khách hàng: xem `CLAUDE.md` (5 nhóm cố định, ưu tiên hơn ảnh tham chiếu nếu có xung đột).

## Responsive & Animation (bắt buộc)

- **Mobile-friendly:** toàn bộ giao diện — cả phân hệ khách hàng lẫn Admin/CRM — phải responsive, không vỡ layout và không cần cuộn ngang ở kích thước mobile/tablet. Áp dụng cho mọi màn hình mới, không chỉ trang chủ.
- **Animation khi scroll:** mọi section (trang chủ, dịch vụ, concept, và các trang công khai khác) phải có hiệu ứng khi cuộn tới (scroll-reveal/fade-in...); dùng nhất quán một kiểu hiệu ứng, không lạm dụng tới mức ảnh hưởng hiệu năng hoặc gây rối mắt. Phân hệ Admin/CRM (dạng dashboard, mật độ thông tin cao) có thể tối giản animation hơn phân hệ khách hàng.
- Xác minh hai yêu cầu trên sau mỗi lần code/sửa UI bằng skill `verify-ui-change`, không tự cho là đạt chỉ vì code không lỗi.

## Trang chủ công khai — đối chiếu với website thật (alohababy.vn)

Website hiện tại của studio (alohababy.vn) đã được đối chiếu để lấy đúng cấu trúc/nội dung cho trang chủ — xác nhận cùng địa chỉ và hotline với tài liệu dự án nên đây chính là trang chính chủ, không phải bên thứ ba. **Quyết định đã chốt:** giữ nguyên bảng màu hồng/rose theo 4 ảnh tham chiếu (không đổi sang cam/vàng như bản hiện tại ngoài đời), chỉ đối chiếu **nội dung, cấu trúc, bố cục** — đây là quyết định đã hỏi và được người dùng xác nhận, không cần hỏi lại.

- **Menu công khai (7 mục, đúng thứ tự):** Trang chủ, Giới thiệu, Dịch vụ (dropdown liệt kê 5 dịch vụ), Báo giá, Khuyến mại, Tin tức, Album ảnh đẹp.
- **Section trang chủ nên có** (tham khảo thứ tự thực tế, có điều chỉnh cho mục tiêu số hóa của dự án): **Hero Banner 5 dịch vụ** (từ 2026-09-25 là section đầu tiên, mỗi dịch vụ mở danh sách concept album `#/album/<dịch vụ>`, mỗi concept mở toàn bộ ảnh `#/album/<dịch vụ>/<concept>`, dữ liệu `js/albums.js`) → (các thẻ Album/Concept/Video/Tin tức/Giới thiệu/Chụp tại nhà mở tầng nội dung chi tiết `#/noi-dung/<slug>` hoặc album concept, xem công khai, dữ liệu `js/content.js`) → Giới thiệu ngắn (Hero cũ "Lưu giữ từng khoảnh khắc...", giữ nguyên nội dung) → Album ảnh đẹp → Concept (giữ — hỗ trợ luồng đặt lịch, không có bản gốc nhưng phục vụ mục tiêu số hóa) → Chụp ảnh tại nhà (dịch vụ thực tế ngoài 5 dịch vụ chính) → Giới thiệu studio → Video giới thiệu → Quy trình đặt lịch (giữ — thể hiện tính năng mới, không có bản gốc) → Tin tức - Sự kiện → CTA đặt lịch → Footer.
- **Không dùng:** mục "Testimonials/đánh giá khách hàng" dạng card riêng — không có trên bản gốc, đã bỏ để bám sát thực tế hơn là tự thêm chi tiết marketing không có căn cứ.
- Footer nên có thêm cột Chính sách (Chính sách đổi trả, Bảo mật, Điều khoản dịch vụ) theo đúng bản gốc.
- Nội dung text (tagline, mô tả) phải được viết lại bằng ngôn từ riêng khi tham khảo trang thật — không copy nguyên văn câu chữ marketing của họ; chỉ tái sử dụng thông tin factual (tên dịch vụ, địa chỉ, hotline, cấu trúc).
- Ảnh minh họa: **đã đổi từ gradient/icon SVG sang ảnh chụp thật** ở các khu vực ảnh là yếu tố bán hàng chính (Hero, Dịch vụ, Album, Concept, Giới thiệu, Video) — nguồn là ảnh stock miễn phí bản quyền (Unsplash/Pexels license, được phép dùng thương mại), lưu tại `images/`, **không phải ảnh thật của ALOHA Baby**. Đây vẫn là placeholder tạm thời chờ ảnh thật của studio, chỉ khác gradient/icon ở chỗ trông chuyên nghiệp/đúng ngữ cảnh hơn khi demo. Không hotlink hay tải ảnh thật từ alohababy.vn. Caption/album cố tình dùng mô tả phong cách (ví dụ "Newborn nhẹ nhàng") thay vì tên khách hàng cụ thể hay số liệu ảnh, để không tạo cảm giác đây là dữ liệu khách hàng thật.
- Section "Dịch vụ chụp ảnh tại nhà" đã **tích hợp vào cuối khối Dịch vụ** (`.services-extra`, thanh ngang gọn) thay vì một section riêng cao bằng viewport — giảm lặp CTA và giữ mạch trang liền hơn, nội dung/đường dẫn giữ nguyên.

**Đối chiếu thêm với ảnh chụp thật (`alohababy.vn.png`, do người dùng cung cấp):** ảnh chỉ 120×1131px (rất thấp phân giải theo chiều ngang) nên chỉ dùng được để xác nhận bố cục tổng thể, không lấy chi tiết pixel. Quan sát đáng tin cậy:
- Topbar và footer dùng nền màu đậm tương phản (không phải hồng) — khớp với cách dự án đang dùng nền navy đậm cho `.topbar`/`.site-footer`, giữ nguyên.
- Section "Dịch vụ" trình bày bằng ảnh thật lớn kết hợp mosaic nhiều ảnh nhỏ bên cạnh — khác với card-icon đơn giản đang dùng; khi có ảnh thật nên cân nhắc đổi sang bố cục ảnh lớn + mosaic 5 ô (mỗi ô một dịch vụ), miễn vẫn giữ rõ tên cả 5 dịch vụ.
- Có một dải "Album đặc biệt" dạng nhiều ảnh vuông nhỏ liền nhau (mosaic ngang), khác với 3 card lớn kèm caption.
- Có nút chat nổi (Messenger/Zalo) ở góc màn hình, tách biệt với nút đặt lịch nổi.
- Có một khối nội dung dạng bài viết dài xen ảnh minh họa (khả năng là bài viết/tin tức nổi bật được nhúng) — không bắt buộc tái tạo nguyên khối này, phần "Tin tức - Sự kiện" dạng card ngắn đã đủ đại diện.

## Chuẩn tinh chỉnh UI/UX (đã áp dụng, giữ nguyên khi thêm nội dung mới)

Sau một lượt rà soát UI/UX theo hướng "anti-slop" (tránh cảm giác giao diện rập khuôn AI), các quy ước sau đã áp dụng cho toàn site và nên giữ khi thêm section/trang mới:

- **Không dùng em-dash "—"** trong mọi nội dung hiển thị cho người dùng (heading, đoạn mô tả, nút, chatbot, thông báo) — dùng dấu phẩy hoặc tách câu bằng dấu chấm thay thế. Dấu "—" chỉ còn dùng làm placeholder giá trị rỗng trong bảng tóm tắt đặt lịch (view `#/dat-lich` trong `index.html`), không dùng trong văn bản.
- **Nhãn "eyebrow" (badge hồng nhỏ phía trên tiêu đề section) giới hạn tối đa 1/3 section** — trang chủ hiện chỉ giữ ở Hero, Concept, Quy trình; các section khác bỏ hẳn vì tiêu đề `<h2>` đã đủ rõ nghĩa, tránh lặp mô-típ "badge + heading" ở mọi section.
- **Không lặp lại cùng một bố cục 3-4 card giống hệt nhau** quá 1 lần trên trang — section "Tin tức" đã đổi sang bố cục bất đối xứng (thẻ đầu nổi bật, 2 thẻ nhỏ xếp cạnh), section "Quy trình" có thêm đường nối giữa 4 bước để thể hiện tính tuần tự thay vì 4 khối rời rạc.
- **Không để lộ đường dẫn file nội bộ** (`.claude/rules/...`) trong nội dung khách hàng nhìn thấy — mọi tham chiếu tới rule file phải nằm trong HTML comment, không nằm trong text hiển thị.
- Nút bấm có trạng thái `:active` (nhấn nhẹ scale) để tạo cảm giác phản hồi vật lý, không chỉ có `:hover`.

## Đăng nhập & phân quyền: 2 giao diện (Khách hàng / Ban quản trị) — đã triển khai

Site tĩnh chưa có backend nên đăng nhập/phân quyền chỉ mô phỏng bằng JS phía client (giống cách `dat-lich.js` mô phỏng real-time) — không phải xác thực bảo mật thật, ghi rõ trong comment đầu `js/auth.js`.

**Quyết định đã chốt (sửa lại từ bản đầu dùng 3 file CRM riêng + form chọn vai trò dạng thẻ):** chỉ 2 giao diện thật sự — **Khách hàng** (gộp chung 1 file `index.html`, xem mục SPA bên dưới) và **Ban quản trị** (1 file `crm/admin.html` dùng chung cho cả Sale/CSKH, Thợ ảnh, Sếp, hiển thị nội dung khác nhau theo quyền thay vì 3 trang tách rời). `login.html` dùng đúng 1 form kiểu tài khoản/mật khẩu (tham khảo bố cục đăng nhập của kinhlac.online: card giữa trang, SĐT + mật khẩu có nút "Hiện/Ẩn", không copy nội dung/màu sắc của họ) — hệ thống tự nhận diện loại tài khoản theo SĐT/mật khẩu nhập vào rồi điều hướng đúng giao diện, người dùng không tự chọn vai trò bằng tay.

- `login.html`: 1 form SĐT + mật khẩu. Vì chưa có backend, dùng danh sách tài khoản demo hardcode trong file (hiển thị công khai ngay dưới form để tự test): `0900000001/khach123` → Khách hàng, `0900000002/sale123` → Sale, `0900000003/anh123` → Thợ ảnh, `0900000004/sep123` → Sếp. Sai tài khoản/mật khẩu → báo lỗi inline, không alert().
- `js/auth.js` (`window.AlohaAuth`): lưu phiên vào `localStorage` key `aloha_auth` (nay có thêm field `phone` để định danh khách hàng); `requireRole(allowedRoles)` gọi ở đầu `<body>` của `crm/admin.html` — chưa đăng nhập thì về `login.html`, sai vai trò thì đẩy về đúng trang đích (`roleHome`) của họ, không cho ở lại. `roleHome()`: Khách hàng → `index.html#/chon-anh` (route hash, không phải file riêng), cả 3 vai trò nội bộ (Sale/Thợ ảnh/Sếp) → cùng `crm/admin.html`.
- `crm/admin.html` + `crm/js/admin.js`: 1 file duy nhất cho khu vực nội bộ. Mỗi tab nav và mỗi `<section>` có `data-roles="sep sale"` kiểu vậy; `admin.js` đọc vai trò đang đăng nhập rồi xoá khỏi DOM các tab/section không thuộc quyền (không chỉ ẩn bằng CSS — để không lộ nội dung trong DOM). Phân quyền theo section:
  - **Dashboard (KPI + biểu đồ + phễu), Doanh thu, Cài đặt:** chỉ Sếp. (Mục "Concept" trong Admin đã bỏ khỏi giao diện Sếp ngày 2026-09-25 theo yêu cầu người dùng - kho concept chỉ còn hiển thị ở trang khách hàng.)
  - **Khách hàng/CRM, Lịch hẹn:** Sếp + Sale — nhưng bảng Khách hàng render 2 kiểu cột khác nhau từ **cùng một mảng dữ liệu** (đúng nguyên tắc 1 nguồn CRM dùng ở nhiều nơi): Sếp thấy Tên/SĐT/Nguồn khách/Trạng thái/Ngày tạo/Ghi chú đầy đủ; Sale thấy Liên hệ (gộp tên+SĐT)/Nguồn khách/Lịch sử lịch hẹn (rút gọn)/Ghi chú tư vấn, không có cột trạng thái vận hành nội bộ, không có doanh thu/thanh toán.
  - **Quản lý chụp & chỉnh ảnh (kanban):** Sếp + Thợ ảnh — đúng phạm vi "Thợ ảnh chỉ dùng phần ảnh khách yêu cầu chỉnh sửa để trả ảnh đã hậu kỳ".
- `css/admin.css` là file CSS riêng cho khu vực quản trị (topnav, bảng dữ liệu, badge trạng thái, biểu đồ CSS thuần, kanban) — tách khỏi `pages.css` (ngôn ngữ "thoáng, đơn giản" của các trang khách hàng), nhưng vẫn dùng chung token từ `style.css`.

## Trang khách hàng: 1 file `index.html` dạng SPA nhỏ (đã gộp, xem `js/router.js`)

Người dùng nhận ra 3 file `index.html`/`dat-lich.html`/`chon-anh.html` bị lặp lại gần như y hệt phần khung (topbar/nav/footer/chat, ~40-50% mỗi file) do site tĩnh không có template — đã yêu cầu gộp lại còn **1 file duy nhất** cho phần khách hàng, giữ riêng `login.html` (cổng vào chung, không thuộc riêng khách hàng) và `crm/admin.html` (đối tượng/nghiệp vụ khác hẳn).

- **Cách gộp:** `index.html` giờ chứa 3 `<div id="view-...">` (`view-home`, `view-dat-lich`, `view-chon-anh`) trong cùng 1 `<main>`, ẩn/hiện bằng thuộc tính `hidden` — chỉ 1 khung topbar/nav/footer/chat-panel dùng chung (trước đây mỗi file có bản sao riêng, đã xoá trùng lặp ID `chatPanel`/`chatBody`/`navLinks`/`year`... khi gộp).
- **Router (`js/router.js`, script mới):** dùng `location.hash`, quy ước `#/` = trang chủ, `#/dat-lich`, `#/chon-anh` = 2 view còn lại; các neo cuộn trong trang chủ (`#dich-vu`, `#gioi-thieu`, `#album`, `#tin-tuc`) KHÔNG có dấu `/` nên không bị coi là route. Gate quyền cho `#/dat-lich`/`#/chon-anh` nằm trực tiếp trong router (không dùng `AlohaAuth.requireRole()` vì hàm đó giả định điều hướng full-page theo tên file).
- **`next` param của `login.html`** đổi từ tên file (`next=dat-lich.html`) sang tên route (`next=dat-lich`), khi đăng nhập/đăng ký thành công sẽ điều hướng `index.html#/<route>`.
- `js/dat-lich.js` và `js/chon-anh.js` giữ nguyên logic nghiệp vụ 100%, không đổi — chỉ không còn tự gọi `AlohaAuth.requireRole()` riêng (đã chuyển vào router) và luôn chạy ở `DOMContentLoaded` bất kể view nào đang hiện (đã guard sẵn bằng kiểm tra element tồn tại, không lỗi khi view đang ẩn).
- Mọi `href="dat-lich.html"`/`href="chon-anh.html"` trong toàn site (nav, hero CTA, mosaic dịch vụ, floating button, footer, chatbot) đã đổi thành `href="#/dat-lich"`/`href="#/chon-anh"`.

## Vấn đề đã biết trong ảnh demo hiện tại (cần sửa khi triển khai)

Đối chiếu 4 ảnh tham chiếu với yêu cầu nghiệp vụ, các điểm sau đã được studio xác nhận là cần sửa — không phải suy đoán:

- Demo hiện dùng tên/logo **"Memory Studio"** — phải đổi toàn bộ sang ALOHA Baby, tông màu hồng – xanh, giữ các mục công khai hiện có (Giới thiệu, Báo giá, Khuyến mại, Album ảnh đẹp).
- Demo có **4 nhóm dịch vụ** (Ảnh bầu, gia đình, bé lớn, bé nhỏ) — phải đổi thành đủ **5 nhóm**: Bé lớn, Sinh nhật, Bầu, Gia đình, Newborn.
- Thanh tiến trình đặt lịch trong demo **kết thúc ở "Xác nhận"** — phải thêm bước Đặt cọc sau đó (xem `workflow.md`).
- Form đặt lịch trong demo mới có ô "Ghi chú thêm" — phải bổ sung đủ: ngày sinh/dự sinh của bé, số người trong ảnh, lưu ý sức khỏe.
- Demo mới có tab Đổi lịch hẹn, **chưa có màn hình thật** — phải thiết kế đủ: lịch cũ, lịch mới, khung giờ, lý do dời, trạng thái/điều kiện duyệt.
- Số liệu Dashboard trong demo **sai logic phễu** (ví dụ thực tế: "Hoàn thành" 215/60% lớn hơn "Đã chụp" 28) — đây là lỗi cần tránh, không dùng làm mẫu; dashboard thật phải đảm bảo phễu giảm dần đúng thứ tự trạng thái (`tech-defaults.md`).

## Customer Features

- Đăng ký/đăng nhập bằng email hoặc SĐT, ghi nhớ đăng nhập, quên mật khẩu.
- Trang chủ: banner, 5 nhóm dịch vụ, menu công khai, tìm kiếm, thông báo, nút Đặt lịch.
- Concept: thư viện concept (biển, Noel, sinh nhật, vintage, Hàn Quốc, ngoại cảnh...), nút "Tư vấn concept ngay", có thể đi thẳng từ concept sang luồng đặt lịch.
- Quản lý lịch hẹn: tab Đặt lịch chụp, tab Đổi lịch hẹn, danh sách lịch đã đặt kèm trạng thái.
- Ảnh của tôi: Tất cả / Ảnh gốc / Ảnh chỉnh sửa / Yêu thích, lọc theo buổi chụp, thả tim để chọn ảnh, gửi yêu cầu chỉnh sửa, theo dõi dung lượng lưu trữ đã dùng.

## Admin / CRM Features

- **Dashboard:** thẻ chỉ số khách hàng theo trạng thái, biểu đồ khách hàng mới, phễu khách hàng, lọc theo thời gian, doanh thu và chỉ số vận hành (logic nhất quán: `tech-defaults.md`). Ba khối này có hiệu ứng khi cuộn tới (số đếm tăng, sparkline vẽ dần, cột mọc lên, thanh phễu chạy ngang) - dùng chung 3 helper `onEnterView`/`countUp`/`drawStroke` trong `crm/js/admin.js` với mục Doanh thu, đừng viết lại cơ chế riêng cho khối mới. Hiệu ứng **chạy lại mỗi lần người dùng bấm mục Dashboard trên menu** (người dùng yêu cầu 2026-09-25), không chỉ 1 lần lúc cuộn tới: khai báo khối mới bằng `registerAnim(sectionId, wrap, reset, play)` với `sectionId` là href thật của mục menu (Dashboard là `kpi`), đừng gọi thẳng `onEnterView` nữa. Mọi hiệu ứng phải tắt khi người dùng bật `prefers-reduced-motion` và nội dung vẫn hiện đầy đủ.
- **Khách hàng/CRM:** danh sách (tên, SĐT, nguồn, trạng thái, ngày tạo, ghi chú), tìm kiếm, lọc theo trạng thái, thêm/xem/sửa hồ sơ.
- **Lịch hẹn:** **lịch tháng** (lưới 7 cột CN→Thứ 7, mỗi ô là một ngày chứa các lịch hẹn xếp theo giờ từ sớm tới muộn, màu theo trạng thái, ô hôm nay nổi bật hẳn: nền hồng nhạt, viền hồng bao quanh ô, chấm số ngày to hơn và nhãn chữ "Hôm nay", tên thứ ở đầu cột cũng tô theo - người dùng yêu cầu 2026-09-25) kèm thanh điều hướng Hôm nay / tháng trước / tháng sau; bấm một lịch hẹn mở popup chi tiết: khách hàng + SĐT, giờ và ngày đầy đủ, dịch vụ, gói chụp, concept, ekip phụ trách, ghi chú. Người dùng chốt 2026-09-25, thay cho bảng danh sách + 3 tab Sắp tới/Hôm nay/Đã qua trước đây. Khung lịch cao theo khung nhìn và mọi ô ngày cao bằng nhau, ô nào chứa không hết thì hiện nút "+N lịch nữa" mở popup cả ngày - để xem được trọn tháng mà không phải cuộn (người dùng yêu cầu 2026-09-25). Màn ≤760px đổi sang danh sách theo ngày vì lưới 7 cột không đọc nổi trên điện thoại. Thao tác duyệt yêu cầu đổi lịch và phân công ekip vẫn chưa có màn hình thật.
- **Quản lý chụp & chỉnh ảnh:** Chờ xử lý / Đang thực hiện / Hoàn thành, gắn với khách hàng và loại ảnh.
- ~~**Concept:** kho concept, số bộ ảnh mẫu, thêm concept mới.~~ Đã bỏ khỏi Admin (2026-09-25, người dùng yêu cầu gỡ mục Concept khỏi giao diện Sếp). Nếu sau này cần quản lý concept trong Admin thì phải dựng lại, đây là quyết định ngược với mô tả yêu cầu ban đầu nên cần xác nhận rõ trước khi làm.
- **Doanh thu:** 4 thẻ KPI (tổng doanh thu tháng, số đơn hoàn thành, giá trị trung bình/đơn, % đạt mục tiêu) mỗi thẻ kèm sparkline và mức tăng giảm so tháng trước; biểu đồ đường theo tháng có 3 tab đổi chỉ số (Doanh thu/Số đơn/Giá trị TB) và tooltip khi rê chuột; khối mục tiêu tháng dạng thanh tiến độ. Bố cục tham khảo ảnh dashboard analytics người dùng cung cấp 2026-09-25 nhưng **giữ nguyên bảng màu hồng/navy sáng** (người dùng chốt, không dùng dark theme của ảnh gốc) - nếu sau này muốn đổi sang dark thì phải đổi cho cả 6 mục còn lại chứ không riêng mục này. Các chart có hiệu ứng vẽ dần / đếm số / chạy thanh khi cuộn tới **và mỗi lần bấm lại mục Doanh thu trên menu** (người dùng yêu cầu 2026-09-25), đều tắt khi người dùng bật `prefers-reduced-motion`.
- **Cài đặt:** gói dịch vụ, mức cọc, khung giờ làm việc, chính sách dời/hủy lịch, tài khoản nhân viên (giá trị cụ thể: `tech-defaults.md`).
