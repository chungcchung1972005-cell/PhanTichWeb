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
    { label: 'Chụp ảnh Bé lớn', sub: 'Dịch vụ', section: 'dich-vu', match: 'Bé lớn' },
    { label: 'Chụp ảnh Sinh nhật', sub: 'Dịch vụ', section: 'dich-vu', match: 'Sinh nhật' },
    { label: 'Chụp ảnh Bầu', sub: 'Dịch vụ', section: 'dich-vu', match: 'Bầu' },
    { label: 'Chụp ảnh Gia đình', sub: 'Dịch vụ', section: 'dich-vu', match: 'Gia đình' },
    { label: 'Chụp ảnh Newborn', sub: 'Dịch vụ', section: 'dich-vu', match: 'Newborn' },
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
    const items = q ? SEARCH_INDEX.filter((it) => stripDiacritics(it.label).includes(q)) : SEARCH_INDEX;
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

  if (chatToggle && chatPanel && chatClose && chatBody) {
    // Giá/concept/số ảnh gói dưới đây là MINH HỌA (số ảnh gói dùng lại đúng
    // giá trị mặc định trong js/chon-anh.js để nhất quán trong toàn demo) —
    // mức cọc, chính sách chi tiết là cấu hình chưa xác định (xem
    // tech-defaults.md), Sales sẽ báo giá/chính sách chính xác.
    const SERVICE_INFO = {
      'Bé lớn': {
        img: 'images/service-be-lon.jpg',
        concepts: ['Ngoại cảnh công viên, phố cổ', 'Phong cách Hàn Quốc tối giản', 'Vintage cổ điển trong studio'],
        note: 'Phù hợp bé khoảng 2-10 tuổi, có thể chụp thêm cùng bố mẹ trong buổi.',
        packageNote: 'Gói tham khảo khoảng 15 ảnh gốc được chỉnh sửa, chọn thêm ngoài gói sẽ tính phí theo ảnh.',
        price: 'từ 1.500.000đ'
      },
      'Sinh nhật': {
        img: 'images/service-sinh-nhat.jpg',
        concepts: ['Sinh nhật rực rỡ, nhiều bóng bay', 'Theo mùa/lễ hội (Noel, Trung thu...)', 'Tông pastel nhẹ nhàng'],
        note: 'Có thể kết hợp bánh kem, backdrop theo yêu cầu, phù hợp mốc thôi nôi/sinh nhật.',
        packageNote: 'Gói tham khảo khoảng 15 ảnh gốc được chỉnh sửa, chọn thêm ngoài gói sẽ tính phí theo ảnh.',
        price: 'từ 1.800.000đ'
      },
      'Bầu': {
        img: 'images/service-bau.jpg',
        concepts: ['Vintage nhẹ nhàng trong studio', 'Ngoại cảnh thiên nhiên', 'Tối giản, tôn dáng mẹ bầu'],
        note: 'Nhiều mẹ chọn chụp khi thai khoảng 32-36 tuần để dáng bụng tròn đẹp mà vẫn thoải mái di chuyển, mình gợi ý chung vậy thôi nhé, còn tuỳ sức khoẻ mỗi mẹ.',
        packageNote: 'Gói tham khảo khoảng 15 ảnh gốc được chỉnh sửa, chọn thêm ngoài gói sẽ tính phí theo ảnh.',
        price: 'từ 2.000.000đ'
      },
      'Gia đình': {
        img: 'images/service-gia-dinh.jpg',
        concepts: ['Ngoại cảnh công viên, biển', 'Vintage ấm áp trong studio', 'Đồng phục tông màu theo gia đình'],
        note: 'Không giới hạn số thành viên trong ảnh, có thể chụp nhiều thế hệ trong cùng buổi.',
        packageNote: 'Gói tham khảo khoảng 15 ảnh gốc được chỉnh sửa, chọn thêm ngoài gói sẽ tính phí theo ảnh.',
        price: 'từ 2.500.000đ'
      },
      'Newborn': {
        img: 'images/service-newborn.jpg',
        concepts: ['Newborn tự nhiên (organic) tại studio', 'Cuộn ủ (wrap) cổ điển', 'Có bố mẹ/anh chị cùng khung hình'],
        note: 'Nhiều gia đình chọn chụp khi bé khoảng 5-14 ngày tuổi vì bé ngủ sâu, dễ tạo dáng hơn — studio giữ ấm phòng chụp phù hợp cho bé.',
        packageNote: 'Gói tham khảo khoảng 15 ảnh gốc được chỉnh sửa, chọn thêm ngoài gói sẽ tính phí theo ảnh.',
        price: 'từ 2.200.000đ'
      }
    };

    let chatStarted = false;

    const addMsg = (text, who) => {
      const div = document.createElement('div');
      div.className = 'chat-msg ' + who;
      div.textContent = text;
      chatBody.appendChild(div);
      chatBody.scrollTop = chatBody.scrollHeight;
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

    const callSale = () => { window.location.href = 'tel:0938125222'; };

    // Menu sau mỗi câu trả lời để cuộc trò chuyện có nhiều nhánh thay vì 1
    // đường thẳng: quay lại menu chính, hỏi thêm câu khác (gõ tự do), hoặc
    // gọi thẳng Sale.
    const askWhatNext = () => {
      addQuickReplies(['Về menu chính', 'Liên hệ Sale ngay'], (choice) => {
        addMsg(choice, 'user');
        if (choice === 'Liên hệ Sale ngay') { callSale(); return; }
        askMainMenu();
      });
    };

    const askMainMenu = () => {
      addQuickReplies(['Tư vấn dịch vụ & báo giá', 'Concept & ảnh mẫu', 'Quy trình đặt lịch', 'Câu hỏi thường gặp', 'Liên hệ Sale ngay'], (choice) => {
        addMsg(choice, 'user');
        if (choice === 'Tư vấn dịch vụ & báo giá') { askService(); return; }
        if (choice === 'Concept & ảnh mẫu') { askConceptService(); return; }
        if (choice === 'Quy trình đặt lịch') { explainProcess(); return; }
        if (choice === 'Câu hỏi thường gặp') { askFaq(); return; }
        callSale();
      });
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

    const askFaq = () => {
      addQuickReplies(Object.keys(FAQ), async (q) => {
        addMsg(q, 'user');
        await botSay(FAQ[q]);
        askWhatNext();
      });
    };

    const askService = () => {
      addQuickReplies(Object.keys(SERVICE_INFO), (service) => {
        addMsg(service, 'user');
        showServiceAdvice(service);
      });
    };

    const showServiceAdvice = async (service) => {
      const info = SERVICE_INFO[service];
      const concepts = albumConcepts(service).map((c) => c.name);
      addImageMsg(info.img, `Ảnh minh hoạ phong cách ${service} tại ALOHA Baby`, `Ảnh minh hoạ phong cách "${service}" (ảnh minh hoạ, chưa phải ảnh khách hàng thật).`);
      await botSay(`Với dịch vụ "${service}", ALOHA Baby có ${concepts.length || info.concepts.length} concept:\n• ${(concepts.length ? concepts : info.concepts).join('\n• ')}`);
      await botSay(info.note, 450);
      await botSay(`${info.packageNote}\nGiá tham khảo ${info.price} (giá minh họa, Sales sẽ báo giá chính xác theo gói bạn chọn).`, 450);
      const options = ['Chốt đơn - Đặt lịch ngay'];
      if (concepts.length) options.push('Xem concept & ảnh mẫu');
      options.push('Xem dịch vụ khác', 'Liên hệ Sale ngay');
      addQuickReplies(options, (choice) => {
        addMsg(choice, 'user');
        if (choice.startsWith('Chốt đơn')) {
          confirmBooking(service);
        } else if (choice === 'Xem concept & ảnh mẫu') {
          askConcept(service);
        } else if (choice === 'Xem dịch vụ khác') {
          askService();
        } else {
          callSale();
        }
      });
    };

    // ------------------------------------------------ Kịch bản concept & ảnh mẫu
    // Dữ liệu concept đọc từ js/albums.js (window.AlohaAlbums), cùng nguồn với
    // trang album: thêm/sửa concept ở đó là chatbot tự cập nhật theo.
    const albumOf = (service) => ((window.AlohaAlbums && window.AlohaAlbums.list) || []).find((s) => s.name === service) || null;
    const albumConcepts = (service) => { const a = albumOf(service); return a ? a.concepts : []; };
    // Mở trang album: trên điện thoại đóng khung chat để khách thấy ngay album.
    const openAlbum = (href) => {
      setTimeout(() => {
        window.location.hash = href.slice(1);
        if (window.innerWidth <= 720) chatPanel.classList.remove('open');
      }, 700);
    };

    const askConceptService = async () => {
      await botSay('Bạn muốn xem concept của dịch vụ nào? Mỗi dịch vụ có nhiều concept, mỗi concept có album ảnh mẫu riêng.', 450);
      addQuickReplies(Object.keys(SERVICE_INFO).filter((s) => albumConcepts(s).length), (service) => {
        addMsg(service, 'user');
        askConcept(service);
      });
    };

    const askConcept = async (service) => {
      const concepts = albumConcepts(service);
      await botSay(`Dịch vụ "${service}" có ${concepts.length} concept, bạn chọn một concept để xem nhé:`, 450);
      addQuickReplies([...concepts.map((c) => c.name), 'Dịch vụ khác'], (choice) => {
        addMsg(choice, 'user');
        if (choice === 'Dịch vụ khác') { askConceptService(); return; }
        showConcept(service, concepts.find((c) => c.name === choice));
      });
    };

    const showConcept = async (service, concept) => {
      addImageMsg(concept.cover, `Ảnh mẫu concept ${concept.name}`, `${service} · ${concept.name} (ảnh minh hoạ, chưa phải ảnh khách hàng thật).`);
      await botSay(concept.desc, 500);
      await botSay(`Album "${concept.name}" có ${concept.count} ảnh mẫu. Khi đặt lịch, bạn chọn concept này ở bước chọn concept, hoặc để studio tư vấn thêm nhé.`, 450);
      addQuickReplies(['Xem album concept này', 'Đặt lịch concept này', 'Concept khác', 'Về menu chính'], (choice) => {
        addMsg(choice, 'user');
        if (choice === 'Xem album concept này') {
          botSay(`Mình mở album "${concept.name}" cho bạn nhé.`, 350).then(() => { openAlbum(concept.href); askConcept(service); });
        } else if (choice === 'Đặt lịch concept này') {
          confirmBooking(`${service} · ${concept.name}`);
        } else if (choice === 'Concept khác') {
          askConcept(service);
        } else {
          askMainMenu();
        }
      });
    };

    const confirmBooking = async (service) => {
      await botSay(`Tuyệt vời! Mình chuyển bạn sang bước đặt lịch cho dịch vụ "${service}" nhé.`, 500);
      setTimeout(() => {
        window.location.hash = '/dat-lich';
      }, 700);
    };

    const startChat = async () => {
      if (chatStarted) return;
      chatStarted = true;
      await botSay('Chào bạn! Mình là trợ lý ALOHA Baby 👋');
      await botSay('Mình có thể giúp gì cho bạn? Bạn cũng có thể gõ câu hỏi bất kỳ ở khung bên dưới.', 450);
      askMainMenu();
    };

    const openChat = () => {
      chatPanel.classList.add('open');
      startChat();
    };

    // Mở chat tư vấn cũng là một tín hiệu quan tâm -> khách chưa đăng nhập
    // được đưa sang trang đăng nhập trước, đăng nhập xong mới chat được.
    chatToggle.addEventListener('click', () => {
      if (!isCustomerLoggedIn()) { goToLogin('dat-lich'); return; }
      const willOpen = !chatPanel.classList.contains('open');
      chatPanel.classList.toggle('open');
      if (willOpen) startChat();
    });
    chatClose.addEventListener('click', () => chatPanel.classList.remove('open'));

    // Nút "Tư vấn concept ngay" ở section Concept -> mở luôn khung chat tư vấn
    // thay vì dẫn tới link rỗng, khớp đúng flow concept -> tư vấn -> đặt lịch.
    const conceptChatBtn = document.getElementById('conceptChatBtn');
    if (conceptChatBtn) {
      conceptChatBtn.addEventListener('click', () => {
        if (!isCustomerLoggedIn()) { goToLogin('dat-lich'); return; }
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
        if (!isCustomerLoggedIn()) { goToLogin('dat-lich'); return; }
        openChat();
      });
    });

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
        const list = items.slice(0, 3);
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
      const runChatAction = (name) => {
        const action = CHAT_ACTIONS[name];
        if (!action) return;
        setTimeout(() => {
          action.go();
          if (window.innerWidth <= 720) chatPanel.classList.remove('open');
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
        return [{ label: CHAT_ACTIONS[name].cta, action: name }, ...list].slice(0, 3);
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
        return [{ label: CHAT_ACTIONS[key].cta, action: key }, ...list].slice(0, 3);
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
              { label: 'Đặt lịch chụp ngay', action: 'dat-lich' },
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
            { label: 'Đặt lịch chụp ngay', action: 'dat-lich' },
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
            body: JSON.stringify({ messages: aiHistory }),
            signal: AbortSignal.timeout(90000)
          });
          const data = await res.json();
          typing.remove();
          if (!res.ok || !data.reply) {
            next = answerLocally(text);
          } else {
            addMsg(data.reply, 'bot');
            aiHistory.push({ role: 'assistant', content: data.reply });
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
        } finally {
          aiBusy = false;
          sendBtn.disabled = false;
          suggestNext(withConceptButton(withIntentButton(next, text), text), local);
        }
      };

      chatInputForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (!text || aiBusy) return;
        chatInput.value = '';
        sendToAI(text);
      });
    }
  }
});
