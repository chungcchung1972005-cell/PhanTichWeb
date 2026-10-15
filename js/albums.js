// ALOHA Baby — Album ảnh theo dịch vụ, 3 tầng (route xem js/router.js):
//   Trang chủ (Hero Banner, 5 ô dịch vụ)
//     -> #/album/<dịch vụ>            : danh sách concept album của dịch vụ đó
//       -> #/album/<dịch vụ>/<concept> : toàn bộ ảnh của 1 concept (bấm ảnh để xem lớn)
//
// THÊM ẢNH: chép file vào images/albums/<dịch vụ>/<concept>/ (vd
// images/albums/newborn/cuon-u/cu-07.jpg) rồi thêm đường dẫn vào mảng "photos"
// của đúng concept bên dưới. Không giới hạn số ảnh. Mỗi ảnh là 1 chuỗi đường
// dẫn, hoặc { src, alt } nếu muốn tự đặt mô tả ảnh (alt) riêng.
// THÊM CONCEPT: thêm 1 object { slug, name, desc, photos } vào mảng "concepts"
// của dịch vụ (slug viết thường, không dấu, nối bằng gạch ngang).
// Concept chưa có ảnh nào sẽ tự ẩn cho tới khi được thêm ảnh.
// Ảnh bìa: concept dùng ảnh đầu tiên của nó; ô dịch vụ trên Hero dùng ảnh bìa
// của concept đầu tiên có ảnh.
//
// Từ 2026-10-13, concept của Newborn, Sinh nhật, Bé lớn, Gia đình là concept THẬT
// của studio, ảnh lấy từ fanpage ALOHA Baby (người dùng là người của studio, yêu
// cầu thay toàn bộ concept cũ), 5 ảnh/concept, cạnh dài 1280px; link bài gốc từng
// ảnh ở images/albums/sources.json. Fanpage gần như không có ảnh Bầu nên Bầu vẫn là
// ảnh stock MINH HOẠ (Pexels License, tải bằng _screenshots/fetch-album-photos.js),
// đánh dấu stock: true để trang album ghi chú "ảnh minh hoạ" cho khách.
// Chatbot (SERVICE_INFO trong js/script.js, server/server.js) vẫn nêu tên concept
// cũ: người dùng bảo để nguyên chatbot (2026-10-13).
(function (window, document) {
  const SERVICES = [
    {
      slug: 'newborn',
      name: 'Newborn',
      cover: 'images/services/newborn.jpg', // ảnh bìa ô dịch vụ trang chủ, nguồn: images/services/sources.json
      desc: 'Những ngày đầu đời của bé, chụp khi bé ngủ sâu trong phòng được giữ ấm, tạo dáng nhẹ nhàng và an toàn.',
      concepts: [
        { slug: 'baby-butterfly', name: 'Baby Butterfly', desc: 'Bé ngủ giữa đôi cánh bướm bằng vải mềm, tông hồng phấn ngọt ngào.',
          photos: [
            'images/albums/newborn/baby-butterfly/baby-butterfly-01.jpg',
            'images/albums/newborn/baby-butterfly/baby-butterfly-02.jpg',
            'images/albums/newborn/baby-butterfly/baby-butterfly-03.jpg',
            'images/albums/newborn/baby-butterfly/baby-butterfly-04.jpg',
            'images/albums/newborn/baby-butterfly/baby-butterfly-05.jpg'
          ] },
        { slug: 'little-dimsum', name: 'Little Dimsum', desc: 'Bé hoá chiếc bánh bao nhỏ trong xửng tre, mũ len trắng đính nơ cam.',
          photos: [
            'images/albums/newborn/little-dimsum/little-dimsum-01.jpg',
            'images/albums/newborn/little-dimsum/little-dimsum-02.jpg',
            'images/albums/newborn/little-dimsum/little-dimsum-03.jpg',
            'images/albums/newborn/little-dimsum/little-dimsum-04.jpg',
            'images/albums/newborn/little-dimsum/little-dimsum-05.jpg'
          ] },
        { slug: 'baby-cowboy', name: 'Baby Cowboy', desc: 'Mũ len bờm ngựa, chú ngựa nhỏ và giỏ mây, tông nâu mộc mạc.',
          photos: [
            'images/albums/newborn/baby-cowboy/baby-cowboy-01.jpg',
            'images/albums/newborn/baby-cowboy/baby-cowboy-02.jpg',
            'images/albums/newborn/baby-cowboy/baby-cowboy-03.jpg',
            'images/albums/newborn/baby-cowboy/baby-cowboy-04.jpg',
            'images/albums/newborn/baby-cowboy/baby-cowboy-05.jpg'
          ] },
        { slug: 'starry-dream', name: 'Starry Dream', desc: 'Nôi gỗ nhỏ trên nền trời sao xanh, bé ngủ ngon cùng gấu bông.',
          photos: [
            'images/albums/newborn/starry-dream/starry-dream-01.jpg',
            'images/albums/newborn/starry-dream/starry-dream-02.jpg',
            'images/albums/newborn/starry-dream/starry-dream-03.jpg',
            'images/albums/newborn/starry-dream/starry-dream-04.jpg',
            'images/albums/newborn/starry-dream/starry-dream-05.jpg'
          ] },
        { slug: 'tinker-bell', name: 'Tinker Bell', desc: 'Nàng tiên nhỏ váy lá xanh ngủ giữa khu rừng cổ tích.',
          photos: [
            'images/albums/newborn/tinker-bell/tinker-bell-01.jpg',
            'images/albums/newborn/tinker-bell/tinker-bell-02.jpg',
            'images/albums/newborn/tinker-bell/tinker-bell-03.jpg',
            'images/albums/newborn/tinker-bell/tinker-bell-04.jpg',
            'images/albums/newborn/tinker-bell/tinker-bell-05.jpg'
          ] },
        { slug: 'baby-cookie', name: 'Baby Cookie', desc: 'Mũ gấu nâu, bánh quy và cốc sữa, tông nâu đỏ ấm áp.',
          photos: [
            'images/albums/newborn/baby-cookie/baby-cookie-01.jpg',
            'images/albums/newborn/baby-cookie/baby-cookie-02.jpg',
            'images/albums/newborn/baby-cookie/baby-cookie-03.jpg',
            'images/albums/newborn/baby-cookie/baby-cookie-04.jpg',
            'images/albums/newborn/baby-cookie/baby-cookie-05.jpg'
          ] },
        { slug: 'baby-unicorn', name: 'Baby Unicorn', desc: 'Kỳ lân cầu vồng, mây bông và những ngôi sao hồng.',
          photos: [
            'images/albums/newborn/baby-unicorn/baby-unicorn-01.jpg',
            'images/albums/newborn/baby-unicorn/baby-unicorn-02.jpg',
            'images/albums/newborn/baby-unicorn/baby-unicorn-03.jpg',
            'images/albums/newborn/baby-unicorn/baby-unicorn-04.jpg',
            'images/albums/newborn/baby-unicorn/baby-unicorn-05.jpg'
          ] },
        { slug: 'lucky-horsey', name: 'Lucky Horsey', desc: 'Bé ôm chú ngựa đỏ may mắn, concept đón năm mới.',
          photos: [
            'images/albums/newborn/lucky-horsey/lucky-horsey-01.jpg',
            'images/albums/newborn/lucky-horsey/lucky-horsey-02.jpg',
            'images/albums/newborn/lucky-horsey/lucky-horsey-03.jpg',
            'images/albums/newborn/lucky-horsey/lucky-horsey-04.jpg',
            'images/albums/newborn/lucky-horsey/lucky-horsey-05.jpg'
          ] },
        { slug: 'white-blossom', name: 'White Blossom', desc: 'Hoa trắng và vải voan mềm, tinh khôi, nhẹ nhàng.',
          photos: [
            'images/albums/newborn/white-blossom/white-blossom-01.jpg',
            'images/albums/newborn/white-blossom/white-blossom-02.jpg',
            'images/albums/newborn/white-blossom/white-blossom-03.jpg',
            'images/albums/newborn/white-blossom/white-blossom-04.jpg',
            'images/albums/newborn/white-blossom/white-blossom-05.jpg'
          ] },
        { slug: 'tet-dong-day', name: 'Tết Đong Đầy', desc: 'Bé nằm trong giỏ hoa đỏ cùng bánh chưng, quạt giấy ngày Tết.',
          photos: [
            'images/albums/newborn/tet-dong-day/tet-dong-day-01.jpg',
            'images/albums/newborn/tet-dong-day/tet-dong-day-02.jpg',
            'images/albums/newborn/tet-dong-day/tet-dong-day-03.jpg',
            'images/albums/newborn/tet-dong-day/tet-dong-day-04.jpg',
            'images/albums/newborn/tet-dong-day/tet-dong-day-05.jpg'
          ] }
      ]
    },
    {
      slug: 'bau',
      name: 'Bầu',
      stock: true, // ảnh Pexels minh hoạ, chưa có ảnh thật của studio
      cover: 'images/services/bau.jpg', // ảnh bìa ô dịch vụ trang chủ, nguồn: images/services/sources.json
      desc: 'Lưu giữ dáng bụng tròn của mẹ, trong studio hoặc ngoại cảnh, tuỳ sức khoẻ và mong muốn của mỗi mẹ.',
      concepts: [
        { slug: 'ngoai-canh', name: 'Ngoại cảnh thiên nhiên', desc: 'Ánh sáng tự nhiên, cây lá và không gian thoáng.',
          photos: [
            'images/service-bau.jpg',
            'images/albums/bau/ngoai-canh/ngoai-canh-01.jpg',
            'images/albums/bau/ngoai-canh/ngoai-canh-02.jpg',
            'images/albums/bau/ngoai-canh/ngoai-canh-03.jpg',
            'images/albums/bau/ngoai-canh/ngoai-canh-04.jpg',
            'images/albums/bau/ngoai-canh/ngoai-canh-06.jpg',
            'images/albums/bau/ngoai-canh/ngoai-canh-07.jpg',
            'images/albums/bau/ngoai-canh/ngoai-canh-08.jpg'
          ] },
        { slug: 'vintage', name: 'Vintage trong studio', desc: 'Váy dài, phông trơn, tông màu trầm nhẹ nhàng.',
          photos: [
            'images/album-4.jpg',
            'images/albums/bau/vintage/vintage-01.jpg',
            'images/albums/bau/vintage/vintage-02.jpg',
            'images/albums/bau/vintage/vintage-03.jpg',
            'images/albums/bau/vintage/vintage-05.jpg',
            'images/albums/bau/vintage/vintage-06.jpg',
            'images/albums/bau/vintage/vintage-07.jpg',
            'images/albums/bau/vintage/vintage-08.jpg'
          ] },
        { slug: 'toi-gian', name: 'Tối giản, tôn dáng', desc: 'Bố cục tối giản, tập trung vào dáng mẹ bầu.',
          photos: [
            'images/albums/bau/toi-gian/toi-gian-01.jpg',
            'images/albums/bau/toi-gian/toi-gian-02.jpg',
            'images/albums/bau/toi-gian/toi-gian-03.jpg',
            'images/albums/bau/toi-gian/toi-gian-04.jpg',
            'images/albums/bau/toi-gian/toi-gian-06.jpg',
            'images/albums/bau/toi-gian/toi-gian-07.jpg',
            'images/albums/bau/toi-gian/toi-gian-08.jpg'
          ] },
        { slug: 'cung-chong', name: 'Cùng chồng', desc: 'Khoảnh khắc hai vợ chồng cùng chờ đón thiên thần nhỏ.',
          photos: [
            'images/albums/bau/cung-chong/cung-chong-01.jpg',
            'images/albums/bau/cung-chong/cung-chong-02.jpg',
            'images/albums/bau/cung-chong/cung-chong-03.jpg',
            'images/albums/bau/cung-chong/cung-chong-04.jpg',
            'images/albums/bau/cung-chong/cung-chong-05.jpg',
            'images/albums/bau/cung-chong/cung-chong-06.jpg',
            'images/albums/bau/cung-chong/cung-chong-07.jpg',
            'images/albums/bau/cung-chong/cung-chong-08.jpg',
            'images/albums/bau/cung-chong/cung-chong-09.jpg'
          ] },
        { slug: 'cung-be', name: 'Cùng bé lớn', desc: 'Anh chị lớn cùng mẹ chào đón em bé sắp chào đời.',
          photos: [
            'images/albums/bau/cung-be/cung-be-01.jpg',
            'images/albums/bau/cung-be/cung-be-03.jpg',
            'images/albums/bau/cung-be/cung-be-04.jpg',
            'images/albums/bau/cung-be/cung-be-05.jpg',
            'images/albums/bau/cung-be/cung-be-07.jpg',
            'images/albums/bau/cung-be/cung-be-08.jpg',
            'images/albums/bau/cung-be/cung-be-09.jpg'
          ] },
        { slug: 'vong-hoa', name: 'Vòng hoa', desc: 'Vòng hoa tươi trên tóc, váy nhẹ nhàng, nữ tính.',
          photos: [
            'images/albums/bau/vong-hoa/vong-hoa-01.jpg',
            'images/albums/bau/vong-hoa/vong-hoa-02.jpg',
            'images/albums/bau/vong-hoa/vong-hoa-03.jpg',
            'images/albums/bau/vong-hoa/vong-hoa-04.jpg',
            'images/albums/bau/vong-hoa/vong-hoa-05.jpg',
            'images/albums/bau/vong-hoa/vong-hoa-06.jpg',
            'images/albums/bau/vong-hoa/vong-hoa-07.jpg',
            'images/albums/bau/vong-hoa/vong-hoa-08.jpg',
            'images/albums/bau/vong-hoa/vong-hoa-09.jpg'
          ] },
        { slug: 'bien', name: 'Biển', desc: 'Váy dài bay trong gió, nắng và sóng biển.',
          photos: [
            'images/albums/bau/bien/bien-01.jpg',
            'images/albums/bau/bien/bien-02.jpg',
            'images/albums/bau/bien/bien-03.jpg',
            'images/albums/bau/bien/bien-04.jpg',
            'images/albums/bau/bien/bien-05.jpg',
            'images/albums/bau/bien/bien-06.jpg',
            'images/albums/bau/bien/bien-07.jpg',
            'images/albums/bau/bien/bien-08.jpg',
            'images/albums/bau/bien/bien-09.jpg'
          ] }
      ]
    },
    {
      slug: 'sinh-nhat',
      name: 'Sinh nhật',
      cover: 'images/services/sinh-nhat.jpg', // ảnh bìa ô dịch vụ trang chủ, nguồn: images/services/sources.json
      desc: 'Thôi nôi và sinh nhật của bé, kết hợp bánh kem, bóng bay và backdrop theo yêu cầu.',
      concepts: [
        { slug: 'birthday-spotlight', name: 'Birthday Spotlight', desc: 'Xe hơi đỏ, bóng bay đỏ và vest nơ, sinh nhật bảnh bao cho bé trai.',
          photos: [
            'images/albums/sinh-nhat/birthday-spotlight/birthday-spotlight-01.jpg',
            'images/albums/sinh-nhat/birthday-spotlight/birthday-spotlight-02.jpg',
            'images/albums/sinh-nhat/birthday-spotlight/birthday-spotlight-03.jpg',
            'images/albums/sinh-nhat/birthday-spotlight/birthday-spotlight-04.jpg',
            'images/albums/sinh-nhat/birthday-spotlight/birthday-spotlight-05.jpg'
          ] },
        { slug: 'nang-bach-tuyet', name: 'Nàng Bạch Tuyết', desc: 'Váy Bạch Tuyết, táo đỏ và khu rừng cổ tích cho bé gái.',
          photos: [
            'images/albums/sinh-nhat/nang-bach-tuyet/nang-bach-tuyet-01.jpg',
            'images/albums/sinh-nhat/nang-bach-tuyet/nang-bach-tuyet-02.jpg',
            'images/albums/sinh-nhat/nang-bach-tuyet/nang-bach-tuyet-03.jpg',
            'images/albums/sinh-nhat/nang-bach-tuyet/nang-bach-tuyet-04.jpg',
            'images/albums/sinh-nhat/nang-bach-tuyet/nang-bach-tuyet-05.jpg'
          ] },
        { slug: 'summer-picnic', name: 'Summer Picnic', desc: 'Tiệc sinh nhật picnic trên cỏ, mẹ và bé váy kem cùng tông.',
          photos: [
            'images/albums/sinh-nhat/summer-picnic/summer-picnic-01.jpg',
            'images/albums/sinh-nhat/summer-picnic/summer-picnic-02.jpg',
            'images/albums/sinh-nhat/summer-picnic/summer-picnic-03.jpg',
            'images/albums/sinh-nhat/summer-picnic/summer-picnic-04.jpg',
            'images/albums/sinh-nhat/summer-picnic/summer-picnic-05.jpg'
          ] },
        { slug: 'nha-minh-co-hoa', name: 'Nhà Mình Có Hoa', desc: 'Cả nhà áo trắng quây quần bên bánh kem, nhẹ nhàng ấm cúng.',
          photos: [
            'images/albums/sinh-nhat/nha-minh-co-hoa/nha-minh-co-hoa-01.jpg',
            'images/albums/sinh-nhat/nha-minh-co-hoa/nha-minh-co-hoa-02.jpg',
            'images/albums/sinh-nhat/nha-minh-co-hoa/nha-minh-co-hoa-03.jpg',
            'images/albums/sinh-nhat/nha-minh-co-hoa/nha-minh-co-hoa-04.jpg',
            'images/albums/sinh-nhat/nha-minh-co-hoa/nha-minh-co-hoa-05.jpg'
          ] },
        { slug: 'sinh-nhat-song-sinh', name: 'Sinh Nhật Song Sinh', desc: 'Thôi nôi cho hai bé song sinh với xe ô tô nhỏ và gấu bông.',
          photos: [
            'images/albums/sinh-nhat/sinh-nhat-song-sinh/sinh-nhat-song-sinh-01.jpg',
            'images/albums/sinh-nhat/sinh-nhat-song-sinh/sinh-nhat-song-sinh-02.jpg',
            'images/albums/sinh-nhat/sinh-nhat-song-sinh/sinh-nhat-song-sinh-03.jpg',
            'images/albums/sinh-nhat/sinh-nhat-song-sinh/sinh-nhat-song-sinh-04.jpg',
            'images/albums/sinh-nhat/sinh-nhat-song-sinh/sinh-nhat-song-sinh-05.jpg'
          ] },
        { slug: 'baby-prince', name: 'Baby Prince', desc: 'Vương miện, nơ đỏ và gấu nâu, hoàng tử nhỏ đón tuổi mới.',
          photos: [
            'images/albums/sinh-nhat/baby-prince/baby-prince-01.jpg',
            'images/albums/sinh-nhat/baby-prince/baby-prince-02.jpg',
            'images/albums/sinh-nhat/baby-prince/baby-prince-03.jpg',
            'images/albums/sinh-nhat/baby-prince/baby-prince-04.jpg',
            'images/albums/sinh-nhat/baby-prince/baby-prince-05.jpg'
          ] },
        { slug: 'cozy-sky', name: 'Cozy Sky Birthday', desc: 'Mây trắng, chữ Happy Birthday và gối ca rô xanh dịu mắt.',
          photos: [
            'images/albums/sinh-nhat/cozy-sky/cozy-sky-01.jpg',
            'images/albums/sinh-nhat/cozy-sky/cozy-sky-02.jpg',
            'images/albums/sinh-nhat/cozy-sky/cozy-sky-03.jpg',
            'images/albums/sinh-nhat/cozy-sky/cozy-sky-04.jpg',
            'images/albums/sinh-nhat/cozy-sky/cozy-sky-05.jpg'
          ] },
        { slug: 'angel-baby', name: 'Angel Baby', desc: 'Bóng bay trắng, số 1 hồng và bánh dâu, thôi nôi tinh khôi.',
          photos: [
            'images/albums/sinh-nhat/angel-baby/angel-baby-01.jpg',
            'images/albums/sinh-nhat/angel-baby/angel-baby-02.jpg',
            'images/albums/sinh-nhat/angel-baby/angel-baby-03.jpg',
            'images/albums/sinh-nhat/angel-baby/angel-baby-04.jpg',
            'images/albums/sinh-nhat/angel-baby/angel-baby-05.jpg'
          ] },
        { slug: 'happy-donut', name: 'Happy Donut', desc: 'Bánh donut khổng lồ, đồng cỏ và bánh kem, sắc màu vui tươi.',
          photos: [
            'images/albums/sinh-nhat/happy-donut/happy-donut-01.jpg',
            'images/albums/sinh-nhat/happy-donut/happy-donut-02.jpg',
            'images/albums/sinh-nhat/happy-donut/happy-donut-03.jpg',
            'images/albums/sinh-nhat/happy-donut/happy-donut-04.jpg',
            'images/albums/sinh-nhat/happy-donut/happy-donut-05.jpg'
          ] },
        { slug: 'sweet-birthday', name: 'Sweet Birthday', desc: 'Mũ chóp voan trắng, bóng bay và bánh kem trên nền đỏ.',
          photos: [
            'images/albums/sinh-nhat/sweet-birthday/sweet-birthday-01.jpg',
            'images/albums/sinh-nhat/sweet-birthday/sweet-birthday-02.jpg',
            'images/albums/sinh-nhat/sweet-birthday/sweet-birthday-03.jpg',
            'images/albums/sinh-nhat/sweet-birthday/sweet-birthday-04.jpg',
            'images/albums/sinh-nhat/sweet-birthday/sweet-birthday-05.jpg'
          ] }
      ]
    },
    {
      slug: 'be-lon',
      name: 'Bé lớn',
      cover: 'images/services/be-lon.jpg', // ảnh bìa ô dịch vụ trang chủ, nguồn: images/services/sources.json
      desc: 'Bé từ khoảng 2 đến 10 tuổi, ngoại cảnh hoặc trong studio, có thể chụp thêm cùng bố mẹ trong buổi.',
      concepts: [
        { slug: 'fruity-summer', name: 'Fruity Summer', desc: 'Nền vàng tươi, xe đẩy siêu thị và trái cây nhồi bông mùa hè.',
          photos: [
            'images/albums/be-lon/fruity-summer/fruity-summer-01.jpg',
            'images/albums/be-lon/fruity-summer/fruity-summer-02.jpg',
            'images/albums/be-lon/fruity-summer/fruity-summer-03.jpg',
            'images/albums/be-lon/fruity-summer/fruity-summer-04.jpg',
            'images/albums/be-lon/fruity-summer/fruity-summer-05.jpg'
          ] },
        { slug: 'korea-princess', name: 'Korea Princess', desc: 'Hanbok hồng, bóng bay trắng trên nền xanh lá dịu mắt.',
          photos: [
            'images/albums/be-lon/korea-princess/korea-princess-01.jpg',
            'images/albums/be-lon/korea-princess/korea-princess-02.jpg',
            'images/albums/be-lon/korea-princess/korea-princess-03.jpg',
            'images/albums/be-lon/korea-princess/korea-princess-04.jpg',
            'images/albums/be-lon/korea-princess/korea-princess-05.jpg'
          ] },
        { slug: 'honey-bee', name: 'Honey Bee', desc: 'Bé hoá chú ong nhỏ bên tổ mật vàng óng.',
          photos: [
            'images/albums/be-lon/honey-bee/honey-bee-01.jpg',
            'images/albums/be-lon/honey-bee/honey-bee-02.jpg',
            'images/albums/be-lon/honey-bee/honey-bee-03.jpg',
            'images/albums/be-lon/honey-bee/honey-bee-04.jpg',
            'images/albums/be-lon/honey-bee/honey-bee-05.jpg'
          ] },
        { slug: 'swan-ballet', name: 'Swan Ballet', desc: 'Váy múa trắng, cài lông vũ, nhẹ nhàng như thiên nga.',
          photos: [
            'images/albums/be-lon/swan-ballet/swan-ballet-01.jpg',
            'images/albums/be-lon/swan-ballet/swan-ballet-02.jpg',
            'images/albums/be-lon/swan-ballet/swan-ballet-03.jpg',
            'images/albums/be-lon/swan-ballet/swan-ballet-04.jpg',
            'images/albums/be-lon/swan-ballet/swan-ballet-05.jpg'
          ] },
        { slug: 'happy-farm', name: 'Happy Farm', desc: 'Nông trại vui vẻ với rơm vàng, rau củ và bí ngô.',
          photos: [
            'images/albums/be-lon/happy-farm/happy-farm-01.jpg',
            'images/albums/be-lon/happy-farm/happy-farm-02.jpg',
            'images/albums/be-lon/happy-farm/happy-farm-03.jpg',
            'images/albums/be-lon/happy-farm/happy-farm-04.jpg'
          ] },
        { slug: 'thong-nhat-non-song', name: 'Thống Nhất Non Sông', desc: 'Áo trắng khăn quàng đỏ, cờ đỏ sao vàng, mừng ngày thống nhất.',
          photos: [
            'images/albums/be-lon/thong-nhat-non-song/thong-nhat-non-song-01.jpg',
            'images/albums/be-lon/thong-nhat-non-song/thong-nhat-non-song-02.jpg',
            'images/albums/be-lon/thong-nhat-non-song/thong-nhat-non-song-03.jpg',
            'images/albums/be-lon/thong-nhat-non-song/thong-nhat-non-song-04.jpg',
            'images/albums/be-lon/thong-nhat-non-song/thong-nhat-non-song-05.jpg'
          ] },
        { slug: 'little-muse', name: 'Little Muse', desc: 'Váy trắng bồng, giỏ mây và hoa nhỏ, tông trắng kem.',
          photos: [
            'images/albums/be-lon/little-muse/little-muse-01.jpg',
            'images/albums/be-lon/little-muse/little-muse-02.jpg',
            'images/albums/be-lon/little-muse/little-muse-03.jpg',
            'images/albums/be-lon/little-muse/little-muse-04.jpg',
            'images/albums/be-lon/little-muse/little-muse-05.jpg'
          ] },
        { slug: 'than-tai', name: 'Em Bé Thần Tài', desc: 'Áo đỏ mũ quan, thỏi vàng lấp lánh, cầu chúc năm mới phát tài.',
          photos: [
            'images/albums/be-lon/than-tai/than-tai-01.jpg',
            'images/albums/be-lon/than-tai/than-tai-02.jpg',
            'images/albums/be-lon/than-tai/than-tai-03.jpg',
            'images/albums/be-lon/than-tai/than-tai-04.jpg',
            'images/albums/be-lon/than-tai/than-tai-05.jpg'
          ] },
        { slug: 'em-be-to-he', name: 'Em Bé Tò He', desc: 'Gánh tò he, mái ngói đỏ và áo dài cách tân, đậm chất Tết xưa.',
          photos: [
            'images/albums/be-lon/em-be-to-he/em-be-to-he-01.jpg',
            'images/albums/be-lon/em-be-to-he/em-be-to-he-02.jpg',
            'images/albums/be-lon/em-be-to-he/em-be-to-he-03.jpg',
            'images/albums/be-lon/em-be-to-he/em-be-to-he-04.jpg',
            'images/albums/be-lon/em-be-to-he/em-be-to-he-05.jpg'
          ] },
        { slug: 'du-xuan', name: 'Du Xuân', desc: 'Áo dài đỏ, gánh hoa cúc và bao lì xì, rộn ràng đầu xuân.',
          photos: [
            'images/albums/be-lon/du-xuan/du-xuan-01.jpg',
            'images/albums/be-lon/du-xuan/du-xuan-02.jpg',
            'images/albums/be-lon/du-xuan/du-xuan-03.jpg',
            'images/albums/be-lon/du-xuan/du-xuan-04.jpg',
            'images/albums/be-lon/du-xuan/du-xuan-05.jpg'
          ] }
      ]
    },
    {
      slug: 'gia-dinh',
      name: 'Gia đình',
      cover: 'images/services/gia-dinh.jpg', // ảnh bìa ô dịch vụ trang chủ, nguồn: images/services/sources.json
      desc: 'Không giới hạn số thành viên, chụp được nhiều thế hệ trong cùng một buổi.',
      concepts: [
        { slug: 'strawberry-garden', name: 'Strawberry Garden', desc: 'Mẹ và bé váy trắng giữa khu vườn dâu tây.',
          photos: [
            'images/albums/gia-dinh/strawberry-garden/strawberry-garden-01.jpg',
            'images/albums/gia-dinh/strawberry-garden/strawberry-garden-02.jpg',
            'images/albums/gia-dinh/strawberry-garden/strawberry-garden-03.jpg',
            'images/albums/gia-dinh/strawberry-garden/strawberry-garden-04.jpg',
            'images/albums/gia-dinh/strawberry-garden/strawberry-garden-05.jpg'
          ] },
        { slug: 'simple-love', name: 'Simple Love', desc: 'Cả nhà tông trắng kem, bóng bay và hoa nhẹ nhàng.',
          photos: [
            'images/albums/gia-dinh/simple-love/simple-love-01.jpg',
            'images/albums/gia-dinh/simple-love/simple-love-02.jpg',
            'images/albums/gia-dinh/simple-love/simple-love-03.jpg',
            'images/albums/gia-dinh/simple-love/simple-love-04.jpg',
            'images/albums/gia-dinh/simple-love/simple-love-05.jpg'
          ] },
        { slug: 'blue-family', name: 'Blue Family', desc: 'Bố mẹ và bé đồng phục xanh pastel, vui nhộn và trẻ trung.',
          photos: [
            'images/albums/gia-dinh/blue-family/blue-family-01.jpg',
            'images/albums/gia-dinh/blue-family/blue-family-02.jpg',
            'images/albums/gia-dinh/blue-family/blue-family-03.jpg',
            'images/albums/gia-dinh/blue-family/blue-family-04.jpg',
            'images/albums/gia-dinh/blue-family/blue-family-05.jpg'
          ] },
        { slug: 'fruity-family', name: 'Fruity Family', desc: 'Nền vàng tươi, dưa hấu và trái cây, không khí mùa hè.',
          photos: [
            'images/albums/gia-dinh/fruity-family/fruity-family-01.jpg',
            'images/albums/gia-dinh/fruity-family/fruity-family-02.jpg',
            'images/albums/gia-dinh/fruity-family/fruity-family-03.jpg',
            'images/albums/gia-dinh/fruity-family/fruity-family-04.jpg',
            'images/albums/gia-dinh/fruity-family/fruity-family-05.jpg'
          ] },
        { slug: 'home-sweet-home', name: 'Home Sweet Home', desc: 'Cả nhà đồng phục yếm jean trên nền đỏ gạch, bóng bay trắng.',
          photos: [
            'images/albums/gia-dinh/home-sweet-home/home-sweet-home-01.jpg',
            'images/albums/gia-dinh/home-sweet-home/home-sweet-home-02.jpg',
            'images/albums/gia-dinh/home-sweet-home/home-sweet-home-03.jpg',
            'images/albums/gia-dinh/home-sweet-home/home-sweet-home-04.jpg',
            'images/albums/gia-dinh/home-sweet-home/home-sweet-home-05.jpg'
          ] },
        { slug: 'xuan-kim-phuc', name: 'Xuân Kim Phúc', desc: 'Áo dài kem, ô giấy và bình phong hoạ tiết, sang trọng ngày xuân.',
          photos: [
            'images/albums/gia-dinh/xuan-kim-phuc/xuan-kim-phuc-01.jpg',
            'images/albums/gia-dinh/xuan-kim-phuc/xuan-kim-phuc-02.jpg',
            'images/albums/gia-dinh/xuan-kim-phuc/xuan-kim-phuc-03.jpg',
            'images/albums/gia-dinh/xuan-kim-phuc/xuan-kim-phuc-04.jpg',
            'images/albums/gia-dinh/xuan-kim-phuc/xuan-kim-phuc-05.jpg'
          ] },
        { slug: 'phu-quy', name: 'Phú Quý', desc: 'Ông bà, bố mẹ và các cháu áo dài, bức ảnh nhiều thế hệ.',
          photos: [
            'images/albums/gia-dinh/phu-quy/phu-quy-01.jpg',
            'images/albums/gia-dinh/phu-quy/phu-quy-02.jpg',
            'images/albums/gia-dinh/phu-quy/phu-quy-03.jpg',
            'images/albums/gia-dinh/phu-quy/phu-quy-04.jpg',
            'images/albums/gia-dinh/phu-quy/phu-quy-05.jpg'
          ] },
        { slug: 'tet-doan-vien', name: 'Tết Đoàn Viên', desc: 'Áo dài đỏ, phông chữ Tết, cả nhà sum vầy ngày đầu năm.',
          photos: [
            'images/albums/gia-dinh/tet-doan-vien/tet-doan-vien-01.jpg',
            'images/albums/gia-dinh/tet-doan-vien/tet-doan-vien-02.jpg',
            'images/albums/gia-dinh/tet-doan-vien/tet-doan-vien-03.jpg',
            'images/albums/gia-dinh/tet-doan-vien/tet-doan-vien-04.jpg',
            'images/albums/gia-dinh/tet-doan-vien/tet-doan-vien-05.jpg'
          ] },
        { slug: 'xuan-hong-phuc', name: 'Xuân Hồng Phúc', desc: 'Áo dài đỏ trên nền xanh, trống đỏ và cành đào ngày Tết.',
          photos: [
            'images/albums/gia-dinh/xuan-hong-phuc/xuan-hong-phuc-01.jpg',
            'images/albums/gia-dinh/xuan-hong-phuc/xuan-hong-phuc-02.jpg',
            'images/albums/gia-dinh/xuan-hong-phuc/xuan-hong-phuc-03.jpg',
            'images/albums/gia-dinh/xuan-hong-phuc/xuan-hong-phuc-04.jpg',
            'images/albums/gia-dinh/xuan-hong-phuc/xuan-hong-phuc-05.jpg'
          ] },
        { slug: 'merry-christmas', name: 'Merry Christmas', desc: 'Pyjama kẻ đỏ cả nhà, cây thông và lò sưởi ấm áp.',
          photos: [
            'images/albums/gia-dinh/merry-christmas/merry-christmas-01.jpg',
            'images/albums/gia-dinh/merry-christmas/merry-christmas-02.jpg',
            'images/albums/gia-dinh/merry-christmas/merry-christmas-03.jpg',
            'images/albums/gia-dinh/merry-christmas/merry-christmas-04.jpg',
            'images/albums/gia-dinh/merry-christmas/merry-christmas-05.jpg'
          ] }
      ]
    }
  ];

  // Chỉ hiện concept đã có ảnh.
  const conceptsOf = (service) => service.concepts.filter((c) => c.photos.length > 0);
  const serviceBySlug = (slug) => SERVICES.find((s) => s.slug === slug) || null;
  const photoCount = (service) => conceptsOf(service).reduce((n, c) => n + c.photos.length, 0);
  const photoOf = (label, p, i) => (typeof p === 'string'
    ? { src: p, alt: `Ảnh concept ${label} ${i + 1}` }
    : { src: p.src, alt: p.alt || `Ảnh concept ${label} ${i + 1}` });
  // Ảnh bìa: service.cover nếu có, không thì ảnh đầu của concept đầu tiên.
  const coverOf = (service) => {
    if (service.cover) return service.cover;
    const first = conceptsOf(service)[0];
    return first ? photoOf(service.name, first.photos[0], 0).src : null;
  };

  const $ = (id) => document.getElementById(id);
  const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>';
  let current = null; // { service, concept } đang mở ở tầng ảnh
  let lbIndex = 0;
  let lastFocus = null;

  // ---------------------------------------------------------------- Hero trang chủ
  // Ảnh bìa từng ô dịch vụ đọc từ dữ liệu album, không viết cứng.
  document.querySelectorAll('.svc-tile[data-album] img').forEach((img) => {
    const s = serviceBySlug(img.closest('.svc-tile').dataset.album);
    const cover = s && coverOf(s);
    if (cover && img.getAttribute('src') !== cover) img.src = cover;
  });

  // 5 ảnh + dòng 5 dịch vụ đầu trang (khối #dich-vu): mở album XEM CÔNG KHAI, không bắt đăng
  // nhập (người dùng đổi quyết định so với 2026-09-28: trước đây 5 ô này riêng bắt đăng nhập,
  // các lối vào album khác đã công khai từ trước). Đăng nhập giờ chỉ còn cần khi khách chủ động
  // bấm nút "Đăng nhập"/"Đăng ký" trên thanh menu, hoặc vào Đặt lịch/Ảnh của tôi (gate riêng ở
  // js/router.js, không đổi). Hiệu ứng chuyển cảnh từ Trang chủ vào album do js/router.js lo
  // (dùng chung cho mọi lối từ Trang chủ vào album / trang nội dung / Ảnh của tôi, 29/09).

  // ---------------------------------------------------------------- View album
  const chips = (items, activeSlug, hrefOf) => items.map((it) =>
    `<a href="${hrefOf(it)}" class="gallery-chip${it.slug === activeSlug ? ' active' : ''}"${it.slug === activeSlug ? ' aria-current="page"' : ''}>${it.name}</a>`
  ).join('');

  // Thanh chip cuộn ngang trên điện thoại: cuộn tới chip đang chọn để khách thấy mình
  // đang ở đâu. Chờ 1 frame vì router render trước khi bỏ ẩn view (lúc đó chưa đo được).
  function revealActiveChip() {
    requestAnimationFrame(() => {
      const bar = $('gallerySwitch');
      const active = bar.querySelector('.gallery-chip.active');
      if (!active) return;
      const a = active.getBoundingClientRect();
      const b = bar.getBoundingClientRect();
      if (a.left < b.left || a.right > b.right) bar.scrollLeft += a.left - b.left - 16;
    });
  }

  function showMissing() {
    current = null;
    $('galleryFound').hidden = true;
    $('galleryMissing').hidden = false;
    return 'Không tìm thấy album | ALOHA Baby';
  }

  // param: "newborn" (tầng concept) hoặc "newborn/cuon-u" (tầng ảnh).
  function render(param) {
    closeLightbox(true);
    const [serviceSlug, conceptSlug] = (param || '').split('/');
    const service = serviceBySlug(serviceSlug);
    if (!service) return showMissing();
    const concepts = conceptsOf(service);
    const concept = conceptSlug ? concepts.find((c) => c.slug === conceptSlug) : null;
    if (conceptSlug && !concept) return showMissing();

    $('galleryFound').hidden = false;
    $('galleryMissing').hidden = true;
    $('galleryNote').textContent = service.stock
      ? 'Ảnh minh hoạ phong cách chụp, không phải ảnh khách hàng thật.'
      : 'Ảnh do ALOHA Baby Studio thực hiện.';
    const serviceHref = '#/album/' + service.slug;
    const isPhotos = !!concept;
    $('galleryConcepts').hidden = isPhotos;
    $('galleryGrid').hidden = !isPhotos;
    $('galleryUp').hidden = !isPhotos;
    $('galleryUpBottom').hidden = !isPhotos;
    $('galleryUp').href = serviceHref;
    $('galleryUpBottom').href = serviceHref;
    $('galleryUpBottom').querySelector('span').textContent = 'Các concept ' + service.name;

    if (!isPhotos) {
      current = null;
      $('galleryCrumb').innerHTML = `<span>${service.name}</span>`;
      $('galleryTitle').textContent = 'Album ' + service.name;
      $('galleryDesc').textContent = service.desc;
      $('galleryCount').textContent = `${concepts.length} concept · ${photoCount(service)} ảnh`;
      // Đã bấm đúng dịch vụ này từ trang chủ rồi nên không cần liệt kê 4 dịch vụ còn lại ở đây nữa
      // (người dùng phản hồi 2026-09-28: chỉ giữ lại chip của dịch vụ đang xem).
      $('gallerySwitch').hidden = false;
      $('gallerySwitch').setAttribute('aria-label', 'Dịch vụ đang xem');
      $('gallerySwitch').innerHTML = chips([service], service.slug, (s) => '#/album/' + s.slug);
      revealActiveChip();
      $('galleryConcepts').innerHTML = concepts.length
        ? concepts.map((c) => {
          const cover = photoOf(c.name, c.photos[0], 0);
          return `<a href="${serviceHref}/${c.slug}" class="concept-album">
            <img src="${cover.src}" alt="${cover.alt}" loading="lazy">
            <span class="concept-album-body">
              <span class="concept-album-name">${c.name}</span>
              <span class="concept-album-desc">${c.desc}</span>
              <span class="concept-album-count">${c.photos.length} ảnh</span>
            </span>
            <span class="concept-album-arrow">${ARROW}</span>
          </a>`;
        }).join('')
        : '<p class="gallery-empty">Album đang được cập nhật ảnh, bạn quay lại sau nhé.</p>';
      return 'Album ' + service.name + ' | ALOHA Baby';
    }

    current = { service, concept };
    $('galleryCrumb').innerHTML = `<a href="${serviceHref}">${service.name}</a> / <span>${concept.name}</span>`;
    $('galleryTitle').textContent = concept.name;
    $('galleryDesc').textContent = concept.desc;
    $('galleryCount').textContent = `Album ${service.name} · ${concept.photos.length} ảnh`;
    $('gallerySwitch').hidden = false;
    $('gallerySwitch').setAttribute('aria-label', 'Các concept khác của ' + service.name);
    $('gallerySwitch').innerHTML = chips(concepts, concept.slug, (c) => serviceHref + '/' + c.slug);
    revealActiveChip();

    const grid = $('galleryGrid');
    grid.innerHTML = '';
    concept.photos.forEach((p, i) => {
      const photo = photoOf(concept.name, p, i);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'gallery-item';
      btn.setAttribute('aria-label', `Xem lớn ảnh ${i + 1}/${concept.photos.length}`);
      const img = document.createElement('img');
      img.src = photo.src;
      img.alt = photo.alt;
      img.loading = i < 6 ? 'eager' : 'lazy';
      img.decoding = 'async';
      img.addEventListener('load', () => btn.classList.add('loaded'), { once: true });
      if (img.complete) btn.classList.add('loaded');
      btn.appendChild(img);
      btn.addEventListener('click', () => openLightbox(i));
      grid.appendChild(btn);
    });
    return concept.name + ' · Album ' + service.name + ' | ALOHA Baby';
  }

  // ---------------------------------------------------------------- Lightbox
  // Dùng chung cho album (bên trên) và trang nội dung (js/content.js): mở bằng
  // openViewer(items, i), mỗi item là { src, alt } (ảnh) hoặc { video, poster, alt }.
  let lbItems = [];

  function showPhoto() {
    const item = lbItems[lbIndex];
    const img = $('lightboxImg');
    const video = $('lightboxVideo');
    video.pause();
    if (item.video) {
      img.hidden = true;
      img.removeAttribute('src');
      video.hidden = false;
      video.poster = item.poster || '';
      video.src = item.video;
      video.setAttribute('aria-label', item.alt || 'Video');
    } else {
      video.hidden = true;
      if (video.getAttribute('src')) { video.removeAttribute('src'); video.load(); } // nhả file video đang giữ
      img.hidden = false;
      img.src = item.src;
      img.alt = item.alt || '';
    }
    $('lightboxCounter').textContent = (lbIndex + 1) + ' / ' + lbItems.length;
    const single = lbItems.length < 2;
    $('lightboxPrev').hidden = single;
    $('lightboxNext').hidden = single;
  }

  function openViewer(items, i) {
    if (!items || !items.length || !$('lightbox')) return;
    lbItems = items;
    lbIndex = Math.min(Math.max(i || 0, 0), items.length - 1);
    lastFocus = document.activeElement;
    showPhoto();
    $('lightbox').hidden = false;
    document.body.classList.add('lightbox-open');
    $('lightboxClose').focus();
  }

  function openLightbox(i) {
    if (!current) return;
    const { service, concept } = current;
    // Ghi vào hành trình khách (js/router.js) -> tóm tắt gửi Sale khi khách chuyển sang chat Sale.
    if (window.AlohaJourney) window.AlohaJourney.add('photo', { service: service.slug, concept: concept.name });
    openViewer(concept.photos.map((p, k) => photoOf(concept.name, p, k)), i);
  }

  function closeLightbox(silent) {
    const lb = $('lightbox');
    if (!lb || lb.hidden) return;
    $('lightboxVideo').pause();
    lb.hidden = true;
    document.body.classList.remove('lightbox-open');
    if (!silent && lastFocus) lastFocus.focus();
  }

  function step(delta) {
    const n = lbItems.length;
    if (n < 2) return;
    lbIndex = (lbIndex + delta + n) % n;
    showPhoto();
  }

  const lb = $('lightbox');
  if (lb) {
    $('lightboxClose').addEventListener('click', () => closeLightbox());
    $('lightboxPrev').addEventListener('click', () => step(-1));
    $('lightboxNext').addEventListener('click', () => step(1));
    // Bấm ra vùng tối xung quanh ảnh để đóng.
    lb.addEventListener('click', (e) => { if (e.target === lb || e.target.classList.contains('lightbox-stage')) closeLightbox(); });
    document.addEventListener('keydown', (e) => {
      if (lb.hidden) return;
      if (e.key === 'Escape') closeLightbox();
      else if (e.target.tagName === 'VIDEO' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return; // phím mũi tên để tua video
      else if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'Tab') {
        // Giữ focus trong lightbox khi đang mở.
        const f = Array.from(lb.querySelectorAll('button:not([hidden]), video:not([hidden])'));
        const i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    });
    // Vuốt ngang trên điện thoại để chuyển ảnh.
    let touchX = null;
    lb.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', (e) => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      touchX = null;
      if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    });
  }

  // "newborn/cuon-u" -> thông tin + ảnh của concept đó; "newborn" -> thông tin dịch vụ.
  // js/content.js dùng hàm này để trang nội dung lấy ảnh thẳng từ album, không
  // chép lại đường dẫn ảnh ở 2 nơi. Sai slug hoặc concept chưa có ảnh -> null.
  function lookup(ref) {
    const [serviceSlug, conceptSlug] = String(ref || '').split('/');
    const service = serviceBySlug(serviceSlug);
    if (!service) return null;
    if (!conceptSlug) {
      const cover = coverOf(service);
      return cover ? { name: service.name, desc: service.desc, href: '#/album/' + service.slug,
        meta: conceptsOf(service).length + ' concept', cover, photos: [] } : null;
    }
    const concept = conceptsOf(service).find((c) => c.slug === conceptSlug);
    if (!concept) return null;
    const photos = concept.photos.map((p, i) => photoOf(concept.name, p, i));
    return { name: concept.name, desc: concept.desc, href: '#/album/' + service.slug + '/' + concept.slug,
      meta: service.name + ' · ' + photos.length + ' ảnh', cover: photos[0].src, photos };
  }

  // list: dữ liệu rút gọn dùng chung cho chatbot (js/script.js) và test, chỉ gồm concept đã có ảnh.
  window.AlohaAlbums = {
    list: SERVICES.map((s) => ({
      slug: s.slug, name: s.name, desc: s.desc, href: '#/album/' + s.slug,
      concepts: conceptsOf(s).map((c) => ({
        slug: c.slug, name: c.name, desc: c.desc, count: c.photos.length,
        cover: photoOf(c.name, c.photos[0], 0).src, href: '#/album/' + s.slug + '/' + c.slug
      }))
    })),
    render,
    lookup,
    openViewer,
    close: () => closeLightbox(true)
  };
})(window, document);
