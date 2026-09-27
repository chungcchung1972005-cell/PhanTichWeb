// ALOHA Baby — Trang nội dung chi tiết (route #/noi-dung/<slug>, xem js/router.js).
// "Tầng nội dung" thứ 2 cho các thẻ trên Trang chủ vốn chỉ có tiêu đề + 1 dòng mô
// tả: 5 ô Concept, Video giới thiệu, Giới thiệu studio, Chụp tại nhà, 3 bài Tin tức.
//
// THÊM TRANG MỚI: thêm 1 object vào mảng PAGES bên dưới rồi trỏ link tới
// "#/noi-dung/<slug>". Không cần sửa HTML/CSS.
//   slug     : viết thường, không dấu, nối bằng gạch ngang (dùng trong link)
//   crumb    : { label, href } mục cha trên breadcrumb (neo cuộn trong Trang chủ)
//   eyebrow, title, lead : nhãn nhỏ, tiêu đề (h1), đoạn mở đầu
//   cover    : ảnh lớn đầu bài (đường dẫn) HOẶC coverFrom: 'dịch vụ/concept' (lấy ảnh bìa album)
//   thumb    : (tuỳ chọn) ảnh nhỏ cho thẻ "bài liên quan" khi trang không có ảnh bìa
//   blocks   : danh sách khối nội dung, hiển thị theo đúng thứ tự:
//     { type: 'heading', text }                  tiêu đề phụ (h2)
//     { type: 'text', text }                     đoạn văn (được dùng thẻ <a>, <strong>)
//     { type: 'list', items: [...] }             danh sách gạch đầu dòng
//     { type: 'steps', items: [{ title, text }] } các bước đánh số
//     { type: 'image', src, alt, caption }       1 ảnh
//     { type: 'video', src, poster, caption }    1 video (file .mp4 trong images/videos/)
//     { type: 'gallery', items, from, limit }    album ảnh/video, bấm để xem lớn (lightbox).
//         items: ảnh 'đường/dẫn.jpg' | { src, alt } | video { video, poster, alt }, KHÔNG giới hạn số lượng
//         from : ['newborn/cuon-u', ...] lấy thêm ảnh từ album concept trong js/albums.js
//         limit: số ô tối đa (bỏ trống = hiện hết)
//     { type: 'albums', refs: ['bau/bien', 'newborn', ...] } thẻ dẫn sang album concept/dịch vụ
//     { type: 'note', text }                     ghi chú nhỏ (lưu ý, nguồn ảnh...)
//   related  : ['slug', ...] các trang liên quan hiện ở cuối bài
//
// Chữ trong PAGES do dev viết (không phải dữ liệu người dùng nhập) nên được chèn
// thẳng dạng HTML. Không đặt số liệu nghiệp vụ chưa chốt (mức cọc, thời gian giữ
// chỗ, chính sách dời lịch...) vào đây, xem .claude/rules/tech-defaults.md.
// Video trong images/videos/ là video stock minh hoạ (Pexels License), nguồn ở
// images/videos/sources.json; trang nào có ảnh/video minh hoạ thì ghi chú rõ.
(function (window, document) {
  const V = 'images/videos/';
  const VIDEO_NOEL = { video: V + 'hau-truong-noel.mp4', poster: V + 'hau-truong-noel.jpg', alt: 'Video hậu trường chụp concept Noel cho bé' };
  const VIDEO_NEWBORN = { video: V + 'newborn-trong-gio.mp4', poster: V + 'newborn-trong-gio.jpg', alt: 'Video bé newborn ngủ trong giỏ' };
  const VIDEO_BIRTHDAY = { video: V + 'sinh-nhat-gia-dinh.mp4', poster: V + 'sinh-nhat-gia-dinh.jpg', alt: 'Video gia đình mừng sinh nhật bé' };
  const NOTE_STOCK = 'Ảnh và video trên trang là tư liệu minh hoạ phong cách chụp, không phải ảnh khách hàng thật của studio.';
  const ALL_SERVICES = ['newborn', 'bau', 'sinh-nhat', 'be-lon', 'gia-dinh'];

  const CRUMB_CONCEPT = { label: 'Concept', href: '#concept' };
  const CRUMB_NEWS = { label: 'Tin tức', href: '#tin-tuc' };

  const PAGES = [
    // ------------------------------------------------ Video / Giới thiệu / Dịch vụ tại nhà
    {
      slug: 'mot-ngay-tai-aloha',
      crumb: { label: 'Video giới thiệu', href: '#video' },
      eyebrow: 'Video hậu trường',
      title: 'Một ngày tại ALOHA Baby',
      lead: 'Từ lúc bé đến studio, làm quen, thay trang phục, lên hình cho tới khi ba mẹ nhận bộ ảnh hoàn thiện.',
      thumb: 'images/video-poster.jpg',
      blocks: [
        { type: 'video', src: VIDEO_NOEL.video, poster: VIDEO_NOEL.poster, caption: 'Hậu trường một buổi chụp concept Noel cho bé.' },
        { type: 'heading', text: 'Một buổi chụp diễn ra thế nào?' },
        { type: 'steps', items: [
          { title: 'Đón bé và làm quen', text: 'Ekip dành thời gian đầu buổi để bé quen với không gian, ánh đèn và những gương mặt mới. Bé thoải mái thì ảnh mới tự nhiên.' },
          { title: 'Thay trang phục theo concept', text: 'Stylist chuẩn bị trang phục theo concept ba mẹ đã chọn, người lớn trong ảnh được makeup nhẹ nếu cần.' },
          { title: 'Lên hình', text: 'Photographer chụp lần lượt từng bối cảnh. Trợ lý luôn ở cạnh bé, bé cần ăn, ngủ hay nghỉ thì cả ekip chờ bé.' },
          { title: 'Chọn ảnh trên website', text: 'Sau buổi chụp, ảnh gốc được tải lên mục "Ảnh của tôi". Ba mẹ thả tim chọn ảnh và ghi chú chỉnh sửa ngay trên web.' },
          { title: 'Nhận ảnh hoàn thiện', text: 'Theo dõi tiến độ chỉnh sửa (Chờ xử lý, Đang thực hiện, Hoàn thành) và nhận thông báo khi ảnh đã sửa xong.' }
        ] },
        { type: 'heading', text: 'Thêm vài khoảnh khắc' },
        { type: 'gallery', items: [VIDEO_NEWBORN, VIDEO_BIRTHDAY], from: ['newborn/cuon-u', 'sinh-nhat/le-hoi', 'gia-dinh/dong-phuc'], limit: 11 },
        { type: 'note', text: NOTE_STOCK }
      ],
      related: ['gioi-thieu-studio', 'chup-tai-nha', 'huong-dan-dat-lich']
    },
    {
      slug: 'gioi-thieu-studio',
      crumb: { label: 'Giới thiệu', href: '#gioi-thieu' },
      eyebrow: 'Về ALOHA Baby',
      title: 'Một "thiên đường" nhỏ dành cho tuổi thơ của bé',
      lead: 'Studio chụp ảnh dành riêng cho em bé và gia đình tại 35 Lê Văn Thiêm, Thanh Xuân, Hà Nội.',
      cover: 'images/about-studio.jpg',
      blocks: [
        { type: 'text', text: 'ALOHA Baby đồng hành cùng ba mẹ lưu lại những cột mốc đầu đời của con: từ những tháng mang bầu, những ngày đầu tiên của bé, các mốc sinh nhật cho tới khi con lớn và cả nhà cùng chụp chung một khung hình.' },
        { type: 'heading', text: 'Điều ba mẹ nhận được' },
        { type: 'list', items: [
          '<strong>Không gian rộng rãi</strong>, phòng chụp newborn giữ nhiệt độ ấm, an toàn cho bé.',
          '<strong>Ekip quen làm việc với trẻ nhỏ</strong>: photographer và stylist kiên nhẫn chờ bé ăn, ngủ, chơi để có ảnh tự nhiên nhất.',
          '<strong>Mọi thứ trên website</strong>: đặt lịch, chọn ảnh, gửi yêu cầu chỉnh sửa và theo dõi tiến độ trực tuyến.',
          '<strong>Bảo mật hình ảnh của bé</strong>: ảnh chỉ xem được qua tài khoản của gia đình.'
        ] },
        { type: 'heading', text: '5 dịch vụ đồng hành cùng con lớn khôn' },
        { type: 'albums', refs: ALL_SERVICES },
        { type: 'heading', text: 'Ghé thăm studio' },
        { type: 'text', text: 'Địa chỉ: <strong>35 Lê Văn Thiêm, Thanh Xuân, Hà Nội</strong>. Hotline: <a href="tel:0938125222">0938.125.222</a>. Ba mẹ nên đặt lịch trước để studio chuẩn bị bối cảnh và ekip phù hợp với bé. Không tiện đến studio? Xem dịch vụ <a href="#/noi-dung/chup-tai-nha">chụp ảnh tại nhà</a>.' }
      ],
      related: ['mot-ngay-tai-aloha', 'vi-sao-chon-aloha', 'chup-tai-nha']
    },
    {
      slug: 'chup-tai-nha',
      crumb: { label: 'Dịch vụ', href: '#dich-vu' },
      eyebrow: 'Dịch vụ tại nhà',
      title: 'Chụp ảnh tại nhà cùng ALOHA Baby',
      lead: 'Ekip mang máy ảnh, ánh sáng và phông nền đến tận nhà, giúp bé thoải mái nhất trong không gian quen thuộc.',
      coverFrom: 'gia-dinh/vintage',
      blocks: [
        { type: 'heading', text: 'Khi nào nên chọn chụp tại nhà?' },
        { type: 'list', items: [
          'Bé newborn còn quá nhỏ, ba mẹ chưa muốn đưa bé ra ngoài.',
          'Mẹ vừa sinh, cần nghỉ ngơi và hạn chế di chuyển.',
          'Gia đình có ông bà lớn tuổi, ngại đi lại.',
          'Ba mẹ muốn lưu lại góc nhà, căn phòng của bé như một phần kỷ niệm.'
        ] },
        { type: 'heading', text: 'Nhà mình cần chuẩn bị gì?' },
        { type: 'list', items: [
          'Một góc phòng thoáng, gần cửa sổ có ánh sáng tự nhiên càng tốt.',
          'Với bé newborn: giữ phòng ấm, không để quạt hay điều hoà thổi thẳng vào bé.',
          'Cho bé ăn no, thay tã trước giờ ekip đến.',
          'Để sẵn quần áo, đồ vật có ý nghĩa muốn đưa vào ảnh (gối, chăn, đồ chơi của bé...).'
        ] },
        { type: 'text', text: 'Trang phục và đạo cụ theo concept: ba mẹ trao đổi trước với Sale để ekip chuẩn bị mang theo.' },
        { type: 'heading', text: 'Khung hình trong không gian nhà' },
        { type: 'gallery', from: ['gia-dinh/vintage', 'newborn/cung-bo-me', 'gia-dinh/nhieu-the-he'], limit: 12 },
        { type: 'note', text: 'Khu vực phục vụ, chi phí di chuyển và lịch trống cho buổi chụp tại nhà: Sale tư vấn riêng cho từng gia đình. Khi đặt lịch, ba mẹ ghi "chụp tại nhà" ở mục Ghi chú thêm. ' + NOTE_STOCK }
      ],
      related: ['newborn-thoi-diem', 'mot-ngay-tai-aloha', 'huong-dan-dat-lich']
    },

    // ------------------------------------------------ Concept (5 ô "Thư viện concept")
    {
      slug: 'concept-bien',
      crumb: CRUMB_CONCEPT,
      eyebrow: 'Concept',
      title: 'Concept Biển',
      lead: 'Nắng, gió và sóng biển cho những bộ ảnh tươi sáng, phóng khoáng.',
      coverFrom: 'bau/bien',
      blocks: [
        { type: 'text', text: 'Concept biển hợp với ảnh bầu váy dài bay trong gió, cả nhà vui đùa trên bãi cát, hay bé lớn thích chạy nhảy ngoài trời.' },
        { type: 'heading', text: 'Hợp với ai?' },
        { type: 'list', items: [
          'Mẹ bầu thích ảnh váy dài nhẹ nhàng, nhiều ánh nắng.',
          'Gia đình có bé đã tự đi được, thích nghịch cát, nghịch nước.',
          'Ba mẹ thích ảnh ngoài trời, màu sắc tươi sáng, tự nhiên.'
        ] },
        { type: 'heading', text: 'Gợi ý chuẩn bị' },
        { type: 'list', items: [
          'Trang phục màu sáng hoặc trắng, chất liệu nhẹ để bay trong gió.',
          'Chụp sáng sớm hoặc chiều muộn để nắng dịu, bé không bị chói mắt.',
          'Mang kem chống nắng, mũ, nước uống và quần áo thay cho bé.'
        ] },
        { type: 'heading', text: 'Ảnh tham khảo' },
        { type: 'gallery', from: ['bau/bien', 'gia-dinh/bien', 'be-lon/ngoai-canh'], limit: 12 },
        { type: 'heading', text: 'Xem trọn album' },
        { type: 'albums', refs: ['bau/bien', 'gia-dinh/bien', 'be-lon/ngoai-canh'] },
        { type: 'note', text: 'Buổi chụp ngoại cảnh biển cần sắp xếp lịch trình và di chuyển riêng. Địa điểm, thời gian và chi phí phát sinh: Sale tư vấn theo từng gia đình. ' + NOTE_STOCK }
      ],
      related: ['concept-vintage', 'concept-han-quoc', 'concept-sinh-nhat']
    },
    {
      slug: 'concept-noel',
      crumb: CRUMB_CONCEPT,
      eyebrow: 'Concept',
      title: 'Concept Giáng sinh (Noel)',
      lead: 'Mũ ông già Noel, cây thông và ánh đèn lấp lánh cho mùa lễ hội ấm áp.',
      coverFrom: 'sinh-nhat/le-hoi',
      blocks: [
        { type: 'video', src: VIDEO_NOEL.video, poster: VIDEO_NOEL.poster, caption: 'Hậu trường chụp concept Noel cho bé.' },
        { type: 'heading', text: 'Hợp với ai?' },
        { type: 'list', items: [
          'Bé đã ngồi vững cho tới bé lớn, diện đồ ông già Noel, tuần lộc, người tuyết.',
          'Gia đình muốn có ảnh làm thiệp mừng Giáng sinh, năm mới gửi người thân.',
          'Bé có sinh nhật vào cuối năm, muốn kết hợp cả hai dịp trong một buổi.'
        ] },
        { type: 'heading', text: 'Gợi ý chuẩn bị' },
        { type: 'list', items: [
          'Đỏ, trắng và xanh lá là bộ màu dễ phối nhất; cả nhà có thể mặc áo len cùng tông.',
          'Mùa lễ cuối năm thường đông lịch, ba mẹ nên đặt lịch sớm để chọn được khung giờ đẹp.'
        ] },
        { type: 'heading', text: 'Ảnh tham khảo' },
        { type: 'gallery', from: ['sinh-nhat/le-hoi'], limit: 12 },
        { type: 'heading', text: 'Xem trọn album' },
        { type: 'albums', refs: ['sinh-nhat/le-hoi', 'sinh-nhat/tiec-gia-dinh', 'gia-dinh/dong-phuc'] },
        { type: 'note', text: NOTE_STOCK }
      ],
      related: ['concept-sinh-nhat', 'mot-ngay-tai-aloha', 'concept-vintage']
    },
    {
      slug: 'concept-sinh-nhat',
      crumb: CRUMB_CONCEPT,
      eyebrow: 'Concept',
      title: 'Concept Sinh nhật',
      lead: 'Bóng bay, bánh kem và nụ cười của bé trong ngày đặc biệt.',
      coverFrom: 'sinh-nhat/bong-bay',
      blocks: [
        { type: 'text', text: 'Mỗi mốc tuổi của bé, từ thôi nôi, 1 tuổi, 2 tuổi trở đi, đều đáng được lưu lại. Studio có nhiều concept sinh nhật để ba mẹ chọn theo tính cách của bé: rực rỡ, nhẹ nhàng, cổ tích hay ngoài trời.' },
        { type: 'video', src: VIDEO_BIRTHDAY.video, poster: VIDEO_BIRTHDAY.poster, caption: 'Cả nhà mừng sinh nhật bé.' },
        { type: 'heading', text: 'Chọn concept nào?' },
        { type: 'albums', refs: ['sinh-nhat/bong-bay', 'sinh-nhat/pastel', 'sinh-nhat/cong-chua', 'sinh-nhat/tiec-gia-dinh', 'sinh-nhat/picnic', 'sinh-nhat/trung-thu', 'sinh-nhat/le-hoi'] },
        { type: 'heading', text: 'Gợi ý chuẩn bị' },
        { type: 'list', items: [
          'Cho bé ăn và ngủ trưa đủ trước buổi chụp, bé vui thì ảnh mới tươi.',
          'Nếu muốn chụp cảnh bé "phá bánh" (cake smash), mang thêm một bộ đồ để thay.',
          'Mang theo món đồ chơi bé thích để dỗ bé cười.'
        ] },
        { type: 'heading', text: 'Ảnh tham khảo' },
        { type: 'gallery', from: ['sinh-nhat/bong-bay', 'sinh-nhat/pastel', 'sinh-nhat/cong-chua', 'sinh-nhat/picnic'], limit: 12 },
        { type: 'note', text: NOTE_STOCK }
      ],
      related: ['concept-noel', 'concept-han-quoc', 'huong-dan-dat-lich']
    },
    {
      slug: 'concept-vintage',
      crumb: CRUMB_CONCEPT,
      eyebrow: 'Concept',
      title: 'Concept Vintage',
      lead: 'Tông màu trầm ấm, cổ điển, những bức ảnh xem lại sau nhiều năm vẫn đẹp.',
      coverFrom: 'bau/vintage',
      blocks: [
        { type: 'text', text: 'Vintage không chạy theo trào lưu nên rất "bền": ảnh đen trắng, sepia hay tông nâu ấm đều giữ được cảm xúc khi xem lại sau nhiều năm. Concept này dùng được cho hầu hết các dịch vụ.' },
        { type: 'heading', text: 'Hợp với ai?' },
        { type: 'list', items: [
          'Mẹ bầu thích váy dài, phông trơn, bố cục nhẹ nhàng.',
          'Ba mẹ muốn ảnh newborn đen trắng tập trung vào bàn tay, bàn chân bé.',
          'Gia đình muốn một bức ảnh chung treo phòng khách, trang trọng mà ấm áp.'
        ] },
        { type: 'heading', text: 'Gợi ý chuẩn bị' },
        { type: 'list', items: [
          'Trang phục trơn màu, tông kem, nâu, be hoặc trắng; tránh hoạ tiết to và chữ in.',
          'Phụ kiện đơn giản: mũ cói, nơ, dây đeo quần cho bé trai.'
        ] },
        { type: 'heading', text: 'Ảnh tham khảo' },
        { type: 'gallery', from: ['bau/vintage', 'be-lon/vintage', 'gia-dinh/vintage', 'newborn/den-trang'], limit: 12 },
        { type: 'heading', text: 'Xem trọn album' },
        { type: 'albums', refs: ['bau/vintage', 'be-lon/vintage', 'gia-dinh/vintage', 'newborn/den-trang'] },
        { type: 'note', text: NOTE_STOCK }
      ],
      related: ['concept-han-quoc', 'concept-bien', 'gioi-thieu-studio']
    },
    {
      slug: 'concept-han-quoc',
      crumb: CRUMB_CONCEPT,
      eyebrow: 'Concept',
      title: 'Concept Hàn Quốc',
      lead: 'Trang phục và bối cảnh phong cách Hàn, tông màu nhẹ, bố cục tối giản.',
      coverFrom: 'be-lon/han-quoc',
      blocks: [
        { type: 'text', text: 'Phong cách Hàn Quốc chuộng ảnh sáng, trong trẻo, ít đạo cụ, để nụ cười và nét mặt của bé là điểm nhấn. Bé có thể mặc hanbok truyền thống hoặc trang phục hiện đại phong cách Hàn.' },
        { type: 'heading', text: 'Hợp với ai?' },
        { type: 'list', items: [
          'Bé từ khi biết đứng, biết đi trở lên, mặc hanbok hoặc đồ phong cách Hàn.',
          'Mẹ bầu thích bố cục tối giản, tôn dáng.',
          'Gia đình thích ảnh sáng màu, phối đồ đồng điệu.'
        ] },
        { type: 'heading', text: 'Ảnh tham khảo' },
        { type: 'gallery', from: ['be-lon/han-quoc', 'bau/toi-gian', 'gia-dinh/dong-phuc'], limit: 12 },
        { type: 'heading', text: 'Xem trọn album' },
        { type: 'albums', refs: ['be-lon/han-quoc', 'bau/toi-gian', 'gia-dinh/dong-phuc'] },
        { type: 'note', text: NOTE_STOCK }
      ],
      related: ['concept-vintage', 'concept-sinh-nhat', 'concept-bien']
    },

    // ------------------------------------------------ Tin tức (3 thẻ "Kinh nghiệm chụp ảnh")
    {
      slug: 'newborn-thoi-diem',
      crumb: CRUMB_NEWS,
      eyebrow: 'Kinh nghiệm',
      title: 'Nên chụp ảnh newborn cho bé vào thời điểm nào?',
      lead: 'Gợi ý thời điểm và cách chuẩn bị để có bộ ảnh newborn đẹp và an toàn cho bé.',
      cover: 'images/news-1.jpg',
      blocks: [
        { type: 'heading', text: 'Khoảng 5 đến 14 ngày tuổi là "thời điểm vàng"' },
        { type: 'text', text: 'Trong hai tuần đầu, bé ngủ sâu và lâu, cơ thể còn mềm, dễ cuộn tròn trong các tư thế ủ quen thuộc như khi còn trong bụng mẹ. Vì vậy phần lớn bộ ảnh newborn kiểu bé ngủ say, quấn ủ được chụp trong khoảng này.' },
        { type: 'text', text: 'Từ khoảng 3 đến 4 tuần tuổi, bé thức nhiều hơn và hay vặn mình, khó giữ tư thế cuộn tròn. Chụp muộn hơn vẫn đẹp, chỉ là phong cách khác: bé mở mắt, tương tác nhiều hơn, hợp với concept tự nhiên hoặc chụp cùng ba mẹ.' },
        { type: 'video', src: VIDEO_NEWBORN.video, poster: VIDEO_NEWBORN.poster, caption: 'Bé newborn ngủ say trong giỏ.' },
        { type: 'heading', text: 'Nên đặt lịch từ khi nào?' },
        { type: 'text', text: 'Vì khó biết trước ngày sinh chính xác, ba mẹ có thể đặt lịch từ khi còn mang bầu và điền ngày dự sinh ở bước nhập thông tin bé. Nếu bé chào đời sớm hoặc muộn hơn dự kiến, ba mẹ liên hệ Sale để được hướng dẫn đổi lịch theo chính sách hiện hành của studio.' },
        { type: 'heading', text: 'Chuẩn bị cho buổi chụp' },
        { type: 'list', items: [
          'Cho bé bú no ngay trước buổi chụp, bé no sẽ ngủ ngon và sâu hơn.',
          'Mặc cho bé đồ cài cúc phía trước, dễ cởi, tránh đồ chui đầu làm bé thức giấc.',
          'Mang theo tã, khăn, bình sữa và đồ bé quen dùng.',
          'Mẹ nên nghỉ ngơi đủ; buổi chụp newborn thường không vội vì cần chờ bé ăn, ngủ.'
        ] },
        { type: 'heading', text: 'An toàn của bé là trên hết' },
        { type: 'text', text: 'Phòng chụp newborn tại ALOHA Baby được giữ ấm để bé không bị lạnh khi cởi đồ. Ekip không ép bé vào tư thế khó; những tư thế trông "mạo hiểm" như chống cằm luôn cần người đỡ tay và được ghép ảnh ở khâu hậu kỳ, không để bé tự giữ tư thế.' },
        { type: 'heading', text: 'Concept newborn tham khảo' },
        { type: 'albums', refs: ['newborn/cuon-u', 'newborn/tu-nhien', 'newborn/cung-bo-me', 'newborn/hoa-la', 'newborn/den-trang', 'newborn/trang-sao'] },
        { type: 'note', text: 'Thông tin trong bài là kinh nghiệm tham khảo chung. Bé sinh non, nhẹ cân hoặc có vấn đề sức khỏe, ba mẹ nên hỏi ý kiến bác sĩ trước khi chụp và ghi rõ ở mục "Lưu ý sức khỏe" khi đặt lịch. ' + NOTE_STOCK }
      ],
      related: ['huong-dan-dat-lich', 'chup-tai-nha', 'vi-sao-chon-aloha']
    },
    {
      slug: 'huong-dan-dat-lich',
      crumb: CRUMB_NEWS,
      eyebrow: 'Hướng dẫn',
      title: 'Cách đặt lịch và đặt cọc chụp ảnh online tại ALOHA Baby',
      lead: 'Hướng dẫn từng bước đặt lịch, chọn concept và giữ khung giờ chụp yêu thích.',
      cover: 'images/news-2.jpg',
      blocks: [
        { type: 'heading', text: 'Trước khi đặt lịch' },
        { type: 'text', text: 'Ba mẹ cần có tài khoản để studio lưu thông tin bé và gửi ảnh sau buổi chụp; đăng ký chỉ cần số điện thoại. Chưa biết chọn concept nào? Xem trước <a href="#dich-vu">album của từng dịch vụ</a> hoặc hỏi trợ lý tư vấn trong khung chat ở góc màn hình.' },
        { type: 'heading', text: 'Đặt lịch trong 3 bước' },
        { type: 'steps', items: [
          { title: 'Chọn dịch vụ', text: 'Chọn 1 trong 5 dịch vụ: Newborn, Bầu, Sinh nhật, Bé lớn, Gia đình.' },
          { title: 'Chọn ngày và khung giờ', text: 'Khung giờ đã kín hiện mờ, ba mẹ chỉ chọn được khung còn trống.' },
          { title: 'Nhập thông tin bé và xác nhận', text: 'Tên bé, ngày sinh hoặc ngày dự sinh, số người trong ảnh, số điện thoại, lưu ý sức khỏe (nếu có) và ghi chú thêm (vd concept mong muốn). Kiểm tra lại phần tóm tắt rồi xác nhận.' }
        ] },
        { type: 'heading', text: 'Đặt cọc để giữ lịch' },
        { type: 'text', text: 'Sau khi xác nhận, lịch hẹn cần được đặt cọc để trở thành chính thức. Sale của studio sẽ liên hệ xác nhận lại thông tin và hướng dẫn đặt cọc. Mức cọc và thời gian giữ khung giờ áp dụng theo chính sách hiện hành, Sale sẽ báo rõ khi liên hệ.' },
        { type: 'heading', text: 'Sau buổi chụp' },
        { type: 'steps', items: [
          { title: 'Chọn ảnh', text: 'Vào "Ảnh của tôi", thả tim những ảnh yêu thích. Bộ đếm cho biết đã chọn bao nhiêu ảnh so với gói.' },
          { title: 'Gửi yêu cầu chỉnh sửa', text: 'Ghi chú chung cho cả bộ hoặc riêng từng ảnh (làm sáng da, xoá vết đỏ...), rồi bấm gửi.' },
          { title: 'Theo dõi và nhận ảnh', text: 'Yêu cầu đi qua các bước Chờ xử lý, Đang thực hiện, Hoàn thành; biểu tượng chuông trên thanh menu báo khi ảnh đã sửa xong.' }
        ] }
      ],
      related: ['newborn-thoi-diem', 'mot-ngay-tai-aloha', 'vi-sao-chon-aloha']
    },
    {
      slug: 'vi-sao-chon-aloha',
      crumb: CRUMB_NEWS,
      eyebrow: 'Địa điểm',
      title: 'Vì sao ALOHA Baby được nhiều gia đình Hà Nội lựa chọn?',
      lead: 'Không gian rộng rãi, đội ngũ tận tâm và quy trình chăm sóc bé xuyên suốt buổi chụp.',
      cover: 'images/news-3.jpg',
      blocks: [
        { type: 'heading', text: 'Chụp được mọi cột mốc của con' },
        { type: 'text', text: '5 dịch vụ nối tiếp nhau theo hành trình lớn lên của bé: ảnh bầu, newborn, sinh nhật các mốc tuổi, bé lớn và ảnh cả gia đình. Mỗi dịch vụ có nhiều concept để ba mẹ chọn, từ nhẹ nhàng trong studio đến ngoại cảnh.' },
        { type: 'albums', refs: ALL_SERVICES },
        { type: 'heading', text: 'Không gian và ekip dành riêng cho trẻ nhỏ' },
        { type: 'text', text: 'Studio rộng rãi tại 35 Lê Văn Thiêm, Thanh Xuân, phòng chụp newborn giữ nhiệt độ ấm và an toàn cho bé. Photographer và stylist quen làm việc với trẻ nhỏ, kiên nhẫn chờ bé ăn, ngủ, chơi để có những bức ảnh tự nhiên nhất.' },
        { type: 'heading', text: 'Mọi thứ đều theo dõi được trên web' },
        { type: 'list', items: [
          'Đặt lịch online, chỉ chọn được khung giờ còn trống.',
          'Chọn ảnh bằng cách thả tim, ghi chú chỉnh sửa cho từng ảnh.',
          'Theo dõi tiến độ chỉnh sửa và nhận thông báo khi ảnh xong.',
          'Trợ lý tư vấn trong khung chat trả lời về dịch vụ, concept bất cứ lúc nào.'
        ] },
        { type: 'heading', text: 'Ảnh của bé được bảo mật' },
        { type: 'text', text: 'Ảnh của bé chỉ xem được khi đăng nhập bằng tài khoản của gia đình. Studio chỉ dùng ảnh cho mục đích giới thiệu khi ba mẹ đồng ý bằng văn bản.' },
        { type: 'text', text: 'Không tiện đến studio? ALOHA Baby có dịch vụ <a href="#/noi-dung/chup-tai-nha">chụp ảnh tại nhà</a>.' }
      ],
      related: ['gioi-thieu-studio', 'mot-ngay-tai-aloha', 'huong-dan-dat-lich']
    }
  ];

  // ---------------------------------------------------------------- Render
  const $ = (id) => document.getElementById(id);
  const bySlug = (slug) => PAGES.find((p) => p.slug === slug) || null;
  const lookup = (ref) => (window.AlohaAlbums ? window.AlohaAlbums.lookup(ref) : null);
  const coverOf = (page) => page.cover || (page.coverFrom && (lookup(page.coverFrom) || {}).cover) || null;
  const attr = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>';
  const PLAY = '<span class="content-play" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>';

  // Ảnh/video của 1 khối gallery: items viết tay trước, rồi ảnh từ các album xen kẽ
  // nhau (1 ảnh album A, 1 ảnh album B...) cho đa dạng, cắt theo limit.
  function galleryItems(block, label, skipSrc) {
    const items = (block.items || []).map((it, i) => {
      if (typeof it === 'string') return { src: it, alt: `Ảnh minh hoạ ${label} ${i + 1}` };
      return it.video ? { video: it.video, poster: it.poster, alt: it.alt || 'Video minh hoạ' } : { src: it.src, alt: it.alt || `Ảnh minh hoạ ${label} ${i + 1}` };
    });
    const lists = (block.from || []).map((ref) => (lookup(ref) || { photos: [] }).photos);
    const longest = lists.reduce((n, l) => Math.max(n, l.length), 0);
    for (let i = 0; i < longest; i++) lists.forEach((l) => { if (l[i] && l[i].src !== skipSrc) items.push(l[i]); });
    return block.limit ? items.slice(0, block.limit) : items;
  }

  let galleries = []; // danh sách ảnh của từng khối gallery trên trang đang mở (cho lightbox)

  function renderBlock(b, page) {
    switch (b.type) {
      case 'heading': return `<h2 class="content-h">${b.text}</h2>`;
      case 'text': return `<p class="content-p">${b.text}</p>`;
      case 'list': return `<ul class="content-list">${b.items.map((it) => `<li>${it}</li>`).join('')}</ul>`;
      case 'steps': return `<ol class="content-steps">${b.items.map((it) => `<li><strong>${it.title}</strong><span>${it.text}</span></li>`).join('')}</ol>`;
      case 'note': return `<p class="content-note">${b.text}</p>`;
      case 'image': return `<figure class="content-figure"><img src="${attr(b.src)}" alt="${attr(b.alt)}" loading="lazy">${b.caption ? `<figcaption>${b.caption}</figcaption>` : ''}</figure>`;
      case 'video': return `<figure class="content-figure content-video"><video controls playsinline preload="none" poster="${attr(b.poster)}" src="${attr(b.src)}"></video>${b.caption ? `<figcaption>${b.caption}</figcaption>` : ''}</figure>`;
      case 'gallery': {
        const items = galleryItems(b, page.title, coverOf(page));
        if (!items.length) return '';
        const g = galleries.push(items) - 1;
        return `<div class="gallery-grid content-gallery">${items.map((it, i) => `<button type="button" class="gallery-item${it.video ? ' is-video' : ''}" data-g="${g}" data-i="${i}" aria-label="${it.video ? 'Phát video' : 'Xem lớn ảnh'} ${i + 1}/${items.length}"><img src="${attr(it.video ? it.poster : it.src)}" alt="${attr(it.alt)}" loading="lazy" decoding="async">${it.video ? PLAY : ''}</button>`).join('')}</div>`;
      }
      case 'albums': {
        const cards = (b.refs || []).map(lookup).filter(Boolean);
        return cards.length ? `<div class="concept-albums content-albums">${cards.map((a) => `<a href="${a.href}" class="concept-album">
            <img src="${attr(a.cover)}" alt="${attr('Album ' + a.name)}" loading="lazy">
            <span class="concept-album-body">
              <span class="concept-album-name">${a.name}</span>
              <span class="concept-album-desc">${a.desc}</span>
              <span class="concept-album-count">${a.meta}</span>
            </span>
            <span class="concept-album-arrow">${ARROW}</span>
          </a>`).join('')}</div>` : '';
      }
      default: return '';
    }
  }

  function renderRelated(page) {
    const list = (page.related || []).map(bySlug).filter(Boolean);
    $('contentRelatedWrap').hidden = !list.length;
    $('contentRelated').innerHTML = list.map((p) => {
      const cover = p.thumb || coverOf(p);
      return `<a href="#/noi-dung/${p.slug}" class="related-card">
        <span class="related-thumb">${cover ? `<img src="${attr(cover)}" alt="" loading="lazy">` : ''}</span>
        <span class="related-body"><span class="related-eyebrow">${p.eyebrow}</span><span class="related-title">${p.title}</span></span>
      </a>`;
    }).join('');
  }

  function render(slug) {
    const page = bySlug(slug);
    $('contentFound').hidden = !page;
    $('contentMissing').hidden = !!page;
    if (!page) return 'Không tìm thấy nội dung | ALOHA Baby';

    $('contentCrumb').innerHTML = `<a href="${page.crumb.href}">${page.crumb.label}</a> / <span>${page.title}</span>`;
    $('contentEyebrow').textContent = page.eyebrow || '';
    $('contentEyebrow').hidden = !page.eyebrow;
    $('contentTitle').textContent = page.title;
    $('contentLead').textContent = page.lead || '';

    galleries = [];
    const cover = coverOf(page);
    $('contentBlocks').innerHTML =
      (cover ? `<figure class="content-cover"><img src="${attr(cover)}" alt="${attr(page.title)}"></figure>` : '') +
      page.blocks.map((b) => renderBlock(b, page)).join('');
    // Ô ảnh hiện dần khi tải xong (cùng hiệu ứng lưới ảnh album, CSS .gallery-item.loaded).
    $('contentBlocks').querySelectorAll('.gallery-item img').forEach((img) => {
      const done = () => img.parentElement.classList.add('loaded');
      if (img.complete) done(); else { img.addEventListener('load', done, { once: true }); img.addEventListener('error', done, { once: true }); }
    });
    renderRelated(page);
    return page.title + ' | ALOHA Baby';
  }

  // Rời trang (sang view khác) -> dừng video đang phát, không để tiếng chạy ngầm.
  function stop() {
    document.querySelectorAll('#view-content video').forEach((v) => v.pause());
  }

  const blocks = $('contentBlocks');
  if (blocks) {
    blocks.addEventListener('click', (e) => {
      const btn = e.target.closest('.gallery-item[data-g]');
      if (!btn || !window.AlohaAlbums) return;
      stop();
      window.AlohaAlbums.openViewer(galleries[Number(btn.dataset.g)], Number(btn.dataset.i));
    });
  }

  // list: dùng cho ô Tìm kiếm (js/script.js) và test.
  window.AlohaContent = {
    list: PAGES.map((p) => ({ slug: p.slug, title: p.title, eyebrow: p.eyebrow, href: '#/noi-dung/' + p.slug })),
    render,
    stop
  };
})(window, document);
