// ALOHA Baby — index.html interactions
document.addEventListener('DOMContentLoaded', () => {

  // Năm hiện tại ở footer
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ---------------------------------------------------------------------
  // Khu vực Đăng nhập/Đăng ký trên nav (trang chủ công khai, không gate cả
  // trang) + chặn các thao tác thể hiện quan tâm (xem ảnh, đặt lịch, tư vấn)
  // của khách chưa đăng nhập bằng cách đưa họ sang login.html. Xem js/auth.js.
  // ---------------------------------------------------------------------
  const navAuthArea = document.getElementById('navAuthArea');
  if (navAuthArea && window.AlohaAuth) {
    const session = AlohaAuth.getSession();
    if (session && session.role === 'khach-hang') {
      navAuthArea.innerHTML =
        '<a href="#/chon-anh" class="btn btn-outline btn-sm">Ảnh của tôi</a>' +
        '<a href="#/dat-lich" class="btn btn-primary btn-sm">Đặt lịch</a>' +
        '<button class="icon-btn" id="authLogoutBtn" aria-label="Đăng xuất" title="Đăng xuất">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>' +
        '</button>';
      document.getElementById('authLogoutBtn').addEventListener('click', () => AlohaAuth.logout());
    } else if (session) {
      navAuthArea.innerHTML =
        '<a href="crm/admin.html" class="btn btn-outline btn-sm">Khu vực quản trị</a>' +
        '<button class="icon-btn" id="authLogoutBtn" aria-label="Đăng xuất" title="Đăng xuất">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>' +
        '</button>';
      document.getElementById('authLogoutBtn').addEventListener('click', () => AlohaAuth.logout());
    }
  }

  const isCustomerLoggedIn = () => !!(window.AlohaAuth && AlohaAuth.getSession() && AlohaAuth.getSession().role === 'khach-hang');
  const goToLogin = (nextPage) => {
    window.location.href = 'login.html' + (nextPage ? '?next=' + encodeURIComponent(nextPage) : '');
  };

  // Ảnh Album/Concept trên Trang chủ giờ là link thật tới nội dung chi tiết (album
  // concept #/album/..., trang concept #/noi-dung/...), xem công khai không cần đăng
  // nhập (người dùng chốt 2026-09-25, thay cho gate "bấm là phải đăng nhập" trước đây).
  // Đặt lịch / Ảnh của tôi vẫn gate trong js/router.js như cũ.
  // Từ 2026-09-28: 5 ảnh + dòng 5 dịch vụ đầu trang mở album #/album/<dịch vụ> (bắt đăng
  // nhập, js/albums.js); chat với Sale là khung nhỏ ở góc (js/sale-chat.js); nút Đặt
  // lịch + chatbot AI vẫn tạm tắt bằng cờ trong js/features.js.

  // Mobile menu toggle
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('open');
      navToggle.classList.toggle('active', isOpen);
      navToggle.setAttribute('aria-expanded', isOpen);
    });
    // Đóng menu khi bấm 1 link (mobile)
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('open');
        navToggle.classList.remove('active');
      });
    });
  }

  // ---------------------------------------------------------------------
  // Tìm kiếm + Thông báo: trước đây 2 icon này chỉ trưng cho đẹp, bấm không
  // làm gì. Tìm kiếm tra trong danh mục dịch vụ/concept/section trang chủ có
  // sẵn (không có backend nên không tìm được nội dung ngoài trang). Thông báo
  // đọc dữ liệu THẬT từ AlohaData (yêu cầu chỉnh sửa ảnh của chính khách đang
  // đăng nhập), không phải dữ liệu giả.
  // ---------------------------------------------------------------------
  function goHomeThenFind(sectionId, matchText) {
    const afterNav = () => {
      let target = null;
      if (matchText) {
        target = Array.from(document.querySelectorAll('#' + sectionId + ' span'))
          .find((el) => el.textContent.trim() === matchText);
      }
      if (!target) target = document.getElementById(sectionId);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    const currentHash = window.location.hash;
    if (currentHash.indexOf('#/') === 0 && currentHash !== '#/') {
      if (window.AlohaRouter) window.AlohaRouter.showView('');
      history.replaceState(null, '', '#/');
      setTimeout(afterNav, 80);
    } else {
      afterNav();
    }
  }

  const SEARCH_INDEX = [
    { label: 'Chụp ảnh Bé lớn', sub: 'Dịch vụ', section: 'dich-vu', match: 'Chụp ảnh bé lớn' },
    { label: 'Chụp ảnh Sinh nhật', sub: 'Dịch vụ', section: 'dich-vu', match: 'Chụp ảnh sinh nhật' },
    { label: 'Chụp ảnh Bầu', sub: 'Dịch vụ', section: 'dich-vu', match: 'Chụp ảnh bầu' },
    { label: 'Chụp ảnh Gia đình', sub: 'Dịch vụ', section: 'dich-vu', match: 'Chụp ảnh gia đình' },
    { label: 'Chụp ảnh Newborn', sub: 'Dịch vụ', section: 'dich-vu', match: 'Chụp ảnh Newborn' },
    { label: 'Concept Biển', sub: 'Thư viện concept', route: 'noi-dung/concept-bien' },
    { label: 'Concept Noel', sub: 'Thư viện concept', route: 'noi-dung/concept-noel' },
    { label: 'Concept Sinh nhật', sub: 'Thư viện concept', route: 'noi-dung/concept-sinh-nhat' },
    { label: 'Concept Vintage', sub: 'Thư viện concept', route: 'noi-dung/concept-vintage' },
    { label: 'Concept Hàn Quốc', sub: 'Thư viện concept', route: 'noi-dung/concept-han-quoc' },
    { label: 'Album ảnh đẹp', sub: 'Thư viện ảnh', section: 'album' },
    { label: 'Giới thiệu studio', sub: 'Về ALOHA Baby', route: 'noi-dung/gioi-thieu-studio' },
    { label: 'Chụp ảnh tại nhà', sub: 'Dịch vụ', route: 'noi-dung/chup-tai-nha' },
    { label: 'Video: Một ngày tại ALOHA Baby', sub: 'Video hậu trường', route: 'noi-dung/mot-ngay-tai-aloha' },
    { label: 'Nên chụp ảnh newborn khi nào?', sub: 'Tin tức', route: 'noi-dung/newborn-thoi-diem' },
    { label: 'Hướng dẫn đặt lịch, đặt cọc online', sub: 'Tin tức', route: 'noi-dung/huong-dan-dat-lich' },
    { label: 'Vì sao chọn ALOHA Baby?', sub: 'Tin tức', route: 'noi-dung/vi-sao-chon-aloha' },
    { label: 'Tin tức, kinh nghiệm chụp ảnh', sub: 'Trang chủ', section: 'tin-tuc' },
    { label: 'Đặt lịch chụp ảnh', sub: 'Đặt lịch', route: 'dat-lich' },
    { label: 'Nhắn tin cho Sale', sub: 'Tư vấn trực tiếp', route: 'chat-sale' },
    { label: 'Ảnh của tôi', sub: 'Sau khi chụp', route: 'chon-anh' },
  ];

  function stripDiacritics(s) {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
  }

  function setupNavUtil(btnId, panelId, onOpen) {
    const btn = document.getElementById(btnId);
    const panel = document.getElementById(panelId);
    if (!btn || !panel) return null;
    const close = () => { panel.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); };
    const isOpen = () => panel.classList.contains('open');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = !isOpen();
      // Đóng mọi panel khác đang mở (search/notif không mở cùng lúc, đỡ rối).
      document.querySelectorAll('.nav-util-panel.open').forEach((p) => p.classList.remove('open'));
      if (willOpen) { panel.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); if (onOpen) onOpen(); }
      else close();
    });
    panel.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    return { close };
  }

  setupNavUtil('searchBtn', 'searchPanel', () => {
    const input = document.getElementById('searchInput');
    if (input) { input.value = ''; renderSearchResults(''); setTimeout(() => input.focus(), 50); }
  });

  function renderSearchResults(query) {
    const box = document.getElementById('searchResults');
    if (!box) return;
    const q = stripDiacritics(query.trim());
    // Mục trỏ tới tính năng đang tạm tắt (js/features.js) thì không đưa vào kết quả.
    const F = window.ALOHA_FEATURES || {};
    const enabled = SEARCH_INDEX.filter((it) => !(it.route === 'dat-lich' && F.booking === false) && !(it.route === 'chat-sale' && F.aiChat !== false));
    const items = q ? enabled.filter((it) => stripDiacritics(it.label).includes(q)) : enabled;
    if (items.length === 0) {
      box.innerHTML = '<div class="nav-util-empty">Không tìm thấy kết quả phù hợp. Thử từ khóa khác hoặc gọi hotline 0938.125.222.</div>';
      return;
    }
    box.innerHTML = items.map((it, i) => `<button type="button" data-i="${i}">${it.label} <span style="color:var(--navy-500); font-weight:400;">· ${it.sub}</span></button>`).join('');
    box.querySelectorAll('button').forEach((b) => {
      b.addEventListener('click', () => {
        const item = items[Number(b.dataset.i)];
        document.getElementById('searchPanel').classList.remove('open');
        if (item.route) {
          if ((item.route === 'dat-lich' || item.route === 'chon-anh') && !isCustomerLoggedIn()) { goToLogin(item.route); return; }
          window.location.hash = '/' + item.route;
        } else {
          goHomeThenFind(item.section, item.match);
        }
      });
    });
  }

  const searchInputEl = document.getElementById('searchInput');
  if (searchInputEl) {
    searchInputEl.addEventListener('input', () => renderSearchResults(searchInputEl.value));
    searchInputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const first = document.querySelector('#searchResults button');
        if (first) first.click();
      }
    });
  }

  setupNavUtil('notifBtn', 'notifPanel', () => renderNotifications(true));

  // markSeen=true chỉ khi khách CHỦ ĐỘNG mở panel (đang thật sự xem) - lúc đó
  // mới tắt chấm đỏ "ảnh đã sửa xong" cho các yêu cầu Hoàn thành. Lúc load
  // trang lần đầu hoặc lúc polling nền (xem setInterval bên dưới) chỉ đọc lại
  // dữ liệu để cập nhật chấm đỏ/danh sách, không tự ý đánh dấu đã xem hộ khách.
  function renderNotifications(markSeen) {
    const list = document.getElementById('notifList');
    const dot = document.getElementById('notifDot');
    if (!list || !dot) return;
    const session = window.AlohaAuth && AlohaAuth.getSession();
    if (!session || session.role !== 'khach-hang') {
      list.innerHTML = '<div class="nav-util-empty">Đăng nhập để xem thông báo về lịch hẹn và yêu cầu chỉnh sửa ảnh của bạn.<br><a href="login.html">Đăng nhập ngay</a></div>';
      dot.hidden = true;
      return;
    }
    const myRequests = (window.AlohaData ? AlohaData.getEditRequests() : [])
      .filter((r) => r.phone === session.phone)
      .sort((a, b) => b.createdAt - a.createdAt);
    if (myRequests.length === 0) {
      list.innerHTML = '<div class="nav-util-empty">Chưa có thông báo nào. Yêu cầu chỉnh sửa ảnh sau khi gửi sẽ hiện tiến độ ở đây.</div>';
      dot.hidden = true;
      return;
    }
    list.innerHTML = myRequests.map((r) => {
      const isDoneUnseen = r.status === 'Hoàn thành' && !r.customerSeenDone;
      if (r.status === 'Hoàn thành') {
        return `
        <div class="nav-util-item${isDoneUnseen ? ' notif-highlight' : ''}">
          <strong>${isDoneUnseen ? 'Ảnh đã sửa xong · ' : ''}${r.orderCode || ''}</strong>
          <span class="sub">${r.serviceLabel} · ${r.photoCount} ảnh</span>
          <span class="notif-status">Hoàn thành, xem trong "Ảnh của tôi"</span>
        </div>`;
      }
      return `
      <div class="nav-util-item">
        <strong>Yêu cầu chỉnh sửa ${r.orderCode || ''}</strong>
        <span class="sub">${r.serviceLabel} · ${r.photoCount} ảnh</span>
        <span class="notif-status">${r.status}</span>
      </div>`;
    }).join('');

    if (markSeen && window.AlohaData) {
      myRequests.forEach((r) => {
        if (r.status === 'Hoàn thành' && !r.customerSeenDone) AlohaData.markCustomerSeenDone(r.id);
      });
    }
    // Đọc lại sau khi có thể vừa đánh dấu đã xem, để chấm đỏ tắt đúng lúc.
    const freshRequests = markSeen ? (window.AlohaData ? AlohaData.getEditRequests() : []).filter((r) => r.phone === session.phone) : myRequests;
    dot.hidden = !freshRequests.some((r) => r.status !== 'Hoàn thành' || (r.status === 'Hoàn thành' && !r.customerSeenDone));
  }
  renderNotifications(false);
  // Mô phỏng "real-time" trong cùng trình duyệt: nếu Thợ ảnh vừa chuyển 1 yêu
  // cầu sang Hoàn thành ở tab/khung khác, chấm đỏ + danh sách ở đây tự cập
  // nhật mà khách không cần tải lại trang. KHÔNG đồng bộ được giữa các thiết
  // bị/trình duyệt khác nhau vì site tĩnh chưa có backend thật (xem
  // rules/tech-defaults.md mục "Giới hạn của bản hiện tại").
  setInterval(() => renderNotifications(false), 5000);

  // Scroll-reveal animation cho mọi section (yêu cầu bắt buộc — xem .claude/rules/design.md)
  const revealEls = document.querySelectorAll('.reveal');
  const revealShown = new WeakSet();
  function markRevealed(el, observer) {
    if (revealShown.has(el)) return;
    revealShown.add(el);
    el.classList.add('visible');
    if (observer) observer.unobserve(el);
  }

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) markRevealed(entry.target, observer);
      });
    }, { threshold: 0, rootMargin: '0px 0px -5% 0px' });

    revealEls.forEach(el => observer.observe(el));

    // Lưới an toàn: threshold/rootMargin chặt cộng với cuộn rất nhanh (fling trên
    // mobile, hoặc trang mở sẵn ở giữa nhờ bfcache) có thể khiến observer bỏ lỡ
    // một phần tử đã đi qua viewport, khiến nó kẹt vĩnh viễn ở opacity:0. Dùng
    // setInterval thay vì rAF-on-scroll vì rAF có thể bị trình duyệt tạm dừng khi
    // tab không ở tiền cảnh — setInterval vẫn chạy được trong mọi trường hợp.
    const safetyInterval = setInterval(() => {
      const remaining = document.querySelectorAll('.reveal:not(.visible)');
      if (remaining.length === 0) { clearInterval(safetyInterval); return; }
      remaining.forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > -window.innerHeight) {
          markRevealed(el, observer);
        }
      });
    }, 350);
  } else {
    // Fallback: không hỗ trợ IntersectionObserver -> hiện luôn
    revealEls.forEach(el => markRevealed(el));
  }

  // Header đổi bóng nhẹ khi cuộn
  const header = document.querySelector('.site-header');
  if (header) {
    window.addEventListener('scroll', () => {
      header.style.boxShadow = window.scrollY > 10 ? '0 6px 18px rgba(44,42,61,0.08)' : 'none';
    });
  }

  // ---------------------------------------------------------------------
  // Chatbot tư vấn: bước chọn dịch vụ ban đầu vẫn là kịch bản quick-reply
  // dựng sẵn (chủ động, nhất quán). Khung nhập tự do bên dưới gọi sang
  // server proxy cục bộ (server/server.js) để nhận câu trả lời từ Claude
  // API thật — xem server/README trong thư mục đó và .claude/rules/tech-defaults.md.
  // ---------------------------------------------------------------------
  const chatToggle = document.getElementById('chatToggle');
  const chatPanel = document.getElementById('chatPanel');
  const chatClose = document.getElementById('chatClose');
  const chatBody = document.getElementById('chatBody');
  const chatInputForm = document.getElementById('chatInputForm');
  const chatInput = document.getElementById('chatInput');
  // Mở trang từ máy đang chạy server local (file:// hoặc localhost) -> gọi
  // server local. Mở từ nơi khác (site đã public) -> gọi server đã deploy
  // public. Cần đổi PROD_CHAT_API_URL thành URL thật sau khi deploy server/
  // (xem hướng dẫn deploy trong server/DEPLOY.md).
  const PROD_CHAT_API_URL = 'https://phantichweb.onrender.com/api/chat';
  const isLocalHost = location.protocol === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const CHAT_API_URL = isLocalHost ? 'http://localhost:3001/api/chat' : PROD_CHAT_API_URL;

  // Cờ aiChat (js/features.js): tắt thì không gắn gì vào khung chatbot, nút chat nổi mở khung
  // chat Sale riêng (js/sale-chat.js). Bật (mặc định từ 2026-09-28) thì chatbot chạy như dưới.
  const aiChatOn = !window.ALOHA_FEATURES || window.ALOHA_FEATURES.aiChat !== false;
  if (aiChatOn && chatToggle && chatPanel && chatClose && chatBody) {
    // Giá/concept/số ảnh gói dưới đây là MINH HỌA (số ảnh gói dùng lại đúng
    // giá trị mặc định trong js/chon-anh.js để nhất quán trong toàn demo) —
    // mức cọc, chính sách chi tiết là cấu hình chưa xác định (xem
    // tech-defaults.md), Sales sẽ báo giá/chính sách chính xác.
    const SERVICE_INFO = {
      'Bé lớn': {
        img: 'images/services/be-lon.jpg',
        concepts: ['Ngoại cảnh công viên, phố cổ', 'Phong cách Hàn Quốc tối giản', 'Vintage cổ điển trong studio'],
        note: 'Phù hợp bé khoảng 2-10 tuổi, có thể chụp thêm cùng bố mẹ trong buổi.',
        packageNote: 'Gói tham khảo khoảng 15 ảnh gốc được chỉnh sửa, chọn thêm ngoài gói sẽ tính phí theo ảnh.',
        price: 'từ 1.500.000đ'
      },
      'Sinh nhật': {
        img: 'images/services/sinh-nhat.jpg',
        concepts: ['Sinh nhật rực rỡ, nhiều bóng bay', 'Theo mùa/lễ hội (Noel, Trung thu...)', 'Tông pastel nhẹ nhàng'],
        note: 'Có thể kết hợp bánh kem, backdrop theo yêu cầu, phù hợp mốc thôi nôi/sinh nhật.',
        packageNote: 'Gói tham khảo khoảng 15 ảnh gốc được chỉnh sửa, chọn thêm ngoài gói sẽ tính phí theo ảnh.',
        price: 'từ 1.800.000đ'
      },
      'Bầu': {
        img: 'images/services/bau.jpg',
        concepts: ['Vintage nhẹ nhàng trong studio', 'Ngoại cảnh thiên nhiên', 'Tối giản, tôn dáng mẹ bầu'],
        note: 'Nhiều mẹ chọn chụp khi thai khoảng 32-36 tuần để dáng bụng tròn đẹp mà vẫn thoải mái di chuyển, mình gợi ý chung vậy thôi nhé, còn tuỳ sức khoẻ mỗi mẹ.',
        packageNote: 'Gói tham khảo khoảng 15 ảnh gốc được chỉnh sửa, chọn thêm ngoài gói sẽ tính phí theo ảnh.',
        price: 'từ 2.000.000đ'
      },
      'Gia đình': {
        img: 'images/services/gia-dinh.jpg',
        concepts: ['Ngoại cảnh công viên, biển', 'Vintage ấm áp trong studio', 'Đồng phục tông màu theo gia đình'],
        note: 'Không giới hạn số thành viên trong ảnh, có thể chụp nhiều thế hệ trong cùng buổi.',
        packageNote: 'Gói tham khảo khoảng 15 ảnh gốc được chỉnh sửa, chọn thêm ngoài gói sẽ tính phí theo ảnh.',
        price: 'từ 2.500.000đ'
      },
      'Newborn': {
        img: 'images/services/newborn.jpg',
        concepts: ['Newborn tự nhiên (organic) tại studio', 'Cuộn ủ (wrap) cổ điển', 'Có bố mẹ/anh chị cùng khung hình'],
        note: 'Nhiều gia đình chọn chụp khi bé khoảng 5-14 ngày tuổi vì bé ngủ sâu, dễ tạo dáng hơn — studio giữ ấm phòng chụp phù hợp cho bé.',
        packageNote: 'Gói tham khảo khoảng 15 ảnh gốc được chỉnh sửa, chọn thêm ngoài gói sẽ tính phí theo ảnh.',
        price: 'từ 2.200.000đ'
      }
    };

    let chatStarted = false;
    let interacted = false; // khách đã bấm/gõ gì trong khung chưa (chưa thì lời chào đổi theo trang được)
    let saleMode = false;   // đang chat trực tiếp với Sale ngay trong khung này (js/sale-chat.js embed)
    let botNav = false;     // chính chatbot vừa mở trang (nút gợi ý) -> không chào lại theo trang mới
    const FEAT = window.ALOHA_FEATURES || {};

    // ------------------------------------------------ Tư vấn theo bé nhà mình (thu thập thông tin)
    // Hỏi tuần tự tuổi/dự sinh, giới tính, cân nặng, phong cách quan tâm rồi tự mở album concept hợp
    // với bé, giảm tải hỏi lại cho Sales (2026-09, đổi 2026-09-30). leadInfo chỉ hỏi 1 lần/phiên.
    let leadInfo = null;        // { age, gender, weight, style, service, conceptLabel, conceptObj } sau khi hỏi xong
    let leadPending = null;     // bước đang chờ khách GÕ TỰ DO trả lời ('age'|'gender'|'weight'|'style'), null = không chờ
    let startLeadIntake = null; // gán bên trong khối nhập tự do (cần detectConcept/SERVICE_KEYWORDS)
    let startServiceIntake = null; // hỏi thông tin bé theo dịch vụ đang xem (gán cùng chỗ startLeadIntake)

    const addMsg = (text, who) => {
      const div = document.createElement('div');
      div.className = 'chat-msg ' + who;
      div.textContent = text;
      chatBody.appendChild(div);
      chatBody.scrollTop = chatBody.scrollHeight;
      if (who === 'user') {
        interacted = true;
        // Ghi vào hành trình (js/router.js) để tóm tắt cho Sale khi khách chuyển sang Sale.
        if (!saleMode && window.AlohaJourney) window.AlohaJourney.add('ask', { label: text });
      }
      return div;
    };

    // Tin nhắn kèm ảnh minh hoạ (tư vấn dịch vụ/concept) — ảnh thật đã có sẵn
    // trong images/ (stock miễn phí bản quyền, xem rules/design.md), không
    // phải ảnh khách hàng thật.
    const addImageMsg = (src, alt, caption) => {
      const div = document.createElement('div');
      div.className = 'chat-msg bot chat-media';
      const img = document.createElement('img');
      img.src = src; img.alt = alt; img.loading = 'lazy';
      // Ảnh tải xong mới có chiều cao -> cuộn lại xuống cuối để tin nhắn sau ảnh không bị khuất.
      img.addEventListener('load', () => { chatBody.scrollTop = chatBody.scrollHeight; }, { once: true });
      div.appendChild(img);
      if (caption) {
        const cap = document.createElement('p');
        cap.className = 'chat-media-cap';
        cap.textContent = caption;
        div.appendChild(cap);
      }
      chatBody.appendChild(div);
      chatBody.scrollTop = chatBody.scrollHeight;
      return div;
    };

    const addTyping = () => {
      const div = document.createElement('div');
      div.className = 'chat-msg bot chat-typing';
      div.innerHTML = '<span></span><span></span><span></span>';
      chatBody.appendChild(div);
      chatBody.scrollTop = chatBody.scrollHeight;
      return div;
    };

    const botSay = (text, delay = 550) => new Promise((resolve) => {
      const typing = addTyping();
      setTimeout(() => {
        typing.remove();
        addMsg(text, 'bot');
        resolve();
      }, delay);
    });

    const addQuickReplies = (options, onPick) => {
      const wrap = document.createElement('div');
      wrap.className = 'chat-quick';
      options.forEach((label) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = label;
        btn.addEventListener('click', () => {
          wrap.remove();
          onPick(label);
        });
        wrap.appendChild(btn);
      });
      chatBody.appendChild(wrap);
      chatBody.scrollTop = chatBody.scrollHeight;
    };

    // ------------------------------------------------ Gợi ý: tối đa 2 nút, AI chọn theo hoàn cảnh
    // Người dùng yêu cầu 2026-09-28: mỗi lần chỉ 2 nút gợi ý, dùng AI để chọn cho đúng hoàn cảnh.
    // Mỗi menu đưa ra danh sách lựa chọn làm được (id + chữ + mô tả + việc cần chạy); server
    // (/api/chat-suggest, Gemini) chọn 2 cái hợp nhất với trang đang xem, đoạn chat gần nhất và
    // hành trình khách, có thể viết lại chữ cho sát, hoặc thay 1 nút bằng câu hỏi khách hay hỏi
    // lúc đó (id "ask", bấm là gửi câu đó cho trợ lý AI). AI chậm quá SUGGEST_WAIT_MS / lỗi /
    // khách chưa đăng nhập -> 2 lựa chọn đầu danh sách (thứ tự mặc định). Nút hiện 1 lần, không
    // đổi dưới tay khách; cùng 1 hoàn cảnh thì dùng lại kết quả cũ (đỡ tốn lượt gọi AI).
    const MAX_SUGGEST = 2;
    const SUGGEST_WAIT_MS = 3000;
    const SUGGEST_URL = CHAT_API_URL.replace(/\/api\/chat$/, '/api/chat-suggest');
    const suggestCache = new Map();
    let askAI = null; // = sendToAI, gán ở phần khung nhập tự do bên dưới
    const C = (id, label, run, desc) => ({ id, label, run, desc: desc || '' });

    const pageText = () => {
      const ctx = pageContext();
      if (ctx.concept) return `Đang xem album concept "${ctx.concept.name}" của dịch vụ ${ctx.service.name}`;
      if (ctx.service) return `Đang xem album dịch vụ ${ctx.service.name}`;
      const h = window.location.hash;
      if (/^#\/noi-dung\//.test(h)) return 'Đang đọc trang nội dung: ' + document.title.replace(/\s*\|.*$/, '');
      if (/^#\/chon-anh/.test(h)) return 'Đang ở mục Ảnh của tôi';
      return 'Đang ở trang chủ';
    };
    const recentChat = () => Array.from(chatBody.querySelectorAll(':scope > .chat-msg:not(.chat-typing)')).slice(-8)
      .map((m) => (m.classList.contains('user') ? 'Khách: ' : 'Trợ lý: ') + m.textContent.trim().slice(0, 300))
      .filter((s) => s.length > 8);

    const offer = (candidates) => {
      const list = candidates.filter(Boolean);
      if (!list.length) return;
      const wrap = document.createElement('div');
      wrap.className = 'chat-quick';
      chatBody.appendChild(wrap);
      const show = (items) => {
        if (!wrap.isConnected) return; // khung đã đổi (khách bấm chỗ khác, chuyển Sale...)
        wrap.classList.remove('is-loading');
        wrap.removeAttribute('aria-busy');
        wrap.innerHTML = '';
        items.slice(0, MAX_SUGGEST).forEach((it) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = it.label;
          btn.addEventListener('click', () => {
            wrap.remove();
            if (it.id === 'ask') { if (askAI) askAI(it.label); return; }
            addMsg(it.label, 'user');
            it.run();
          });
          wrap.appendChild(btn);
        });
        chatBody.scrollTop = chatBody.scrollHeight;
      };
      const fallback = list.slice(0, MAX_SUGGEST);
      // Chưa đăng nhập: bấm là sang đăng nhập nên không cần AI chọn; ít lựa chọn thì khỏi hỏi.
      if (!isCustomerLoggedIn() || list.length <= MAX_SUGGEST) { show(fallback); return; }
      const history = recentChat();
      const key = [pageContext().key, list.map((c) => c.id).join(','), history.slice(-2).join('|')].join('#');
      if (suggestCache.has(key)) { show(suggestCache.get(key)); return; }
      wrap.classList.add('is-loading');
      wrap.setAttribute('aria-busy', 'true');
      wrap.innerHTML = '<span class="chat-quick-skel"></span><span class="chat-quick-skel"></span>';
      chatBody.scrollTop = chatBody.scrollHeight;
      let done = false;
      const timer = setTimeout(() => { if (!done) { done = true; show(fallback); } }, SUGGEST_WAIT_MS);
      const journey = window.AlohaSaleChat && window.AlohaSaleChat.summaryText ? window.AlohaSaleChat.summaryText() : '';
      fetch(SUGGEST_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ page: pageText(), history, journey, candidates: list.map((c) => ({ id: c.id, label: c.label, desc: c.desc })) }),
        signal: AbortSignal.timeout(10000)
      }).then((r) => (r.ok ? r.json() : null)).then((data) => {
        const got = (data && Array.isArray(data.suggestions) ? data.suggestions : []).map((s) => {
          if (s.id === 'ask') return s.label ? { id: 'ask', label: String(s.label).slice(0, 60) } : null;
          const c = list.find((x) => x.id === s.id);
          return c ? Object.assign({}, c, { label: s.label && String(s.label).length <= 40 ? String(s.label) : c.label }) : null;
        }).filter(Boolean).filter((it, i, arr) => arr.findIndex((o) => o.id === it.id) === i);
        const picked = got.concat(fallback.filter((f) => !got.some((g) => g.id === f.id))).slice(0, MAX_SUGGEST);
        if (got.length) suggestCache.set(key, picked);
        if (!done) { done = true; clearTimeout(timer); show(picked); }
      }).catch(() => { if (!done) { done = true; clearTimeout(timer); show(fallback); } });
    };

    // "Nhắn trực tiếp với Sale": chuyển khung chat này sang chat với Sale thật (trước
    // 2026-09-28 là gọi điện; số hotline vẫn còn ở thanh dưới khung chat).
    const SALE_LABEL = 'Chat để tư vấn thêm';
    const callSale = (topic) => { enterSale(topic || ''); };
    const pageService = () => pageContext().service;
    const saleCand = () => C('sale', SALE_LABEL, () => callSale(pageService() ? pageService().slug : ''), 'chat trực tiếp với tư vấn viên để báo giá chính xác, giữ lịch');
    const BOOK_LABEL = FEAT.booking === false ? 'Giữ lịch với Sale' : 'Chốt đơn - Đặt lịch ngay';

    // Menu sau mỗi câu trả lời để cuộc trò chuyện có nhiều nhánh thay vì 1 đường thẳng.
    const askWhatNext = () => {
      const s = pageService();
      offer([
        saleCand(),
        C('menu', 'Về menu chính', askMainMenu, 'xem lại các chủ đề tư vấn'),
        s && C('bao-gia', `Báo giá ${s.name}`, () => showServiceAdvice(s.name), `giá tham khảo, gói chụp dịch vụ ${s.name} đang xem`),
        s && C('concept', `Concept ${s.name}`, () => askConcept(s.name), `các concept của dịch vụ ${s.name}`),
        C('faq', 'Câu hỏi thường gặp', askFaq, 'địa chỉ, đặt cọc, chụp tại nhà, đổi lịch...')
      ]);
    };

    const askMainMenu = () => {
      const s = pageService();
      offer([
        startLeadIntake && C('tu-van-be', 'Tư vấn theo bé nhà mình', () => startLeadIntake(), 'trả lời vài câu hỏi về bé để được gợi ý concept và giá phù hợp nhất'),
        C('tu-van', 'Tư vấn dịch vụ & báo giá', askService, 'chọn 1 trong 5 dịch vụ để nghe concept và giá tham khảo'),
        C('concept', 'Concept & ảnh mẫu', askConceptService, 'xem concept và album ảnh mẫu theo dịch vụ'),
        s && C('bao-gia', `Báo giá ${s.name}`, () => showServiceAdvice(s.name), `giá tham khảo dịch vụ ${s.name} khách đang xem`),
        C('quy-trinh', 'Quy trình đặt lịch', explainProcess, 'các bước từ đặt lịch tới nhận ảnh'),
        C('faq', 'Câu hỏi thường gặp', askFaq, 'địa chỉ, đặt cọc, chụp tại nhà, đổi lịch...'),
        saleCand()
      ]);
    };

    const explainProcess = async () => {
      await botSay('Dạ quy trình bên em đơn giản lắm ạ, gồm 5 bước:\n1. Chọn dịch vụ & gói\n2. Chọn concept nhà mình thích, chưa chắc thì để em tư vấn\n3. Chọn ngày & khung giờ còn trống\n4. Gửi thông tin của bé & xác nhận\n5. Đặt cọc để giữ lịch chính thức');
      await botSay('Đặt cọc xong là bên em gọi xác nhận lại thông tin, sắp xếp ekip và phòng chụp cho bé, trước buổi chụp bên em cũng nhắc lịch để nhà mình không bị quên ạ.', 500);
      await botSay('Chụp xong anh/chị xem toàn bộ ảnh trong mục "Ảnh của tôi", thả tim ảnh ưng ý và ghi chú muốn chỉnh gì (làm sáng da, xoá vết đỏ...), thợ bên em chỉnh xong sẽ gửi lại ảnh hoàn thiện ạ. Anh/chị còn băn khoăn bước nào không ạ?', 500);
      askWhatNext();
    };

    const FAQ = {
      'Studio ở đâu?': 'Dạ studio bên em ở 35 Lê Văn Thiêm, Thanh Xuân, Hà Nội ạ, hotline 0938.125.222. Nhà mình định chụp cho bé vào khoảng thời gian nào ạ?',
      'Có mấy loại dịch vụ?': 'Dạ bên em có 5 dịch vụ chính: Bé lớn, Sinh nhật, Bầu, Gia đình và Newborn ạ. Nhà mình đang quan tâm dịch vụ nào để em gửi concept và giá tham khảo ạ?',
      'Đặt cọc thế nào?': 'Dạ sau khi chốt dịch vụ, concept, ngày giờ và thông tin của bé thì nhà mình đặt cọc để giữ lịch chính thức ạ. Mức cọc cụ thể bạn Sale giữ lịch sẽ báo đúng theo gói nhà mình chọn, em không muốn báo sai cho anh/chị ạ.',
      'Có chụp tại nhà không?': 'Dạ có ạ! Ngoài chụp tại studio, bên em còn nhận chụp tại nhà cho gia đình muốn không gian quen thuộc, riêng tư hơn. Nhà mình định chụp riêng cho bé hay cả gia đình ạ?',
      'Chưa biết chọn concept nào thì sao?': 'Dạ không sao đâu ạ, nhiều ba mẹ cũng phân vân lắm. Anh/chị cho em biết bé mấy tuổi và nhà mình thích phong cách nào, em gợi ý concept hợp nhất cho bé nhé ạ.',
      'Ảnh gốc và ảnh đã chỉnh sửa khác nhau thế nào?': 'Dạ chụp xong nhà mình xem toàn bộ ảnh gốc trong mục "Ảnh của tôi", thả tim ảnh ưng ý (ghi chú chỉnh riêng từng ảnh được ạ) rồi gửi yêu cầu. Thợ bên em sẽ chỉnh màu, làm đẹp da, ghép ảnh... rồi gửi lại bộ ảnh hoàn thiện cho mình ạ.',
      'Có đổi được lịch hẹn đã đặt không?': 'Dạ được ạ, bé ốm hay nhà mình bận đột xuất thì bên em hỗ trợ đổi lịch. Điều kiện cụ thể tuỳ thời gian còn lại trước buổi chụp, anh/chị nhắn bạn Sale giữ lịch hoặc gọi hotline 0938.125.222 để bên em đổi nhanh nhất cho mình nhé.'
    };

    const askFaq = async () => {
      await botSay('Dạ đây là mấy câu ba mẹ hay hỏi em nhất ạ, anh/chị có thắc mắc gì khác cứ nhắn em nhé.', 400);
      offer(Object.keys(FAQ).map((q, i) => C('faq-' + i, q, async () => { await botSay(FAQ[q]); askWhatNext(); }, 'câu hỏi thường gặp')));
    };

    // Dịch vụ khách đang xem (nếu có) đứng đầu danh sách.
    const servicesFirst = (names) => {
      const s = pageService();
      return s && names.includes(s.name) ? [s.name, ...names.filter((n) => n !== s.name)] : names;
    };
    const askService = () => {
      // Chưa hỏi thông tin bé trong phiên chat này -> hỏi trước để gợi ý đúng hơn thay vì hỏi thẳng dịch vụ.
      if (!leadInfo && startLeadIntake) { startLeadIntake(); return; }
      offer(servicesFirst(Object.keys(SERVICE_INFO)).map((service) =>
        C('svc-' + (slugOf(service) || service), service, () => showServiceAdvice(service), `concept + giá tham khảo dịch vụ ${service}`)));
    };

    const showServiceAdvice = async (service) => {
      const info = SERVICE_INFO[service];
      const concepts = albumConcepts(service).map((c) => c.name);
      addImageMsg(info.img, `Ảnh minh hoạ phong cách ${service} tại ALOHA Baby`, `Ảnh minh hoạ phong cách "${service}" (ảnh minh hoạ, chưa phải ảnh khách hàng thật).`);
      await botSay(`Dạ dịch vụ ${service} bên em đang có ${concepts.length || info.concepts.length} concept ạ:\n• ${(concepts.length ? concepts : info.concepts).join('\n• ')}`);
      await botSay(info.note, 450);
      await botSay(`${info.packageNote}\nGiá tham khảo ${info.price} ạ (giá minh hoạ, bên em báo giá chính xác theo gói nhà mình chọn). Anh/chị muốn xem ảnh mẫu concept nào trước ạ?`, 450);
      offer([
        concepts.length && C('concept', 'Xem concept & ảnh mẫu', () => askConcept(service), `từng concept của dịch vụ ${service} kèm ảnh mẫu`),
        C('chot-don', BOOK_LABEL, () => confirmBooking(service), 'khách muốn chốt, giữ lịch chụp'),
        C('dv-khac', 'Xem dịch vụ khác', askService, 'đổi sang dịch vụ khác'),
        FEAT.booking !== false && saleCand()
      ]);
    };

    // ------------------------------------------------ Kịch bản concept & ảnh mẫu
    // Dữ liệu concept đọc từ js/albums.js (window.AlohaAlbums), cùng nguồn với
    // trang album: thêm/sửa concept ở đó là chatbot tự cập nhật theo.
    const albumOf = (service) => ((window.AlohaAlbums && window.AlohaAlbums.list) || []).find((s) => s.name === service) || null;
    const albumConcepts = (service) => { const a = albumOf(service); return a ? a.concepts : []; };
    const slugOf = (service) => { const a = albumOf(service); return a ? a.slug : ''; };
    // Mở trang album: trên điện thoại đóng khung chat để khách thấy ngay album.
    const openAlbum = (href) => {
      setTimeout(() => {
        botNav = true; setTimeout(() => { botNav = false; }, 800); // trang không đổi thì thôi
        window.location.hash = href.slice(1);
        if (window.innerWidth <= 720) chatPanel.classList.remove('open');
      }, 700);
    };

    const askConceptService = async () => {
      // Chưa hỏi thông tin bé trong phiên chat này -> hỏi trước để gợi ý đúng concept hơn.
      if (!leadInfo && startLeadIntake) { startLeadIntake(); return; }
      await botSay('Dạ anh/chị muốn xem concept của dịch vụ nào ạ? Concept nào bên em cũng có album ảnh mẫu để mình tham khảo.', 450);
      offer(servicesFirst(Object.keys(SERVICE_INFO).filter((s) => albumConcepts(s).length)).map((service) =>
        C('svc-' + slugOf(service), service, () => askConcept(service), `các concept dịch vụ ${service}`)));
    };

    const askConcept = async (service) => {
      const concepts = albumConcepts(service);
      const album = albumOf(service);
      await botSay(`Dạ ${service} bên em có ${concepts.length} concept ạ. Em gợi ý bên dưới, anh/chị thích concept nào cứ nhắn tên cho em nhé.`, 450);
      offer([
        ...concepts.slice(0, 1).map((c) => C('c-' + c.slug, c.name, () => showConcept(service, c), c.desc)),
        album && C('tat-ca', `Xem cả ${concepts.length} concept`, async () => { await botSay(`Dạ em gửi album ${service} anh/chị tham khảo nhé.`, 350); openAlbum(album.href); }, 'mở trang album có đủ mọi concept của dịch vụ'),
        ...concepts.slice(1).map((c) => C('c-' + c.slug, c.name, () => showConcept(service, c), c.desc)),
        C('dv-khac', 'Dịch vụ khác', askConceptService, 'xem concept dịch vụ khác')
      ]);
    };

    const showConcept = async (service, concept) => {
      addImageMsg(concept.cover, `Ảnh mẫu concept ${concept.name}`, `${service} · ${concept.name} (ảnh minh hoạ, chưa phải ảnh khách hàng thật).`);
      await botSay(concept.desc, 500);
      await botSay(`Album "${concept.name}" có ${concept.count} ảnh mẫu ạ. Nhà mình ưng concept này thì báo em, hoặc em tư vấn thêm concept khác cho bé nhé.`, 450);
      offer([
        C('xem-album', 'Xem album concept này', () => {
          botSay(`Dạ em gửi album "${concept.name}" anh/chị tham khảo nhé.`, 350).then(() => { openAlbum(concept.href); askConcept(service); });
        }, 'mở album ảnh mẫu của concept'),
        C('dat-lich', FEAT.booking === false ? 'Giữ lịch concept này' : 'Đặt lịch concept này', () => confirmBooking(`${service} · ${concept.name}`), 'khách muốn chụp concept này'),
        C('concept-khac', 'Concept khác', () => askConcept(service), 'xem concept khác cùng dịch vụ'),
        C('menu', 'Về menu chính', askMainMenu, 'các chủ đề tư vấn khác')
      ]);
    };

    const confirmBooking = async (service) => {
      // Đặt lịch online đang tạm tắt (js/features.js) -> chuyển khách sang Sale để chốt lịch.
      if (FEAT.booking === false) {
        await botSay(`Dạ tuyệt quá ạ! Em kết nối anh/chị với bạn Sale giữ lịch để chốt lịch chụp "${service}" cho bé luôn nhé.`, 500);
        callSale(slugOf(String(service).split(' · ')[0]));
        return;
      }
      await botSay(`Dạ tuyệt quá ạ! Em chuyển anh/chị sang bước đặt lịch "${service}" luôn nhé.`, 500);
      setTimeout(() => {
        window.location.hash = '/dat-lich';
      }, 700);
    };

    // ------------------------------------------------ Lời chào theo trang đang xem (2026-09-28)
    // Trang chủ / trang khác: chào chung. Album 1 dịch vụ: chào theo dịch vụ đó. Album 1 concept:
    // chào theo concept. Khách CHƯA bấm/gõ gì thì lời chào được thay hẳn khi đổi trang; đã trò
    // chuyện rồi thì chỉ nói thêm 1 lượt khi khách sang dịch vụ khác (không xoá cuộc trò chuyện).
    const pageContext = () => {
      const m = /^#\/album\/([a-z-]+)(?:\/([a-z0-9-]+))?/.exec(window.location.hash);
      const s = m && ((window.AlohaAlbums && window.AlohaAlbums.list) || []).find((x) => x.slug === m[1]);
      if (s) {
        const c = m[2] ? s.concepts.find((x) => x.slug === m[2]) : null;
        return { key: 'album:' + s.slug + (c ? '/' + c.slug : ''), service: s, concept: c || null };
      }
      return { key: 'home', service: null, concept: null };
    };
    const greetingFor = (ctx) => {
      if (ctx.concept) {
        return {
          lines: [`Dạ em chào anh/chị ạ! Anh/chị đang xem concept "${ctx.concept.name}" của dịch vụ ${ctx.service.name} 📸`,
            'Anh/chị muốn em tư vấn thêm về concept này, gửi giá tham khảo hay giữ lịch chụp cho bé ạ?'],
          teaser: `Anh/chị thích concept "${ctx.concept.name}"? Em tư vấn ngay nhé!`
        };
      }
      if (ctx.service) {
        return {
          // Vào album 1 dịch vụ (2026-10-04): báo đang ở phần dịch vụ nào rồi hỏi thông tin bé (startServiceIntake).
          lines: [`Dạ anh/chị đang ở phần Chụp ảnh ${ctx.service.name} ạ 📸`,
            `Em hỏi nhanh vài câu để gợi ý concept hợp với ${ctx.service.slug === 'gia-dinh' ? 'cả nhà' : ctx.service.slug === 'bau' ? 'mẹ' : 'bé'} nhé.`],
          teaser: `Anh/chị đang xem Chụp ảnh ${ctx.service.name} 📸 Em hỏi nhanh vài câu để gợi ý concept nhé?`
        };
      }
      return {
        lines: ['Dạ em chào anh/chị ạ! Em là tư vấn viên của ALOHA Baby 👋', 'Nhà mình đang cần tư vấn gì ạ? Anh/chị chọn nhanh bên dưới hoặc nhắn em bất cứ điều gì nhé.'],
        teaser: 'Dạ em chào anh/chị 👋 Nhà mình cần em tư vấn gì ạ?'
      };
    };
    const repliesFor = (ctx) => {
      if (!ctx.service) { askMainMenu(); return; }
      const name = ctx.service.name;
      const info = SERVICE_INFO[name];
      if (ctx.concept) {
        offer([
          C('tu-van-concept', 'Tư vấn concept này', () => showConcept(name, ctx.concept), `mô tả, ảnh mẫu concept ${ctx.concept.name}`),
          C('bao-gia', 'Báo giá & gói chụp', () => showServiceAdvice(name), `giá tham khảo dịch vụ ${name}`),
          C('concept-khac', 'Concept khác', () => askConcept(name), `concept khác của dịch vụ ${name}`),
          saleCand()
        ]);
        return;
      }
      offer([
        C('bao-gia', 'Báo giá & gói chụp', () => showServiceAdvice(name), `giá tham khảo, gói chụp dịch vụ ${name}`),
        C('concept', 'Gợi ý concept', () => askConcept(name), `các concept của dịch vụ ${name}`),
        C('luu-y', 'Lưu ý khi chụp', async () => { await botSay(info ? info.note : 'Dạ phần này em tư vấn chi tiết theo từng bé ạ, anh/chị cho em biết thêm về bé nhé.'); askWhatNext(); }, info ? info.note : ''),
        saleCand()
      ]);
    };

    let greetToken = 0;
    let greetedKey = '';
    const say = (text, delay, token) => new Promise((resolve) => {
      const typing = addTyping();
      setTimeout(() => {
        typing.remove();
        if (token === greetToken) addMsg(text, 'bot');
        resolve(token === greetToken);
      }, delay);
    });
    const greet = async (ctx, replace) => {
      const token = ++greetToken;
      greetedKey = ctx.key;
      if (replace) chatBody.innerHTML = '';
      chatBody.querySelectorAll('.chat-quick').forEach((el) => el.remove());
      const g = greetingFor(ctx);
      for (let i = 0; i < g.lines.length; i++) {
        if (!(await say(g.lines[i], i === 0 ? 550 : 450, token))) return;
      }
      if (token !== greetToken) return;
      leadPending = null;
      if (ctx.service && !ctx.concept && startServiceIntake) startServiceIntake(ctx.service.slug);
      else repliesFor(ctx);
    };
    const serviceOfKey = (key) => key.split('/')[0];
    // Gọi mỗi khi đổi trang (và lúc mở khung chat): đổi lời chào cho hợp trang đang xem.
    const applyContext = () => {
      if (!chatStarted || saleMode) return;
      const ctx = pageContext();
      if (botNav) { botNav = false; greetedKey = ctx.key; return; } // khách đang theo gợi ý của chatbot
      if (ctx.key === greetedKey) return;
      if (!interacted) { greet(ctx, true); return; }
      // Đã trò chuyện: chỉ nói thêm khi sang dịch vụ khác (vào sâu concept của cùng dịch vụ thì thôi).
      if (ctx.service && serviceOfKey(ctx.key) !== serviceOfKey(greetedKey)) greet(ctx, false);
      else greetedKey = ctx.key;
    };

    const startChat = () => {
      if (chatStarted) { applyContext(); return; }
      chatStarted = true;
      greet(pageContext(), true);
    };

    // ------------------------------------------------ Mở / đóng, tự mở, bong bóng lời chào
    // sessionStorage "aloha_chat_ui" (chỉ tuỳ chọn hiển thị trong tab đang mở, không phải dữ
    // liệu nghiệp vụ): { dismissed: khách đã đóng khung -> không tự mở/không hiện bong bóng nữa,
    // mode: 'sale' khi đang chat với Sale (tải lại trang vẫn vào đúng chế độ), saleTopic,
    // openAfterLogin / pendingSale: vừa bị đưa sang đăng nhập từ khung chat -> quay lại thì mở tiếp }.
    const UI_KEY = 'aloha_chat_ui';
    const readUi = () => { try { return JSON.parse(sessionStorage.getItem(UI_KEY) || '{}') || {}; } catch (e) { return {}; } };
    const writeUi = (patch) => { try { sessionStorage.setItem(UI_KEY, JSON.stringify(Object.assign(readUi(), patch))); } catch (e) { /* bị chặn: bỏ qua */ } };
    const isDesktop = () => window.innerWidth > 720;
    const onHomeView = () => { const v = document.getElementById('view-home'); return !!v && !v.hidden; };
    const teaser = document.getElementById('chatTeaser');
    const teaserText = document.getElementById('chatTeaserText');
    const hideTeaser = () => { if (teaser) teaser.hidden = true; };

    const openChat = () => {
      chatPanel.classList.add('open');
      hideTeaser();
      startChat();
      if (!isCustomerLoggedIn() || !window.AlohaSaleChat) return;
      if (saleMode) { embedSale(); return; }
      const ui = readUi();
      // Đang chat với Sale trước khi tải lại trang, hoặc Sale vừa trả lời -> vào thẳng chat Sale.
      // Chỉ tự vào khi tài khoản đã kết nối được máy chủ chat (có mã): đăng nhập lúc máy chủ tắt
      // thì chat Sale bị khoá, tự chuyển sang sẽ làm trợ lý AI như "không trả lời" (lỗi 2026-09-28).
      const session = window.AlohaAuth && AlohaAuth.getSession();
      if (session && session.token && (ui.mode === 'sale' || window.AlohaSaleChat.unread() > 0)) enterSale(ui.saleTopic || '');
    };
    const closeChat = () => {
      chatPanel.classList.remove('open');
      writeUi({ dismissed: true });
      hideTeaser();
      if (saleMode && window.AlohaSaleChat) window.AlohaSaleChat.pause();
    };

    // Khách vãng lai (chưa đăng nhập) được chat tự do ngay, kể cả chat THẬT với Sale (người dùng
    // đổi quyết định 2 lần: 2026-09-28 "mọi nút đều bắt đăng nhập" -> chỉ mở trợ lý AI -> giờ mở
    // luôn cả Sale). Nhắn Sale khi chưa đăng nhập: server tự cấp 1 danh tính tạm "Khách vãng lai"
    // (xem enterSale/js/sale-chat.js ensureGuest, KHÔNG đụng tới tài khoản/aloha_auth thật). Đăng
    // nhập chỉ còn bắt buộc khi khách chủ động bấm nút "Đăng nhập" trên menu, hoặc vào 2 route
    // Đặt lịch/Ảnh của tôi (gate ở js/router.js, không đổi — cần đúng tài khoản để xem lịch/ảnh riêng).
    chatToggle.addEventListener('click', () => {
      if (chatPanel.classList.contains('open')) closeChat(); else openChat();
    });
    chatClose.addEventListener('click', closeChat);
    if (teaserText) teaserText.addEventListener('click', openChat);
    const teaserClose = document.getElementById('chatTeaserClose');
    if (teaserClose) teaserClose.addEventListener('click', () => { writeUi({ dismissed: true }); hideTeaser(); });

    // Trang chủ trên máy tính: tự mở khung chat sau 1.5 giây. Điện thoại: chỉ hiện bong bóng lời
    // chào cạnh nút chat (khung chat che gần hết màn hình). Khách đã đóng thì thôi trong lần truy
    // cập này. Sang trang album dịch vụ: đổi lời chào, KHÔNG tự mở lại (giữ trạng thái mở/đóng).
    let autoOpenTimer = null;
    let autoOpened = false;
    const refreshChatForPage = () => {
      applyContext();
      if (chatPanel.classList.contains('open')) { hideTeaser(); return; }
      const ui = readUi();
      const ctx = pageContext();
      if (ui.dismissed) { hideTeaser(); return; }
      if (isDesktop()) {
        hideTeaser();
        if (onHomeView() && ctx.key === 'home' && !autoOpened && !autoOpenTimer) {
          autoOpenTimer = setTimeout(() => {
            autoOpenTimer = null;
            if (readUi().dismissed || chatPanel.classList.contains('open') || !onHomeView()) return;
            autoOpened = true;
            openChat();
          }, 1500);
        }
        // Vào album 1 dịch vụ (2026-10-04): tự mở để hỏi thông tin bé, trừ khi khách đã đóng khung chat.
        if (ctx.service && !ctx.concept && !autoOpenTimer) {
          const key = ctx.key;
          autoOpenTimer = setTimeout(() => {
            autoOpenTimer = null;
            if (readUi().dismissed || chatPanel.classList.contains('open') || pageContext().key !== key) return;
            openChat();
          }, 1000);
        }
      } else if (teaser && teaserText && ((onHomeView() && ctx.key === 'home') || ctx.service)) {
        teaserText.textContent = greetingFor(ctx).teaser;
        teaser.hidden = false;
      } else {
        hideTeaser();
      }
    };
    window.addEventListener('hashchange', () => setTimeout(refreshChatForPage, 0));

    // Nút "Tư vấn concept ngay" ở section Concept -> mở luôn khung chat tư vấn
    // thay vì dẫn tới link rỗng, khớp đúng flow concept -> tư vấn -> đặt lịch.
    const conceptChatBtn = document.getElementById('conceptChatBtn');
    if (conceptChatBtn) conceptChatBtn.addEventListener('click', openChat);

    // "Báo giá"/"Khuyến mại" (menu) và "Trở thành đối tác"/"Hỗ trợ" (topbar)
    // chưa có trang đích riêng (xem .claude/CLAUDE.md mục việc cần làm) -> thay
    // vì để link chết (href="#" không làm gì), mở khung chat tư vấn thật để
    // khách hỏi trực tiếp, tránh bấm vào "cho vui" không ra kết quả gì.
    ['topbarPartner', 'topbarSupport', 'navPricing', 'navPromo'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('click', (e) => {
        e.preventDefault();
        openChat();
      });
    });

    // ------------------------------------------------ Chat tiếp với Sale ngay trong khung này
    // Khách bấm "Nhắn Sale" / "Nhắn trực tiếp với Sale": cuộc trò chuyện với trợ lý AI giữ
    // nguyên phía trên, bên dưới là chat thật với Sale (js/sale-chat.js vẽ vào .chat-sale-live,
    // tin đi qua server, Sale trả lời trong Admin mục "Tin nhắn"). Lúc chuyển, trình duyệt gửi
    // Sale bản tóm tắt những gì khách đã xem / đã hỏi trợ lý AI (AlohaSaleChat.handoff).
    const chatTitle = document.getElementById('chatTitle');
    const chatSubtitle = document.getElementById('chatSubtitle');
    const chatToSaleText = document.getElementById('chatToSaleText');
    const chatToSale = document.getElementById('chatToSale');
    const chatSaleStatus = document.getElementById('chatSaleStatus');
    const chatSendBtn = chatInputForm ? chatInputForm.querySelector('.chat-send') : null;
    let saleTopic = '';

    // Tên Sale hiển thị ở đầu khung khi đang chat, để khách thấy có người cụ thể đang phụ trách
    // (người dùng yêu cầu 2026-09). Chỉ để HIỂN THỊ: hệ thống chưa phân công theo từng khách thật
    // sự, mọi tài khoản Sale vẫn đọc/trả lời được như nhau (xem CLAUDE.md mục "Việc còn mở"). Chọn
    // 1 lần rồi nhớ lại trong phiên chat này (sessionStorage "aloha_chat_ui") để không đổi tên
    // giữa chừng khi khách rời/quay lại chat Sale hay tải lại trang.
    const SALE_STAFF = ['Ngọc Anh', 'Minh Thư', 'Thu Hà', 'Quốc Bảo', 'Hải Yến'];
    const assignedSaleName = () => {
      const ui = readUi();
      if (ui.saleStaff) return ui.saleStaff;
      const name = SALE_STAFF[Math.floor(Math.random() * SALE_STAFF.length)];
      writeUi({ saleStaff: name });
      return name;
    };

    const addDivider = (text) => {
      const div = document.createElement('div');
      div.className = 'chat-divider';
      div.textContent = text;
      chatBody.appendChild(div);
      chatBody.scrollTop = chatBody.scrollHeight;
    };
    const saleLive = () => {
      let live = chatBody.querySelector('.chat-sale-live');
      if (!live) { live = document.createElement('div'); live.className = 'chat-sale-live'; }
      chatBody.appendChild(live); // luôn nằm cuối, sau các tin với trợ lý AI
      return live;
    };
    const embedSale = () => {
      window.AlohaSaleChat.embed({ container: chatBody.querySelector('.chat-sale-live') || saleLive(), scroller: chatBody,
        input: chatInput, sendBtn: chatSendBtn, statusBox: chatSaleStatus, topic: saleTopic });
    };
    const setSaleUi = (on) => {
      chatPanel.classList.toggle('sale-mode', on);
      if (chatTitle) chatTitle.textContent = on ? 'Sale ALOHA Baby' : 'Tư vấn ALOHA Baby';
      if (chatSubtitle) chatSubtitle.textContent = on ? ('Đang chat với Sale - ' + assignedSaleName()) : 'Tư vấn viên';
      // Nút ở đầu khung: chữ ngắn cho vừa hàng, tên đầy đủ để ở title/aria-label.
      if (chatToSaleText) chatToSaleText.textContent = on ? 'Quay lại' : 'Chat để tư vấn thêm';
      if (chatToSale) {
        chatToSale.title = on ? 'Quay lại khung tư vấn' : 'Chat trực tiếp với Sale để tư vấn thêm';
        chatToSale.setAttribute('aria-label', on ? 'Quay lại khung tư vấn' : 'Chat để tư vấn thêm');
      }
      if (chatInput) chatInput.placeholder = on ? 'Nhập tin nhắn cho Sale...' : 'Nhập tin nhắn...';
      if (!on) {
        if (chatInput) chatInput.disabled = false;
        if (chatSendBtn) chatSendBtn.disabled = false;
        if (chatSaleStatus) chatSaleStatus.hidden = true;
      }
    };

    function enterSale(topic) {
      // Khách vãng lai chat Sale được luôn (người dùng đổi quyết định): không còn bắt đăng nhập ở
      // đây nữa. window.AlohaSaleChat.embed() bên dưới tự xin server cấp 1 danh tính "Khách vãng
      // lai" khi cần (js/sale-chat.js ensureGuest), không đụng tới aloha_auth/tài khoản thật.
      if (!window.AlohaSaleChat) { window.location.href = 'tel:0938125222'; return; }
      chatPanel.classList.add('open');
      hideTeaser();
      if (!chatStarted) { chatStarted = true; interacted = true; greetedKey = pageContext().key; }
      const slug = topic || (pageContext().service ? pageContext().service.slug : '');
      if (saleMode) { if (slug) saleTopic = slug; embedSale(); return; }
      saleMode = true;
      greetToken++; // dừng lời chào của trợ lý AI nếu đang chạy dở
      saleTopic = slug;
      writeUi({ mode: 'sale', saleTopic: slug, dismissed: false });
      chatBody.querySelectorAll('.chat-quick, .chat-typing').forEach((el) => el.remove());
      addDivider('Anh/chị đang chat trực tiếp với Sale ALOHA Baby. Bạn Sale đã nắm những gì mình vừa trao đổi để tư vấn nhanh hơn ạ.');
      saleLive();
      setSaleUi(true);
      embedSale();
      window.AlohaSaleChat.handoff();
    }
    const leaveSale = () => {
      if (!saleMode) return;
      saleMode = false;
      writeUi({ mode: 'ai' });
      if (window.AlohaSaleChat) window.AlohaSaleChat.unembed();
      setSaleUi(false);
      addDivider('Đã quay lại khung tư vấn. Tin nhắn với Sale vẫn được lưu, bấm "Chat để tư vấn thêm" để chat tiếp.');
      askMainMenu();
    };
    if (chatToSale) chatToSale.addEventListener('click', () => { if (saleMode) leaveSale(); else enterSale(''); });
    // Ô nhập của khung chatbot khi đang chat với Sale: nút gửi chỉ sáng khi đã gõ chữ.
    if (chatInput && chatSendBtn) chatInput.addEventListener('input', () => { if (saleMode) chatSendBtn.disabled = chatInput.disabled || !chatInput.value.trim(); });

    // js/sale-chat.js (link #/chat-sale, route #/chat-sale sau khi đăng nhập) mở chat Sale qua đây.
    window.AlohaChatbot = { openSale: (topic) => enterSale(String(topic || '').split('/')[0]), open: openChat, backToAi: leaveSale };

    // Tự mở / hiện bong bóng theo trang đang xem (không còn nhánh "vừa đăng nhập xong từ khung
    // chat" - khung chat không đẩy khách sang đăng nhập nữa, xem comment ở đầu khối addEventListener
    // chatToggle phía trên).
    setTimeout(refreshChatForPage, 0);

    // ---------------------------------------------------------------------
    // Khung nhập tự do -> gọi server proxy (server/) để trả lời bằng Gemini API
    // thật. Nếu AI không dùng được (server tắt, hết model dự phòng...), trả lời
    // cục bộ theo từ khoá (localAnswer) thay vì hiện thông báo lỗi.
    // ---------------------------------------------------------------------
    if (chatInputForm && chatInput) {
      let aiHistory = [];
      let aiBusy = false;
      const sendBtn = chatInputForm.querySelector('.chat-send');

      // Dự phòng khi AI lỗi hoặc không trả gợi ý: 2 nút dẫn thẳng tới trang + 1 câu FAQ
      // có sẵn (trả lời cục bộ, không cần AI).
      const FALLBACK_SUGGESTIONS = [
        { label: 'Đặt lịch chụp ngay', action: 'dat-lich' },
        { label: 'Xem các dịch vụ', action: 'dich-vu' },
        { label: 'Đặt cọc thế nào?', action: 'none' }
      ];

      // Menu 3 gợi ý dưới mỗi câu trả lời của AI, mỗi gợi ý là {label, action}.
      // Có action -> bấm là chuyển thẳng tới trang/mục đó (không tốn lượt gọi AI);
      // action "none" -> gửi như khách tự gõ (hoặc trả lời FAQ cục bộ khi AI đang lỗi).
      const suggestNext = (items, local) => {
        // Đặt lịch đang tắt: nút "đặt lịch" AI gợi ý thực ra mở chat Sale -> đổi chữ cho khớp.
        const list = items.slice(0, MAX_SUGGEST).map((s) => (FEAT.booking === false && s.action === 'dat-lich' ? { label: CHAT_ACTIONS['dat-lich'].cta, action: 'dat-lich' } : s));
        addQuickReplies(list.map((s) => s.label), async (label) => {
          const item = list.find((s) => s.label === label);
          const action = item && CHAT_ACTIONS[item.action];
          if (action) {
            addMsg(label, 'user');
            await botSay(`Dạ em đưa anh/chị tới ${action.label} ngay nhé.`, 400);
            runChatAction(item.action);
            suggestNext(list, local);
            return;
          }
          if (local && FAQ[label]) {
            addMsg(label, 'user');
            await botSay(FAQ[label]);
            suggestNext(FALLBACK_SUGGESTIONS, true);
            return;
          }
          sendToAI(label);
        });
      };

      // Điều hướng theo ý khách: AI trả "action" (xem ACTIONS trong server/server.js),
      // hiện câu trả lời trước rồi mới chuyển trang. Mobile thì đóng khung chat để
      // khách thấy ngay trang đích (khung chat phủ gần hết màn hình nhỏ).
      const goHomeTop = () => {
        const h = window.location.hash;
        if (h.indexOf('#/') === 0 && h !== '#/') {
          if (window.AlohaRouter) window.AlohaRouter.showView('');
          history.replaceState(null, '', '#/');
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };
      // label: tên đích trong câu "Mình đưa bạn tới ...", cta: chữ trên nút gợi ý dự phòng.
      const CHAT_ACTIONS = {
        'dat-lich': { label: 'trang Đặt lịch', cta: 'Đặt lịch chụp ngay', go: () => { window.location.hash = '/dat-lich'; } },
        'chon-anh': { label: 'mục Ảnh của tôi', cta: 'Xem ảnh của tôi', go: () => { window.location.hash = '/chon-anh'; } },
        'dich-vu': { label: 'phần Dịch vụ', cta: 'Xem các dịch vụ', go: () => goHomeThenFind('dich-vu') },
        'concept': { label: 'thư viện Concept', cta: 'Xem các concept', go: () => goHomeThenFind('concept') },
        'album': { label: 'Album ảnh đẹp', cta: 'Xem album ảnh đẹp', go: () => goHomeThenFind('album') },
        'gioi-thieu': { label: 'phần Giới thiệu', cta: 'Xem giới thiệu studio', go: () => goHomeThenFind('gioi-thieu') },
        'tin-tuc': { label: 'phần Tin tức', cta: 'Xem tin tức', go: () => goHomeThenFind('tin-tuc') },
        'trang-chu': { label: 'Trang chủ', cta: 'Về trang chủ', go: goHomeTop }
      };
      // Album theo dịch vụ ("album-<dịch vụ>", AI được gợi ý, khớp ACTIONS trong
      // server/server.js) và album từng concept ("album:<dịch vụ>/<concept>", chỉ
      // frontend tự gắn khi khách nhắc tới concept, xem withConceptButton).
      ((window.AlohaAlbums && window.AlohaAlbums.list) || []).forEach((s) => {
        CHAT_ACTIONS['album-' + s.slug] = { label: `album ${s.name}`, cta: `Xem album ${s.name}`, go: () => { window.location.hash = s.href.slice(1); } };
        s.concepts.forEach((c) => {
          CHAT_ACTIONS[`album:${s.slug}/${c.slug}`] = { label: `album "${c.name}"`, cta: `Xem album ${c.name}`, go: () => { window.location.hash = c.href.slice(1); } };
        });
      });
      // Đặt lịch online đang tạm tắt (js/features.js): gợi ý "đặt lịch" chuyển sang chat với Sale.
      if (FEAT.booking === false) {
        CHAT_ACTIONS['dat-lich'] = { label: 'tư vấn viên Sale để giữ lịch', cta: 'Nhắn Sale để đặt lịch', stay: true,
          go: () => enterSale(pageContext().service ? pageContext().service.slug : '') };
        FALLBACK_SUGGESTIONS[0].label = 'Nhắn Sale để đặt lịch';
      }
      const runChatAction = (name) => {
        const action = CHAT_ACTIONS[name];
        if (!action) return;
        setTimeout(() => {
          botNav = !action.stay; setTimeout(() => { botNav = false; }, 800);
          action.go();
          if (window.innerWidth <= 720 && !action.stay) chatPanel.classList.remove('open');
        }, 900);
      };

      // Dự phòng khi AI không dùng được: nhận diện ý rõ ràng bằng từ khoá để vẫn
      // dẫn khách đi được. Câu hỏi thông tin ("quy trình...", "bao nhiêu...") thì bỏ qua.
      const LOCAL_INTENTS = [
        ['dat-lich', /dat lich|dat hen|hen lich|dat coc|book/],
        ['chon-anh', /chon anh|anh cua toi|xem anh cua|chinh sua anh|sua anh/],
        ['concept', /concept/],
        ['album', /album/],
        ['dich-vu', /dich vu/],
        ['gioi-thieu', /gioi thieu/],
        ['tin-tuc', /tin tuc/],
        ['trang-chu', /trang chu/]
      ];
      const detectLocalAction = (raw) => {
        const t = stripDiacritics(raw);
        if (/\?|the nao|nhu nao|ra sao|la gi|bao nhieu|quy trinh|co .* khong/.test(t)) return null;
        const hit = LOCAL_INTENTS.find(([, re]) => re.test(t));
        return hit ? hit[0] : null;
      };

      // Khách nêu rõ ý muốn (đặt lịch, xem ảnh...) thì menu PHẢI có nút dẫn tới đúng
      // trang đó, kể cả khi AI quên (đặt lên đầu, giữ tối đa 3). Không tự chuyển
      // trang, khách bấm nút mới chuyển.
      const withIntentButton = (list, raw) => {
        const name = detectLocalAction(raw);
        if (!name || list.some((s) => s.action === name)) return list;
        return [{ label: CHAT_ACTIONS[name].cta, action: name }, ...list].slice(0, MAX_SUGGEST);
      };

      // Khách nhắc tới 1 concept (kể cả khi đang hỏi: "có chụp trung thu không?")
      // -> gắn nút mở đúng album concept đó. Mỗi dòng: [từ khoá, { dịch vụ: concept }];
      // từ khoá dùng chung nhiều dịch vụ (biển, vintage...) thì ưu tiên dịch vụ khách
      // đang nhắc trong câu, không thì lấy dịch vụ đầu tiên.
      const CONCEPT_KEYWORDS = [
        [/trung thu|den long/, { 'sinh-nhat': 'trung-thu' }],
        [/noel|giang sinh/, { 'sinh-nhat': 'le-hoi' }],
        [/cong chua|hoang tu|vuong mien/, { 'sinh-nhat': 'cong-chua' }],
        [/pastel|dap banh|cake smash/, { 'sinh-nhat': 'pastel' }],
        [/bong bay/, { 'sinh-nhat': 'bong-bay' }],
        [/bua tiec|tiec sinh nhat|tiec cung|thoi nen/, { 'sinh-nhat': 'tiec-gia-dinh' }],
        [/picnic|da ngoai/, { 'sinh-nhat': 'picnic', 'gia-dinh': 'da-ngoai' }],
        [/ao dai/, { 'be-lon': 'ao-dai' }],
        [/han quoc|hanbok/, { 'be-lon': 'han-quoc' }],
        [/nghe nghiep|canh sat|cuu hoa|bac si|phi cong/, { 'be-lon': 'nghe-nghiep' }],
        [/mua thu|la vang/, { 'be-lon': 'mua-thu' }],
        [/the thao|bong ro|bong da|tennis/, { 'be-lon': 'the-thao' }],
        [/trang sao|mat trang|vang trang|ngoi sao/, { newborn: 'trang-sao' }],
        [/tai tho|tai gau|thu ngo nghinh|hoa than thu|con thu/, { newborn: 'thu-ngo-nghinh' }],
        [/cuon u|quan u|\bwrap\b/, { newborn: 'cuon-u' }],
        [/hoa la/, { newborn: 'hoa-la' }],
        [/tu nhien|organic/, { newborn: 'tu-nhien' }],
        [/vong hoa/, { bau: 'vong-hoa' }],
        [/cung chong|voi chong|ca chong/, { bau: 'cung-chong' }],
        [/nhieu the he|\bong ba\b/, { 'gia-dinh': 'nhieu-the-he' }],
        [/anh chi em/, { 'gia-dinh': 'anh-chi-em' }],
        [/dong phuc/, { 'gia-dinh': 'dong-phuc' }],
        [/toi gian/, { bau: 'toi-gian' }],
        [/den trang/, { newborn: 'den-trang', 'be-lon': 'vintage' }],
        [/\bbien\b/, { 'gia-dinh': 'bien', bau: 'bien', 'be-lon': 'ngoai-canh' }],
        [/vintage|co dien/, { 'be-lon': 'vintage', bau: 'vintage', 'gia-dinh': 'vintage' }],
        [/ngoai canh|cong vien|ngoai troi/, { 'be-lon': 'ngoai-canh', bau: 'ngoai-canh', 'gia-dinh': 'ngoai-canh' }]
      ];
      const detectConcept = (raw) => {
        const t = stripDiacritics(raw);
        const ctx = SERVICE_KEYWORDS.find(([, re]) => re.test(t));
        const ctxSlug = ctx && albumOf(ctx[0]) ? albumOf(ctx[0]).slug : null;
        for (const [re, map] of CONCEPT_KEYWORDS) {
          if (!re.test(t)) continue;
          const s = ctxSlug && map[ctxSlug] ? ctxSlug : Object.keys(map)[0];
          const key = `album:${s}/${map[s]}`;
          if (CHAT_ACTIONS[key]) return key;
        }
        return null;
      };
      const withConceptButton = (list, raw) => {
        const key = detectConcept(raw);
        if (!key || list.some((s) => s.action === key)) return list;
        return [{ label: CHAT_ACTIONS[key].cta, action: key }, ...list].slice(0, MAX_SUGGEST);
      };
      const conceptOfAction = (key) => {
        const [s, c] = key.slice('album:'.length).split('/');
        const service = ((window.AlohaAlbums && window.AlohaAlbums.list) || []).find((x) => x.slug === s);
        return service ? { service, concept: service.concepts.find((x) => x.slug === c) } : null;
      };

      // Lớp dự phòng cuối: server đã thử hết các model AI mà vẫn lỗi (hoặc không kết
      // nối được server) -> trả lời cục bộ theo từ khoá, dùng đúng dữ liệu FAQ /
      // SERVICE_INFO có sẵn, để khách luôn nhận được câu trả lời thay vì thông báo lỗi.
      // Có nói rõ đây là trả lời nhanh, không giả vờ là AI (guardrail CLAUDE.md).
      // Trả lời dự phòng khi AI không phản hồi: cùng giọng Sale, không báo bận/lỗi (người dùng chốt 2026-10-04,
      // thay quy tắc cũ "ghi rõ Trợ lý AI đang bận").
      const LOCAL_NOTE = 'Dạ ';
      const SERVICE_KEYWORDS = [
        ['Newborn', /newborn|so sinh/],
        ['Bầu', /\bbau\b|mang thai|mang bau/],
        ['Sinh nhật', /sinh nhat|thoi noi/],
        ['Gia đình', /gia dinh/],
        ['Bé lớn', /be lon/]
      ];
      // ---- Hỏi thông tin bé theo DỊCH VỤ đang xem (đổi 2026-10-04, người dùng chốt): khách vào album 1
      // dịch vụ -> chat báo "anh/chị đang ở phần Chụp ảnh X" rồi hỏi lần lượt tuổi -> giới tính -> cân
      // nặng -> concept (mỗi concept của dịch vụ là 1 nút, bấm là mở album concept đó), cuối cùng cảm ơn
      // + nút "Chat với Sale". Câu hỏi/nút trả lời theo từng dịch vụ ở LEAD_FLOW (Bầu hỏi tuần thai, không
      // hỏi cân nặng; Gia đình hỏi số người). Đã trả lời rồi thì sang dịch vụ khác không hỏi lại, chỉ hỏi
      // câu còn thiếu + concept. Khách tự gõ tuổi bé ("con tôi 3 tuổi") cũng vào luồng này, bỏ qua câu tuổi.
      const leadDraft = {}; // { service, age, gender, weight, week, people } giữ suốt phiên chat
      const NUM_WORDS = { mot: 1, hai: 2, ba: 3, bon: 4, tu: 4, nam: 5, sau: 6, bay: 7, tam: 8, chin: 9, muoi: 10 };
      // Đọc tuổi bé từ câu khách gõ / nút bấm -> { label, months, pregnant } hoặc null.
      const parseAge = (raw) => {
        const t = stripDiacritics(raw).replace(/\b(mot|hai|ba|bon|tu|nam|sau|bay|tam|chin|muoi)\s+(tuoi|thang)\b/g, (m, w, u) => NUM_WORDS[w] + ' ' + u);
        if (/mang bau|mang thai|dang bau|\bbau\b|du sinh|tuan thai/.test(t)) return { label: 'Đang mang bầu', months: -1, pregnant: true };
        if (/moi sinh|so sinh|newborn|duoi 1 thang|\d+\s*ngay( tuoi)?\b/.test(t)) return { label: 'Dưới 1 tháng tuổi', months: 0 };
        let m = /(\d+(?:[.,]5)?)\s*(tuoi|t\b)/.exec(t);
        if (m) { const y = parseFloat(m[1].replace(',', '.')); if (y > 0 && y < 16) return { label: `${m[1]} tuổi`, months: Math.round(y * 12) }; }
        m = /(\d+)\s*thang/.exec(t);
        if (m) { const mo = +m[1]; if (mo >= 0 && mo < 72) return { label: mo ? `${mo} tháng` : 'Dưới 1 tháng tuổi', months: mo }; }
        if (/thoi noi/.test(t)) return { label: '1 tuổi (thôi nôi)', months: 12 };
        return null;
      };
      const parseGender = (raw) => {
        const t = stripDiacritics(raw);
        if (/chua biet|khong biet|bi mat/.test(t)) return 'Chưa biết';
        if (/gai|\bnu\b|con gai/.test(t)) return 'Bé gái';
        if (/trai|giai|\bnam\b/.test(t)) return 'Bé trai';
        return null;
      };
      // Dịch vụ hợp với tuổi bé khách tự gõ: bầu -> Bầu, tới 6 tháng -> Newborn; lớn hơn thì giữ Sinh
      // nhật / Gia đình nếu khách đang xem album đó, còn lại -> Bé lớn.
      const leadServiceSlug = (age) => {
        if (age.pregnant) return 'bau';
        if (age.months <= 6) return 'newborn';
        const cur = pageService();
        if (cur && (cur.slug === 'sinh-nhat' || cur.slug === 'gia-dinh')) return cur.slug;
        return 'be-lon';
      };
      // Câu hỏi + dòng giải thích (hiện dưới câu hỏi) + nút trả lời theo từng dịch vụ.
      const Q = {
        age: ['Bé nhà mình được mấy tháng tuổi hoặc bao nhiêu tuổi rồi ạ?', 'Giúp studio định hướng gói chụp Newborn, bé ngồi, thôi nôi hay chụp ngoại cảnh/sinh nhật'],
        week: ['Mẹ đang ở tuần thai thứ mấy rồi ạ?', 'Giúp studio gợi ý thời điểm chụp và trang phục vừa dáng mẹ'],
        people: ['Nhà mình định chụp mấy người ạ?', 'Giúp studio chuẩn bị bối cảnh và trang phục cho cả nhà'],
        gender: ['Giới tính của bé là gì ạ?', 'Giúp studio gợi ý tone màu, trang phục và phụ kiện phù hợp'],
        weight: ['Cân nặng hiện tại của bé khoảng bao nhiêu kg ạ?', 'Đặc biệt quan trọng đối với các gói chụp Newborn hoặc bé nhỏ để chuẩn bị trang phục, quấn khăn vừa vặn'],
        concept: ['Ba mẹ đang quan tâm đến concept chụp nào dưới đây ạ?', 'Ba mẹ bấm vào concept để xem album ảnh mẫu']
      };
      const GENDER = ['Bé Trai 👦', 'Bé Gái 👧'];
      const KG_BIG = ['Dưới 12 kg', 'Từ 12kg - 15kg', 'Từ 15kg - 18kg', 'Trên 18 kg'];
      const LEAD_FLOW = {
        newborn: [['age', ['Dưới 1 tháng tuổi (Newborn)', 'Từ 1 - 3 tháng tuổi', 'Từ 3 - 6 tháng tuổi']], ['gender', GENDER],
          ['weight', ['Dưới 3 kg', 'Từ 3kg - 5kg', 'Từ 5kg - 8kg', 'Từ 8kg - 12kg']], ['concept']],
        'be-lon': [['age', ['Từ 1 - 2 tuổi', 'Từ 2 - 4 tuổi', 'Trên 4 tuổi']], ['gender', GENDER], ['weight', KG_BIG], ['concept']],
        'sinh-nhat': [['age', ['Thôi nôi (1 tuổi)', 'Từ 2 - 3 tuổi', 'Trên 3 tuổi']], ['gender', GENDER], ['weight', KG_BIG], ['concept']],
        bau: [['week', ['Dưới 28 tuần', 'Từ 28 - 34 tuần', 'Trên 34 tuần']], ['gender', [...GENDER, 'Chưa biết']], ['concept']],
        'gia-dinh': [['people', ['3 người', '4 - 5 người', 'Trên 5 người']], ['concept']]
      };
      const leadService = () => ((window.AlohaAlbums && window.AlohaAlbums.list) || []).find((s) => s.slug === leadDraft.service) || null;
      const nextLeadStep = () => {
        const flow = LEAD_FLOW[leadDraft.service] || [];
        const row = flow.find(([step]) => step === 'concept' || !leadDraft[step]);
        return row ? row[0] : null;
      };

      // Gõ tự do cũng được: leadPending = bước đang chờ, câu gõ đi thẳng vào handleLeadAnswer.
      const askLeadStep = (step) => {
        leadPending = step;
        const pick = (label) => { leadPending = null; addMsg(label, 'user'); handleLeadAnswer(step, label); };
        if (step === 'age0') { // chưa biết dịch vụ (khách ở trang chủ bấm "Tư vấn theo bé nhà mình")
          botSay(`${Q.age[0]}\n(${Q.age[1]})`, 500).then(() => {
            addQuickReplies(['Đang mang bầu', 'Dưới 1 tháng tuổi', 'Từ 1 - 6 tháng tuổi', 'Từ 1 - 3 tuổi', 'Trên 3 tuổi'], pick);
          });
          return;
        }
        if (step === 'concept') {
          const service = leadService();
          const concepts = service ? service.concepts : [];
          botSay(`${Q.concept[0]}\n(${Q.concept[1]})`, 450).then(() => {
            addQuickReplies(concepts.map((c) => c.name), (label) => {
              leadPending = null; addMsg(label, 'user'); finishLead(concepts.find((c) => c.name === label));
            });
          });
          return;
        }
        const row = (LEAD_FLOW[leadDraft.service] || []).find(([s]) => s === step);
        botSay(`${Q[step][0]}\n(${Q[step][1]})`, 450).then(() => addQuickReplies(row ? row[1] : [], pick));
      };
      const handleLeadAnswer = (step, value) => {
        const text = value.trim().slice(0, 60);
        if (step === 'age0') {
          const age = parseAge(value);
          if (!age) {
            botSay('Dạ em chưa rõ tuổi của bé ạ, ba mẹ cho em xin số tháng hoặc số tuổi (ví dụ "8 tháng", "3 tuổi") nhé.', 400).then(() => { leadPending = 'age0'; });
            return;
          }
          leadDraft.service = leadServiceSlug(age);
          if (!age.pregnant) leadDraft.age = text;
        } else if (step === 'concept') {
          // Khách gõ tên concept thay vì bấm nút: khớp theo tên hoặc từ khoá concept (CONCEPT_KEYWORDS).
          const service = leadService();
          const t = stripDiacritics(value);
          const kw = service && CONCEPT_KEYWORDS.find(([re, map]) => re.test(t) && map[service.slug]);
          const hit = service && (service.concepts.find((c) => stripDiacritics(c.name).includes(t) || t.includes(stripDiacritics(c.name)))
            || (kw && service.concepts.find((c) => c.slug === kw[1][service.slug])));
          if (!hit) { botSay('Dạ ba mẹ chọn giúp em 1 concept bên dưới để xem album nhé.', 400).then(() => askLeadStep('concept')); return; }
          finishLead(hit);
          return;
        } else {
          leadDraft[step] = step === 'gender' ? (parseGender(value) || text) : text;
        }
        const next = nextLeadStep();
        if (next) askLeadStep(next);
      };
      const finishLead = async (concept) => {
        const service = leadService();
        if (!service || !concept) return;
        leadInfo = { service: service.name, age: leadDraft.age || leadDraft.week || '', gender: leadDraft.gender || '', weight: leadDraft.weight || '',
          people: leadDraft.people || '', conceptObj: concept, conceptLabel: concept.name };
        if (window.AlohaJourney) {
          window.AlohaJourney.add('lead', { service: service.slug, age: leadDraft.age || (leadDraft.week ? 'Thai ' + leadDraft.week : ''),
            gender: leadDraft.gender, weight: leadDraft.weight || (leadDraft.people ? 'Chụp ' + leadDraft.people : ''), concept: concept.name });
        }
        openAlbum(concept.href);
        await botSay('Cảm ơn ba mẹ đã cung cấp thông tin, ba mẹ hãy tham khảo album ạ.', 450);
        addQuickReplies(['Chat với Sale'], () => enterSale(service.slug));
      };
      // Vào album 1 dịch vụ (lời chào theo trang) -> hỏi tiếp câu còn thiếu của dịch vụ đó.
      startServiceIntake = (slug) => {
        if (!LEAD_FLOW[slug]) return;
        leadDraft.service = slug;
        askLeadStep(nextLeadStep());
      };
      // Nút "Tư vấn theo bé nhà mình" / khách tự gõ tuổi bé.
      startLeadIntake = (age) => {
        const cur = pageService();
        if (age) {
          const fits = cur && LEAD_FLOW[cur.slug] && (cur.slug === 'bau') === !!age.pregnant && !(cur.slug === 'newborn' && age.months > 6);
          const slug = fits ? cur.slug : leadServiceSlug(age);
          leadDraft.service = slug;
          if (!age.pregnant) leadDraft.age = age.label;
          if (!fits) {
            const svc = leadService();
            botSay(`Dạ ${age.pregnant ? 'mẹ bầu' : 'bé ' + age.label} thì hợp với dịch vụ Chụp ảnh ${svc ? svc.name : ''} ạ.`, 400).then(() => askLeadStep(nextLeadStep()));
            return;
          }
          askLeadStep(nextLeadStep());
          return;
        }
        if (cur && LEAD_FLOW[cur.slug]) { startServiceIntake(cur.slug); return; }
        askLeadStep('age0');
      };

      const PRICE_RE = /\bgia\b(?! dinh)|bao nhieu|chi phi|bang gia|bao gia|bao tien/;
      const LOCAL_FAQ_RULES = [
        [/o dau|dia chi|hotline|so dien thoai|\bsdt\b|lien he/, FAQ['Studio ở đâu?']],
        [/\bcoc\b/, FAQ['Đặt cọc thế nào?']],
        [/tai nha/, FAQ['Có chụp tại nhà không?']],
        [/doi lich|doi ngay|doi hen|huy lich|hoan lich/, FAQ['Có đổi được lịch hẹn đã đặt không?']],
        [/anh goc|chinh sua|chon anh|sua anh|hau ky/, FAQ['Ảnh gốc và ảnh đã chỉnh sửa khác nhau thế nào?']],
        [/concept|phong cach/, FAQ['Chưa biết chọn concept nào thì sao?']],
        [/quy trinh|dat lich|dat hen|cac buoc/, 'Dạ đặt lịch bên em gồm 5 bước ạ: chọn dịch vụ & gói, chọn concept (chưa chắc thì em tư vấn), chọn ngày & khung giờ còn trống, gửi thông tin của bé & xác nhận, rồi đặt cọc để giữ lịch. Nhà mình định chụp dịch vụ nào ạ?'],
        [/dich vu|may loai|chup gi/, FAQ['Có mấy loại dịch vụ?']]
      ];
      const localAnswer = (raw) => {
        const t = stripDiacritics(raw);
        const conceptKey = detectConcept(raw);
        const hit = conceptKey && conceptOfAction(conceptKey);
        if (hit && hit.concept) {
          return {
            text: `${LOCAL_NOTE}concept "${hit.concept.name}" bên em thuộc dịch vụ ${hit.service.name} ạ: ${hit.concept.desc} Album có ${hit.concept.count} ảnh mẫu, anh/chị bấm nút bên dưới xem nhé.`,
            suggestions: [
              { label: CHAT_ACTIONS[conceptKey].cta, action: conceptKey },
              { label: CHAT_ACTIONS['dat-lich'].cta, action: 'dat-lich' },
              { label: 'Đặt cọc thế nào?', action: 'none' }
            ]
          };
        }
        const service = SERVICE_KEYWORDS.find(([, re]) => re.test(t));
        if (service) {
          const info = SERVICE_INFO[service[0]];
          const album = albumOf(service[0]);
          const concepts = album ? album.concepts.map((c) => c.name) : info.concepts;
          return {
            text: `${LOCAL_NOTE}dịch vụ ${service[0]} bên em có ${concepts.length} concept: ${concepts.join(', ')} ạ. ${info.note}\n${info.packageNote} Giá tham khảo ${info.price} (giá minh hoạ, bên em báo giá chính xác theo gói nhà mình chọn). Bé nhà mình năm nay mấy tuổi rồi ạ?`,
            suggestions: album && CHAT_ACTIONS['album-' + album.slug]
              ? [{ label: CHAT_ACTIONS['album-' + album.slug].cta, action: 'album-' + album.slug }, FALLBACK_SUGGESTIONS[0], FALLBACK_SUGGESTIONS[2]]
              : FALLBACK_SUGGESTIONS
          };
        }
        if (PRICE_RE.test(t)) {
          const list = Object.entries(SERVICE_INFO).map(([name, info]) => `• ${name}: ${info.price}`).join('\n');
          return { text: `${LOCAL_NOTE}em gửi anh/chị giá tham khảo 5 dịch vụ ạ (giá minh hoạ, bên em báo giá chính xác theo gói nhà mình chọn):\n${list}\nNhà mình đang quan tâm dịch vụ nào ạ?`, suggestions: FALLBACK_SUGGESTIONS };
        }
        const rule = LOCAL_FAQ_RULES.find(([re]) => re.test(t));
        if (rule) return { text: rule[1], suggestions: FALLBACK_SUGGESTIONS };
        return {
          text: 'Dạ câu này em muốn tư vấn kỹ hơn cho anh/chị ạ. Anh/chị bấm "Chat để tư vấn thêm" để bạn Sale trao đổi trực tiếp với mình, hoặc gọi hotline 0938.125.222 là bên em hỗ trợ ngay nhé.',
          suggestions: [
            { label: CHAT_ACTIONS['dat-lich'].cta, action: 'dat-lich' },
            { label: 'Studio ở đâu?', action: 'none' },
            { label: 'Đặt cọc thế nào?', action: 'none' }
          ]
        };
      };

      const answerLocally = (text) => {
        const ans = localAnswer(text);
        addMsg(ans.text, 'bot');
        aiHistory.push({ role: 'assistant', content: ans.text });
        return ans.suggestions;
      };

      // "Khách bảo gì làm nấy" (người dùng chốt 2026-09-29, thay quy tắc cũ "chỉ chuyển khi khách bấm
      // nút gợi ý"): AI trả thêm "do" khi tin nhắn là một yêu cầu làm ngay (server/server.js) ->
      // chuyển sang Sale / mở trang luôn. AI lỗi thì nhận diện lệnh rõ ràng bằng từ khoá (detectLocalDo).
      const SALE_INTENT = /\bsale\b|tu van vien|nhan vien|nguoi that|gap nguoi|noi chuyen (voi|truc tiep)|nhan (tin )?(truc tiep|cho shop|cho studio)|chat (voi )?(nguoi|nhan vien|truc tiep)|goi lai cho|de lai so|giam gia|chiet khau|mac ca|combo rieng|thiet ke rieng|concept rieng|doc quyen|khieu nai|phan nan/;
      const detectLocalDo = (raw) => {
        const t = stripDiacritics(raw);
        if (SALE_INTENT.test(t)) return 'sale';
        return detectLocalAction(raw);
      };
      const doNow = (name) => {
        if (!name || name === 'none') return;
        if (name === 'sale' || (name === 'dat-lich' && FEAT.booking === false)) {
          setTimeout(() => { if (!saleMode) enterSale(pageContext().service ? pageContext().service.slug : ''); }, 700);
          return;
        }
        runChatAction(name);
      };

      const sendToAI = async (text) => {
        if (!text || aiBusy) return;
        chatBody.querySelectorAll('.chat-quick').forEach((el) => el.remove());
        addMsg(text, 'user');
        aiHistory.push({ role: 'user', content: text });

        aiBusy = true;
        sendBtn.disabled = true;
        const typing = addTyping();
        let next = FALLBACK_SUGGESTIONS;
        let local = true;

        try {
          // 90 giây: đủ cho Render free "thức dậy" (30-60s) + server thử model dự phòng.
          const res = await fetch(CHAT_API_URL, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ messages: aiHistory, bookingOff: FEAT.booking === false }),
            signal: AbortSignal.timeout(90000)
          });
          const data = await res.json();
          typing.remove();
          if (!res.ok || !data.reply) {
            next = answerLocally(text);
            doNow(detectLocalDo(text));
          } else {
            addMsg(data.reply, 'bot');
            aiHistory.push({ role: 'assistant', content: data.reply });
            doNow(data.do);
            const valid = Array.isArray(data.suggestions)
              ? data.suggestions.filter((s) => s && typeof s.label === 'string' && s.label)
              : [];
            if (valid.length) {
              next = valid;
              local = false;
            }
          }
        } catch (err) {
          typing.remove();
          next = answerLocally(text);
          doNow(detectLocalDo(text));
        } finally {
          aiBusy = false;
          sendBtn.disabled = false;
          suggestNext(withConceptButton(withIntentButton(next, text), text), local);
        }
      };

      askAI = sendToAI; // nút gợi ý dạng câu hỏi (id "ask") gửi thẳng cho trợ lý AI

      chatInputForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (saleMode) {
          // Khách gõ đòi quay lại trợ lý AI -> quay lại luôn, không gửi câu đó cho Sale.
          if (text && /^(quay lai |ve |gap |hoi |chat voi |noi chuyen voi )?(tro ly( ai)?|\bai\b|bot|chatbot)( di| nhe| a)?$/.test(stripDiacritics(text).trim())) {
            chatInput.value = '';
            leaveSale();
            return;
          }
          if (!text || chatInput.disabled || !window.AlohaSaleChat) return;
          chatInput.value = '';
          if (chatSendBtn) chatSendBtn.disabled = true;
          window.AlohaSaleChat.send(text);
          return;
        }
        if (leadPending) {
          // Đang chờ khách gõ tự do trả lời 1 bước của luồng "Tư vấn theo bé nhà mình"
          // (tuổi/cân nặng/lưu ý/concept) -> xử lý ở đó, không gửi câu này cho Gemini.
          if (!text) return;
          chatInput.value = '';
          addMsg(text, 'user');
          const step = leadPending;
          leadPending = null;
          chatBody.querySelectorAll('.chat-quick').forEach((el) => el.remove());
          handleLeadAnswer(step, text);
          return;
        }
        // Khách tự kể tuổi bé ("con tôi năm nay 3 tuổi", "bé 8 tháng", "bầu dự sinh tháng 12") -> vào
        // luồng hỏi thông tin bé ngay (bỏ qua câu hỏi tuổi), không gửi cho AI. Câu hỏi giá / hỏi về 1
        // concept cụ thể ("bé sơ sinh chụp đen trắng được không") vẫn để AI trả lời như cũ.
        const kidAge = text && parseAge(text);
        const plain = stripDiacritics(text);
        if (kidAge && !PRICE_RE.test(plain) && !detectConcept(text)
          && /\d+(?:[.,]5)?\s*(tuoi|thang|ngay|tuan)|moi sinh|thoi noi|du sinh|tuan thai|\b(mot|hai|ba|bon|nam|sau|bay|tam|chin|muoi)\s+(tuoi|thang)/.test(plain)) {
          chatInput.value = '';
          chatBody.querySelectorAll('.chat-quick').forEach((el) => el.remove());
          addMsg(text, 'user');
          startLeadIntake(kidAge);
          return;
        }
        if (!text || aiBusy) return;
        chatInput.value = '';
        sendToAI(text);
      });
    }
  }
});
