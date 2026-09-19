// ALOHA Baby — router SPA nhỏ gộp Trang chủ + Đặt lịch + Ảnh của tôi vào 1
// file index.html (theo yêu cầu người dùng: "chỉ có 1 file html thôi" cho
// phần khách hàng). Không dùng framework, chỉ dựa vào location.hash.
//
// Quy ước hash:
//   #/            -> Trang chủ (view-home)
//   #/dat-lich    -> Đặt lịch (view-dat-lich)
//   #/chon-anh    -> Ảnh của tôi (view-chon-anh)
//   #dich-vu, #gioi-thieu, #album, #tin-tuc... -> neo cuộn trong Trang chủ,
//   KHÔNG phải route (không có dấu / ngay sau #).
(function (window) {
  const VIEW_ID = { '': 'view-home', 'dat-lich': 'view-dat-lich', 'chon-anh': 'view-chon-anh' };
  const GATED_ROLES = { 'dat-lich': ['khach-hang'], 'chon-anh': ['khach-hang'] };
  const TITLE = {
    '': document.title,
    'dat-lich': 'Đặt lịch chụp | ALOHA Baby',
    'chon-anh': 'Ảnh của tôi | ALOHA Baby'
  };

  function parseRoute() {
    const hash = window.location.hash;
    if (hash.indexOf('#/') === 0) return hash.slice(2).split('?')[0];
    return null; // rỗng hoặc là neo cuộn trong trang (#dich-vu...), không phải route
  }

  function showView(route) {
    const targetId = VIEW_ID.hasOwnProperty(route) ? VIEW_ID[route] : VIEW_ID[''];
    Object.values(VIEW_ID).forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.hidden = (id !== targetId);
    });
    // Nút nổi "Đặt lịch" chỉ hữu ích ở Trang chủ -> ở view Đặt lịch/Ảnh của tôi
    // nó vừa thừa (khách đã ở đúng luồng) vừa che mất nội dung tương tác phía
    // dưới trên màn hình nhỏ (đã thấy qua screenshot mobile thật). Chỉ giữ nút chat.
    document.body.classList.toggle('hide-floating-book', targetId !== VIEW_ID['']);
    if (targetId !== VIEW_ID['']) {
      // Chuyển view kiểu app, không phải cuộn khám phá -> hiện luôn, không chờ animation.
      document.querySelectorAll('#' + targetId + ' .reveal').forEach((el) => el.classList.add('visible'));
    }
    // "Trang chủ" là mục duy nhất trong nav chính có thể sáng active (Đặt lịch/
    // Ảnh của tôi nằm ở #navAuthArea, không phải #navLinks) -> tắt đi khi rời
    // Trang chủ, tránh sáng nhầm khi đang ở view khác (đã thấy qua screenshot).
    const homeLink = document.getElementById('navHomeLink');
    if (homeLink) homeLink.classList.toggle('active', targetId === VIEW_ID['']);
    document.title = TITLE[route] || TITLE[''];
    window.scrollTo(0, 0);
  }

  function navigateTo(route) {
    const roles = GATED_ROLES[route];
    if (roles && window.AlohaAuth) {
      const session = AlohaAuth.getSession();
      if (!session) { window.location.href = 'login.html?next=' + route; return; }
      if (roles.indexOf(session.role) === -1) { window.location.href = AlohaAuth.roleHome(session.role); return; }
    }
    showView(route);
  }

  function handleHashChange() {
    const route = parseRoute();
    if (route !== null) navigateTo(route);
  }

  // Neo cuộn trong Trang chủ (#dich-vu, #gioi-thieu...) khi đang ở view khác
  // -> về Trang chủ trước rồi mới cuộn tới, thay vì để trình duyệt tự tìm id
  // trong 1 view đang bị ẩn (sẽ không cuộn được vì display:none).
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (href.length < 2 || href.indexOf('#/') === 0) return; // route hoặc "#" rỗng, bỏ qua
    const currentRoute = parseRoute();
    if (currentRoute) {
      e.preventDefault();
      showView('');
      history.replaceState(null, '', '#/');
      setTimeout(() => {
        const target = document.getElementById(href.slice(1));
        if (target) target.scrollIntoView({ behavior: 'smooth' });
      }, 60);
    }
  });

  window.addEventListener('hashchange', handleHashChange);
  window.AlohaRouter = { navigateTo, showView };
  handleHashChange();
})(window);
