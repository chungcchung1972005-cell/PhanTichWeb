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

  // Ảnh Album và Concept hiện chưa dẫn tới đâu -> click vào cũng là một tín hiệu
  // quan tâm, đưa khách chưa đăng nhập sang trang đăng nhập trước khi xem tiếp.
  // Album gắn với "Ảnh của tôi" (xem ảnh), Concept gắn với luồng Đặt lịch (chọn
  // concept rồi đặt lịch) -> đăng nhập xong quay lại đúng trang phù hợp.
  document.querySelectorAll('.album-card').forEach(el => {
    el.style.cursor = 'pointer';
    el.addEventListener('click', () => {
      if (!isCustomerLoggedIn()) { goToLogin('chon-anh'); return; }
      window.location.hash = '/chon-anh';
    });
  });
  document.querySelectorAll('.concept-tile').forEach(el => {
    el.style.cursor = 'pointer';
    el.addEventListener('click', () => {
      if (!isCustomerLoggedIn()) { goToLogin('dat-lich'); return; }
      window.location.hash = '/dat-lich';
    });
  });

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
    { label: 'Concept Biển', sub: 'Thư viện concept', section: 'concept', match: 'Biển' },
    { label: 'Concept Noel', sub: 'Thư viện concept', section: 'concept', match: 'Noel' },
    { label: 'Concept Sinh nhật', sub: 'Thư viện concept', section: 'concept', match: 'Sinh nhật' },
    { label: 'Concept Vintage', sub: 'Thư viện concept', section: 'concept', match: 'Vintage' },
    { label: 'Concept Hàn Quốc', sub: 'Thư viện concept', section: 'concept', match: 'Hàn Quốc' },
    { label: 'Album ảnh đẹp', sub: 'Thư viện ảnh', section: 'album' },
    { label: 'Giới thiệu studio', sub: 'Trang chủ', section: 'gioi-thieu' },
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

  setupNavUtil('notifBtn', 'notifPanel', renderNotifications);

  function renderNotifications() {
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
    list.innerHTML = myRequests.map((r) => `
      <div class="nav-util-item">
        <strong>Yêu cầu chỉnh sửa ${r.orderCode || ''}</strong>
        <span class="sub">${r.serviceLabel} · ${r.photoCount} ảnh</span>
        <span class="notif-status">${r.status}</span>
      </div>
    `).join('');
    dot.hidden = !myRequests.some((r) => r.status !== 'Hoàn thành');
  }
  renderNotifications();

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
  const CHAT_API_URL = 'http://localhost:3001/api/chat';

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
      addQuickReplies(['Tư vấn dịch vụ & báo giá', 'Quy trình đặt lịch', 'Câu hỏi thường gặp', 'Liên hệ Sale ngay'], (choice) => {
        addMsg(choice, 'user');
        if (choice === 'Tư vấn dịch vụ & báo giá') { askService(); return; }
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
      addImageMsg(info.img, `Ảnh minh hoạ phong cách ${service} tại ALOHA Baby`, `Ảnh minh hoạ phong cách "${service}" (ảnh minh hoạ, chưa phải ảnh khách hàng thật).`);
      await botSay(`Với dịch vụ "${service}", ALOHA Baby gợi ý một vài concept:\n• ${info.concepts.join('\n• ')}`);
      await botSay(info.note, 450);
      await botSay(`${info.packageNote}\nGiá tham khảo ${info.price} (giá minh họa, Sales sẽ báo giá chính xác theo gói bạn chọn).`, 450);
      addQuickReplies(['Chốt đơn - Đặt lịch ngay', 'Xem dịch vụ khác', 'Liên hệ Sale ngay'], (choice) => {
        addMsg(choice, 'user');
        if (choice.startsWith('Chốt đơn')) {
          confirmBooking(service);
        } else if (choice === 'Xem dịch vụ khác') {
          askService();
        } else {
          callSale();
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
    // Khung nhập tự do -> gọi server proxy cục bộ (server/) để trả lời bằng
    // Claude API thật. Nếu server chưa chạy hoặc chưa có API key, báo lỗi
    // thân thiện thay vì im lặng hoặc làm vỡ giao diện.
    // ---------------------------------------------------------------------
    if (chatInputForm && chatInput) {
      let aiHistory = [];
      let aiBusy = false;
      const sendBtn = chatInputForm.querySelector('.chat-send');

      chatInputForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (!text || aiBusy) return;

        chatInput.value = '';
        addMsg(text, 'user');
        aiHistory.push({ role: 'user', content: text });

        aiBusy = true;
        sendBtn.disabled = true;
        const typing = addTyping();

        try {
          const res = await fetch(CHAT_API_URL, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ messages: aiHistory })
          });
          const data = await res.json();
          typing.remove();
          if (!res.ok || !data.reply) {
            addMsg('Trợ lý AI hiện chưa sẵn sàng (server chưa chạy hoặc chưa cấu hình API key). Bạn có thể gọi hotline 0938.125.222 hoặc để lại câu hỏi, Sales sẽ liên hệ lại nhé.', 'error');
          } else {
            addMsg(data.reply, 'bot');
            aiHistory.push({ role: 'assistant', content: data.reply });
          }
        } catch (err) {
          typing.remove();
          addMsg('Không kết nối được tới trợ lý AI ngay lúc này. Bạn có thể gọi hotline 0938.125.222 để được hỗ trợ trực tiếp.', 'error');
        } finally {
          aiBusy = false;
          sendBtn.disabled = false;
        }
      });
    }
  }
});
