// ALOHA Baby — Khu vực quản trị dùng chung 1 file cho 3 vai trò nội bộ
// (Sale/CSKH, Thợ ảnh, Sếp). Dữ liệu DEMO tĩnh (minh hoạ bố cục), không phải
// số liệu thật, không kết nối API nào. Xem js/auth.js cho phần phân quyền.
document.addEventListener('DOMContentLoaded', () => {

  const session = AlohaAuth.getSession();
  const role = session ? session.role : null;
  document.getElementById('userName').textContent = (session && session.name) || 'Người dùng';
  document.getElementById('userRole').textContent = AlohaAuth.roleLabel(role);

  // ------------------------------- Ẩn/hiện tab + section theo đúng quyền -------------------------------
  function allowedForRole(el) {
    const roles = (el.dataset.roles || '').split(' ').filter(Boolean);
    return roles.length === 0 || roles.indexOf(role) !== -1;
  }

  const tabs = Array.from(document.querySelectorAll('#adminTabs a'));
  const sections = Array.from(document.querySelectorAll('.admin-section[data-roles], .admin-section[id]'));

  tabs.forEach(tab => { if (!allowedForRole(tab)) tab.remove(); });
  document.querySelectorAll('.admin-section').forEach(section => {
    if (section.dataset.roles && !allowedForRole(section)) section.remove();
  });

  const visibleTabs = document.querySelectorAll('#adminTabs a');
  if (visibleTabs.length === 0) {
    document.getElementById('emptyState').style.display = 'block';
  } else {
    visibleTabs.forEach((t, i) => t.classList.toggle('active', i === 0));
  }

  // ------------------------------- Đóng/mở cột menu ở màn hẹp -------------------------------
  // Màn rộng: cột menu luôn hiện, nút này bị CSS ẩn nên phần dưới không chạy tới.
  const sidebar = document.getElementById('adminSidebar');
  const scrim = document.getElementById('adminScrim');
  const menuBtn = document.getElementById('adminMenuBtn');

  function setSidebar(open) {
    if (!sidebar) return;
    sidebar.classList.toggle('open', open);
    if (menuBtn) menuBtn.setAttribute('aria-expanded', String(open));
    if (!scrim) return;
    if (open) {
      scrim.hidden = false;
      // tách 1 khung hình để lớp phủ kịp hiện ở opacity 0 rồi mới mờ dần vào
      requestAnimationFrame(() => scrim.classList.add('show'));
    } else {
      scrim.classList.remove('show');
      setTimeout(() => { if (!sidebar.classList.contains('open')) scrim.hidden = true; }, 280);
    }
  }

  if (menuBtn) menuBtn.addEventListener('click', () => setSidebar(!sidebar.classList.contains('open')));
  if (scrim) scrim.addEventListener('click', () => setSidebar(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setSidebar(false); });

  // ------------------------------- Thu gọn / mở rộng cột menu (màn rộng) -------------------------------
  // Thu gọn thành dải chỉ còn icon chứ không ẩn hẳn, để vẫn chuyển mục được.
  // Trạng thái ban đầu đã được khôi phục bằng đoạn script nhỏ trong
  // crm/admin.html (chạy trước khi trang vẽ, tránh menu giật từ rộng sang hẹp).
  const collapseBtn = document.getElementById('adminCollapseBtn');
  if (collapseBtn) {
    // Tên mục dùng cho tooltip lúc thu gọn - lấy từ chính nội dung đang có để
    // không phải khai báo tên ở 2 nơi rồi lệch nhau khi đổi tên mục.
    document.querySelectorAll('#adminTabs a').forEach(a => {
      const label = a.querySelector('span');
      if (label) a.dataset.label = label.textContent.trim();
    });

    function setCollapsed(collapsed) {
      document.documentElement.classList.toggle('sidebar-collapsed', collapsed);
      collapseBtn.setAttribute('aria-expanded', String(!collapsed));
      collapseBtn.setAttribute('aria-label', collapsed ? 'Mở rộng menu' : 'Thu gọn menu');
      collapseBtn.title = collapsed ? 'Mở rộng menu' : 'Thu gọn menu';
      try {
        localStorage.setItem('aloha_admin_ui', collapsed ? 'collapsed' : 'expanded');
      } catch (e) { /* không lưu được thì vẫn dùng bình thường trong phiên này */ }
    }

    setCollapsed(document.documentElement.classList.contains('sidebar-collapsed'));
    collapseBtn.addEventListener('click', () => {
      setCollapsed(!document.documentElement.classList.contains('sidebar-collapsed'));
    });
  }

  document.querySelectorAll('.admin-tabs a').forEach(link => {
    link.addEventListener('click', () => {
      document.querySelectorAll('.admin-tabs a').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      setSidebar(false); // chọn xong thì đóng lại để thấy ngay phần vừa chọn
    });
  });

  // ------------------------------- Hiệu ứng chuyển động dùng chung -------------------------------
  // Dashboard và Doanh thu dùng chung 3 helper này thay vì mỗi nơi tự viết một
  // kiểu. Nguyên tắc: mọi hiệu ứng chỉ chạy khi khối đã lọt vào khung nhìn (để
  // người dùng không bỏ lỡ), chạy đúng 1 lần, và TẮT HẲN khi người dùng bật
  // giảm hiệu ứng - lúc đó nội dung phải hiện ngay ở trạng thái cuối, không
  // bao giờ để trống (cùng nguyên tắc với .reveal bên phần khách hàng).
  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function onEnterView(el, fn) {
    if (!el) return;
    if (!('IntersectionObserver' in window)) { fn(); return; }
    const ob = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        ob.unobserve(e.target);
        // Đợi trọn 1 khung hình trước khi đặt giá trị đích. Khối nằm ngay đầu
        // trang (vd Dashboard) thì observer báo ngay trong khung hình đầu tiên,
        // lúc đó trạng thái ban đầu (cột cao 0, thanh rộng 0) chưa từng được vẽ
        // ra -> trình duyệt coi như không có gì thay đổi và bỏ qua transition,
        // nội dung bật thẳng tới đích không kèm hiệu ứng nào.
        requestAnimationFrame(() => requestAnimationFrame(fn));
      });
    }, { threshold: 0.15 });
    ob.observe(el);
  }

  // Đếm số từ 0 lên giá trị thật. render() quyết định cách hiển thị từng bước
  // (làm tròn, thêm đơn vị...) nên dùng được cho cả số nguyên lẫn số tiền.
  let countSeq = 0;
  function countUp(el, to, render, dur) {
    if (prefersReducedMotion) { el.textContent = render(to); return; }
    // Bấm chạy lại liên tiếp thì vòng đếm cũ phải dừng, nếu không 2 vòng cùng
    // ghi vào một chỗ và con số nhảy qua nhảy lại.
    const token = ++countSeq;
    el.dataset.countToken = token;
    const t0 = performance.now(), d = dur || 900;
    (function step(now) {
      if (+el.dataset.countToken !== token) return;
      const p = Math.min((now - t0) / d, 1);
      el.textContent = render(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }

  // Vẽ dần một nét SVG (path hoặc polyline) bằng stroke-dashoffset
  function drawStroke(el, dur, delay) {
    if (prefersReducedMotion || !el.getTotalLength) return;
    const len = el.getTotalLength();
    // Xoá transition của lần chạy trước trước khi đưa nét về vạch xuất phát,
    // nếu không thì mỗi lần chạy lại nét sẽ "rút ngược" mất gần một giây.
    el.style.transition = 'none';
    el.style.strokeDasharray = len;
    el.style.strokeDashoffset = len;
    void el.getBoundingClientRect(); // ép tính lại layout, nếu không sẽ không có transition
    el.style.transition = 'stroke-dashoffset ' + (dur || 1) + 's ease ' + (delay || 0) + 's';
    el.style.strokeDashoffset = '0';
  }

  // ---- Chạy lại hiệu ứng khi bấm mục menu (người dùng yêu cầu 2026-09-25) ----
  // Mỗi khối khai báo 2 việc: đưa về trạng thái xuất phát (reset) và chạy
  // (play). Tách đôi như vậy thì ngoài lần chạy đầu lúc cuộn tới, bấm lại mục
  // Dashboard / Doanh thu là chạy lại được từ đầu, không phải tải lại trang.
  const replays = {};

  // Đưa một khối về trạng thái xuất phát NGAY LẬP TỨC. Không chặn transition
  // trong lúc đặt lại thì người xem thấy cột tụt xuống, vạch rút ngược rồi mới
  // chạy lại - nhìn như lỗi chứ không như chạy lại.
  function snapBack(wrap, reset) {
    wrap.classList.add('anim-reset');
    reset();
    void wrap.getBoundingClientRect();
    wrap.classList.remove('anim-reset');
  }

  function registerAnim(sectionId, wrap, reset, play) {
    if (!wrap) return;
    (replays[sectionId] = replays[sectionId] || []).push({ wrap, reset, play });
    if (!prefersReducedMotion) snapBack(wrap, reset);
    onEnterView(wrap, play);
  }

  function replaySection(id) {
    const jobs = replays[id];
    // Người dùng bật giảm hiệu ứng thì không chạy lại: nội dung đang ở trạng
    // thái cuối, đúng như mọi hiệu ứng khác trong dự án.
    if (!jobs || prefersReducedMotion) return;
    jobs.forEach(j => snapBack(j.wrap, j.reset));
    // Đợi trọn 1 khung hình để trạng thái xuất phát kịp được vẽ ra, nếu không
    // trình duyệt gộp 2 lần đổi giá trị làm một và bỏ qua luôn transition.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      jobs.forEach(j => {
        const r = j.wrap.getBoundingClientRect();
        // Khối còn nằm dưới mép màn hình (vd phễu khách hàng khi bấm Dashboard
        // trên màn thấp) thì để dành, chạy lúc người dùng cuộn tới - đúng tinh
        // thần "không ai phải xem một hiệu ứng đã chạy xong từ lúc nào".
        // "Đang thấy" đo theo tỉ lệ khối lọt vào khung nhìn, dùng đúng ngưỡng
        // 0.15 của IntersectionObserver trong onEnterView - để lần chạy đầu và
        // các lần chạy lại hiểu "đã thấy" giống hệt nhau.
        const seen = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
        if (seen / Math.min(r.height || 1, window.innerHeight) >= 0.15) j.play();
        else onEnterView(j.wrap, j.play);
      });
    }));
  }

  // Trang admin cuộn mượt (html { scroll-behavior: smooth } trong style.css),
  // nên ngay sau khi bấm mục menu trang vẫn đang trôi tới nơi - chạy hiệu ứng
  // lúc đó thì người dùng chỉ xem được nửa sau. Đợi trang dừng hẳn rồi chạy.
  function afterScrollSettles(fn) {
    let last = window.scrollY, still = 0, frames = 0;
    (function tick() {
      const y = window.scrollY;
      still = Math.abs(y - last) < 1 ? still + 1 : 0;
      last = y;
      if (still >= 3 || ++frames > 120) { fn(); return; } // trần ~2s phòng khi cuộn không dừng
      requestAnimationFrame(tick);
    })();
  }

  document.querySelectorAll('.admin-tabs a').forEach(link => {
    const target = (link.getAttribute('href') || '').replace(/^#/, '');
    link.addEventListener('click', () => {
      if (!replays[target]) return; // mục không có biểu đồ thì không phải làm gì
      afterScrollSettles(() => replaySection(target));
    });
  });

  // ------------------------------- Biểu đồ khách mới theo tuần (chỉ Sếp) -------------------------------
  const WEEK_DATA = [
    { lbl: 'T1', val: 38 }, { lbl: 'T2', val: 52 }, { lbl: 'T3', val: 45 },
    { lbl: 'T4', val: 60 }, { lbl: 'T5', val: 71 }, { lbl: 'T6', val: 54 }
  ];
  const chartWrap = document.getElementById('newCustomerChart');
  if (chartWrap) {
    const maxVal = Math.max(...WEEK_DATA.map(d => d.val));
    WEEK_DATA.forEach(d => {
      const col = document.createElement('div');
      col.className = 'chart-bar-col';
      const heightPct = Math.round((d.val / maxVal) * 100);
      // .chart-bar-slot là vùng riêng cho cột, chiếm đúng phần còn lại của ô sau
      // khi trừ số và nhãn. Trước đây .chart-bar nằm thẳng trong ô flex nên bị
      // flex-shrink co lại cho vừa chỗ -> mọi cột ra cùng một chiều cao, biểu đồ
      // không phản ánh số liệu (lỗi có sẵn, sửa 2026-09-25). data-h giữ chiều
      // cao đích để cột mọc lên từ 0 khi cuộn tới.
      col.innerHTML = `<span class="val" data-val="${d.val}">${d.val}</span>` +
        `<div class="chart-bar-slot"><div class="chart-bar" data-h="${heightPct}" style="height:${heightPct}%"></div></div>` +
        `<span class="lbl">${d.lbl}</span>`;
      chartWrap.appendChild(col);
    });
    registerAnim('kpi', chartWrap, () => {
      chartWrap.querySelectorAll('.chart-bar').forEach(b => { b.style.height = '0%'; b.style.transitionDelay = ''; });
      chartWrap.querySelectorAll('.chart-bar-col .val').forEach(v => { v.style.opacity = '0'; v.style.transitionDelay = ''; });
    }, () => {
      chartWrap.querySelectorAll('.chart-bar').forEach((bar, i) => {
        // lệch nhau 70ms để các cột mọc lần lượt trái sang phải, không bật cùng lúc
        bar.style.transitionDelay = (i * 0.07) + 's';
        bar.style.height = bar.dataset.h + '%';
      });
      chartWrap.querySelectorAll('.chart-bar-col .val').forEach((v, i) => {
        v.style.transitionDelay = (i * 0.07) + 's';
        v.style.opacity = '1';
        countUp(v, +v.dataset.val, n => String(Math.round(n)), 700);
      });
    });
  }

  // ------------------------------- Phễu khách hàng (chỉ Sếp) -------------------------------
  // Mỗi bậc phễu 1 màu riêng, khớp đúng màu badge trạng thái đã dùng ở bảng
  // Khách hàng/CRM (badge-quan-tam/tu-van/dat-lich/da-chup/hoan-thanh) và ở
  // KPI card phía trên - để phễu đọc thành 1 dải màu chuyển tiếp thay vì
  // thanh hồng đơn sắc lặp lại 5 lần.
  const FUNNEL_DATA = [
    { name: 'Khách quan tâm', val: 320, color: '#4148c9' },
    { name: 'Đã tư vấn', val: 210, color: '#b06a00' },
    { name: 'Đã đặt lịch', val: 150, color: 'var(--pink-600)' },
    { name: 'Đã chụp', val: 96, color: 'var(--blue-600)' },
    { name: 'Hoàn thành', val: 88, color: '#1a9d5c' }
  ];
  const funnelWrap = document.getElementById('funnelChart');
  if (funnelWrap) {
    const funnelMax = FUNNEL_DATA[0].val;
    FUNNEL_DATA.forEach(d => {
      const pct = Math.round((d.val / funnelMax) * 100);
      const row = document.createElement('div');
      row.className = 'funnel-row';
      row.innerHTML = `
        <span class="name">${d.name}</span>
        <div class="funnel-bar-track"><div class="funnel-bar" data-w="${pct}" style="width:${pct}%; background:${d.color}"></div></div>
        <span class="val" data-val="${d.val}" data-pct="${pct}">${d.val} (${pct}%)</span>`;
      funnelWrap.appendChild(row);
    });
    registerAnim('kpi', funnelWrap, () => {
      funnelWrap.querySelectorAll('.funnel-bar').forEach(b => { b.style.width = '0%'; b.style.transitionDelay = ''; });
    }, () => {
      funnelWrap.querySelectorAll('.funnel-bar').forEach((bar, i) => {
        // chạy lần lượt từ bậc trên xuống để thấy rõ phễu hẹp dần qua từng bậc
        bar.style.transitionDelay = (i * 0.1) + 's';
        bar.style.width = bar.dataset.w + '%';
      });
      funnelWrap.querySelectorAll('.funnel-row .val').forEach(v => {
        countUp(v, +v.dataset.val, n => Math.round(n) + ' (' + v.dataset.pct + '%)', 900);
      });
    });
  }

  // ------------------------------- 5 thẻ KPI "Tổng quan hôm nay" (chỉ Sếp) -------------------------------
  // Markup 5 thẻ nằm sẵn trong crm/admin.html (không render động như các khối
  // khác), nên ở đây chỉ gắn thêm hiệu ứng: số đếm lên, sparkline vẽ dần, vạch
  // màu trên đầu thẻ chạy ngang. Đọc số đích từ chính nội dung có sẵn để không
  // phải khai báo lại danh sách số ở 2 nơi rồi lệch nhau.
  const kpiGrid = document.querySelector('#kpi .kpi-grid');
  if (kpiGrid) {
    const kpiCards = Array.from(kpiGrid.querySelectorAll('.kpi-card'));
    kpiCards.forEach(card => {
      const numEl = card.querySelector('.num');
      if (numEl) numEl.dataset.val = numEl.textContent.trim().replace(/[^0-9]/g, '');
    });
    if (!prefersReducedMotion) kpiGrid.classList.add('kpi-will-animate');
    registerAnim('kpi', kpiGrid, () => {
      kpiCards.forEach(card => { card.classList.remove('in'); card.style.transitionDelay = ''; });
    }, () => {
      kpiCards.forEach((card, i) => {
        card.classList.add('in'); // CSS lo phần vạch màu trên đầu thẻ chạy ngang
        card.style.transitionDelay = (i * 0.06) + 's';
        const numEl = card.querySelector('.num');
        if (numEl) countUp(numEl, +numEl.dataset.val, n => String(Math.round(n)), 850);
        const spark = card.querySelector('.kpi-spark polyline');
        if (spark) drawStroke(spark, 1, 0.1 + i * 0.08);
      });
    });
  }

  // ------------------------------- Khách hàng / CRM (1 nguồn dữ liệu, 2 kiểu hiển thị) -------------------------------
  // Sếp: xem đầy đủ hồ sơ. Sale: chỉ xem phần cần để chăm sóc khách, không có
  // trạng thái nội bộ dạng badge riêng của vận hành, gộp lịch sử ngắn gọn.
  const CUSTOMERS = [
    { name: 'Khách demo 01', phone: '0987 xxx 321', source: 'Facebook', status: 'dat-lich', label: 'Đã đặt lịch', badge: 'badge-dat-lich', created: '12/09/2026', note: 'Quan tâm gói Newborn.' },
    { name: 'Khách demo 02', phone: '0912 xxx 456', source: 'Giới thiệu', status: 'da-chup', label: 'Đã chụp', badge: 'badge-da-chup', created: '05/09/2026', note: 'Hỏi thêm về album in.' },
    { name: 'Khách demo 03', phone: '0977 xxx 789', source: 'TikTok', status: 'quan-tam', label: 'Khách quan tâm', badge: 'badge-quan-tam', created: '18/09/2026', note: 'Mới để lại số điện thoại.' },
    { name: 'Khách demo 04', phone: '0901 xxx 234', source: 'Website', status: 'hoan-thanh', label: 'Hoàn thành', badge: 'badge-hoan-thanh', created: '20/08/2026', note: 'Đã nhận ảnh, hẹn chụp 6 tháng tuổi.' },
    { name: 'Khách demo 05', phone: '0933 xxx 567', source: 'Instagram', status: 'tu-van', label: 'Đã tư vấn', badge: 'badge-tu-van', created: '15/09/2026', note: 'Đang cân nhắc gói Gia đình.' },
    { name: 'Khách demo 06', phone: '0966 xxx 890', source: 'Hotline', status: 'dat-lich', label: 'Đã đặt lịch', badge: 'badge-dat-lich', created: '10/09/2026', note: 'Chụp Bé lớn, concept Hàn Quốc.' },
    { name: 'Khách demo 07', phone: '0944 xxx 112', source: 'Đối tác spa bầu', status: 'quan-tam', label: 'Khách quan tâm', badge: 'badge-quan-tam', created: '19/09/2026', note: 'Chưa liên hệ lại.' }
  ];

  const custTable = document.getElementById('custTable');
  if (custTable) {
    const head = document.getElementById('custTableHead');
    const body = document.getElementById('custTableBody');
    const isSep = role === 'sep';

    if (isSep) {
      head.innerHTML = '<tr><th>Tên</th><th>SĐT</th><th>Nguồn khách</th><th>Trạng thái</th><th>Ngày tạo</th><th>Ghi chú</th></tr>';
    } else {
      document.getElementById('custSectionSub').textContent = 'Thông tin khách hàng để chăm sóc và tư vấn. Không hiển thị dữ liệu thanh toán/doanh thu.';
      head.innerHTML = '<tr><th>Liên hệ</th><th>Nguồn khách</th><th>Lịch sử lịch hẹn</th><th>Ghi chú tư vấn</th></tr>';
    }

    function renderCustomers(list) {
      if (isSep) {
        body.innerHTML = list.map(c => `
          <tr>
            <td>${c.name}</td><td>${c.phone}</td><td>${c.source}</td>
            <td><span class="badge ${c.badge}">${c.label}</span></td>
            <td>${c.created}</td><td>${c.note}</td>
          </tr>`).join('');
      } else {
        body.innerHTML = list.map(c => `
          <tr>
            <td>${c.name} · ${c.phone}</td>
            <td>${c.source}</td>
            <td>${c.label} (${c.created})</td>
            <td>${c.note}</td>
          </tr>`).join('');
      }
    }
    renderCustomers(CUSTOMERS);

    function applyCustomerFilters() {
      const q = document.getElementById('custSearch').value.trim().toLowerCase();
      const status = document.getElementById('custFilter').value;
      const filtered = CUSTOMERS.filter(c => {
        const matchQ = !q || c.name.toLowerCase().includes(q) || c.phone.includes(q);
        const matchStatus = !status || c.status === status;
        return matchQ && matchStatus;
      });
      renderCustomers(filtered);
    }
    document.getElementById('custSearch').addEventListener('input', applyCustomerFilters);
    document.getElementById('custFilter').addEventListener('change', applyCustomerFilters);
  }

  // ------------------------------- Lịch hẹn dạng lịch tháng (Sếp + Sale) -------------------------------
  // Người dùng yêu cầu (2026-09-25) đổi từ bảng danh sách + 3 tab sang lịch
  // tháng: mỗi ô là 1 ngày, trong ô là các lịch hẹn của ngày đó xếp theo giờ từ
  // sớm tới muộn, bấm vào 1 lịch hẹn mở popup chi tiết.
  //
  // Ngày chụp lưu dưới dạng ĐỘ LỆCH so với hôm nay (dayOffset) chứ không phải
  // ngày cố định: dữ liệu demo nhờ vậy luôn hợp lý dù xem vào thời điểm nào
  // (lịch đã qua luôn ở quá khứ, lịch sắp tới luôn ở tương lai), thay vì để mốc
  // cứng kiểu "22/09" rồi vài hôm sau thành lịch quá khứ mà vẫn ghi "Sắp đến"
  // như bảng cũ. Trạng thái dùng đúng enum lịch hẹn trong rules/tech-defaults.md
  // và khớp với vị trí của buổi chụp so với hôm nay.
  const calGrid = document.getElementById('calGrid');
  if (calGrid) {
    const APPOINTMENTS = [
      { dayOffset: -14, time: '09:00', cust: 'Khách demo 04', phone: '0901 xxx 234', service: 'Newborn', pkg: 'Gói Cơ bản 15 ảnh', concept: 'Tự nhiên', status: 'Hoàn thành', crew: 'Thợ ảnh Minh · Makeup Hà', note: 'Đã bàn giao ảnh, hẹn chụp mốc 6 tháng tuổi.' },
      { dayOffset: -9,  time: '14:00', cust: 'Khách demo 02', phone: '0912 xxx 456', service: 'Sinh nhật', pkg: 'Gói Tiêu chuẩn 25 ảnh', concept: 'Rực rỡ', status: 'Đã chụp', crew: 'Thợ ảnh Nam · Stylist Linh', note: 'Khách hỏi thêm về album in.' },
      { dayOffset: -5,  time: '10:30', cust: 'Khách demo 07', phone: '0944 xxx 112', service: 'Bầu', pkg: 'Gói Cơ bản 15 ảnh', concept: 'Ngoại cảnh', status: 'Đã chụp', crew: 'Thợ ảnh Minh', note: 'Khách đến từ đối tác spa bầu.' },
      { dayOffset: -2,  time: '15:30', cust: 'Khách demo 03', phone: '0977 xxx 789', service: 'Gia đình', pkg: 'Gói Tiêu chuẩn 25 ảnh', concept: 'Vintage', status: 'Đã chụp', crew: 'Thợ ảnh Nam · Makeup Hà', note: 'Chụp cùng ông bà, 6 người trong ảnh.' },
      { dayOffset: 0,   time: '08:00', cust: 'Khách demo 05', phone: '0933 xxx 567', service: 'Gia đình', pkg: 'Gói Cơ bản 15 ảnh', concept: 'Ngoại cảnh', status: 'Đã đến/Đang chụp', crew: 'Thợ ảnh Minh · Stylist Linh', note: 'Đang cân nhắc nâng lên gói Tiêu chuẩn.' },
      { dayOffset: 0,   time: '11:00', cust: 'Khách demo 01', phone: '0987 xxx 321', service: 'Newborn', pkg: 'Gói Tiêu chuẩn 25 ảnh', concept: 'Tự nhiên', status: 'Sắp đến', crew: 'Thợ ảnh Nam', note: 'Bé 12 ngày tuổi, cần phòng ấm và nhiều thời gian đệm.' },
      { dayOffset: 0,   time: '16:30', cust: 'Khách demo 06', phone: '0966 xxx 890', service: 'Bé lớn', pkg: 'Gói Cơ bản 15 ảnh', concept: 'Hàn Quốc', status: 'Sắp đến', crew: 'Thợ ảnh Minh · Makeup Hà', note: 'Đã đối soát cọc sáng nay.' },
      { dayOffset: 1,   time: '09:30', cust: 'Khách demo 06', phone: '0966 xxx 890', service: 'Bé lớn', pkg: 'Gói Tiêu chuẩn 25 ảnh', concept: 'Hàn Quốc', status: 'Sắp đến', crew: 'Thợ ảnh Nam · Stylist Linh', note: 'Buổi thứ hai trong gói combo 2 buổi.' },
      { dayOffset: 2,   time: '13:30', cust: 'Khách demo 01', phone: '0987 xxx 321', service: 'Newborn', pkg: 'Gói Tiêu chuẩn 25 ảnh', concept: 'Tự nhiên', status: 'Chờ xác nhận', crew: 'Chưa phân công', note: 'Chờ Sales gọi xác nhận lại thông tin bé.' },
      { dayOffset: 3,   time: '15:00', cust: 'Khách demo 05', phone: '0933 xxx 567', service: 'Bầu', pkg: 'Gói Cơ bản 15 ảnh', concept: 'Biển', status: 'Chưa cọc', crew: 'Chưa phân công', note: 'Khung giờ đang giữ tạm, chưa nhận được cọc.' },
      { dayOffset: 3,   time: '17:00', cust: 'Khách demo 03', phone: '0977 xxx 789', service: 'Sinh nhật', pkg: 'Gói Tiêu chuẩn 25 ảnh', concept: 'Rực rỡ', status: 'Chờ duyệt dời lịch', crew: 'Thợ ảnh Minh', note: 'Khách xin dời vì bé ốm, quá hạn dời miễn phí nên chờ Sales duyệt.' },
      { dayOffset: 6,   time: '10:00', cust: 'Khách demo 02', phone: '0912 xxx 456', service: 'Gia đình', pkg: 'Gói Cơ bản 15 ảnh', concept: 'Vintage', status: 'Chờ xác nhận', crew: 'Chưa phân công', note: '' },
      { dayOffset: 8,   time: '08:30', cust: 'Khách demo 07', phone: '0944 xxx 112', service: 'Newborn', pkg: 'Gói Tiêu chuẩn 25 ảnh', concept: 'Tự nhiên', status: 'Chưa cọc', crew: 'Chưa phân công', note: 'Dự sinh tuần sau, ngày chụp có thể đổi theo ngày sinh thật.' },
      { dayOffset: 11,  time: '14:30', cust: 'Khách demo 04', phone: '0901 xxx 234', service: 'Bé lớn', pkg: 'Gói Cơ bản 15 ảnh', concept: 'Hàn Quốc', status: 'Chờ xác nhận', crew: 'Chưa phân công', note: 'Mốc 6 tháng tuổi như đã hẹn ở buổi trước.' },
      { dayOffset: -6,  time: '09:00', cust: 'Khách demo 05', phone: '0933 xxx 567', service: 'Sinh nhật', pkg: 'Gói Cơ bản 15 ảnh', concept: 'Rực rỡ', status: 'Đã hủy', crew: '—', note: 'Khách báo hủy trước 3 ngày, đã xử lý cọc theo chính sách.' }
    ];

    // Màu badge tái dùng đúng bộ đã có trong css/admin.css, không thêm màu mới
    const STATUS_BADGE = {
      'Chưa cọc': 'badge-tu-van',
      'Chờ xác nhận': 'badge-quan-tam',
      'Chờ duyệt dời lịch': 'badge-tu-van',
      'Sắp đến': 'badge-dat-lich',
      'Đã đến/Đang chụp': 'badge-da-chup',
      'Đã chụp': 'badge-da-chup',
      'Hoàn thành': 'badge-hoan-thanh',
      'Đã hủy': 'badge-huy'
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayKey = d => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();

    // Quy đổi độ lệch ngày thành ngày thật rồi gom theo ngày, mỗi ngày sắp xếp
    // theo giờ tăng dần (yêu cầu "khung giờ từ sớm đến muộn xếp từ trên xuống").
    const byDay = {};
    APPOINTMENTS.forEach((a, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() + a.dayOffset);
      a.date = d;
      a.id = 'appt-' + i;
      (byDay[dayKey(d)] = byDay[dayKey(d)] || []).push(a);
    });
    Object.keys(byDay).forEach(k => byDay[k].sort((x, y) => x.time.localeCompare(y.time)));

    const MONTH_NAMES = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
      'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
    const DOW = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    const pad2 = n => (n < 10 ? '0' : '') + n;
    const fmtDate = d => pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear();

    let viewYear = today.getFullYear(), viewMonth = today.getMonth();

    const calTitle = document.getElementById('calTitle');
    const calWeekdays = document.querySelector('.cal-weekdays');
    const calCount = document.getElementById('calCount');
    const calAgenda = document.getElementById('calAgenda');

    function apptChip(a, showDate) {
      return '<button type="button" class="cal-appt" data-id="' + a.id + '" data-status="' + a.status + '">' +
        '<span class="cal-appt-time">' + (showDate ? fmtDate(a.date).slice(0, 5) + ' · ' : '') + a.time + '</span>' +
        '<span class="cal-appt-name">' + a.cust + '</span>' +
        '<span class="cal-appt-service">' + a.service + '</span>' +
        '</button>';
    }

    // Khung lịch cao cố định theo khung nhìn nên ô nào nhiều lịch hẹn sẽ không
    // chứa hết. Đo chỗ trống thật của từng ô rồi giấu bớt thẻ thừa và thêm nút
    // "+N nữa" - cách này tự thích nghi với mọi cỡ màn hình và với cả việc thu
    // gọn cột menu, thay vì chốt cứng "hiện tối đa 2 thẻ".
    function fitDayCells() {
      calGrid.querySelectorAll('.cal-day').forEach(day => {
        const list = day.querySelector('.cal-day-list');
        const old = list.querySelector('.cal-more');
        if (old) old.remove();
        const chips = Array.from(list.querySelectorAll('.cal-appt'));
        chips.forEach(c => { c.style.display = ''; });
        if (!chips.length) return;

        const avail = list.clientHeight;
        if (avail <= 0) return;
        // Ô thấp (màn hình nhỏ, hoặc tháng trải 6 hàng) thì bỏ dòng tên dịch vụ
        // để mỗi thẻ mỏng đi, nhờ vậy vẫn thấy được nhiều buổi chụp hơn thay vì
        // dồn gần hết vào nút "+N nữa".
        day.classList.toggle('compact', avail < 110);

        const gap = 4, moreH = 19; // moreH: chiều cao dòng "+N nữa"
        const chipH = chips[0].offsetHeight; // đọc sau khi đã bật/tắt compact
        if (Math.floor((avail + gap) / (chipH + gap)) >= chips.length) return; // chứa đủ, khỏi cắt

        // Cắt bớt thì phải chừa chỗ cho chính dòng "+N nữa"; chỗ quá hẹp thì
        // giấu hết thẻ và chỉ để lại một dòng tổng "N lịch hẹn".
        const fit = Math.max(0, Math.floor((avail - moreH) / (chipH + gap)));
        chips.forEach((c, i) => { if (i >= fit) c.style.display = 'none'; });

        const more = document.createElement('button');
        more.type = 'button';
        more.className = 'cal-more';
        more.dataset.day = day.dataset.key;
        more.textContent = fit === 0 ? chips.length + ' lịch hẹn' : '+' + (chips.length - fit) + ' lịch nữa';
        list.appendChild(more);
      });
    }

    function renderCalendar() {
      calTitle.textContent = MONTH_NAMES[viewMonth] + ', ' + viewYear;

      const first = new Date(viewYear, viewMonth, 1);
      const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
      const lead = first.getDay(); // 0 = Chủ nhật, khớp thứ tự cột CN -> Thứ 7
      const cells = [];
      // ngày cuối tháng trước cho đủ hàng đầu
      const prevDays = new Date(viewYear, viewMonth, 0).getDate();
      for (let i = lead - 1; i >= 0; i--) cells.push({ d: new Date(viewYear, viewMonth - 1, prevDays - i), out: true });
      for (let i = 1; i <= daysInMonth; i++) cells.push({ d: new Date(viewYear, viewMonth, i), out: false });
      while (cells.length % 7 !== 0) cells.push({ d: new Date(viewYear, viewMonth + 1, cells.length - lead - daysInMonth + 1), out: true });

      let monthCount = 0;
      calGrid.innerHTML = cells.map(c => {
        const list = byDay[dayKey(c.d)] || [];
        if (!c.out) monthCount += list.length;
        const isToday = dayKey(c.d) === dayKey(today);
        return '<div class="cal-day' + (c.out ? ' out' : '') + (isToday ? ' today' : '') + '" data-key="' + dayKey(c.d) + '">' +
          '<div class="cal-day-head"><span class="cal-day-num">' + c.d.getDate() + '</span>' +
            (isToday ? '<span class="cal-today-tag">Hôm nay</span>' : '') +
            (list.length ? '<span class="cal-day-count">' + list.length + '</span>' : '') + '</div>' +
          '<div class="cal-day-list">' + list.map(a => apptChip(a, false)).join('') + '</div>' +
        '</div>';
      }).join('');
      calCount.textContent = monthCount + ' lịch hẹn trong tháng';
      fitDayCells();

      // Tháng đang xem có chứa hôm nay thì tô luôn tên thứ ở hàng tiêu đề,
      // để dóng mắt từ đầu cột xuống đúng ô ngày; xem tháng khác thì bỏ tô
      // (tô mãi một cột sẽ thành chỉ dấu sai, không ngày nào ứng với nó).
      const hasToday = !!calGrid.querySelector('.cal-day.today');
      if (calWeekdays) {
        calWeekdays.querySelectorAll('span').forEach((s, i) => {
          s.classList.toggle('today-col', hasToday && i === today.getDay());
        });
      }

      // Bản danh sách cho màn hẹp: chỉ những ngày có lịch, cùng thứ tự giờ
      const daysWithAppt = Object.keys(byDay)
        .map(k => byDay[k])
        .filter(list => list[0].date.getFullYear() === viewYear && list[0].date.getMonth() === viewMonth)
        .sort((a, b) => a[0].date - b[0].date);
      calAgenda.innerHTML = daysWithAppt.length
        ? daysWithAppt.map(list => {
            const d = list[0].date;
            return '<div class="cal-agenda-day' + (dayKey(d) === dayKey(today) ? ' today' : '') + '">' +
              '<div class="cal-agenda-date"><strong>' + pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '</strong> · ' + DOW[d.getDay()] +
                (dayKey(d) === dayKey(today) ? '<span class="cal-today-tag">Hôm nay</span>' : '') + '</div>' +
              '<div class="cal-day-list">' + list.map(a => apptChip(a, false)).join('') + '</div>' +
            '</div>';
          }).join('')
        : '<div class="empty-card"><p>Tháng này chưa có lịch hẹn nào.</p></div>';
    }

    // --------- Popup chi tiết ---------
    const apptOverlay = document.getElementById('apptModalOverlay');
    const apptBody = document.getElementById('apptModalBody');

    function openAppt(id) {
      const a = APPOINTMENTS.find(x => x.id === id);
      if (!a) return;
      const rows = [
        ['Khách hàng', a.cust + ' · ' + a.phone],
        ['Thời gian', a.time + ' · ' + DOW[a.date.getDay()] + ', ' + fmtDate(a.date)],
        ['Dịch vụ', a.service],
        ['Gói chụp', a.pkg],
        ['Concept', a.concept],
        ['Ekip phụ trách', a.crew]
      ];
      apptBody.innerHTML =
        '<h3 id="apptModalTitle">' + a.cust + ' · ' + a.service + '</h3>' +
        '<div class="appt-modal-status"><span class="badge ' + (STATUS_BADGE[a.status] || 'badge-dat-lich') + '">' + a.status + '</span></div>' +
        '<dl class="appt-fields">' +
          rows.map(r => '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>').join('') +
        '</dl>' +
        (a.note ? '<div class="appt-note"><strong>Ghi chú</strong><p>' + a.note + '</p></div>' : '') +
        '<p class="appt-modal-hint">Dữ liệu minh hoạ. Thao tác duyệt dời lịch và phân công ekip chưa nối vào màn hình này.</p>';
      apptOverlay.classList.add('open');
      apptOverlay.setAttribute('aria-hidden', 'false');
    }

    // Bấm "+N nữa": liệt kê toàn bộ lịch hẹn của ngày đó, vẫn theo thứ tự giờ,
    // bấm tiếp một dòng là mở chi tiết như thường.
    function openDay(key) {
      const list = byDay[key];
      if (!list || !list.length) return;
      const d = list[0].date;
      apptBody.innerHTML =
        '<h3 id="apptModalTitle">Lịch hẹn ' + DOW[d.getDay()] + ', ' + fmtDate(d) + '</h3>' +
        '<p class="appt-modal-sub">' + list.length + ' buổi chụp trong ngày, xếp theo giờ.</p>' +
        '<div class="cal-day-list appt-day-list">' + list.map(a => apptChip(a, false)).join('') + '</div>';
      apptOverlay.classList.add('open');
      apptOverlay.setAttribute('aria-hidden', 'false');
    }

    function closeAppt() {
      apptOverlay.classList.remove('open');
      apptOverlay.setAttribute('aria-hidden', 'true');
    }

    // Uỷ quyền sự kiện cho lưới, danh sách và cả nội dung trong popup: nội dung
    // được dựng lại mỗi lần đổi tháng nên gắn thẳng vào từng nút sẽ phải gắn lại
    // liên tục.
    [calGrid, calAgenda, apptBody].forEach(root => {
      root.addEventListener('click', e => {
        const more = e.target.closest('.cal-more');
        if (more) { openDay(more.dataset.day); return; }
        const chip = e.target.closest('.cal-appt');
        if (chip) openAppt(chip.dataset.id);
      });
    });
    document.getElementById('apptModalClose').addEventListener('click', closeAppt);
    apptOverlay.addEventListener('click', e => { if (e.target === apptOverlay) closeAppt(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAppt(); });

    document.getElementById('calPrev').addEventListener('click', () => {
      viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; }
      renderCalendar();
    });
    document.getElementById('calNext').addEventListener('click', () => {
      viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; }
      renderCalendar();
    });
    document.getElementById('calToday').addEventListener('click', () => {
      viewYear = today.getFullYear(); viewMonth = today.getMonth();
      renderCalendar();
    });

    // Đổi cỡ cửa sổ hoặc thu gọn/mở rộng cột menu đều làm ô ngày cao thấp khác
    // đi -> tính lại xem mỗi ô chứa được mấy thẻ. Dùng ResizeObserver vì thu gọn
    // menu chỉ đổi CSS, không sinh sự kiện resize của window.
    let fitTimer = null;
    function refit() {
      clearTimeout(fitTimer);
      fitTimer = setTimeout(fitDayCells, 150);
    }
    if ('ResizeObserver' in window) new ResizeObserver(refit).observe(calGrid);
    else window.addEventListener('resize', refit);

    renderCalendar();
  }

  // ------------------------------- Quản lý chụp & chỉnh ảnh: kanban đầy đủ chức năng -------------------------------
  // Gộp 2 nguồn thành 1 danh sách duy nhất để render và xử lý giống hệt nhau:
  //  - Yêu cầu THẬT từ khách (view "Ảnh của tôi") -> AlohaData (localStorage,
  //    xem js/data-store.js), tiến độ (doneIds) persist thật qua AlohaData.togglePhotoDone.
  //  - Dữ liệu nền minh hoạ (STATIC_REQUESTS ngay dưới đây) -> chỉ tồn tại
  //    trong bộ nhớ JS của trang này (giống cách CUSTOMERS/APPOINTMENTS ở trên
  //    đã làm), tiến độ lưu tạm trong staticDoneMap, mất khi tải lại trang.
  // Người dùng yêu cầu: bấm được vào thẻ, biết yêu cầu nào tới trước (ưu tiên
  // xử lý), thấy đúng những ảnh nào cần làm, và có cách Thợ ảnh tự confirm
  // tiến độ để Sếp quan sát được — toàn bộ xử lý trong khối này.
  // 3 bước (bỏ "Chờ QC" riêng, 2026-09-19 - xem js/data-store.js STATUS_FLOW):
  // Chờ xử lý (xác nhận yêu cầu) -> Đang thực hiện (đang sửa ảnh) -> Hoàn
  // thành (tải ảnh đã sửa lên). Nút "Chuyển sang bước tiếp theo" ở Đang thực
  // hiện vẫn khoá tới khi Thợ ảnh tick xong hết ảnh (xem canAdvance()) - đúng
  // với "tải ảnh đã sửa lên là hoàn thành" nhưng không cần vai trò QC riêng.
  const STATUS_COL_ID = {
    'Chờ xử lý': 'kanbanCol-cho-xu-ly',
    'Đang thực hiện': 'kanbanCol-dang-thuc-hien',
    'Hoàn thành': 'kanbanCol-hoan-thanh'
  };
  const STATUS_COUNT_ID = {
    'Chờ xử lý': 'kanbanCount-cho-xu-ly',
    'Đang thực hiện': 'kanbanCount-dang-thuc-hien',
    'Hoàn thành': 'kanbanCount-hoan-thanh'
  };
  // Màu nhận diện riêng cho từng giai đoạn - lấy đúng từ bảng màu badge trạng
  // thái đã có sẵn trong admin.css (không tạo bảng màu mới), để cột kanban và
  // badge trạng thái trong modal luôn khớp nhau.
  const STATUS_ACCENT = {
    'Chờ xử lý': '#4148c9',
    'Đang thực hiện': '#b06a00',
    'Hoàn thành': '#1a9d5c'
  };

  const now = Date.now();
  const HOUR = 3600 * 1000;
  const staticDoneMap = {}; // requestId -> Set(photoId) đã đánh dấu xong, chỉ tồn tại trong phiên xem trang này

  // Ảnh nền minh hoạ dùng lại đúng 16 ảnh demo có sẵn trong images/my-photos/,
  // KHÔNG phải ảnh thật của khách demo 02/03/04/05/06 (những khách này chỉ có
  // trong bảng CUSTOMERS ở trên, chưa có ảnh thật gắn kèm).
  const STATIC_REQUESTS = [
    { id: 'static-1', orderCode: '#AB240930', customerName: 'Khách demo 05', serviceLabel: 'Gia đình', status: 'Chờ xử lý', note: 'Muốn ảnh tông sáng, ít chỉnh da.', createdAt: now - 26 * HOUR, photoIds: [1, 2, 3, 4], doneIds: [] },
    { id: 'static-2', orderCode: '#AB240902', customerName: 'Khách demo 02', serviceLabel: 'Sinh nhật', status: 'Đang thực hiện', note: 'Xoá phông lộn xộn phía sau bé.', createdAt: now - 3 * 24 * HOUR, photoIds: [5, 6, 7, 8, 9], doneIds: [5, 6] },
    { id: 'static-3', orderCode: '#AB240888', customerName: 'Khách demo 03', serviceLabel: 'Bầu', status: 'Hoàn thành', note: '', createdAt: now - 5 * 24 * HOUR, photoIds: [10, 11, 12], doneIds: [10, 11, 12] },
    { id: 'static-4', orderCode: '#AB240871', customerName: 'Khách demo 04', serviceLabel: 'Bé lớn', status: 'Hoàn thành', note: '', createdAt: now - 9 * 24 * HOUR, photoIds: [13, 14], doneIds: [13, 14] },
    { id: 'static-5', orderCode: '#AB240860', customerName: 'Khách demo 06', serviceLabel: 'Newborn', status: 'Hoàn thành', note: '', createdAt: now - 10 * 24 * HOUR, photoIds: [15, 16], doneIds: [15, 16] }
  ].map(r => {
    staticDoneMap[r.id] = new Set(r.doneIds.map(n => 'ph-' + n));
    return {
      id: r.id, orderCode: r.orderCode, customerName: r.customerName, serviceLabel: r.serviceLabel,
      status: r.status, note: r.note, createdAt: r.createdAt, isStatic: true,
      photos: r.photoIds.map(n => ({ id: 'ph-' + n, src: '../images/my-photos/photo-' + n + '.jpg', note: '' })),
      photoCount: r.photoIds.length
    };
  });

  function formatRelativeTime(ts) {
    const diffMs = Date.now() - ts;
    const min = Math.floor(diffMs / 60000);
    if (min < 1) return 'Vừa xong';
    if (min < 60) return min + ' phút trước';
    const hr = Math.floor(min / 60);
    if (hr < 24) return hr + ' giờ trước';
    const day = Math.floor(hr / 24);
    return day + ' ngày trước';
  }

  function getDoneIds(req) {
    if (req.isStatic) return Array.from(staticDoneMap[req.id] || []);
    return Array.isArray(req.doneIds) ? req.doneIds : [];
  }

  function togglePhotoDone(req, photoId) {
    if (req.isStatic) {
      const set = staticDoneMap[req.id] || (staticDoneMap[req.id] = new Set());
      if (set.has(photoId)) set.delete(photoId); else set.add(photoId);
    } else if (window.AlohaData) {
      // Đồng bộ lại req.doneIds trong bộ nhớ ngay sau khi ghi xuống localStorage,
      // vì `req` đang giữ ở đây là bản chụp lúc mở modal (không tự cập nhật theo store).
      const updated = AlohaData.togglePhotoDone(req.id, photoId);
      if (updated) req.doneIds = updated.doneIds.slice();
    }
  }

  function canAdvance(req) {
    if (req.status !== 'Đang thực hiện') return true;
    const total = (req.photos || []).length;
    if (total === 0) return true;
    return getDoneIds(req).length === total;
  }

  function advance(req) {
    if (req.isStatic) {
      const idx = AlohaData.STATUS_FLOW.indexOf(req.status);
      if (idx >= 0 && idx < AlohaData.STATUS_FLOW.length - 1) req.status = AlohaData.STATUS_FLOW[idx + 1];
    } else if (window.AlohaData) {
      AlohaData.advanceRequestStatus(req.id);
    }
  }

  function getAllRequests() {
    // js/data-store.js lưu photo.src tương đối với index.html ở thư mục gốc
    // (vd "images/my-photos/photo-1.jpg") - trang này (crm/admin.html) nằm
    // sâu hơn 1 cấp nên phải thêm "../" khi hiển thị lại ở đây.
    const real = (window.AlohaData ? AlohaData.getEditRequests() : []).map(r => Object.assign({ isStatic: false }, r, {
      photos: (r.photos || []).map(p => Object.assign({}, p, { src: '../' + p.src }))
    }));
    return STATIC_REQUESTS.concat(real);
  }

  const canEditProgress = role === 'tho-anh';

  // Badge số lượng yêu cầu thật (không tính thẻ minh hoạ tĩnh) Thợ ảnh chưa mở
  // xem - đặt ngay trên tab "Ảnh & chỉnh sửa" để thấy được cả khi đang ở tab
  // khác, đúng yêu cầu "thợ nên nhận được thông báo khi khách có yêu cầu".
  function updateTabBadge() {
    const tab = document.querySelector('#adminTabs a[href="#anh"]');
    if (!tab) return;
    const unseenCount = getAllRequests().filter(r => !r.isStatic && !r.staffSeen).length;
    let badge = tab.querySelector('.admin-tab-badge');
    if (unseenCount > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'admin-tab-badge';
        tab.appendChild(badge);
      }
      badge.textContent = unseenCount;
    } else if (badge) {
      badge.remove();
    }
  }

  function renderEditRequests() {
    const board = document.querySelector('.kanban');
    if (!board) return;
    document.querySelectorAll('.kanban-col').forEach(col => {
      col.querySelectorAll('.kanban-card, .kanban-col-empty').forEach(el => el.remove());
    });

    const buckets = {};
    getAllRequests().forEach(req => {
      (buckets[req.status] = buckets[req.status] || []).push(req);
    });

    Object.keys(STATUS_COL_ID).forEach(status => {
      const col = document.getElementById(STATUS_COL_ID[status]);
      if (!col) return;
      const list = (buckets[status] || []).slice().sort((a, b) => a.createdAt - b.createdAt);

      const countEl = document.getElementById(STATUS_COUNT_ID[status]);
      if (countEl) countEl.textContent = list.length;

      if (list.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'kanban-col-empty';
        empty.textContent = 'Chưa có yêu cầu nào ở bước này.';
        col.appendChild(empty);
      }

      list.forEach((req, i) => {
        const doneCount = getDoneIds(req).length;
        const total = (req.photos || []).length;
        const card = document.createElement('div');
        card.className = 'kanban-card';
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', 'Xem chi tiết yêu cầu ' + (req.orderCode || req.id));
        card.innerHTML = `
          <div class="kanban-card-top">
            <span class="priority-badge" title="Thứ tự ưu tiên xử lý trong cột này: đến trước làm trước">#${i + 1}</span>
            <strong>${req.orderCode || req.id}</strong>
            ${!req.isStatic ? '<span class="badge badge-hoan-thanh">Mới</span>' : ''}
          </div>
          <span>${req.customerName} · ${req.serviceLabel || 'Chụp ảnh'} · ${total || req.photoCount || 0} ảnh</span>
          <span class="kanban-card-time">Gửi ${formatRelativeTime(req.createdAt)}</span>
          ${req.photoNotes && req.photoNotes.length ? `<span class="kanban-card-notes-hint">+${req.photoNotes.length} ảnh có ghi chú riêng</span>` : ''}
          ${total > 0 ? `
          <div class="kanban-progress-track"><div class="kanban-progress-fill${doneCount === total ? ' done' : ''}" style="width:${Math.round(doneCount / total * 100)}%"></div></div>
          <span class="kanban-progress-label">Đã xong ${doneCount}/${total} ảnh</span>` : ''}
          ${req.status !== 'Hoàn thành' ? `<button type="button" class="kanban-advance-btn" data-id="${req.id}"${canAdvance(req) ? '' : ' disabled title="Thợ ảnh cần đánh dấu xong hết ảnh trước khi chuyển bước"'}>Chuyển sang bước tiếp theo →</button>` : ''}
        `;
        card.addEventListener('click', () => openRequestModal(req));
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openRequestModal(req); }
        });
        const advBtn = card.querySelector('.kanban-advance-btn');
        if (advBtn) {
          advBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (advBtn.disabled) return;
            advance(req);
            renderEditRequests();
          });
        }
        col.appendChild(card);
      });
    });

    updateTabBadge();
  }

  // ------------------------------- Modal chi tiết 1 yêu cầu -------------------------------
  const modalOverlay = document.getElementById('kanbanModalOverlay');
  const modalBody = document.getElementById('kanbanModalBody');
  const modalClose = document.getElementById('kanbanModalClose');

  function openRequestModal(req) {
    if (!modalOverlay || !modalBody) return;
    // Thợ ảnh mở xem yêu cầu thật (chưa xem) -> tắt badge "chưa xem" trên tab.
    if (role === 'tho-anh' && !req.isStatic && !req.staffSeen && window.AlohaData) {
      AlohaData.markStaffSeen(req.id);
      req.staffSeen = true;
      updateTabBadge();
    }
    renderModalBody(req);
    modalOverlay.classList.add('open');
    modalOverlay.setAttribute('aria-hidden', 'false');
  }

  function closeModal() {
    if (!modalOverlay) return;
    modalOverlay.classList.remove('open');
    modalOverlay.setAttribute('aria-hidden', 'true');
  }
  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (modalOverlay) modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay && modalOverlay.classList.contains('open')) closeModal();
  });

  const STATUS_BADGE_CLASS = {
    'Chờ xử lý': 'badge-quan-tam',
    'Đang thực hiện': 'badge-tu-van',
    'Hoàn thành': 'badge-hoan-thanh'
  };

  function renderModalBody(req) {
    const doneIds = getDoneIds(req);
    const total = (req.photos || []).length;
    const pct = total ? Math.round(doneIds.length / total * 100) : 0;
    modalBody.innerHTML = `
      <h3 id="kanbanModalTitle">${req.orderCode || req.id}</h3>
      <p class="kanban-modal-meta">${req.customerName} · ${req.serviceLabel || 'Chụp ảnh'} · <span class="badge ${STATUS_BADGE_CLASS[req.status] || 'badge-dat-lich'}">${req.status}</span></p>
      <p class="kanban-modal-meta">Gửi yêu cầu ${formatRelativeTime(req.createdAt)}</p>
      ${req.note ? `<p class="kanban-modal-note">Ghi chú chung: "${req.note}"</p>` : ''}
      ${total > 0 ? `
      <div class="kanban-modal-progress" style="--col-accent:${STATUS_ACCENT[req.status] || 'var(--pink-600)'}">
        <div class="kanban-progress-track"><div class="kanban-progress-fill${pct === 100 ? ' done' : ''}" style="width:${pct}%"></div></div>
        <span class="kanban-progress-label">Đã xong ${doneIds.length}/${total} ảnh${!canEditProgress ? ' (Thợ ảnh cập nhật)' : ''}</span>
      </div>
      <div class="kanban-photo-grid">
        ${req.photos.map(p => {
          const done = doneIds.indexOf(p.id) !== -1;
          return `
          <div class="kanban-photo-tile${done ? ' done' : ''}" data-photo-id="${p.id}">
            <img src="${p.src}" alt="Ảnh ${p.id} trong yêu cầu ${req.orderCode || req.id}" loading="lazy">
            ${p.note ? `<p class="note">"${p.note}"</p>` : ''}
            ${canEditProgress
              ? `<button type="button" class="photo-done-toggle" data-photo-id="${p.id}">${done ? '✓ Đã xong' : 'Đánh dấu đã xong'}</button>`
              : `<span class="photo-done-flag${done ? ' done' : ''}">${done ? '✓ Đã xong' : 'Chưa xong'}</span>`}
          </div>`;
        }).join('')}
      </div>` : '<p class="kanban-modal-meta">Yêu cầu này chưa có dữ liệu chi tiết từng ảnh (dữ liệu cũ).</p>'}
      ${req.status !== 'Hoàn thành' ? `
      <button type="button" class="btn btn-primary kanban-modal-advance"${canAdvance(req) ? '' : ' disabled title="Thợ ảnh cần đánh dấu xong hết ảnh trước khi chuyển bước"'}>Chuyển sang bước tiếp theo →</button>` : ''}
    `;

    if (canEditProgress) {
      modalBody.querySelectorAll('.photo-done-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
          togglePhotoDone(req, btn.dataset.photoId);
          renderModalBody(req);
          renderEditRequests();
        });
      });
    }
    const advBtn = modalBody.querySelector('.kanban-modal-advance');
    if (advBtn) {
      advBtn.addEventListener('click', () => {
        if (advBtn.disabled) return;
        advance(req);
        closeModal();
        renderEditRequests();
      });
    }
  }

  renderEditRequests();
  // Mô phỏng "real-time" trong cùng trình duyệt: nếu Khách vừa gửi yêu cầu mới
  // (hoặc dữ liệu đổi ở tab/khung khác), board + badge "chưa xem" trên tab tự
  // cập nhật mà không cần tải lại trang. Không đụng vào modal đang mở (nếu có)
  // để không ngắt thao tác Thợ ảnh đang làm dở. KHÔNG đồng bộ được giữa các
  // thiết bị/trình duyệt khác nhau vì site tĩnh chưa có backend thật (xem
  // rules/tech-defaults.md mục "Giới hạn của bản hiện tại").
  setInterval(renderEditRequests, 5000);

  // ------------------------------- Doanh thu (Sếp): KPI + biểu đồ đường + mục tiêu tháng -------------------------------
  // Bố cục tham khảo ảnh dashboard người dùng cung cấp (2026-09-25), đổ đúng
  // bảng màu hồng/navy của dự án (người dùng chốt không dùng dark theme của
  // ảnh gốc - xem rules/design.md). Mọi số liệu bắt nguồn từ REVENUE_DATA duy
  // nhất dưới đây: giá trị TB/đơn, % tăng giảm, % đạt mục tiêu đều TÍNH RA từ
  // đó chứ không viết cứng riêng - tránh lỗi "số liệu các thẻ lệch nhau" mà
  // rules/design.md đã cảnh báo. Vẫn là dữ liệu minh hoạ (giống
  // CUSTOMERS/APPOINTMENTS ở trên), chưa nối vào nguồn dữ liệu thật.
  const revKpiGrid = document.getElementById('revKpiGrid');
  if (revKpiGrid) {
    const REVENUE_DATA = {
      months: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9'],
      revenue: [268, 295, 312, 305, 348, 372, 390, 421, 452], // triệu đồng
      orders: [58, 62, 66, 64, 71, 76, 79, 84, 88],
      // Chỉ tiêu tháng: giá trị minh hoạ, chờ studio xác nhận - đúng nguyên tắc
      // trong rules/tech-defaults.md (không hard-code thông số nghiệp vụ như thể
      // đã chốt; UI có ghi chú rõ đây là placeholder).
      goalRevenue: 600, goalOrders: 120, newCustomers: 320, goalNewCustomers: 400
    };
    const avgSeries = REVENUE_DATA.revenue.map((r, i) => r / REVENUE_DATA.orders[i]); // triệu/đơn
    const goalPctSeries = REVENUE_DATA.revenue.map(r => (r / REVENUE_DATA.goalRevenue) * 100);
    const last = REVENUE_DATA.months.length - 1;

    const fmtInt = n => Math.round(n).toLocaleString('vi-VN');
    const fmtDong = trieu => fmtInt(trieu * 1000000) + 'đ';
    // % thay đổi so với tháng liền trước, tự tính -> luôn khớp với biểu đồ
    const deltaPct = arr => ((arr[last] - arr[last - 1]) / arr[last - 1]) * 100;

    const ICONS = {
      money: '<path d="M12 3v18"/><path d="M16.5 7.5c0-1.7-2-2.5-4.5-2.5S7.5 5.9 7.5 7.6 9.6 10 12 10.3s4.5.9 4.5 2.7-2 2.7-4.5 2.7-4.5-.9-4.5-2.6"/>',
      order: '<path d="M4 5h2l2.2 9.4a1.6 1.6 0 0 0 1.6 1.2h7.1a1.6 1.6 0 0 0 1.6-1.2L20 8H7"/><circle cx="10" cy="19" r="1.4"/><circle cx="17.5" cy="19" r="1.4"/>',
      avg: '<path d="M4 18h16"/><path d="M4 18V9"/><path d="M4 14.5l4.5-4 3.5 3 7.5-7"/><path d="M17 5.5h3v3"/>',
      goal: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.6"/><circle cx="12" cy="12" r="1"/>'
    };
    // 4 màu accent lấy đúng bộ màu đã dùng ở Dashboard/kanban, không thêm màu mới
    const KPIS = [
      { key: 'revenue', label: 'Tổng doanh thu tháng 9', icon: ICONS.money, accent: 'var(--pink-600)', bg: 'var(--pink-50)',
        series: REVENUE_DATA.revenue, value: REVENUE_DATA.revenue[last], render: v => fmtDong(v), delta: deltaPct(REVENUE_DATA.revenue) },
      { key: 'orders', label: 'Số đơn hoàn thành', icon: ICONS.order, accent: '#1a9d5c', bg: '#e6f7ec',
        series: REVENUE_DATA.orders, value: REVENUE_DATA.orders[last], render: v => fmtInt(v) + ' đơn', delta: deltaPct(REVENUE_DATA.orders) },
      { key: 'avg', label: 'Giá trị trung bình mỗi đơn', icon: ICONS.avg, accent: 'var(--blue-600)', bg: '#e6f4ff',
        series: avgSeries, value: avgSeries[last], render: v => fmtDong(v), delta: deltaPct(avgSeries) },
      { key: 'goal', label: 'Đạt mục tiêu tháng', icon: ICONS.goal, accent: '#b06a00', bg: '#fff4e0',
        series: goalPctSeries, value: goalPctSeries[last], render: v => Math.round(v) + '%', delta: goalPctSeries[last] - goalPctSeries[last - 1] }
    ];

    // Đường cong mượt kiểu Catmull-Rom quy đổi sang cubic bezier. Độ căng để
    // thấp (0.16) để đường không vọt quá đỉnh dữ liệu -> biểu đồ không phóng đại.
    function smoothPath(pts) {
      if (pts.length < 2) return '';
      let d = 'M ' + pts[0].x.toFixed(1) + ' ' + pts[0].y.toFixed(1);
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
        const t = 0.16;
        const c1x = p1.x + (p2.x - p0.x) * t, c1y = p1.y + (p2.y - p0.y) * t;
        const c2x = p2.x - (p3.x - p1.x) * t, c2y = p2.y - (p3.y - p1.y) * t;
        d += ' C ' + c1x.toFixed(1) + ' ' + c1y.toFixed(1) + ', ' + c2x.toFixed(1) + ' ' + c2y.toFixed(1) +
             ', ' + p2.x.toFixed(1) + ' ' + p2.y.toFixed(1);
      }
      return d;
    }

    // --------- 4 thẻ KPI (sparkline vẽ dần + số đếm tăng) ---------
    revKpiGrid.innerHTML = KPIS.map((k, idx) => {
      const w = 160, h = 46, pad = 4;
      const min = Math.min.apply(null, k.series), max = Math.max.apply(null, k.series);
      const span = (max - min) || 1;
      const pts = k.series.map((v, i) => ({
        x: (i / (k.series.length - 1)) * w,
        y: pad + (1 - (v - min) / span) * (h - pad * 2 - 6)
      }));
      const line = smoothPath(pts);
      const area = line + ' L ' + w + ' ' + h + ' L 0 ' + h + ' Z';
      const up = k.delta >= 0;
      const arrow = up
        ? '<path d="M3 11.5L7.5 7l3 3L14 6.5"/><path d="M11 6.5h3v3"/>'
        : '<path d="M3 5.5L7.5 10l3-3L14 10.5"/><path d="M11 10.5h3v-3"/>';
      return '<div class="rev-kpi" style="--rev-accent:' + k.accent + '; --rev-accent-bg:' + k.bg + ';">' +
        '<div class="rev-kpi-top">' +
          '<span class="rev-kpi-label">' + k.label + '</span>' +
          '<span class="rev-kpi-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + k.icon + '</svg></span>' +
        '</div>' +
        '<div class="rev-kpi-num" data-kpi="' + idx + '">' + k.render(k.value) + '</div>' +
        '<div class="rev-kpi-trend ' + (up ? 'up' : 'down') + '">' +
          '<svg viewBox="0 0 17 17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + arrow + '</svg>' +
          (up ? '+' : '') + k.delta.toFixed(1) + (k.key === 'goal' ? ' điểm' : '%') + ' so với tháng trước' +
        '</div>' +
        '<svg class="rev-kpi-spark" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true">' +
          '<path class="spark-area" d="' + area + '"/><path class="spark-line" d="' + line + '"/>' +
        '</svg></div>';
    }).join('');

    // --------- Biểu đồ đường lớn + 3 tab đổi chỉ số ---------
    const chartWrapEl = document.getElementById('revChartWrap');
    const chartSub = document.getElementById('revChartSub');
    const METRICS = {
      revenue: { series: REVENUE_DATA.revenue, sub: 'Doanh thu từng tháng trong năm 2026',
        axis: v => Math.round(v) + 'tr', tip: v => fmtDong(v) },
      orders:  { series: REVENUE_DATA.orders, sub: 'Số đơn hoàn thành từng tháng trong năm 2026',
        axis: v => fmtInt(v), tip: v => fmtInt(v) + ' đơn' },
      avg:     { series: avgSeries, sub: 'Giá trị trung bình mỗi đơn, từng tháng trong năm 2026',
        axis: v => v.toFixed(1) + 'tr', tip: v => fmtDong(v) }
    };
    // viewBox bám đúng bề ngang thật của khối chứa (tỉ lệ 1:1) thay vì cố định
    // 720px rồi để trình duyệt co lại: nếu cố định, trên điện thoại cả biểu đồ
    // bị thu nhỏ theo và chữ trục còn chưa tới 5px, không đọc nổi.
    function chartBox() {
      const w = Math.max(Math.round(chartWrapEl.clientWidth) || 720, 260);
      const narrow = w < 480;
      return {
        VW: w,
        VH: narrow ? 250 : 300,
        PAD: { l: narrow ? 46 : 58, r: narrow ? 8 : 14, t: 16, b: 30 }
      };
    }

    // Chia trục Y theo các mốc tròn thay vì chia đều min-max (số lẻ khó đọc)
    function niceScale(min, max) {
      const span = (max - min) || 1;
      const base = Math.pow(10, Math.floor(Math.log10(span / 3)));
      const step = [1, 2, 2.5, 5, 10].map(m => m * base).find(c => span / c <= 4) || base * 10;
      return { lo: Math.floor(min / step) * step, hi: Math.ceil(max / step) * step, step: step };
    }

    let lastChartW = 0;
    function drawChart(metricKey, animate) {
      const m = METRICS[metricKey];
      const box = chartBox(), VW = box.VW, VH = box.VH, PAD = box.PAD;
      lastChartW = VW;
      const sc = niceScale(Math.min.apply(null, m.series), Math.max.apply(null, m.series));
      const plotW = VW - PAD.l - PAD.r, plotH = VH - PAD.t - PAD.b;
      const yOf = v => PAD.t + (1 - (v - sc.lo) / (sc.hi - sc.lo)) * plotH;
      const xOf = i => PAD.l + (i / (m.series.length - 1)) * plotW;
      const pts = m.series.map((v, i) => ({ x: xOf(i), y: yOf(v), v: v, lbl: REVENUE_DATA.months[i] }));

      let grid = '';
      for (let v = sc.lo; v <= sc.hi + 0.0001; v += sc.step) {
        const y = yOf(v);
        grid += '<line class="rev-grid-line" x1="' + PAD.l + '" y1="' + y.toFixed(1) + '" x2="' + (VW - PAD.r) + '" y2="' + y.toFixed(1) + '"/>' +
                '<text class="rev-axis-label" x="' + (PAD.l - 10) + '" y="' + (y + 3.5).toFixed(1) + '" text-anchor="end">' + m.axis(v) + '</text>';
      }
      const xLabels = pts.map(p => '<text class="rev-axis-label" x="' + p.x.toFixed(1) + '" y="' + (VH - 9) + '" text-anchor="middle">' + p.lbl + '</text>').join('');
      const line = smoothPath(pts);
      const area = line + ' L ' + (VW - PAD.r) + ' ' + (VH - PAD.b) + ' L ' + PAD.l + ' ' + (VH - PAD.b) + ' Z';
      const dots = pts.map((p, i) => '<circle class="rev-dot" data-i="' + i + '" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="5"/>').join('');
      const hitW = plotW / (m.series.length - 1);
      const hits = pts.map((p, i) => '<rect class="rev-hit" data-i="' + i + '" x="' + (p.x - hitW / 2).toFixed(1) + '" y="' + PAD.t + '" width="' + hitW.toFixed(1) + '" height="' + plotH.toFixed(1) + '"/>').join('');

      chartWrapEl.innerHTML =
        '<svg class="rev-chart" viewBox="0 0 ' + VW + ' ' + VH + '" role="img" aria-label="Biểu đồ: ' + m.sub + '">' +
          '<defs><linearGradient id="revAreaGradient" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0%" stop-color="#e0417a" stop-opacity="0.28"/>' +
            '<stop offset="100%" stop-color="#e0417a" stop-opacity="0.02"/>' +
          '</linearGradient></defs>' +
          grid + xLabels +
          '<path class="rev-area" d="' + area + '"/>' +
          '<line class="rev-hover-line" id="revHoverLine" y1="' + PAD.t + '" y2="' + (VH - PAD.b) + '"/>' +
          '<path class="rev-line" id="revLine" d="' + line + '"/>' + dots + hits +
        '</svg>' +
        '<div class="rev-tooltip" id="revTooltip"></div>';
      chartSub.textContent = m.sub;

      const lineEl = document.getElementById('revLine');
      const areaEl = chartWrapEl.querySelector('.rev-area');
      if (animate && !prefersReducedMotion) {
        const len = lineEl.getTotalLength();
        lineEl.style.strokeDasharray = len;
        lineEl.style.strokeDashoffset = len;
        areaEl.style.opacity = '0';
        // ép trình duyệt tính lại layout trước khi đổi giá trị, nếu không sẽ không có transition
        void lineEl.getBoundingClientRect();
        lineEl.style.transition = 'stroke-dashoffset 1.15s cubic-bezier(0.22, 1, 0.36, 1)';
        areaEl.style.transition = 'opacity 0.8s ease 0.35s';
        lineEl.style.strokeDashoffset = '0';
        areaEl.style.opacity = '1';
      }

      // Hover từng tháng: đường dóng + chấm + tooltip
      const tooltipEl = document.getElementById('revTooltip');
      const hoverLine = document.getElementById('revHoverLine');
      const dotEls = chartWrapEl.querySelectorAll('.rev-dot');
      function showPoint(i) {
        const p = pts[i];
        dotEls.forEach(d => d.classList.toggle('on', +d.dataset.i === i));
        hoverLine.setAttribute('x1', p.x.toFixed(1));
        hoverLine.setAttribute('x2', p.x.toFixed(1));
        hoverLine.classList.add('on');
        tooltipEl.innerHTML = 'Tháng ' + p.lbl.slice(1) + '<b>' + m.tip(p.v) + '</b>';
        tooltipEl.style.left = (p.x / VW * 100) + '%';
        tooltipEl.style.top = (p.y / VH * 100) + '%';
        tooltipEl.classList.add('on');
      }
      function hidePoint() {
        dotEls.forEach(d => d.classList.remove('on'));
        hoverLine.classList.remove('on');
        tooltipEl.classList.remove('on');
      }
      chartWrapEl.querySelectorAll('.rev-hit').forEach(r => {
        r.addEventListener('mouseenter', () => showPoint(+r.dataset.i));
      });
      chartWrapEl.querySelector('.rev-chart').addEventListener('mouseleave', hidePoint);
    }

    drawChart('revenue', false);
    document.querySelectorAll('#revTabs .rev-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('#revTabs .rev-tab').forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        drawChart(tab.dataset.metric, true); // vẽ lại để thấy rõ dữ liệu vừa đổi
      });
    });
    // Vẽ lại khi bề ngang khung chứa đổi: xoay ngang điện thoại, đổi cỡ cửa sổ,
    // và cả khi thu gọn/mở rộng cột menu - trường hợp cuối KHÔNG sinh sự kiện
    // resize của window (chỉ là CSS đổi), nên phải theo dõi chính khung chứa.
    // Chỉ vẽ lại khi bề ngang thật sự đổi, tránh vẽ liên tục khi thanh địa chỉ
    // trên mobile trượt lên xuống làm đổi mỗi chiều cao.
    let resizeTimer = null;
    function redrawIfWidthChanged() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (Math.abs(chartWrapEl.clientWidth - lastChartW) < 2) return;
        const active = document.querySelector('#revTabs .rev-tab.active');
        if (active) drawChart(active.dataset.metric, false);
      }, 180);
    }
    if ('ResizeObserver' in window) {
      new ResizeObserver(redrawIfWidthChanged).observe(chartWrapEl);
    } else {
      window.addEventListener('resize', redrawIfWidthChanged);
    }

    // --------- Mục tiêu tháng (thanh tiến độ) ---------
    const GOALS = [
      { name: 'Doanh thu', cur: REVENUE_DATA.revenue[last], goal: REVENUE_DATA.goalRevenue,
        accent: 'var(--pink-600)', detail: (c, g) => fmtDong(c) + ' / ' + fmtDong(g) },
      { name: 'Đơn hoàn thành', cur: REVENUE_DATA.orders[last], goal: REVENUE_DATA.goalOrders,
        accent: '#1a9d5c', detail: (c, g) => fmtInt(c) + ' / ' + fmtInt(g) + ' đơn' },
      { name: 'Khách hàng mới', cur: REVENUE_DATA.newCustomers, goal: REVENUE_DATA.goalNewCustomers,
        accent: 'var(--blue-600)', detail: (c, g) => fmtInt(c) + ' / ' + fmtInt(g) + ' khách' }
    ];
    const goalsWrap = document.getElementById('revGoals');
    goalsWrap.innerHTML = GOALS.map(g => {
      const pct = Math.round((g.cur / g.goal) * 100);
      return '<div class="rev-goal" style="--rev-accent:' + g.accent + ';">' +
        '<div class="rev-goal-top"><span class="rev-goal-name">' + g.name + '</span><span class="rev-goal-pct">' + pct + '%</span></div>' +
        '<div class="rev-goal-track"><div class="rev-goal-bar" data-pct="' + pct + '"></div></div>' +
        '<div class="rev-goal-detail">' + g.detail(g.cur, g.goal) + '</div></div>';
    }).join('');

    // --------- Chạy hiệu ứng khi cuộn tới, và mỗi lần bấm lại mục Doanh thu ---------
    // Section admin được fade-in bởi khối phía dưới nên biểu đồ chỉ nên vẽ khi
    // đã thật sự lọt vào khung nhìn, nếu không người dùng sẽ bỏ lỡ hiệu ứng.
    registerAnim('doanh-thu', document.getElementById('doanh-thu'), () => {
      // Số KPI không đặt về 0 ở đây: countUp vốn đã đếm từ 0, còn đặt sẵn 0
      // thì trước khi người dùng cuộn tới, mục Doanh thu trông như chưa có số
      // liệu nào - dự án quy định nội dung không bao giờ được để trống.
      goalsWrap.querySelectorAll('.rev-goal-bar').forEach(bar => { bar.style.width = '0%'; });
    }, () => {
      goalsWrap.querySelectorAll('.rev-goal-bar').forEach(bar => { bar.style.width = bar.dataset.pct + '%'; });
      if (prefersReducedMotion) return;
      drawChart(document.querySelector('#revTabs .rev-tab.active').dataset.metric, true);
      revKpiGrid.querySelectorAll('.rev-kpi-num').forEach(el => {
        const k = KPIS[+el.dataset.kpi];
        countUp(el, k.value, k.render, 900);
      });
      // Sparkline vẽ dần, lệch nhau một chút cho đỡ bật đồng loạt
      revKpiGrid.querySelectorAll('.spark-line').forEach((p, i) => drawStroke(p, 1, i * 0.08));
    });
  }

  // ------------------------------- Fade-in tối giản khi cuộn -------------------------------
  // Tôn trọng prefers-reduced-motion giống .reveal ở phần khách hàng (style.css)
  // -> không set opacity:0 ngay từ đầu, tránh nội dung "biến mất" cho người dùng
  // đã bật giảm hiệu ứng nếu IntersectionObserver không kịp chạy.
  const revealSections = document.querySelectorAll('.admin-section');
  if (!prefersReducedMotion) {
    revealSections.forEach(s => { s.style.opacity = '0'; s.style.transform = 'translateY(10px)'; s.style.transition = 'opacity 0.5s ease, transform 0.5s ease'; });
  }
  if (!prefersReducedMotion && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0, rootMargin: '0px 0px -5% 0px' });
    revealSections.forEach(s => observer.observe(s));
  } else {
    revealSections.forEach(s => { s.style.opacity = '1'; s.style.transform = 'none'; });
  }
});
