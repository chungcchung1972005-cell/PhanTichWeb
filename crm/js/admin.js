// ALOHA Baby — Khu vực quản trị dùng chung 1 file cho 3 vai trò nội bộ
// (Sale/CSKH, Thợ ảnh, Sếp). Dữ liệu DEMO tĩnh (minh hoạ bố cục), không phải
// số liệu thật, không kết nối API nào. Xem js/auth.js cho phần phân quyền.
document.addEventListener('DOMContentLoaded', () => {

  const session = AlohaAuth.getSession();
  const role = session ? session.role : null;
  document.getElementById('userName').textContent = (session && session.name) || 'Người dùng';
  document.getElementById('userRole').textContent = AlohaAuth.roleLabel(role);

  // ------------------------------- Dữ liệu đồng bộ từ Không gian Sale (crm/js/sale-data.js) -------------------------------
  const saleDb = window.ALOHA_SALE_DATA ? JSON.parse(JSON.stringify(window.ALOHA_SALE_DATA)) : null;
  const SALE_NAMES = {
    'ngoc-anh': 'Ngọc Anh',
    'minh-thu': 'Minh Thư',
    'thu-ha': 'Thu Hà',
    'quoc-bao': 'Quốc Bảo',
    'hai-yen': 'Hải Yến'
  };

  const pad2 = n => String(n).padStart(2, '0');
  const dateKey = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  const parseKey = k => { const parts = k.split('-').map(Number); return new Date(parts[0], parts[1] - 1, parts[2]); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

  if (saleDb && saleDb.now) {
    const TODAY = dateKey(new Date());
    const shiftDays = Math.round((parseKey(TODAY) - parseKey(saleDb.now.slice(0, 10))) / 864e5);
    if (shiftDays) {
      const baseYear = Number(saleDb.now.slice(0, 4));
      const iso = (s) => s.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (m, y, mo, d) => dateKey(addDays(new Date(+y, mo - 1, +d), shiftDays)));
      const dm = (s) => s.replace(/\b(\d{2})\/(\d{2})(\/(\d{4}))?\b(?!\s*ảnh)/g, (m, d, mo, _, y) => {
        if (+mo < 1 || +mo > 12 || +d < 1 || +d > 31) return m;
        const x = addDays(new Date(y ? +y : baseYear, mo - 1, +d), shiftDays);
        return pad2(x.getDate()) + '/' + pad2(x.getMonth() + 1) + (y ? '/' + x.getFullYear() : '');
      });
      const walk = (o) => {
        Object.keys(o).forEach(k => {
          const v = o[k];
          if (typeof v === 'string') o[k] = dm(iso(v));
          else if (v && typeof v === 'object') walk(v);
        });
      };
      ['customers', 'appointments', 'deposits', 'unmatched', 'orders', 'conversations', 'transfers', 'sales'].forEach(k => walk(saleDb[k]));
    }
  }

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

  // ------------------------------- Dữ liệu Không gian Sale (dùng chung: Phễu, Khách hàng, Lịch hẹn) -------------------------------
  // Nguồn dữ liệu: hồ sơ khách + lịch chụp + đơn của Không gian Sale (crm/js/sale-data.js),
  // người dùng yêu cầu 2026-10-12 để Sếp xem đúng dữ liệu các sale đang chăm. Đây là bản
  // sao tĩnh của dữ liệu demo: thao tác trên crm/sale.html chỉ sống trong bộ nhớ trang
  // đó nên không chảy sang đây.
  //
  // Dữ liệu demo viết quanh ngày gốc `now`; giống shiftDemoDates trong crm/js/sale.js,
  // MỌI ngày (2026-09-25, 25/09, 25/09/2026) được dời theo số ngày từ ngày gốc tới hôm
  // nay thật ngay khi nạp, nên ngày ở đây khớp từng ngày với bên Không gian Sale.
  const SALE_SRC = window.ALOHA_SALE_DATA || null;
  const p2 = n => String(n).padStart(2, '0');
  const isoKey = d => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
  const SALE_TODAY = isoKey(new Date());
  function saleDayDiff(isoDate) {
    const [y, m, d] = isoDate.split('-').map(Number);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.round((today - new Date(y, m - 1, d)) / 864e5);
  }
  const SALE_DB = SALE_SRC ? shiftSaleData(JSON.parse(JSON.stringify(SALE_SRC)), saleDayDiff(SALE_SRC.now.slice(0, 10))) : null;

  function shiftSaleData(db, days) {
    if (!days) return db;
    const baseYear = Number(db.now.slice(0, 4));
    const iso = s => s.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (m, y, mo, d) => isoKey(new Date(+y, mo - 1, +d + days)));
    const dm = s => s.replace(/\b(\d{2})\/(\d{2})(\/(\d{4}))?\b(?!\s*ảnh)/g, (m, d, mo, _, y) => {
      if (+mo < 1 || +mo > 12 || +d < 1 || +d > 31) return m;
      const x = new Date(y ? +y : baseYear, mo - 1, +d + days);
      return p2(x.getDate()) + '/' + p2(x.getMonth() + 1) + (y ? '/' + x.getFullYear() : '');
    });
    const walk = o => Object.keys(o).forEach(k => {
      const v = o[k];
      if (typeof v === 'string') o[k] = dm(iso(v));
      else if (v && typeof v === 'object') walk(v);
    });
    ['customers', 'appointments', 'deposits', 'orders', 'transfers', 'sales'].forEach(k => walk(db[k]));
    return db;
  }

  // Nhóm khách tự suy ra từ dữ liệu, cùng quy tắc với cusGroup/shootCount trong
  // crm/js/sale.js (sửa bên đó thì sửa cả ở đây).
  const SALE_GROUPS = {
    'tiem-nang': { label: 'Tiềm năng', tone: 'amber' },
    'cho-coc': { label: 'Chờ cọc', tone: 'red' },
    'da-chot': { label: 'Đã chốt', tone: 'blue' },
    'da-chup': { label: 'Đã chụp', tone: 'teal' },
    'khach-quen': { label: 'Khách quen', tone: 'peach' },
    'khong-mua': { label: 'Không mua', tone: 'muted' }
  };
  function saleShootCount(c) {
    const linked=window.AlohaWorkflow && AlohaWorkflow.get() && AlohaWorkflow.get().orders.filter(o=>o.phone===c.phone);
    if(linked && linked.length)return linked.filter(o=>o.shotAt).length;
    if (c.history) return c.history.filter(h => h.shoot).length;
    if (!c.stage) return c.lost ? 0 : 1;
    if (c.stage !== 'da-chot') return 0;
    return (c.status.text === 'Đã chụp' || SALE_DB.orders.some(o => o.customerId === c.id) ||
      SALE_DB.appointments.some(a => a.customerId === c.id && a.date < SALE_TODAY)) ? 1 : 0;
  }
  function saleGroupOf(c) {
    if (c.lost) return 'khong-mua';
    if (['moi', 'tu-van', 'bao-gia'].includes(c.stage)) return 'tiem-nang';
    if (c.stage === 'cho-coc') return 'cho-coc';
    const n = saleShootCount(c);
    return n >= 2 ? 'khach-quen' : n === 1 ? 'da-chup' : 'da-chot';
  }

  function fmtSalePhone(p) {
    const d = String(p).replace(/\D/g, '');
    return d.slice(0, 4) + ' ' + d.slice(4, 7) + ' ' + d.slice(7);
  }
  function maskSalePhone(p) {
    const d = String(p).replace(/\D/g, '');
    return d.slice(0, 4) + ' *** ' + d.slice(-3);
  }
  const saleName = id => ((SALE_DB && SALE_DB.sales.find(s => s.id === id)) || {}).name || '';
  // Sale mở trang này chỉ thấy liên hệ/ghi chú khách của chính mình (như Không gian Sale);
  // Sếp thấy đủ.
  const SALE_ME = SALE_DB && role === 'sale' ? SALE_DB.sales.find(s => s.phone === (session && session.phone)) : null;
  const canSeeContact = ownerId => role !== 'sale' || (!!SALE_ME && SALE_ME.id === ownerId);

  // ------------------------------- Phễu khách hàng (chỉ Sếp) -------------------------------
  // Mỗi bậc phễu 1 màu riêng, khớp đúng màu badge trạng thái đã dùng ở bảng
  // Khách hàng/CRM (badge-quan-tam/tu-van/dat-lich/da-chup/hoan-thanh) và ở
  // KPI card phía trên - để phễu đọc thành 1 dải màu chuyển tiếp thay vì
  // thanh hồng đơn sắc lặp lại 5 lần.
  //
  // Số liệu đếm từ hồ sơ khách của Không gian Sale (người dùng yêu cầu 2026-10-12,
  // giữ nguyên giao diện 5 bậc). Mỗi bậc là số khách ĐÃ ĐI TỚI ít nhất bậc đó (cộng
  // dồn), nên phễu luôn hẹp dần:
  //  - Khách quan tâm: mọi khách có hồ sơ.
  //  - Đã tư vấn: đã qua bậc "Mới" (kể cả khách không mua - đã tư vấn rồi mới rẽ nhánh).
  //  - Đã đặt lịch: có khung giờ chụp (Chờ cọc giữ chỗ, Đã chốt, hoặc khách cũ đã từng chụp).
  //  - Đã chụp: nhóm Đã chụp / Khách quen (saleGroupOf).
  //  - Hoàn thành: đã chụp và không còn đơn ảnh nào chưa giao.
  function saleFunnelCounts() {
    const list = SALE_DB ? SALE_DB.customers : [];
    const shot = c => ['da-chup', 'khach-quen'].includes(saleGroupOf(c));
    const openOrder = c => SALE_DB.orders.some(o => o.customerId === c.id && o.status !== 'da-giao');
    return [
      list.length,
      list.filter(c => c.stage !== 'moi').length,
      list.filter(c => !c.lost && ['cho-coc', 'da-chot', null].includes(c.stage)).length,
      list.filter(shot).length,
      list.filter(c => shot(c) && !openOrder(c)).length
    ];
  }
  const funnelCounts = saleFunnelCounts();
  const FUNNEL_DATA = [
    { name: 'Khách quan tâm', val: funnelCounts[0], color: '#4148c9' },
    { name: 'Đã tư vấn', val: funnelCounts[1], color: '#b06a00' },
    { name: 'Đã đặt lịch', val: funnelCounts[2], color: 'var(--pink-600)' },
    { name: 'Đã chụp', val: funnelCounts[3], color: 'var(--blue-600)' },
    { name: 'Hoàn thành', val: funnelCounts[4], color: '#1a9d5c' }
  ];
  const funnelWrap = document.getElementById('funnelChart');
  if (funnelWrap) {
    const funnelMax = FUNNEL_DATA[0].val || 1; // không có dữ liệu thì mọi thanh 0%, không chia cho 0
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
    // Luôn lấy số từ cùng nguồn với Phễu bên dưới (kể cả khi chưa có khách) để 2 khối không
    // lệch nhau; chưa có khách thì thay dòng "so với kỳ trước" mẫu bằng lời báo chưa có dữ liệu.
    if (SALE_DB && Array.isArray(SALE_DB.customers)) {
      const noData = !SALE_DB.customers.length;
      const qCards = [
        { sel: '.kpi-quan-tam', val: funnelCounts[0] },
        { sel: '.kpi-tu-van', val: funnelCounts[1] },
        { sel: '.kpi-dat-lich', val: funnelCounts[2] },
        { sel: '.kpi-da-chup', val: funnelCounts[3] },
        { sel: '.kpi-hoan-thanh', val: funnelCounts[4] }
      ];
      qCards.forEach(c => {
        const num = kpiGrid.querySelector(c.sel + ' .num');
        if (num) num.textContent = c.val;
        const trend = kpiGrid.querySelector(c.sel + ' .trend');
        if (trend && noData) { trend.textContent = 'Chưa có dữ liệu'; trend.className = 'trend'; }
      });
    }
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

  // ------------------------------- Hiệu suất Đội ngũ Sale & Duyệt chuyển giao (chỉ Sếp) -------------------------------
  const salePerfGrid = document.getElementById('salePerfGrid');
  if (salePerfGrid && SALE_DB && SALE_DB.sales) {
    salePerfGrid.innerHTML = SALE_DB.sales.map(s => {
      const pct = Math.min(100, Math.round(s.achieved / s.target * 100));
      const custCount = (SALE_DB.customers || []).filter(c => c.owner === s.id).length;
      const initials = customerInitials(s.name);
      const isLeave = s.leave && s.leave.from;
      return `
        <div class="sale-perf-card">
          <div class="sale-perf-head">
            <span class="sale-perf-av">${escHtml(initials)}</span>
            <div style="flex:1; min-width:0;">
              <div class="sale-perf-name">${escHtml(s.name)}</div>
              <div class="sale-perf-role">SĐT: ${escHtml(s.phone)} · Phản hồi ${s.responseMin == null ? 'chưa có số liệu' : '~' + s.responseMin + 'p'}</div>
            </div>
            <span class="badge ${isLeave ? 'badge-tu-van' : 'badge-hoan-thanh'} sale-perf-badge">${isLeave ? 'Nghỉ phép' : 'Đang trực'}</span>
          </div>
          <div>
            <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:5px;">
              <span>Doanh số: <strong>${s.achieved}tr</strong> / ${s.target}tr</span>
              <strong style="color:var(--pink-600);">${pct}%</strong>
            </div>
            <div class="sale-perf-track">
              <div class="sale-perf-fill" style="width:${pct}%;"></div>
            </div>
          </div>
          <div class="sale-perf-stat-row">
            <span>Khách đang phụ trách:</span>
            <strong>${custCount} khách</strong>
          </div>
        </div>
      `;
    }).join('');
  }

  const transferListEl = document.getElementById('saleTransferList');
  const transferCountEl = document.getElementById('saleTransferPendingCount');
  if (transferListEl && SALE_DB && SALE_DB.transfers) {
    function renderTransferApprovals() {
      const pending = SALE_DB.transfers.filter(t => t.status === 'cho-duyet');
      if (transferCountEl) transferCountEl.textContent = pending.length + ' yêu cầu chờ duyệt';

      if (!pending.length) {
        transferListEl.innerHTML = '<p style="font-size:13px; color:var(--navy-500); margin:6px 0;">Hiện không có yêu cầu chuyển giao nào chờ quản lý duyệt.</p>';
        return;
      }

      transferListEl.innerHTML = pending.map(t => {
        const fromName = SALE_NAMES[t.from] || t.from;
        const toName = SALE_NAMES[t.to] || t.to;
        return `
          <div class="sale-transfer-card">
            <div class="sale-transfer-info">
              <span class="sale-transfer-title">${escHtml(t.names ? t.names.join(', ') : 'Khách hàng')}</span>
              <span class="sale-transfer-desc">
                Từ: <strong>${escHtml(fromName)}</strong> &rarr; Đến: <strong>${escHtml(toName)}</strong> · Lý do: <em>${escHtml(t.reason)}</em> · Gửi lúc: ${escHtml(t.createdAt)}
              </span>
              ${t.note ? `<span style="font-size:12px; color:var(--navy-700); margin-top:3px;">"${escHtml(t.note)}"</span>` : ''}
            </div>
            <div>
              <button type="button" class="btn btn-primary btn-sm btn-approve-transfer" data-tr-id="${escHtml(t.id)}">Duyệt chuyển giao</button>
            </div>
          </div>
        `;
      }).join('');

      transferListEl.querySelectorAll('.btn-approve-transfer').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.trId;
          const tr = SALE_DB.transfers.find(x => x.id === id);
          if (tr) {
            tr.status = 'cho-nhan';
            tr.approvedAt = new Date().toLocaleString('vi-VN');
            alert('Đã duyệt chuyển giao khách: ' + (tr.names ? tr.names.join(', ') : '') + ' sang cho ' + (SALE_NAMES[tr.to] || tr.to) + ' thành công!');
            renderTransferApprovals();
          }
        });
      });
    }
    renderTransferApprovals();
  }

  // ------------------------------- Khách hàng (Sếp + Sale): Bảng giai đoạn + Danh sách -------------------------------
  // Người dùng yêu cầu 2026-10-12: thiết kế giống trang Khách hàng của Không gian Sale
  // (viewCustomers trong crm/js/sale.js), có 2 kiểu xem:
  //  - "Bảng giai đoạn": kanban 5 bậc phễu mở (Mới -> Đã chốt), chỉ khách đang trong phễu.
  //  - "Danh sách": mọi khách, chia nhóm Tiềm năng/Chờ cọc/Đã chốt/Đã chụp/Khách quen/
  //    Không mua (tự suy ra, saleGroupOf), bấm 1 dòng xem hồ sơ ở cột phải.
  // Khác bên Sale: ở đây CHỈ XEM (không kéo thả đổi giai đoạn, không gọi/nhắn/tạo lịch -
  // đó là việc của sale phụ trách), mỗi thẻ ghi rõ sale phụ trách. Sale mở trang này thì
  // khách của sale khác bị che SĐT và ẩn ghi chú như bên Không gian Sale.
  // CSS: khối .ck-* cuối css/admin.css (không nạp css/sale.css vì file đó có quy tắc toàn trang).

  // Avatar chữ viết tắt (dùng chung với mục Tin nhắn): tính lại từ tên mỗi lần vẽ.
  // Quy tắc: chữ cái đầu của từ đầu + từ cuối, bỏ danh xưng ("Chị Thu Trang" -> TT,
  // "Anh Sơn" -> SƠ); tên chỉ 1 từ thì lấy 2 chữ đầu.
  function customerInitials(name) {
    const words = String(name || '').normalize('NFC').trim().replace(/^(Chị|Anh|Bé)\s+/i, '').split(/\s+/)
      .filter(w => /^\p{L}/u.test(w));
    if (!words.length) return '?';
    const first = words[0];
    const second = words.length > 1 ? words[words.length - 1][0] : (first[1] || '');
    return (first[0] + second).toLocaleUpperCase('vi');
  }

  // Màu avatar: băm theo SĐT (định danh ổn định của khách) - xem .cust-av-* trong css/admin.css.
  const CUST_AV_TONES = 5;
  function customerTone(key) {
    let h = 0;
    for (const ch of String(key)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
    return h % CUST_AV_TONES;
  }
  const svgIcon = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function custPerson(c, subline) {
    return `<div class="cust-person">
      <span class="cust-av cust-av-${customerTone(c.phone)}" aria-hidden="true">${escHtml(customerInitials(c.name))}</span>
      <span class="cust-person-text"><span class="cust-name">${escHtml(c.name)}</span><span class="cust-sub">${escHtml(subline)}</span></span>
    </div>`;
  }

  // ------------------------------- Khách hàng / CRM (Bảng giai đoạn + Danh sách) -------------------------------
  const custView = document.getElementById('custView');
  if (custView) {
    const CK_ICON = {
      filter: '<path d="M3 4h18l-7 8.5V19l-4 2v-8.5z"/>',
      users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2.2.6 3.5 2.8 3.5 6"/>',
      user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
      clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v9H5v-9M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
      lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
      search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
      arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>'
    };
    const ic = name => svgIcon(CK_ICON[name] || '');

    const STAGES = [
      { id: 'moi', label: 'Mới' },
      { id: 'tu-van', label: 'Đang tư vấn' },
      { id: 'bao-gia', label: 'Đã báo giá' },
      { id: 'cho-coc', label: 'Chờ đặt cọc' },
      { id: 'da-chot', label: 'Đã chốt' }
    ];
    const stageLabel = id => (STAGES.find(s => s.id === id) || { label: 'Khách cũ' }).label;
    const SVC_TONE = { 'Newborn': 'teal', 'Gia đình': 'blue', 'Bầu': 'peach', 'Sinh nhật': 'amber', 'Bé lớn': 'purple', 'Tại nhà': 'beige' };
    const SERVICES = ['Newborn', 'Bé lớn', 'Sinh nhật', 'Bầu', 'Gia đình', 'Tại nhà'];
    const AP_TEXT = { 'checkin': 'Đã check-in', 'da-coc': 'Đã cọc', 'chua-thu-du': 'Chưa thu đủ', 'giu-cho': 'Giữ chỗ, chưa cọc' };
    const ORD_TEXT = { 'cho-chon': 'Chờ khách chọn ảnh', 'dang-chinh': 'Thợ ảnh đang chỉnh', 'qua-han': 'Quá hạn giao', 'cho-duyet': 'Chờ khách duyệt', 'da-giao': 'Đã giao ảnh' };

    const all = SALE_DB ? SALE_DB.customers : [];
    const SOURCES = Array.from(new Set(all.map(c => c.source)));
    const ui = { mode: 'bang', owner: '', source: '', service: '', q: '', group: 'all', bday: false, selected: null };
    // Rút gọn (người dùng yêu cầu 2026-10-15): mỗi cột Bảng giai đoạn hiện 5 khách đầu,
    // Danh sách hiện 10 khách đầu; "Xem thêm" mở tiếp từng đợt cùng cỡ. Đổi bộ lọc/kiểu xem thì thu gọn lại.
    const BOARD_STEP = 5, LIST_STEP = 10;
    let boardLimit = {}, listLimit = LIST_STEP;
    const resetLimits = () => { boardLimit = {}; listLimit = LIST_STEP; };
    const moreBtn = (act, id, rest, step, canLess) => '<div class="ck-more">' +
      (rest > 0 ? `<button type="button" class="ck-btn ck-btn-sm" data-ck="${act}" data-id="${id}">Xem thêm ${Math.min(rest, step)} khách <span class="ck-muted">(còn ${rest})</span></button>` : '') +
      (canLess ? `<button type="button" class="ck-btn ck-btn-sm" data-ck="${act}-less" data-id="${id}">Thu gọn</button>` : '') + '</div>';

    const parseIso = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
    const fmtDM = k => { const d = parseIso(k); return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1); };
    const fmtDMY = k => fmtDM(k) + '/' + parseIso(k).getFullYear();
    const money = n => Number(n).toLocaleString('vi-VN') + 'đ';
    const fold = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
    const tag = s => `<span class="ck-tag tone-${SVC_TONE[s] || 'beige'}">${escHtml(s)}</span>`;
    const badge = (text, tone) => `<span class="ck-tag tone-${tone || 'muted'}">${escHtml(text)}</span>`;
    const phoneOf = c => canSeeContact(c.owner) ? fmtSalePhone(c.phone) : maskSalePhone(c.phone);
    const roNote = c => `<p class="ck-ro">${ic('lock')}<span>Khách do <strong>${escHtml(saleName(c.owner))}</strong> phụ trách · chỉ xem</span></p>`;

    // ----- Thông tin bé, việc tiếp theo, lịch sử: cùng cách suy ra với crm/js/sale.js -----
    function ageText(k) {
      const days = Math.round((parseIso(SALE_TODAY) - parseIso(k)) / 864e5);
      if (days < 0) return 'chưa sinh';
      if (days < 60) return days + ' ngày tuổi';
      return Math.floor(days / 30.4) + ' tháng tuổi';
    }
    function nextMilestone(b) {
      if (!b || b.kind !== 'birth') return null;
      const born = parseIso(b.date); const today = parseIso(SALE_TODAY);
      const cands = [{ label: 'tròn 100 ngày', d: new Date(born.getFullYear(), born.getMonth(), born.getDate() + 100) }];
      for (let y = 1; y <= 12; y++) cands.push({ label: 'tròn ' + y + ' tuổi', d: new Date(born.getFullYear() + y, born.getMonth(), born.getDate()) });
      const hit = cands.find(x => x.d >= today && (x.d - today) / 864e5 <= 30);
      return hit ? { label: hit.label, key: isoKey(hit.d), birthday: /tuổi/.test(hit.label) } : null;
    }
    function babyText(c) {
      const b = c.baby;
      if (!b) return 'Chưa có';
      if (b.kind === 'due') return 'Dự sinh ' + fmtDM(b.date);
      const m = nextMilestone(b);
      if (m) return (b.name || 'Bé') + ' ' + m.label + ' ' + fmtDM(m.key);
      return (b.name ? b.name + ', ' : 'Bé ') + ageText(b.date);
    }
    const nextAppointment = c => (SALE_DB.appointments || []).filter(a => a.customerId === c.id && a.date >= SALE_TODAY)
      .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))[0];
    function nextStep(c) {
      if (c.lost) return { text: 'Gửi lại khi có khuyến mại', tone: 'muted' };
      const dep = (SALE_DB.deposits || []).find(d => d.customerId === c.id && d.state !== 'confirmed');
      if (dep && (dep.state === 'sent' || dep.state === 'opened')) return { text: 'Nhắc cọc trước ' + dep.holdUntil, tone: 'red' };
      if (dep && dep.state === 'paid') return { text: 'Xác nhận cọc ' + money(dep.received), tone: 'blue' };
      if (dep && dep.state === 'short') return { text: 'Kiểm tra cọc thiếu', tone: 'red' };
      const ap = nextAppointment(c);
      if (ap && ap.status !== 'giu-cho') return { text: 'Chụp ' + ap.service + ' ' + fmtDM(ap.date) + ' ' + ap.start, tone: '' };
      const o = (SALE_DB.orders || []).find(x => x.customerId === c.id && x.status === 'cho-chon');
      if (o) return { text: 'Nhắc chọn ảnh (' + o.picked + '/' + o.total + ')', tone: 'amber' };
      const m = !c.stage && nextMilestone(c.baby);
      if (m) return { text: m.birthday ? 'Ưu đãi sinh nhật ' + m.label.replace('tròn ', '') : 'Ưu đãi chụp 100 ngày', tone: 'red' };
      if (c.stage === 'moi' && c.status && c.status.tone === 'red') return { text: 'Liên hệ lần đầu', tone: 'red' };
      return { text: (c.status && c.status.text) || '', tone: (c.status && c.status.tone === 'muted' ? '' : (c.status && c.status.tone)) || '' };
    }
    function cusHistory(c) {
      if (c.history) return c.history;
      const out = [];
      (SALE_DB.appointments || []).filter(a => a.customerId === c.id && a.date >= SALE_TODAY).forEach(a =>
        out.push({ date: fmtDM(a.date), text: 'Lịch chụp ' + a.service + ' ' + a.start + ' · ' + (AP_TEXT[a.status] || a.status), shoot: false }));
      (SALE_DB.orders || []).filter(o => o.customerId === c.id).forEach(o =>
        out.push({ date: o.date, text: 'Chụp ' + o.service + ' · đơn #' + o.code + ' · ' + (ORD_TEXT[o.status] || o.status).toLowerCase(), shoot: true }));
      out.push({ date: 'Lần đầu', text: 'Liên hệ qua ' + c.source + (c.lost ? ' · không mua (' + c.lost.reason.toLowerCase() + ')' : ''), shoot: false });
      return out;
    }

    // ----- Lọc chung cho cả 2 kiểu xem -----
    function filtered() {
      const q = fold(ui.q.trim()); const qd = ui.q.replace(/\D/g, '');
      return all.filter(c =>
        (!ui.owner || c.owner === ui.owner) &&
        (!ui.source || c.source === ui.source) &&
        (!ui.service || c.service === ui.service) &&
        (!q || fold(c.name).includes(q) || (qd.length >= 3 && canSeeContact(c.owner) && c.phone.includes(qd))));
    }

    function toolbar() {
      const seg = '<div class="ck-seg" role="tablist" aria-label="Kiểu xem">' +
        [['bang', 'Bảng giai đoạn', 'filter'], ['danh-sach', 'Danh sách', 'users']].map(([k, l, i]) =>
          `<button type="button" role="tab" aria-selected="${ui.mode === k}" class="${ui.mode === k ? 'on' : ''}" data-ck="mode" data-id="${k}">${ic(i)}${l}</button>`).join('') + '</div>';
      const sel = (name, label, opts, val, icon) => `<label class="ck-pill">${ic(icon || 'filter')}<span>${label}:</span><select data-ck-filter="${name}" aria-label="Lọc theo ${label.toLowerCase()}">` +
        `<option value="">${name === 'owner' ? 'Tất cả sale' : 'Tất cả'}</option>` +
        opts.map(o => `<option value="${escHtml(o.v)}"${o.v === val ? ' selected' : ''}>${escHtml(o.l)}</option>`).join('') + '</select></label>';
      const leads = filtered().filter(c => c.stage);
      const rate = leads.length ? Math.round(leads.filter(c => c.stage === 'da-chot').length / leads.length * 100) : 0;
      const rs = ui.owner ? (SALE_DB.sales || []).find(s => s.id === ui.owner) : null;
      const known = (rs ? [rs] : (SALE_DB.sales || [])).filter(s => s.responseMin != null);
      const respMin = known.length ? Math.round(known.reduce((t, s) => t + s.responseMin, 0) / known.length) + ' phút' : '—';
      return '<div class="ck-toolbar">' + seg +
        sel('owner', 'Sale phụ trách', (SALE_DB.sales || []).map(s => ({ v: s.id, l: s.name })), ui.owner, 'users') +
        sel('source', 'Nguồn', SOURCES.map(s => ({ v: s, l: s })), ui.source) +
        sel('service', 'Dịch vụ', SERVICES.map(s => ({ v: s, l: s })), ui.service) +
        `<label class="ck-pill ck-search">${ic('search')}<input type="search" data-ck-search value="${escHtml(ui.q)}" placeholder="Tìm tên hoặc SĐT..." aria-label="Tìm khách theo tên hoặc SĐT"></label>` +
        (ui.mode === 'bang'
          ? `<p class="ck-stats">Tỉ lệ chốt: <strong>${rate}%</strong> · Thời gian phản hồi TB: <strong>${respMin}</strong></p>`
          : `<button type="button" class="ck-pill${ui.bday ? ' on' : ''}" data-ck="bday" aria-pressed="${ui.bday}">${ic('gift')}<span>Có bé sắp sinh nhật</span></button>`) +
      '</div>';
    }

    function leadCard(c) {
      const ro = !canSeeContact(c.owner);
      return `<article class="ck-card${ro ? ' ck-card-ro' : ''}">
        <div class="ck-card-top"><strong>${escHtml(c.name)}</strong>${tag(c.service)}</div>
        <small class="ck-muted">${escHtml(c.source)} · ${escHtml(c.since)}</small>
        <p class="ck-status c-${c.status.tone}">${ic('clock')}${escHtml(c.status.text)}</p>
        <div class="ck-card-foot">
          <span class="ck-owner">${ro ? ic('lock') : ic('user')}${escHtml(saleName(c.owner))}</span>
          <button type="button" class="ck-btn ck-btn-sm" data-ck="profile" data-id="${c.id}" aria-label="Xem hồ sơ ${escHtml(c.name)}">Hồ sơ${ic('arrow')}</button>
        </div>
      </article>`;
    }

    function board(list) {
      const leads = list.filter(c => c.stage);
      return '<div class="ck-board">' + STAGES.map(s => {
        const cards = leads.filter(c => c.stage === s.id);
        const limit = boardLimit[s.id] || BOARD_STEP;
        const more = cards.length > BOARD_STEP ? moreBtn('more-col', s.id, cards.length - limit, BOARD_STEP, limit > BOARD_STEP) : '';
        return `<section class="ck-col" aria-label="${s.label}"><header><h3>${s.label}</h3><span>${cards.length}</span></header>` +
          (cards.length ? cards.slice(0, limit).map(leadCard).join('') + more : '<p class="ck-empty">Chưa có khách</p>') + '</section>';
      }).join('') + '</div>';
    }

    function detail(c) {
      const g = SALE_GROUPS[saleGroupOf(c)];
      const b = c.baby; const m = b && nextMilestone(b);
      const see = canSeeContact(c.owner);
      return `<div class="ck-detail">
        <div class="ck-id"><span class="cust-av cust-av-${customerTone(c.phone)} ck-avatar" aria-hidden="true">${escHtml(customerInitials(c.name))}</span>
          <div><h3>${escHtml(c.name)}</h3><p class="ck-muted">${escHtml(phoneOf(c))} · ${escHtml(c.area)}</p></div></div>
        <div class="ck-tags">${badge(g.label, g.tone)}${tag(c.service)}<span class="ck-tag tone-beige">Phụ trách: ${escHtml(saleName(c.owner))}</span></div>
        ${see ? '' : roNote(c)}
        <div class="ck-soft"><small class="ck-label">Các bé</small>
          ${b ? `<div class="ck-baby"><strong>${escHtml(b.name || 'Bé')}</strong><span class="ck-muted">${b.kind === 'due' ? 'dự sinh ' + fmtDMY(b.date) : 'sinh ' + fmtDMY(b.date) + ' · ' + ageText(b.date)}</span></div>` +
            (m ? `<p class="ck-offer">${ic('gift')}<span>Bé sắp ${m.label} (${fmtDM(m.key)}). Gợi ý gói ${m.birthday ? 'Sinh nhật' : 'chụp 100 ngày'}.</span></p>` : '')
          : '<p class="ck-muted">Chưa có thông tin bé</p>'}
        </div>
        <div class="ck-stats-3"><div><strong>${saleShootCount(c)}</strong><small>Đơn đã chụp</small></div>
          <div><strong>[Tổng]</strong><small>Tổng đã chi</small></div>
          <div><strong>${c.referrals || 0}</strong><small>Khách giới thiệu</small></div></div>
        <small class="ck-label">Tình trạng</small>
        <p class="ck-status c-${c.status.tone}">${ic('clock')}${escHtml(c.status.text)} <span class="ck-muted">· ${escHtml(c.since)}</span></p>
        <small class="ck-label">Lịch sử với studio</small>
        <ol class="ck-log">${cusHistory(c).map(h => `<li class="${h.shoot ? '' : 'sale'}"><time>${escHtml(h.date)}</time><p>${escHtml(h.text)}</p></li>`).join('')}</ol>
        <small class="ck-label">Ghi chú</small>
        <p class="ck-note">${see ? escHtml(c.note || (c.lost && ('Lý do không mua: ' + c.lost.reason)) || 'Chưa có ghi chú') : 'Chỉ sale phụ trách xem được ghi chú.'}</p>
      </div>`;
    }

    function list(base) {
      const pool = ui.bday ? base.filter(c => c.baby && nextMilestone(c.baby)) : base;
      const shown = ui.group === 'all' ? pool : pool.filter(c => saleGroupOf(c) === ui.group);
      if (!shown.some(c => c.id === ui.selected)) ui.selected = (shown[0] || {}).id || null;
      const sel = shown.find(c => c.id === ui.selected);
      // Khách đang chọn (vd bấm "Hồ sơ" từ Bảng giai đoạn) nằm ngoài phần đang hiện thì mở rộng tới đợt chứa khách đó.
      const selIdx = shown.indexOf(sel);
      if (selIdx >= listLimit) listLimit = Math.ceil((selIdx + 1) / LIST_STEP) * LIST_STEP;
      const rows = shown.slice(0, listLimit);
      const chip = (id, label) => `<button type="button" class="ck-chip${ui.group === id ? ' on' : ''}" data-ck="group" data-id="${id}">${label} ${id === 'all' ? pool.length : pool.filter(c => saleGroupOf(c) === id).length}</button>`;
      const sub = c => {
        const g = saleGroupOf(c);
        if (g === 'tiem-nang') return stageLabel(c.stage);
        if (g === 'khach-quen') return saleShootCount(c) + ' đơn';
        if (g === 'khong-mua') return c.lost.reason;
        return '';
      };
      return '<div class="ck-layout"><section class="ck-panel">' +
        '<div class="ck-chips">' + chip('all', 'Tất cả') + Object.keys(SALE_GROUPS).map(id => chip(id, SALE_GROUPS[id].label)).join('') + '</div>' +
        '<p class="ck-rule">Giai đoạn tự đổi: cọc xong thành Đã chốt, sau buổi chụp thành Đã chụp, từ đơn thứ hai thành Khách quen.</p>' +
        '<div class="ck-table-wrap"><table class="ck-table"><thead><tr><th>Khách</th><th>Giai đoạn</th><th>Bé</th><th>Việc tiếp theo</th><th>Sale phụ trách</th></tr></thead><tbody>' +
        (rows.length ? rows.map(c => {
          const g = SALE_GROUPS[saleGroupOf(c)]; const n = nextStep(c); const s = sub(c);
          return `<tr class="ck-row${c.id === ui.selected ? ' on' : ''}" data-ck="select" data-id="${c.id}">
            <td><button type="button" class="ck-link" data-ck="select" data-id="${c.id}"><strong>${escHtml(c.name)}</strong></button>
              <small class="ck-muted ck-block">${escHtml(phoneOf(c))} · ${escHtml(c.source)} · ${escHtml(c.since)}</small></td>
            <td>${badge(g.label, g.tone)}${s ? `<small class="ck-muted ck-block">${escHtml(s)}</small>` : ''}</td>
            <td>${escHtml(babyText(c))}</td>
            <td><strong class="ck-next${n.tone ? ' c-' + n.tone : ''}">${escHtml(n.text)}</strong></td>
            <td>${escHtml(saleName(c.owner))}</td></tr>`;
        }).join('') : '<tr><td colspan="5"><p class="ck-empty">Không có khách nào khớp bộ lọc.</p></td></tr>') +
        '</tbody></table></div>' +
        (shown.length > LIST_STEP ? moreBtn('more-list', 'list', shown.length - listLimit, LIST_STEP, listLimit > LIST_STEP) : '') + '</section>' +
        `<aside class="ck-panel ck-aside" id="ckAside" aria-label="Hồ sơ khách">${sel ? detail(sel) : '<p class="ck-empty">Chọn một khách để xem hồ sơ.</p>'}</aside></div>`;
    }

    function render() {
      if (!SALE_DB) { custView.innerHTML = '<p class="ck-empty">Chưa nạp được dữ liệu Không gian Sale.</p>'; return; }
      const base = filtered();
      // Giữ con trỏ ô tìm kiếm khi vẽ lại theo từng phím gõ.
      const typing = document.activeElement && document.activeElement.matches('[data-ck-search]');
      const caret = typing ? document.activeElement.selectionStart : 0;
      custView.innerHTML = toolbar() + (ui.mode === 'bang' ? board(base) : list(base));
      if (typing) { const s = custView.querySelector('[data-ck-search]'); s.focus(); s.setSelectionRange(caret, caret); }
    }
    window.addEventListener('aloha:crm-projection',render);

    custView.addEventListener('click', e => {
      const t = e.target.closest('[data-ck]');
      if (!t) return;
      const act = t.dataset.ck;
      if (act === 'mode') { ui.mode = t.dataset.id; resetLimits(); }
      else if (act === 'group') { ui.group = t.dataset.id; resetLimits(); }
      else if (act === 'bday') { ui.bday = !ui.bday; resetLimits(); }
      else if (act === 'select') ui.selected = t.dataset.id;
      else if (act === 'profile') { ui.mode = 'danh-sach'; ui.group = 'all'; ui.bday = false; ui.selected = t.dataset.id; resetLimits(); }
      else if (act === 'more-col') boardLimit[t.dataset.id] = (boardLimit[t.dataset.id] || BOARD_STEP) + BOARD_STEP;
      else if (act === 'more-col-less') boardLimit[t.dataset.id] = BOARD_STEP;
      else if (act === 'more-list') listLimit += LIST_STEP;
      else if (act === 'more-list-less') listLimit = LIST_STEP;
      render();
      if (act === 'more-col-less' || act === 'more-list-less') {
        // Thu gọn làm khối ngắn lại -> đưa người xem về đầu cột/bảng thay vì để lạc giữa trang.
        const box = act === 'more-col-less' ? custView.querySelector(`.ck-col[aria-label="${STAGES.find(s => s.id === t.dataset.id).label}"]`) : custView.querySelector('.ck-panel');
        if (box && box.getBoundingClientRect().top < 0) box.scrollIntoView({ block: 'start' });
      }
      // Màn hẹp: hồ sơ nằm dưới bảng -> cuộn tới cho người xem thấy ngay.
      if ((act === 'select' || act === 'profile') && window.matchMedia('(max-width: 1180px)').matches) {
        const aside = document.getElementById('ckAside');
        if (aside) aside.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (act === 'profile') {
        const row = custView.querySelector('.ck-row.on');
        if (row) row.scrollIntoView({ block: 'nearest' });
      }
    });
    custView.addEventListener('change', e => {
      const f = e.target.dataset.ckFilter;
      if (f) { ui[f] = e.target.value; resetLimits(); render(); }
    });
    custView.addEventListener('input', e => {
      if (e.target.matches('[data-ck-search]')) { ui.q = e.target.value; resetLimits(); render(); }
    });

    if (role === 'sep') {
      document.getElementById('custSectionSub').textContent = 'Toàn bộ khách của các sale (lấy từ Không gian Sale). Sếp chỉ xem; đổi giai đoạn, gọi, nhắn do sale phụ trách làm bên Không gian Sale.';
    }
    render();
  }

  // ------------------------------- Lịch hẹn dạng lịch tháng (Sếp + Sale) -------------------------------
  // Người dùng yêu cầu (2026-09-25) đổi từ bảng danh sách + 3 tab sang lịch
  // tháng: mỗi ô là 1 ngày, trong ô là các lịch hẹn của ngày đó xếp theo giờ từ
  // sớm tới muộn, bấm vào 1 lịch hẹn mở popup chi tiết.
  //
  // Nguồn dữ liệu: lịch chụp chung của studio trong Không gian Sale
  // (ALOHA_SALE_DATA.appointments), người dùng yêu cầu 2026-10-12. Ngày đã được dời
  // theo hôm nay khi nạp (SALE_DB, cùng cách dời ngày của crm/js/sale.js) nên lịch ở
  // đây khớp từng ngày với Lịch chụp bên Sale; dayOffset = số ngày so với hôm nay.
  //
  // Trạng thái quy về đúng enum lịch hẹn trong rules/tech-defaults.md theo vị trí
  // buổi chụp so với hôm nay; trạng thái thanh toán gốc của Sale (đã cọc / chưa thu đủ
  // / giữ chỗ) hiện riêng trong popup. Bản sao tĩnh: lịch Sale tạo thêm hoặc giữ chỗ
  // hết giờ bị nhả trên crm/sale.html không chảy sang đây.
  const calGrid = document.getElementById('calGrid');
  if (calGrid) {
    const PAY_TEXT = {
      'checkin': 'Đã cọc · khách đã check-in',
      'da-coc': 'Đã cọc',
      'chua-thu-du': 'Chưa thu đủ',
      'giu-cho': 'Giữ chỗ, chưa cọc'
    };
    function apptStatus(a, dayOffset) {
      if(a.status==='da-chup')return 'Đã chụp';
      if (a.status === 'giu-cho') return 'Chưa cọc';
      if(a.workflowOrderId)return a.status==='checkin'?'Đã đến/Đang chụp':'Sắp đến';
      if (dayOffset < 0) return 'Đã chụp';
      if (dayOffset === 0 && a.status === 'checkin') return 'Đã đến/Đang chụp';
      return 'Sắp đến';
    }
    function endTime(start, dur) {
      const [h, m] = start.split(':').map(Number);
      const t = h * 60 + m + Math.round(dur * 60);
      return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
    }
    // Lịch chung: Sale (vào trang này để xem) chỉ thấy liên hệ khách của chính mình,
    // như Lịch chụp bên Không gian Sale. Sếp thấy đủ.
    const roomLabel = id => ((SALE_DB && SALE_DB.rooms.find(r => r.id === id)) || {}).label || id;

    const mapAppointment=a => {
      const c = SALE_DB.customers.find(x => x.id === a.customerId) || {};
      const dayOffset = -saleDayDiff(a.date); // ngày đã được dời theo hôm nay khi nạp
      const seeContact = canSeeContact(a.owner);
      return {
        dayOffset,
        time: a.start,
        timeEnd: endTime(a.start, a.dur),
        cust: c.name || a.label,
        label: a.label,
        phone: c.phone ? (seeContact ? fmtSalePhone(c.phone) : maskSalePhone(c.phone)) : '',
        service: a.service,
        status: apptStatus(a, dayOffset),
        pay: PAY_TEXT[a.status] || a.status,
        depositCode: a.depositCode || '',
        room: roomLabel(a.room) + (a.place ? ' · ' + a.place : ''),
        photographer: a.photographer,
        saleName: saleName(a.owner),
        note: seeContact ? (c.note || '') : ''
      };
    };
    const APPOINTMENTS = (SALE_DB ? SALE_DB.appointments : []).map(mapAppointment);

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

    function apptSaleName(a) {
      return a.saleName || 'Chưa phân công';
    }

    function apptChip(a, showDate, showSale = false) {
      return '<button type="button" class="cal-appt" data-id="' + a.id + '" data-status="' + a.status + '">' +
        '<span class="cal-appt-time">' + (showDate ? fmtDate(a.date).slice(0, 5) + ' · ' : '') + a.time + '</span>' +
        '<span class="cal-appt-name">' + escHtml(a.cust) + '</span>' +
        '<span class="cal-appt-service">' + a.service + '</span>' +
        (showSale ? '<span class="cal-appt-sale">Sale phụ trách: ' + escHtml(apptSaleName(a)) + '</span>' : '') +
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
        ['Khách hàng', a.cust + (a.label && a.label !== a.cust ? ' (' + a.label + ')' : '') + (a.phone ? ' · ' + a.phone : '')],
        ['Thời gian', a.time + '–' + a.timeEnd + ' · ' + DOW[a.date.getDay()] + ', ' + fmtDate(a.date)],
        ['Dịch vụ', a.service],
        ['Phòng', a.room],
        ['Thợ ảnh', a.photographer],
        ['Thanh toán', a.pay + (a.depositCode ? ' · mã ' + a.depositCode : '')],
        ['Sale phụ trách', apptSaleName(a)]
      ];
      apptBody.innerHTML =
        '<h3 id="apptModalTitle">' + escHtml(a.cust + ' · ' + a.service) + '</h3>' +
        '<div class="appt-modal-status"><span class="badge ' + (STATUS_BADGE[a.status] || 'badge-dat-lich') + '">' + a.status + '</span></div>' +
        '<dl class="appt-fields">' +
          rows.map(r => '<div><dt>' + r[0] + '</dt><dd>' + escHtml(r[1]) + '</dd></div>').join('') +
        '</dl>' +
        (a.note ? '<div class="appt-note"><strong>Ghi chú</strong><p>' + escHtml(a.note) + '</p></div>' : '') +
        '<p class="appt-modal-hint">Lịch chụp chung lấy từ Không gian Sale (dữ liệu minh hoạ). Thay đổi lịch làm ở trang Sale.</p>';
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
        '<div class="cal-day-list appt-day-list">' + list.map(a => apptChip(a, false, true)).join('') + '</div>';
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

    window.addEventListener('aloha:crm-projection',()=>{
      APPOINTMENTS.splice(0,APPOINTMENTS.length,...(SALE_DB.appointments || []).map(mapAppointment));
      Object.keys(byDay).forEach(k=>delete byDay[k]);
      APPOINTMENTS.forEach((a,i)=>{const d=new Date(today);d.setDate(d.getDate()+a.dayOffset);a.date=d;a.id='appt-'+i;(byDay[dayKey(d)]=byDay[dayKey(d)]||[]).push(a);});
      Object.values(byDay).forEach(list=>list.sort((a,b)=>a.time.localeCompare(b.time)));
      renderCalendar();
    });
    renderCalendar();
  }

  // ------------------------------- Quản lý chụp & chỉnh ảnh: 3 hàng ưu tiên + Đã hoàn tất -------------------------------
  // Gộp 2 nguồn thành 1 danh sách duy nhất để render và xử lý giống hệt nhau:
  //  - Yêu cầu THẬT từ khách (view "Ảnh của tôi") -> AlohaData (localStorage,
  //    xem js/data-store.js), tiến độ (doneIds) persist thật qua AlohaData.togglePhotoDone.
  //  - Dữ liệu nền minh hoạ (STATIC_REQUESTS ngay dưới đây) -> chỉ tồn tại
  //    trong bộ nhớ JS của trang này, tiến độ + link lưu tạm, mất khi tải lại trang.
  // 3 bước (bỏ "Chờ QC" riêng, 2026-09-19 - xem js/data-store.js STATUS_FLOW):
  // Chờ xử lý -> Đang thực hiện -> Hoàn thành.
  // Tích hợp giao diện Thợ ảnh (nhánh Thợ ảnh 7ee735d) vào trang Sếp 2026-10-15, trưởng nhóm chốt:
  //  - Thay kanban 3 cột bằng 3 hàng Gấp / Trung bình / Chưa gấp + bộ chọn thợ chỉnh ảnh;
  //    đơn Hoàn thành chuyển xuống mục "Đã hoàn tất" (#hoan-tat).
  //  - Bỏ nút đánh dấu từng ảnh và nút chuyển bước; kết thúc đơn bằng nút "Hoàn tất" (tự
  //    đánh dấu xong mọi ảnh rồi đi lần lượt tới Hoàn thành).
  //  - Hoàn thành chỉ bắt buộc link ẢNH ĐÃ CHỈNH. Link ẢNH GỐC tuỳ chọn, chỉ dùng nội bộ,
  //    KHÔNG hiện cho khách và không hướng dẫn để công khai.
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

  // Thợ CHỈNH ảnh (khác thợ CHỤP trong mục Lịch hẹn / crm/js/sale-data.js). Tên tạm, chờ
  // studio cung cấp tên thật. Nhận diện tài khoản đang đăng nhập theo SỐ ĐIỆN THOẠI trong
  // phiên (không dựa vào tên hiển thị): tài khoản demo Thợ ảnh 0900000003 = Thợ chỉnh 1.
  const WORKER_DEFS = [
    { id: 'all', label: 'Tất cả' },
    { id: '0900000003', label: 'Thợ ảnh demo', phones: ['0900000003'] }
  ];
  const workerLabel = (id) => { const w = WORKER_DEFS.find(x => x.id === id && id !== 'all'); return w ? w.label : ''; };
  function detectWorkerFromSession() {
    if (role !== 'tho-anh') return 'all';
    const phone = (session && session.phone) || '';
    const w = WORKER_DEFS.find(x => x.phones && x.phones.indexOf(phone) !== -1);
    return w ? w.id : 'all';   // tài khoản thợ chưa gán thì xem tất cả
  }
  let activeWorker = detectWorkerFromSession();

  // Ngưỡng ưu tiên cho yêu cầu thật CHƯA được gán mức ưu tiên: tính theo tuổi yêu cầu.
  // GIÁ TRỊ TẠM (trưởng nhóm duyệt 2026-10-15), chờ studio xác nhận - xem rules/tech-defaults.md
  // mục "Cấu hình chưa xác định". Đơn đã gán priority rõ ràng thì giữ nguyên, không ghi đè.
  const PRIORITY_HOURS = { urgent: 48, medium: 12 };

  // Ảnh nền minh hoạ dùng lại đúng 16 ảnh demo có sẵn trong images/my-photos/,
  // KHÔNG phải ảnh thật của khách demo 02..14 (tên minh hoạ, không gắn với hồ sơ
  // khách nào). Mã đơn minh hoạ dùng dải riêng #AB240701..#AB240713 (đổi 2026-10-15):
  // không trùng mã trong crm/js/sale-data.js, js/data-store.js, js/chon-anh.js, và nằm
  // dưới mọi mã đang có nên nextCode() của Không gian Sale (mã lớn nhất + 1) không sinh ra.
  // priority: 'urgent' | 'medium' | 'normal'; shootDate / deadline: 'DD/MM/YYYY' (minh hoạ);
  // photographer: id thợ chỉnh trong WORKER_DEFS.
  const STATIC_REQUESTS = [
    { id: 'static-1', orderCode: '#AB240701', customerName: 'Khách demo 05', serviceLabel: 'Gia đình', status: 'Chờ xử lý', note: 'Muốn ảnh tông sáng, ít chỉnh da.', createdAt: now - 26 * HOUR, priority: 'urgent', shootDate: '26/09/2026', deadline: '28/09/2026', photoIds: [1, 2, 3, 4], doneIds: [], photographer: 'tho1' },
    { id: 'static-2', orderCode: '#AB240702', customerName: 'Khách demo 02', serviceLabel: 'Sinh nhật', status: 'Đang thực hiện', note: 'Xoá phông lộn xộn phía sau bé.', createdAt: now - 3 * 24 * HOUR, priority: 'urgent', shootDate: '26/09/2026', deadline: '29/09/2026', photoIds: [5, 6, 7, 8, 9], doneIds: [5, 6], photographer: 'tho2' },
    { id: 'static-3', orderCode: '#AB240703', customerName: 'Khách demo 03', serviceLabel: 'Bầu', status: 'Hoàn thành', note: '', createdAt: now - 5 * 24 * HOUR, priority: 'medium', shootDate: '29/09/2026', deadline: '05/10/2026', photoIds: [10, 11, 12], doneIds: [10, 11, 12], photographer: 'tho3',
      resultLink: 'https://drive.google.com/drive/folders/demo-AB240703-anh-da-chinh', resultLinkOriginal: 'https://drive.google.com/drive/folders/demo-AB240703-anh-goc', resultLinkAt: now - 2 * 24 * HOUR },
    { id: 'static-4', orderCode: '#AB240704', customerName: 'Khách demo 04', serviceLabel: 'Gia đình', status: 'Chờ xử lý', note: '', createdAt: now - 9 * 24 * HOUR, priority: 'normal', shootDate: '06/10/2026', deadline: '13/10/2026', photoIds: [1, 2], doneIds: [], photographer: 'tho1' },
    { id: 'static-5', orderCode: '#AB240705', customerName: 'Khách demo 06', serviceLabel: 'Newborn', status: 'Chờ xử lý', note: '', createdAt: now - 10 * 24 * HOUR, priority: 'normal', shootDate: '10/10/2026', deadline: '17/10/2026', photoIds: [3, 4], doneIds: [], photographer: 'tho2' },
    { id: 'static-6', orderCode: '#AB240706', customerName: 'Khách demo 07', serviceLabel: 'Bé lớn', status: 'Đang thực hiện', note: '', createdAt: now - 30 * HOUR, priority: 'urgent', shootDate: '27/09/2026', deadline: '30/09/2026', photoIds: [7, 8], doneIds: [], photographer: 'tho1' },
    { id: 'static-7', orderCode: '#AB240707', customerName: 'Khách demo 08', serviceLabel: 'Sinh nhật', status: 'Chờ xử lý', note: '', createdAt: now - 4 * 24 * HOUR, priority: 'medium', shootDate: '30/09/2026', deadline: '06/10/2026', photoIds: [13, 14], doneIds: [], photographer: 'tho2' },
    { id: 'static-8', orderCode: '#AB240708', customerName: 'Khách demo 09', serviceLabel: 'Newborn', status: 'Chờ xử lý', note: '', createdAt: now - 2 * 24 * HOUR, priority: 'medium', shootDate: '02/10/2026', deadline: '09/10/2026', photoIds: [15, 16], doneIds: [], photographer: 'tho3' },
    { id: 'static-9', orderCode: '#AB240709', customerName: 'Khách demo 10', serviceLabel: 'Bầu', status: 'Chờ xử lý', note: '', createdAt: now - 8 * 24 * HOUR, priority: 'normal', shootDate: '15/10/2026', deadline: '22/10/2026', photoIds: [5, 6], doneIds: [], photographer: 'tho3' },
    { id: 'static-10', orderCode: '#AB240710', customerName: 'Khách demo 11', serviceLabel: 'Bé lớn', status: 'Chờ xử lý', note: '', createdAt: now - 7 * 24 * HOUR, priority: 'normal', shootDate: '18/10/2026', deadline: '25/10/2026', photoIds: [7, 8], doneIds: [], photographer: 'tho1' },
    { id: 'static-11', orderCode: '#AB240711', customerName: 'Khách demo 12', serviceLabel: 'Sinh nhật', status: 'Chờ xử lý', note: '', createdAt: now - 6 * 24 * HOUR, priority: 'normal', shootDate: '20/10/2026', deadline: '27/10/2026', photoIds: [9, 10], doneIds: [], photographer: 'tho2' },
    { id: 'static-12', orderCode: '#AB240712', customerName: 'Khách demo 13', serviceLabel: 'Newborn', status: 'Đang thực hiện', note: 'Tông màu ấm, giữ nguyên nét tự nhiên.', createdAt: now - 5 * 24 * HOUR, priority: 'normal', shootDate: '22/10/2026', deadline: '29/10/2026', photoIds: [11, 12, 13], doneIds: [11], photographer: 'tho3' },
    { id: 'static-13', orderCode: '#AB240713', customerName: 'Khách demo 14', serviceLabel: 'Gia đình', status: 'Chờ xử lý', note: '', createdAt: now - 4 * 24 * HOUR, priority: 'normal', shootDate: '25/10/2026', deadline: '01/11/2026', photoIds: [14, 15, 16], doneIds: [], photographer: 'tho1' }
  ].map(r => {
    staticDoneMap[r.id] = new Set(r.doneIds.map(n => 'ph-' + n));
    return {
      id: r.id, orderCode: r.orderCode, customerName: r.customerName, serviceLabel: r.serviceLabel,
      status: r.status, note: r.note, createdAt: r.createdAt, isStatic: true,
      priority: r.priority || '', shootDate: r.shootDate || '', deadline: r.deadline || '',
      photographer: r.photographer || '',
      resultLink: r.resultLink || '', resultLinkOriginal: r.resultLinkOriginal || '', resultLinkAt: r.resultLinkAt || null,
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

  // Đã có link ẢNH ĐÃ CHỈNH hợp lệ chưa - điều kiện DUY NHẤT về link để Hoàn thành (link ảnh
  // gốc tuỳ chọn, trưởng nhóm chốt 2026-10-15). Khớp advanceRequestStatus trong js/data-store.js.
  function hasEditedLink(req) {
    return /^https:\/\//i.test(req.resultLink || '');
  }

  // Lý do chưa được chuyển bước ('' = được chuyển). Đang thực hiện -> Hoàn thành cần xong hết
  // ảnh (nút Hoàn tất tự đánh dấu) và đã gửi link ảnh đã chỉnh, áp dụng cả thẻ minh hoạ
  // ("tải ảnh đã sửa lên là Hoàn thành", xem rules/workflow.md).
  function advanceBlockReason(req) {
    if (req.status !== 'Đang thực hiện') return '';
    const total = (req.photos || []).length;
    if (total > 0 && getDoneIds(req).length !== total) return 'Thợ ảnh cần đánh dấu xong hết ảnh trước khi chuyển bước';
    if (!hasEditedLink(req)) return 'Cần gửi link ảnh đã chỉnh cho khách trước khi chuyển sang Hoàn thành';
    return '';
  }
  function canAdvance(req) { return !advanceBlockReason(req); }

  function advance(req) {
    if (req.isStatic) {
      const idx = AlohaData.STATUS_FLOW.indexOf(req.status);
      if (idx >= 0 && idx < AlohaData.STATUS_FLOW.length - 1) req.status = AlohaData.STATUS_FLOW[idx + 1];
    } else if (window.AlohaData) {
      AlohaData.advanceRequestStatus(req.id);
    }
  }

  // Đồng bộ yêu cầu chỉnh ảnh qua server (cờ editSync trong js/features.js, thêm 2026-10-15).
  // Áp dụng cho Thợ ảnh (đọc + ghi) và Sếp (chỉ đọc); cờ TẮT (mặc định) giữ nguyên luồng
  // AlohaData/localStorage cũ. Bật: danh sách/chi tiết đọc từ API (server/edit-requests.js), lưu link,
  // Hoàn tất, nhắn khách, "đã xem" gửi qua AlohaEditSync; server lỗi thì báo lỗi, KHÔNG ghi
  // localStorage thay thế, KHÔNG báo thành công khi server chưa xác nhận. 409 (dữ liệu đã đổi) ->
  // tải bản mới nhất, báo cho thợ kiểm tra rồi tự thao tác lại (không tự gửi lại). Thẻ minh hoạ
  // (STATIC_REQUESTS) vẫn chỉ sống trong bộ nhớ trang. Dữ liệu cũ trong localStorage không được chuyển lên.
  // Sếp (thêm cùng ngày): CHỈ ĐỌC qua API (GET / và GET /:id), đúng quyền server cho phép; giao
  // diện Sếp không có nút ghi nào (canEditProgress chỉ cho Thợ ảnh) và không gửi "đã xem" (server cấm Sếp).
  const EDIT_SYNC = (role === 'tho-anh' || role === 'sep') && !!(window.AlohaEditSync && AlohaEditSync.enabled());
  let syncReqs = [];          // yêu cầu thật theo server (bản nhân viên, có link ảnh gốc)
  let syncError = '';         // lỗi lần tải gần nhất

  // Bản ghi để hiển thị ở trang này: thêm cờ isStatic=false và sửa đường dẫn ảnh.
  // js/data-store.js / server lưu photo.src tương đối với index.html ở thư mục gốc
  // (vd "images/my-photos/photo-1.jpg") - trang này (crm/admin.html) nằm
  // sâu hơn 1 cấp nên phải thêm "../" khi hiển thị lại ở đây.
  function toViewReq(r) {
    return Object.assign({ isStatic: false }, r, {
      photographer:r.editorPhone || r.photographer,
      // Chỉ thêm '../' cho ảnh nằm trong thư mục dự án (trang này ở crm/); ảnh Google Photos là
      // URL đầy đủ https://... thì giữ nguyên, thêm '../' sẽ thành link hỏng.
      photos: (r.photos || []).map(p => Object.assign({}, p, { src: /^(https?:|data:|\/)/i.test(p.src || '') ? p.src : '../' + p.src }))
    });
  }

  function getAllRequests() {
    const real = (EDIT_SYNC ? syncReqs : (window.AlohaData ? AlohaData.getEditRequests() : [])).filter(r=>role==='sep'||!r.editorPhone||r.editorPhone===session.phone).map(toViewReq);
    return real;
  }

  // Thay 1 yêu cầu trong bộ nhớ trang bằng bản server vừa trả (chế độ đồng bộ)
  function keepServerCopy(r) {
    if (r && r.id) syncReqs = syncReqs.filter(x => x.id !== r.id).concat([r]);
  }
  // Tải lại toàn bộ yêu cầu từ server (GET /). Lỗi -> giữ bản đã tải, hiện lỗi.
  async function refreshSync() {
    const res = await AlohaEditSync.list();
    if (res.ok && res.data && Array.isArray(res.data.requests)) {
      syncReqs = res.data.requests;
      syncError = '';
    } else {
      syncError = res.message || 'Không tải được dữ liệu từ máy chủ.';
    }
    renderSyncStatus();
    return res;
  }
  // Dòng trạng thái kết nối trên mục Ảnh & chỉnh sửa (chỉ chế độ đồng bộ)
  let syncStatusEl = null;
  // Hiện ở cả mục "Ảnh & chỉnh sửa" (trên 3 hàng) và "Đã hoàn tất" (trên bảng): Sếp có thể chỉ mở
  // 1 trong 2 mục, phải thấy ngay khi dữ liệu đang hiện là bản cũ (lần tải gần nhất lỗi).
  let syncStatusDone = null;
  function renderSyncStatus() {
    if (!EDIT_SYNC) return;
    const text = syncError ? 'Chưa cập nhật được yêu cầu từ máy chủ: ' + syncError + ' Dữ liệu đang hiện là lần tải được gần nhất.' : '';
    const make = (anchor) => {
      const el = document.createElement('p');
      el.className = 'photo-progress-note photo-sync-status';
      el.setAttribute('role', 'status');
      anchor.parentNode.insertBefore(el, anchor);
      return el;
    };
    const rows = document.getElementById('photoRows');
    if (rows && !syncStatusEl) syncStatusEl = make(rows);
    const doneWrap = document.querySelector('#hoan-tat .completed-table-wrap');
    if (doneWrap && !syncStatusDone) syncStatusDone = make(doneWrap);
    [syncStatusEl, syncStatusDone].forEach((el) => { if (el) { el.hidden = !syncError; el.textContent = text; } });
  }
  // 409: lấy bản mới nhất (409 thường kèm sẵn; không có thì tải lại) rồi cập nhật bộ nhớ trang.
  // Trả bản mới nhất (đã toViewReq) hoặc null.
  async function latestAfterConflict(res, id) {
    if (res.latest) { keepServerCopy(res.latest); return toViewReq(res.latest); }
    await refreshSync();
    const r = syncReqs.find(x => x.id === id);
    return r ? toViewReq(r) : null;
  }
  const CONFLICT_HINT = ' Trang đã tải bản mới nhất, bạn kiểm tra lại rồi thao tác lại nhé.';

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

  // Tên cũ giữ lại vì nhiều chỗ (chat trong modal, interval, storage) đang gọi: kanban 3 cột đã
  // được thay bằng 3 hàng ưu tiên (2026-10-15), nên chỉ vẽ lại 3 hàng + bảng Đã hoàn tất.
  function renderEditRequests() {
    renderPhotoRows();
    renderCompletedTable();
  }

  // ------------------------------- 3 hàng ngang: Gấp / Trung bình / Chưa gấp -------------------------------
  // Lấy từ nhánh Thợ ảnh (7ee735d). Mỗi hàng hiện tối đa CARDS_PER_ROW thẻ, "Xem thêm" mở phần còn lại.
  const CARDS_PER_ROW = 3;
  const rowExpandedState = { urgent: false, medium: false, normal: false };

  // Mức ưu tiên: đơn đã gán rõ (priority) thì giữ nguyên; đơn thật chưa gán thì suy theo tuổi
  // yêu cầu với ngưỡng tạm PRIORITY_HOURS.
  function getRequestPriority(req) {
    if (['urgent', 'medium', 'normal'].indexOf(req.priority) !== -1) return req.priority;
    const ageHours = (Date.now() - req.createdAt) / HOUR;
    if (ageHours >= PRIORITY_HOURS.urgent) return 'urgent';
    if (ageHours >= PRIORITY_HOURS.medium) return 'medium';
    return 'normal';
  }

  // Tên file dạng IMG_xxxx.JPG từ photo id (vd 'ph-7'), số ổn định theo id - chỉ để Thợ ảnh dễ gọi tên ảnh
  function photoFilename(photoId) {
    const n = parseInt((String(photoId).match(/\d+/) || ['0'])[0], 10);
    return 'IMG_' + (7800 + ((n * 37 + 13) % 200)) + '.JPG';
  }

  // Đơn thuộc thợ đang chọn: "Tất cả" = mọi đơn; 1 thợ = đơn của thợ đó + đơn CHƯA PHÂN CÔNG
  // (để yêu cầu mới của khách không bị khuất khỏi màn của thợ nào).
  function matchesWorker(req, workerId) {
    return workerId === 'all' || req.photographer === workerId || !workerLabel(req.photographer);
  }

  // Chưa Hoàn thành -> nằm ở 3 hàng; Hoàn thành -> mục "Đã hoàn tất" (#hoan-tat)
  function getPendingRequests() {
    return getAllRequests().filter(r => r.status !== 'Hoàn thành');
  }

  function buildPhotoRowCard(req, indexInRow) {
    const doneCount = getDoneIds(req).length;
    const total = (req.photos || []).length;
    const pct = total > 0 ? Math.round(doneCount / total * 100) : 0;
    const card = document.createElement('div');
    card.className = 'photo-row-card';
    card.dataset.reqId = req.id;
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', 'Xem chi tiết yêu cầu ' + (req.orderCode || req.id));
    const iconCam = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-2h6l2 2h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.2"/></svg>';
    const iconClock = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>';
    // Nhãn nhắc của yêu cầu thật: Mới (thợ chưa mở) / Khách cần thợ trả lời / Đã gửi link ảnh
    // đã chỉnh (chỉ tính link khách thấy, không tính link ảnh gốc nội bộ).
    const flags = req.isStatic ? [] : [
      !req.staffSeen ? '<span class="kanban-card-flag link">Mới</span>' : '',
      awaitingReply(req) ? '<span class="kanban-card-flag reply">Khách cần thợ trả lời</span>' : '',
      hasEditedLink(req) ? '<span class="kanban-card-flag link">Đã gửi link ảnh</span>' : ''
    ].filter(Boolean);
    // Giữ 2 nhắc của thẻ kanban cũ: ảnh có ghi chú riêng + ảnh chỉnh thêm ngoài gói
    const hints = [
      req.photoNotes && req.photoNotes.length ? `<span class="photo-row-card-hint">+${req.photoNotes.length} ảnh có ghi chú riêng</span>` : '',
      req.extraCount > 0 ? `<span class="photo-row-card-hint extra">+${req.extraCount} ảnh ngoài gói</span>` : ''
    ].filter(Boolean);
    const wLabel = workerLabel(req.photographer);
    card.innerHTML = `
      <span class="photo-row-card-num" title="Thứ tự trong hàng: đến trước làm trước">#${indexInRow + 1}</span>
      <div class="photo-row-card-code">${escHtml(req.orderCode || req.id)}</div>
      <div class="photo-row-card-sub">${escHtml(req.customerName || '')} · ${escHtml(req.serviceLabel || 'Chụp ảnh')} · ${total || req.photoCount || 0} ảnh</div>
      <span class="photo-row-card-worker${wLabel ? '' : ' unassigned'}">${escHtml(wLabel || 'Chưa phân công')}</span>
      ${flags.length ? `<div class="kanban-card-flags photo-row-card-flags">${flags.join('')}</div>` : ''}
      ${hints.length ? `<div class="photo-row-card-hints">${hints.join('')}</div>` : ''}
      <div class="photo-row-card-meta">
        <div class="photo-row-card-meta-row">${iconCam}<span>Ngày chụp: <strong>${escHtml(req.shootDate || '—')}</strong></span></div>
        <div class="photo-row-card-meta-row">${iconClock}<span>Hạn trả ảnh: <strong>${escHtml(req.deadline || '—')}</strong></span></div>
        <div class="photo-row-card-meta-row">${iconClock}<span>Gửi yêu cầu ${escHtml(formatRelativeTime(req.createdAt))}</span></div>
      </div>
      <div class="photo-row-progress-wrap">
        <div class="photo-row-progress-label">Đã xong ${doneCount}/${total || req.photoCount || 0} ảnh</div>
        <div class="photo-row-progress-track"><div class="photo-row-progress-fill${pct === 100 ? ' done' : ''}" style="width:${pct}%"></div></div>
      </div>`;
    // Nút gửi link Drive: chỉ Thợ ảnh (Sếp xem chỉ đọc)
    if (canEditProgress) {
      const driveBtn = document.createElement('button');
      driveBtn.type = 'button';
      const sent = !!(req.resultLink || req.resultLinkOriginal);
      driveBtn.className = 'photo-row-drive-btn' + (sent ? ' sent' : '');
      driveBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>'
        + (sent ? ' Cập nhật link Drive' : ' Gửi link Drive');
      driveBtn.setAttribute('aria-label', (sent ? 'Cập nhật' : 'Gửi') + ' link Drive cho ' + (req.orderCode || req.id));
      driveBtn.addEventListener('click', (e) => { e.stopPropagation(); openDriveModal(req); });
      card.appendChild(driveBtn);
    }
    card.addEventListener('click', () => openRequestModal(req));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openRequestModal(req); }
    });
    return card;
  }

  // Số đơn trên từng ô thợ (đúng bằng số thẻ ô đó sẽ hiện) + trạng thái đang chọn
  function renderWorkerBar() {
    const bar=document.getElementById('photoWorkerBar');
    if(bar)bar.innerHTML=WORKER_DEFS.map(w=>`<button type="button" class="photo-worker-card" id="workerBtn-${escHtml(w.id)}" data-worker="${escHtml(w.id)}"><span class="photo-worker-name">${escHtml(w.label)}</span><span class="photo-worker-count" id="workerCount-${escHtml(w.id)}"></span></button>`).join('');
    if (!document.getElementById('photoWorkerBar')) return;
    const pending = getPendingRequests();
    WORKER_DEFS.forEach(w => {
      const btn = document.getElementById('workerBtn-' + w.id);
      const countEl = document.getElementById('workerCount-' + w.id);
      if (!btn) return;
      if (countEl) countEl.textContent = pending.filter(r => matchesWorker(r, w.id)).length;
      btn.classList.toggle('active', w.id === activeWorker);
      btn.setAttribute('aria-pressed', w.id === activeWorker ? 'true' : 'false');
    });
    const labelEl = document.getElementById('photoWorkerLabel');
    const labelName = document.getElementById('photoWorkerLabelName');
    if (labelEl && labelName) {
      labelEl.classList.toggle('visible', activeWorker !== 'all');
      labelName.textContent = activeWorker === 'all' ? '' : workerLabel(activeWorker) + ' (kèm đơn chưa phân công)';
    }
  }

  const workerBar = document.getElementById('photoWorkerBar');
  if (workerBar) {
    workerBar.addEventListener('click', (e) => {
      const btn = e.target.closest('.photo-worker-card[data-worker]');
      if (!btn) return;
      activeWorker = btn.dataset.worker;
      Object.keys(rowExpandedState).forEach(k => { rowExpandedState[k] = false; });
      renderPhotoRows();
    });
  }

  function renderPhotoRows() {
    if (!document.getElementById('photoRows')) return; // vai trò không có mục này (Sale)
    const buckets = { urgent: [], medium: [], normal: [] };
    getPendingRequests().filter(r => matchesWorker(r, activeWorker)).forEach(req => {
      buckets[getRequestPriority(req)].push(req);
    });
    ['urgent', 'medium', 'normal'].forEach(rowKey => {
      const cardsEl = document.getElementById('photoRowCards-' + rowKey);
      const countEl = document.getElementById('photoRowCount-' + rowKey);
      const moreBtn = document.getElementById('photoRowMore-' + rowKey);
      if (!cardsEl) return;
      cardsEl.innerHTML = '';
      const list = buckets[rowKey].slice().sort((a, b) => a.createdAt - b.createdAt);
      if (countEl) countEl.textContent = list.length + ' đơn';
      if (!list.length) {
        const empty = document.createElement('p');
        empty.className = 'photo-row-empty';
        empty.textContent = activeWorker === 'all' ? 'Chưa có đơn nào ở mức độ này.' : 'Thợ này chưa có đơn ở mức độ này.';
        cardsEl.appendChild(empty);
        if (moreBtn) moreBtn.hidden = true;
        return;
      }
      const expanded = rowExpandedState[rowKey];
      (expanded ? list : list.slice(0, CARDS_PER_ROW)).forEach((req, i) => cardsEl.appendChild(buildPhotoRowCard(req, i)));
      if (moreBtn) {
        moreBtn.hidden = list.length <= CARDS_PER_ROW;
        moreBtn.textContent = expanded ? 'Thu gọn' : 'Xem thêm ' + (list.length - CARDS_PER_ROW) + ' đơn';
      }
    });
    renderWorkerBar();
    updateTabBadge();
  }

  ['urgent', 'medium', 'normal'].forEach(rowKey => {
    const btn = document.getElementById('photoRowMore-' + rowKey);
    if (btn) btn.addEventListener('click', () => {
      rowExpandedState[rowKey] = !rowExpandedState[rowKey];
      renderPhotoRows();
    });
  });

  // ------------------------------- Cửa sổ Drive: lưu link + Hoàn tất -------------------------------
  // Mở từ nút trên thẻ (chỉ Thợ ảnh). Yêu cầu thật lưu qua AlohaData.setResultLink(id, url, urlOriginal);
  // thẻ minh hoạ lưu tạm trong bộ nhớ trang.
  const driveOverlay = document.getElementById('driveModalOverlay');
  const driveOrderEl = document.getElementById('driveModalOrder');
  const driveInput = document.getElementById('driveModalInput');
  const driveInputOrig = document.getElementById('driveModalInputOriginal');
  const driveErrorEl = document.getElementById('driveModalError');
  const driveForm = document.getElementById('driveModalForm');
  const driveSubmitText = document.querySelector('#driveModalSubmit .drive-modal-submit-text');
  const driveCompleteWrap = document.getElementById('driveModalCompleteBtnWrap');
  const driveCompleteBtn = document.getElementById('driveModalCompleteBtn');
  let driveReq = null;

  // Nút Hoàn tất: chỉ Thợ ảnh, chỉ khi đã có link ảnh đã chỉnh hợp lệ và đơn chưa Hoàn thành
  function canComplete(req) {
    return canEditProgress && hasEditedLink(req) && req.status !== 'Hoàn thành';
  }

  function openDriveModal(req) {
    if (!driveOverlay) return;
    driveReq = req;
    if (driveOrderEl) driveOrderEl.textContent = (req.orderCode || req.id) + (req.customerName ? ' · ' + req.customerName : '');
    if (driveInput) driveInput.value = req.resultLink || '';
    if (driveInputOrig) driveInputOrig.value = req.resultLinkOriginal || '';
    if (driveErrorEl) driveErrorEl.hidden = true;
    if (driveSubmitText) driveSubmitText.textContent = (req.resultLink || req.resultLinkOriginal) ? 'Cập nhật link' : 'Lưu link';
    if (driveCompleteWrap) driveCompleteWrap.hidden = !canComplete(req);
    driveOverlay.classList.add('open');
    driveOverlay.setAttribute('aria-hidden', 'false');
    if (driveInput) setTimeout(() => driveInput.focus(), 120);
  }

  function closeDriveModal() {
    if (!driveOverlay) return;
    driveOverlay.classList.remove('open');
    driveOverlay.setAttribute('aria-hidden', 'true');
    driveReq = null;
  }
  ['driveModalClose', 'driveModalCancel'].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.addEventListener('click', closeDriveModal);
  });
  if (driveOverlay) driveOverlay.addEventListener('click', (e) => { if (e.target === driveOverlay) closeDriveModal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && driveOverlay && driveOverlay.classList.contains('open')) closeDriveModal();
  });

  // Lưu 2 link cho 1 yêu cầu. Trả '' nếu lưu được, ngược lại trả câu báo lỗi. Dùng chung cho
  // cửa sổ Drive và form ngay dưới ảnh trong modal chi tiết.
  function linkInputError(url, urlOrig) {
    if ((url && !/^https:\/\/[^\s<>"']+$/i.test(url)) || (urlOrig && !/^https:\/\/[^\s<>"']+$/i.test(urlOrig))) {
      return 'Link phải bắt đầu bằng https:// (vd https://drive.google.com/...)';
    }
    if (!url && !urlOrig) return 'Nhập ít nhất 1 link Drive (link ảnh đã chỉnh là bắt buộc để Hoàn tất).';
    return '';
  }

  // Chế độ đồng bộ: lưu 2 link qua server với rev của bản đang xem. Trả { ok, req, message, conflict }.
  // 409 -> không gửi lại, trả bản mới nhất để thợ kiểm tra (link hiện có trên server) rồi tự lưu lại.
  async function saveDriveLinksSync(req, url, urlOrig) {
    const err = linkInputError(url, urlOrig);
    if (err) return { ok: false, message: err };
    const res = await AlohaEditSync.setLinks(req.id, { resultLink: url, resultLinkOriginal: urlOrig }, req.rev);
    if (res.ok && res.data && res.data.request) {
      keepServerCopy(res.data.request);
      return { ok: true, req: toViewReq(res.data.request) };
    }
    if (res.error === 'conflict') {
      const latest = await latestAfterConflict(res, req.id);
      const cur = latest ? ' Trên máy chủ hiện có: link ảnh đã chỉnh "' + (latest.resultLink || 'chưa có') + '", link ảnh gốc "' + (latest.resultLinkOriginal || 'chưa có') + '".' : '';
      return { ok: false, conflict: true, req: latest, message: res.message + CONFLICT_HINT + cur };
    }
    return { ok: false, message: res.message || 'Chưa lưu được link.' };
  }

  // Chế độ đồng bộ: Hoàn tất 1 bước ở server (server bắt buộc có link ảnh đã chỉnh, tự đánh dấu xong
  // mọi ảnh). Trả { ok, req, message, conflict }. Chỉ báo xong khi server đã xác nhận.
  async function completeRequestSync(req) {
    const res = await AlohaEditSync.complete(req.id, req.rev);
    if (res.ok && res.data && res.data.request) {
      keepServerCopy(res.data.request);
      return { ok: true, req: toViewReq(res.data.request) };
    }
    if (res.error === 'conflict') {
      const latest = await latestAfterConflict(res, req.id);
      return { ok: false, conflict: true, req: latest, message: res.message + (res.code === 'already_completed' ? '' : CONFLICT_HINT) };
    }
    return { ok: false, message: res.message || 'Chưa Hoàn tất được.' };
  }

  function saveDriveLinks(req, url, urlOrig) {
    const inputErr = linkInputError(url, urlOrig);
    if (inputErr) return inputErr;
    if (req.isStatic) {
      req.resultLink = url;
      req.resultLinkOriginal = urlOrig;
      req.resultLinkAt = url ? Date.now() : null;
    } else if (window.AlohaData) {
      const saved = AlohaData.setResultLink(req.id, url, urlOrig);
      if (!saved) return 'Link không hợp lệ, vui lòng kiểm tra lại.';
      req.resultLink = saved.resultLink;
      req.resultLinkOriginal = saved.resultLinkOriginal || '';
      req.resultLinkAt = saved.resultLinkAt;
    }
    return '';
  }

  // Đánh dấu xong mọi ảnh còn lại (dùng khi Hoàn tất)
  function markAllPhotosDone(req) {
    const done = getDoneIds(req);
    (req.photos || []).forEach(p => { if (done.indexOf(p.id) === -1) togglePhotoDone(req, p.id); });
  }

  // Hoàn tất: đánh dấu xong mọi ảnh rồi đi LẦN LƯỢT từng bước tới Hoàn thành (không nhảy cóc,
  // để data-store vẫn kiểm tra điều kiện link ở bước cuối).
  function completeRequest(req) {
    if (!canComplete(req)) return false;
    markAllPhotosDone(req);
    for (let i = 0; i < AlohaData.STATUS_FLOW.length && req.status !== 'Hoàn thành'; i++) {
      const before = req.status;
      if (!canAdvance(req)) break;
      advance(req);
      if (!req.isStatic) {
        const fresh = freshRequest(req.id);
        if (fresh) req.status = fresh.status;
      }
      if (req.status === before) break;
    }
    renderEditRequests();
    return req.status === 'Hoàn thành';
  }

  const showDriveError = (msg) => { if (driveErrorEl) { driveErrorEl.textContent = msg; driveErrorEl.hidden = !msg; } };
  let driveBusy = false; // chế độ đồng bộ: đang chờ server (chặn bấm 2 lần)

  if (driveForm) {
    driveForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!driveReq) return;
      if (EDIT_SYNC && !driveReq.isStatic) {
        if (driveBusy) return;
        driveBusy = true;
        const submitBtn = document.getElementById('driveModalSubmit');
        if (submitBtn) submitBtn.disabled = true;
        const r = await saveDriveLinksSync(driveReq, driveInput.value.trim(), driveInputOrig ? driveInputOrig.value.trim() : '');
        driveBusy = false;
        if (submitBtn) submitBtn.disabled = false;
        if (!driveReq) return; // cửa sổ đã đóng trong lúc chờ
        if (r.req) driveReq = r.req;        // thành công hoặc 409: dùng bản mới nhất (rev mới)
        showDriveError(r.ok ? '' : r.message); // 409: giữ nguyên chữ thợ đã gõ để kiểm tra rồi lưu lại
        if (r.ok && driveSubmitText) driveSubmitText.textContent = 'Cập nhật link';
        if (driveCompleteWrap) driveCompleteWrap.hidden = !canComplete(driveReq);
        renderEditRequests();
        if (!r.ok) driveInput.focus();
        return;
      }
      const err = saveDriveLinks(driveReq, driveInput.value.trim(), driveInputOrig ? driveInputOrig.value.trim() : '');
      if (driveErrorEl) { driveErrorEl.textContent = err; driveErrorEl.hidden = !err; }
      if (err) { driveInput.focus(); return; }
      if (driveSubmitText) driveSubmitText.textContent = 'Cập nhật link';
      if (driveCompleteWrap) driveCompleteWrap.hidden = !canComplete(driveReq);
      renderEditRequests();
    });
  }
  if (driveCompleteBtn) {
    driveCompleteBtn.addEventListener('click', async () => {
      if (!driveReq) return;
      const req = driveReq;
      if (EDIT_SYNC && !req.isStatic) {
        // Chỉ đóng cửa sổ khi server đã xác nhận Hoàn tất; lỗi thì báo ngay trong cửa sổ
        if (driveBusy) return;
        driveBusy = true;
        driveCompleteBtn.disabled = true;
        const r = await completeRequestSync(req);
        driveBusy = false;
        driveCompleteBtn.disabled = false;
        if (r.ok) { closeDriveModal(); renderEditRequests(); return; }
        if (!driveReq) return;
        if (r.req) driveReq = r.req;
        showDriveError(r.message);
        if (driveCompleteWrap) driveCompleteWrap.hidden = !canComplete(driveReq);
        renderEditRequests();
        return;
      }
      closeDriveModal();
      completeRequest(req);
    });
  }

  // ------------------------------- Modal chi tiết 1 yêu cầu -------------------------------
  const modalOverlay = document.getElementById('kanbanModalOverlay');
  const modalBody = document.getElementById('kanbanModalBody');
  const modalClose = document.getElementById('kanbanModalClose');

  function openRequestModal(req) {
    if (!modalOverlay || !modalBody) return;
    // Thợ ảnh mở xem yêu cầu thật (chưa xem) -> tắt badge "chưa xem" trên tab.
    if (EDIT_SYNC && role === 'tho-anh' && !req.isStatic && !req.staffSeen) {
      // Chế độ đồng bộ: chỉ tắt nhãn "Mới" khi server đã lưu (không chặn việc mở chi tiết)
      AlohaEditSync.markSeen(req.id).then((res) => {
        if (res.ok && res.data) { keepServerCopy(res.data.request); req.staffSeen = true; renderEditRequests(); }
      });
    } else if (role === 'tho-anh' && !req.isStatic && !req.staffSeen && window.AlohaData) {
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
    modalReqId = null;
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

  // ------------------------------- Ảnh đã chỉnh + trao đổi với khách (trong modal) -------------------------------
  // Thợ ảnh dán link thư mục Drive ảnh đã chỉnh -> khách thấy ở tab "Ảnh đã chỉnh" trong
  // "Ảnh của tôi"; 2 bên nhắn tin ngay dưới. Sếp xem chỉ đọc. Dữ liệu nằm trong chính
  // yêu cầu chỉnh sửa (resultLink, messages - js/data-store.js).
  let modalReqId = null;      // yêu cầu thật đang mở trong modal (để tự làm mới khung chat)
  let modalChatCount = -1;
  const fmtTime = (t) => new Date(t).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
  const staffName = () => (session && session.name) || 'Thợ ảnh';

  function freshRequest(id) {
    if (EDIT_SYNC) { const r = syncReqs.find(x => x.id === id); return r ? toViewReq(r) : null; }
    return window.AlohaData ? AlohaData.getEditRequests().find(r => r.id === id) || null : null;
  }
  // Có tin của khách cần thợ trả lời (Trợ lý AI đã chuyển, hoặc AI lỗi) mà thợ chưa trả lời
  // sau đó -> nhắc trên thẻ kanban. Tin cũ không có cờ needsStaff coi như cần thợ xem.
  function lastStaffIndex(msgs) {
    let last = -1;
    msgs.forEach((m, i) => { if (m.from === 'staff') last = i; });
    return last;
  }
  function awaitingReply(req) {
    const msgs = Array.isArray(req.messages) ? req.messages : [];
    return msgs.slice(lastStaffIndex(msgs) + 1).some(m => m.from === 'customer' && m.needsStaff !== false);
  }

  // Khung link trong modal chi tiết (form 2 link ngay dưới ảnh, lấy từ nhánh Thợ ảnh 7ee735d).
  // Link ảnh đã chỉnh: khách thấy, bắt buộc để Hoàn tất. Link ảnh gốc: tuỳ chọn, CHỈ nội bộ.
  // Thẻ minh hoạ dùng được form link + Hoàn tất (lưu tạm), không có chat với khách.
  function renderResultSection(req) {
    const linkLine = (label, id, url) => `<span class="kanban-result-link-row">${label}: ${url
      ? `<a id="${id}" target="_blank" rel="noopener noreferrer"></a>` : '<em>chưa có</em>'}</span>`;
    return `
      <section class="kanban-result">
        <h4>Link Drive</h4>
        <div class="kanban-result-current" id="kanbanResultCurrent">
          ${linkLine('Ảnh đã chỉnh (khách thấy)', 'kanbanResultAnchor', hasEditedLink(req))}
          ${linkLine('Ảnh gốc (nội bộ, khách không thấy)', 'kanbanResultAnchorOrig', /^https:\/\//i.test(req.resultLinkOriginal || ''))}
          ${req.resultLinkAt ? `<span class="kanban-result-link-row">Gửi link ảnh đã chỉnh lúc ${escHtml(fmtTime(req.resultLinkAt))}</span>` : ''}
        </div>
        ${canEditProgress && req.status !== 'Hoàn thành' ? `
        <form class="kanban-link-form" id="kanbanLinkForm" novalidate>
          <label for="kanbanLinkEdit">Link Drive <strong>ảnh đã chỉnh</strong> (khách thấy, bắt buộc để Hoàn tất)</label>
          <input type="url" id="kanbanLinkEdit" placeholder="https://drive.google.com/drive/folders/... (ảnh đã chỉnh)" autocomplete="off">
          <label for="kanbanLinkOrig">Link Drive <strong>ảnh gốc</strong><span class="drive-modal-internal">Nội bộ</span> (tuỳ chọn)</label>
          <input type="url" id="kanbanLinkOrig" placeholder="https://drive.google.com/drive/folders/... (ảnh gốc, nội bộ)" autocomplete="off">
          <p class="link-note">Thư mục ảnh gốc để chế độ Hạn chế, chỉ chia sẻ cho tài khoản được cấp quyền.</p>
          <p class="kanban-result-error" id="kanbanLinkError" hidden></p>
          <button type="submit" class="btn btn-primary">${req.resultLink || req.resultLinkOriginal ? 'Cập nhật link' : 'Lưu link'}</button>
        </form>
        ${canComplete(req) ? '<button type="button" class="drive-modal-complete-btn kanban-link-complete" id="kanbanLinkComplete">Hoàn tất, chuyển sang mục Đã hoàn tất</button>' : ''}
        <p class="kanban-result-hint">Có link ảnh đã chỉnh thì bấm "Hoàn tất": mọi ảnh được tính là xong và đơn chuyển sang Hoàn thành. Thư mục ảnh đã chỉnh theo thiết kế hiện tại để "Bất kỳ ai có đường liên kết" để khách gửi người thân; cần studio xác nhận trước khi dùng với ảnh thật.</p>` : ''}
        ${req.isStatic ? '<p class="kanban-modal-meta">Thẻ minh hoạ: link chỉ lưu tạm tới khi tải lại trang; trao đổi với khách chỉ có ở yêu cầu thật của khách.</p>' : `
        <h4>Trao đổi với khách</h4>
        <div class="kanban-chat-list" id="kanbanChatList"></div>
        ${canEditProgress ? `
        <form class="kanban-chat-form" id="kanbanChatForm">
          <textarea id="kanbanChatInput" rows="2" maxlength="1000" placeholder="Trả lời khách..." aria-label="Trả lời khách"></textarea>
          <button type="submit" class="btn btn-primary">Gửi</button>
        </form>` : '<p class="kanban-modal-meta">Sếp xem được nội dung trao đổi, Thợ ảnh là người trả lời khách.</p>'}`}
      </section>`;
  }

  function renderModalChat(req) {
    if (window.AlohaDrive) AlohaDrive.attach(document.getElementById('kanbanChatForm'), document.getElementById('kanbanChatInput'));
    const list = document.getElementById('kanbanChatList');
    if (!list) return;
    const msgs = Array.isArray(req.messages) ? req.messages : [];
    const lastStaff = lastStaffIndex(msgs);
    list.innerHTML = msgs.length ? msgs.map((m, i) => {
      const who = m.from === 'staff' ? 'from-staff' : m.from === 'ai' ? 'from-ai' : 'from-customer';
      const name = m.from === 'ai' ? 'Trợ lý AI (tự động)' : (m.name || (m.from === 'staff' ? 'Thợ ảnh' : 'Khách hàng'));
      const tag = m.from === 'customer' && m.needsStaff !== false && i > lastStaff ? '<span class="kanban-msg-tag">Cần thợ trả lời</span>' : '';
      return `
      <div class="kanban-msg ${who}">
        <span class="kanban-msg-name">${escHtml(name)}</span>
        <div>${window.AlohaDrive ? AlohaDrive.render(m.text) : escHtml(m.text)}</div>
        <time>${escHtml(fmtTime(m.at))}</time>${tag}
      </div>`;
    }).join('') : '<p class="kanban-chat-empty">Chưa có tin nhắn nào với khách.</p>';
    if (msgs.length !== modalChatCount) list.scrollTop = list.scrollHeight;
    modalChatCount = msgs.length;
  }

  function bindResultSection(req) {
    modalReqId = req.isStatic ? null : req.id;
    modalChatCount = -1;
    // Gán link qua thuộc tính DOM (không nối chuỗi href), chỉ nhận https
    [['kanbanResultAnchor', req.resultLink], ['kanbanResultAnchorOrig', req.resultLinkOriginal]].forEach(([id, url]) => {
      const a = document.getElementById(id);
      if (a && /^https:\/\//i.test(url || '')) { a.href = url; a.textContent = url; }
    });
    const linkForm = document.getElementById('kanbanLinkForm');
    if (linkForm) {
      const inEdit = document.getElementById('kanbanLinkEdit');
      const inOrig = document.getElementById('kanbanLinkOrig');
      inEdit.value = req.resultLink || '';
      inOrig.value = req.resultLinkOriginal || '';
      linkForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (EDIT_SYNC && !req.isStatic) {
          const btn = linkForm.querySelector('button[type="submit"]');
          if (btn.disabled) return;
          btn.disabled = true;
          const typed = [inEdit.value.trim(), inOrig.value.trim()];
          const r = await saveDriveLinksSync(req, typed[0], typed[1]);
          btn.disabled = false;
          if (r.ok) { renderModalBody(r.req); renderEditRequests(); return; }
          // Lỗi / 409: vẽ lại theo bản mới nhất (nếu có) nhưng GIỮ chữ thợ đã gõ, báo lỗi; không tự gửi lại
          if (r.req) {
            renderModalBody(r.req);
            renderEditRequests();
            document.getElementById('kanbanLinkEdit').value = typed[0];
            document.getElementById('kanbanLinkOrig').value = typed[1];
          }
          const errEl = document.getElementById('kanbanLinkError');
          if (errEl) { errEl.textContent = r.message; errEl.hidden = false; }
          return;
        }
        const err = saveDriveLinks(req, inEdit.value.trim(), inOrig.value.trim());
        const errEl = document.getElementById('kanbanLinkError');
        errEl.textContent = err;
        errEl.hidden = !err;
        if (err) return;
        renderModalBody(req);
        renderEditRequests();
      });
    }
    const completeBtn = document.getElementById('kanbanLinkComplete');
    if (completeBtn) completeBtn.addEventListener('click', async () => {
      if (EDIT_SYNC && !req.isStatic) {
        // Chỉ đóng chi tiết khi server đã xác nhận Hoàn tất
        if (completeBtn.disabled) return;
        completeBtn.disabled = true;
        const r = await completeRequestSync(req);
        completeBtn.disabled = false;
        if (r.ok) { closeModal(); renderEditRequests(); return; }
        if (r.req) { renderModalBody(r.req); renderEditRequests(); }
        let errEl = document.getElementById('kanbanLinkError');
        if (!errEl) {
          // Đã Hoàn thành ở phiên khác -> không còn form link: chèn dòng báo vào khung link
          const box = document.getElementById('kanbanResultCurrent');
          errEl = document.createElement('p');
          errEl.id = 'kanbanLinkError';
          errEl.className = 'kanban-result-error';
          errEl.setAttribute('role', 'alert');
          if (box) box.insertAdjacentElement('afterend', errEl);
        }
        errEl.textContent = r.message;
        errEl.hidden = false;
        return;
      }
      closeModal();
      completeRequest(req);
    });
    if (req.isStatic) return;
    renderModalChat(req);
    const chatForm = document.getElementById('kanbanChatForm');
    const chatInput = document.getElementById('kanbanChatInput');
    if (chatForm) {
      chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (EDIT_SYNC) {
          // Gửi qua server (người gửi = Thợ ảnh theo token). Lỗi -> giữ chữ đã gõ, báo lỗi.
          const sendBtn = chatForm.querySelector('button[type="submit"]');
          const text = chatInput.value.trim();
          if (!text || sendBtn.disabled) return;
          sendBtn.disabled = true;
          const res = await AlohaEditSync.addMessage(req.id, text);
          sendBtn.disabled = false;
          let errEl = document.getElementById('kanbanChatError');
          if (!res.ok || !res.data) {
            if (!errEl) {
              errEl = document.createElement('p');
              errEl.id = 'kanbanChatError';
              errEl.className = 'kanban-result-error';
              errEl.setAttribute('role', 'alert');
              chatForm.insertAdjacentElement('afterend', errEl);
            }
            errEl.textContent = 'Tin nhắn CHƯA được gửi: ' + (res.message || 'lỗi không xác định.');
            errEl.hidden = false;
            return;
          }
          if (errEl) errEl.hidden = true;
          keepServerCopy(res.data.request);
          chatInput.value = '';
          req.messages = res.data.request.messages;
          renderModalChat(req);
          renderEditRequests();
          return;
        }
        const saved = AlohaData.addRequestMessage(req.id, 'staff', staffName(), chatInput.value);
        if (!saved) return;
        chatInput.value = '';
        req.messages = saved.messages;
        renderModalChat(saved);
        renderEditRequests();
      });
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); chatForm.requestSubmit(); }
      });
    }
  }

  // Khách nhắn thêm khi modal đang mở -> chỉ làm mới khung chat (không đụng ô đang gõ)
  function refreshModalChat() {
    if (!modalReqId || !modalOverlay || !modalOverlay.classList.contains('open')) return;
    const fresh = freshRequest(modalReqId);
    if (fresh && (fresh.messages || []).length !== modalChatCount) renderModalChat(fresh);
  }

  function renderModalBody(req) {
    const doneIds = getDoneIds(req);
    const total = (req.photos || []).length;
    const pct = total ? Math.round(doneIds.length / total * 100) : 0;
    modalBody.innerHTML = `
      <h3 id="kanbanModalTitle">${escHtml(req.orderCode || req.id)}</h3>
      <p class="kanban-modal-meta">${escHtml(req.customerName)} · ${escHtml(req.serviceLabel || 'Chụp ảnh')} · <span class="badge ${STATUS_BADGE_CLASS[req.status] || 'badge-dat-lich'}">${escHtml(req.status)}</span></p>
      <p class="kanban-modal-meta">Gửi yêu cầu ${formatRelativeTime(req.createdAt)}</p>
      ${req.extraCount > 0 ? `<p class="kanban-modal-note" style="background:#fff0f6;border-left:3px solid #e91e8c;color:#c41d7f;margin-bottom:12px;">📸 <strong>Chỉnh sửa thêm ngoài gói:</strong> +${req.extraCount} ảnh · Phí thêm: ${(req.extraFee || 0).toLocaleString('vi-VN')}đ · Trạng thái: ${escHtml(req.paymentStatus || 'Chờ chuyển khoản')}</p>` : ''}
      ${req.note ? `<p class="kanban-modal-note">Ghi chú chung: "${escHtml(req.note)}"</p>` : ''}
      ${req.driveJob ? `<div class="drive-folder-actions">
        ${req.driveJob.inputFolderId ? `<a class="btn btn-primary btn-sm" href="https://drive.google.com/drive/folders/${encodeURIComponent(req.driveJob.inputFolderId)}" target="_blank" rel="noopener noreferrer">Mở ảnh cần chỉnh</a>` : ''}
        ${req.driveJob.outputFolderId ? `<a class="btn btn-outline btn-sm" href="https://drive.google.com/drive/folders/${encodeURIComponent(req.driveJob.outputFolderId)}" target="_blank" rel="noopener noreferrer">Mở thư mục lưu ảnh đã chỉnh</a>` : ''}
        ${['pending','copying'].includes(req.driveJob.status) ? '<span class="drive-folder-note">Đang chép ảnh khách chọn lên Drive…</span>' : ''}
        ${req.driveJob.status === 'error' ? `<span class="drive-folder-error">${escHtml(req.driveJob.message)}</span> ${role === 'tho-anh' ? `<button type="button" class="btn btn-outline btn-sm" data-drive-retry="${escHtml(req.id)}">Thử lại</button>` : ''}` : ''}
        ${req.driveJob.delivery ? `<span class="drive-folder-note">${req.driveJob.delivery.status === 'delivered' ? 'Đã tự giao cho khách lúc ' + escHtml(fmtTime(req.driveJob.delivery.at)) : 'Đã nhận ' + req.driveJob.delivery.matched + '/' + req.driveJob.delivery.total + ' ảnh đã chỉnh'}</span>
        ${req.driveJob.delivery.missing?.length ? `<span class="drive-folder-note">Thiếu: ${escHtml(req.driveJob.delivery.missing.join(', '))}</span>` : ''}
        ${req.driveJob.delivery.unknown?.length ? `<span class="drive-folder-note">Tên lạ: ${escHtml(req.driveJob.delivery.unknown.join(', '))}</span>` : ''}
        ${req.driveJob.delivery.error ? `<span class="drive-folder-error">${escHtml(req.driveJob.delivery.error)}</span>` : ''}` : ''}
      </div>` : ''}
      ${/^https:\/\/drive\.google\.com\//.test(req.sourceFolderUrl || '') ? `<p class="kanban-modal-meta">Khách đã chọn từ bộ ảnh gốc được giao: <a href="${escHtml(req.sourceFolderUrl)}" target="_blank" rel="noopener noreferrer">Mở thư mục Drive</a> · Lượt ${req.round || 1}</p>` : ''}
      ${total > 0 ? `
      <div class="kanban-modal-progress" style="--col-accent:${STATUS_ACCENT[req.status] || 'var(--pink-600)'}">
        <div class="kanban-progress-track"><div class="kanban-progress-fill${pct === 100 ? ' done' : ''}" style="width:${pct}%"></div></div>
        <span class="kanban-progress-label">Đã xong ${doneIds.length}/${total} ảnh</span>
      </div>
      <p class="kanban-modal-meta">Tiến độ đếm số ảnh đã được đánh dấu xong. Không đánh dấu từng ảnh nữa: khi Thợ ảnh bấm "Hoàn tất" (cần có link ảnh đã chỉnh), toàn bộ ảnh được tính là xong.</p>
      <div class="photo-copy-row"><button type="button" id="copyPhotoNames">Chép tên file</button><span id="copyPhotoStatus" role="status"></span></div>
      <div class="kanban-photo-grid">
        ${req.photos.map(p => {
          const fname = p.name || photoFilename(p.id);
          return `
          <div class="kanban-photo-tile" data-photo-id="${escHtml(p.id)}">
            <img src="${escHtml(p.src)}" alt="Ảnh ${escHtml(fname)} trong yêu cầu ${escHtml(req.orderCode || req.id)}" loading="lazy">
            ${(p.editOptions || []).map(x=>`<small class="badge badge-dat-lich">${escHtml(x)}</small>`).join(' ')}
            ${p.fromEdited ? '<p class="note">Ảnh đã chỉnh, khách muốn chỉnh tiếp</p>' : ''}
            ${p.note ? `<p class="note">"${escHtml(p.note)}"</p>` : ''}
            <div class="photo-file-row">
              <span class="photo-filename">${escHtml(fname)}</span>
              <a class="photo-download-btn" href="${escHtml(p.driveUrl || p.src)}" target="_blank" rel="noopener noreferrer" title="Mở trên Drive ${escHtml(fname)}" aria-label="Mở trên Drive ${escHtml(fname)}">Mở trên Drive
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </a>
            </div>
          </div>`;
        }).join('')}
      </div>` : '<p class="kanban-modal-meta">Yêu cầu này chưa có dữ liệu chi tiết từng ảnh (dữ liệu cũ).</p>'}
      ${renderResultSection(req)}
    `;
    const copy=modalBody.querySelector('#copyPhotoNames');
    if(copy) copy.onclick=async()=>{
      const status=modalBody.querySelector('#copyPhotoStatus');
      try { await navigator.clipboard.writeText(req.photos.map(p=>p.name || photoFilename(p.id)).join('\n')); status.textContent='Đã chép '+req.photos.length+' tên file'; }
      catch(_) {status.textContent='Không chép được. Hãy cho phép truy cập clipboard.';}
    };
    bindResultSection(req);
  }

  // ------------------------------- Bảng "Đã hoàn tất" (#hoan-tat) -------------------------------
  // Lấy từ nhánh Thợ ảnh (7ee735d). Mọi yêu cầu status 'Hoàn thành', mới gửi link lên đầu.
  // Cột link ảnh gốc chỉ nhân viên thấy (trang quản trị đã chặn khách bằng requireRole).
  const fmtDay = (ts) => {
    if (!ts) return '—';
    const d = new Date(ts);
    return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
  };

  function renderCompletedTable() {
    const tbody = document.getElementById('completedTableBody');
    if (!tbody) return; // vai trò không có mục này
    const emptyEl = document.getElementById('completedEmpty');
    const summaryEl = document.getElementById('completedSummary');
    const countEl = document.getElementById('completedCount');
    const done = getAllRequests()
      .filter(r => r.status === 'Hoàn thành')
      .sort((a, b) => (b.resultLinkAt || b.createdAt) - (a.resultLinkAt || a.createdAt));
    if (summaryEl) summaryEl.hidden = !done.length;
    if (countEl) countEl.textContent = done.length;
    if (emptyEl) emptyEl.hidden = !!done.length;

    const iconCal = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>';
    const iconCheck = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9"/></svg>';
    const iconImg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
    const linkCell = (url, kind) => /^https:\/\//i.test(url || '')
      ? `<div class="ct-link-val"><a class="ct-link-anchor" data-kind="${kind}" target="_blank" rel="noopener noreferrer"></a><button type="button" class="ct-link-copy" data-kind="${kind}">Sao chép</button></div>`
      : '<span class="ct-link-none">Chưa có link</span>';

    tbody.innerHTML = done.map((req, idx) => {
      const wLabel = workerLabel(req.photographer);
      const wIdx = ['tho1', 'tho2', 'tho3'].indexOf(req.photographer) + 1;
      return `<tr data-req-id="${escHtml(req.id)}">
        <td style="text-align:center"><span class="ct-stt-val">${idx + 1}</span></td>
        <td><div class="ct-code-val">${escHtml(req.orderCode || req.id)}</div><div class="ct-name-val">${escHtml(req.customerName || '')}</div></td>
        <td style="text-align:center"><span class="ct-worker-badge ${wLabel ? 'ct-worker-' + wIdx : 'ct-worker-none'}">${escHtml(wLabel || 'Chưa phân công')}</span></td>
        <td><div class="ct-date-val">${iconCal}${escHtml(req.shootDate || '—')}</div></td>
        <td><div class="ct-date-val">${iconCheck}${escHtml(fmtDay(req.resultLinkAt))}</div></td>
        <td style="text-align:center">${(req.photos || []).length
          ? `<button type="button" class="ct-view-btn">${iconImg} Xem ảnh</button>`
          : '<span class="ct-link-none">Không có</span>'}</td>
        <td>${linkCell(req.resultLink, 'edit')}</td>
        <td>${linkCell(req.resultLinkOriginal, 'orig')}</td>
      </tr>`;
    }).join('');

    // Gán link qua thuộc tính DOM + gắn sự kiện (không nối chuỗi href)
    tbody.querySelectorAll('tr[data-req-id]').forEach(tr => {
      const req = done.find(r => r.id === tr.dataset.reqId);
      if (!req) return;
      const urlOf = (kind) => kind === 'orig' ? req.resultLinkOriginal : req.resultLink;
      tr.querySelectorAll('.ct-link-anchor').forEach(a => { a.href = urlOf(a.dataset.kind); a.textContent = urlOf(a.dataset.kind); });
      tr.querySelectorAll('.ct-link-copy').forEach(btn => btn.addEventListener('click', () => {
        if (!navigator.clipboard) return;
        navigator.clipboard.writeText(urlOf(btn.dataset.kind)).then(() => {
          btn.textContent = 'Đã sao chép';
          setTimeout(() => { btn.textContent = 'Sao chép'; }, 1500);
        }, () => {});
      }));
      const viewBtn = tr.querySelector('.ct-view-btn');
      if (viewBtn) viewBtn.addEventListener('click', () => openPhotoPreview(req));
    });
  }

  // ------------------------------- Cửa sổ xem lại ảnh + ghi chú của khách -------------------------------
  const previewOverlay = document.getElementById('photoPreviewOverlay');
  const previewGrid = document.getElementById('photoPreviewGrid');
  const previewTitle = document.getElementById('photoPreviewTitle');
  const previewSub = document.getElementById('photoPreviewSub');

  function openPhotoPreview(req) {
    if (!previewOverlay || !previewGrid) return;
    const photos = req.photos || [];
    if (previewTitle) previewTitle.textContent = (req.orderCode || req.id) + ', ảnh khách chọn';
    if (previewSub) previewSub.textContent = [req.customerName, req.serviceLabel, photos.length + ' ảnh'].filter(Boolean).join(' · ');
    previewGrid.innerHTML = photos.length ? photos.map(p => `
      <div class="photo-preview-tile">
        <img src="${escHtml(p.src)}" alt="Ảnh ${escHtml(photoFilename(p.id))}" loading="lazy">
        ${/^drive-[\w-]+$/.test(p.id) ? `<a href="https://drive.google.com/file/d/${encodeURIComponent(p.id.slice(6))}/view" target="_blank" rel="noopener noreferrer">Mở ảnh trên Drive</a>` : ''}
        ${p.note ? `<p class="photo-preview-note">"${escHtml(p.note)}"</p>` : ''}
      </div>`).join('') : '<p class="photo-preview-empty">Yêu cầu này chưa có dữ liệu ảnh chi tiết.</p>';
    previewOverlay.classList.add('open');
    previewOverlay.setAttribute('aria-hidden', 'false');
  }
  function closePhotoPreview() {
    if (!previewOverlay) return;
    previewOverlay.classList.remove('open');
    previewOverlay.setAttribute('aria-hidden', 'true');
  }
  const previewCloseBtn = document.getElementById('photoPreviewClose');
  if (previewCloseBtn) previewCloseBtn.addEventListener('click', closePhotoPreview);
  if (previewOverlay) previewOverlay.addEventListener('click', (e) => { if (e.target === previewOverlay) closePhotoPreview(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && previewOverlay && previewOverlay.classList.contains('open')) closePhotoPreview();
  });

  renderEditRequests();   // 3 hàng ưu tiên + bảng Đã hoàn tất
  // Mô phỏng "real-time" trong cùng trình duyệt: nếu Khách vừa gửi yêu cầu mới
  // (hoặc dữ liệu đổi ở tab/khung khác), 3 hàng + bảng Đã hoàn tất + badge "chưa xem" trên tab tự
  // cập nhật mà không cần tải lại trang. Không đụng vào modal đang mở (nếu có)
  // để không ngắt thao tác Thợ ảnh đang làm dở. KHÔNG đồng bộ được giữa các
  // thiết bị/trình duyệt khác nhau vì site tĩnh chưa có backend thật (xem
  // rules/tech-defaults.md mục "Giới hạn của bản hiện tại").
  if (EDIT_SYNC) {
    // Chế độ đồng bộ (Thợ ảnh): tải từ server ngay, rồi hỏi lại 5 giây/lần. Không đụng modal đang mở
    // (chỉ làm mới khung chat). Dữ liệu chỉ giữ trong bộ nhớ trang, không ghi localStorage.
    let syncLoading = false;
    const syncTick = async () => {
      if (syncLoading) return;
      syncLoading = true;
      await refreshSync();
      syncLoading = false;
      renderEditRequests();
      refreshModalChat();
    };
    syncTick();
    setInterval(syncTick, 5000);
  } else {
    setInterval(() => { renderEditRequests(); refreshModalChat(); }, 5000);
    // Khách nhắn / dữ liệu đổi ở tab khác cùng trình duyệt -> cập nhật ngay
    window.addEventListener('storage', (e) => { if (e.key === 'aloha_demo_db') { renderEditRequests(); refreshModalChat(); } });
  }

  // ------------------------------- Tin nhắn khách hàng (Sale trả lời, Sếp chỉ xem) -------------------------------
  // Hiển thị toàn bộ cuộc hội thoại của TẤT CẢ nhân viên Sale (Ngọc Anh, Minh Thư, Thu Hà,
  // Quốc Bảo, Hải Yến) từ saleDb.conversations. Sếp xem được toàn bộ, có bộ lọc theo từng Sale,
  // theo trạng thái, tìm kiếm nhanh và xem hồ sơ CRM của khách. Nếu có kết nối máy chủ chat,
  // dữ liệu sẽ tự động đồng bộ thêm các tin nhắn mới nhất.
  const inboxList = document.getElementById('inboxList');
  if (inboxList) {
    const inboxHead = document.getElementById('inboxHead');
    const inboxMsgs = document.getElementById('inboxMsgs');
    const inboxReply = document.getElementById('inboxReply');
    const inboxInput = document.getElementById('inboxInput');
    const inboxStatus = document.getElementById('inboxStatus');
    const inboxSub = document.getElementById('inboxSub');
    const inboxBossBar = document.getElementById('inboxBossBar');
    const inboxBossBarText = document.getElementById('inboxBossBarText');
    const inboxSearch = document.getElementById('inboxSearch');
    const inboxSaleFilter = document.getElementById('inboxSaleFilter');
    const inboxChannelFilter = document.getElementById('inboxChannelFilter');

    const isSep = role === 'sep';
    const canReply = role === 'sale';
    let filterSale = '';
    let filterChannel = '';
    let searchQuery = '';

  const DEMO_INBOX_CUSTOMERS = [
  {
    "id": "na-trang",
    "name": "Chị Thu Trang",
    "phone": "0912456456",
    "service": "Newborn",
    "area": "Thanh Xuân, Hà Nội"
  },
  {
    "id": "na-duc",
    "name": "Anh Minh Đức",
    "phone": "0983222731",
    "service": "Sinh nhật",
    "area": "Cầu Giấy, Hà Nội"
  },
  {
    "id": "na-linh",
    "name": "Chị Hà Linh",
    "phone": "0987654321",
    "service": "Newborn",
    "area": "Đống Đa, Hà Nội"
  },
  {
    "id": "na-nhung",
    "name": "Chị Hồng Nhung",
    "phone": "0978111222",
    "service": "Tại nhà",
    "area": "Long Biên, Hà Nội"
  },
  {
    "id": "na-quang",
    "name": "Anh Quang",
    "phone": "0904333444",
    "service": "Gia đình",
    "area": "Hà Đông, Hà Nội"
  },
  {
    "id": "na-ngan",
    "name": "Chị Ngân",
    "phone": "0971234555",
    "service": "Bầu",
    "area": "Thanh Xuân, Hà Nội"
  },
  {
    "id": "na-phuong",
    "name": "Chị Phương",
    "phone": "0918765432",
    "service": "Newborn",
    "area": "Hai Bà Trưng, Hà Nội"
  },
  {
    "id": "mt-dieulinh",
    "name": "Chị Diệu Linh",
    "phone": "0913555666",
    "service": "Newborn",
    "area": "Đống Đa, Hà Nội"
  },
  {
    "id": "mt-nam",
    "name": "Anh Hoàng Nam",
    "phone": "0902111333",
    "service": "Gia đình",
    "area": "Long Biên, Hà Nội"
  },
  {
    "id": "mt-dung",
    "name": "Chị Thùy Dung",
    "phone": "0976444888",
    "service": "Sinh nhật",
    "area": "Cầu Giấy, Hà Nội"
  },
  {
    "id": "th-phuongthao",
    "name": "Chị Phương Thảo",
    "phone": "0917333222",
    "service": "Bé lớn",
    "area": "Tây Hồ, Hà Nội"
  },
  {
    "id": "th-hang",
    "name": "Chị Minh Hằng",
    "phone": "0935666111",
    "service": "Newborn",
    "area": "Thanh Xuân, Hà Nội"
  },
  {
    "id": "th-khanhvy",
    "name": "Chị Khánh Vy",
    "phone": "0977888123",
    "service": "Bé lớn",
    "area": "Cầu Giấy, Hà Nội"
  },
  {
    "id": "qb-baongoc",
    "name": "Chị Bảo Ngọc",
    "phone": "0938777666",
    "service": "Tại nhà",
    "area": "Long Biên, Hà Nội"
  },
  {
    "id": "qb-quyen",
    "name": "Chị Lệ Quyên",
    "phone": "0968555222",
    "service": "Newborn",
    "area": "Thanh Xuân, Hà Nội"
  },
  {
    "id": "hy-quynh",
    "name": "Chị Như Quỳnh",
    "phone": "0919444111",
    "service": "Sinh nhật",
    "area": "Đống Đa, Hà Nội"
  },
  {
    "id": "hy-huong",
    "name": "Chị Thanh Hương",
    "phone": "0932888555",
    "service": "Newborn",
    "area": "Cầu Giấy, Hà Nội"
  },
  {
    "id": "hy-hongvan",
    "name": "Chị Hồng Vân",
    "phone": "0988222444",
    "service": "Sinh nhật",
    "area": "Thanh Xuân, Hà Nội"
  }
];

  const DEMO_INBOX_CONVERSATIONS = [
  {
    "id": "cv-na1",
    "owner": "ngoc-anh",
    "customerId": "na-trang",
    "channel": "Trợ lý web",
    "bot": true,
    "time": "2 phút",
    "unread": true,
    "online": true,
    "botSummary": "Dịch vụ: Newborn · Dự sinh: 15/10/2026 · SĐT: 0912 *** 456 · Quan tâm: concept nhẹ nhàng, chụp tại studio",
    "messages": [
      {
        "from": "kh",
        "text": "Cho em hỏi gói newborn bao nhiêu ạ, bé nhà em dự sinh 15/10",
        "time": "09:41"
      },
      {
        "from": "sale",
        "text": "Dạ ALOHA Baby chào chị Trang ạ! Bé dự sinh 15/10 thì thời điểm đẹp nhất để chụp newborn là khi bé được 7–14 ngày tuổi. Em gửi chị bảng giá và vài concept nhẹ nhàng nhé.",
        "time": "09:43"
      },
      {
        "from": "kh",
        "text": "Studio có khung nào cuối tháng 10 không em, chị muốn đặt trước",
        "time": "09:44"
      }
    ]
  },
  {
    "id": "cv-na2",
    "owner": "ngoc-anh",
    "customerId": "na-duc",
    "channel": "Chat trực tiếp",
    "time": "12 phút",
    "unread": true,
    "messages": [
      {
        "from": "sale",
        "text": "Dạ em đã gửi link cọc qua Zalo cho anh rồi ạ, lịch giữ tới 14:30 hôm nay.",
        "time": "10:05"
      },
      {
        "from": "kh",
        "text": "Ok em, tối anh chuyển cọc nhé",
        "time": "10:18"
      }
    ]
  },
  {
    "id": "cv-na3",
    "owner": "ngoc-anh",
    "customerId": "na-linh",
    "channel": "Chat trực tiếp",
    "time": "25 phút",
    "unread": true,
    "messages": [
      {
        "from": "kh",
        "text": "[Ảnh] Em gửi bill chuyển khoản",
        "time": "09:13"
      }
    ]
  },
  {
    "id": "cv-na4",
    "owner": "ngoc-anh",
    "customerId": "na-ngan",
    "channel": "Chat trực tiếp",
    "time": "1 giờ",
    "unread": true,
    "messages": [
      {
        "from": "kh",
        "text": "Mai chị mang thêm váy được không em?",
        "time": "09:30"
      }
    ]
  },
  {
    "id": "cv-na5",
    "owner": "ngoc-anh",
    "customerId": "na-nhung",
    "channel": "Trợ lý web",
    "bot": true,
    "time": "2 giờ",
    "unread": true,
    "botSummary": "Dịch vụ: Chụp tại nhà · Khu vực: Long Biên · Chưa để lại ngày mong muốn",
    "messages": [
      {
        "from": "kh",
        "text": "Studio có chụp tại nhà ở Long Biên không em?",
        "time": "08:31"
      }
    ]
  },
  {
    "id": "cv-na6",
    "owner": "ngoc-anh",
    "customerId": "na-quang",
    "channel": "Trợ lý web",
    "bot": true,
    "time": "3 giờ",
    "unread": true,
    "botSummary": "Dịch vụ: Gia đình · 4 người · Chưa chọn concept",
    "messages": [
      {
        "from": "kh",
        "text": "Gói gia đình 4 người giá thế nào",
        "time": "07:40"
      }
    ]
  },
  {
    "id": "cv-na7",
    "owner": "ngoc-anh",
    "customerId": "na-phuong",
    "channel": "Chat trực tiếp",
    "time": "Hôm qua",
    "unread": true,
    "messages": [
      {
        "from": "sale",
        "text": "Chị ơi bộ ảnh của bé đã lên \"Ảnh của tôi\", chị chọn giúp em 15 ảnh nhé.",
        "time": "Hôm qua"
      },
      {
        "from": "kh",
        "text": "Chị bận quá, cuối tuần chị chọn ảnh",
        "time": "Hôm qua"
      }
    ]
  },
  {
    "id": "cv-mt1",
    "owner": "minh-thu",
    "customerId": "mt-dieulinh",
    "channel": "Trợ lý web",
    "bot": true,
    "time": "40 phút",
    "unread": true,
    "botSummary": "Dịch vụ: Newborn · Dự sinh: 20/10/2026 · Quan tâm: concept tông trắng",
    "messages": [
      {
        "from": "kh",
        "text": "Em muốn đặt trước lịch chụp newborn cho bé ạ",
        "time": "09:50"
      }
    ]
  },
  {
    "id": "cv-mt2",
    "owner": "minh-thu",
    "customerId": "mt-nam",
    "channel": "Chat trực tiếp",
    "time": "Hôm qua",
    "messages": [
      {
        "from": "kh",
        "text": "Nhà anh có ông bà nữa, tổng 5 người được không em?",
        "time": "Hôm qua"
      },
      {
        "from": "sale",
        "text": "Dạ được ạ, chiều nay em gọi lại tư vấn anh nhé.",
        "time": "Hôm qua"
      }
    ]
  },
  {
    "id": "cv-mt3",
    "owner": "minh-thu",
    "customerId": "mt-dung",
    "channel": "Chat trực tiếp",
    "time": "55 phút",
    "unread": true,
    "messages": [
      {
        "from": "kh",
        "text": "Em ơi chị mở link rồi, chiều chị chuyển nhé",
        "time": "09:36"
      }
    ]
  },
  {
    "id": "cv-th1",
    "owner": "thu-ha",
    "customerId": "th-phuongthao",
    "channel": "Trợ lý web",
    "bot": true,
    "time": "1 giờ",
    "unread": true,
    "botSummary": "Dịch vụ: Bé lớn · Bé 3 tuổi · Quan tâm: concept Hàn Quốc",
    "messages": [
      {
        "from": "kh",
        "text": "Bé 3 tuổi chụp concept Hàn Quốc được không ạ",
        "time": "09:25"
      }
    ]
  },
  {
    "id": "cv-th2",
    "owner": "thu-ha",
    "customerId": "th-hang",
    "channel": "Chat trực tiếp",
    "time": "30 phút",
    "unread": true,
    "messages": [
      {
        "from": "kh",
        "text": "Em gửi chị xem thêm concept newborn nhé",
        "time": "10:00"
      }
    ]
  },
  {
    "id": "cv-th3",
    "owner": "thu-ha",
    "customerId": "th-khanhvy",
    "channel": "Chat trực tiếp",
    "time": "Hôm qua",
    "done": true,
    "messages": [
      {
        "from": "kh",
        "text": "Cảm ơn em, hôm nay bé chụp vui lắm",
        "time": "Hôm qua"
      },
      {
        "from": "sale",
        "text": "Dạ em cảm ơn chị, ảnh sẽ lên \"Ảnh của tôi\" trong vài ngày tới ạ.",
        "time": "Hôm qua"
      }
    ]
  },
  {
    "id": "cv-qb1",
    "owner": "quoc-bao",
    "customerId": "qb-baongoc",
    "channel": "Trợ lý web",
    "bot": true,
    "time": "20 phút",
    "unread": true,
    "botSummary": "Dịch vụ: Chụp tại nhà · Khu vực: Long Biên · Muốn chụp cuối tuần",
    "messages": [
      {
        "from": "kh",
        "text": "Cuối tuần sau studio còn lịch chụp tại nhà không ạ?",
        "time": "10:10"
      }
    ]
  },
  {
    "id": "cv-qb2",
    "owner": "quoc-bao",
    "customerId": "qb-quyen",
    "channel": "Chat trực tiếp",
    "time": "Hôm qua",
    "messages": [
      {
        "from": "kh",
        "text": "Để chị cân nhắc thêm với chồng nhé em",
        "time": "Hôm qua"
      }
    ]
  },
  {
    "id": "cv-hy1",
    "owner": "hai-yen",
    "customerId": "hy-quynh",
    "channel": "Chat trực tiếp",
    "time": "1 giờ",
    "unread": true,
    "messages": [
      {
        "from": "kh",
        "text": "Sinh nhật bé 2 tuổi có concept nào xinh không em?",
        "time": "09:28"
      }
    ]
  },
  {
    "id": "cv-hy2",
    "owner": "hai-yen",
    "customerId": "hy-huong",
    "channel": "Trợ lý web",
    "bot": true,
    "time": "2 giờ",
    "unread": true,
    "botSummary": "Dịch vụ: Newborn · Dự sinh: 08/10/2026 · Hẹn gọi lại 11:00",
    "messages": [
      {
        "from": "kh",
        "text": "11h em gọi lại chị nhé, giờ chị đang bận",
        "time": "08:40"
      }
    ]
  },
  {
    "id": "cv-hy3",
    "owner": "hai-yen",
    "customerId": "hy-hongvan",
    "channel": "Chat trực tiếp",
    "time": "3 giờ",
    "messages": [
      {
        "from": "kh",
        "text": "Chiều nay chị qua chụp cho bé Gạo nhé em",
        "time": "07:30"
      }
    ]
  }
];

    // Khởi tạo danh sách cuộc hội thoại ban đầu từ saleDb.conversations (hoặc fallback demo khi dữ liệu nền trống)
    function buildLocalChats() {
      const convSource = (saleDb && Array.isArray(saleDb.conversations) && saleDb.conversations.length)
        ? saleDb.conversations
        : DEMO_INBOX_CONVERSATIONS;
      const custSource = (saleDb && Array.isArray(saleDb.customers) && saleDb.customers.length)
        ? saleDb.customers
        : DEMO_INBOX_CUSTOMERS;

      const custMap = new Map();
      (custSource || []).forEach(c => {
        if (c.id) custMap.set(c.id, c);
        if (c.phone) custMap.set(c.phone, c);
      });

      return convSource.map((cv, idx) => {
        const cust = custMap.get(cv.customerId) || {};
        const phone = cust.phone || ('0900' + String(idx).padStart(6, '0'));
        const saleName = SALE_NAMES[cv.owner] || cv.owner || 'Sale';
        const msgs = (cv.messages || []).map((m, mIdx) => ({
          id: cv.id + '-m' + mIdx,
          from: m.from === 'sale' ? 'sale' : (m.from === 'system' || m.from === 'he-thong' ? 'he-thong' : 'khach'),
          senderName: m.from === 'sale' ? (m.by || saleName) : (cust.name || 'Khách'),
          text: m.text,
          at: m.time || cv.time || ''
        }));
        const last = msgs[msgs.length - 1];

        return {
          id: cv.id,
          phone: phone,
          customerId: cv.customerId,
          customerName: cust.name || 'Khách hàng',
          customerArea: cust.area || '',
          service: cust.service || '',
          topic: cust.service ? `${cust.service}` : (cv.channel || ''),
          channel: cv.channel || 'Trực tiếp',
          owner: cv.owner,
          saleName: saleName,
          bot: !!cv.bot,
          botSummary: cv.botSummary || '',
          unread: !!cv.unread,
          staffUnread: cv.unread ? 1 : 0,
          online: !!cv.online,
          time: cv.time || (last ? last.at : ''),
          last: last,
          messages: msgs,
          updatedAt: Date.now() - idx * 60000
        };
      });
    }

    let chats = buildLocalChats();
    let activeChat = chats[0] || null;
    let activePhone = activeChat ? activeChat.phone : null;
    let status = 'ok';
    let lastListKey = '';
    let lastThreadKey = '';
    let busy = false;

    // Cập nhật số lượng trên các option lọc Sale
    function updateSaleFilterCounts() {
      if (!inboxSaleFilter) return;
      const counts = {};
      chats.forEach(c => {
        counts[c.owner] = (counts[c.owner] || 0) + 1;
      });
      const currentVal = inboxSaleFilter.value;
      inboxSaleFilter.innerHTML = `
        <option value="">Tất cả Sale phụ trách (${chats.length})</option>
        <option value="ngoc-anh">Sale · Ngọc Anh (${counts['ngoc-anh'] || 0})</option>
        <option value="minh-thu">Sale · Minh Thư (${counts['minh-thu'] || 0})</option>
        <option value="thu-ha">Sale · Thu Hà (${counts['thu-ha'] || 0})</option>
        <option value="quoc-bao">Sale · Quốc Bảo (${counts['quoc-bao'] || 0})</option>
        <option value="hai-yen">Sale · Hải Yến (${counts['hai-yen'] || 0})</option>
      `;
      inboxSaleFilter.value = currentVal;
    }
    updateSaleFilterCounts();

    if (inboxSub) {
      if (isSep) {
        inboxSub.textContent = `Toàn bộ ${chats.length} cuộc trò chuyện giữa 5 nhân viên Sale và khách hàng. Chế độ chỉ xem dành cho Sếp.`;
      } else if (!canReply) {
        inboxSub.textContent = 'Tin nhắn khách gửi từ trang web và câu trả lời của các tài khoản Sale. Chế độ chỉ xem.';
      }
    }

    const pad2 = n => String(n).padStart(2, '0');
    function chatTime(ts) {
      if (!ts) return '';
      if (typeof ts === 'string') return ts;
      const d = new Date(ts);
      if (isNaN(d.getTime())) return String(ts);
      const hm = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
      return d.toDateString() === new Date().toDateString() ? hm : pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + ' ' + hm;
    }

    function renderStatus() {
      if (!inboxStatus) return;
      inboxStatus.hidden = status === 'ok' || status === 'loading';
      if (status === 'offline') {
        inboxStatus.innerHTML = 'Đang dùng dữ liệu nội bộ đồng bộ từ Không gian Sale. Máy chủ chat có thể cần vài chục giây để khởi động.';
      } else if (status === 'auth') {
        inboxStatus.innerHTML = 'Tài khoản chưa kết nối được với máy chủ chat. Đang xem dữ liệu hội thoại đã lưu. <button type="button" id="inboxRelogin">Đăng nhập lại</button>';
      }
    }

    function getFilteredChats() {
      return chats.filter(c => {
        if (filterSale && c.owner !== filterSale) return false;
        if (filterChannel === 'chua-tra-loi' && !c.unread && !c.staffUnread) return false;
        if (filterChannel === 'tro-ly-web' && !c.bot && c.channel !== 'Trợ lý web') return false;
        if (filterChannel === 'chat-truc-tiep' && (c.bot || c.channel === 'Trợ lý web')) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const nameMatch = (c.customerName || '').toLowerCase().includes(q);
          const phoneMatch = (c.phone || '').includes(q);
          const serviceMatch = (c.service || '').toLowerCase().includes(q);
          const saleMatch = (c.saleName || '').toLowerCase().includes(q);
          const msgMatch = (c.messages || []).some(m => (m.text || '').toLowerCase().includes(q));
          if (!nameMatch && !phoneMatch && !serviceMatch && !saleMatch && !msgMatch) return false;
        }
        return true;
      });
    }

    function renderInboxList() {
      const filtered = getFilteredChats();
      const key = status + '#' + filterSale + '#' + filterChannel + '#' + searchQuery + '#' +
        filtered.map(c => c.phone + ':' + (c.staffUnread || 0) + ':' + (c.last ? c.last.text : '')).join('|') + '#' + activePhone;
      if (key === lastListKey) return;
      lastListKey = key;

      if (!filtered.length) {
        inboxList.innerHTML = '<p class="inbox-empty">Không tìm thấy cuộc trò chuyện nào phù hợp với bộ lọc.</p>';
        return;
      }

      inboxList.innerHTML = filtered.map(c => {
        const last = c.last;
        const preview = last ? (last.from === 'sale' ? (last.senderName || 'Sale') + ': ' : last.from === 'he-thong' ? 'Tóm tắt: ' : '') + last.text : '';
        const unread = c.staffUnread || (c.unread ? 1 : 0);
        const saleLabel = c.saleName || SALE_NAMES[c.owner] || 'Sale';
        const displayTime = last && last.at ? chatTime(last.at) : (c.time || '');

        return `<button type="button" class="inbox-item${c.phone === activePhone ? ' active' : ''}${unread ? ' unread' : ''}" data-phone="${escHtml(c.phone)}" data-id="${escHtml(c.id || '')}" role="listitem">
          <span class="cust-av cust-av-${customerTone(c.phone)}" aria-hidden="true">${escHtml(customerInitials(c.customerName))}</span>
          <span class="inbox-item-text">
            <span class="inbox-item-top">
              <strong>${escHtml(c.customerName)}</strong>
              <time>${escHtml(displayTime)}</time>
            </span>
            <span class="inbox-item-badges">
              <span class="inbox-sale-badge">Sale · ${escHtml(saleLabel)}</span>
              ${c.service ? `<span class="inbox-topic">${escHtml(c.service)}</span>` : ''}
              ${c.channel ? `<span class="inbox-channel-tag ${c.bot ? 'tone-bot' : 'tone-direct'}">${escHtml(c.channel)}</span>` : ''}
            </span>
            <span class="inbox-preview">${escHtml(preview)}</span>
          </span>
          ${unread ? `<span class="inbox-unread" aria-label="${unread} tin chưa đọc">${unread}</span>` : ''}
        </button>`;
      }).join('');
    }

    function renderThread(forceScroll) {
      const chat = activeChat && activeChat.phone === activePhone ? activeChat : chats.find(c => c.phone === activePhone) || null;
      activeChat = chat;

      if (inboxReply) inboxReply.hidden = !(chat && canReply);
      if (inboxBossBar) {
        inboxBossBar.hidden = !(chat && isSep);
        if (chat && isSep && inboxBossBarText) {
          const sName = chat.saleName || SALE_NAMES[chat.owner] || 'Sale';
          inboxBossBarText.innerHTML = `<strong>Chế độ Quản trị / Sếp:</strong> Đang giám sát cuộc hội thoại của <strong>Sale · ${escHtml(sName)}</strong> với <strong>${escHtml(chat.customerName)}</strong> (Chế độ chỉ xem).`;
        }
      }

      if (!chat) {
        lastThreadKey = '';
        inboxHead.innerHTML = '';
        inboxMsgs.innerHTML = activePhone
          ? '<p class="inbox-empty">Đang tải cuộc trò chuyện…</p>'
          : '<p class="inbox-empty">Chọn một cuộc trò chuyện bên trái để xem tin nhắn.</p>';
        return;
      }

      const msgs = chat.messages || [];
      const key = chat.phone + ':' + msgs.length + ':' + (msgs.length ? msgs[msgs.length - 1].id : '') + ':' + (chat.botSummary || '');
      if (key === lastThreadKey && !forceScroll) return;
      lastThreadKey = key;

      const saleLabel = chat.saleName || SALE_NAMES[chat.owner] || 'Sale';
      const custPool = (saleDb && saleDb.customers && saleDb.customers.length) ? saleDb.customers : DEMO_INBOX_CUSTOMERS;
      const cObj = custPool.find(x => x.phone === chat.phone || x.id === chat.customerId) || null;
      const area = cObj ? cObj.area : (chat.customerArea || '');
      const service = (cObj && cObj.service) || chat.service || '';

      inboxHead.innerHTML = `
        <div class="inbox-head-user">
          ${custPerson({ name: chat.customerName, phone: chat.phone }, chat.phone + (area ? ' · ' + area : ''))}
          ${service ? `<span class="inbox-topic">Gói: ${escHtml(service)}</span>` : ''}
        </div>
        <div class="inbox-head-info">
          <span class="inbox-sale-chip">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13" aria-hidden="true">
              <circle cx="12" cy="7" r="4"/><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
            </svg>
            Sale phụ trách: <strong>${escHtml(saleLabel)}</strong>
          </span>
          ${chat.channel ? `<span class="inbox-channel-badge">${escHtml(chat.channel)}${chat.online ? ' · <span class="dot-online"></span>online' : ''}</span>` : ''}
          <button type="button" class="inbox-crm-link" data-search-phone="${escHtml(chat.phone)}" title="Mở thông tin khách trong bảng CRM">Xem hồ sơ CRM</button>
        </div>
      `;

      const nearBottom = inboxMsgs.scrollHeight - inboxMsgs.scrollTop - inboxMsgs.clientHeight < 60;
      let msgsHtml = '';
      if (chat.botSummary) {
        msgsHtml += `
          <div class="inbox-msg from-system">
            <span class="inbox-msg-name">Khách vừa chuyển từ trợ lý AI sang Sale · tóm tắt tự động</span>
            <span class="inbox-msg-text">${escHtml(chat.botSummary)}</span>
          </div>`;
      }

      msgsHtml += msgs.map(m => {
        if (m.from === 'he-thong' || m.from === 'system') {
          return `
            <div class="inbox-msg from-system">
              <span class="inbox-msg-name">${escHtml(m.senderName || 'Hệ thống')}</span>
              <span class="inbox-msg-text">${escHtml(m.text)}</span>
              ${m.at ? `<time>${escHtml(chatTime(m.at))}</time>` : ''}
            </div>`;
        }
        const isSale = m.from === 'sale';
        return `
          <div class="inbox-msg ${isSale ? 'from-sale' : 'from-khach'}">
            <span class="inbox-msg-name">${escHtml(isSale ? (m.senderName || saleLabel || 'Sale') : (chat.customerName || 'Khách'))}</span>
            <span class="inbox-msg-text">${escHtml(m.text)}</span>
            ${m.at ? `<time>${escHtml(chatTime(m.at))}</time>` : ''}
          </div>`;
      }).join('');

      inboxMsgs.innerHTML = msgsHtml;
      if (forceScroll || nearBottom) inboxMsgs.scrollTop = inboxMsgs.scrollHeight;
    }

    function updateInboxBadge() {
      const tab = document.querySelector('#adminTabs a[href="#tin-nhan"]');
      if (!tab) return;
      const total = chats.reduce((n, c) => n + (c.staffUnread || (c.unread ? 1 : 0)), 0);
      let badge = tab.querySelector('.admin-tab-badge');
      if (total > 0) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'admin-tab-badge';
          tab.appendChild(badge);
        }
        badge.textContent = total;
      } else if (badge) {
        badge.remove();
      }
    }

    function renderAll(forceScroll) {
      renderStatus();
      renderInboxList();
      renderThread(forceScroll);
      updateInboxBadge();
    }

    // Sale đang mở đúng cuộc trò chuyện (và đang nhìn trang) thì coi như đã đọc.
    async function markActiveRead() {
      if (!canReply || !activePhone || document.visibilityState !== 'visible') return;
      const summary = chats.find(c => c.phone === activePhone);
      if (!summary || !summary.staffUnread) return;
      summary.staffUnread = 0;
      summary.unread = false;
      if (window.AlohaAuth && AlohaAuth.api) {
        const r = await AlohaAuth.api('/api/sale-chat/inbox/' + encodeURIComponent(activePhone) + '/read', { method: 'POST' });
        if (r.ok && r.data.chat && activePhone === r.data.chat.phone) {
          activeChat = r.data.chat;
        }
      }
    }

    async function refreshInbox(forceScroll) {
      if (!window.AlohaAuth || !AlohaAuth.api) {
        renderAll(forceScroll);
        return;
      }
      const s = AlohaAuth.getSession();
      if (!s || !s.token) {
        // Vẫn giữ danh sách chats nội bộ để Sếp luôn xem được đầy đủ
        status = 'ok';
        renderAll(false);
        return;
      }
      if (busy) return;
      busy = true;
      try {
        const r = await AlohaAuth.api('/api/sale-chat/inbox');
        if (r && r.ok && Array.isArray(r.data.chats) && r.data.chats.length > 0) {
          status = 'ok';
          // Hợp nhất server chats với local chats
          const serverChats = r.data.chats;
          const phoneMap = new Map();
          serverChats.forEach(sc => phoneMap.set(sc.phone, sc));

          chats.forEach(lc => {
            if (!phoneMap.has(lc.phone)) {
              serverChats.push(lc);
            }
          });
          chats = serverChats;
          if (activePhone) {
            const t = await AlohaAuth.api('/api/sale-chat/inbox/' + encodeURIComponent(activePhone));
            if (t && t.ok && t.data.chat) activeChat = t.data.chat;
            await markActiveRead();
          }
        } else {
          // Server không có hoặc rỗng -> giữ chats nội bộ
          status = 'ok';
        }
      } catch (e) {
        status = 'ok'; // Giữ hiển thị danh sách hội thoại của các sale
      }
      busy = false;
      updateSaleFilterCounts();
      renderAll(forceScroll);
    }

    // Sự kiện chọn cuộc trò chuyện
    inboxList.addEventListener('click', e => {
      const item = e.target.closest('.inbox-item');
      if (!item) return;
      activePhone = item.dataset.phone;
      activeChat = chats.find(c => c.phone === activePhone) || null;
      if (activeChat) {
        activeChat.staffUnread = 0;
        activeChat.unread = false;
      }
      renderAll(true);
      if (canReply && inboxInput) inboxInput.focus();
    });

    // Lọc theo Sale
    if (inboxSaleFilter) {
      inboxSaleFilter.addEventListener('change', e => {
        filterSale = e.target.value;
        const filtered = getFilteredChats();
        if (filtered.length && (!activeChat || !filtered.some(c => c.phone === activePhone))) {
          activePhone = filtered[0].phone;
          activeChat = filtered[0];
        }
        renderAll(true);
      });
    }

    // Lọc theo kênh/trạng thái
    if (inboxChannelFilter) {
      inboxChannelFilter.addEventListener('change', e => {
        filterChannel = e.target.value;
        const filtered = getFilteredChats();
        if (filtered.length && (!activeChat || !filtered.some(c => c.phone === activePhone))) {
          activePhone = filtered[0].phone;
          activeChat = filtered[0];
        }
        renderAll(true);
      });
    }

    // Tìm kiếm
    if (inboxSearch) {
      inboxSearch.addEventListener('input', e => {
        searchQuery = e.target.value.trim();
        const filtered = getFilteredChats();
        if (filtered.length && (!activeChat || !filtered.some(c => c.phone === activePhone))) {
          activePhone = filtered[0].phone;
          activeChat = filtered[0];
        }
        renderAll(true);
      });
    }

    // Nút Xem hồ sơ CRM
    if (inboxHead) {
      inboxHead.addEventListener('click', e => {
        const link = e.target.closest('.inbox-crm-link');
        if (!link) return;
        const phone = link.dataset.searchPhone;
        const custTab = document.querySelector('#adminTabs a[href="#khach-hang"]');
        if (custTab) custTab.click();
        const custSearch = document.getElementById('custSearch') || document.querySelector('[data-ck-search]');
        if (custSearch && phone) {
          custSearch.value = phone;
          custSearch.dispatchEvent(new Event('input', { bubbles: true }));
        }
        const custSec = document.getElementById('khach-hang');
        if (custSec) custSec.scrollIntoView({ behavior: 'smooth' });
      });
    }

    // Gửi tin nhắn trả lời (dành cho tài khoản Sale)
    if (inboxReply) {
      inboxReply.addEventListener('submit', async e => {
        e.preventDefault();
        const text = inboxInput.value.trim();
        if (!text || !activePhone || !canReply) return;
        const btn = inboxReply.querySelector('button');
        btn.disabled = true;

        const newMsg = {
          id: 'msg-' + Date.now(),
          from: 'sale',
          senderName: (session && session.name) || 'Sale',
          text: text,
          at: chatTime(Date.now())
        };

        if (activeChat) {
          if (!activeChat.messages) activeChat.messages = [];
          activeChat.messages.push(newMsg);
          activeChat.last = newMsg;
          activeChat.unread = false;
        }

        if (window.AlohaAuth && AlohaAuth.api) {
          try {
            const r = await AlohaAuth.api('/api/sale-chat/inbox/' + encodeURIComponent(activePhone) + '/messages', { method: 'POST', body: { text } });
            if (r && r.ok && r.data.chat) activeChat = r.data.chat;
          } catch (err) { /* offline mode fallback */ }
        }

        btn.disabled = false;
        inboxInput.value = '';
        renderAll(true);
        inboxInput.focus();
      });
    }

    if (inboxStatus) {
      inboxStatus.addEventListener('click', e => { if (e.target.id === 'inboxRelogin' && window.AlohaAuth) AlohaAuth.logout(); });
    }

    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshInbox(false); });
    setInterval(() => { if (document.visibilityState === 'visible') refreshInbox(false); }, 5000);
    renderAll(true);
    refreshInbox(false);
  }

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
  window.addEventListener('aloha:workflow',event=>{
    if(!SALE_DB)return;
    const state=event.detail;
    WORKER_DEFS.splice(0,WORKER_DEFS.length,{id:'all',label:'Tất cả'},...state.employees.filter(e=>e.role==='tho-anh').map(e=>({id:e.phone,label:e.name,phones:[e.phone]})));
    if(role==='tho-anh')activeWorker=session.phone;
    renderEditRequests();
    state.employees.filter(e=>e.role==='sale').forEach(e=>{if(!SALE_DB.sales.some(s=>s.phone===e.phone))SALE_DB.sales.push({id:e.phone,phone:e.phone,name:e.name,target:0,achieved:0});});
    const workerName=p=>(state.employees.find(e=>e.phone===p)||{}).name||p;
    const orders=state.orders.filter(o=>o.status!=='cancelled');
    SALE_DB.appointments=SALE_DB.appointments.filter(a=>!a.workflowOrderId);
    SALE_DB.orders=SALE_DB.orders.filter(a=>!a.workflowOrderId);
    orders.forEach(o=>{
      const owner=(SALE_DB.sales.find(s=>s.phone===o.salePhone)||{}).id||o.salePhone;
      let c=SALE_DB.customers.find(c=>c.phone===o.phone);
      if(!c){c={id:o.customerId||'wf-'+o.phone,phone:o.phone,name:o.customerName,short:o.customerName.split(' ').pop(),title:'anh/chị',area:'',source:'Sale đặt lịch',tags:[],note:''};SALE_DB.customers.push(c);}
      Object.assign(c,{owner,service:o.service,stage:o.status==='booked'?'cho-coc':'da-chot',since:o.date,status:{text:o.shotAt?'Đã chụp':o.collected?'Đã cọc':'Chờ cọc',tone:o.shotAt?'teal':'blue'}});
      SALE_DB.appointments.push({id:o.id,workflowOrderId:o.id,customerId:c.id,owner,date:o.date,start:o.time,dur:o.duration/60,service:o.service,label:o.customerName,room:o.room,photographer:workerName(o.shooterPhone),status:o.shotAt?'da-chup':o.status==='shooting'?'checkin':o.status==='booked'?'giu-cho':'da-coc',depositCode:o.code});
      if(o.shotAt)SALE_DB.orders.push({code:o.code,workflowOrderId:o.id,customerId:c.id,owner,customer:o.customerName,service:o.service,pkg:o.pkg,date:o.date,status:o.status==='delivered'?'da-giao':o.status==='editing'?'dang-chinh':'cho-chon',progress:'',due:'Theo đơn'});
    });
    const counts=saleFunnelCounts();
    ['quan-tam','tu-van','dat-lich','da-chup','hoan-thanh'].forEach((k,i)=>{const num=document.querySelector('#kpi .kpi-'+k+' .num');if(num){num.textContent=counts[i];num.dataset.val=counts[i];}});
    document.querySelectorAll('#funnelChart .funnel-row').forEach((row,i)=>{const pct=Math.round(counts[i]/(counts[0]||1)*100),val=row.querySelector('.val'),bar=row.querySelector('.funnel-bar');if(val){val.dataset.val=counts[i];val.dataset.pct=pct;val.textContent=counts[i]+' ('+pct+'%)';}if(bar){bar.dataset.w=pct;bar.style.width=pct+'%';}});
    window.dispatchEvent(new Event('aloha:crm-projection'));
  });
});

document.addEventListener('click', async (e) => {
  const b=e.target.closest('[data-drive-retry]'); if(!b || !window.AlohaEditSync)return;
  b.disabled=true; const r=await AlohaEditSync.retryDrive(b.dataset.driveRetry);
  b.textContent=r.ok ? 'Đang chép ảnh…' : 'Thử lại'; b.disabled=!!r.ok;
});
