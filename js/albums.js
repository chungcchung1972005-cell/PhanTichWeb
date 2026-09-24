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
// 3 concept đầu mỗi dịch vụ khớp gợi ý concept của chatbot (SERVICE_INFO trong
// js/script.js); các concept sau thêm cho đa dạng (người dùng yêu cầu 2026-09-25).
// Ảnh hiện tại là ảnh stock miễn phí bản quyền (Pexels License, xem
// .claude/rules/design.md), là ảnh MINH HOẠ phong cách, không phải ảnh khách
// hàng thật; trang album hiển thị ghi chú này cho khách. Ảnh trong images/albums/
// tải bằng _screenshots/fetch-album-photos.js, nguồn từng ảnh ghi ở
// images/albums/sources.json; đã xem lại bằng mắt và loại ảnh sai chủ đề.
(function (window, document) {
  const SERVICES = [
    {
      slug: 'newborn',
      name: 'Newborn',
      desc: 'Những ngày đầu đời của bé, chụp khi bé ngủ sâu trong phòng được giữ ấm, tạo dáng nhẹ nhàng và an toàn.',
      concepts: [
        { slug: 'cuon-u', name: 'Cuộn ủ (wrap) cổ điển', desc: 'Bé được quấn ủ gọn trong vải mềm, tư thế ngủ an toàn và ấm áp.',
          photos: [
            'images/service-newborn.jpg',
            'images/services-main.jpg',
            'images/albums/newborn/cuon-u/cuon-u-01.jpg',
            'images/albums/newborn/cuon-u/cuon-u-02.jpg',
            'images/albums/newborn/cuon-u/cuon-u-03.jpg',
            'images/albums/newborn/cuon-u/cuon-u-04.jpg',
            'images/albums/newborn/cuon-u/cuon-u-05.jpg',
            'images/albums/newborn/cuon-u/cuon-u-06.jpg',
            'images/albums/newborn/cuon-u/cuon-u-07.jpg',
            'images/albums/newborn/cuon-u/cuon-u-08.jpg'
          ] },
        { slug: 'tu-nhien', name: 'Tự nhiên (organic)', desc: 'Chất liệu mộc, tông màu nhẹ, giữ nét tự nhiên của những ngày đầu đời.',
          photos: [
            'images/album-1.jpg',
            'images/hero-baby.jpg',
            'images/albums/newborn/tu-nhien/tu-nhien-01.jpg',
            'images/albums/newborn/tu-nhien/tu-nhien-02.jpg',
            'images/albums/newborn/tu-nhien/tu-nhien-03.jpg',
            'images/albums/newborn/tu-nhien/tu-nhien-04.jpg',
            'images/albums/newborn/tu-nhien/tu-nhien-05.jpg',
            'images/albums/newborn/tu-nhien/tu-nhien-06.jpg',
            'images/albums/newborn/tu-nhien/tu-nhien-07.jpg',
            'images/albums/newborn/tu-nhien/tu-nhien-08.jpg'
          ] },
        { slug: 'cung-bo-me', name: 'Cùng bố mẹ, anh chị', desc: 'Khoảnh khắc bé trong vòng tay những người thân yêu nhất.',
          photos: [
            'images/album-3.jpg',
            'images/albums/newborn/cung-bo-me/cung-bo-me-01.jpg',
            'images/albums/newborn/cung-bo-me/cung-bo-me-02.jpg',
            'images/albums/newborn/cung-bo-me/cung-bo-me-03.jpg',
            'images/albums/newborn/cung-bo-me/cung-bo-me-04.jpg',
            'images/albums/newborn/cung-bo-me/cung-bo-me-05.jpg',
            'images/albums/newborn/cung-bo-me/cung-bo-me-06.jpg',
            'images/albums/newborn/cung-bo-me/cung-bo-me-07.jpg',
            'images/albums/newborn/cung-bo-me/cung-bo-me-08.jpg'
          ] },
        { slug: 'hoa-la', name: 'Hoa lá', desc: 'Bé nằm giữa hoa tươi và lá xanh, màu sắc tươi tắn, mềm mại.',
          photos: [
            'images/albums/newborn/hoa-la/hoa-la-03.jpg',
            'images/albums/newborn/hoa-la/hoa-la-04.jpg',
            'images/albums/newborn/hoa-la/hoa-la-05.jpg',
            'images/albums/newborn/hoa-la/hoa-la-07.jpg',
            'images/albums/newborn/hoa-la/hoa-la-09.jpg'
          ] },
        { slug: 'thu-ngo-nghinh', name: 'Hoá thân thú ngộ nghĩnh', desc: 'Mũ len tai thỏ, tai gấu, sừng nai đáng yêu cho bé sơ sinh.',
          photos: [
            'images/albums/newborn/thu-ngo-nghinh/thu-ngo-nghinh-01.jpg',
            'images/albums/newborn/thu-ngo-nghinh/thu-ngo-nghinh-02.jpg',
            'images/albums/newborn/thu-ngo-nghinh/thu-ngo-nghinh-03.jpg',
            'images/albums/newborn/thu-ngo-nghinh/thu-ngo-nghinh-04.jpg',
            'images/albums/newborn/thu-ngo-nghinh/thu-ngo-nghinh-05.jpg',
            'images/albums/newborn/thu-ngo-nghinh/thu-ngo-nghinh-06.jpg',
            'images/albums/newborn/thu-ngo-nghinh/thu-ngo-nghinh-07.jpg',
            'images/albums/newborn/thu-ngo-nghinh/thu-ngo-nghinh-08.jpg'
          ] },
        { slug: 'den-trang', name: 'Đen trắng tinh tế', desc: 'Tông đen trắng tập trung vào bàn tay, bàn chân nhỏ xíu và nét mặt bé.',
          photos: [
            'images/albums/newborn/den-trang/den-trang-01.jpg',
            'images/albums/newborn/den-trang/den-trang-02.jpg',
            'images/albums/newborn/den-trang/den-trang-03.jpg',
            'images/albums/newborn/den-trang/den-trang-04.jpg',
            'images/albums/newborn/den-trang/den-trang-05.jpg',
            'images/albums/newborn/den-trang/den-trang-06.jpg',
            'images/albums/newborn/den-trang/den-trang-07.jpg',
            'images/albums/newborn/den-trang/den-trang-08.jpg',
            'images/albums/newborn/den-trang/den-trang-09.jpg'
          ] },
        { slug: 'trang-sao', name: 'Trăng sao cổ tích', desc: 'Bé ngủ trên vầng trăng, giữa những ngôi sao như trong truyện cổ tích.',
          photos: [
            'images/albums/newborn/trang-sao/trang-sao-01.jpg',
            'images/albums/newborn/trang-sao/trang-sao-02.jpg',
            'images/albums/newborn/trang-sao/trang-sao-03.jpg',
            'images/albums/newborn/trang-sao/trang-sao-04.jpg',
            'images/albums/newborn/trang-sao/trang-sao-06.jpg',
            'images/albums/newborn/trang-sao/trang-sao-07.jpg',
            'images/albums/newborn/trang-sao/trang-sao-08.jpg',
            'images/albums/newborn/trang-sao/trang-sao-09.jpg'
          ] }
      ]
    },
    {
      slug: 'bau',
      name: 'Bầu',
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
      desc: 'Thôi nôi và sinh nhật của bé, kết hợp bánh kem, bóng bay và backdrop theo yêu cầu.',
      concepts: [
        { slug: 'bong-bay', name: 'Rực rỡ bóng bay', desc: 'Bóng bay, bánh kem và backdrop nhiều màu cho ngày đặc biệt.',
          photos: [
            'images/service-sinh-nhat.jpg',
            'images/concept-sinh-nhat.jpg',
            'images/albums/sinh-nhat/bong-bay/bong-bay-01.jpg',
            'images/albums/sinh-nhat/bong-bay/bong-bay-02.jpg',
            'images/albums/sinh-nhat/bong-bay/bong-bay-03.jpg',
            'images/albums/sinh-nhat/bong-bay/bong-bay-04.jpg',
            'images/albums/sinh-nhat/bong-bay/bong-bay-05.jpg',
            'images/albums/sinh-nhat/bong-bay/bong-bay-06.jpg',
            'images/albums/sinh-nhat/bong-bay/bong-bay-07.jpg',
            'images/albums/sinh-nhat/bong-bay/bong-bay-08.jpg'
          ] },
        { slug: 'le-hoi', name: 'Giáng sinh (Noel)', desc: 'Mũ ông già Noel, cây thông và ánh đèn lấp lánh mùa lễ hội.',
          photos: [
            'images/albums/sinh-nhat/le-hoi/le-hoi-01.jpg',
            'images/albums/sinh-nhat/le-hoi/le-hoi-02.jpg',
            'images/albums/sinh-nhat/le-hoi/le-hoi-03.jpg',
            'images/albums/sinh-nhat/le-hoi/le-hoi-04.jpg',
            'images/albums/sinh-nhat/le-hoi/le-hoi-05.jpg',
            'images/albums/sinh-nhat/le-hoi/le-hoi-06.jpg',
            'images/albums/sinh-nhat/le-hoi/le-hoi-07.jpg',
            'images/albums/sinh-nhat/le-hoi/le-hoi-08.jpg'
          ] },
        { slug: 'pastel', name: 'Pastel nhẹ nhàng', desc: 'Tông pastel dịu mắt, phù hợp bé nhỏ.',
          photos: [
            'images/albums/sinh-nhat/pastel/pastel-01.jpg',
            'images/albums/sinh-nhat/pastel/pastel-02.jpg',
            'images/albums/sinh-nhat/pastel/pastel-03.jpg',
            'images/albums/sinh-nhat/pastel/pastel-04.jpg',
            'images/albums/sinh-nhat/pastel/pastel-05.jpg',
            'images/albums/sinh-nhat/pastel/pastel-06.jpg',
            'images/albums/sinh-nhat/pastel/pastel-07.jpg',
            'images/albums/sinh-nhat/pastel/pastel-08.jpg'
          ] },
        { slug: 'trung-thu', name: 'Trung thu, đèn lồng', desc: 'Áo truyền thống, đèn lồng và đầu lân cho dịp Trung thu.',
          photos: [
            'images/albums/sinh-nhat/trung-thu/trung-thu-01.jpg',
            'images/albums/sinh-nhat/trung-thu/trung-thu-02.jpg',
            'images/albums/sinh-nhat/trung-thu/trung-thu-04.jpg',
            'images/albums/sinh-nhat/trung-thu/trung-thu-09.jpg'
          ] },
        { slug: 'cong-chua', name: 'Công chúa, hoàng tử', desc: 'Váy xoè, vương miện cho bé trong ngày đặc biệt.',
          photos: [
            'images/albums/sinh-nhat/cong-chua/cong-chua-01.jpg',
            'images/albums/sinh-nhat/cong-chua/cong-chua-02.jpg',
            'images/albums/sinh-nhat/cong-chua/cong-chua-04.jpg',
            'images/albums/sinh-nhat/cong-chua/cong-chua-05.jpg',
            'images/albums/sinh-nhat/cong-chua/cong-chua-06.jpg',
            'images/albums/sinh-nhat/cong-chua/cong-chua-09.jpg'
          ] },
        { slug: 'tiec-gia-dinh', name: 'Tiệc cùng gia đình', desc: 'Thổi nến, cắt bánh cùng bố mẹ và bạn bè.',
          photos: [
            'images/albums/sinh-nhat/tiec-gia-dinh/tiec-gia-dinh-01.jpg',
            'images/albums/sinh-nhat/tiec-gia-dinh/tiec-gia-dinh-02.jpg',
            'images/albums/sinh-nhat/tiec-gia-dinh/tiec-gia-dinh-03.jpg',
            'images/albums/sinh-nhat/tiec-gia-dinh/tiec-gia-dinh-05.jpg',
            'images/albums/sinh-nhat/tiec-gia-dinh/tiec-gia-dinh-06.jpg',
            'images/albums/sinh-nhat/tiec-gia-dinh/tiec-gia-dinh-07.jpg',
            'images/albums/sinh-nhat/tiec-gia-dinh/tiec-gia-dinh-08.jpg',
            'images/albums/sinh-nhat/tiec-gia-dinh/tiec-gia-dinh-09.jpg'
          ] },
        { slug: 'picnic', name: 'Picnic ngoài trời', desc: 'Bàn tiệc nhỏ trên bãi cỏ, không khí tự nhiên, thoải mái.',
          photos: [
            'images/albums/sinh-nhat/picnic/picnic-01.jpg',
            'images/albums/sinh-nhat/picnic/picnic-04.jpg',
            'images/albums/sinh-nhat/picnic/picnic-06.jpg',
            'images/albums/sinh-nhat/picnic/picnic-08.jpg',
            'images/albums/sinh-nhat/picnic/picnic-09.jpg'
          ] }
      ]
    },
    {
      slug: 'be-lon',
      name: 'Bé lớn',
      desc: 'Bé từ khoảng 2 đến 10 tuổi, ngoại cảnh hoặc trong studio, có thể chụp thêm cùng bố mẹ trong buổi.',
      concepts: [
        { slug: 'ngoai-canh', name: 'Ngoại cảnh công viên, biển', desc: 'Bé vui chơi tự nhiên ngoài trời, ảnh đầy năng lượng.',
          photos: [
            'images/service-be-lon.jpg',
            'images/concept-bien.jpg',
            'images/albums/be-lon/ngoai-canh/ngoai-canh-01.jpg',
            'images/albums/be-lon/ngoai-canh/ngoai-canh-02.jpg',
            'images/albums/be-lon/ngoai-canh/ngoai-canh-03.jpg',
            'images/albums/be-lon/ngoai-canh/ngoai-canh-04.jpg',
            'images/albums/be-lon/ngoai-canh/ngoai-canh-05.jpg',
            'images/albums/be-lon/ngoai-canh/ngoai-canh-06.jpg',
            'images/albums/be-lon/ngoai-canh/ngoai-canh-07.jpg',
            'images/albums/be-lon/ngoai-canh/ngoai-canh-08.jpg'
          ] },
        { slug: 'han-quoc', name: 'Phong cách Hàn Quốc', desc: 'Trang phục và bối cảnh Hàn Quốc, tông màu tối giản.',
          photos: [
            'images/concept-han-quoc.jpg',
            'images/albums/be-lon/han-quoc/han-quoc-01.jpg',
            'images/albums/be-lon/han-quoc/han-quoc-02.jpg',
            'images/albums/be-lon/han-quoc/han-quoc-03.jpg',
            'images/albums/be-lon/han-quoc/han-quoc-04.jpg',
            'images/albums/be-lon/han-quoc/han-quoc-06.jpg',
            'images/albums/be-lon/han-quoc/han-quoc-07.jpg',
            'images/albums/be-lon/han-quoc/han-quoc-08.jpg'
          ] },
        { slug: 'vintage', name: 'Vintage cổ điển', desc: 'Tông ảnh cổ điển, đen trắng hoặc sepia trong studio.',
          photos: [
            'images/concept-vintage.jpg',
            'images/album-2.jpg',
            'images/albums/be-lon/vintage/vintage-01.jpg',
            'images/albums/be-lon/vintage/vintage-02.jpg',
            'images/albums/be-lon/vintage/vintage-03.jpg',
            'images/albums/be-lon/vintage/vintage-04.jpg',
            'images/albums/be-lon/vintage/vintage-05.jpg',
            'images/albums/be-lon/vintage/vintage-06.jpg',
            'images/albums/be-lon/vintage/vintage-07.jpg',
            'images/albums/be-lon/vintage/vintage-08.jpg'
          ] },
        { slug: 'ao-dai', name: 'Áo dài truyền thống', desc: 'Áo dài, không gian mang nét Việt cho bé và gia đình.',
          photos: [
            'images/albums/be-lon/ao-dai/ao-dai-01.jpg',
            'images/albums/be-lon/ao-dai/ao-dai-02.jpg',
            'images/albums/be-lon/ao-dai/ao-dai-03.jpg',
            'images/albums/be-lon/ao-dai/ao-dai-04.jpg',
            'images/albums/be-lon/ao-dai/ao-dai-05.jpg',
            'images/albums/be-lon/ao-dai/ao-dai-06.jpg',
            'images/albums/be-lon/ao-dai/ao-dai-07.jpg',
            'images/albums/be-lon/ao-dai/ao-dai-08.jpg'
          ] },
        { slug: 'nghe-nghiep', name: 'Hoá thân nghề nghiệp', desc: 'Bé làm chú cảnh sát, lính cứu hoả, chiến sĩ nhỏ tuổi.',
          photos: [
            'images/albums/be-lon/nghe-nghiep/nghe-nghiep-01.jpg',
            'images/albums/be-lon/nghe-nghiep/nghe-nghiep-02.jpg',
            'images/albums/be-lon/nghe-nghiep/nghe-nghiep-05.jpg',
            'images/albums/be-lon/nghe-nghiep/nghe-nghiep-08.jpg',
            'images/albums/be-lon/nghe-nghiep/nghe-nghiep-09.jpg'
          ] },
        { slug: 'mua-thu', name: 'Mùa thu lá vàng', desc: 'Tông vàng cam ấm áp giữa lá thu.',
          photos: [
            'images/albums/be-lon/mua-thu/mua-thu-01.jpg',
            'images/albums/be-lon/mua-thu/mua-thu-02.jpg',
            'images/albums/be-lon/mua-thu/mua-thu-03.jpg',
            'images/albums/be-lon/mua-thu/mua-thu-04.jpg',
            'images/albums/be-lon/mua-thu/mua-thu-05.jpg',
            'images/albums/be-lon/mua-thu/mua-thu-07.jpg',
            'images/albums/be-lon/mua-thu/mua-thu-09.jpg'
          ] },
        { slug: 'the-thao', name: 'Năng động, thể thao', desc: 'Bóng rổ, bóng đá, tennis, bắt trọn năng lượng của bé.',
          photos: [
            'images/albums/be-lon/the-thao/the-thao-01.jpg',
            'images/albums/be-lon/the-thao/the-thao-02.jpg',
            'images/albums/be-lon/the-thao/the-thao-03.jpg',
            'images/albums/be-lon/the-thao/the-thao-04.jpg',
            'images/albums/be-lon/the-thao/the-thao-05.jpg',
            'images/albums/be-lon/the-thao/the-thao-06.jpg',
            'images/albums/be-lon/the-thao/the-thao-07.jpg',
            'images/albums/be-lon/the-thao/the-thao-08.jpg'
          ] }
      ]
    },
    {
      slug: 'gia-dinh',
      name: 'Gia đình',
      desc: 'Không giới hạn số thành viên, chụp được nhiều thế hệ trong cùng một buổi.',
      concepts: [
        { slug: 'dong-phuc', name: 'Đồng phục tông màu', desc: 'Cả nhà phối trang phục cùng tông trên phông studio.',
          photos: [
            'images/service-gia-dinh.jpg',
            'images/albums/gia-dinh/dong-phuc/dong-phuc-01.jpg',
            'images/albums/gia-dinh/dong-phuc/dong-phuc-02.jpg',
            'images/albums/gia-dinh/dong-phuc/dong-phuc-03.jpg',
            'images/albums/gia-dinh/dong-phuc/dong-phuc-04.jpg',
            'images/albums/gia-dinh/dong-phuc/dong-phuc-05.jpg',
            'images/albums/gia-dinh/dong-phuc/dong-phuc-06.jpg',
            'images/albums/gia-dinh/dong-phuc/dong-phuc-07.jpg',
            'images/albums/gia-dinh/dong-phuc/dong-phuc-08.jpg'
          ] },
        { slug: 'ngoai-canh', name: 'Ngoại cảnh công viên', desc: 'Không gian ngoài trời, khoảnh khắc gia đình tự nhiên.',
          photos: [
            'images/news-2.jpg',
            'images/albums/gia-dinh/ngoai-canh/ngoai-canh-01.jpg',
            'images/albums/gia-dinh/ngoai-canh/ngoai-canh-03.jpg',
            'images/albums/gia-dinh/ngoai-canh/ngoai-canh-04.jpg',
            'images/albums/gia-dinh/ngoai-canh/ngoai-canh-06.jpg',
            'images/albums/gia-dinh/ngoai-canh/ngoai-canh-07.jpg',
            'images/albums/gia-dinh/ngoai-canh/ngoai-canh-08.jpg'
          ] },
        { slug: 'vintage', name: 'Vintage ấm áp', desc: 'Không gian trong nhà ấm cúng, ánh sáng dịu.',
          photos: [
            'images/news-1.jpg',
            'images/albums/gia-dinh/vintage/vintage-01.jpg',
            'images/albums/gia-dinh/vintage/vintage-03.jpg',
            'images/albums/gia-dinh/vintage/vintage-05.jpg',
            'images/albums/gia-dinh/vintage/vintage-06.jpg',
            'images/albums/gia-dinh/vintage/vintage-07.jpg',
            'images/albums/gia-dinh/vintage/vintage-08.jpg'
          ] },
        { slug: 'bien', name: 'Biển', desc: 'Cả nhà vui đùa trên bãi cát, sóng và nắng.',
          photos: [
            'images/albums/gia-dinh/bien/bien-01.jpg',
            'images/albums/gia-dinh/bien/bien-02.jpg',
            'images/albums/gia-dinh/bien/bien-03.jpg',
            'images/albums/gia-dinh/bien/bien-04.jpg',
            'images/albums/gia-dinh/bien/bien-06.jpg',
            'images/albums/gia-dinh/bien/bien-07.jpg',
            'images/albums/gia-dinh/bien/bien-08.jpg',
            'images/albums/gia-dinh/bien/bien-09.jpg'
          ] },
        { slug: 'nhieu-the-he', name: 'Nhiều thế hệ', desc: 'Ông bà, bố mẹ và các cháu trong cùng một khung hình.',
          photos: [
            'images/albums/gia-dinh/nhieu-the-he/nhieu-the-he-01.jpg',
            'images/albums/gia-dinh/nhieu-the-he/nhieu-the-he-02.jpg',
            'images/albums/gia-dinh/nhieu-the-he/nhieu-the-he-05.jpg',
            'images/albums/gia-dinh/nhieu-the-he/nhieu-the-he-07.jpg',
            'images/albums/gia-dinh/nhieu-the-he/nhieu-the-he-08.jpg',
            'images/albums/gia-dinh/nhieu-the-he/nhieu-the-he-09.jpg'
          ] },
        { slug: 'anh-chi-em', name: 'Anh chị em', desc: 'Tình cảm anh chị em trong những bức ảnh riêng.',
          photos: [
            'images/albums/gia-dinh/anh-chi-em/anh-chi-em-01.jpg',
            'images/albums/gia-dinh/anh-chi-em/anh-chi-em-02.jpg',
            'images/albums/gia-dinh/anh-chi-em/anh-chi-em-03.jpg',
            'images/albums/gia-dinh/anh-chi-em/anh-chi-em-04.jpg',
            'images/albums/gia-dinh/anh-chi-em/anh-chi-em-05.jpg',
            'images/albums/gia-dinh/anh-chi-em/anh-chi-em-06.jpg',
            'images/albums/gia-dinh/anh-chi-em/anh-chi-em-07.jpg',
            'images/albums/gia-dinh/anh-chi-em/anh-chi-em-08.jpg',
            'images/albums/gia-dinh/anh-chi-em/anh-chi-em-09.jpg'
          ] },
        { slug: 'da-ngoai', name: 'Dã ngoại picnic', desc: 'Giỏ picnic, bãi cỏ và những bữa ăn ngoài trời.',
          photos: [
            'images/albums/gia-dinh/da-ngoai/da-ngoai-01.jpg',
            'images/albums/gia-dinh/da-ngoai/da-ngoai-02.jpg',
            'images/albums/gia-dinh/da-ngoai/da-ngoai-03.jpg',
            'images/albums/gia-dinh/da-ngoai/da-ngoai-04.jpg',
            'images/albums/gia-dinh/da-ngoai/da-ngoai-06.jpg',
            'images/albums/gia-dinh/da-ngoai/da-ngoai-08.jpg'
          ] }
      ]
    }
  ];

  // Chỉ hiện concept đã có ảnh.
  const conceptsOf = (service) => service.concepts.filter((c) => c.photos.length > 0);
  const serviceBySlug = (slug) => SERVICES.find((s) => s.slug === slug) || null;
  const photoCount = (service) => conceptsOf(service).reduce((n, c) => n + c.photos.length, 0);
  const photoOf = (label, p, i) => (typeof p === 'string'
    ? { src: p, alt: `Ảnh minh hoạ ${label} ${i + 1}` }
    : { src: p.src, alt: p.alt || `Ảnh minh hoạ ${label} ${i + 1}` });
  const coverOf = (service) => {
    const first = conceptsOf(service)[0];
    return first ? photoOf(service.name, first.photos[0], 0).src : null;
  };

  const $ = (id) => document.getElementById(id);
  const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>';
  let current = null; // { service, concept } đang mở ở tầng ảnh
  let lbIndex = 0;
  let lastFocus = null;

  // ---------------------------------------------------------------- Hero trang chủ
  // Số concept/số ảnh và ảnh bìa từng ô dịch vụ đọc từ dữ liệu, không viết cứng.
  document.querySelectorAll('[data-album-count]').forEach((el) => {
    const s = serviceBySlug(el.dataset.albumCount);
    if (s) el.textContent = conceptsOf(s).length + ' concept';
  });
  document.querySelectorAll('.svc-tile[data-album] img').forEach((img) => {
    const s = serviceBySlug(img.closest('.svc-tile').dataset.album);
    const cover = s && coverOf(s);
    if (cover && img.getAttribute('src') !== cover) img.src = cover;
  });

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
      $('gallerySwitch').setAttribute('aria-label', 'Album các dịch vụ');
      $('gallerySwitch').innerHTML = chips(SERVICES, service.slug, (s) => '#/album/' + s.slug);
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
    const { concept } = current;
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
