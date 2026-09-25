// ALOHA Baby — Không gian Sale (crm/sale.html).
// SPA nhỏ dùng location.hash: #tong-quan, #hop-thu, #khach-hang (Bảng giai đoạn +
// Danh sách; #khach-tiem-nang cũ tự chuyển về đây), #lich-chup, #dat-coc, #don-anh,
// #chuyen-giao, #bao-cao.
//
// Phân quyền dữ liệu (mô phỏng phía client, site tĩnh chưa có backend):
// - Sale đang đăng nhập được nhận diện qua số điện thoại trong session (js/auth.js)
//   rồi đối chiếu với ALOHA_SALE_DATA.sales.
// - Khách hàng, hộp thư, cọc, đơn & ảnh: CHỈ bản ghi có owner = sale đó.
// - Lịch chụp: lịch chung của studio, mọi sale thấy cả tuần; thông tin liên hệ
//   của khách chỉ hiện với sale phụ trách.
// Mọi thao tác chỉ thay đổi bản sao dữ liệu trong bộ nhớ trang (không lưu lại).
(function () {
  'use strict';

  const SRC = window.ALOHA_SALE_DATA;
  const db = JSON.parse(JSON.stringify(SRC));
  const CFG = db.config;
  const session = window.AlohaAuth.getSession() || {};
  const me = db.sales.find(s => s.phone === session.phone) || db.sales[0];

  // Đồng hồ demo: bắt đầu 25/09/2026 10:30 rồi chạy theo thời gian thật kể từ lúc mở trang.
  const DEMO_START = new Date(db.now).getTime();
  const PAGE_START = Date.now();
  const demoNow = () => new Date(DEMO_START + (Date.now() - PAGE_START));
  const TODAY = dateKey(new Date(DEMO_START));
  const TOMORROW = dateKey(addDays(new Date(DEMO_START), 1));

  // ---------- Hằng số ----------
  const STAGES = [
    { id: 'moi', label: 'Mới' },
    { id: 'tu-van', label: 'Đang tư vấn' },
    { id: 'bao-gia', label: 'Đã báo giá' },
    { id: 'cho-coc', label: 'Chờ đặt cọc' },
    { id: 'da-chot', label: 'Đã chốt' }
  ];
  const STAGE_DEFAULT_STATUS = {
    'moi': { text: 'Chưa liên hệ', tone: 'red' },
    'tu-van': { text: 'Đang tư vấn', tone: 'amber' },
    'bao-gia': { text: 'Đã gửi báo giá', tone: 'muted' },
    'cho-coc': { text: 'Chờ đặt cọc', tone: 'amber' },
    'da-chot': { text: 'Đã chốt', tone: 'green' }
  };
  const SERVICES = ['Newborn', 'Bé lớn', 'Sinh nhật', 'Bầu', 'Gia đình'];
  const SOURCES = ['Trợ lý web', 'Chat trực tiếp', 'Form đặt lịch', 'Hotline', 'Khách giới thiệu'];
  const SVC_TONE = { 'Newborn': 'teal', 'Gia đình': 'blue', 'Bầu': 'peach', 'Sinh nhật': 'amber', 'Bé lớn': 'purple', 'Tại nhà': 'beige' };
  const CHANNELS = ['Chat web', 'Messenger', 'Zalo', 'SMS', 'Email'];
  const WEEKDAY = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const WEEKDAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const HOUR_PX = 48;
  const DAY_START = 8;
  const DAY_END = 19;

  const ICON = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z"/>',
    filter: '<path d="M3 4h18l-7 8.5V19l-4 2v-8.5z"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v.01M14 21h3M21 18v3"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2.2.6 3.5 2.8 3.5 6"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
    send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v9H5v-9M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
    note: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    back: '<path d="M15 18l-6-6 6-6"/>',
    next: '<path d="M9 18l6-6-6-6"/>',
    bot: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 8V4M8 14h.01M16 14h.01"/>',
    userPlus: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M19 8v6M16 11h6"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
    swap: '<path d="M7 4 3 8l4 4M3 8h14M17 12l4 4-4 4M21 16H7"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'
  };
  const icon = (name) => '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICON[name] || '') + '</svg>';

  // ---------- Tiện ích ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dateKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseKey(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); }
  function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function fmtDM(k) { const d = parseKey(k); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1); }
  function fmtDMY(k) { return fmtDM(k) + '/' + parseKey(k).getFullYear(); }
  function weekdayOf(k) { return WEEKDAY[parseKey(k).getDay()]; }
  function hm(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function toMin(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
  function money(n) { return Number(n).toLocaleString('vi-VN') + 'đ'; }
  function million(n) { return (n / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' triệu'; }
  function maskPhone(p) { const d = String(p).replace(/\D/g, ''); return d.slice(0, 4) + ' *** ' + d.slice(-3); }
  function fullPhone(p) { const d = String(p).replace(/\D/g, ''); return d.slice(0, 4) + ' ' + d.slice(4, 7) + ' ' + d.slice(7); }
  function fold(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase(); }
  function initials(name) {
    const parts = String(name).replace(/^(Chị|Anh|Bé|C\.|A\.)\s+/i, '').trim().split(/\s+/);
    const pick = parts.length > 1 ? parts[parts.length - 2][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2);
    return pick.toUpperCase();
  }
  function saleName(id) { const s = db.sales.find(x => x.id === id); return s ? s.name : '—'; }
  function svcTag(s) { return '<span class="sw-tag tone-' + (SVC_TONE[s] || 'beige') + '">' + esc(s) + '</span>'; }
  function badge(text, tone) { return '<span class="sw-badge tone-' + (tone || 'muted') + '">' + esc(text) + '</span>'; }

  // ---------- Truy vấn theo quyền ----------
  const mine = (arr) => arr.filter(x => x.owner === me.id);
  const myCustomers = () => mine(db.customers);
  const myLeads = () => myCustomers().filter(c => c.stage);
  const myConversations = () => mine(db.conversations);
  const myDeposits = () => mine(db.deposits);
  const myOrders = () => mine(db.orders);
  const customer = (id) => db.customers.find(c => c.id === id);
  const myCustomer = (id) => { const c = customer(id); return c && c.owner === me.id ? c : null; };
  const stageLabel = (id) => (STAGES.find(s => s.id === id) || { label: 'Khách cũ' }).label;
  const convOf = (customerId) => myConversations().find(v => v.customerId === customerId);
  const appointmentOf = (dep) => db.appointments.find(a => a.id === dep.appointmentId);

  // ---------- Trạng thái giao diện ----------
  const ui = {
    taskFilter: 'all',
    inbox: { filter: 'chua-tra-loi', active: null, mobileChat: false },
    lead: { source: '', service: '' },
    cal: { weekStart: mondayOf(parseKey(TODAY)), mode: 'tuan', day: TODAY },
    qb: { phone: '', name: '', service: 'Newborn', date: '2026-09-27', time: '16:00', room: '', pkg: '', channels: ['Chat web', 'SMS'] },
    dep: { filter: 'all', selected: null, fresh: {} },
    ord: { filter: 'all' },
    cus: { mode: 'bang', group: 'all', bday: false, selected: null },
    tr: { tab: 'tao', filter: 'all', selected: {}, to: null, reason: 'Nghỉ phép', mode: 'tam-thoi', until: endOfMonth(TODAY), revenue: 'giu', note: '', noteTouched: false },
    done: {} // task key -> true
  };

  function endOfMonth(k) { const d = parseKey(k); return dateKey(new Date(d.getFullYear(), d.getMonth() + 1, 0)); }

  function mondayOf(d) { const x = new Date(d); const wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); return dateKey(x); }

  // ---------- Việc cần làm (suy ra từ dữ liệu, không nhập tay) ----------
  function buildTasks() {
    const tasks = [];
    myCustomers().forEach(c => {
      if (!c.task || ui.done['cus:' + c.id]) return;
      const t = c.task;
      tasks.push({
        key: 'cus:' + c.id, kind: t.type, prio: t.prio || 5, badge: t.badge, tone: t.tone,
        title: t.title || (c.name + ' · ' + maskPhone(c.phone)), mTitle: c.name, desc: t.desc, customerId: c.id,
        actions: t.action === 'uu-dai'
          ? [{ act: 'offer', label: 'Gửi ưu đãi', icon: 'gift' }]
          : [{ act: 'call', label: 'Gọi', icon: 'phone', style: 'teal' }, { act: 'msg', label: 'Nhắn', icon: 'chat' }]
      });
    });
    myDeposits().forEach(d => {
      const c = customer(d.customerId); const ap = appointmentOf(d);
      if (!c || ui.done['dep:' + d.code]) return;
      const when = ap ? fmtDM(ap.date) + ' ' + ap.start : '';
      if (d.state === 'sent' || d.state === 'opened') {
        tasks.push({
          key: 'dep:' + d.code, kind: 'coc', prio: 3, badge: 'Giữ lịch hết hạn ' + d.holdUntil, tone: 'amber',
          title: c.name + ' · ' + (c.tags[0] || c.service), mTitle: c.name,
          desc: 'Đang giữ ' + when + ' · ' + (d.state === 'opened' ? 'khách đã mở link' : 'chưa đặt cọc'),
          mDesc: c.service + ' · ' + when + ' · chưa cọc', customerId: c.id, code: d.code,
          actions: [{ act: 'resend-deposit', label: 'Gửi link cọc', icon: 'qr', style: 'accent' }, { act: 'call', label: 'Gọi', icon: 'phone' }]
        });
      } else if (d.state === 'paid') {
        tasks.push({
          key: 'dep:' + d.code, kind: 'coc', prio: 4, badge: 'Xác nhận cọc', tone: 'blue',
          title: c.name + ' · ' + money(d.received), mTitle: c.name,
          desc: 'Chuyển khoản lúc ' + d.paidAt + ' · nội dung khớp mã ' + d.code,
          mDesc: money(d.received) + ' · ' + d.paidAt, customerId: c.id, code: d.code,
          actions: [{ act: 'confirm-deposit', label: 'Xác nhận', icon: 'check', style: 'teal' }, { act: 'view-deposit', label: 'Xem' }]
        });
      } else if (d.state === 'short') {
        tasks.push({
          key: 'dep:' + d.code, kind: 'coc', prio: 5, badge: 'Cọc thiếu', tone: 'red',
          title: c.name + ' · ' + d.code, mTitle: c.name,
          desc: 'Nhận ' + money(d.received) + ' · thiếu so với số tiền cọc', mDesc: 'Nhận ' + money(d.received) + ' · thiếu tiền',
          customerId: c.id, code: d.code, actions: [{ act: 'view-deposit', label: 'Kiểm tra' }]
        });
      }
    });
    myOrders().forEach(o => {
      if (o.status !== 'cho-chon' || (o.idleDays || 0) < 3 || ui.done['ord:' + o.code]) return;
      tasks.push({
        key: 'ord:' + o.code, kind: 'cham-soc', prio: 7, badge: 'Chưa chọn ảnh ' + o.idleDays + ' ngày', tone: 'amber',
        title: o.customer + ' · Đơn #' + o.code, desc: 'Gói ' + o.pkg + ' · đã chọn ' + o.picked + '/' + o.total + ' ảnh',
        code: o.code, customerId: o.customerId, actions: [{ act: 'remind-pick', label: 'Nhắc chọn ảnh', icon: 'send' }]
      });
    });
    db.transfers.filter(r => r.to === me.id && r.status === 'cho-nhan').forEach(r => {
      tasks.push({
        key: 'tr:' + r.id, kind: 'cham-soc', prio: 3, badge: 'Chờ bạn nhận khách', tone: 'amber',
        title: r.names.join(', ') + ' · chuyển từ ' + saleName(r.from), desc: r.reason + ' · quản lý đã duyệt ' + (r.approvedAt || ''),
        actions: [{ act: 'goto-transfer', label: 'Xem bàn giao', icon: 'swap' }]
      });
    });
    const tomorrow = db.appointments.filter(a => a.owner === me.id && a.date === TOMORROW);
    if (tomorrow.length && !ui.done['tomorrow']) {
      tasks.push({
        key: 'tomorrow', kind: 'cham-soc', prio: 8, badge: 'Nhắc lịch ngày mai', tone: 'teal',
        title: tomorrow.length + ' khách chụp ngày ' + fmtDM(TOMORROW), desc: 'Gửi tin nhắc giờ, địa chỉ và lưu ý chuẩn bị cho bé',
        actions: [{ act: 'remind-tomorrow', label: 'Gửi cả ' + tomorrow.length, icon: 'send' }]
      });
    }
    return tasks.sort((a, b) => a.prio - b.prio);
  }

  function depositNeedsAction() { return myDeposits().filter(d => d.state === 'paid' || d.state === 'short').length; }
  function ordersNeedAction() { return myOrders().filter(o => o.status === 'qua-han' || (o.status === 'cho-chon' && (o.idleDays || 0) >= 3 && !ui.done['ord:' + o.code])).length; }
  function unreadCount() { return myConversations().filter(v => v.unread && !v.done).length; }
  function openLeadCount() { return myLeads().filter(c => c.stage !== 'da-chot').length; }

  // ---------- Khung chung: sidebar, mục tiêu, badge ----------
  const NAV = [
    { route: 'tong-quan', label: 'Tổng quan', icon: 'home' },
    { route: 'hop-thu', label: 'Hộp thư', icon: 'chat', count: unreadCount },
    { route: 'khach-hang', label: 'Khách hàng', icon: 'users', count: openLeadCount },
    { route: 'lich-chup', label: 'Lịch chụp', icon: 'calendar' },
    { route: 'dat-coc', label: 'Đặt cọc', icon: 'qr', count: depositNeedsAction },
    { route: 'don-anh', label: 'Đơn & ảnh', icon: 'image', count: ordersNeedAction },
    { route: 'chuyen-giao', label: 'Chuyển giao', icon: 'swap', count: () => trWaitingMe() },
    { route: 'bao-cao', label: 'Báo cáo của tôi', icon: 'chart' }
  ];

  function renderChrome(route) {
    document.getElementById('swNav').innerHTML = NAV.map(n => {
      const c = n.count ? n.count() : 0;
      return '<a href="#' + n.route + '" class="' + (n.route === route ? 'active' : '') + '">' + icon(n.icon) +
        '<span>' + n.label + '</span>' + (c ? '<em>' + c + '</em>' : '') + '</a>';
    }).join('');
    const pct = Math.min(100, Math.round(me.achieved / me.target * 100));
    document.getElementById('swGoal').innerHTML =
      '<small>Mục tiêu tháng ' + (parseKey(TODAY).getMonth() + 1) + '</small>' +
      '<strong>' + me.achieved + ' / ' + me.target + ' triệu</strong>' +
      '<span class="sw-goal-bar"><i style="width:' + pct + '%"></i></span>' +
      '<small>Còn 5 ngày · cần thêm ' + Math.max(0, me.target - me.achieved) + ' triệu</small>';
    document.getElementById('swMeName').textContent = me.name;
    document.getElementById('swMeAvatar').textContent = initials(me.name);
    document.querySelectorAll('#swBottom a').forEach(a => a.classList.toggle('active', a.dataset.route === route));
    document.getElementById('swBellDot').hidden = buildTasks().length === 0;
  }

  function setHead(title, sub) {
    document.getElementById('swTitle').textContent = title;
    document.getElementById('swSub').textContent = sub || '';
  }

  // ---------- Trang: Tổng quan ----------
  function viewOverview() {
    const tasks = buildTasks();
    const d = parseKey(TODAY);
    setHead('Chào ' + me.name + ', hôm nay có ' + tasks.length + ' việc cần xử lý',
      WEEKDAY[d.getDay()] + ', ' + fmtDMY(TODAY) + ' · Ca 08:00–17:00 · Việc được xếp theo mức gấp');

    const leads = myLeads();
    const newLeads = leads.filter(c => c.stage === 'moi');
    const callTasks = tasks.filter(t => t.kind === 'goi-lai');
    const today = db.appointments.filter(a => a.date === TODAY).sort((a, b) => toMin(a.start) - toMin(b.start));
    const paid = myDeposits().filter(x => x.state === 'paid');
    const closed = leads.filter(c => c.stage === 'da-chot');
    const rate = leads.length ? Math.round(closed.length / leads.length * 100) : 0;

    const kpis = [
      { label: 'Lead mới hôm nay', num: newLeads.length, sub: newLeads.filter(c => c.status.tone === 'red').length + ' chưa liên hệ', tone: 'red' },
      { label: 'Cần gọi lại', num: callTasks.length, sub: callTasks.filter(t => t.tone === 'red').length + ' quá hạn', tone: 'red' },
      { label: 'Lịch chụp hôm nay', num: today.length, sub: today.filter(a => a.status === 'checkin').length + ' khách đã check-in', tone: 'teal' },
      { label: 'Cọc chờ xác nhận', num: paid.length, sub: million(paid.reduce((s, x) => s + (x.received || 0), 0)), tone: 'amber' },
      { label: 'Chốt đơn tuần này', num: closed.length, sub: 'Tỉ lệ chốt ' + rate + '%', tone: 'teal' }
    ];

    const counts = { all: tasks.length, 'goi-lai': callTasks.length, coc: tasks.filter(t => t.kind === 'coc').length, 'cham-soc': tasks.filter(t => t.kind === 'cham-soc').length };
    const shown = ui.taskFilter === 'all' ? tasks : tasks.filter(t => t.kind === ui.taskFilter);
    const chips = [['all', 'Tất cả'], ['goi-lai', 'Gọi lại'], ['coc', 'Cọc'], ['cham-soc', 'Chăm sóc']].map(([k, l]) =>
      '<button type="button" class="sw-chip' + (ui.taskFilter === k ? ' on' : '') + '" data-act="task-filter" data-id="' + k + '">' + l + ' ' + counts[k] + '</button>').join('');

    const srcCounts = SOURCES.map(s => [s, myCustomers().filter(c => c.source === s).length]);
    const srcMax = Math.max(1, ...srcCounts.map(x => x[1]));

    const mobileTasks = tasks.filter(t => t.customerId && myCustomer(t.customerId));

    return '' +
      // Bản mobile (trang 6 thiết kế): tiêu đề lớn, 3 chỉ số, danh sách "Làm ngay"
      '<section class="m-today">' +
        '<div class="m-today-head"><div><small>' + WEEKDAY[d.getDay()] + ', ' + fmtDM(TODAY) + '</small><h2>' + tasks.length + ' việc cần xử lý</h2></div>' +
        '<button class="sw-icon-btn sw-card-btn" type="button" data-act="focus-search" aria-label="Tìm kiếm"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg></button></div>' +
        '<div class="m-kpis">' +
          '<div class="sw-card"><strong>' + newLeads.length + '</strong><small>Lead mới</small></div>' +
          '<div class="sw-card"><strong class="c-red">' + callTasks.filter(t => t.tone === 'red').length + '</strong><small>Quá hạn gọi</small></div>' +
          '<div class="sw-card"><strong>' + today.length + '</strong><small>Lịch hôm nay</small></div>' +
        '</div>' +
        '<h3 class="m-label">Làm ngay</h3>' +
        (mobileTasks.length ? mobileTasks.map(t => '<article class="sw-card m-task">' +
          '<div class="m-task-top"><strong>' + esc(t.mTitle || t.title) + '</strong>' + badge(t.badge, t.tone) + '</div>' +
          '<p>' + esc(t.mDesc || t.desc) + '</p>' +
          '<div class="m-task-actions">' +
            '<button type="button" class="sw-btn sw-btn-teal" data-act="call" data-id="' + t.customerId + '">' + icon('phone') + 'Gọi</button>' +
            '<button type="button" class="sw-btn" data-act="msg" data-id="' + t.customerId + '">' + icon('chat') + 'Nhắn</button>' +
            '<button type="button" class="sw-btn" data-act="note" data-id="' + t.customerId + '">' + icon('note') + 'Ghi chú</button>' +
          '</div></article>').join('') : emptyState('Không còn việc gấp nào. Tuyệt vời!')) +
      '</section>' +

      '<section class="d-today">' +
        '<div class="sw-kpis">' + kpis.map(k => '<div class="sw-card sw-kpi"><small>' + k.label + '</small><strong>' + k.num + '</strong><span class="c-' + k.tone + '">' + esc(k.sub) + '</span></div>').join('') + '</div>' +
        '<div class="sw-grid-2">' +
          '<div class="sw-card sw-pad">' +
            '<div class="sw-card-head"><h2>Việc cần làm ngay</h2><div class="sw-chips">' + chips + '</div></div>' +
            (shown.length ? '<div class="sw-tasks">' + shown.map(taskRow).join('') + '</div>' : emptyState('Không có việc nào trong nhóm này.')) +
          '</div>' +
          '<div class="sw-stack">' +
            '<div class="sw-card sw-pad">' +
              '<div class="sw-card-head"><h2>Lịch chụp hôm nay</h2><a class="sw-link" href="#lich-chup">Xem lịch tuần</a></div>' +
              (today.length ? '<ul class="sw-today-list">' + today.map(a => {
                const st = apStatus(a);
                return '<li><time>' + a.start + '</time><div><strong>' + esc(a.service + ' · ' + a.label) + '</strong><small>' +
                  esc((a.room === 'Ngoài' ? (a.place || 'Tại nhà') : roomLabel(a.room)) + ' · Thợ ' + a.photographer) +
                  (a.owner === me.id ? ' · <b>Của tôi</b>' : '') + '</small></div>' + badge(st.text, st.tone) + '</li>';
              }).join('') + '</ul>' : emptyState('Hôm nay studio không có lịch chụp.')) +
            '</div>' +
            '<div class="sw-card sw-pad">' +
              '<div class="sw-card-head"><h2>Nguồn khách tuần này</h2><span class="sw-muted">' + myCustomers().length + ' lead</span></div>' +
              '<div class="sw-bars">' + srcCounts.map(([s, n]) => '<div class="sw-bar-row"><span>' + s + '</span><i><b style="width:' + Math.round(n / srcMax * 100) + '%"></b></i><strong>' + n + '</strong></div>').join('') + '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</section>';
  }

  function taskRow(t) {
    return '<div class="sw-task">' +
      '<div class="sw-task-badge">' + badge(t.badge, t.tone) + '</div>' +
      '<div class="sw-task-body"><strong>' + esc(t.title) + '</strong><small>' + esc(t.desc) + '</small></div>' +
      '<div class="sw-task-actions">' + t.actions.map(a =>
        '<button type="button" class="sw-btn' + (a.style ? ' sw-btn-' + a.style : '') + '" data-act="' + a.act + '" data-id="' + esc(t.customerId || '') + '" data-code="' + esc(t.code || '') + '" data-key="' + esc(t.key) + '">' +
        (a.icon ? icon(a.icon) : '') + a.label + '</button>').join('') + '</div>' +
      '</div>';
  }

  function emptyState(text) { return '<p class="sw-empty">' + esc(text) + '</p>'; }
  function roomLabel(id) { const r = db.rooms.find(x => x.id === id); return r ? r.label : id; }
  function apStatus(a) {
    return {
      'checkin': { text: 'Đã check-in', tone: 'teal' },
      'da-coc': { text: 'Đã cọc', tone: 'blue' },
      'chua-thu-du': { text: 'Chưa thu đủ', tone: 'amber' },
      'giu-cho': { text: 'Giữ chỗ, chưa cọc', tone: 'red' }
    }[a.status] || { text: a.status, tone: 'muted' };
  }

  // ---------- Trang: Hộp thư ----------
  function viewInbox(param) {
    const convs = myConversations();
    const filters = {
      'chua-tra-loi': v => v.unread && !v.done,
      'cua-toi': v => !v.bot && !v.done,
      'bot': v => v.bot && !v.done,
      'da-xong': v => v.done
    };
    if (param && convs.some(v => v.id === param)) { ui.inbox.active = param; ui.inbox.mobileChat = true; }
    const list = convs.filter(filters[ui.inbox.filter]);
    if (!ui.inbox.active || !convs.some(v => v.id === ui.inbox.active)) ui.inbox.active = (list[0] || convs[0] || {}).id || null;
    const active = convs.find(v => v.id === ui.inbox.active);
    const chip = (k, l) => {
      const n = convs.filter(filters[k]).length;
      return '<button type="button" class="sw-chip' + (ui.inbox.filter === k ? ' on' : '') + '" data-act="inbox-filter" data-id="' + k + '">' + l + (k === 'chua-tra-loi' ? ' ' + n : '') + '</button>';
    };

    const listHtml = list.length ? list.map(v => {
      const c = customer(v.customerId);
      const last = v.messages[v.messages.length - 1] || { text: '' };
      return '<button type="button" class="ib-item' + (v.id === ui.inbox.active ? ' on' : '') + (v.unread ? ' unread' : '') + '" data-act="open-conv" data-id="' + v.id + '">' +
        '<span class="sw-avatar">' + initials(c.name) + '</span>' +
        '<span class="ib-item-body"><span class="ib-item-top"><strong>' + esc(c.name) + '</strong><small>' + esc(v.time) + '</small></span>' +
        '<span class="ib-preview">' + esc(last.text) + '</span>' +
        '<span class="sw-tag ' + (v.bot ? 'tone-peach' : 'tone-blue') + '">' + esc(v.channel) + '</span></span></button>';
    }).join('') : emptyState('Không có hội thoại nào.');

    return '<div class="ib' + (ui.inbox.mobileChat ? ' show-chat' : '') + '">' +
      '<section class="ib-list">' +
        '<div class="ib-list-head"><h1>Hộp thư</h1><p>Tin nhắn khách gửi trên website ALOHA Baby</p>' +
        '<div class="sw-chips">' + chip('chua-tra-loi', 'Chưa trả lời') + chip('cua-toi', 'Của tôi') + chip('bot', 'Bot đã chuyển') + chip('da-xong', 'Đã xong') + '</div></div>' +
        '<div class="ib-items">' + listHtml + '</div>' +
      '</section>' +
      (active ? chatPane(active) + '<aside class="ib-info">' + customerPanel(customer(active.customerId)) + '</aside>'
        : '<section class="ib-chat">' + emptyState('Chọn một hội thoại để bắt đầu.') + '</section>') +
      '</div>';
  }

  function chatPane(v) {
    const c = customer(v.customerId);
    const quick = ['Bảng giá ' + c.service, 'Concept đang được chọn nhiều', 'Khung giờ còn trống', 'Hướng dẫn đặt cọc', 'Lưu ý chuẩn bị cho bé'];
    return '<section class="ib-chat">' +
      '<header class="ib-chat-head">' +
        '<button type="button" class="sw-icon-btn ib-back" data-act="inbox-back" aria-label="Quay lại danh sách">' + icon('back') + '</button>' +
        '<div><strong>' + esc(c.name) + '</strong><small>Qua ' + esc(v.channel) + (v.online ? ' · đang online' : '') + '</small></div>' +
        '<div class="ib-chat-actions">' +
          '<button type="button" class="sw-btn sw-btn-teal" data-act="call" data-id="' + c.id + '">' + icon('phone') + 'Gọi</button>' +
          '<button type="button" class="sw-btn ib-profile-btn" data-act="profile" data-id="' + c.id + '">' + icon('user') + 'Hồ sơ</button>' +
          '<button type="button" class="sw-btn" data-act="transfer" data-id="' + c.id + '">Chuyển người khác</button>' +
        '</div>' +
      '</header>' +
      '<div class="ib-msgs" id="ibMsgs">' +
        (v.bot && v.botSummary ? '<div class="ib-bot">' + icon('bot') + '<div><strong>Trợ lý ALOHA đã hỏi sẵn và chuyển cho bạn</strong><span>' + esc(v.botSummary) + '</span></div></div>' : '') +
        v.messages.map(m => '<div class="ib-msg ' + (m.from === 'sale' ? 'out' : 'in') + '"><p>' + esc(m.text) + '</p><small>' + esc(m.time) + (m.from === 'sale' ? ' · ' + esc(m.by || me.name) : '') + '</small></div>').join('') +
      '</div>' +
      '<div class="ib-compose">' +
        '<div class="ib-quick">' + quick.map(q => '<button type="button" class="sw-chip sw-chip-outline" data-act="quick-reply" data-id="' + esc(q) + '">' + esc(q) + '</button>').join('') + '</div>' +
        '<form class="ib-form" data-form="send-msg" data-id="' + v.id + '">' +
          '<input id="ibInput" type="text" placeholder="Nhập tin nhắn, gõ / để chèn mẫu trả lời" autocomplete="off">' +
          '<button type="submit" class="sw-btn sw-btn-accent">' + icon('send') + 'Gửi</button>' +
        '</form>' +
      '</div>' +
    '</section>';
  }

  function quickReplyText(label, c) {
    const who = c.title + ' ' + c.short;
    if (label.startsWith('Bảng giá')) return 'Dạ em gửi ' + who + ' bảng giá gói ' + c.service + ': [Bảng giá gói ' + c.service + ' theo cấu hình studio]. ' + capital(c.title) + ' cần em tư vấn thêm gói nào không ạ?';
    if (label.startsWith('Concept')) return 'Dạ các concept ' + c.service + ' đang được nhiều bố mẹ chọn gần đây là tông kem trắng nhẹ nhàng, vintage và Hàn Quốc ạ. Em gửi ' + who + ' ảnh mẫu tham khảo nhé.';
    if (label.startsWith('Khung giờ')) return 'Dạ hiện studio còn trống các khung ' + freeSlotsText() + '. ' + capital(c.title) + ' chọn khung nào em giữ lịch luôn cho mình ạ.';
    if (label.startsWith('Hướng dẫn')) return 'Dạ sau khi em giữ lịch, ' + c.title + ' sẽ nhận link đặt cọc. ' + capital(c.title) + ' chỉ cần quét mã QR và giữ nguyên nội dung chuyển khoản là lịch được xác nhận tự động trong vài giây ạ.';
    return 'Dạ ' + who + ' lưu ý cho bé ăn no trước buổi chụp, mang thêm 1 bộ đồ dự phòng và khăn quấn quen thuộc để bé dễ ngủ ngoan ạ.';
  }
  function capital(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function freeSlotsText() {
    const out = [];
    for (let i = 1; i <= 7 && out.length < 3; i++) {
      const k = dateKey(addDays(parseKey(TODAY), i));
      ['09:00', '14:00', '16:00'].some(t => {
        if (!roomBusy('P1', k, t, 1.5)) { out.push(t + ' ' + fmtDM(k)); return true; }
        return false;
      });
    }
    return out.join(', ');
  }

  function babyBlock(c) {
    if (!c.baby) return '<div class="sw-soft"><small class="sw-label">Thông tin bé</small><p class="sw-muted">Chưa có thông tin bé</p></div>';
    const b = c.baby;
    let extra = '';
    if (b.kind === 'due' && c.service === 'Newborn') {
      const from = dateKey(addDays(parseKey(b.date), 7)); const to = dateKey(addDays(parseKey(b.date), 14));
      extra = '<small class="sw-muted">Gợi ý chụp: ' + fmtDM(from) + ' – ' + fmtDM(to) + ' (7–14 ngày tuổi)</small>';
    } else if (b.kind === 'birth') {
      extra = '<small class="sw-muted">' + esc(b.name ? b.name + ' · ' : '') + ageText(b.date) + '</small>';
    }
    return '<div class="sw-soft"><small class="sw-label">Thông tin bé</small>' +
      '<p>' + (b.kind === 'due' ? 'Dự sinh' : 'Ngày sinh') + ' <strong>' + fmtDMY(b.date) + '</strong></p>' + extra + '</div>';
  }
  function ageText(k) {
    const days = Math.round((parseKey(TODAY) - parseKey(k)) / 864e5);
    if (days < 0) return 'chưa sinh';
    if (days < 60) return days + ' ngày tuổi';
    return Math.floor(days / 30.4) + ' tháng tuổi';
  }

  function customerPanel(c) {
    const idx = STAGES.findIndex(s => s.id === c.stage);
    return '<div class="ci">' +
      '<h2>' + esc(c.name) + '</h2>' +
      '<p class="sw-muted">' + maskPhone(c.phone) + ' · ' + esc(c.area) + '</p>' +
      '<div class="ci-tags">' + c.tags.map(t => '<span class="sw-tag tone-peach">' + esc(t) + '</span>').join('') + svcTag(c.service) + '</div>' +
      babyBlock(c) +
      '<button type="button" class="sw-btn sw-btn-accent sw-btn-block" data-act="book-for" data-id="' + c.id + '">' + icon('calendar') + 'Tạo lịch và gửi link cọc</button>' +
      '<button type="button" class="sw-btn sw-btn-block" data-act="send-quote" data-id="' + c.id + '">' + icon('send') + 'Gửi báo giá gói ' + esc(c.service) + '</button>' +
      '<button type="button" class="sw-btn sw-btn-block" data-act="callback" data-id="' + c.id + '">' + icon('clock') + 'Hẹn gọi lại</button>' +
      '<small class="sw-label">Giai đoạn</small>' +
      '<div class="ci-stage">' + STAGES.map((s, i) => '<i class="' + (i <= idx ? 'on' : '') + '"></i>').join('') + '</div>' +
      '<p class="ci-stage-text">' + (idx >= 0 ? stageLabel(c.stage) + ' · bước ' + (idx + 1) + '/5' : 'Khách cũ · đã hoàn thành phễu') + '</p>' +
      '<small class="sw-label">Ghi chú nội bộ</small>' +
      '<textarea class="ci-note" data-note="' + c.id + '" rows="3" placeholder="Ghi chú chỉ nhân sự studio thấy">' + esc(c.note) + '</textarea>' +
      '<p class="sw-muted ci-owner">Phụ trách: <strong>' + esc(saleName(c.owner)) + '</strong></p>' +
    '</div>';
  }

  // ---------- Trang: Khách hàng (gộp Bảng giai đoạn + Danh sách) ----------
  // Một trang cho mọi khách của sale: "Bảng giai đoạn" là kanban các khách đang
  // trong phễu mở, "Danh sách" gồm cả khách đã chụp, khách quen, khách không mua.
  // Nhóm ở Danh sách tự suy ra từ dữ liệu (cọc xong -> Đã chốt, sau buổi chụp ->
  // Đã chụp, từ đơn thứ hai -> Khách quen), không nhập tay.
  const CUS_GROUPS = [
    { id: 'tiem-nang', label: 'Tiềm năng', tone: 'amber' },
    { id: 'cho-coc', label: 'Chờ cọc', tone: 'red' },
    { id: 'da-chot', label: 'Đã chốt', tone: 'blue' },
    { id: 'da-chup', label: 'Đã chụp', tone: 'teal' },
    { id: 'khach-quen', label: 'Khách quen', tone: 'peach' },
    { id: 'khong-mua', label: 'Không mua', tone: 'muted' }
  ];
  function shootCount(c) {
    if (c.history) return c.history.filter(h => h.shoot).length;
    if (!c.stage) return c.lost ? 0 : 1; // khách cũ chưa có lịch sử chi tiết: đã chụp ít nhất 1 lần
    if (c.stage !== 'da-chot') return 0;
    const shot = c.status.text === 'Đã chụp' || db.orders.some(o => o.customerId === c.id) ||
      db.appointments.some(a => a.customerId === c.id && a.date < TODAY);
    return shot ? 1 : 0;
  }
  function cusGroup(c) {
    if (c.lost) return 'khong-mua';
    if (['moi', 'tu-van', 'bao-gia'].includes(c.stage)) return 'tiem-nang';
    if (c.stage === 'cho-coc') return 'cho-coc';
    const n = shootCount(c);
    return n >= 2 ? 'khach-quen' : n === 1 ? 'da-chup' : 'da-chot';
  }
  const groupOf = (c) => CUS_GROUPS.find(g => g.id === cusGroup(c));
  // Mốc chụp tiếp theo của bé (100 ngày, sinh nhật) trong 30 ngày tới.
  function nextMilestone(b) {
    if (!b || b.kind !== 'birth') return null;
    const born = parseKey(b.date); const today = parseKey(TODAY);
    const cands = [{ label: 'tròn 100 ngày', d: addDays(born, 100) }];
    for (let y = 1; y <= 12; y++) cands.push({ label: 'tròn ' + y + ' tuổi', d: new Date(born.getFullYear() + y, born.getMonth(), born.getDate()) });
    const hit = cands.find(x => x.d >= today && (x.d - today) / 864e5 <= 30);
    return hit ? { label: hit.label, key: dateKey(hit.d), birthday: /tuổi/.test(hit.label) } : null;
  }
  function babyText(c) {
    const b = c.baby;
    if (!b) return 'Chưa có';
    if (b.kind === 'due') return 'Dự sinh ' + fmtDM(b.date);
    const m = nextMilestone(b);
    if (m) return (b.name || 'Bé') + ' ' + m.label + ' ' + fmtDM(m.key);
    return (b.name ? b.name + ', ' : 'Bé ') + ageText(b.date);
  }
  function nextStep(c) {
    if (c.lost) return { text: 'Gửi lại khi có khuyến mại', tone: 'muted' };
    const dep = db.deposits.find(d => d.customerId === c.id && d.state !== 'confirmed');
    if (dep && (dep.state === 'sent' || dep.state === 'opened')) return { text: 'Nhắc cọc trước ' + dep.holdUntil, tone: 'red' };
    if (dep && dep.state === 'paid') return { text: 'Xác nhận cọc ' + money(dep.received), tone: 'blue' };
    if (dep && dep.state === 'short') return { text: 'Kiểm tra cọc thiếu', tone: 'red' };
    const ap = nextAppointment(c);
    if (ap && ap.status !== 'giu-cho') return { text: 'Chụp ' + ap.service + ' ' + fmtDM(ap.date) + ' ' + ap.start, tone: '' };
    const o = db.orders.find(x => x.customerId === c.id && x.status === 'cho-chon');
    if (o) return { text: 'Nhắc chọn ảnh (' + o.picked + '/' + o.total + ')', tone: 'amber' };
    const m = !c.stage && nextMilestone(c.baby);
    if (m) return { text: m.birthday ? 'Ưu đãi sinh nhật ' + m.label.replace('tròn ', '') : 'Ưu đãi chụp 100 ngày', tone: 'red' };
    if (c.stage === 'moi' && c.status.tone === 'red') return { text: 'Liên hệ lần đầu', tone: 'red' };
    return { text: c.status.text, tone: c.status.tone === 'muted' ? '' : c.status.tone };
  }
  function cusHistory(c) {
    if (c.history) return c.history;
    const out = [];
    db.appointments.filter(a => a.customerId === c.id && a.date >= TODAY).forEach(a =>
      out.push({ date: fmtDM(a.date), text: 'Lịch chụp ' + a.service + ' ' + a.start + ' · ' + apStatus(a).text, shoot: false }));
    db.orders.filter(o => o.customerId === c.id).forEach(o =>
      out.push({ date: o.date, text: 'Chụp ' + o.service + ' · đơn #' + o.code + ' · ' + ORD_STATUS[o.status].text.toLowerCase(), shoot: true }));
    out.push({ date: 'Lần đầu', text: 'Liên hệ qua ' + c.source + (c.lost ? ' · không mua (' + c.lost.reason.toLowerCase() + ')' : ''), shoot: false });
    return out;
  }

  function cusDetail(c) {
    const g = groupOf(c);
    const b = c.baby;
    const m = b && nextMilestone(b);
    const offerDone = ui.done['cus:' + c.id];
    return '<div class="cu-detail">' +
      '<div class="cu-id"><span class="sw-avatar cu-avatar">' + initials(c.name) + '</span><div><h2>' + esc(c.name) + '</h2><p class="sw-muted">' + maskPhone(c.phone) + ' · ' + esc(c.area) + '</p></div></div>' +
      '<div class="ci-tags">' + badge(g.label, g.tone) + '<span class="sw-tag tone-beige">Phụ trách: ' + esc(saleName(c.owner)) + '</span></div>' +
      '<div class="cu-actions">' +
        '<button type="button" class="sw-btn sw-btn-teal" data-act="call" data-id="' + c.id + '">' + icon('phone') + 'Gọi</button>' +
        '<button type="button" class="sw-btn" data-act="msg" data-id="' + c.id + '">' + icon('chat') + 'Nhắn</button>' +
        '<button type="button" class="sw-btn sw-btn-accent" data-act="book-for" data-id="' + c.id + '">' + icon('calendar') + 'Tạo lịch</button>' +
      '</div>' +
      '<div class="sw-soft"><small class="sw-label">Các bé</small>' +
        (b ? '<div class="cu-baby"><strong>' + esc(b.name || 'Bé') + '</strong><span class="sw-muted">' +
            (b.kind === 'due' ? 'dự sinh ' + fmtDMY(b.date) : 'sinh ' + fmtDMY(b.date) + ' · ' + ageText(b.date)) + '</span></div>' +
          (m && !offerDone ? '<div class="cu-offer">' + icon('gift') + '<span>Bé sắp ' + m.label + ' (' + fmtDM(m.key) + '). Gợi ý gói ' + (m.birthday ? 'Sinh nhật' : 'chụp 100 ngày') + '.</span>' +
            '<button type="button" class="sw-btn" data-act="offer" data-key="cus:' + c.id + '">Gửi ưu đãi</button></div>' : '')
          : '<p class="sw-muted">Chưa có thông tin bé</p>') +
      '</div>' +
      '<div class="cu-stats"><div><strong>' + shootCount(c) + '</strong><small>Đơn đã chụp</small></div>' +
        '<div><strong>[Tổng]</strong><small>Tổng đã chi</small></div>' +
        '<div><strong>' + (c.referrals || 0) + '</strong><small>Khách giới thiệu</small></div></div>' +
      '<small class="sw-label">Lịch sử với studio</small>' +
      '<ol class="dp-log cu-hist">' + cusHistory(c).map(h => '<li class="' + (h.shoot ? '' : 'sale') + '"><div><time>' + esc(h.date) + '</time></div><p>' + esc(h.text) + '</p></li>').join('') + '</ol>' +
      '<small class="sw-label">Ghi chú</small>' +
      '<textarea class="ci-note" data-note="' + c.id + '" rows="3" placeholder="Ghi chú chỉ nhân sự studio thấy">' + esc(c.note) + '</textarea>' +
    '</div>';
  }

  function viewCustomers() {
    const f = ui.cus; const lf = ui.lead;
    const board = f.mode === 'bang';
    const all = myCustomers();
    const openLeads = myLeads().filter(c => c.stage !== 'da-chot').length;
    setHead('Khách hàng', board
      ? 'Mọi khách của bạn ở một chỗ · Bảng giai đoạn hiện ' + openLeads + ' khách đang tư vấn, kéo thẻ sang cột kế tiếp khi khách tiến thêm một bước'
      : 'Một danh sách cho mọi khách, từ lúc mới hỏi đến khi đã chụp và quay lại · Chỉ hiện khách bạn phụ trách');
    const sel = (name, label, opts, val) => '<label class="sw-pill-select">' + icon('filter') + '<span>' + label + ':</span><select data-lead-filter="' + name + '"><option value="">Tất cả</option>' +
      opts.map(o => '<option' + (o === val ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select></label>';
    const seg = '<div class="cu-seg" role="tablist" aria-label="Kiểu xem">' + [['bang', 'Bảng giai đoạn', 'filter'], ['danh-sach', 'Danh sách', 'users']].map(([k, l, ic]) =>
      '<button type="button" role="tab" aria-selected="' + (f.mode === k) + '" class="' + (f.mode === k ? 'on' : '') + '" data-act="cus-mode" data-id="' + k + '">' + icon(ic) + l + '</button>').join('') + '</div>';
    const leads = myLeads();
    const rate = leads.length ? Math.round(leads.filter(c => c.stage === 'da-chot').length / leads.length * 100) : 0;
    const toolbar = '<div class="kb-toolbar">' + seg +
      sel('source', 'Nguồn', SOURCES, lf.source) + sel('service', 'Dịch vụ', SERVICES.concat(['Tại nhà']), lf.service) +
      (board
        ? '<span class="sw-pill-select">' + icon('filter') + '<span>Tuần này</span></span>' +
          '<p class="kb-stats">Tỉ lệ chốt 30 ngày: <strong>' + rate + '%</strong> · Thời gian phản hồi TB: <strong>' + me.responseMin + ' phút</strong></p>'
        : '<button type="button" class="sw-pill-select' + (f.bday ? ' on' : '') + '" data-act="cus-bday" aria-pressed="' + f.bday + '">' + icon('gift') + '<span>Có bé sắp sinh nhật</span></button>' +
          '<button type="button" class="sw-btn cu-add" data-act="add-lead" data-id="moi">' + icon('userPlus') + 'Thêm khách</button>') +
    '</div>';
    const bySrcSvc = (c) => (!lf.source || c.source === lf.source) && (!lf.service || c.service === lf.service);
    return toolbar + (board ? customerBoard(leads.filter(bySrcSvc)) : customerList(all.filter(bySrcSvc)));
  }

  function customerList(base) {
    const f = ui.cus;
    const pool = f.bday ? base.filter(c => c.baby && nextMilestone(c.baby)) : base;
    const shown = f.group === 'all' ? pool : pool.filter(c => cusGroup(c) === f.group);
    if (!shown.some(c => c.id === f.selected)) f.selected = (shown[0] || {}).id || null;
    const sel = shown.find(c => c.id === f.selected);
    const chip = (id, label) => '<button type="button" class="sw-chip' + (f.group === id ? ' on' : '') + '" data-act="cus-group" data-id="' + id + '">' + label + ' ' +
      (id === 'all' ? pool.length : pool.filter(c => cusGroup(c) === id).length) + '</button>';
    const sub = (c) => {
      const g = cusGroup(c);
      if (g === 'tiem-nang') return stageLabel(c.stage);
      if (g === 'khach-quen') return shootCount(c) + ' đơn';
      if (g === 'khong-mua') return c.lost.reason;
      return '';
    };
    return '<div class="cu-layout">' +
      '<section class="sw-card sw-pad">' +
        '<div class="sw-chips">' + chip('all', 'Tất cả') + CUS_GROUPS.map(g => chip(g.id, g.label)).join('') + '</div>' +
        '<p class="cu-rule">Giai đoạn tự đổi: cọc xong thành Đã chốt, sau buổi chụp thành Đã chụp, từ đơn thứ hai thành Khách quen.</p>' +
        '<div class="sw-table-wrap"><table class="sw-table cu-table">' +
          '<thead><tr><th>Khách</th><th>Giai đoạn</th><th>Bé</th><th>Việc tiếp theo</th></tr></thead><tbody>' +
          (shown.length ? shown.map(c => {
            const g = groupOf(c); const n = nextStep(c); const s = sub(c);
            return '<tr class="cu-row' + (c.id === f.selected ? ' on' : '') + '" data-act="cus-select" data-id="' + c.id + '">' +
              '<td><button type="button" class="sw-linkbtn" data-act="cus-select" data-id="' + c.id + '"><strong>' + esc(c.name) + '</strong></button>' +
                '<small class="sw-muted sw-block">' + maskPhone(c.phone) + ' · ' + esc(c.source) + ' · ' + esc(c.since) + '</small></td>' +
              '<td>' + badge(g.label, g.tone) + (s ? '<small class="sw-muted sw-block">' + esc(s) + '</small>' : '') + '</td>' +
              '<td>' + esc(babyText(c)) + '</td>' +
              '<td><strong class="cu-next' + (n.tone ? ' c-' + n.tone : '') + '">' + esc(n.text) + '</strong></td></tr>';
          }).join('') : '<tr><td colspan="4">' + emptyState('Không có khách nào trong nhóm này.') + '</td></tr>') +
        '</tbody></table></div>' +
      '</section>' +
      '<aside class="sw-card sw-pad cu-aside">' + (sel ? cusDetail(sel) : emptyState('Chọn một khách để xem hồ sơ.')) + '</aside>' +
    '</div>';
  }

  function customerBoard(shown) {
    return '<div class="kb">' + STAGES.map((s, i) => {
        const cards = shown.filter(c => c.stage === s.id);
        return '<section class="kb-col" data-drop="' + s.id + '">' +
          '<header><h3>' + s.label + '</h3><span>' + cards.length + '</span></header>' +
          cards.map(c => leadCard(c, i)).join('') +
          '<button type="button" class="kb-add" data-act="add-lead" data-id="' + s.id + '">+ Thêm</button>' +
        '</section>';
      }).join('') + '</div>';
  }

  function leadCard(c, stageIdx) {
    return '<article class="sw-card kb-card" draggable="true" data-drag="' + c.id + '">' +
      '<div class="kb-card-top"><strong>' + esc(c.name) + '</strong>' + svcTag(c.service) + '</div>' +
      '<small class="sw-muted">' + esc(c.source) + ' · ' + esc(c.since) + '</small>' +
      '<p class="kb-status c-' + c.status.tone + '">' + icon('clock') + esc(c.status.text) + '</p>' +
      '<div class="kb-actions">' +
        '<button type="button" class="sw-btn" data-act="call" data-id="' + c.id + '">' + icon('phone') + 'Gọi</button>' +
        '<button type="button" class="sw-btn" data-act="msg" data-id="' + c.id + '">' + icon('chat') + 'Nhắn</button>' +
        (stageIdx < STAGES.length - 1 ? '<button type="button" class="sw-icon-btn kb-next" data-act="lead-next" data-id="' + c.id + '" title="Chuyển sang: ' + STAGES[stageIdx + 1].label + '" aria-label="Chuyển sang bước kế tiếp">' + icon('arrow') + '</button>' : '') +
      '</div></article>';
  }

  function moveLead(id, stage) {
    const c = myCustomer(id);
    if (!c || c.stage === stage) return;
    c.stage = stage;
    c.status = Object.assign({}, STAGE_DEFAULT_STATUS[stage]);
    c.since = 'Vừa cập nhật';
    toast('Đã chuyển ' + c.name + ' sang "' + stageLabel(stage) + '"');
    render();
  }

  // ---------- Trang: Lịch chụp ----------
  function apKind(a) {
    if (a.status === 'giu-cho') return 'hold';
    if (a.status === 'chua-thu-du') return 'due';
    if (a.room === 'Ngoài') return 'home';
    if (a.service === 'Newborn') return 'newborn';
    return 'paid';
  }

  function viewCalendar() {
    const cal = ui.cal;
    const ws = parseKey(cal.weekStart);
    const we = addDays(ws, 6);
    setHead('Lịch chụp', 'Tuần ' + pad(ws.getDate()) + ' – ' + fmtDMY(dateKey(we)) + ' · 3 phòng chụp · ' + db.photographers.length + ' thợ ảnh · lịch chung cả studio');

    let cols;
    if (cal.mode === 'tuan') {
      cols = Array.from({ length: 7 }, (_, i) => { const k = dateKey(addDays(ws, i)); return { key: k, date: k, head: WEEKDAY_SHORT[parseKey(k).getDay()] + ' ' + parseKey(k).getDate(), today: k === TODAY }; });
    } else if (cal.mode === 'ngay') {
      cols = [{ key: cal.day, date: cal.day, head: weekdayOf(cal.day) + ' ' + fmtDM(cal.day), today: cal.day === TODAY }];
    } else {
      cols = db.rooms.map(r => ({ key: r.id, date: cal.day, room: r.id, head: r.id === 'Ngoài' ? 'Tại nhà' : r.label + (r.warm ? ' (ấm)' : '') }));
    }
    const rangeLabel = cal.mode === 'tuan'
      ? pad(ws.getDate()) + ' – ' + we.getDate() + ' tháng ' + (we.getMonth() + 1)
      : weekdayOf(cal.day) + ', ' + fmtDMY(cal.day);

    const hours = [];
    for (let h = DAY_START; h <= DAY_END; h++) hours.push(h);
    const bodyH = (DAY_END - DAY_START) * HOUR_PX;

    const colHtml = cols.map(col => {
      const evs = db.appointments.filter(a => a.date === col.date && (!col.room || a.room === col.room));
      return '<div class="cal-col' + (col.today ? ' today' : '') + '" style="height:' + bodyH + 'px">' + layoutEvents(evs).map(evHtml).join('') + '</div>';
    }).join('');

    const legend = [['paid', 'Đã cọc'], ['newborn', 'Newborn (phòng ấm)'], ['due', 'Chưa thu đủ'], ['hold', 'Giữ chỗ, chưa cọc'], ['home', 'Chụp tại nhà']]
      .map(([k, l]) => '<span><i class="lg-' + k + '"></i>' + l + '</span>').join('') + '<span><i class="lg-mine"></i>Khách của tôi</span>';

    return '<div class="cal-layout">' +
      '<section class="sw-card cal-card">' +
        '<div class="cal-toolbar">' +
          '<button type="button" class="sw-icon-btn sw-card-btn" data-act="cal-prev" aria-label="Trước">' + icon('back') + '</button>' +
          '<button type="button" class="sw-btn" data-act="cal-today">Hôm nay</button>' +
          '<button type="button" class="sw-icon-btn sw-card-btn" data-act="cal-next" aria-label="Sau">' + icon('next') + '</button>' +
          '<strong class="cal-range">' + rangeLabel + '</strong>' +
          '<div class="sw-chips cal-modes">' + [['tuan', 'Tuần'], ['ngay', 'Ngày'], ['phong', 'Theo phòng']].map(([k, l]) =>
            '<button type="button" class="sw-chip' + (cal.mode === k ? ' on' : '') + '" data-act="cal-mode" data-id="' + k + '">' + l + '</button>').join('') + '</div>' +
        '</div>' +
        '<div class="cal-legend">' + legend + '</div>' +
        '<div class="cal-scroll"><div class="cal-grid" style="--cols:' + cols.length + '">' +
          '<div class="cal-corner"></div>' +
          cols.map(c => '<div class="cal-head' + (c.today ? ' today' : '') + '">' + esc(c.head) + '</div>').join('') +
          '<div class="cal-times" style="height:' + bodyH + 'px">' + hours.map(h => '<span style="top:' + ((h - DAY_START) * HOUR_PX) + 'px">' + pad(h) + ':00</span>').join('') + '</div>' +
          colHtml +
        '</div></div>' +
      '</section>' +
      '<aside class="sw-card qb" id="qbPanel">' + quickBookForm() + '</aside>' +
    '</div>';
  }

  // Xếp sự kiện chồng giờ thành các làn song song.
  function layoutEvents(evs) {
    const sorted = evs.slice().sort((a, b) => toMin(a.start) - toMin(b.start));
    const out = [];
    let cluster = []; let clusterEnd = -1;
    const flush = () => {
      const lanes = [];
      cluster.forEach(ev => {
        const s = toMin(ev.start);
        let lane = lanes.findIndex(end => end <= s);
        if (lane === -1) { lane = lanes.length; lanes.push(0); }
        lanes[lane] = s + ev.dur * 60;
        out.push({ ev, lane });
      });
      out.slice(out.length - cluster.length).forEach(o => { o.lanes = lanes.length; });
      cluster = []; clusterEnd = -1;
    };
    sorted.forEach(ev => {
      const s = toMin(ev.start);
      if (cluster.length && s >= clusterEnd) flush();
      cluster.push(ev);
      clusterEnd = Math.max(clusterEnd, s + ev.dur * 60);
    });
    if (cluster.length) flush();
    return out;
  }

  function evHtml(o) {
    const a = o.ev;
    const top = (toMin(a.start) - DAY_START * 60) / 60 * HOUR_PX;
    const h = Math.max(30, a.dur * HOUR_PX - 4);
    const w = 100 / o.lanes;
    const title = a.status === 'giu-cho' ? 'Giữ chỗ · ' + a.label : a.service + ' · ' + a.label;
    return '<button type="button" class="cal-ev ev-' + apKind(a) + (a.owner === me.id ? ' mine' : '') + '" data-act="ev" data-id="' + a.id + '" ' +
      'style="top:' + top + 'px;height:' + h + 'px;left:calc(' + (o.lane * w) + '% + 2px);width:calc(' + w + '% - 4px)">' +
      '<strong>' + esc(title) + '</strong><small>' + a.start + ' · ' + esc(a.room) + '</small></button>';
  }

  function showAppointment(id) {
    const a = db.appointments.find(x => x.id === id);
    if (!a) return;
    const st = apStatus(a);
    const own = a.owner === me.id;
    const c = a.customerId ? customer(a.customerId) : null;
    const rows = [
      ['Dịch vụ', a.service], ['Khách', a.label], ['Thời gian', a.start + ' · ' + weekdayOf(a.date) + ' ' + fmtDMY(a.date)],
      ['Phòng · Thợ ảnh', (a.room === 'Ngoài' ? 'Tại nhà khách' + (a.place ? ' (' + a.place + ')' : '') : roomLabel(a.room)) + ' · Thợ ' + a.photographer],
      ['Trạng thái', st.text], ['Phụ trách', saleName(a.owner) + (own ? ' (tôi)' : '')]
    ];
    if (own && c) rows.push(['Liên hệ', fullPhone(c.phone)]);
    openModal(a.service + ' · ' + a.label,
      '<dl class="sw-dl">' + rows.map(r => '<dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd>').join('') + '</dl>' +
      (own
        ? (c ? '<div class="sw-modal-actions"><button type="button" class="sw-btn" data-act="msg" data-id="' + c.id + '">' + icon('chat') + 'Nhắn khách</button><button type="button" class="sw-btn sw-btn-teal" data-act="call" data-id="' + c.id + '">' + icon('phone') + 'Gọi</button></div>' : '')
        : '<p class="sw-note">Khách do ' + esc(saleName(a.owner)) + ' phụ trách. Thông tin liên hệ và cọc chỉ sale phụ trách xem được.</p>'));
  }

  // ----- Tạo lịch nhanh -----
  function roomBusy(room, date, start, dur, ignoreId) {
    const s = toMin(start); const e = s + dur * 60;
    return db.appointments.some(a => a.id !== ignoreId && a.room === room && a.room !== 'Ngoài' && a.date === date && toMin(a.start) < e && toMin(a.start) + a.dur * 60 > s);
  }
  function photographerBusy(p, date, start, dur) {
    const s = toMin(start); const e = s + dur * 60;
    return db.appointments.some(a => a.photographer === p && a.date === date && toMin(a.start) < e && toMin(a.start) + a.dur * 60 > s);
  }
  function durationOf(service) { return service === 'Newborn' || service === 'Gia đình' ? 2 : 1.5; }
  function roomOptions() {
    const q = ui.qb;
    const dur = durationOf(q.service);
    const list = q.service === 'Tại nhà' ? db.rooms.filter(r => r.id === 'Ngoài') : db.rooms.filter(r => r.id !== 'Ngoài');
    const ordered = q.service === 'Newborn' ? list.slice().sort((a, b) => (b.warm ? 1 : 0) - (a.warm ? 1 : 0)) : list;
    return ordered.map(r => {
      const busy = q.date && q.time ? roomBusy(r.id, q.date, q.time, dur) : false;
      const ph = q.date && q.time ? db.photographers.find(p => !photographerBusy(p, q.date, q.time, dur)) : db.photographers[0];
      return { value: r.id + '|' + (ph || ''), label: r.label + ' · ' + (ph ? 'Thợ ' + ph : 'hết thợ trống'), disabled: busy || !ph, busy };
    });
  }
  function nextCode() {
    const max = db.deposits.concat(db.orders).reduce((m, x) => Math.max(m, Number(String(x.code).replace(/\D/g, '')) || 0), 0);
    return 'AB' + (max + 1);
  }
  function lookupPhone(phone) {
    const d = String(phone).replace(/\D/g, '');
    if (d.length < 9) return { state: 'none' };
    const c = db.customers.find(x => x.phone === d);
    if (!c) return { state: 'new' };
    if (c.owner !== me.id) return { state: 'other', owner: saleName(c.owner) };
    return { state: 'mine', customer: c };
  }
  function holdUntilText() { const d = demoNow(); d.setHours(d.getHours() + CFG.holdHours); return hm(d); }

  function qbMessage() {
    const q = ui.qb; const lk = lookupPhone(q.phone);
    const c = lk.customer;
    const who = c ? c.title + ' ' + c.short : (q.name ? 'anh/chị ' + q.name.split(' ').pop() : 'anh/chị');
    const d = q.date ? fmtDM(q.date) : '[ngày]';
    return 'Dạ ALOHA Baby giữ lịch ' + q.service + ' ' + (q.time || '[giờ]') + ' ngày ' + d + ' cho ' + who + ' đến ' + holdUntilText() + ' ạ. ' +
      capital(c ? c.title : 'anh/chị') + ' đặt cọc tại: aloha.vn/c/' + nextCode();
  }

  function qbLookupHtml() {
    const lk = lookupPhone(ui.qb.phone);
    if (lk.state === 'mine') return '<p class="qb-hint c-teal">Đã tìm thấy: ' + esc(lk.customer.name) + ' · ' + esc(lk.customer.tags[0] || stageLabel(lk.customer.stage)) + '</p>';
    if (lk.state === 'other') return '<p class="qb-hint c-red">Số này là khách do ' + esc(lk.owner) + ' phụ trách, bạn không tạo lịch hộ được.</p>';
    if (lk.state === 'new') return '<p class="qb-hint">Khách mới, sẽ tạo hồ sơ CRM do bạn phụ trách.</p><label class="qb-field"><span>Tên khách</span><input data-qb="name" value="' + esc(ui.qb.name) + '" placeholder="VD: Chị Minh Anh"></label>';
    return '<p class="qb-hint sw-muted">Nhập số điện thoại để tìm hồ sơ khách.</p>';
  }

  function quickBookForm() {
    const q = ui.qb;
    const opts = roomOptions();
    if (!q.room || !opts.some(o => o.value === q.room && !o.disabled)) q.room = (opts.find(o => !o.disabled) || { value: '' }).value;
    const lk = lookupPhone(q.phone);
    const online = lk.state === 'mine' && convOf(lk.customer.id) && convOf(lk.customer.id).online;
    return '<h2>Tạo lịch nhanh</h2>' +
      '<form data-form="quick-book" novalidate>' +
        '<label class="qb-field"><span>Số điện thoại khách</span><input data-qb="phone" inputmode="tel" value="' + esc(q.phone) + '" placeholder="0912 456 789"></label>' +
        '<div id="qbLookup">' + qbLookupHtml() + '</div>' +
        '<div class="qb-field"><span>Dịch vụ</span><div class="sw-chips">' + SERVICES.concat(['Tại nhà']).map(s =>
          '<button type="button" class="sw-chip' + (q.service === s ? ' on-teal' : '') + '" data-act="qb-service" data-id="' + s + '">' + s + '</button>').join('') + '</div></div>' +
        '<div class="qb-row">' +
          '<label class="qb-field"><span>Ngày</span><input type="date" data-qb="date" value="' + esc(q.date) + '" min="' + TODAY + '"></label>' +
          '<label class="qb-field"><span>Giờ</span><input type="time" data-qb="time" value="' + esc(q.time) + '" min="08:00" max="18:00" step="900"></label>' +
        '</div>' +
        '<label class="qb-field"><span>Phòng · Thợ ảnh</span><select data-qb="room" id="qbRoom">' + opts.map(o =>
          '<option value="' + esc(o.value) + '"' + (o.disabled ? ' disabled' : '') + (o.value === q.room ? ' selected' : '') + '>' + esc(o.label) + (o.busy ? ' (phòng đã kín)' : '') + '</option>').join('') + '</select></label>' +
        '<p class="qb-hint c-teal">Tự gợi ý: ' + (q.service === 'Newborn' ? 'phòng ấm cho newborn, ' : '') + 'thợ còn trống</p>' +
        '<label class="qb-field"><span>Gói</span><select data-qb="pkg"><option value="">[Tên gói] · ' + CFG.packagePriceText + '</option>' +
          ['Cơ bản', 'Tiêu chuẩn', 'Premium'].map(p => '<option' + (q.pkg === p ? ' selected' : '') + '>' + p + '</option>').join('') + '</select></label>' +
        '<div class="qb-deposit">' + icon('qr') + '<span>Cọc <strong>' + CFG.depositText + '</strong> · Mã <strong>' + nextCode() + '</strong> · giữ lịch ' + CFG.holdHours + ' giờ</span></div>' +
        '<div class="qb-field"><span>Gửi link cọc qua (chọn được nhiều kênh)</span><div class="qb-channels">' +
          CHANNELS.map(ch => '<button type="button" class="qb-ch' + (q.channels.includes(ch) ? ' on' : '') + '" data-act="qb-channel" data-id="' + ch + '">' + (q.channels.includes(ch) ? icon('check') : '') + ch + '</button>').join('') +
          '<button type="button" class="qb-ch" data-act="qb-copy">Sao chép link</button>' +
        '</div></div>' +
        (online ? '<p class="qb-hint c-teal">Gợi ý: khách đang online trên chat web. Thêm SMS để khách không lỡ link.</p>' : '') +
        '<div class="qb-preview" id="qbPreview">' + esc(qbMessage()) + '</div>' +
        '<p class="qb-error c-red" id="qbError" hidden></p>' +
        '<button type="submit" class="sw-btn sw-btn-accent sw-btn-block qb-submit">' + icon('send') + 'Giữ lịch và gửi link cọc (' + q.channels.length + ' kênh)</button>' +
      '</form>';
  }

  function refreshQuickBook(full) {
    const panel = document.getElementById('qbPanel');
    if (!panel) return;
    if (full) { panel.innerHTML = quickBookForm(); return; }
    document.getElementById('qbLookup').innerHTML = qbLookupHtml();
    document.getElementById('qbPreview').textContent = qbMessage();
  }

  function submitQuickBook() {
    const q = ui.qb;
    const err = (m) => { const el = document.getElementById('qbError'); el.textContent = m; el.hidden = false; };
    const lk = lookupPhone(q.phone);
    if (lk.state === 'none') return err('Nhập số điện thoại khách hợp lệ.');
    if (lk.state === 'other') return err('Khách này do ' + lk.owner + ' phụ trách.');
    if (lk.state === 'new' && !q.name.trim()) return err('Nhập tên khách mới.');
    if (!q.date || !q.time) return err('Chọn ngày và giờ chụp.');
    if (toMin(q.time) < DAY_START * 60 || toMin(q.time) + durationOf(q.service) * 60 > DAY_END * 60) return err('Giờ chụp phải nằm trong khung 08:00–19:00.');
    if (!q.room) return err('Không còn phòng/thợ trống ở khung giờ này, chọn giờ khác.');
    if (!q.channels.length) return err('Chọn ít nhất 1 kênh gửi link cọc.');
    const [room, ph] = q.room.split('|');
    const dur = durationOf(q.service);
    if (roomBusy(room, q.date, q.time, dur) || photographerBusy(ph, q.date, q.time, dur)) return err('Khung giờ vừa bị giữ, chọn giờ khác.');

    let c = lk.customer;
    if (!c) {
      const name = q.name.trim();
      const isAnh = /^anh\s/i.test(name);
      c = {
        id: 'new-' + Date.now(), owner: me.id, name: /^(chị|anh)\s/i.test(name) ? capital(name) : 'Chị ' + name,
        short: name.split(/\s+/).pop(), title: isAnh ? 'anh' : 'chị', phone: q.phone.replace(/\D/g, ''), area: 'Hà Nội',
        service: q.service, source: 'Hotline', stage: 'cho-coc', since: 'Vừa tạo', status: {}, tags: ['Khách mới'], note: ''
      };
      db.customers.push(c);
    }
    const code = nextCode();
    const hold = holdUntilText();
    const apId = 'ap-' + Date.now();
    db.appointments.push({ id: apId, date: q.date, start: q.time, dur, service: q.service, label: c.name.replace(/^Chị /, 'C. ').replace(/^Anh /, 'A. '), room, photographer: ph, status: 'giu-cho', owner: me.id, customerId: c.id, depositCode: code });
    db.deposits.unshift({ code, owner: me.id, customerId: c.id, appointmentId: apId, channels: q.channels.slice(), state: 'sent', sentAt: hm(demoNow()), holdUntil: hold,
      log: [{ time: hm(demoNow()), who: 'sale', text: me.name + ' gửi link cọc qua ' + q.channels.join(', ') }] });
    c.stage = 'cho-coc';
    c.status = { text: 'Hết hạn giữ ' + hold, tone: 'amber' };
    c.since = 'Giữ ' + fmtDM(q.date) + ' ' + q.time;
    const conv = convOf(c.id);
    if (conv && q.channels.includes('Chat web')) {
      conv.messages.push({ from: 'sale', text: qbMessage().replace(/aloha\.vn\/c\/AB\d+/, 'aloha.vn/c/' + code), time: hm(demoNow()) });
    }
    ui.dep.selected = code;
    ui.qb.phone = ''; ui.qb.name = '';
    render();
    toast('Đã giữ lịch ' + fmtDM(q.date) + ' ' + q.time + ' và gửi link cọc ' + code, { label: 'Xem trang khách', href: cocLink(db.deposits[0]) });
  }

  function cocLink(dep) {
    const c = customer(dep.customerId); const ap = appointmentOf(dep);
    const p = new URLSearchParams({ ma: dep.code, kh: c.title + ' ' + c.short, dv: ap ? ap.service : c.service, ngay: ap ? ap.date : '', gio: ap ? ap.start : '', han: dep.holdUntil || '', sale: saleName(dep.owner) });
    return '../coc.html?' + p.toString();
  }

  // ---------- Trang: Đặt cọc & đối soát ----------
  const DEP_STEPS = ['Đã gửi link', 'Khách mở link', 'Tiền về', 'Lịch xác nhận'];
  function depStepCount(d) { return { sent: 1, opened: 2, short: 3, paid: 3, confirmed: 4 }[d.state] || 1; }
  function depBadge(d) {
    if (d.state === 'confirmed') return badge('Đã xác nhận lịch · ' + money(d.received), 'green');
    if (d.state === 'paid') return badge('Tự khớp lúc ' + d.paidAt + ' · ' + money(d.received), 'green');
    if (d.state === 'opened') return badge('Khách đã mở link ' + d.openedAt + ' · giữ đến ' + d.holdUntil, 'blue');
    if (d.state === 'short') return badge('Nhận ' + money(d.received) + ' · thiếu so với số tiền cọc', 'red');
    return badge('Chưa mở link · hết hạn giữ ' + d.holdUntil, 'amber');
  }
  function depAction(d) {
    if (d.state === 'paid') return '<button type="button" class="sw-btn sw-btn-teal" data-act="confirm-deposit" data-code="' + d.code + '">' + icon('check') + 'Xác nhận</button>';
    if (d.state === 'opened') return '<button type="button" class="sw-btn" data-act="resend-deposit" data-code="' + d.code + '">' + icon('send') + 'Nhắc lại</button>';
    if (d.state === 'sent') return '<button type="button" class="sw-btn" data-act="resend-sms" data-code="' + d.code + '">' + icon('send') + 'Gửi lại qua SMS</button>';
    if (d.state === 'short') return '<button type="button" class="sw-btn sw-btn-accent" data-act="check-short" data-code="' + d.code + '">Kiểm tra</button>';
    return '<button type="button" class="sw-btn" data-act="select-deposit" data-code="' + d.code + '">Xem hồ sơ</button>';
  }

  function viewDeposits() {
    setHead('Đặt cọc và đối soát tự động', 'Tiền vào tài khoản studio là lịch tự xác nhận và hồ sơ khách tự cập nhật, Sale không phải xem bill');
    const deps = myDeposits();
    const waiting = deps.filter(d => d.state === 'sent' || d.state === 'opened');
    const arrived = deps.filter(d => ['paid', 'confirmed', 'short'].includes(d.state));
    const shortOnes = deps.filter(d => d.state === 'short');
    const manual = shortOnes.length + db.unmatched.length;
    const groups = {
      all: () => true,
      'cho-coc': d => d.state === 'sent' || d.state === 'opened',
      'kiem-tra': d => d.state === 'short',
      'da-khop': d => d.state === 'paid' || d.state === 'confirmed'
    };
    const shown = deps.filter(groups[ui.dep.filter]);
    if (!ui.dep.selected || !deps.some(d => d.code === ui.dep.selected)) ui.dep.selected = (deps.find(d => d.state === 'paid' || d.state === 'confirmed') || deps[0] || {}).code;
    const sel = deps.find(d => d.code === ui.dep.selected);
    const chip = (k, l) => '<button type="button" class="sw-chip' + (ui.dep.filter === k ? ' on' : '') + '" data-act="dep-filter" data-id="' + k + '">' + l + ' ' + (k === 'kiem-tra' ? manual : deps.filter(groups[k]).length) + '</button>';

    return '<div class="sw-kpis sw-kpis-4">' +
        '<div class="sw-card sw-kpi"><small>Chờ khách cọc</small><strong>' + waiting.length + '</strong><span class="c-amber">' + waiting.length + ' đang giữ lịch</span></div>' +
        '<div class="sw-card sw-kpi"><small>Tiền cọc về hôm nay</small><strong>' + arrived.length + ' khoản</strong><span class="c-teal">' + (shortOnes.length ? (arrived.length - shortOnes.length) + ' khoản tự khớp' : 'Tất cả đã tự khớp') + '</span></div>' +
        '<div class="sw-card sw-kpi"><small>Cần kiểm tra tay</small><strong>' + manual + '</strong><span class="c-red">' + shortOnes.length + ' thiếu tiền · ' + db.unmatched.length + ' sai mã</span></div>' +
        '<div class="sw-card sw-kpi"><small>Thời gian khớp TB</small><strong>8 giây</strong><span class="c-teal">Từ lúc tiền vào tới lúc xác nhận</span></div>' +
      '</div>' +
      '<div class="sw-grid-2">' +
        '<section class="sw-card sw-pad">' +
          '<div class="sw-card-head"><h2>Yêu cầu đặt cọc hôm nay</h2><div class="sw-chips">' + chip('all', 'Tất cả') + chip('cho-coc', 'Chờ cọc') + chip('kiem-tra', 'Cần kiểm tra') + chip('da-khop', 'Đã khớp') + '</div></div>' +
          db.unmatched.map(tx => '<div class="dp-unmatched"><div><strong>1 giao dịch chưa khớp mã</strong><small>' + money(tx.amount) + ' lúc ' + tx.time + ' · nội dung "' + esc(tx.content) + '" · không có mã đơn</small></div>' +
            '<button type="button" class="sw-btn" data-act="assign-tx" data-id="' + tx.id + '">' + icon('userPlus') + 'Gán cho khách</button></div>').join('') +
          (shown.length ? shown.map(d => {
            const c = customer(d.customerId); const ap = appointmentOf(d); const n = depStepCount(d);
            return '<div class="dp-row' + (d.code === ui.dep.selected ? ' on' : '') + '" data-act="select-deposit" data-code="' + d.code + '">' +
              '<div class="dp-main"><strong class="dp-code">' + d.code + '</strong>' +
                '<div class="dp-who"><strong>' + esc(c.name) + '</strong><small>' + esc((ap ? ap.service : c.service) + ' · ' + (ap ? fmtDM(ap.date) + ' ' + ap.start : '')) + '</small></div>' +
                '<div class="dp-meta">' + d.channels.map(ch => '<span class="sw-tag tone-beige">' + esc(ch) + '</span>').join('') + depBadge(d) + '</div>' +
                '<div class="dp-action">' + depAction(d) + '</div></div>' +
              '<ol class="dp-steps">' + DEP_STEPS.map((s, i) => '<li class="' + (i < n ? (d.state === 'short' && i === 2 ? 'warn' : 'done') : '') + '"><i>' + (i < n ? icon('check') : '') + '</i>' + s + '</li>').join('') + '</ol>' +
            '</div>';
          }).join('') : emptyState('Không có yêu cầu đặt cọc nào trong nhóm này.')) +
        '</section>' +
        '<aside class="sw-card sw-pad dp-profile">' + (sel ? depProfile(sel) : emptyState('Chưa có yêu cầu đặt cọc nào.')) + '</aside>' +
      '</div>';
  }

  function depProfile(d) {
    const c = customer(d.customerId); const ap = appointmentOf(d);
    const stageText = d.state === 'confirmed' ? 'Chờ cọc → Đã chốt' : stageLabel(c.stage);
    return '<div class="sw-card-head"><div><small class="sw-label">Hồ sơ khách · tự cập nhật</small><h2>' + esc(c.name) + '</h2></div>' +
        (ui.dep.fresh[d.code] ? badge('Vừa cập nhật', 'teal') : '') + '</div>' +
      '<dl class="dp-grid">' +
        '<div><dt>Giai đoạn</dt><dd class="c-teal"><strong>' + esc(stageText) + '</strong></dd></div>' +
        '<div><dt>Lịch chụp</dt><dd>' + esc(ap ? ap.service + ' · ' + fmtDM(ap.date) + ' ' + ap.start : '—') + '</dd></div>' +
        '<div><dt>Đã thanh toán</dt><dd><strong>' + (d.received ? money(d.received) : '0đ') + '</strong></dd></div>' +
        '<div><dt>Còn lại</dt><dd>[Giá gói − tiền cọc]</dd></div>' +
        '<div><dt>Liên hệ</dt><dd>' + maskPhone(c.phone) + ' · ' + esc(d.channels[0]) + '</dd></div>' +
        '<div><dt>Phụ trách</dt><dd>' + esc(saleName(d.owner)) + '</dd></div>' +
      '</dl>' +
      '<a class="sw-link dp-link" href="' + esc(cocLink(d)) + '" target="_blank" rel="noopener">' + icon('link') + 'Xem trang đặt cọc của khách</a>' +
      '<small class="sw-label">Nhật ký</small>' +
      '<ol class="dp-log">' + d.log.map(l => '<li class="' + l.who + '"><div><time>' + esc(l.time) + '</time>' + badge(l.who === 'auto' ? 'Tự động' : 'Sale', l.who === 'auto' ? 'teal' : 'peach') + '</div><p>' + esc(l.text) + '</p></li>').join('') + '</ol>';
  }

  function confirmDeposit(code) {
    const d = myDeposits().find(x => x.code === code);
    if (!d || d.state !== 'paid') return;
    const c = customer(d.customerId); const ap = appointmentOf(d); const t = hm(demoNow());
    d.state = 'confirmed';
    if (ap) ap.status = 'da-coc';
    c.stage = 'da-chot'; c.status = { text: 'Đã cọc', tone: 'green' }; c.since = 'Cọc ' + money(d.received);
    d.log.unshift(
      { time: t, who: 'auto', text: 'Báo thợ ảnh ' + (ap ? ap.photographer : '') + ': có lịch mới đã chốt' },
      { time: t, who: 'auto', text: 'Gửi tin xác nhận và biên nhận cọc cho khách qua ' + d.channels[0] },
      { time: t, who: 'auto', text: 'Lịch ' + (ap ? fmtDM(ap.date) + ' ' + ap.start : '') + ' chuyển sang "Đã cọc", bỏ trạng thái giữ chỗ' },
      { time: t, who: 'sale', text: me.name + ' xác nhận cọc ' + money(d.received) }
    );
    ui.dep.selected = code; ui.dep.fresh[code] = true;
    render();
    toast('Đã xác nhận cọc ' + c.name + '. Lịch chuyển sang "Đã cọc".');
  }

  // ---------- Trang: Đơn & ảnh ----------
  const ORD_STATUS = {
    'cho-chon': { text: 'Chờ khách chọn ảnh', tone: 'amber', step: 2, action: 'Nhắc chọn ảnh' },
    'dang-chinh': { text: 'Thợ ảnh đang chỉnh', tone: 'blue', step: 3 },
    'qua-han': { text: 'Quá hạn giao', tone: 'red', step: 3, action: 'Báo khách' },
    'cho-duyet': { text: 'Chờ khách duyệt', tone: 'blue', step: 4, action: 'Xem phản hồi' },
    'da-giao': { text: 'Đã giao ảnh', tone: 'teal', step: 5 }
  };
  function viewOrders() {
    setHead('Đơn và tiến độ ảnh', 'Theo dõi từ sau buổi chụp tới khi khách nhận ảnh · Sale lo phần nhắc khách và thu tiền');
    const orders = myOrders();
    const groups = {
      all: () => true, 'cho-chon': o => o.status === 'cho-chon', 'dang-chinh': o => o.status === 'dang-chinh',
      'qua-han': o => o.status === 'qua-han', 'cong-no': o => o.due > 0, 'da-giao': o => o.status === 'da-giao'
    };
    const chipTone = { all: '', 'cho-chon': 'amber', 'dang-chinh': 'blue', 'qua-han': 'red', 'cong-no': 'peach', 'da-giao': 'teal' };
    const chip = (k, l) => '<button type="button" class="sw-chip tone-chip-' + (chipTone[k] || 'dark') + (ui.ord.filter === k ? ' on' : '') + '" data-act="ord-filter" data-id="' + k + '">' + l + ' ' + orders.filter(groups[k]).length + '</button>';
    const shown = orders.filter(groups[ui.ord.filter]);
    const steps = ['Đã chụp', 'Khách chọn ảnh', 'Thợ chỉnh sửa', 'Khách duyệt', 'Giao ảnh'];

    return '<div class="sw-card od-steps">' + steps.map((s, i) => '<span><b>' + (i + 1) + '</b>' + s + '</span>').join('<i></i>') + '</div>' +
      '<section class="sw-card sw-pad">' +
        '<div class="sw-card-head"><div class="sw-chips">' + chip('all', 'Tất cả') + chip('cho-chon', 'Chờ chọn ảnh') + chip('dang-chinh', 'Đang chỉnh') + chip('qua-han', 'Quá hạn') + chip('cong-no', 'Còn công nợ') + chip('da-giao', 'Đã giao') + '</div>' +
          '<button type="button" class="sw-btn" data-act="remind-all">' + icon('send') + 'Nhắc tất cả khách chưa chọn ảnh</button></div>' +
        '<div class="sw-table-wrap"><table class="sw-table">' +
          '<thead><tr><th>Mã đơn</th><th>Khách</th><th>Dịch vụ · gói</th><th>Ngày chụp</th><th>Trạng thái</th><th>Tiến độ</th><th>Thanh toán</th><th></th></tr></thead><tbody>' +
          (shown.length ? shown.map(o => {
            const st = ORD_STATUS[o.status];
            const action = o.status === 'dang-chinh' && o.due > 0 ? 'Nhắc thanh toán' : (o.action || st.action || 'Xem');
            return '<tr><td><strong>#' + o.code + '</strong></td><td><strong>' + esc(o.customer) + '</strong></td><td>' + esc(o.service + ' · ' + o.pkg) + '</td><td>' + o.date + '</td>' +
              '<td>' + badge(st.text, st.tone) + '</td><td class="sw-muted">' + esc(o.remindedAt ? o.progress + ' · đã nhắc ' + o.remindedAt : o.progress) + '</td>' +
              '<td>' + (o.due > 0 ? '<strong class="c-red">Còn ' + money(o.due) + '</strong>' : '<strong class="c-teal">Đã thanh toán đủ</strong>') + '</td>' +
              '<td class="sw-right"><button type="button" class="sw-btn" data-act="order-action" data-code="' + o.code + '" data-id="' + esc(action) + '">' + esc(action) + '</button></td></tr>';
          }).join('') : '<tr><td colspan="8">' + emptyState('Không có đơn nào trong nhóm này.') + '</td></tr>') +
          '</tbody></table></div>' +
      '</section>';
  }

  // ---------- Trang: Chuyển giao khách ----------
  // Luồng: Sale tạo yêu cầu -> Quản lý duyệt -> người nhận bấm "Nhận khách" -> hồ sơ,
  // hội thoại, lịch, cọc, đơn chuyển sang người nhận. Trước bước cuối khách vẫn thuộc
  // sale cũ, nên không có lúc nào khách bị bỏ trống không ai phụ trách.
  // Bản demo chưa có màn duyệt của Quản lý và dữ liệu không dùng chung giữa các tab
  // đăng nhập, nên yêu cầu tự gửi có nút "Mô phỏng" cho 2 bước phía người khác.
  const TR_REASONS = ['Nghỉ phép', 'Nghỉ việc', 'Khách yêu cầu', 'Quá tải'];
  const TR_OPEN = ['cho-duyet', 'cho-nhan'];
  const trIncoming = () => db.transfers.filter(r => r.to === me.id && r.status !== 'da-huy');
  const trOutgoing = () => db.transfers.filter(r => r.from === me.id && r.status !== 'da-huy');
  const trWaitingMe = () => db.transfers.filter(r => r.to === me.id && r.status === 'cho-nhan').length;
  const trLocked = (id) => db.transfers.some(r => r.from === me.id && TR_OPEN.includes(r.status) && r.customerIds.includes(id));
  const onLeave = (s) => !!(s.leave && s.leave.until >= TODAY);
  const saleLoad = (s) => db.customers.filter(c => c.owner === s.id).length;

  function nextAppointment(c) {
    return db.appointments.filter(a => a.customerId === c.id && a.date >= TODAY)
      .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))[0];
  }
  function trFilter(k) {
    const end7 = dateKey(addDays(parseKey(TODAY), 7));
    return {
      all: () => true,
      'lich-7': c => { const ap = nextAppointment(c); return !!ap && ap.date <= end7; },
      'tu-van': c => c.stage === 'tu-van',
      'cho-coc': c => c.stage === 'cho-coc'
    }[k] || (() => true);
  }
  function trSubline(c) {
    const ap = nextAppointment(c);
    if (ap) {
      if (ap.status === 'giu-cho') {
        const d = db.deposits.find(x => x.appointmentId === ap.id);
        return 'Giữ lịch ' + fmtDM(ap.date) + ' ' + ap.start + (d && d.holdUntil && d.state !== 'paid' ? ' · hết hạn giữ ' + d.holdUntil : '');
      }
      return 'Chụp ' + ap.service + ' ' + fmtDM(ap.date) + ' ' + ap.start;
    }
    const o = db.orders.find(x => x.customerId === c.id && x.status !== 'da-giao');
    if (o) return 'Đơn #' + o.code + ' · ' + o.progress;
    return c.status.text + ' · ' + c.service;
  }
  function trBadge(c) {
    const map = { 'moi': ['Mới', 'red'], 'tu-van': ['Đang tư vấn', 'amber'], 'bao-gia': ['Đã báo giá', 'blue'], 'cho-coc': ['Chờ cọc', 'red'], 'da-chot': ['Đã chốt', 'green'] };
    if (map[c.stage]) return badge(map[c.stage][0], map[c.stage][1]);
    if (db.orders.some(x => x.customerId === c.id && x.status === 'cho-chon')) return badge('Chờ chọn ảnh', 'blue');
    const g = groupOf(c); return badge(g.label, g.tone);
  }
  // Ghi chú bàn giao gợi ý sẵn từ dữ liệu CRM (người gửi sửa lại được).
  function trDraft(list) {
    return list.map(c => c.name + ': ' + trSubline(c) + '.' + (c.note ? ' ' + c.note : '')).join('\n');
  }
  function trStatusBadge(r) {
    if (r.status === 'cho-duyet') return badge('Chờ quản lý duyệt', 'amber');
    if (r.status === 'cho-nhan') return r.to === me.id ? badge('Chờ bạn nhận', 'amber') : badge('Chờ ' + saleName(r.to) + ' nhận', 'blue');
    if (r.status === 'da-chuyen') return badge('Đã chuyển ' + r.doneAt, 'green');
    return badge('Đã huỷ', 'muted');
  }
  function trRow(r, full) {
    const out = r.from === me.id;
    const who = r.names.join(', ') + (out ? ' → ' + saleName(r.to) : ' ← từ ' + saleName(r.from));
    const meta = r.reason + ' · ' + (r.mode === 'tam-thoi' ? 'tạm thời đến ' + fmtDM(r.until) : 'chuyển hẳn') + ' · gửi ' + r.createdAt;
    let actions = '';
    if (!out && r.status === 'cho-nhan') {
      actions = '<button type="button" class="sw-btn sw-btn-teal" data-act="tr-accept" data-id="' + r.id + '">' + icon('check') + 'Nhận khách</button>';
    } else if (out && r.status === 'cho-duyet') {
      actions = '<button type="button" class="sw-btn" data-act="tr-cancel" data-id="' + r.id + '">Huỷ</button>' +
        '<button type="button" class="tr-demo" data-act="tr-approve" data-id="' + r.id + '">Mô phỏng: quản lý duyệt</button>';
    } else if (out && r.status === 'cho-nhan') {
      actions = '<button type="button" class="tr-demo" data-act="tr-accept" data-id="' + r.id + '">Mô phỏng: ' + esc(saleName(r.to)) + ' nhận khách</button>';
    }
    return '<div class="tr-req">' +
      '<div class="tr-req-body"><strong>' + esc(who) + '</strong><small>' + esc(meta) + '</small>' +
        (full ? '<small>' + esc(r.revenue === 'giu' ? 'Doanh số: đơn đã cọc vẫn tính cho ' + saleName(r.from) : 'Doanh số: tính hết cho ' + saleName(r.to)) + '</small>' +
          (r.note ? '<p class="tr-req-note">' + esc(r.note) + '</p>' : '') : '') +
      '</div>' +
      '<div class="tr-req-side">' + trStatusBadge(r) + actions + '</div>' +
    '</div>';
  }

  function viewTransfer() {
    setHead('Chuyển giao khách', 'Chuyển khách cho Sale khác khi nghỉ phép, quá tải hoặc khách yêu cầu · Quản lý duyệt rồi khách mới được chuyển');
    const t = ui.tr;
    const inc = trIncoming(); const outg = trOutgoing();
    const tabs = '<div class="sw-chips tr-tabs">' + [['tao', 'Tạo yêu cầu'], ['den', 'Chuyển đến tôi · ' + inc.length], ['gui', 'Đã gửi · ' + outg.length]].map(([k, l]) =>
      '<button type="button" class="sw-chip' + (t.tab === k ? ' on' : (k === 'den' && trWaitingMe() ? ' tone-chip-amber' : '')) + '" data-act="tr-tab" data-id="' + k + '">' + l + '</button>').join('') + '</div>';

    if (t.tab !== 'tao') {
      const den = t.tab === 'den';
      const list = den ? inc : outg;
      return tabs + '<section class="sw-card sw-pad">' +
        '<div class="sw-card-head"><h2>' + (den ? 'Khách chuyển đến tôi' : 'Yêu cầu tôi đã gửi') + '</h2></div>' +
        (list.length ? '<div class="tr-reqs">' + list.map(r => trRow(r, true)).join('') + '</div>'
          : emptyState(den ? 'Chưa có khách nào được chuyển đến bạn.' : 'Bạn chưa gửi yêu cầu chuyển giao nào.')) +
      '</section>';
    }

    const all = myCustomers();
    Object.keys(t.selected).forEach(id => { if (!myCustomer(id) || trLocked(id)) delete t.selected[id]; });
    const shown = all.filter(trFilter(t.filter));
    const picked = all.filter(c => t.selected[c.id]);
    const selectable = shown.filter(c => !trLocked(c.id));
    const allOn = selectable.length > 0 && selectable.every(c => t.selected[c.id]);

    const others = db.sales.filter(s => s.id !== me.id);
    const avail = others.filter(s => !onLeave(s));
    const minLoad = Math.min(...avail.map(saleLoad));
    if (!t.to || !avail.some(s => s.id === t.to)) t.to = (avail.slice().sort((a, b) => saleLoad(a) - saleLoad(b))[0] || {}).id || null;
    const note = t.noteTouched ? t.note : trDraft(picked);
    const recent = db.transfers.filter(r => (r.from === me.id || r.to === me.id) && r.status !== 'da-huy').slice(0, 4);

    const custRow = (c) => {
      const locked = trLocked(c.id); const sub = trSubline(c);
      return '<label class="tr-item' + (t.selected[c.id] ? ' on' : '') + (locked ? ' locked' : '') + '">' +
        '<input type="checkbox" data-tr-pick="' + c.id + '"' + (t.selected[c.id] ? ' checked' : '') + (locked ? ' disabled' : '') + '>' +
        '<span class="tr-item-body"><strong>' + esc(c.name) + '</strong><small>' + esc(sub + (sub.includes(c.service) ? '' : ' · ' + c.service)) + '</small></span>' +
        (locked ? badge('Đang chờ chuyển', 'muted') : trBadge(c)) +
      '</label>';
    };
    const radio = (name, value, title, sub, extra) => '<label class="tr-radio"><input type="radio" name="tr-' + name + '" data-tr-field="' + name + '" value="' + value + '"' + (t[name] === value ? ' checked' : '') + '>' +
      '<span><strong>' + title + '</strong>' + (extra || '') + '<small>' + esc(sub) + '</small></span></label>';

    return tabs + '<div class="tr-layout">' +
      '<div class="sw-stack">' +
        '<section class="sw-card sw-pad">' +
          '<div class="sw-card-head"><h2>1. Chọn khách cần chuyển</h2>' +
            '<div class="tr-count"><span class="sw-muted">Đã chọn <strong>' + picked.length + '</strong> / ' + all.length + ' khách</span>' +
            '<button type="button" class="sw-btn" data-act="tr-all"' + (selectable.length ? '' : ' disabled') + '>' + (allOn ? 'Bỏ chọn' : 'Chọn tất cả') + '</button></div></div>' +
          '<div class="sw-chips tr-filters">' + [['all', 'Tất cả'], ['lich-7', 'Có lịch 7 ngày tới'], ['tu-van', 'Đang tư vấn'], ['cho-coc', 'Chờ cọc']].map(([k, l]) =>
            '<button type="button" class="sw-chip' + (t.filter === k ? ' on' : '') + '" data-act="tr-filter" data-id="' + k + '">' + l + '</button>').join('') + '</div>' +
          (shown.length ? '<div class="tr-list">' + shown.map(custRow).join('') + '</div>' : emptyState('Không có khách nào trong nhóm này.')) +
        '</section>' +
        '<section class="sw-card sw-pad">' +
          '<div class="sw-card-head"><h2>Yêu cầu gần đây</h2>' + (recent.length ? '<button type="button" class="sw-linkbtn sw-link" data-act="tr-tab" data-id="gui">Xem tất cả</button>' : '') + '</div>' +
          (recent.length ? '<div class="tr-reqs">' + recent.map(r => trRow(r, false)).join('') + '</div>' : emptyState('Chưa có yêu cầu chuyển giao nào.')) +
        '</section>' +
      '</div>' +
      '<aside class="sw-card sw-pad tr-form">' +
        '<h2>2. Chuyển cho ai và chuyển thế nào</h2>' +
        '<div class="tr-to">' + others.map(s => {
          const leave = onLeave(s); const n = saleLoad(s);
          const sub = leave ? 'Nghỉ phép ' + fmtDM(s.leave.from) + ' – ' + fmtDM(s.leave.until) : (n === minLoad ? 'Ít khách nhất · ' + n + ' khách' : 'Đang giữ ' + n + ' khách');
          return '<button type="button" class="tr-to-btn' + (t.to === s.id ? ' on' : '') + '" data-act="tr-to" data-id="' + s.id + '"' + (leave ? ' disabled' : '') + ' aria-pressed="' + (t.to === s.id) + '">' +
            '<span class="sw-avatar">' + initials(s.name) + '</span><span><strong>' + esc(s.name) + '</strong><small>' + esc(sub) + '</small></span></button>';
        }).join('') + '</div>' +
        '<small class="sw-label">Lý do</small>' +
        '<div class="sw-chips">' + TR_REASONS.map(r => '<button type="button" class="sw-chip sw-chip-outline' + (t.reason === r ? ' on-accent' : '') + '" data-act="tr-reason" data-id="' + r + '">' + r + '</button>').join('') + '</div>' +
        '<small class="sw-label">Thời hạn</small>' +
        radio('mode', 'tam-thoi', 'Tạm thời, đến hết ' + fmtDM(t.until), 'Hết hạn khách tự quay về bạn, kèm lịch sử người nhận đã làm',
          t.mode === 'tam-thoi' ? '<input type="date" class="tr-date" data-tr-field="until" value="' + esc(t.until) + '" min="' + TOMORROW + '" aria-label="Ngày kết thúc chuyển tạm thời">' : '') +
        radio('mode', 'han', 'Chuyển hẳn', 'Khách thuộc về người nhận từ nay') +
        '<small class="sw-label">Doanh số</small>' +
        radio('revenue', 'giu', 'Đơn đã cọc vẫn tính cho bạn', 'Chỉ đơn chốt mới trong thời gian chuyển tính cho người nhận') +
        radio('revenue', 'nguoi-nhan', 'Tính hết cho người nhận', 'Kể cả các đơn đã cọc trước khi chuyển') +
        '<small class="sw-label">Ghi chú bàn giao</small>' +
        '<textarea class="ci-note tr-note" data-tr-note rows="5" placeholder="Tình trạng từng khách, việc người nhận cần làm tiếp">' + esc(note) + '</textarea>' +
        '<p class="sw-note tr-info">' + icon('lock') + '<span>Chuyển kèm hội thoại, lịch, cọc, đơn và ghi chú. Người nhận và khách đều được báo.</span></p>' +
        '<p class="qb-error c-red" id="trError" hidden></p>' +
        '<button type="button" class="sw-btn sw-btn-accent sw-btn-block tr-submit" data-act="tr-submit">' + icon('send') + 'Gửi quản lý duyệt (' + picked.length + ' khách)</button>' +
      '</aside>' +
    '</div>';
  }

  function submitTransfer() {
    const t = ui.tr;
    const err = (m) => { const el = document.getElementById('trError'); el.textContent = m; el.hidden = false; };
    const list = myCustomers().filter(c => t.selected[c.id] && !trLocked(c.id));
    if (!list.length) return err('Chọn ít nhất 1 khách cần chuyển.');
    const to = db.sales.find(s => s.id === t.to);
    if (!to || to.id === me.id || onLeave(to)) return err('Chọn Sale nhận khách.');
    if (t.mode === 'tam-thoi' && (!t.until || t.until <= TODAY)) return err('Chọn ngày kết thúc chuyển tạm thời (sau hôm nay).');
    const note = (t.noteTouched ? t.note : trDraft(list)).trim();
    if (!note) return err('Viết ghi chú bàn giao để người nhận biết cần làm gì tiếp.');
    db.transfers.unshift({
      id: 'tr-' + Date.now(), from: me.id, to: to.id, customerIds: list.map(c => c.id), names: list.map(c => c.name),
      reason: t.reason, mode: t.mode, until: t.mode === 'tam-thoi' ? t.until : null, revenue: t.revenue, note,
      status: 'cho-duyet', createdAt: fmtDM(TODAY) + ' ' + hm(demoNow())
    });
    t.selected = {}; t.note = ''; t.noteTouched = false; t.tab = 'gui';
    render();
    toast('Đã gửi quản lý duyệt chuyển ' + list.length + ' khách cho ' + to.name);
  }

  // Người nhận nhận khách: chuyển owner của hồ sơ và mọi dữ liệu gắn với khách.
  function completeTransfer(r) {
    const from = saleName(r.from);
    r.customerIds.forEach(id => {
      const c = customer(id);
      if (!c || c.owner !== r.from) return;
      [db.conversations, db.deposits, db.appointments, db.orders].forEach(list => list.forEach(x => { if (x.customerId === c.id) x.owner = r.to; }));
      c.owner = r.to;
      c.tags = c.tags.filter(x => !/^(Chuyển từ|Giữ hộ)/.test(x)).concat(r.mode === 'tam-thoi' ? ['Giữ hộ ' + from + ' đến ' + fmtDM(r.until)] : ['Chuyển từ ' + from]);
      c.transfer = { from: r.from, mode: r.mode, until: r.until, revenue: r.revenue };
      if (r.note) c.note = '[Bàn giao từ ' + from + '] ' + r.note + (c.note ? '\n' + c.note : '');
    });
    r.status = 'da-chuyen';
    r.doneAt = fmtDM(TODAY) + ' ' + hm(demoNow());
  }

  // ---------- Trang: Báo cáo của tôi ----------
  function viewReport() {
    setHead('Báo cáo của tôi', 'Số liệu minh hoạ tính từ khách do ' + me.name + ' phụ trách');
    const leads = myLeads();
    const reach = STAGES.map((s, i) => [s.label, leads.filter(c => STAGES.findIndex(x => x.id === c.stage) >= i).length]);
    const max = Math.max(1, reach[0][1]);
    const closed = leads.filter(c => c.stage === 'da-chot').length;
    const pct = Math.round(me.achieved / me.target * 100);
    const dueTotal = myOrders().reduce((s, o) => s + o.due, 0);
    return '<div class="sw-kpis sw-kpis-4">' +
        '<div class="sw-card sw-kpi"><small>Doanh số tháng</small><strong>' + me.achieved + ' triệu</strong><span class="c-teal">' + pct + '% mục tiêu ' + me.target + ' triệu</span></div>' +
        '<div class="sw-card sw-kpi"><small>Tỉ lệ chốt</small><strong>' + (leads.length ? Math.round(closed / leads.length * 100) : 0) + '%</strong><span class="c-teal">' + closed + '/' + leads.length + ' lead đã chốt</span></div>' +
        '<div class="sw-card sw-kpi"><small>Phản hồi trung bình</small><strong>' + me.responseMin + ' phút</strong><span class="c-amber">Mục tiêu dưới 10 phút</span></div>' +
        '<div class="sw-card sw-kpi"><small>Công nợ cần thu</small><strong>' + million(dueTotal) + '</strong><span class="c-red">' + myOrders().filter(o => o.due > 0).length + ' đơn còn nợ</span></div>' +
      '</div>' +
      '<div class="sw-grid-2 sw-grid-even">' +
        '<section class="sw-card sw-pad"><div class="sw-card-head"><h2>Phễu khách của tôi</h2><span class="sw-muted">Số khách đã tới ít nhất bước này</span></div>' +
          '<div class="sw-bars">' + reach.map(([l, n]) => '<div class="sw-bar-row"><span>' + l + '</span><i><b style="width:' + Math.round(n / max * 100) + '%"></b></i><strong>' + n + '</strong></div>').join('') + '</div></section>' +
        '<section class="sw-card sw-pad"><div class="sw-card-head"><h2>Nguồn khách</h2></div>' +
          '<div class="sw-bars">' + SOURCES.map(s => { const n = myCustomers().filter(c => c.source === s).length; return '<div class="sw-bar-row"><span>' + s + '</span><i><b class="teal" style="width:' + Math.round(n / Math.max(1, myCustomers().length) * 100) + '%"></b></i><strong>' + n + '</strong></div>'; }).join('') + '</div></section>' +
      '</div>';
  }

  // ---------- Modal, toast, hồ sơ ----------
  function openModal(title, body) {
    document.getElementById('swModalTitle').textContent = title;
    document.getElementById('swModalBody').innerHTML = body;
    document.getElementById('swModal').hidden = false;
    const first = document.querySelector('#swModalBody input, #swModalBody textarea, #swModalBody select');
    if (first) setTimeout(() => first.focus(), 30);
  }
  function closeModal() { document.getElementById('swModal').hidden = true; }

  let toastTimer;
  function toast(msg, link) {
    const el = document.getElementById('swToast');
    el.innerHTML = esc(msg) + (link ? ' <a href="' + esc(link.href) + '" target="_blank" rel="noopener">' + esc(link.label) + '</a>' : '');
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 4200);
  }

  function showProfile(id) {
    const c = myCustomer(id);
    if (!c) return;
    openModal('Hồ sơ khách', customerPanel(c) +
      '<div class="sw-modal-actions"><button type="button" class="sw-btn sw-btn-teal" data-act="call" data-id="' + c.id + '">' + icon('phone') + 'Gọi</button>' +
      '<button type="button" class="sw-btn" data-act="msg" data-id="' + c.id + '">' + icon('chat') + 'Nhắn</button></div>');
  }

  function showCall(id, key) {
    const c = myCustomer(id);
    if (!c) return;
    openModal('Gọi ' + c.name,
      '<p class="sw-call-num">' + fullPhone(c.phone) + '</p><p class="sw-muted">' + esc(c.service + ' · ' + c.source + ' · ' + c.status.text) + '</p>' +
      '<div class="sw-modal-actions"><a class="sw-btn sw-btn-teal" href="tel:' + c.phone + '">' + icon('phone') + 'Gọi ngay</a>' +
      '<button type="button" class="sw-btn" data-act="mark-called" data-id="' + c.id + '" data-key="' + esc(key || '') + '">' + icon('check') + 'Đánh dấu đã gọi</button></div>');
  }

  function openConversationFor(id) {
    const c = myCustomer(id);
    if (!c) return;
    let v = convOf(c.id);
    if (!v) {
      v = { id: 'cv-' + Date.now(), owner: me.id, customerId: c.id, channel: 'Chat trực tiếp', time: 'Vừa xong', messages: [] };
      db.conversations.unshift(v);
    }
    ui.inbox.filter = v.done ? 'da-xong' : (v.unread ? 'chua-tra-loi' : (v.bot ? 'bot' : 'cua-toi'));
    closeModal();
    location.hash = '#hop-thu/' + v.id;
  }

  // ---------- Tìm kiếm & thông báo ----------
  function renderSearch(q) {
    const box = document.getElementById('swSearchResults');
    const f = fold(q.trim());
    if (!f) { box.hidden = true; return; }
    const digits = f.replace(/\D/g, '');
    const res = [];
    myCustomers().forEach(c => { if (fold(c.name).includes(f) || (digits.length >= 3 && c.phone.includes(digits))) res.push({ act: 'profile', id: c.id, title: c.name, sub: maskPhone(c.phone) + ' · ' + c.service }); });
    myOrders().forEach(o => { if (fold(o.code).includes(f)) res.push({ act: 'goto-order', id: o.code, title: 'Đơn #' + o.code, sub: o.customer + ' · ' + ORD_STATUS[o.status].text }); });
    myDeposits().forEach(d => { if (fold(d.code).includes(f)) res.push({ act: 'select-deposit-go', id: d.code, title: 'Cọc ' + d.code, sub: customer(d.customerId).name }); });
    box.innerHTML = res.length ? res.slice(0, 8).map(r => '<button type="button" data-act="' + r.act + '" data-id="' + esc(r.id) + '" data-code="' + esc(r.id) + '"><strong>' + esc(r.title) + '</strong><small>' + esc(r.sub) + '</small></button>').join('')
      : '<p class="sw-empty">Không có khách/đơn nào của bạn khớp. Khách của sale khác không hiện ở đây.</p>';
    box.hidden = false;
  }

  function toggleBell() {
    const p = document.getElementById('swBellPanel');
    if (!p.hidden) { p.hidden = true; return; }
    const tasks = buildTasks().slice(0, 5);
    p.innerHTML = '<strong class="sw-bell-title">Việc cần chú ý</strong>' + (tasks.length ? tasks.map(t => '<a href="#tong-quan">' + badge(t.badge, t.tone) + '<span>' + esc(t.title) + '</span></a>').join('') : emptyState('Không có thông báo mới.'));
    p.hidden = false;
  }

  // ---------- Router ----------
  const VIEWS = {
    'tong-quan': viewOverview, 'hop-thu': viewInbox, 'lich-chup': viewCalendar,
    'dat-coc': viewDeposits, 'don-anh': viewOrders, 'chuyen-giao': viewTransfer, 'khach-hang': viewCustomers, 'bao-cao': viewReport
  };
  let lastRoute = null;
  function parseHash() {
    const raw = (location.hash || '').replace(/^#/, '');
    const [route, param] = raw.split('/');
    // Đường dẫn cũ của trang Khách tiềm năng: mở Khách hàng ở chế độ Bảng giai đoạn.
    if (route === 'khach-tiem-nang') { ui.cus.mode = 'bang'; history.replaceState(null, '', '#khach-hang'); return { route: 'khach-hang', param: null }; }
    return { route: VIEWS[route] ? route : 'tong-quan', param: param ? decodeURIComponent(param) : null };
  }
  function render() {
    const { route, param } = parseHash();
    const view = document.getElementById('swView');
    const scroll = route === lastRoute ? window.scrollY : 0;
    document.body.dataset.route = route;
    view.innerHTML = VIEWS[route](param);
    if (route !== lastRoute) {
      view.classList.remove('sw-enter'); void view.offsetWidth; view.classList.add('sw-enter');
      window.scrollTo(0, 0);
    } else {
      window.scrollTo(0, scroll);
    }
    lastRoute = route;
    renderChrome(route);
    document.body.classList.remove('side-open');
    const msgs = document.getElementById('ibMsgs');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
    if (route === 'hop-thu' && ui.inbox.active) {
      const v = db.conversations.find(x => x.id === ui.inbox.active);
      if (v && v.unread && ui.inbox.mobileChat !== false) { v.unread = false; renderChrome(route); }
    }
  }
  window.addEventListener('hashchange', render);

  // ---------- Sự kiện (uỷ quyền) ----------
  document.addEventListener('click', (e) => {
    const bellWrap = e.target.closest('.sw-bell-wrap');
    if (!bellWrap) document.getElementById('swBellPanel').hidden = true;
    if (!e.target.closest('.sw-search')) document.getElementById('swSearchResults').hidden = true;
    if (e.target.id === 'swModal') return closeModal();

    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act; const id = el.dataset.id; const code = el.dataset.code; const key = el.dataset.key;

    switch (act) {
      case 'close-modal': return closeModal();
      case 'task-filter': ui.taskFilter = id; return render();
      case 'focus-search': return document.getElementById('swSearch').focus();
      case 'call': return showCall(id, key);
      case 'mark-called': {
        const c = myCustomer(id);
        if (key) ui.done[key] = true; else if (c && c.task) ui.done['cus:' + c.id] = true;
        if (c) { c.status = { text: 'Đã gọi lúc ' + hm(demoNow()), tone: 'green' }; if (c.stage === 'moi') c.stage = 'tu-van'; }
        closeModal(); render(); return toast('Đã ghi nhận cuộc gọi với ' + (c ? c.name : 'khách'));
      }
      case 'msg': return openConversationFor(id);
      case 'note': {
        const c = myCustomer(id); if (!c) return;
        return openModal('Ghi chú · ' + c.name, '<textarea class="ci-note" data-note="' + c.id + '" rows="5" placeholder="Ghi chú chỉ nhân sự studio thấy">' + esc(c.note) + '</textarea><div class="sw-modal-actions"><button type="button" class="sw-btn sw-btn-accent" data-act="close-modal">Lưu</button></div>');
      }
      case 'profile': document.getElementById('swSearchResults').hidden = true; return showProfile(id);
      case 'offer': {
        ui.done[key] = true; closeModal(); render();
        return toast('Đã gửi ưu đãi chụp mốc tiếp theo cho khách');
      }
      case 'resend-deposit': case 'resend-sms': {
        const d = myDeposits().find(x => x.code === code); if (!d) return;
        const ch = act === 'resend-sms' ? 'SMS' : d.channels.join(', ');
        if (act === 'resend-sms' && !d.channels.includes('SMS')) d.channels.push('SMS');
        d.log.unshift({ time: hm(demoNow()), who: 'sale', text: me.name + ' gửi lại link cọc qua ' + ch });
        ui.dep.fresh[d.code] = true;
        if (key) ui.done[key] = true;
        render(); return toast('Đã gửi lại link cọc ' + d.code + ' qua ' + ch);
      }
      case 'confirm-deposit': closeModal(); return confirmDeposit(code);
      case 'view-deposit': case 'select-deposit-go': ui.dep.selected = code || id; ui.dep.filter = 'all'; location.hash = '#dat-coc'; return render();
      case 'select-deposit': if (e.target.closest('button') && e.target.closest('button') !== el) return; ui.dep.selected = code; return render();
      case 'dep-filter': ui.dep.filter = id; return render();
      case 'check-short': {
        const d = myDeposits().find(x => x.code === code); if (!d) return;
        return openModal('Kiểm tra cọc ' + d.code,
          '<p>Đã nhận <strong>' + money(d.received) + '</strong>, thiếu so với số tiền cọc <strong>' + CFG.depositText + '</strong>.</p>' +
          '<p class="sw-muted">Chính sách xử lý cọc thiếu chưa được studio chốt, nên hệ thống không tự xác nhận lịch. Bạn có thể nhắc khách chuyển nốt phần còn thiếu.</p>' +
          '<div class="sw-modal-actions"><button type="button" class="sw-btn sw-btn-accent" data-act="remind-short" data-code="' + d.code + '">' + icon('send') + 'Nhắc khách chuyển nốt</button></div>');
      }
      case 'remind-short': {
        const d = myDeposits().find(x => x.code === code); if (!d) return;
        d.log.unshift({ time: hm(demoNow()), who: 'sale', text: me.name + ' nhắc khách chuyển nốt phần cọc còn thiếu' });
        ui.dep.fresh[d.code] = true; closeModal(); render(); return toast('Đã nhắc khách chuyển nốt phần cọc còn thiếu');
      }
      case 'assign-tx': {
        const tx = db.unmatched.find(t => t.id === id); if (!tx) return;
        const cands = myDeposits().filter(d => ['sent', 'opened'].includes(d.state));
        return openModal('Gán giao dịch ' + money(tx.amount),
          '<p class="sw-muted">Nội dung "' + esc(tx.content) + '" lúc ' + tx.time + '. Chỉ hiện các yêu cầu cọc do bạn phụ trách.</p>' +
          (cands.length ? '<div class="sw-pick">' + cands.map(d => '<button type="button" class="sw-btn sw-btn-block" data-act="assign-tx-to" data-id="' + tx.id + '" data-code="' + d.code + '"><strong>' + d.code + '</strong> · ' + esc(customer(d.customerId).name) + '</button>').join('') + '</div>'
            : emptyState('Bạn không có yêu cầu cọc nào đang chờ tiền. Giao dịch có thể thuộc khách của sale khác.')));
      }
      case 'assign-tx-to': {
        const tx = db.unmatched.find(t => t.id === id); const d = myDeposits().find(x => x.code === code);
        if (!tx || !d) return;
        db.unmatched = db.unmatched.filter(t => t.id !== id);
        d.state = 'paid'; d.received = tx.amount; d.paidAt = tx.time;
        d.log.unshift({ time: hm(demoNow()), who: 'sale', text: me.name + ' gán giao dịch ' + money(tx.amount) + ' lúc ' + tx.time + ' cho mã ' + d.code });
        ui.dep.selected = d.code; ui.dep.fresh[d.code] = true; closeModal(); render();
        return toast('Đã gán giao dịch cho ' + d.code + '. Bấm "Xác nhận" để chốt lịch.');
      }
      case 'remind-pick': {
        const o = myOrders().find(x => x.code === code); if (o) o.remindedAt = hm(demoNow());
        ui.done['ord:' + code] = true; render(); return toast('Đã nhắc ' + (o ? o.customer : 'khách') + ' chọn ảnh');
      }
      case 'remind-tomorrow': ui.done['tomorrow'] = true; render(); return toast('Đã gửi tin nhắc lịch cho các khách chụp ngày mai');
      case 'remind-all': {
        const list = myOrders().filter(o => o.status === 'cho-chon');
        list.forEach(o => { o.remindedAt = hm(demoNow()); ui.done['ord:' + o.code] = true; });
        render(); return toast(list.length ? 'Đã nhắc ' + list.length + ' khách chưa chọn ảnh' : 'Không có khách nào đang chờ chọn ảnh');
      }
      case 'order-action': {
        const o = myOrders().find(x => x.code === code); if (!o) return;
        if (id === 'Nhắc chọn ảnh') { o.remindedAt = hm(demoNow()); ui.done['ord:' + code] = true; }
        render(); return toast(id + ': đã gửi tới ' + o.customer);
      }
      case 'ord-filter': ui.ord.filter = id; return render();
      case 'goto-order': ui.ord.filter = 'all'; location.hash = '#don-anh'; return render();

      // Hộp thư
      case 'inbox-filter': ui.inbox.filter = id; ui.inbox.active = null; ui.inbox.mobileChat = false; return render();
      case 'open-conv': ui.inbox.active = id; ui.inbox.mobileChat = true; return render();
      case 'inbox-back': ui.inbox.mobileChat = false; if (location.hash !== '#hop-thu') location.hash = '#hop-thu'; else render(); return;
      case 'quick-reply': {
        const v = db.conversations.find(x => x.id === ui.inbox.active); const input = document.getElementById('ibInput');
        if (v && input) { input.value = quickReplyText(id, customer(v.customerId)); input.focus(); }
        return;
      }
      case 'send-quote': {
        const c = myCustomer(id); const v = convOf(id); if (!c) return;
        if (v) { v.messages.push({ from: 'sale', text: quickReplyText('Bảng giá', c), time: hm(demoNow()) }); v.unread = false; }
        if (c.stage === 'moi' || c.stage === 'tu-van') { c.stage = 'bao-gia'; c.status = { text: 'Đã gửi báo giá', tone: 'muted' }; }
        closeModal(); render(); return toast('Đã gửi báo giá gói ' + c.service + ' cho ' + c.name);
      }
      case 'callback': {
        const c = myCustomer(id); if (!c) return;
        return openModal('Hẹn gọi lại ' + c.name, '<label class="qb-field"><span>Giờ gọi lại</span><input type="time" id="cbTime" value="15:00"></label><div class="sw-modal-actions"><button type="button" class="sw-btn sw-btn-accent" data-act="callback-save" data-id="' + c.id + '">' + icon('clock') + 'Lưu lịch hẹn</button></div>');
      }
      case 'callback-save': {
        const c = myCustomer(id); const t = (document.getElementById('cbTime') || {}).value || '15:00';
        if (!c) return;
        c.status = { text: 'Hẹn gọi lại ' + t, tone: 'amber' };
        c.task = { type: 'goi-lai', badge: 'Gọi lại ' + t, tone: 'amber', desc: 'Hẹn gọi lại ' + t + ' · ' + c.service, prio: 2 };
        delete ui.done['cus:' + c.id];
        closeModal(); render(); return toast('Đã hẹn gọi lại ' + c.name + ' lúc ' + t);
      }
      case 'book-for': {
        const c = myCustomer(id); if (!c) return;
        ui.qb.phone = c.phone; ui.qb.name = '';
        if (SERVICES.includes(c.service) || c.service === 'Tại nhà') ui.qb.service = c.service;
        closeModal(); location.hash = '#lich-chup'; return;
      }
      // Chuyển khách luôn đi qua màn Chuyển giao (cần Quản lý duyệt), không chuyển thẳng.
      case 'transfer': {
        const c = myCustomer(id); if (!c) return;
        if (trLocked(c.id)) { ui.tr.tab = 'gui'; location.hash = '#chuyen-giao'; return toast(c.name + ' đang có yêu cầu chuyển giao chờ xử lý'); }
        Object.assign(ui.tr, { tab: 'tao', filter: 'all', selected: { [c.id]: true }, note: '', noteTouched: false });
        closeModal(); location.hash = '#chuyen-giao'; return;
      }
      case 'goto-transfer': ui.tr.tab = 'den'; if (location.hash === '#chuyen-giao') return render(); location.hash = '#chuyen-giao'; return;
      case 'tr-tab': ui.tr.tab = id; return render();
      case 'tr-filter': ui.tr.filter = id; return render();
      case 'tr-all': {
        const inFilter = trFilter(ui.tr.filter);
        const list = myCustomers().filter(c => inFilter(c) && !trLocked(c.id));
        const allOn = list.every(c => ui.tr.selected[c.id]);
        list.forEach(c => { if (allOn) delete ui.tr.selected[c.id]; else ui.tr.selected[c.id] = true; });
        return render();
      }
      case 'tr-to': ui.tr.to = id; return render();
      case 'tr-reason': ui.tr.reason = id; return render();
      case 'tr-submit': return submitTransfer();
      case 'tr-cancel': {
        const r = db.transfers.find(x => x.id === id && x.from === me.id && x.status === 'cho-duyet'); if (!r) return;
        r.status = 'da-huy'; render(); return toast('Đã huỷ yêu cầu chuyển ' + r.names.join(', '));
      }
      case 'tr-approve': {
        const r = db.transfers.find(x => x.id === id && x.from === me.id && x.status === 'cho-duyet'); if (!r) return;
        r.status = 'cho-nhan'; r.approvedAt = fmtDM(TODAY) + ' ' + hm(demoNow());
        render(); return toast('Quản lý đã duyệt. Chờ ' + saleName(r.to) + ' nhận khách.');
      }
      case 'tr-accept': {
        const r = db.transfers.find(x => x.id === id && x.status === 'cho-nhan' && (x.to === me.id || x.from === me.id)); if (!r) return;
        completeTransfer(r); ui.inbox.active = null; ui.inbox.mobileChat = false;
        render();
        return toast(r.to === me.id ? 'Đã nhận ' + r.names.join(', ') + ' từ ' + saleName(r.from) + '. Khách đã có trong danh sách của bạn.'
          : saleName(r.to) + ' đã nhận ' + r.names.join(', ') + '. Bạn không còn thấy hồ sơ khách này.');
      }

      // Khách hàng
      case 'cus-mode': ui.cus.mode = id; return render();
      case 'cus-group': ui.cus.group = id; return render();
      case 'cus-bday': ui.cus.bday = !ui.cus.bday; return render();
      case 'cus-select': {
        const c = myCustomer(id); if (!c) return;
        // Màn hẹp không có cột hồ sơ bên phải -> mở hồ sơ dạng modal.
        if (window.matchMedia('(max-width: 1180px)').matches) return openModal('Hồ sơ khách', cusDetail(c));
        ui.cus.selected = id; return render();
      }

      // Kanban
      case 'lead-next': {
        const c = myCustomer(id); if (!c) return;
        const i = STAGES.findIndex(s => s.id === c.stage);
        if (i >= 0 && i < STAGES.length - 1) moveLead(c.id, STAGES[i + 1].id);
        return;
      }
      case 'add-lead':
        return openModal('Thêm lead · ' + stageLabel(id),
          '<form data-form="add-lead" data-id="' + id + '">' +
            '<label class="qb-field"><span>Tên khách</span><input name="name" required placeholder="VD: Chị Minh Anh"></label>' +
            '<label class="qb-field"><span>Số điện thoại</span><input name="phone" required inputmode="tel" placeholder="09xx xxx xxx"></label>' +
            '<label class="qb-field"><span>Dịch vụ</span><select name="service">' + SERVICES.concat(['Tại nhà']).map(s => '<option>' + s + '</option>').join('') + '</select></label>' +
            '<label class="qb-field"><span>Nguồn</span><select name="source">' + SOURCES.map(s => '<option>' + s + '</option>').join('') + '</select></label>' +
            '<p class="qb-error c-red" id="addLeadErr" hidden></p>' +
            '<div class="sw-modal-actions"><button type="submit" class="sw-btn sw-btn-accent">Thêm lead</button></div></form>');

      // Lịch
      case 'ev': return showAppointment(id);
      case 'cal-mode': ui.cal.mode = id; if (id !== 'tuan' && !isInWeek(ui.cal.day)) ui.cal.day = ui.cal.weekStart; return render();
      case 'cal-today': ui.cal.weekStart = mondayOf(parseKey(TODAY)); ui.cal.day = TODAY; return render();
      case 'cal-prev': case 'cal-next': {
        const dir = act === 'cal-prev' ? -1 : 1;
        if (ui.cal.mode === 'tuan') ui.cal.weekStart = dateKey(addDays(parseKey(ui.cal.weekStart), 7 * dir));
        else { ui.cal.day = dateKey(addDays(parseKey(ui.cal.day), dir)); ui.cal.weekStart = mondayOf(parseKey(ui.cal.day)); }
        return render();
      }
      case 'qb-service': ui.qb.service = id; ui.qb.room = ''; return refreshQuickBook(true);
      case 'qb-channel': {
        const list = ui.qb.channels; const i = list.indexOf(id);
        if (i === -1) list.push(id); else list.splice(i, 1);
        return refreshQuickBook(true);
      }
      case 'qb-copy': {
        const url = new URL('../coc.html?ma=' + nextCode(), location.href).href;
        if (navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {});
        return toast('Đã sao chép link đặt cọc ' + nextCode());
      }
    }
  });

  function isInWeek(k) { const d = parseKey(k); const ws = parseKey(ui.cal.weekStart); return d >= ws && d < addDays(ws, 7); }

  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.note) { const c = myCustomer(t.dataset.note); if (c) c.note = t.value; return; }
    if (t.hasAttribute('data-tr-note')) { ui.tr.note = t.value; ui.tr.noteTouched = t.value.trim() !== ''; return; }
    if (t.dataset.qb) {
      ui.qb[t.dataset.qb] = t.value;
      if (t.dataset.qb === 'phone' || t.dataset.qb === 'name') {
        if (t.dataset.qb === 'phone') { refreshQuickBook(true); const inp = document.querySelector('[data-qb="phone"]'); inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
        else document.getElementById('qbPreview').textContent = qbMessage();
      }
      return;
    }
    if (t.id === 'swSearch') renderSearch(t.value);
  });

  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.leadFilter) { ui.lead[t.dataset.leadFilter] = t.value; return render(); }
    if (t.dataset.trPick) {
      if (t.checked) ui.tr.selected[t.dataset.trPick] = true; else delete ui.tr.selected[t.dataset.trPick];
      return render();
    }
    if (t.dataset.trField) { if (t.value) ui.tr[t.dataset.trField] = t.value; return render(); }
    if (t.dataset.qb && ['date', 'time', 'room', 'pkg'].includes(t.dataset.qb)) {
      ui.qb[t.dataset.qb] = t.value;
      if (t.dataset.qb !== 'room' && t.dataset.qb !== 'pkg') refreshQuickBook(true); else refreshQuickBook(false);
    }
  });

  document.addEventListener('submit', (e) => {
    const f = e.target;
    if (!f.dataset.form) return;
    e.preventDefault();
    if (f.dataset.form === 'quick-book') return submitQuickBook();
    if (f.dataset.form === 'send-msg') {
      const input = f.querySelector('input'); const text = input.value.trim();
      const v = db.conversations.find(x => x.id === f.dataset.id);
      if (!text || !v || v.owner !== me.id) return;
      v.messages.push({ from: 'sale', text, time: hm(demoNow()) });
      v.unread = false; v.time = 'Vừa xong';
      render();
      const inp = document.getElementById('ibInput'); if (inp) inp.focus();
      return;
    }
    if (f.dataset.form === 'add-lead') {
      const fd = new FormData(f);
      const name = String(fd.get('name') || '').trim(); const phone = String(fd.get('phone') || '').replace(/\D/g, '');
      const err = document.getElementById('addLeadErr');
      if (!name || phone.length < 9) { err.textContent = 'Nhập tên và số điện thoại hợp lệ.'; err.hidden = false; return; }
      if (db.customers.some(c => c.phone === phone)) { err.textContent = 'Số điện thoại này đã có hồ sơ trong CRM.'; err.hidden = false; return; }
      const stage = f.dataset.id;
      db.customers.push({
        id: 'new-' + Date.now(), owner: me.id, name: /^(chị|anh)\s/i.test(name) ? capital(name) : 'Chị ' + name, short: name.split(/\s+/).pop(),
        title: /^anh\s/i.test(name) ? 'anh' : 'chị', phone, area: 'Hà Nội', service: fd.get('service'), source: fd.get('source'),
        stage, since: 'Vừa tạo', status: Object.assign({}, STAGE_DEFAULT_STATUS[stage]), tags: ['Khách mới'], note: ''
      });
      closeModal(); render(); toast('Đã thêm lead ' + name);
    }
  });

  // Kéo thả thẻ lead giữa các cột
  document.addEventListener('dragstart', (e) => {
    const card = e.target.closest && e.target.closest('[data-drag]');
    if (!card) return;
    e.dataTransfer.setData('text/plain', card.dataset.drag);
    e.dataTransfer.effectAllowed = 'move';
    card.classList.add('dragging');
  });
  document.addEventListener('dragend', (e) => { const card = e.target.closest && e.target.closest('[data-drag]'); if (card) card.classList.remove('dragging'); });
  document.addEventListener('dragover', (e) => {
    const col = e.target.closest && e.target.closest('[data-drop]');
    if (!col) return;
    e.preventDefault();
    document.querySelectorAll('.kb-col.over').forEach(c => { if (c !== col) c.classList.remove('over'); });
    col.classList.add('over');
  });
  document.addEventListener('drop', (e) => {
    const col = e.target.closest && e.target.closest('[data-drop]');
    if (!col) return;
    e.preventDefault();
    col.classList.remove('over');
    moveLead(e.dataTransfer.getData('text/plain'), col.dataset.drop);
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); document.getElementById('swSearch').focus(); }
    if (e.key === 'Escape') { closeModal(); document.getElementById('swSearchResults').hidden = true; document.body.classList.remove('side-open'); }
  });

  document.getElementById('swBell').addEventListener('click', toggleBell);
  document.getElementById('swMenuBtn').addEventListener('click', () => document.body.classList.add('side-open'));
  document.getElementById('swScrim').addEventListener('click', () => document.body.classList.remove('side-open'));
  document.getElementById('swQuickBtn').addEventListener('click', () => {
    setTimeout(() => { const p = document.querySelector('[data-qb="phone"]'); if (p) { p.focus(); p.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }, 60);
  });

  render();
})();
