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
    const SALE_LABEL = 'Nhắn trực tiếp với Sale';
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
        C('tu-van', 'Tư vấn dịch vụ & báo giá', askService, 'chọn 1 trong 5 dịch vụ để nghe concept và giá tham khảo'),
        C('concept', 'Concept & ảnh mẫu', askConceptService, 'xem concept và album ảnh mẫu theo dịch vụ'),
        s && C('bao-gia', `Báo giá ${s.name}`, () => showServiceAdvice(s.name), `giá tham khảo dịch vụ ${s.name} khách đang xem`),
        C('quy-trinh', 'Quy trình đặt lịch', explainProcess, 'các bước từ đặt lịch tới nhận ảnh'),
        C('faq', 'Câu hỏi thường gặp', askFaq, 'địa chỉ, đặt cọc, chụp tại nhà, đổi lịch...'),
        saleCand()
      ]);
    };

    const explainProcess = async () => {
      await botSay('Quy trình đặt lịch tại ALOHA Baby gồm 5 bước:\n1. Chọn dịch vụ & gói\n2. Chọn concept mình thích, hoặc để studio tư vấn nếu chưa chắc\n3. Chọn ngày & khung giờ còn trống (cập nhật theo thời gian thực, không lo trùng lịch với khách khác)\n4. Nhập thông tin của bé & xác nhận\n5. Đặt cọc để giữ lịch chính thức');
      await botSay('Sau khi đặt cọc, Sales sẽ gọi xác nhận lại thông tin, studio sắp xếp ekip và phòng chụp phù hợp, và bạn sẽ được nhắc lịch trước buổi chụp.', 500);
      await botSay('Sau buổi chụp, bạn chọn ảnh ưng ý trong mục "Ảnh của tôi", có thể ghi chú chỉnh sửa riêng cho từng ảnh (ví dụ làm sáng da, xoá vết đỏ...), đội ngũ hậu kỳ xử lý rồi bàn giao ảnh hoàn thiện.', 500);
      askWhatNext();
    };

    const FAQ = {
      'Studio ở đâu?': 'ALOHA Baby ở 35 Lê Văn Thiêm, Thanh Xuân, Hà Nội. Hotline 0938.125.222.',
      'Có mấy loại dịch vụ?': 'ALOHA Baby có 5 dịch vụ chính: Bé lớn, Sinh nhật, Bầu, Gia đình, Newborn. Bạn muốn nghe tư vấn concept & giá tham khảo của dịch vụ nào không?',
      'Đặt cọc thế nào?': 'Sau khi chọn dịch vụ, concept, ngày giờ và điền thông tin của bé, bạn sẽ đặt cọc để giữ lịch chính thức. Mức cọc cụ thể Sales sẽ báo khi bạn đặt lịch, mình chưa có số liệu chính xác ở đây.',
      'Có chụp tại nhà không?': 'Có nhé. Ngoài 5 dịch vụ chính chụp tại studio, ALOHA Baby còn nhận chụp tại nhà cho gia đình muốn không gian quen thuộc, riêng tư hơn. Bạn xem chi tiết ở cuối phần "Dịch vụ" trên trang hoặc để Sales tư vấn thêm.',
      'Chưa biết chọn concept nào thì sao?': 'Không sao cả! Khi đặt lịch, bạn có thể chọn "Cần studio tư vấn" thay vì chọn concept cụ thể, đội ngũ sẽ gợi ý phong cách phù hợp với độ tuổi bé và không khí gia đình mình.',
      'Ảnh gốc và ảnh đã chỉnh sửa khác nhau thế nào?': 'Sau buổi chụp, bạn xem toàn bộ ảnh gốc trong mục "Ảnh của tôi", thả tim chọn những ảnh ưng ý (có thể ghi chú chỉnh sửa riêng từng ảnh) rồi gửi yêu cầu. Đội ngũ hậu kỳ sẽ chỉnh màu, làm đẹp da, ghép ảnh... rồi bàn giao lại ảnh đã hoàn thiện.',
      'Có đổi được lịch hẹn đã đặt không?': 'Có, ALOHA Baby hỗ trợ đổi lịch khi cần. Điều kiện cụ thể (còn kịp đổi miễn phí hay cần duyệt lại) tuỳ thời gian còn lại trước buổi chụp, bạn liên hệ Sales/CSKH qua hotline để được hỗ trợ đổi lịch nhanh nhất nhé.'
    };

    const askFaq = async () => {
      await botSay('Mình gợi ý 2 câu hay được hỏi nhất, bạn cũng có thể gõ câu hỏi khác ở khung dưới nhé.', 400);
      offer(Object.keys(FAQ).map((q, i) => C('faq-' + i, q, async () => { await botSay(FAQ[q]); askWhatNext(); }, 'câu hỏi thường gặp')));
    };

    // Dịch vụ khách đang xem (nếu có) đứng đầu danh sách.
    const servicesFirst = (names) => {
      const s = pageService();
      return s && names.includes(s.name) ? [s.name, ...names.filter((n) => n !== s.name)] : names;
    };
    const askService = () => {
      offer(servicesFirst(Object.keys(SERVICE_INFO)).map((service) =>
        C('svc-' + (slugOf(service) || service), service, () => showServiceAdvice(service), `concept + giá tham khảo dịch vụ ${service}`)));
    };

    const showServiceAdvice = async (service) => {
      const info = SERVICE_INFO[service];
      const concepts = albumConcepts(service).map((c) => c.name);
      addImageMsg(info.img, `Ảnh minh hoạ phong cách ${service} tại ALOHA Baby`, `Ảnh minh hoạ phong cách "${service}" (ảnh minh hoạ, chưa phải ảnh khách hàng thật).`);
      await botSay(`Với dịch vụ "${service}", ALOHA Baby có ${concepts.length || info.concepts.length} concept:\n• ${(concepts.length ? concepts : info.concepts).join('\n• ')}`);
      await botSay(info.note, 450);
      await botSay(`${info.packageNote}\nGiá tham khảo ${info.price} (giá minh họa, Sales sẽ báo giá chính xác theo gói bạn chọn).`, 450);
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
      await botSay('Bạn muốn xem concept của dịch vụ nào? Mỗi dịch vụ có nhiều concept, mỗi concept có album ảnh mẫu riêng.', 450);
      offer(servicesFirst(Object.keys(SERVICE_INFO).filter((s) => albumConcepts(s).length)).map((service) =>
        C('svc-' + slugOf(service), service, () => askConcept(service), `các concept dịch vụ ${service}`)));
    };

    const askConcept = async (service) => {
      const concepts = albumConcepts(service);
      const album = albumOf(service);
      await botSay(`Dịch vụ "${service}" có ${concepts.length} concept. Mình gợi ý bên dưới, bạn cũng có thể gõ tên concept muốn xem nhé.`, 450);
      offer([
        ...concepts.slice(0, 1).map((c) => C('c-' + c.slug, c.name, () => showConcept(service, c), c.desc)),
        album && C('tat-ca', `Xem cả ${concepts.length} concept`, async () => { await botSay(`Mình mở album ${service} cho bạn nhé.`, 350); openAlbum(album.href); }, 'mở trang album có đủ mọi concept của dịch vụ'),
        ...concepts.slice(1).map((c) => C('c-' + c.slug, c.name, () => showConcept(service, c), c.desc)),
        C('dv-khac', 'Dịch vụ khác', askConceptService, 'xem concept dịch vụ khác')
      ]);
    };

    const showConcept = async (service, concept) => {
      addImageMsg(concept.cover, `Ảnh mẫu concept ${concept.name}`, `${service} · ${concept.name} (ảnh minh hoạ, chưa phải ảnh khách hàng thật).`);
      await botSay(concept.desc, 500);
      await botSay(`Album "${concept.name}" có ${concept.count} ảnh mẫu. Khi đặt lịch, bạn chọn concept này ở bước chọn concept, hoặc để studio tư vấn thêm nhé.`, 450);
      offer([
        C('xem-album', 'Xem album concept này', () => {
          botSay(`Mình mở album "${concept.name}" cho bạn nhé.`, 350).then(() => { openAlbum(concept.href); askConcept(service); });
        }, 'mở album ảnh mẫu của concept'),
        C('dat-lich', FEAT.booking === false ? 'Giữ lịch concept này' : 'Đặt lịch concept này', () => confirmBooking(`${service} · ${concept.name}`), 'khách muốn chụp concept này'),
        C('concept-khac', 'Concept khác', () => askConcept(service), 'xem concept khác cùng dịch vụ'),
        C('menu', 'Về menu chính', askMainMenu, 'các chủ đề tư vấn khác')
      ]);
    };

    const confirmBooking = async (service) => {
      // Đặt lịch online đang tạm tắt (js/features.js) -> chuyển khách sang Sale để chốt lịch.
      if (FEAT.booking === false) {
        await botSay(`Tuyệt vời! Hiện studio giữ lịch qua tư vấn viên, mình chuyển bạn sang Sale để chốt lịch chụp "${service}" nhé.`, 500);
        callSale(slugOf(String(service).split(' · ')[0]));
        return;
      }
      await botSay(`Tuyệt vời! Mình chuyển bạn sang bước đặt lịch cho dịch vụ "${service}" nhé.`, 500);
      setTimeout(() => {
        window.location.hash = '/dat-lich';
      }, 700);
    };

    // ------------------------------------------------ Lời chào theo trang đang xem (2026-09-28)
    // Trang chủ / trang khác: chào chung. Album 1 dịch vụ: chào theo dịch vụ đó. Album 1 concept:
    // chào theo concept. Khách CHƯA bấm/gõ gì thì lời chào được thay hẳn khi đổi trang; đã trò
    // chuyện rồi thì chỉ nói thêm 1 lượt khi khách sang dịch vụ khác (không xoá cuộc trò chuyện).
    const SERVICE_GREET = {
      'bau': 'Mẹ bầu đang ở tuần thai thứ mấy rồi ạ? Mình gợi ý concept, báo giá tham khảo và thời điểm chụp đẹp cho mẹ nhé.',
      'newborn': 'Bé nhà mình đã chào đời chưa, hay ba mẹ đang chuẩn bị trước ạ? Mình tư vấn thời điểm chụp newborn đẹp nhất, concept và giá tham khảo nhé.',
      'be-lon': 'Bé nhà mình năm nay mấy tuổi rồi ạ? Mình gợi ý concept hợp với bé và báo giá tham khảo nhé.',
      'sinh-nhat': 'Bé sắp đến sinh nhật hay thôi nôi phải không ạ? Mình gợi ý concept trang trí và báo giá tham khảo nhé.',
      'gia-dinh': 'Gia đình mình định chụp mấy người ạ? Mình gợi ý concept cho cả nhà và báo giá tham khảo nhé.'
    };
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
          lines: [`Bạn đang xem concept "${ctx.concept.name}" của dịch vụ ${ctx.service.name} 📸`,
            'Bạn muốn mình tư vấn thêm về concept này, báo giá tham khảo hay nhắn Sale để giữ lịch chụp ạ?'],
          teaser: `Bạn thích concept "${ctx.concept.name}"? Mình tư vấn ngay nhé!`
        };
      }
      if (ctx.service) {
        return {
          lines: [`Chào bạn! Bạn đang xem album ${ctx.service.name} 📸`, SERVICE_GREET[ctx.service.slug] || 'Bạn cần mình tư vấn concept hay báo giá tham khảo ạ?'],
          teaser: `Bạn đang xem album ${ctx.service.name} 📸 Mình tư vấn concept, báo giá cho bạn nhé?`
        };
      }
      return {
        lines: ['Chào bạn! Mình là trợ lý ALOHA Baby 👋', 'Bạn đang cần tư vấn gì ạ? Chọn nhanh bên dưới hoặc gõ câu hỏi bất kỳ ở khung dưới cùng nhé.'],
        teaser: 'Chào bạn 👋 Bạn cần ALOHA Baby tư vấn gì ạ?'
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
        C('luu-y', 'Lưu ý khi chụp', async () => { await botSay(info ? info.note : 'Sale sẽ tư vấn chi tiết cho gia đình mình nhé.'); askWhatNext(); }, info ? info.note : ''),
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
      if (token === greetToken) repliesFor(ctx);
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

    // Khách chưa đăng nhập bấm vào chatbot -> sang đăng nhập (người dùng chốt 2026-09-28, giữ như
    // trước), đăng nhập xong quay lại đúng trang đang xem và mở tiếp khung chat.
    const loginNext = () => {
      const h = window.location.hash;
      if (/^#\/(album\/[a-z-]+(\/[a-z0-9-]+)?|noi-dung\/[a-z0-9-]+)$/.test(h)) return h.slice(2);
      return 'home';
    };
    const goLoginForChat = (sale, topic) => {
      writeUi(Object.assign({ openAfterLogin: true, dismissed: false }, sale ? { pendingSale: topic || '' } : {}));
      goToLogin(loginNext());
    };

    // Chưa đăng nhập: khung chat (tự mở / bong bóng) vẫn hiện lời chào, nhưng bấm vào bất cứ
    // nút, ô nhập nào trong khung là sang trang đăng nhập (trừ nút đóng và nút gọi hotline).
    chatPanel.addEventListener('click', (e) => {
      if (isCustomerLoggedIn()) return;
      const hit = e.target.closest('button, input, a');
      if (!hit || hit.id === 'chatClose' || /^tel:/.test(hit.getAttribute('href') || '')) return;
      e.preventDefault();
      e.stopPropagation();
      goLoginForChat(hit.id === 'chatToSale');
    }, true);

    chatToggle.addEventListener('click', () => {
      if (!isCustomerLoggedIn()) { goLoginForChat(false); return; }
      if (chatPanel.classList.contains('open')) closeChat(); else openChat();
    });
    chatClose.addEventListener('click', closeChat);
    if (teaserText) teaserText.addEventListener('click', () => { if (!isCustomerLoggedIn()) goLoginForChat(false); else openChat(); });
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
    if (conceptChatBtn) {
      conceptChatBtn.addEventListener('click', () => {
        if (!isCustomerLoggedIn()) { goLoginForChat(false); return; }
        openChat();
      });
    }

    // "Báo giá"/"Khuyến mại" (menu) và "Trở thành đối tác"/"Hỗ trợ" (topbar)
    // chưa có trang đích riêng (xem .claude/CLAUDE.md mục việc cần làm) -> thay
    // vì để link chết (href="#" không làm gì), mở khung chat tư vấn thật để
    // khách hỏi trực tiếp, tránh bấm vào "cho vui" không ra kết quả gì.
    ['topbarPartner', 'topbarSupport', 'navPricing', 'navPromo'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('click', (e) => {
        e.preventDefault();
        if (!isCustomerLoggedIn()) { goLoginForChat(false); return; }
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
      if (chatTitle) chatTitle.textContent = on ? 'Tư vấn viên ALOHA Baby' : 'Trợ lý ALOHA';
      if (chatSubtitle) chatSubtitle.textContent = on ? 'Đang chat với Sale' : 'Trợ lý tư vấn';
      // Nút ở đầu khung: chữ ngắn cho vừa hàng, tên đầy đủ để ở title/aria-label.
      if (chatToSaleText) chatToSaleText.textContent = on ? 'Trợ lý AI' : 'Nhắn Sale';
      if (chatToSale) {
        chatToSale.title = on ? 'Quay lại trợ lý AI' : 'Chat trực tiếp với tư vấn viên';
        chatToSale.setAttribute('aria-label', on ? 'Quay lại trợ lý AI' : 'Nhắn Sale');
      }
      if (chatInput) chatInput.placeholder = on ? 'Nhập tin nhắn cho Sale...' : 'Nhập câu hỏi cho trợ lý...';
      if (!on) {
        if (chatInput) chatInput.disabled = false;
        if (chatSendBtn) chatSendBtn.disabled = false;
        if (chatSaleStatus) chatSaleStatus.hidden = true;
      }
    };

    function enterSale(topic) {
      if (!isCustomerLoggedIn()) { goLoginForChat(true, topic); return; }
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
      addDivider('Bạn đang chat trực tiếp với Sale ALOHA Baby. Để tư vấn nhanh hơn, Sale sẽ xem tóm tắt những mục bạn đã xem và đã hỏi trợ lý AI.');
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
      addDivider('Đã quay lại trợ lý AI. Tin nhắn với Sale vẫn được lưu, bấm "Nhắn Sale" để chat tiếp.');
      askMainMenu();
    };
    if (chatToSale) chatToSale.addEventListener('click', () => { if (saleMode) leaveSale(); else enterSale(''); });
    // Ô nhập của khung chatbot khi đang chat với Sale: nút gửi chỉ sáng khi đã gõ chữ.
    if (chatInput && chatSendBtn) chatInput.addEventListener('input', () => { if (saleMode) chatSendBtn.disabled = chatInput.disabled || !chatInput.value.trim(); });

    // js/sale-chat.js (link #/chat-sale, route #/chat-sale sau khi đăng nhập) mở chat Sale qua đây.
    window.AlohaChatbot = { openSale: (topic) => enterSale(String(topic || '').split('/')[0]), open: openChat, backToAi: leaveSale };

    // Vừa đăng nhập xong từ khung chat -> mở tiếp (có thể vào thẳng chat Sale); không thì tự mở /
    // hiện bong bóng theo trang đang xem.
    setTimeout(() => {
      const ui = readUi();
      if (ui.openAfterLogin && isCustomerLoggedIn()) {
        const pendingSale = ui.pendingSale;
        writeUi({ openAfterLogin: false, pendingSale: undefined });
        if (pendingSale !== undefined) enterSale(pendingSale); else openChat();
        return;
      }
      refreshChatForPage();
    }, 0);

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
            await botSay(`Mình đưa bạn tới ${action.label} ngay nhé.`, 400);
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
      const LOCAL_NOTE = 'Trợ lý AI đang bận nên mình trả lời nhanh theo thông tin có sẵn nhé:\n';
      const SERVICE_KEYWORDS = [
        ['Newborn', /newborn|so sinh/],
        ['Bầu', /\bbau\b|mang thai|mang bau/],
        ['Sinh nhật', /sinh nhat|thoi noi/],
        ['Gia đình', /gia dinh/],
        ['Bé lớn', /be lon/]
      ];
      const PRICE_RE = /\bgia\b(?! dinh)|bao nhieu|chi phi|bang gia|bao gia|bao tien/;
      const LOCAL_FAQ_RULES = [
        [/o dau|dia chi|hotline|so dien thoai|\bsdt\b|lien he/, FAQ['Studio ở đâu?']],
        [/\bcoc\b/, FAQ['Đặt cọc thế nào?']],
        [/tai nha/, FAQ['Có chụp tại nhà không?']],
        [/doi lich|doi ngay|doi hen|huy lich|hoan lich/, FAQ['Có đổi được lịch hẹn đã đặt không?']],
        [/anh goc|chinh sua|chon anh|sua anh|hau ky/, FAQ['Ảnh gốc và ảnh đã chỉnh sửa khác nhau thế nào?']],
        [/concept|phong cach/, FAQ['Chưa biết chọn concept nào thì sao?']],
        [/quy trinh|dat lich|dat hen|cac buoc/, 'Đặt lịch tại ALOHA Baby gồm 5 bước: chọn dịch vụ & gói, chọn concept (hoặc để studio tư vấn), chọn ngày & khung giờ còn trống, nhập thông tin của bé & xác nhận, rồi đặt cọc để giữ lịch.'],
        [/dich vu|may loai|chup gi/, FAQ['Có mấy loại dịch vụ?']]
      ];
      const localAnswer = (raw) => {
        const t = stripDiacritics(raw);
        const conceptKey = detectConcept(raw);
        const hit = conceptKey && conceptOfAction(conceptKey);
        if (hit && hit.concept) {
          return {
            text: `${LOCAL_NOTE}Concept "${hit.concept.name}" (dịch vụ ${hit.service.name}): ${hit.concept.desc} Album có ${hit.concept.count} ảnh mẫu, bạn bấm nút bên dưới để xem nhé.`,
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
            text: `${LOCAL_NOTE}Dịch vụ "${service[0]}" có ${concepts.length} concept: ${concepts.join(', ')}. ${info.note}\n${info.packageNote} Giá tham khảo ${info.price} (giá minh họa, Sales sẽ báo giá chính xác theo gói bạn chọn).`,
            suggestions: album && CHAT_ACTIONS['album-' + album.slug]
              ? [{ label: CHAT_ACTIONS['album-' + album.slug].cta, action: 'album-' + album.slug }, FALLBACK_SUGGESTIONS[0], FALLBACK_SUGGESTIONS[2]]
              : FALLBACK_SUGGESTIONS
          };
        }
        if (PRICE_RE.test(t)) {
          const list = Object.entries(SERVICE_INFO).map(([name, info]) => `• ${name}: ${info.price}`).join('\n');
          return { text: `${LOCAL_NOTE}Giá tham khảo 5 dịch vụ (giá minh họa, Sales sẽ báo giá chính xác theo gói bạn chọn):\n${list}`, suggestions: FALLBACK_SUGGESTIONS };
        }
        const rule = LOCAL_FAQ_RULES.find(([re]) => re.test(t));
        if (rule) return { text: LOCAL_NOTE + rule[1], suggestions: FALLBACK_SUGGESTIONS };
        return {
          text: 'Trợ lý AI đang bận nên mình chưa trả lời chi tiết câu này được. Bạn chọn một câu hỏi thường gặp bên dưới, hoặc gọi hotline 0938.125.222 để Sales hỗ trợ ngay nhé.',
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
      const SALE_INTENT = /\bsale\b|tu van vien|nhan vien|nguoi that|gap nguoi|noi chuyen (voi|truc tiep)|nhan (tin )?(truc tiep|cho shop|cho studio)|chat (voi )?(nguoi|nhan vien|truc tiep)|goi lai cho|de lai so/;
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
        if (!text || aiBusy) return;
        chatInput.value = '';
        sendToAI(text);
      });
    }
  }
});
