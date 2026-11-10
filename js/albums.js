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
      cover: 'images/services/newborn.jpg',
      desc: 'Những ngày đầu đời của bé, chụp khi bé ngủ sâu trong phòng được giữ ấm, tạo dáng nhẹ nhàng và an toàn.',
      concepts: [
        { slug: 'cam-cam-baby', name: 'Cam cam baby', desc: 'Concept Cam cam baby chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/newborn/cam-cam-baby/cam-cam-baby-01.jpg',
            'images/albums/newborn/cam-cam-baby/cam-cam-baby-02.jpg',
            'images/albums/newborn/cam-cam-baby/cam-cam-baby-03.jpg',
            'images/albums/newborn/cam-cam-baby/cam-cam-baby-04.jpg',
            'images/albums/newborn/cam-cam-baby/cam-cam-baby-05.jpg'
          ] },
        { slug: 'coca-baby', name: 'Coca baby', desc: 'Concept Coca baby chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/newborn/coca-baby/coca-baby-01.jpg',
            'images/albums/newborn/coca-baby/coca-baby-02.jpg',
            'images/albums/newborn/coca-baby/coca-baby-03.jpg',
            'images/albums/newborn/coca-baby/coca-baby-04.jpg'
          ] },
        { slug: 'concept-2_9', name: 'Concept 2_9', desc: 'Concept Concept 2_9 chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/newborn/concept-2_9/concept-2_9-01.jpg',
            'images/albums/newborn/concept-2_9/concept-2_9-02.jpg',
            'images/albums/newborn/concept-2_9/concept-2_9-03.jpg',
            'images/albums/newborn/concept-2_9/concept-2_9-04.jpg',
            'images/albums/newborn/concept-2_9/concept-2_9-05.jpg'
          ] },
        { slug: 'concept-ca-chua', name: 'Concept cà chua', desc: 'Concept Concept cà chua chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/newborn/concept-ca-chua/concept-ca-chua-01.jpg',
            'images/albums/newborn/concept-ca-chua/concept-ca-chua-02.jpg',
            'images/albums/newborn/concept-ca-chua/concept-ca-chua-03.jpg'
          ] },
        { slug: 'concept-cuu-nho', name: 'Concept cừu nhỏ', desc: 'Concept Concept cừu nhỏ chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/newborn/concept-cuu-nho/concept-cuu-nho-01.jpg',
            'images/albums/newborn/concept-cuu-nho/concept-cuu-nho-02.jpg',
            'images/albums/newborn/concept-cuu-nho/concept-cuu-nho-03.jpg',
            'images/albums/newborn/concept-cuu-nho/concept-cuu-nho-04.jpg'
          ] },
        { slug: 'concept-giac-mo', name: 'Concept giấc mơ', desc: 'Concept Concept giấc mơ chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/newborn/concept-giac-mo/concept-giac-mo-01.jpg',
            'images/albums/newborn/concept-giac-mo/concept-giac-mo-02.jpg',
            'images/albums/newborn/concept-giac-mo/concept-giac-mo-03.jpg',
            'images/albums/newborn/concept-giac-mo/concept-giac-mo-04.jpg',
            'images/albums/newborn/concept-giac-mo/concept-giac-mo-05.jpg'
          ] },
        { slug: 'concept-hoa-nho', name: 'Concept hoa nhỏ', desc: 'Concept Concept hoa nhỏ chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/newborn/concept-hoa-nho/concept-hoa-nho-01.jpg',
            'images/albums/newborn/concept-hoa-nho/concept-hoa-nho-02.jpg',
            'images/albums/newborn/concept-hoa-nho/concept-hoa-nho-03.jpg',
            'images/albums/newborn/concept-hoa-nho/concept-hoa-nho-04.jpg'
          ] },
        { slug: 'concept-ngua-nho', name: 'Concept ngựa nhỏ', desc: 'Concept Concept ngựa nhỏ chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/newborn/concept-ngua-nho/concept-ngua-nho-01.jpg',
            'images/albums/newborn/concept-ngua-nho/concept-ngua-nho-02.jpg',
            'images/albums/newborn/concept-ngua-nho/concept-ngua-nho-03.jpg',
            'images/albums/newborn/concept-ngua-nho/concept-ngua-nho-04.jpg',
            'images/albums/newborn/concept-ngua-nho/concept-ngua-nho-05.jpg'
          ] },
        { slug: 'concept-ngua-nho-2', name: 'Concept ngựa nhỏ 2', desc: 'Concept Concept ngựa nhỏ 2 chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/newborn/concept-ngua-nho-2/concept-ngua-nho-2-01.jpg',
            'images/albums/newborn/concept-ngua-nho-2/concept-ngua-nho-2-02.jpg',
            'images/albums/newborn/concept-ngua-nho-2/concept-ngua-nho-2-03.jpg',
            'images/albums/newborn/concept-ngua-nho-2/concept-ngua-nho-2-04.jpg'
          ] },
        { slug: 'concept-ngua-pony', name: 'Concept ngựa pony', desc: 'Concept Concept ngựa pony chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/newborn/concept-ngua-pony/concept-ngua-pony-01.jpg',
            'images/albums/newborn/concept-ngua-pony/concept-ngua-pony-02.jpg',
            'images/albums/newborn/concept-ngua-pony/concept-ngua-pony-03.jpg',
            'images/albums/newborn/concept-ngua-pony/concept-ngua-pony-04.jpg',
            'images/albums/newborn/concept-ngua-pony/concept-ngua-pony-05.jpg'
          ] },
        { slug: 'concept-ngua-pony-2', name: 'Concept ngựa pony 2', desc: 'Concept Concept ngựa pony 2 chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/newborn/concept-ngua-pony-2/concept-ngua-pony-2-01.jpg',
            'images/albums/newborn/concept-ngua-pony-2/concept-ngua-pony-2-02.jpg',
            'images/albums/newborn/concept-ngua-pony-2/concept-ngua-pony-2-03.jpg'
          ] },
        { slug: 'concept-qua-chanh-vang', name: 'Concept quả chanh vàng', desc: 'Concept Concept quả chanh vàng chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/newborn/concept-qua-chanh-vang/concept-qua-chanh-vang-01.jpg',
            'images/albums/newborn/concept-qua-chanh-vang/concept-qua-chanh-vang-02.jpg',
            'images/albums/newborn/concept-qua-chanh-vang/concept-qua-chanh-vang-03.jpg',
            'images/albums/newborn/concept-qua-chanh-vang/concept-qua-chanh-vang-04.jpg'
          ] },
        { slug: 'concept-trung-thu', name: 'Concept trung thu', desc: 'Concept Concept trung thu chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/newborn/concept-trung-thu/concept-trung-thu-01.jpg',
            'images/albums/newborn/concept-trung-thu/concept-trung-thu-02.jpg',
            'images/albums/newborn/concept-trung-thu/concept-trung-thu-03.jpg',
            'images/albums/newborn/concept-trung-thu/concept-trung-thu-04.jpg',
            'images/albums/newborn/concept-trung-thu/concept-trung-thu-05.jpg',
            'images/albums/newborn/concept-trung-thu/concept-trung-thu-06.jpg'
          ] },
        { slug: 'concept-trung-thu-2', name: 'Concept trung thu 2', desc: 'Concept Concept trung thu 2 chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/newborn/concept-trung-thu-2/concept-trung-thu-2-01.jpg',
            'images/albums/newborn/concept-trung-thu-2/concept-trung-thu-2-02.jpg',
            'images/albums/newborn/concept-trung-thu-2/concept-trung-thu-2-03.jpg',
            'images/albums/newborn/concept-trung-thu-2/concept-trung-thu-2-04.jpg',
            'images/albums/newborn/concept-trung-thu-2/concept-trung-thu-2-05.jpg'
          ] },
        { slug: 'concept-tim-mong-mo', name: 'Concept tím mộng mơ', desc: 'Concept Concept tím mộng mơ chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/newborn/concept-tim-mong-mo/concept-tim-mong-mo-01.jpg',
            'images/albums/newborn/concept-tim-mong-mo/concept-tim-mong-mo-02.jpg',
            'images/albums/newborn/concept-tim-mong-mo/concept-tim-mong-mo-03.jpg',
            'images/albums/newborn/concept-tim-mong-mo/concept-tim-mong-mo-04.jpg',
            'images/albums/newborn/concept-tim-mong-mo/concept-tim-mong-mo-05.jpg'
          ] },
        { slug: 'happy-dream-2', name: 'Happy dream 2', desc: 'Concept Happy dream 2 chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/newborn/happy-dream-2/happy-dream-2-01.jpg',
            'images/albums/newborn/happy-dream-2/happy-dream-2-02.jpg',
            'images/albums/newborn/happy-dream-2/happy-dream-2-03.jpg',
            'images/albums/newborn/happy-dream-2/happy-dream-2-04.jpg',
            'images/albums/newborn/happy-dream-2/happy-dream-2-05.jpg'
          ] },
        { slug: 'harry-potter', name: 'Harry potter', desc: 'Concept Harry potter chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/newborn/harry-potter/harry-potter-01.jpg',
            'images/albums/newborn/harry-potter/harry-potter-02.jpg',
            'images/albums/newborn/harry-potter/harry-potter-03.jpg',
            'images/albums/newborn/harry-potter/harry-potter-04.jpg'
          ] },
        { slug: 'havard-concept', name: 'Havard concept', desc: 'Concept Havard concept chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/newborn/havard-concept/havard-concept-01.jpg',
            'images/albums/newborn/havard-concept/havard-concept-02.jpg',
            'images/albums/newborn/havard-concept/havard-concept-03.jpg',
            'images/albums/newborn/havard-concept/havard-concept-04.jpg'
          ] },
        { slug: 'hello-kitty', name: 'Hello kitty', desc: 'Concept Hello kitty chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/newborn/hello-kitty/hello-kitty-01.jpg',
            'images/albums/newborn/hello-kitty/hello-kitty-02.jpg',
            'images/albums/newborn/hello-kitty/hello-kitty-03.jpg',
            'images/albums/newborn/hello-kitty/hello-kitty-04.jpg'
          ] },
        { slug: 'khu-vuon-than-bi', name: 'Khu vườn thần bí', desc: 'Concept Khu vườn thần bí chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/newborn/khu-vuon-than-bi/khu-vuon-than-bi-01.jpg',
            'images/albums/newborn/khu-vuon-than-bi/khu-vuon-than-bi-02.jpg',
            'images/albums/newborn/khu-vuon-than-bi/khu-vuon-than-bi-03.jpg',
            'images/albums/newborn/khu-vuon-than-bi/khu-vuon-than-bi-04.jpg',
            'images/albums/newborn/khu-vuon-than-bi/khu-vuon-than-bi-05.jpg'
          ] },
        { slug: 'labubu-concept', name: 'Labubu concept', desc: 'Concept Labubu concept chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/newborn/labubu-concept/labubu-concept-01.jpg',
            'images/albums/newborn/labubu-concept/labubu-concept-02.jpg',
            'images/albums/newborn/labubu-concept/labubu-concept-03.jpg',
            'images/albums/newborn/labubu-concept/labubu-concept-04.jpg'
          ] },
        { slug: 'merry-christmas-1', name: 'Merry christmas 1', desc: 'Concept Merry christmas 1 chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/newborn/merry-christmas-1/merry-christmas-1-01.jpg',
            'images/albums/newborn/merry-christmas-1/merry-christmas-1-02.jpg',
            'images/albums/newborn/merry-christmas-1/merry-christmas-1-03.jpg',
            'images/albums/newborn/merry-christmas-1/merry-christmas-1-04.jpg'
          ] },
        { slug: 'merry-christmas-2', name: 'Merry christmas 2', desc: 'Concept Merry christmas 2 chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/newborn/merry-christmas-2/merry-christmas-2-01.jpg',
            'images/albums/newborn/merry-christmas-2/merry-christmas-2-02.jpg',
            'images/albums/newborn/merry-christmas-2/merry-christmas-2-03.jpg'
          ] },
        { slug: 'nang-tien-xanh', name: 'Nàng tiên xanh', desc: 'Concept Nàng tiên xanh chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/newborn/nang-tien-xanh/nang-tien-xanh-01.jpg',
            'images/albums/newborn/nang-tien-xanh/nang-tien-xanh-02.jpg',
            'images/albums/newborn/nang-tien-xanh/nang-tien-xanh-03.jpg',
            'images/albums/newborn/nang-tien-xanh/nang-tien-xanh-04.jpg'
          ] },
        { slug: 'tet-2', name: 'Tết 2', desc: 'Concept Tết 2 chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/newborn/tet-2/tet-2-01.jpg',
            'images/albums/newborn/tet-2/tet-2-02.jpg',
            'images/albums/newborn/tet-2/tet-2-03.jpg',
            'images/albums/newborn/tet-2/tet-2-04.jpg'
          ] }
      ]
    },
    {
      slug: 'bau',
      name: 'Bầu',
      cover: 'images/services/bau.jpg',
      desc: 'Tôn vinh nét đẹp thiêng liêng của người mẹ trong thai kỳ, lưu giữ những rung động đầu tiên cùng con.',
      concepts: [
        { slug: 'basic-concept-1', name: 'Basic concept 1', desc: 'Concept Basic concept 1 chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/bau/basic-concept-1/basic-concept-1-01.jpg',
            'images/albums/bau/basic-concept-1/basic-concept-1-02.jpg',
            'images/albums/bau/basic-concept-1/basic-concept-1-03.jpg',
            'images/albums/bau/basic-concept-1/basic-concept-1-04.jpg',
            'images/albums/bau/basic-concept-1/basic-concept-1-05.jpg'
          ] },
        { slug: 'basic-concept-2', name: 'Basic concept 2', desc: 'Concept Basic concept 2 chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/bau/basic-concept-2/basic-concept-2-01.jpg',
            'images/albums/bau/basic-concept-2/basic-concept-2-02.jpg',
            'images/albums/bau/basic-concept-2/basic-concept-2-03.jpg',
            'images/albums/bau/basic-concept-2/basic-concept-2-04.jpg',
            'images/albums/bau/basic-concept-2/basic-concept-2-05.jpg'
          ] },
        { slug: 'basic-concept-3', name: 'Basic concept 3', desc: 'Concept Basic concept 3 chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/bau/basic-concept-3/basic-concept-3-01.jpg',
            'images/albums/bau/basic-concept-3/basic-concept-3-02.jpg',
            'images/albums/bau/basic-concept-3/basic-concept-3-03.jpg',
            'images/albums/bau/basic-concept-3/basic-concept-3-04.jpg',
            'images/albums/bau/basic-concept-3/basic-concept-3-05.jpg'
          ] },
        { slug: 'bien-may', name: 'Biển mây', desc: 'Concept Biển mây chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/bau/bien-may/bien-may-01.png',
            'images/albums/bau/bien-may/bien-may-02.png',
            'images/albums/bau/bien-may/bien-may-03.png',
            'images/albums/bau/bien-may/bien-may-04.png',
            'images/albums/bau/bien-may/bien-may-05.png',
            'images/albums/bau/bien-may/bien-may-06.png'
          ] },
        { slug: 'bau-tinh-khoi', name: 'Bầu tinh khôi', desc: 'Concept Bầu tinh khôi chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/bau/bau-tinh-khoi/bau-tinh-khoi-01.jpg',
            'images/albums/bau/bau-tinh-khoi/bau-tinh-khoi-02.jpg',
            'images/albums/bau/bau-tinh-khoi/bau-tinh-khoi-03.jpg',
            'images/albums/bau/bau-tinh-khoi/bau-tinh-khoi-04.jpg'
          ] },
        { slug: 'giua-rung-mo', name: 'Giữa rừng mơ', desc: 'Concept Giữa rừng mơ chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/bau/giua-rung-mo/giua-rung-mo-01.jpg',
            'images/albums/bau/giua-rung-mo/giua-rung-mo-02.jpg',
            'images/albums/bau/giua-rung-mo/giua-rung-mo-03.jpg',
            'images/albums/bau/giua-rung-mo/giua-rung-mo-04.jpg'
          ] },
        { slug: 'gau-bong', name: 'Gấu bông', desc: 'Concept Gấu bông chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/bau/gau-bong/gau-bong-01.jpg',
            'images/albums/bau/gau-bong/gau-bong-02.jpg',
            'images/albums/bau/gau-bong/gau-bong-03.jpg',
            'images/albums/bau/gau-bong/gau-bong-04.jpg',
            'images/albums/bau/gau-bong/gau-bong-05.jpg'
          ] },
        { slug: 'khu-vuon-bi-mat', name: 'Khu vườn bí mật', desc: 'Concept Khu vườn bí mật chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/bau/khu-vuon-bi-mat/khu-vuon-bi-mat-01.jpg',
            'images/albums/bau/khu-vuon-bi-mat/khu-vuon-bi-mat-02.jpg',
            'images/albums/bau/khu-vuon-bi-mat/khu-vuon-bi-mat-03.jpg',
            'images/albums/bau/khu-vuon-bi-mat/khu-vuon-bi-mat-04.jpg',
            'images/albums/bau/khu-vuon-bi-mat/khu-vuon-bi-mat-05.jpg',
            'images/albums/bau/khu-vuon-bi-mat/khu-vuon-bi-mat-06.jpg',
            'images/albums/bau/khu-vuon-bi-mat/khu-vuon-bi-mat-07.jpg',
            'images/albums/bau/khu-vuon-bi-mat/khu-vuon-bi-mat-08.jpg'
          ] },
        { slug: 'khu-vuon-mua-ha', name: 'Khu vườn mùa hạ', desc: 'Concept Khu vườn mùa hạ chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/bau/khu-vuon-mua-ha/khu-vuon-mua-ha-01.jpg',
            'images/albums/bau/khu-vuon-mua-ha/khu-vuon-mua-ha-02.jpg',
            'images/albums/bau/khu-vuon-mua-ha/khu-vuon-mua-ha-03.jpg',
            'images/albums/bau/khu-vuon-mua-ha/khu-vuon-mua-ha-04.jpg'
          ] },
        { slug: 'khuc-giao-mua', name: 'Khúc giao mùa', desc: 'Concept Khúc giao mùa chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/bau/khuc-giao-mua/khuc-giao-mua-01.jpg',
            'images/albums/bau/khuc-giao-mua/khuc-giao-mua-02.jpg',
            'images/albums/bau/khuc-giao-mua/khuc-giao-mua-03.jpg',
            'images/albums/bau/khuc-giao-mua/khuc-giao-mua-04.jpg',
            'images/albums/bau/khuc-giao-mua/khuc-giao-mua-05.jpg'
          ] },
        { slug: 'mon-qua-nho', name: 'Món quà nhỏ', desc: 'Concept Món quà nhỏ chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/bau/mon-qua-nho/mon-qua-nho-01.jpg',
            'images/albums/bau/mon-qua-nho/mon-qua-nho-02.jpg',
            'images/albums/bau/mon-qua-nho/mon-qua-nho-03.jpg',
            'images/albums/bau/mon-qua-nho/mon-qua-nho-04.jpg',
            'images/albums/bau/mon-qua-nho/mon-qua-nho-05.jpg'
          ] },
        { slug: 'mua-thu-1', name: 'Mùa thu 1', desc: 'Concept Mùa thu 1 chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/bau/mua-thu-1/mua-thu-1-01.jpg',
            'images/albums/bau/mua-thu-1/mua-thu-1-02.jpg',
            'images/albums/bau/mua-thu-1/mua-thu-1-03.jpg',
            'images/albums/bau/mua-thu-1/mua-thu-1-04.jpg',
            'images/albums/bau/mua-thu-1/mua-thu-1-05.jpg',
            'images/albums/bau/mua-thu-1/mua-thu-1-06.jpg'
          ] },
        { slug: 'mua-thu-2', name: 'Mùa thu 2', desc: 'Concept Mùa thu 2 chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/bau/mua-thu-2/mua-thu-2-01.jpg',
            'images/albums/bau/mua-thu-2/mua-thu-2-02.jpg',
            'images/albums/bau/mua-thu-2/mua-thu-2-03.jpg',
            'images/albums/bau/mua-thu-2/mua-thu-2-04.jpg',
            'images/albums/bau/mua-thu-2/mua-thu-2-05.jpg',
            'images/albums/bau/mua-thu-2/mua-thu-2-06.jpg',
            'images/albums/bau/mua-thu-2/mua-thu-2-07.jpg'
          ] },
        { slug: 'mua-xuan', name: 'Mùa xuân', desc: 'Concept Mùa xuân chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/bau/mua-xuan/mua-xuan-01.jpg',
            'images/albums/bau/mua-xuan/mua-xuan-02.jpg',
            'images/albums/bau/mua-xuan/mua-xuan-03.jpg',
            'images/albums/bau/mua-xuan/mua-xuan-04.jpg',
            'images/albums/bau/mua-xuan/mua-xuan-05.jpg',
            'images/albums/bau/mua-xuan/mua-xuan-06.jpg',
            'images/albums/bau/mua-xuan/mua-xuan-07.jpg'
          ] },
        { slug: 'thanh-ngoc', name: 'Thanh ngọc', desc: 'Concept Thanh ngọc chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/bau/thanh-ngoc/thanh-ngoc-01.jpg',
            'images/albums/bau/thanh-ngoc/thanh-ngoc-02.jpg',
            'images/albums/bau/thanh-ngoc/thanh-ngoc-03.jpg',
            'images/albums/bau/thanh-ngoc/thanh-ngoc-04.jpg'
          ] },
        { slug: 'thanh-am', name: 'Thanh âm', desc: 'Concept Thanh âm chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/bau/thanh-am/thanh-am-01.jpg',
            'images/albums/bau/thanh-am/thanh-am-02.jpg',
            'images/albums/bau/thanh-am/thanh-am-03.jpg',
            'images/albums/bau/thanh-am/thanh-am-04.jpg',
            'images/albums/bau/thanh-am/thanh-am-05.jpg'
          ] },
        { slug: 'trai-tym-ngot-ngao', name: 'Trái tym ngọt ngào', desc: 'Concept Trái tym ngọt ngào chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/bau/trai-tym-ngot-ngao/trai-tym-ngot-ngao-01.jpg',
            'images/albums/bau/trai-tym-ngot-ngao/trai-tym-ngot-ngao-02.jpg',
            'images/albums/bau/trai-tym-ngot-ngao/trai-tym-ngot-ngao-03.jpg',
            'images/albums/bau/trai-tym-ngot-ngao/trai-tym-ngot-ngao-04.jpg',
            'images/albums/bau/trai-tym-ngot-ngao/trai-tym-ngot-ngao-05.jpg'
          ] },
        { slug: 'vuon-hoa', name: 'Vườn hoa', desc: 'Concept Vườn hoa chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/bau/vuon-hoa/vuon-hoa-01.jpg',
            'images/albums/bau/vuon-hoa/vuon-hoa-02.jpg',
            'images/albums/bau/vuon-hoa/vuon-hoa-03.jpg',
            'images/albums/bau/vuon-hoa/vuon-hoa-04.jpg',
            'images/albums/bau/vuon-hoa/vuon-hoa-05.jpg',
            'images/albums/bau/vuon-hoa/vuon-hoa-06.jpg'
          ] },
        { slug: 'diep-vu-hoa-gian', name: 'Điệp vũ hoa gian', desc: 'Concept Điệp vũ hoa gian chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/bau/diep-vu-hoa-gian/diep-vu-hoa-gian-01.jpg',
            'images/albums/bau/diep-vu-hoa-gian/diep-vu-hoa-gian-02.jpg',
            'images/albums/bau/diep-vu-hoa-gian/diep-vu-hoa-gian-03.jpg',
            'images/albums/bau/diep-vu-hoa-gian/diep-vu-hoa-gian-04.jpg',
            'images/albums/bau/diep-vu-hoa-gian/diep-vu-hoa-gian-05.jpg',
            'images/albums/bau/diep-vu-hoa-gian/diep-vu-hoa-gian-06.jpg'
          ] }
      ]
    },
    {
      slug: 'sinh-nhat',
      name: 'Sinh nhật',
      cover: 'images/services/sinh-nhat.jpg',
      desc: 'Đánh dấu cột mốc tròn tuổi mới của bé với set trang trí bánh kem, bóng bay và trang phục theo chủ đề.',
      concepts: [
        { slug: 'birthday-girl', name: 'Birthday girl', desc: 'Concept Birthday girl chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/sinh-nhat/birthday-girl/birthday-girl-01.jpg',
            'images/albums/sinh-nhat/birthday-girl/birthday-girl-02.jpg',
            'images/albums/sinh-nhat/birthday-girl/birthday-girl-03.jpg',
            'images/albums/sinh-nhat/birthday-girl/birthday-girl-04.jpg',
            'images/albums/sinh-nhat/birthday-girl/birthday-girl-05.jpg'
          ] },
        { slug: 'birthday-party', name: 'Birthday party', desc: 'Concept Birthday party chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/sinh-nhat/birthday-party/birthday-party-01.jpg',
            'images/albums/sinh-nhat/birthday-party/birthday-party-02.jpg',
            'images/albums/sinh-nhat/birthday-party/birthday-party-03.jpg',
            'images/albums/sinh-nhat/birthday-party/birthday-party-04.jpg',
            'images/albums/sinh-nhat/birthday-party/birthday-party-05.jpg'
          ] },
        { slug: 'dream-birthday', name: 'Dream birthday', desc: 'Concept Dream birthday chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/sinh-nhat/dream-birthday/dream-birthday-01.jpg',
            'images/albums/sinh-nhat/dream-birthday/dream-birthday-02.jpg',
            'images/albums/sinh-nhat/dream-birthday/dream-birthday-03.jpg',
            'images/albums/sinh-nhat/dream-birthday/dream-birthday-04.jpg',
            'images/albums/sinh-nhat/dream-birthday/dream-birthday-05.jpg'
          ] },
        { slug: 'happy-birthday', name: 'Happy birthday', desc: 'Concept Happy birthday chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/sinh-nhat/happy-birthday/happy-birthday-01.jpg',
            'images/albums/sinh-nhat/happy-birthday/happy-birthday-02.jpg',
            'images/albums/sinh-nhat/happy-birthday/happy-birthday-03.jpg',
            'images/albums/sinh-nhat/happy-birthday/happy-birthday-04.jpg',
            'images/albums/sinh-nhat/happy-birthday/happy-birthday-05.jpg'
          ] },
        { slug: 'happy-birthday-2', name: 'Happy birthday 2', desc: 'Concept Happy birthday 2 chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/sinh-nhat/happy-birthday-2/happy-birthday-2-01.jpg',
            'images/albums/sinh-nhat/happy-birthday-2/happy-birthday-2-02.jpg',
            'images/albums/sinh-nhat/happy-birthday-2/happy-birthday-2-03.jpg',
            'images/albums/sinh-nhat/happy-birthday-2/happy-birthday-2-04.jpg',
            'images/albums/sinh-nhat/happy-birthday-2/happy-birthday-2-05.jpg'
          ] },
        { slug: 'happy-birthday-3', name: 'Happy birthday 3', desc: 'Concept Happy birthday 3 chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/sinh-nhat/happy-birthday-3/happy-birthday-3-01.jpg',
            'images/albums/sinh-nhat/happy-birthday-3/happy-birthday-3-02.jpg',
            'images/albums/sinh-nhat/happy-birthday-3/happy-birthday-3-03.jpg',
            'images/albums/sinh-nhat/happy-birthday-3/happy-birthday-3-04.jpg',
            'images/albums/sinh-nhat/happy-birthday-3/happy-birthday-3-05.jpg'
          ] },
        { slug: 'happy-birthday-4', name: 'Happy birthday 4', desc: 'Concept Happy birthday 4 chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/sinh-nhat/happy-birthday-4/happy-birthday-4-01.jpg',
            'images/albums/sinh-nhat/happy-birthday-4/happy-birthday-4-02.jpg',
            'images/albums/sinh-nhat/happy-birthday-4/happy-birthday-4-03.jpg',
            'images/albums/sinh-nhat/happy-birthday-4/happy-birthday-4-04.jpg',
            'images/albums/sinh-nhat/happy-birthday-4/happy-birthday-4-05.jpg'
          ] },
        { slug: 'happy-birthday-5', name: 'Happy birthday 5', desc: 'Concept Happy birthday 5 chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/sinh-nhat/happy-birthday-5/happy-birthday-5-01.jpg',
            'images/albums/sinh-nhat/happy-birthday-5/happy-birthday-5-02.jpg',
            'images/albums/sinh-nhat/happy-birthday-5/happy-birthday-5-03.jpg',
            'images/albums/sinh-nhat/happy-birthday-5/happy-birthday-5-04.jpg',
            'images/albums/sinh-nhat/happy-birthday-5/happy-birthday-5-05.jpg',
            'images/albums/sinh-nhat/happy-birthday-5/happy-birthday-5-06.jpg'
          ] },
        { slug: 'happy-birthday-6', name: 'Happy birthday 6', desc: 'Concept Happy birthday 6 chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/sinh-nhat/happy-birthday-6/happy-birthday-6-01.jpg',
            'images/albums/sinh-nhat/happy-birthday-6/happy-birthday-6-02.jpg',
            'images/albums/sinh-nhat/happy-birthday-6/happy-birthday-6-03.jpg',
            'images/albums/sinh-nhat/happy-birthday-6/happy-birthday-6-04.jpg',
            'images/albums/sinh-nhat/happy-birthday-6/happy-birthday-6-05.jpg'
          ] },
        { slug: 'happy-birthday-7', name: 'Happy birthday 7', desc: 'Concept Happy birthday 7 chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/sinh-nhat/happy-birthday-7/happy-birthday-7-01.jpg',
            'images/albums/sinh-nhat/happy-birthday-7/happy-birthday-7-02.jpg',
            'images/albums/sinh-nhat/happy-birthday-7/happy-birthday-7-03.jpg',
            'images/albums/sinh-nhat/happy-birthday-7/happy-birthday-7-04.jpg',
            'images/albums/sinh-nhat/happy-birthday-7/happy-birthday-7-05.jpg'
          ] },
        { slug: 'happy-birthday-8', name: 'Happy birthday 8', desc: 'Concept Happy birthday 8 chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/sinh-nhat/happy-birthday-8/happy-birthday-8-01.jpg',
            'images/albums/sinh-nhat/happy-birthday-8/happy-birthday-8-02.jpg',
            'images/albums/sinh-nhat/happy-birthday-8/happy-birthday-8-03.jpg',
            'images/albums/sinh-nhat/happy-birthday-8/happy-birthday-8-04.jpg'
          ] },
        { slug: 'happy-birthday-boy', name: 'Happy birthday boy', desc: 'Concept Happy birthday boy chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/sinh-nhat/happy-birthday-boy/happy-birthday-boy-01.jpg',
            'images/albums/sinh-nhat/happy-birthday-boy/happy-birthday-boy-02.jpg',
            'images/albums/sinh-nhat/happy-birthday-boy/happy-birthday-boy-03.jpg'
          ] },
        { slug: 'little-princess', name: 'Little princess', desc: 'Concept Little princess chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/sinh-nhat/little-princess/little-princess-01.jpg',
            'images/albums/sinh-nhat/little-princess/little-princess-02.jpg',
            'images/albums/sinh-nhat/little-princess/little-princess-03.jpg',
            'images/albums/sinh-nhat/little-princess/little-princess-04.jpg'
          ] },
        { slug: 'sinh-nhat-1', name: 'Sinh nhật 1', desc: 'Concept Sinh nhật 1 chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/sinh-nhat/sinh-nhat-1/sinh-nhat-1-01.jpg',
            'images/albums/sinh-nhat/sinh-nhat-1/sinh-nhat-1-02.jpg',
            'images/albums/sinh-nhat/sinh-nhat-1/sinh-nhat-1-03.jpg',
            'images/albums/sinh-nhat/sinh-nhat-1/sinh-nhat-1-04.jpg',
            'images/albums/sinh-nhat/sinh-nhat-1/sinh-nhat-1-05.jpg'
          ] },
        { slug: 'sinh-nhat-2', name: 'Sinh nhật 2', desc: 'Concept Sinh nhật 2 chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/sinh-nhat/sinh-nhat-2/sinh-nhat-2-01.jpg',
            'images/albums/sinh-nhat/sinh-nhat-2/sinh-nhat-2-02.jpg',
            'images/albums/sinh-nhat/sinh-nhat-2/sinh-nhat-2-03.jpg',
            'images/albums/sinh-nhat/sinh-nhat-2/sinh-nhat-2-04.jpg'
          ] }
      ]
    },
    {
      slug: 'be-lon',
      name: 'Bé lớn',
      cover: 'images/services/be-lon.jpg',
      desc: 'Giai đoạn bé đã biết đi, biết biểu cảm tự nhiên, hoạt bát trước ống kính.',
      concepts: [
        { slug: 'alice', name: 'Alice', desc: 'Concept Alice chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/be-lon/alice/alice-01.jpg',
            'images/albums/be-lon/alice/alice-02.jpg',
            'images/albums/be-lon/alice/alice-03.jpg',
            'images/albums/be-lon/alice/alice-04.jpg',
            'images/albums/be-lon/alice/alice-05.jpg'
          ] },
        { slug: 'basic-concept-be-gai', name: 'Basic concept (Bé gái)', desc: 'Concept Basic concept (Bé gái) chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/be-lon/basic-concept-be-gai/basic-concept-be-gai-01.jpg',
            'images/albums/be-lon/basic-concept-be-gai/basic-concept-be-gai-02.jpg',
            'images/albums/be-lon/basic-concept-be-gai/basic-concept-be-gai-03.jpg'
          ] },
        { slug: 'basic-concept-be-trai', name: 'Basic concept (Bé trai)', desc: 'Concept Basic concept (Bé trai) chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/be-lon/basic-concept-be-trai/basic-concept-be-trai-01.jpg',
            'images/albums/be-lon/basic-concept-be-trai/basic-concept-be-trai-02.jpg',
            'images/albums/be-lon/basic-concept-be-trai/basic-concept-be-trai-03.jpg',
            'images/albums/be-lon/basic-concept-be-trai/basic-concept-be-trai-04.jpg'
          ] },
        { slug: 'basic-concept-2', name: 'Basic concept 2', desc: 'Concept Basic concept 2 chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/be-lon/basic-concept-2/basic-concept-2-01.jpg',
            'images/albums/be-lon/basic-concept-2/basic-concept-2-02.jpg',
            'images/albums/be-lon/basic-concept-2/basic-concept-2-03.jpg',
            'images/albums/be-lon/basic-concept-2/basic-concept-2-04.jpg'
          ] },
        { slug: 'basic-concept-3', name: 'Basic concept 3', desc: 'Concept Basic concept 3 chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/be-lon/basic-concept-3/basic-concept-3-01.jpg',
            'images/albums/be-lon/basic-concept-3/basic-concept-3-02.jpg',
            'images/albums/be-lon/basic-concept-3/basic-concept-3-03.jpg',
            'images/albums/be-lon/basic-concept-3/basic-concept-3-04.jpg'
          ] },
        { slug: 'blooming-baby', name: 'Blooming baby', desc: 'Concept Blooming baby chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/be-lon/blooming-baby/blooming-baby-01.jpg',
            'images/albums/be-lon/blooming-baby/blooming-baby-02.jpg',
            'images/albums/be-lon/blooming-baby/blooming-baby-03.jpg',
            'images/albums/be-lon/blooming-baby/blooming-baby-04.jpg',
            'images/albums/be-lon/blooming-baby/blooming-baby-05.jpg'
          ] },
        { slug: 'be-ca-concept', name: 'Bé cá concept', desc: 'Concept Bé cá concept chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/be-lon/be-ca-concept/be-ca-concept-01.jpg',
            'images/albums/be-lon/be-ca-concept/be-ca-concept-02.jpg',
            'images/albums/be-lon/be-ca-concept/be-ca-concept-03.jpg',
            'images/albums/be-lon/be-ca-concept/be-ca-concept-04.jpg',
            'images/albums/be-lon/be-ca-concept/be-ca-concept-05.jpg'
          ] },
        { slug: 'bach-tuyet', name: 'Bạch tuyết', desc: 'Concept Bạch tuyết chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/be-lon/bach-tuyet/bach-tuyet-01.jpg',
            'images/albums/be-lon/bach-tuyet/bach-tuyet-02.jpg',
            'images/albums/be-lon/bach-tuyet/bach-tuyet-03.jpg',
            'images/albums/be-lon/bach-tuyet/bach-tuyet-04.jpg',
            'images/albums/be-lon/bach-tuyet/bach-tuyet-05.jpg'
          ] },
        { slug: 'chu-chuot-nho', name: 'Chú chuột nhỏ', desc: 'Concept Chú chuột nhỏ chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/be-lon/chu-chuot-nho/chu-chuot-nho-01.jpg',
            'images/albums/be-lon/chu-chuot-nho/chu-chuot-nho-02.jpg',
            'images/albums/be-lon/chu-chuot-nho/chu-chuot-nho-03.jpg',
            'images/albums/be-lon/chu-chuot-nho/chu-chuot-nho-04.jpg'
          ] },
        { slug: 'chu-ong-nho', name: 'Chú ong nhỏ', desc: 'Concept Chú ong nhỏ chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/be-lon/chu-ong-nho/chu-ong-nho-01.jpg',
            'images/albums/be-lon/chu-ong-nho/chu-ong-nho-02.jpg',
            'images/albums/be-lon/chu-ong-nho/chu-ong-nho-03.jpg',
            'images/albums/be-lon/chu-ong-nho/chu-ong-nho-04.jpg',
            'images/albums/be-lon/chu-ong-nho/chu-ong-nho-05.jpg'
          ] },
        { slug: 'concept-bong-hoa-nho', name: 'Concept bông hoa nhỏ', desc: 'Concept Concept bông hoa nhỏ chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/be-lon/concept-bong-hoa-nho/concept-bong-hoa-nho-01.jpg',
            'images/albums/be-lon/concept-bong-hoa-nho/concept-bong-hoa-nho-02.jpg',
            'images/albums/be-lon/concept-bong-hoa-nho/concept-bong-hoa-nho-03.jpg',
            'images/albums/be-lon/concept-bong-hoa-nho/concept-bong-hoa-nho-04.jpg'
          ] },
        { slug: 'concept-hoa-nhi', name: 'Concept hoa nhí', desc: 'Concept Concept hoa nhí chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/be-lon/concept-hoa-nhi/concept-hoa-nhi-01.jpg',
            'images/albums/be-lon/concept-hoa-nhi/concept-hoa-nhi-02.jpg',
            'images/albums/be-lon/concept-hoa-nhi/concept-hoa-nhi-03.jpg',
            'images/albums/be-lon/concept-hoa-nhi/concept-hoa-nhi-04.jpg',
            'images/albums/be-lon/concept-hoa-nhi/concept-hoa-nhi-05.jpg',
            'images/albums/be-lon/concept-hoa-nhi/concept-hoa-nhi-06.jpg'
          ] },
        { slug: 'concept-mua-thu', name: 'Concept mùa thu', desc: 'Concept Concept mùa thu chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/be-lon/concept-mua-thu/concept-mua-thu-01.jpg',
            'images/albums/be-lon/concept-mua-thu/concept-mua-thu-02.jpg',
            'images/albums/be-lon/concept-mua-thu/concept-mua-thu-03.jpg',
            'images/albums/be-lon/concept-mua-thu/concept-mua-thu-04.jpg',
            'images/albums/be-lon/concept-mua-thu/concept-mua-thu-05.jpg'
          ] },
        { slug: 'concept-nha-tham-hiem', name: 'Concept nhà thám hiểm', desc: 'Concept Concept nhà thám hiểm chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/be-lon/concept-nha-tham-hiem/concept-nha-tham-hiem-01.jpg',
            'images/albums/be-lon/concept-nha-tham-hiem/concept-nha-tham-hiem-02.jpg',
            'images/albums/be-lon/concept-nha-tham-hiem/concept-nha-tham-hiem-03.jpg',
            'images/albums/be-lon/concept-nha-tham-hiem/concept-nha-tham-hiem-04.jpg',
            'images/albums/be-lon/concept-nha-tham-hiem/concept-nha-tham-hiem-05.jpg',
            'images/albums/be-lon/concept-nha-tham-hiem/concept-nha-tham-hiem-06.jpg'
          ] },
        { slug: 'concept-vit-nho', name: 'Concept vịt nhỏ', desc: 'Concept Concept vịt nhỏ chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/be-lon/concept-vit-nho/concept-vit-nho-01.jpg',
            'images/albums/be-lon/concept-vit-nho/concept-vit-nho-02.jpg',
            'images/albums/be-lon/concept-vit-nho/concept-vit-nho-03.jpg',
            'images/albums/be-lon/concept-vit-nho/concept-vit-nho-04.jpg'
          ] },
        { slug: 'co-gai-nho', name: 'Cô gái nhỏ', desc: 'Concept Cô gái nhỏ chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/be-lon/co-gai-nho/co-gai-nho-01.jpg',
            'images/albums/be-lon/co-gai-nho/co-gai-nho-02.jpg',
            'images/albums/be-lon/co-gai-nho/co-gai-nho-03.jpg',
            'images/albums/be-lon/co-gai-nho/co-gai-nho-04.jpg',
            'images/albums/be-lon/co-gai-nho/co-gai-nho-05.jpg'
          ] },
        { slug: 'co-phu-thuy-nho', name: 'Cô phù thuỷ nhỏ', desc: 'Concept Cô phù thuỷ nhỏ chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/be-lon/co-phu-thuy-nho/co-phu-thuy-nho-01.jpg',
            'images/albums/be-lon/co-phu-thuy-nho/co-phu-thuy-nho-02.jpg',
            'images/albums/be-lon/co-phu-thuy-nho/co-phu-thuy-nho-03.jpg',
            'images/albums/be-lon/co-phu-thuy-nho/co-phu-thuy-nho-04.jpg',
            'images/albums/be-lon/co-phu-thuy-nho/co-phu-thuy-nho-05.jpg'
          ] },
        { slug: 'cong-chua-toc-may', name: 'Công chúa tóc mây', desc: 'Concept Công chúa tóc mây chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/be-lon/cong-chua-toc-may/cong-chua-toc-may-01.jpg',
            'images/albums/be-lon/cong-chua-toc-may/cong-chua-toc-may-02.jpg',
            'images/albums/be-lon/cong-chua-toc-may/cong-chua-toc-may-03.jpg',
            'images/albums/be-lon/cong-chua-toc-may/cong-chua-toc-may-04.jpg'
          ] },
        { slug: 'dau-tay-hong', name: 'Dâu tây hồng', desc: 'Concept Dâu tây hồng chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/be-lon/dau-tay-hong/dau-tay-hong-01.jpg',
            'images/albums/be-lon/dau-tay-hong/dau-tay-hong-02.jpg',
            'images/albums/be-lon/dau-tay-hong/dau-tay-hong-03.jpg',
            'images/albums/be-lon/dau-tay-hong/dau-tay-hong-04.jpg',
            'images/albums/be-lon/dau-tay-hong/dau-tay-hong-05.jpg',
            'images/albums/be-lon/dau-tay-hong/dau-tay-hong-06.jpg'
          ] },
        { slug: 'giac-mo-vui-ve', name: 'Giấc mơ vui vẻ', desc: 'Concept Giấc mơ vui vẻ chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/be-lon/giac-mo-vui-ve/giac-mo-vui-ve-01.jpg',
            'images/albums/be-lon/giac-mo-vui-ve/giac-mo-vui-ve-02.jpg',
            'images/albums/be-lon/giac-mo-vui-ve/giac-mo-vui-ve-03.jpg',
            'images/albums/be-lon/giac-mo-vui-ve/giac-mo-vui-ve-04.jpg',
            'images/albums/be-lon/giac-mo-vui-ve/giac-mo-vui-ve-05.jpg'
          ] },
        { slug: 'halloween-1', name: 'Halloween 1', desc: 'Concept Halloween 1 chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/be-lon/halloween-1/halloween-1-01.jpg',
            'images/albums/be-lon/halloween-1/halloween-1-02.jpg',
            'images/albums/be-lon/halloween-1/halloween-1-03.jpg',
            'images/albums/be-lon/halloween-1/halloween-1-04.jpg',
            'images/albums/be-lon/halloween-1/halloween-1-05.jpg'
          ] },
        { slug: 'halloween-2', name: 'Halloween 2', desc: 'Concept Halloween 2 chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/be-lon/halloween-2/halloween-2-01.jpg',
            'images/albums/be-lon/halloween-2/halloween-2-02.jpg',
            'images/albums/be-lon/halloween-2/halloween-2-03.jpg',
            'images/albums/be-lon/halloween-2/halloween-2-04.jpg',
            'images/albums/be-lon/halloween-2/halloween-2-05.jpg',
            'images/albums/be-lon/halloween-2/halloween-2-06.jpg'
          ] },
        { slug: 'halloween-3', name: 'Halloween 3', desc: 'Concept Halloween 3 chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/be-lon/halloween-3/halloween-3-01.jpg',
            'images/albums/be-lon/halloween-3/halloween-3-02.jpg',
            'images/albums/be-lon/halloween-3/halloween-3-03.jpg',
            'images/albums/be-lon/halloween-3/halloween-3-04.jpg',
            'images/albums/be-lon/halloween-3/halloween-3-05.jpg'
          ] },
        { slug: 'hanbok-baby', name: 'Hanbok baby', desc: 'Concept Hanbok baby chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/be-lon/hanbok-baby/hanbok-baby-01.jpg',
            'images/albums/be-lon/hanbok-baby/hanbok-baby-02.jpg',
            'images/albums/be-lon/hanbok-baby/hanbok-baby-03.jpg',
            'images/albums/be-lon/hanbok-baby/hanbok-baby-04.jpg',
            'images/albums/be-lon/hanbok-baby/hanbok-baby-05.jpg',
            'images/albums/be-lon/hanbok-baby/hanbok-baby-06.jpg'
          ] },
        { slug: 'hary-potter', name: 'Hary potter', desc: 'Concept Hary potter chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/be-lon/hary-potter/hary-potter-01.jpg',
            'images/albums/be-lon/hary-potter/hary-potter-02.jpg',
            'images/albums/be-lon/hary-potter/hary-potter-03.jpg',
            'images/albums/be-lon/hary-potter/hary-potter-04.jpg'
          ] },
        { slug: 'hary-potter-2', name: 'Hary potter 2', desc: 'Concept Hary potter 2 chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/be-lon/hary-potter-2/hary-potter-2-01.jpg',
            'images/albums/be-lon/hary-potter-2/hary-potter-2-02.jpg',
            'images/albums/be-lon/hary-potter-2/hary-potter-2-03.jpg',
            'images/albums/be-lon/hary-potter-2/hary-potter-2-04.jpg'
          ] },
        { slug: 'hy-lan', name: 'Hỷ lân', desc: 'Concept Hỷ lân chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/be-lon/hy-lan/hy-lan-01.jpg',
            'images/albums/be-lon/hy-lan/hy-lan-02.jpg',
            'images/albums/be-lon/hy-lan/hy-lan-03.jpg',
            'images/albums/be-lon/hy-lan/hy-lan-04.jpg',
            'images/albums/be-lon/hy-lan/hy-lan-05.jpg',
            'images/albums/be-lon/hy-lan/hy-lan-06.jpg'
          ] },
        { slug: 'khu-vuon-co-tich', name: 'Khu vườn cổ tích', desc: 'Concept Khu vườn cổ tích chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/be-lon/khu-vuon-co-tich/khu-vuon-co-tich-01.jpg',
            'images/albums/be-lon/khu-vuon-co-tich/khu-vuon-co-tich-02.jpg',
            'images/albums/be-lon/khu-vuon-co-tich/khu-vuon-co-tich-03.jpg',
            'images/albums/be-lon/khu-vuon-co-tich/khu-vuon-co-tich-04.jpg',
            'images/albums/be-lon/khu-vuon-co-tich/khu-vuon-co-tich-05.jpg'
          ] },
        { slug: 'little-boy', name: 'Little boy', desc: 'Concept Little boy chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/be-lon/little-boy/little-boy-01.jpg',
            'images/albums/be-lon/little-boy/little-boy-02.jpg',
            'images/albums/be-lon/little-boy/little-boy-03.jpg',
            'images/albums/be-lon/little-boy/little-boy-04.jpg'
          ] },
        { slug: 'little-girl', name: 'Little girl', desc: 'Concept Little girl chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/be-lon/little-girl/little-girl-01.jpg',
            'images/albums/be-lon/little-girl/little-girl-02.jpg',
            'images/albums/be-lon/little-girl/little-girl-03.jpg',
            'images/albums/be-lon/little-girl/little-girl-04.jpg'
          ] },
        { slug: 'marry-christmas', name: 'Marry christmas', desc: 'Concept Marry christmas chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/be-lon/marry-christmas/marry-christmas-01.jpg',
            'images/albums/be-lon/marry-christmas/marry-christmas-02.jpg',
            'images/albums/be-lon/marry-christmas/marry-christmas-03.jpg',
            'images/albums/be-lon/marry-christmas/marry-christmas-04.jpg',
            'images/albums/be-lon/marry-christmas/marry-christmas-05.jpg'
          ] },
        { slug: 'marry-christmas-2', name: 'Marry christmas 2', desc: 'Concept Marry christmas 2 chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/be-lon/marry-christmas-2/marry-christmas-2-01.jpg',
            'images/albums/be-lon/marry-christmas-2/marry-christmas-2-02.jpg',
            'images/albums/be-lon/marry-christmas-2/marry-christmas-2-03.jpg',
            'images/albums/be-lon/marry-christmas-2/marry-christmas-2-04.jpg'
          ] },
        { slug: 'marry-christmas-3', name: 'Marry christmas 3', desc: 'Concept Marry christmas 3 chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/be-lon/marry-christmas-3/marry-christmas-3-01.jpg',
            'images/albums/be-lon/marry-christmas-3/marry-christmas-3-02.jpg',
            'images/albums/be-lon/marry-christmas-3/marry-christmas-3-03.jpg',
            'images/albums/be-lon/marry-christmas-3/marry-christmas-3-04.jpg'
          ] },
        { slug: 'marry-christmas-4', name: 'Marry christmas 4', desc: 'Concept Marry christmas 4 chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/be-lon/marry-christmas-4/marry-christmas-4-01.jpg',
            'images/albums/be-lon/marry-christmas-4/marry-christmas-4-02.jpg',
            'images/albums/be-lon/marry-christmas-4/marry-christmas-4-03.jpg',
            'images/albums/be-lon/marry-christmas-4/marry-christmas-4-04.jpg'
          ] },
        { slug: 'mat-troi-nho', name: 'Mặt trời nhỏ', desc: 'Concept Mặt trời nhỏ chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/be-lon/mat-troi-nho/mat-troi-nho-01.jpg',
            'images/albums/be-lon/mat-troi-nho/mat-troi-nho-02.jpg',
            'images/albums/be-lon/mat-troi-nho/mat-troi-nho-03.jpg',
            'images/albums/be-lon/mat-troi-nho/mat-troi-nho-04.jpg'
          ] },
        { slug: 'nong-trai-vui-ve', name: 'Nông trại vui vẻ', desc: 'Concept Nông trại vui vẻ chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/be-lon/nong-trai-vui-ve/nong-trai-vui-ve-01.jpg',
            'images/albums/be-lon/nong-trai-vui-ve/nong-trai-vui-ve-02.jpg',
            'images/albums/be-lon/nong-trai-vui-ve/nong-trai-vui-ve-03.jpg',
            'images/albums/be-lon/nong-trai-vui-ve/nong-trai-vui-ve-04.jpg',
            'images/albums/be-lon/nong-trai-vui-ve/nong-trai-vui-ve-05.jpg'
          ] },
        { slug: 'ponyo-boy', name: 'Ponyo boy', desc: 'Concept Ponyo boy chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/be-lon/ponyo-boy/ponyo-boy-01.jpg',
            'images/albums/be-lon/ponyo-boy/ponyo-boy-02.jpg',
            'images/albums/be-lon/ponyo-boy/ponyo-boy-03.jpg',
            'images/albums/be-lon/ponyo-boy/ponyo-boy-04.jpg',
            'images/albums/be-lon/ponyo-boy/ponyo-boy-05.jpg'
          ] },
        { slug: 'qua-tao-nho', name: 'Quả táo nhỏ', desc: 'Concept Quả táo nhỏ chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/be-lon/qua-tao-nho/qua-tao-nho-01.jpg',
            'images/albums/be-lon/qua-tao-nho/qua-tao-nho-02.jpg',
            'images/albums/be-lon/qua-tao-nho/qua-tao-nho-03.jpg',
            'images/albums/be-lon/qua-tao-nho/qua-tao-nho-04.jpg'
          ] },
        { slug: 'summer-vibe', name: 'Summer vibe', desc: 'Concept Summer vibe chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/be-lon/summer-vibe/summer-vibe-01.jpg',
            'images/albums/be-lon/summer-vibe/summer-vibe-02.jpg',
            'images/albums/be-lon/summer-vibe/summer-vibe-03.jpg',
            'images/albums/be-lon/summer-vibe/summer-vibe-04.jpg'
          ] },
        { slug: 'summer-vibe-2', name: 'Summer vibe 2', desc: 'Concept Summer vibe 2 chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/be-lon/summer-vibe-2/summer-vibe-2-01.jpg',
            'images/albums/be-lon/summer-vibe-2/summer-vibe-2-02.jpg',
            'images/albums/be-lon/summer-vibe-2/summer-vibe-2-03.jpg',
            'images/albums/be-lon/summer-vibe-2/summer-vibe-2-04.jpg',
            'images/albums/be-lon/summer-vibe-2/summer-vibe-2-05.jpg'
          ] },
        { slug: 'summer-vibe-3', name: 'Summer vibe 3', desc: 'Concept Summer vibe 3 chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/be-lon/summer-vibe-3/summer-vibe-3-01.jpg',
            'images/albums/be-lon/summer-vibe-3/summer-vibe-3-02.jpg',
            'images/albums/be-lon/summer-vibe-3/summer-vibe-3-03.jpg',
            'images/albums/be-lon/summer-vibe-3/summer-vibe-3-04.jpg'
          ] },
        { slug: 'trung-thu', name: 'Trung thu', desc: 'Concept Trung thu chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/be-lon/trung-thu/trung-thu-01.jpg',
            'images/albums/be-lon/trung-thu/trung-thu-02.jpg',
            'images/albums/be-lon/trung-thu/trung-thu-03.jpg',
            'images/albums/be-lon/trung-thu/trung-thu-04.jpg',
            'images/albums/be-lon/trung-thu/trung-thu-05.jpg',
            'images/albums/be-lon/trung-thu/trung-thu-06.jpg'
          ] },
        { slug: 'tet', name: 'Tết', desc: 'Concept Tết chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/be-lon/tet/tet-01.jpg',
            'images/albums/be-lon/tet/tet-02.jpg',
            'images/albums/be-lon/tet/tet-03.jpg',
            'images/albums/be-lon/tet/tet-04.jpg'
          ] },
        { slug: 'tet-doc-lap', name: 'Tết độc lập', desc: 'Concept Tết độc lập chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/be-lon/tet-doc-lap/tet-doc-lap-01.jpg',
            'images/albums/be-lon/tet-doc-lap/tet-doc-lap-02.jpg',
            'images/albums/be-lon/tet-doc-lap/tet-doc-lap-03.jpg',
            'images/albums/be-lon/tet-doc-lap/tet-doc-lap-04.jpg',
            'images/albums/be-lon/tet-doc-lap/tet-doc-lap-05.jpg',
            'images/albums/be-lon/tet-doc-lap/tet-doc-lap-06.jpg',
            'images/albums/be-lon/tet-doc-lap/tet-doc-lap-07.jpg',
            'images/albums/be-lon/tet-doc-lap/tet-doc-lap-08.jpg'
          ] },
        { slug: 'tet-doc-lap-2', name: 'Tết độc lập 2', desc: 'Concept Tết độc lập 2 chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/be-lon/tet-doc-lap-2/tet-doc-lap-2-01.jpg',
            'images/albums/be-lon/tet-doc-lap-2/tet-doc-lap-2-02.jpg',
            'images/albums/be-lon/tet-doc-lap-2/tet-doc-lap-2-03.jpg',
            'images/albums/be-lon/tet-doc-lap-2/tet-doc-lap-2-04.jpg',
            'images/albums/be-lon/tet-doc-lap-2/tet-doc-lap-2-05.jpg',
            'images/albums/be-lon/tet-doc-lap-2/tet-doc-lap-2-06.jpg',
            'images/albums/be-lon/tet-doc-lap-2/tet-doc-lap-2-07.jpg'
          ] },
        { slug: 'vit-donal', name: 'Vịt donal', desc: 'Concept Vịt donal chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/be-lon/vit-donal/vit-donal-01.jpg',
            'images/albums/be-lon/vit-donal/vit-donal-02.jpg',
            'images/albums/be-lon/vit-donal/vit-donal-03.jpg',
            'images/albums/be-lon/vit-donal/vit-donal-04.jpg'
          ] }
      ]
    },
    {
      slug: 'gia-dinh',
      name: 'Gia đình',
      cover: 'images/services/gia-dinh.jpg',
      desc: 'Bức ảnh sum vầy của ba mẹ, con cái và ông bà, lưu giữ tình cảm ấm áp qua từng thế hệ.',
      concepts: [
        { slug: 'blue-family', name: 'Blue family', desc: 'Concept Blue family chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/gia-dinh/blue-family/blue-family-01.jpg',
            'images/albums/gia-dinh/blue-family/blue-family-02.jpg',
            'images/albums/gia-dinh/blue-family/blue-family-03.jpg',
            'images/albums/gia-dinh/blue-family/blue-family-04.jpg'
          ] },
        { slug: 'con-dau-long', name: 'Con đầu lòng', desc: 'Concept Con đầu lòng chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/gia-dinh/con-dau-long/con-dau-long-01.jpg',
            'images/albums/gia-dinh/con-dau-long/con-dau-long-02.jpg',
            'images/albums/gia-dinh/con-dau-long/con-dau-long-03.jpg',
            'images/albums/gia-dinh/con-dau-long/con-dau-long-04.jpg'
          ] },
        { slug: 'fruity-family', name: 'Fruity family', desc: 'Concept Fruity family chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/gia-dinh/fruity-family/fruity-family-01.jpg',
            'images/albums/gia-dinh/fruity-family/fruity-family-02.jpg',
            'images/albums/gia-dinh/fruity-family/fruity-family-03.jpg',
            'images/albums/gia-dinh/fruity-family/fruity-family-04.jpg'
          ] },
        { slug: 'home-sweet-home', name: 'Home sweet home', desc: 'Concept Home sweet home chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/gia-dinh/home-sweet-home/home-sweet-home-01.jpg',
            'images/albums/gia-dinh/home-sweet-home/home-sweet-home-02.jpg',
            'images/albums/gia-dinh/home-sweet-home/home-sweet-home-03.jpg',
            'images/albums/gia-dinh/home-sweet-home/home-sweet-home-04.jpg'
          ] },
        { slug: 'merry-christmas', name: 'Merry christmas', desc: 'Concept Merry christmas chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/gia-dinh/merry-christmas/merry-christmas-01.jpg',
            'images/albums/gia-dinh/merry-christmas/merry-christmas-02.jpg',
            'images/albums/gia-dinh/merry-christmas/merry-christmas-03.jpg',
            'images/albums/gia-dinh/merry-christmas/merry-christmas-04.jpg'
          ] },
        { slug: 'me-con-ngay-tet', name: 'Mẹ con ngày Tết', desc: 'Concept Mẹ con ngày Tết chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/gia-dinh/me-con-ngay-tet/me-con-ngay-tet-01.jpg',
            'images/albums/gia-dinh/me-con-ngay-tet/me-con-ngay-tet-02.jpg',
            'images/albums/gia-dinh/me-con-ngay-tet/me-con-ngay-tet-03.jpg'
          ] },
        { slug: 'nha-minh-co-hoa', name: 'Nhà mình có hoa', desc: 'Concept Nhà mình có hoa chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/gia-dinh/nha-minh-co-hoa/nha-minh-co-hoa-01.jpg',
            'images/albums/gia-dinh/nha-minh-co-hoa/nha-minh-co-hoa-02.jpg',
            'images/albums/gia-dinh/nha-minh-co-hoa/nha-minh-co-hoa-03.jpg',
            'images/albums/gia-dinh/nha-minh-co-hoa/nha-minh-co-hoa-04.jpg'
          ] },
        { slug: 'phu-quy', name: 'Phú quý', desc: 'Concept Phú quý chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/gia-dinh/phu-quy/phu-quy-01.jpg',
            'images/albums/gia-dinh/phu-quy/phu-quy-02.jpg',
            'images/albums/gia-dinh/phu-quy/phu-quy-03.jpg',
            'images/albums/gia-dinh/phu-quy/phu-quy-04.jpg'
          ] },
        { slug: 'simple-love', name: 'Simple love', desc: 'Concept Simple love chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/gia-dinh/simple-love/simple-love-01.jpg',
            'images/albums/gia-dinh/simple-love/simple-love-02.jpg',
            'images/albums/gia-dinh/simple-love/simple-love-03.jpg',
            'images/albums/gia-dinh/simple-love/simple-love-04.jpg'
          ] },
        { slug: 'strawberry-garden', name: 'Strawberry garden', desc: 'Concept Strawberry garden chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/gia-dinh/strawberry-garden/strawberry-garden-01.jpg',
            'images/albums/gia-dinh/strawberry-garden/strawberry-garden-02.jpg',
            'images/albums/gia-dinh/strawberry-garden/strawberry-garden-03.jpg',
            'images/albums/gia-dinh/strawberry-garden/strawberry-garden-04.jpg'
          ] },
        { slug: 'summer-picnic', name: 'Summer picnic', desc: 'Concept Summer picnic chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/gia-dinh/summer-picnic/summer-picnic-01.jpg',
            'images/albums/gia-dinh/summer-picnic/summer-picnic-02.jpg',
            'images/albums/gia-dinh/summer-picnic/summer-picnic-03.jpg',
            'images/albums/gia-dinh/summer-picnic/summer-picnic-04.jpg'
          ] },
        { slug: 'tet-nhu-y', name: 'Tết như ý', desc: 'Concept Tết như ý chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/gia-dinh/tet-nhu-y/tet-nhu-y-01.jpg',
            'images/albums/gia-dinh/tet-nhu-y/tet-nhu-y-02.jpg',
            'images/albums/gia-dinh/tet-nhu-y/tet-nhu-y-03.jpg',
            'images/albums/gia-dinh/tet-nhu-y/tet-nhu-y-04.jpg'
          ] },
        { slug: 'tet-doan-vien', name: 'Tết đoàn viên', desc: 'Concept Tết đoàn viên chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/gia-dinh/tet-doan-vien/tet-doan-vien-01.jpg',
            'images/albums/gia-dinh/tet-doan-vien/tet-doan-vien-02.jpg',
            'images/albums/gia-dinh/tet-doan-vien/tet-doan-vien-03.jpg',
            'images/albums/gia-dinh/tet-doan-vien/tet-doan-vien-04.jpg'
          ] },
        { slug: 'tet-dau-doi', name: 'Tết đầu đời', desc: 'Concept Tết đầu đời chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/gia-dinh/tet-dau-doi/tet-dau-doi-01.jpg',
            'images/albums/gia-dinh/tet-dau-doi/tet-dau-doi-02.jpg',
            'images/albums/gia-dinh/tet-dau-doi/tet-dau-doi-03.jpg'
          ] },
        { slug: 'xuan-hong-phuc', name: 'Xuân hồng phúc', desc: 'Concept Xuân hồng phúc chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/gia-dinh/xuan-hong-phuc/xuan-hong-phuc-01.jpg',
            'images/albums/gia-dinh/xuan-hong-phuc/xuan-hong-phuc-02.jpg',
            'images/albums/gia-dinh/xuan-hong-phuc/xuan-hong-phuc-03.jpg',
            'images/albums/gia-dinh/xuan-hong-phuc/xuan-hong-phuc-04.jpg'
          ] },
        { slug: 'xuan-kim-phuc', name: 'Xuân kim phúc', desc: 'Concept Xuân kim phúc chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/gia-dinh/xuan-kim-phuc/xuan-kim-phuc-01.jpg',
            'images/albums/gia-dinh/xuan-kim-phuc/xuan-kim-phuc-02.jpg',
            'images/albums/gia-dinh/xuan-kim-phuc/xuan-kim-phuc-03.jpg',
            'images/albums/gia-dinh/xuan-kim-phuc/xuan-kim-phuc-04.jpg'
          ] },
        { slug: 'dao-xuan', name: 'Đào xuân', desc: 'Concept Đào xuân chụp tại studio ALOHA Baby.',
          photos: [
            'images/albums/gia-dinh/dao-xuan/dao-xuan-01.jpg',
            'images/albums/gia-dinh/dao-xuan/dao-xuan-02.jpg',
            'images/albums/gia-dinh/dao-xuan/dao-xuan-03.jpg',
            'images/albums/gia-dinh/dao-xuan/dao-xuan-04.jpg'
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
  let activeConsultFilter = null;

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
      let displayConcepts = concepts;
      let isFiltered = false;

      if (activeConsultFilter && activeConsultFilter.serviceSlug === service.slug && activeConsultFilter.concepts && activeConsultFilter.concepts.length) {
        const validSlugs = new Set(activeConsultFilter.concepts.map((c) => c.slug));
        const validNames = new Set(activeConsultFilter.concepts.map((c) => String(c.name || c.displayName || '').toLowerCase().replace(/[^a-z0-9]/g, '')));
        displayConcepts = concepts.filter((c) => validSlugs.has(c.slug) || validNames.has(String(c.name || '').toLowerCase().replace(/[^a-z0-9]/g, '')));
        if (displayConcepts.length > 0) isFiltered = true;
      }

      const isBau = isFiltered && activeConsultFilter && activeConsultFilter.serviceSlug === 'bau';
      const isGiaDinh = isFiltered && activeConsultFilter && activeConsultFilter.serviceSlug === 'gia-dinh';
      const isStyleConsult = isBau || isGiaDinh;

      const filterLabel = isFiltered && activeConsultFilter
        ? (isStyleConsult
          ? `phong cách ${activeConsultFilter.styleName || activeConsultFilter.stageLabel || ''}`
          : `bé ${(activeConsultFilter.gender || '').toLowerCase()} giai đoạn ${activeConsultFilter.stageLabel || ''}`)
        : '';

      $('galleryCrumb').innerHTML = `<span>${service.name}</span>` + (isFiltered && activeConsultFilter ? ` / <span style="color:var(--pink-600);font-weight:600;">Gợi ý ${isStyleConsult ? 'phong cách ' + (activeConsultFilter.styleName || activeConsultFilter.stageLabel) : 'cho ' + activeConsultFilter.gender}</span>` : '');
      $('galleryTitle').textContent = isFiltered && activeConsultFilter
        ? (isStyleConsult ? `Gợi ý concept ${service.name} (${activeConsultFilter.styleName || activeConsultFilter.stageLabel})` : `Gợi ý concept cho ${activeConsultFilter.gender} (${activeConsultFilter.stageLabel})`)
        : 'Album ' + service.name;
      $('galleryDesc').textContent = isFiltered
        ? `Aloha đã chọn lọc ${displayConcepts.length} concept phù hợp nhất theo ${filterLabel}.`
        : service.desc;
      $('galleryCount').textContent = isFiltered
        ? `${displayConcepts.length} concept phù hợp · Gợi ý từ trợ lý tư vấn`
        : `${concepts.length} concept · ${photoCount(service)} ảnh`;

      // Đã bấm đúng dịch vụ này từ trang chủ rồi nên không cần liệt kê 4 dịch vụ còn lại ở đây nữa
      // (người dùng phản hồi 2026-09-28: chỉ giữ lại chip của dịch vụ đang xem).
      $('gallerySwitch').hidden = false;
      $('gallerySwitch').setAttribute('aria-label', 'Dịch vụ đang xem');
      $('gallerySwitch').innerHTML = chips([service], service.slug, (s) => '#/album/' + s.slug);
      revealActiveChip();
      // Nút tư vấn concept áp dụng cho tất cả các album dịch vụ (Newborn, Bé lớn, Bầu, Gia đình, Sinh nhật)
      const isConsultable = ['newborn', 'be-lon', 'bau', 'gia-dinh', 'sinh-nhat'].includes(service.slug);

      let bannerHtml = '';
      if (isFiltered) {
        const bannerTitle = isBau ? 'Gợi ý phù hợp cho mẹ bầu:' : (isGiaDinh ? 'Gợi ý phù hợp cho gia đình:' : 'Gợi ý phù hợp cho bé:');
        bannerHtml = `
          <div class="gallery-consult-filter-banner" id="galleryFilterBanner">
            <div class="gcfb-left">
              <div class="gcfb-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9L12 2z"/></svg>
              </div>
              <div class="gcfb-info">
                <strong>${bannerTitle}</strong> Đang lọc <strong>${displayConcepts.length} concept</strong> phù hợp nhất theo <strong>${filterLabel}</strong>.
              </div>
            </div>
            <button type="button" class="btn btn-outline btn-sm gcfb-clear" id="galleryClearFilterBtn">
              Xem tất cả concept
            </button>
          </div>
        `;
      }

      const cardsHtml = displayConcepts.length
        ? displayConcepts.map((c) => {
          const cover = photoOf(c.name, c.photos[0], 0);
          const consultBtn = isConsultable
            ? `<button type="button" class="concept-album-consult" data-service="${service.slug}" data-concept="${c.slug}" data-name="${c.name}" title="Tư vấn concept ${c.name}">
                <span>Tư vấn concept</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>`
            : `<span class="concept-album-arrow">${ARROW}</span>`;
          return `<a href="${serviceHref}/${c.slug}" class="concept-album">
            <img src="${cover.src}" alt="${cover.alt}" loading="lazy">
            <span class="concept-album-body">
              <span class="concept-album-name">${c.name}</span>
              <span class="concept-album-desc">${c.desc}</span>
              <span class="concept-album-count">${c.photos.length} ảnh</span>
            </span>
            ${consultBtn}
          </a>`;
        }).join('')
        : '<p class="gallery-empty">Không tìm thấy concept phù hợp.</p>';

      $('galleryConcepts').innerHTML = bannerHtml + cardsHtml;

      if (isFiltered) {
        const clearBtn = $('galleryClearFilterBtn');
        if (clearBtn) {
          clearBtn.addEventListener('click', (e) => {
            e.preventDefault();
            activeConsultFilter = null;
            render(service.slug);
          });
        }
      }

      return (isFiltered && activeConsultFilter ? (isStyleConsult ? `Gợi ý concept ${service.name} (${activeConsultFilter.styleName || activeConsultFilter.stageLabel}) · ` : `Gợi ý concept cho ${activeConsultFilter.gender} · `) : 'Album ') + service.name + ' | ALOHA Baby';
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

    const consultTopBtn = $('galleryConsultTop');
    if (consultTopBtn) {
      // Nút tư vấn concept áp dụng cho tất cả các album dịch vụ (Newborn, Bé lớn, Bầu, Gia đình, Sinh nhật)
      const isConsultable = ['newborn', 'be-lon', 'bau', 'gia-dinh', 'sinh-nhat'].includes(service.slug);
      consultTopBtn.hidden = !isConsultable;
      if (isConsultable) {
        consultTopBtn.onclick = () => {
          if (!window.AlohaAuth || !AlohaAuth.isLoggedIn()) {
            sessionStorage.setItem('aloha_consult_pending', JSON.stringify({
              service: service.slug,
              concept: concept.slug,
              name: concept.name
            }));
            const nextRoute = `album/${service.slug}/${concept.slug}`;
            window.location.href = `login.html?next=${encodeURIComponent(nextRoute)}`;
            return;
          }
          if (window.AlohaConceptConsult) {
            window.AlohaConceptConsult.start(service.slug, concept.slug, concept.name);
          }
        };
      }
    }

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

  // Bấm nút "Tư vấn concept" trên thẻ album (Newborn & Bé lớn & các dịch vụ khác)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.concept-album-consult');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const serviceSlug = btn.dataset.service;
    const conceptSlug = btn.dataset.concept;
    const conceptName = btn.dataset.name;

    if (!window.AlohaAuth || !AlohaAuth.isLoggedIn()) {
      sessionStorage.setItem('aloha_consult_pending', JSON.stringify({
        service: serviceSlug,
        concept: conceptSlug,
        name: conceptName
      }));
      const nextRoute = conceptSlug ? `album/${serviceSlug}/${conceptSlug}` : `album/${serviceSlug}`;
      window.location.href = `login.html?next=${encodeURIComponent(nextRoute)}`;
      return;
    }

    if (window.AlohaConceptConsult) {
      window.AlohaConceptConsult.start(serviceSlug, conceptSlug, conceptName);
    }
  });

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
    close: () => closeLightbox(true),
    applyConsultFilter: (filter) => { activeConsultFilter = filter; },
    clearConsultFilter: () => { activeConsultFilter = null; },
    getActiveFilter: () => activeConsultFilter
  };
})(window, document);
