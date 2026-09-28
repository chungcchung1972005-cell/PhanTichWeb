// ALOHA Baby — router SPA nhỏ gộp Trang chủ + Đặt lịch + Ảnh của tôi vào 1
// file index.html (theo yêu cầu người dùng: "chỉ có 1 file html thôi" cho
// phần khách hàng). Không dùng framework, chỉ dựa vào location.hash.
//
// Quy ước hash:
//   #/            -> Trang chủ (view-home)
//   #/dat-lich    -> Đặt lịch (view-dat-lich)
//   #/chon-anh    -> Ảnh của tôi (view-chon-anh)
//   #/album/<dịch vụ>           -> danh sách concept album của 1 dịch vụ (view-album)
//   #/album/<dịch vụ>/<concept> -> toàn bộ ảnh của 1 concept (view-album)
//   (dữ liệu trong js/albums.js, xem công khai không cần đăng nhập)
//   #/noi-dung/<slug>           -> trang nội dung chi tiết: concept, video, bài tin tức...
//   (dữ liệu trong js/content.js, xem công khai không cần đăng nhập)
//   #/chat-sale[/<dịch vụ>]     -> KHÔNG phải trang riêng: bắt đăng nhập khách rồi mở khung chat
//   Sale nhỏ ở góc (js/sale-chat.js) ngay trên trang đang xem, địa chỉ trả về route trước đó
//   (2026-09-28; 27/09 từng là màn chat toàn trang view-chat).
//   Cờ trong js/features.js: booking/albumPages đang tắt thì #/dat-lich, #/album/... về Trang chủ.
//   #dich-vu, #gioi-thieu, #album, #tin-tuc... -> neo cuộn trong Trang chủ,
//   KHÔNG phải route (không có dấu / ngay sau #).
(function (window) {
  const VIEW_ID = { '': 'view-home', 'dat-lich': 'view-dat-lich', 'chon-anh': 'view-chon-anh', 'album': 'view-album', 'noi-dung': 'view-content' };
  const GATED_ROLES = { 'dat-lich': ['khach-hang'], 'chon-anh': ['khach-hang'], 'chat-sale': ['khach-hang'] };
  const FEATURES = window.ALOHA_FEATURES || {};
  // Route đang tạm tắt theo js/features.js -> coi như về Trang chủ.
  const DISABLED = { 'dat-lich': FEATURES.booking === false, 'album': FEATURES.albumPages === false };
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

  // ---------------------------------------------------------------- Hành trình của khách
  // Ghi lại khách đã xem gì trong lần truy cập này (album dịch vụ, concept, ảnh mở lớn, trang
  // nội dung, câu đã hỏi trợ lý AI) để khi khách chuyển sang chat với Sale, Sale nhận được bản
  // tóm tắt (js/sale-chat.js dựng chữ, người dùng yêu cầu 2026-09-28). Lưu sessionStorage
  // key "aloha_journey" (chỉ trong tab đang mở, đóng tab là mất; không phải dữ liệu CRM).
  // Mỗi mục: { type: 'service'|'concept'|'photo'|'page'|'ask', service?, concept?, label?, at }.
  const JOURNEY_KEY = 'aloha_journey';
  const JOURNEY_MAX = 60;
  function journeyList() {
    try { return JSON.parse(sessionStorage.getItem(JOURNEY_KEY) || '[]') || []; } catch (e) { return []; }
  }
  function journeyAdd(type, data) {
    const list = journeyList();
    const item = Object.assign({ type, at: Date.now() }, data || {});
    const last = list[list.length - 1];
    // Tải lại cùng 1 trang không ghi thêm dòng trùng.
    if (last && last.type === item.type && last.service === item.service && last.concept === item.concept && last.label === item.label && type !== 'photo' && type !== 'ask') return;
    list.push(item);
    try { sessionStorage.setItem(JOURNEY_KEY, JSON.stringify(list.slice(-JOURNEY_MAX))); } catch (e) { /* bộ nhớ bị chặn: bỏ qua */ }
  }
  window.AlohaJourney = { add: journeyAdd, list: journeyList };

  function noteRoute(base, param, pageTitle) {
    const [s, c] = param.split('/');
    if (base === 'album' && s) {
      const service = window.AlohaAlbums && window.AlohaAlbums.list.find((x) => x.slug === s);
      const concept = service && c ? service.concepts.find((x) => x.slug === c) : null;
      if (!service) return;
      if (concept) journeyAdd('concept', { service: s, concept: concept.name });
      else journeyAdd('service', { service: s });
    } else if (base === 'noi-dung' && pageTitle) {
      journeyAdd('page', { label: pageTitle.replace(/\s*\|\s*ALOHA Baby$/, '') });
    }
  }

  let currentRoute = null; // route đang hiện, để #/chat-sale mở khung chat mà không rời trang

  function showView(route) {
    currentRoute = route || '';
    // "album/newborn/cuon-u" -> view "album" + tham số "newborn/cuon-u".
    const [base, ...rest] = (route || '').split('/');
    const param = rest.join('/');
    const targetId = VIEW_ID.hasOwnProperty(base) ? VIEW_ID[base] : VIEW_ID[''];
    let pageTitle = null;
    if (window.AlohaAlbums) {
      window.AlohaAlbums.close(); // rời trang khi lightbox đang mở -> không kẹt khoá cuộn
      if (base === 'album') pageTitle = window.AlohaAlbums.render(param || '');
    }
    if (window.AlohaContent) {
      window.AlohaContent.stop(); // dừng video đang phát ở trang nội dung trước khi rời
      if (base === 'noi-dung') pageTitle = window.AlohaContent.render(param || '');
    }
    noteRoute(base, param, pageTitle);
    Object.values(VIEW_ID).forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.hidden = (id !== targetId);
    });
    // Nút nổi "Đặt lịch" chỉ hữu ích ở Trang chủ -> ở view Đặt lịch/Ảnh của tôi
    // nó vừa thừa (khách đã ở đúng luồng) vừa che mất nội dung tương tác phía
    // dưới trên màn hình nhỏ (đã thấy qua screenshot mobile thật). Chỉ giữ nút chat.
    document.body.classList.toggle('hide-floating-book', targetId !== VIEW_ID['']);
    const targetView = document.getElementById(targetId);
    if (pendingEnter && targetView && targetId !== VIEW_ID['']) playEnter(targetView);
    pendingEnter = false;
    if (targetId !== VIEW_ID['']) {
      // Chuyển view kiểu app, không phải cuộn khám phá -> hiện luôn, không chờ animation.
      document.querySelectorAll('#' + targetId + ' .reveal').forEach((el) => el.classList.add('visible'));
    }
    // "Trang chủ" là mục duy nhất trong nav chính có thể sáng active (Đặt lịch/
    // Ảnh của tôi nằm ở #navAuthArea, không phải #navLinks) -> tắt đi khi rời
    // Trang chủ, tránh sáng nhầm khi đang ở view khác (đã thấy qua screenshot).
    const homeLink = document.getElementById('navHomeLink');
    if (homeLink) homeLink.classList.toggle('active', targetId === VIEW_ID['']);
    document.title = pageTitle || TITLE[route] || TITLE[''];
    // Chuyển view = sang trang mới -> lên đầu NGAY, không cuộn mượt theo CSS
    // scroll-behavior:smooth (trước đây trang trôi ~300ms từ vị trí cũ lên đầu,
    // nút ở đầu trang mới bị trượt dưới tay khách trong lúc đó).
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }

  function navigateTo(route) {
    const base = (route || '').split('/')[0];
    if (DISABLED[base]) {
      history.replaceState(null, '', '#/');
      showView('');
      return;
    }
    const roles = GATED_ROLES[base];
    if (roles && window.AlohaAuth) {
      const session = AlohaAuth.getSession();
      if (!session) { window.location.href = 'login.html?next=' + encodeURIComponent(route); return; }
      if (roles.indexOf(session.role) === -1) { window.location.href = AlohaAuth.roleHome(session.role); return; }
    }
    if (base === 'chat-sale') {
      // Mở khung chat ở góc, ở lại trang đang xem (lần tải đầu thì là Trang chủ).
      history.replaceState(null, '', '#/' + (currentRoute || ''));
      if (currentRoute === null) showView('');
      openSaleChat(route.split('/').slice(1).join('/'));
      return;
    }
    showView(route);
  }

  // js/sale-chat.js nạp SAU router: lần tải đầu (vd vừa đăng nhập xong với next=chat-sale)
  // chưa có AlohaSaleChat -> để lại yêu cầu, file đó tự mở khi sẵn sàng.
  let pendingSaleChat = null;
  function openSaleChat(topic) {
    if (window.AlohaSaleChat) window.AlohaSaleChat.open(topic);
    else pendingSaleChat = topic;
  }

  // ---------------------------------------------------------------- Chuyển cảnh
  // Người dùng thích hiệu ứng ở 5 ảnh dịch vụ (29/09), muốn dùng "ở những chỗ cần thiết, tránh spam":
  // - Từ Trang chủ vào 1 khu mới (album, trang nội dung, Ảnh của tôi): màn trắng hồng loang tròn từ
  //   chỗ bấm (.svc-zoom, css/pages.css), giữa màn là tên trang; tan đi thì trang mới trồi lên.
  // - Đi tiếp bên trong các khu đó (dịch vụ -> concept, đổi chip, bài này sang bài khác): chỉ trồi lên
  //   nhẹ (.view-enter), không có màn.
  // - Về Trang chủ, neo cuộn, trợ lý AI tự chuyển trang, bật prefers-reduced-motion: không hiệu ứng.
  const VEIL_BASES = ['album', 'noi-dung', 'chon-anh'];
  const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let pendingEnter = false;
  let enterTimer = 0;

  function playEnter(view) {
    view.classList.remove('view-enter');
    void view.offsetWidth; // chạy lại animation khi bấm liên tiếp
    view.classList.add('view-enter');
    clearTimeout(enterTimer);
    enterTimer = setTimeout(() => view.classList.remove('view-enter'), 900);
  }

  // Tên hiện giữa màn: đúng chữ khách vừa thấy ở nơi bấm / tiêu đề trang sắp mở.
  function veilLabel(route, link) {
    const [base, a, b] = route.split('/');
    if (base === 'chon-anh') return 'Ảnh của tôi';
    if (base === 'noi-dung') {
      const p = window.AlohaContent && window.AlohaContent.list.find((x) => x.slug === a);
      return p ? p.title : '';
    }
    if (base === 'album') {
      const s = window.AlohaAlbums && window.AlohaAlbums.list.find((x) => x.slug === a);
      if (b) { const c = s && s.concepts.find((x) => x.slug === b); return c ? c.name : ''; }
      const tile = document.querySelector('.svc-tile[data-album="' + a + '"] .svc-tile-name');
      return tile ? tile.textContent.trim() : (s ? 'Album ' + s.name : '');
    }
    return (link.textContent || '').trim().slice(0, 40);
  }

  function veilTo(route, link, e) {
    const r = link.getBoundingClientRect();
    const x = e.clientX || r.left + r.width / 2;
    const y = e.clientY || r.top + r.height / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const label = veilLabel(route, link);
    const veil = document.createElement('div');
    veil.className = 'svc-zoom' + (label.length > 26 ? ' is-long' : '');
    veil.setAttribute('aria-hidden', 'true');
    veil.innerHTML = '<div class="svc-zoom-inner"><span class="svc-zoom-heart">♥</span><span class="svc-zoom-name"></span><span class="svc-zoom-line"></span></div>';
    veil.querySelector('.svc-zoom-name').textContent = label;
    document.body.appendChild(veil);
    const inner = veil.querySelector('.svc-zoom-inner');
    const ease = 'cubic-bezier(0.65, 0, 0.35, 1)';
    link.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.97)' }, { transform: 'scale(1)' }], { duration: 280, easing: 'ease-out' });
    inner.animate([{ opacity: 0, transform: 'translateY(14px)', letterSpacing: '0.3em' }, { opacity: 1, transform: 'none', letterSpacing: '0.14em' }],
      { duration: 420, delay: 140, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)', fill: 'both' });
    veil.querySelector('.svc-zoom-line').animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 380, delay: 220, easing: ease, fill: 'both' });
    const open = veil.animate([{ clipPath: 'circle(0px at ' + x + 'px ' + y + 'px)' }, { clipPath: 'circle(' + radius + 'px at ' + x + 'px ' + y + 'px)' }],
      { duration: 480, easing: ease, fill: 'forwards' });
    open.onfinish = () => {
      pendingEnter = true;
      window.location.hash = '/' + route;
      inner.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-10px)' }], { duration: 260, delay: 80, easing: 'ease-in', fill: 'forwards' });
      const fade = veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 360, delay: 100, easing: 'ease-out', fill: 'forwards' });
      fade.onfinish = () => veil.remove();
    };
  }

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#/"]');
    if (!link || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const route = link.getAttribute('href').slice(2).split('?')[0];
    const base = route.split('/')[0];
    if (VEIL_BASES.indexOf(base) === -1 || DISABLED[base] || reduceMotion()) return;
    if ('#/' + route === window.location.hash) return;
    const roles = GATED_ROLES[base];
    if (roles) { // chưa đăng nhập -> để router đưa sang trang đăng nhập như cũ, không chạy hiệu ứng
      const s = window.AlohaAuth && window.AlohaAuth.getSession();
      if (!s || roles.indexOf(s.role) === -1) return;
    }
    if (!currentRoute && Element.prototype.animate) { e.preventDefault(); veilTo(route, link, e); }
    else pendingEnter = true;
  });

  function handleHashChange() {
    const route = parseRoute();
    if (route !== null) navigateTo(route);
    else if (currentRoute === null) currentRoute = ''; // không có route = đang ở Trang chủ
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
  window.AlohaRouter = { navigateTo, showView, parseRoute, takePendingSaleChat: () => { const t = pendingSaleChat; pendingSaleChat = null; return t; } };
  handleHashChange();
})(window);
