// ALOHA Baby — Không gian Sale (crm/sale.html).
// SPA nhỏ dùng location.hash: #tong-quan, #hop-thu, #khach-hang (Bảng giai đoạn +
// Danh sách; #khach-tiem-nang cũ tự chuyển về đây), #lich-chup, #dat-coc, #don-anh,
// #chuyen-giao, #bao-cao.
//
// Phân quyền dữ liệu (mô phỏng phía client, site tĩnh chưa có backend):
// - Sale đang đăng nhập được nhận diện qua số điện thoại trong session (js/auth.js)
//   rồi đối chiếu với ALOHA_SALE_DATA.sales.
// - Hộp thư, Khách hàng, Đặt cọc, Đơn & ảnh, Chuyển giao: hiện khách của MỌI sale
//   (người dùng đổi 2026-09-27), có bộ lọc "Sale phụ trách" dùng chung cho 5 trang,
//   mặc định "Tất cả sale". Khách của sale khác CHỈ XEM: không trả lời tin, không gọi,
//   không xác nhận cọc, không kéo phễu, không chọn để chuyển giao; SĐT vẫn che.
// - Tổng quan, Việc cần làm, số đếm trên menu, Báo cáo của tôi, Tìm kiếm: chỉ khách của mình.
// - Lịch chụp: lịch chung của studio, mọi sale thấy cả tuần; thông tin liên hệ
//   của khách chỉ hiện với sale phụ trách.
// Mọi thao tác chỉ thay đổi bản sao dữ liệu trong bộ nhớ trang (không lưu lại).
//
// Khách từ web (thêm 2026-10-15, người dùng: "chưa có data khách, nào có từ web đẩy về mới
// được"): sale-data.js không còn khách mẫu. Mỗi khách nhắn ở màn chat trên website
// (server/sale-chat.js) tự thành 1 hồ sơ "Mới" + 1 hội thoại trong Hộp thư. Tin nhắn đọc/gửi
// THẬT qua server (cùng hộp thư với mục Tin nhắn ở crm/admin.html). Sale phụ trách = sale
// trả lời khách đầu tiên (suy từ tên người gửi trên server); chưa ai trả lời thì "Chưa có sale
// nhận", sale nào cũng trả lời được và người trả lời trước nhận khách.
(function () {
  'use strict';

  const SRC = window.ALOHA_SALE_DATA;
  const db = JSON.parse(JSON.stringify(SRC));
  const CFG = db.config;
  const session = window.AlohaAuth.getSession() || {};
  const isSep = session.role === 'sep';
  const me = isSep
    ? { id: 'sep', name: session.name || 'Sếp demo', phone: session.phone || '0900000004', target: 870, achieved: 581 }
    : (db.sales.find(s => s.phone === session.phone) || {id:session.phone,name:session.name||'Sale',phone:session.phone,target:0,achieved:0});

  // Đồng hồ: dùng ngày giờ thật của máy. "Hôm nay" tự đổi khi qua nửa đêm (xem tick()).
  const demoNow = () => new Date();
  let TODAY = dateKey(new Date());
  let TOMORROW = dateKey(addDays(new Date(), 1));
  shiftDemoDates(db, Math.round((parseKey(TODAY) - parseKey(db.now.slice(0, 10))) / 864e5));
  startHolds();

  // Dữ liệu demo viết quanh ngày gốc db.now: dời mọi ngày (2026-09-25, 25/09, 25/09/2026)
  // thêm `days` ngày để lịch và các mốc luôn tính từ hôm nay thật. Chuỗi kiểu "4/15 ảnh"
  // (đếm ảnh) không bị đụng vì ngày luôn viết đủ 2 chữ số.
  function shiftDemoDates(obj, days) {
    if (!days) return;
    const baseYear = Number(db.now.slice(0, 4));
    const iso = (s) => s.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (m, y, mo, d) => dateKey(addDays(new Date(+y, mo - 1, +d), days)));
    const dm = (s) => s.replace(/\b(\d{2})\/(\d{2})(\/(\d{4}))?\b(?!\s*ảnh)/g, (m, d, mo, _, y) => {
      if (+mo < 1 || +mo > 12 || +d < 1 || +d > 31) return m;
      const x = addDays(new Date(y ? +y : baseYear, mo - 1, +d), days);
      return pad(x.getDate()) + '/' + pad(x.getMonth() + 1) + (y ? '/' + x.getFullYear() : '');
    });
    const walk = (o) => {
      Object.keys(o).forEach(k => {
        const v = o[k];
        if (typeof v === 'string') o[k] = dm(iso(v));
        else if (v && typeof v === 'object') walk(v);
      });
    };
    ['customers', 'appointments', 'deposits', 'unmatched', 'orders', 'conversations', 'transfers', 'sales'].forEach(k => walk(db[k]));
  }

  // Yêu cầu cọc đang chờ: giữ lịch tối đa CFG.holdHours (1 tiếng) kể từ lúc gửi link.
  // Dữ liệu demo cho biết còn bao nhiêu phút (holdLeftMin) -> tính lại giờ gửi / hết hạn
  // theo giờ thật, rồi thay giờ cũ trong trạng thái khách + tin nhắn cho khớp.
  function startHolds() {
    const now = Date.now(); const HOLD = CFG.holdHours * 3600e3;
    db.deposits.forEach(d => {
      if (d.state !== 'sent' && d.state !== 'opened') return;
      const oldHold = d.holdUntil;
      d.holdEnd = now + (d.holdLeftMin || 30) * 60e3;
      const sent = d.holdEnd - HOLD;
      d.sentAt = hm(new Date(sent)); d.holdUntil = hm(new Date(d.holdEnd));
      if (d.openedAt) d.openedAt = hm(new Date(sent + (now - sent) / 2));
      d.log.forEach(l => { l.time = l.who === 'sale' ? d.sentAt : d.openedAt || l.time; });
      const c = db.customers.find(x => x.id === d.customerId);
      if (c && oldHold) c.status.text = c.status.text.replace(oldHold, d.holdUntil);
      db.conversations.filter(v => v.customerId === d.customerId).forEach(v => v.messages.forEach(m => {
        if (oldHold) m.text = m.text.replace('tới ' + oldHold, 'tới ' + d.holdUntil);
      }));
    });
  }

  // Hết giờ giữ mà chưa cọc: nhả khung giờ (xoá lịch giữ chỗ khỏi lịch chung), yêu cầu cọc
  // chuyển "Hết giờ giữ", khách về trạng thái chưa cọc (rules/workflow.md: Đặt cọc bước 5).
  function expireHolds() {
    const now = Date.now(); let changed = false;
    db.deposits.forEach(d => {
      if ((d.state !== 'sent' && d.state !== 'opened') || !d.holdEnd || now < d.holdEnd) return;
      const ap = appointmentOf(d);
      d.state = 'expired';
      d.releasedSlot = ap ? fmtDM(ap.date) + ' ' + ap.start : '';
      if (ap) db.appointments = db.appointments.filter(a => a !== ap);
      d.log.unshift({ time: d.holdUntil, who: 'auto', text: 'Hết ' + CFG.holdHours + ' tiếng giữ lịch mà chưa nhận cọc, tự nhả khung giờ ' + d.releasedSlot });
      const c = customer(d.customerId);
      if (c) { c.status = { text: 'Hết giờ giữ lịch', tone: 'red' }; c.since = 'Nhả lịch ' + d.holdUntil; }
      changed = true;
    });
    return changed;
  }

  // ---------- Hằng số ----------
  // Bảng giai đoạn chỉ 3 cột (người dùng chốt 2026-10-07): khách 'bao-gia' / 'cho-coc' gộp vào
  // cột Đang tư vấn. Giá trị stage cũ vẫn giữ trong dữ liệu (dòng trạng thái thẻ, nhóm "Chờ cọc"
  // ở Danh sách, lọc Chuyển giao), chỉ bảng + phễu báo cáo quy về 3 bước qua boardStage().
  const STAGES = [
    { id: 'moi', label: 'Mới' },
    { id: 'tu-van', label: 'Đang tư vấn' },
    { id: 'da-chot', label: 'Đã chốt' }
  ];
  const boardStage = (id) => (id === 'bao-gia' || id === 'cho-coc') ? 'tu-van' : id;
  const STAGE_DEFAULT_STATUS = {
    'moi': { text: 'Chưa liên hệ', tone: 'red' },
    'tu-van': { text: 'Đang tư vấn', tone: 'amber' },
    'bao-gia': { text: 'Đã gửi báo giá', tone: 'muted' },
    'cho-coc': { text: 'Chờ đặt cọc', tone: 'amber' },
    'da-chot': { text: 'Đã chốt', tone: 'green' }
  };
  const SERVICES = ['Newborn', 'Bé lớn', 'Sinh nhật', 'Bầu', 'Gia đình'];
  // Nguồn khách (người dùng chốt 2026-10-15): 3 kênh mạng xã hội + Website. Khách nhắn từ màn chat
  // trên web tạm tính là Website cho tới khi biết khách đến từ kênh nào.
  const SOURCES = ['TikTok', 'Facebook', 'Instagram', 'Website'];
  const SVC_TONE = { 'Newborn': 'teal', 'Gia đình': 'blue', 'Bầu': 'peach', 'Sinh nhật': 'amber', 'Bé lớn': 'purple', 'Tại nhà': 'beige' };
  const CHANNELS = ['Chat web', 'Messenger', 'Zalo', 'SMS', 'Email'];
  const WEEKDAY = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
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
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
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
  function saleName(id) { if (!id) return 'Chưa có sale nhận'; const s = db.sales.find(x => x.id === id); return s ? s.name : '—'; }
  function svcTag(s) { return '<span class="sw-tag svc-tag tone-' + (SVC_TONE[s] || 'beige') + '">' + esc(s) + '</span>'; }
  // Số đếm trong nút lọc: huy hiệu tròn nhỏ, số 0 làm mờ.
  function chipNum(n) { return ' <span class="sw-chip-n' + (n ? '' : ' zero') + '">' + n + '</span>'; }
  function badge(text, tone) { return '<span class="sw-badge tone-' + (tone || 'muted') + '">' + esc(text) + '</span>'; }

  function ownerSelect() {
    return '<label class="sw-pill-select sw-owner-select">' + icon('users') + '<span>Sale phụ trách:</span><select data-owner-filter aria-label="Lọc theo sale phụ trách">' +
      '<option value="all">Tất cả sale</option>' +
      db.sales.map(s => '<option value="' + s.id + '"' + (ui.owner === s.id ? ' selected' : '') + '>' + esc(s.name) + (s.id === me.id ? ' (tôi)' : '') + '</option>').join('') +
      '</select></label>';
  }
  function readOnlyNote(ownerId) {
    if (!ownerId) return '<p class="sw-note sw-readonly">' + icon('lock') + '<span>Khách nhắn từ web, <strong>chưa có sale nhận</strong>. Trả lời khách trong Hộp thư để nhận khách về mình.</span></p>';
    return '<p class="sw-note sw-readonly">' + icon('lock') + '<span>Khách do <strong>' + esc(saleName(ownerId)) + '</strong> phụ trách · bạn chỉ xem được, mọi thao tác do sale phụ trách thực hiện.</span></p>';
  }
  function ownerTag(ownerId) {
    if (!ownerId) return '<span class="sw-tag tone-red sw-owner-tag">Chưa có sale nhận</span>';
    return ownerId === me.id ? '' : '<span class="sw-tag tone-beige sw-owner-tag">' + esc(saleName(ownerId)) + '</span>';
  }

  // ---------- Truy vấn theo quyền ----------
  const mine = (arr) => isSep ? arr : arr.filter(x => x.owner === me.id);
  const myCustomers = () => mine(db.customers);
  const myLeads = () => myCustomers().filter(c => c.stage);
  const myConversations = () => mine(db.conversations);
  const myDeposits = () => mine(db.deposits);
  const myOrders = () => mine(db.orders);
  const customer = (id) => db.customers.find(c => c.id === id);
  const myCustomer = (id) => { const c = customer(id); return c && (isSep || c.owner === me.id) ? c : null; };
  // Bộ lọc "Sale phụ trách" (ui.owner: 'all' hoặc id sale) cho 5 trang xem chung.
  const scoped = (arr) => ui.owner === 'all' ? arr : arr.filter(x => x.owner === ui.owner);
  const isMine = (x) => !!x && (isSep || x.owner === me.id);
  const stageLabel = (id) => (STAGES.find(s => s.id === boardStage(id)) || { label: 'Khách cũ' }).label;
  const convOf = (customerId) => myConversations().find(v => v.customerId === customerId);
  const appointmentOf = (dep) => db.appointments.find(a => a.id === dep.appointmentId);

  // ---------- Trạng thái giao diện ----------
  const ui = {
    taskFilter: 'all',
    owner: 'all',
    inbox: { filter: 'chua-tra-loi', active: null, mobileChat: false, info: false },
    qbOpen: false, // khung "Tạo lịch nhanh" ở Lịch chụp: chỉ hiện khi bấm nút "Tạo lịch nhanh"
    lead: { source: '', service: '', dateMode: '', dateVal: '' }, // dateMode: '' | 'ngay' | 'thang' | 'nam'
    cal: { weekStart: mondayOf(parseKey(TODAY)), mode: 'tuan', day: TODAY },
    qb: { phone: '', name: '', service: 'Newborn', date: dateKey(addDays(parseKey(TODAY), 2)), time: '16:00', room: '', pkg: '', channels: ['Chat web', 'SMS'] },
    dep: { filter: 'all', selected: null, fresh: {} },
    ord: { filter: 'all' },
    cus: { mode: 'bang' },
    tr: { tab: 'tao', step: 1, filter: 'all', selected: {}, to: null, reason: 'Nghỉ phép', mode: 'tam-thoi', until: endOfMonth(TODAY), revenue: 'giu', note: '', noteTouched: false },
    done: {} // task key -> true
  };

  function endOfMonth(k) { const d = parseKey(k); return dateKey(new Date(d.getFullYear(), d.getMonth() + 1, 0)); }

  function mondayOf(d) { const x = new Date(d); const wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); return dateKey(x); }

  // ---------- Việc cần làm (suy ra từ dữ liệu, không nhập tay) ----------
  function buildTasks() {
    const tasks = [];
    // Khách nhắn từ web chưa sale nào trả lời: mọi sale đều thấy để nhận khách.
    db.conversations.filter(v => v.live && !v.owner).forEach(v => {
      const c = customer(v.customerId); if (!c) return;
      tasks.push({
        key: 'web:' + v.id, kind: 'goi-lai', prio: 0, badge: 'Chưa có sale nhận', tone: 'amber',
        title: c.name + ' · nhắn từ web ' + v.time.toLowerCase() + (/^\d/.test(v.time) && !v.time.includes('/') ? ' trước' : ''),
        desc: (v.messages[v.messages.length - 1] || { text: '' }).text.slice(0, 90), customerId: c.id,
        actions: [{ act: 'view-conv', label: 'Trả lời', icon: 'chat', style: 'accent' }]
      });
    });
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
          actions: [{ act: 'confirm-deposit', label: 'Xác nhận', icon: 'check', style: 'sky' }, { act: 'view-deposit', label: 'Xem' }]
        });
      } else if (d.state === 'expired') {
        tasks.push({
          key: 'dep:' + d.code, kind: 'coc', prio: 4, badge: 'Hết giờ giữ lịch', tone: 'red',
          title: c.name + ' · ' + d.code, mTitle: c.name,
          desc: 'Quá ' + CFG.holdHours + ' tiếng chưa cọc, đã nhả khung ' + d.releasedSlot, mDesc: 'Đã nhả khung ' + d.releasedSlot,
          customerId: c.id, code: d.code,
          actions: [{ act: 'call', label: 'Gọi', icon: 'phone', style: 'teal' }, { act: 'book-for', label: 'Giữ lịch lại', icon: 'calendar' }]
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
  function unreadCount() { return db.conversations.filter(v => (v.owner === me.id || !v.owner) && v.unread && !v.done).length; }
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
      '<small>Còn ' + Math.round((parseKey(endOfMonth(TODAY)) - parseKey(TODAY)) / 864e5) + ' ngày · cần thêm ' + Math.max(0, me.target - me.achieved) + ' triệu</small>';
    if (isSep) {
      document.getElementById('swMeName').textContent = me.name;
      document.getElementById('swMeAvatar').textContent = 'S';
      const roleSub = document.querySelector('.sw-me-text small');
      if (roleSub) roleSub.textContent = 'Ban Quản lý · Toàn studio';
      const backBtn = document.getElementById('swBackAdmin');
      if (backBtn) backBtn.style.display = 'inline-flex';
    } else {
      document.getElementById('swMeName').textContent = me.name;
      document.getElementById('swMeAvatar').textContent = initials(me.name);
    }
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
    setHead('Tổng quan', WEEKDAY[d.getDay()] + ', ' + fmtDMY(TODAY));

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
      '<button type="button" class="sw-chip' + (ui.taskFilter === k ? ' on' : '') + '" data-act="task-filter" data-id="' + k + '">' + l + chipNum(counts[k]) + '</button>').join('');

    const srcCounts = SOURCES.map(s => [s, myCustomers().filter(c => c.source === s).length]);
    const srcMax = Math.max(1, ...srcCounts.map(x => x[1]));

    const mobileTasks = tasks.filter(t => t.customerId && myCustomer(t.customerId));

    return '' +
      // Bản mobile (trang 6 thiết kế): tiêu đề lớn, 3 chỉ số, danh sách "Làm ngay"
      '<section class="m-today">' +
        '<div class="m-today-head"><div><small>' + WEEKDAY[d.getDay()] + ', ' + fmtDM(TODAY) + '</small><h2>Hôm nay</h2></div>' +
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
      'da-chup': { text: 'Đã chụp', tone: 'teal' },
      'da-coc': { text: 'Đã cọc', tone: 'blue' },
      'chua-thu-du': { text: 'Chưa thu đủ', tone: 'amber' },
      'giu-cho': { text: 'Giữ chỗ, chưa cọc', tone: 'red' }
    }[a.status] || { text: a.status, tone: 'muted' };
  }

  // ---------- Trang: Hộp thư ----------
  function viewInbox(param) {
    const convs = scoped(db.conversations);
    const filters = {
      'chua-tra-loi': v => v.unread && !v.done,
      // Bỏ nhóm "Đã xong" (người dùng yêu cầu 2026-09-27): hội thoại đã xong vẫn nằm trong 2 nhóm dưới.
      'cua-toi': v => !v.bot,
      'bot': v => v.bot
    };
    if (!filters[ui.inbox.filter]) ui.inbox.filter = 'chua-tra-loi';
    if (param && convs.some(v => v.id === param)) { ui.inbox.active = param; ui.inbox.mobileChat = true; }
    const list = convs.filter(filters[ui.inbox.filter]);
    if (!ui.inbox.active || !convs.some(v => v.id === ui.inbox.active)) ui.inbox.active = (list[0] || convs[0] || {}).id || null;
    const active = convs.find(v => v.id === ui.inbox.active);
    const chip = (k, l) => {
      const n = convs.filter(filters[k]).length;
      return '<button type="button" class="sw-chip' + (ui.inbox.filter === k ? ' on' : '') + '" data-act="inbox-filter" data-id="' + k + '">' + l + (k === 'chua-tra-loi' ? chipNum(n) : '') + '</button>';
    };

    const listHtml = list.length ? list.map(v => {
      const c = customer(v.customerId);
      const last = v.messages[v.messages.length - 1] || { text: '' };
      return '<button type="button" class="ib-item' + (v.id === ui.inbox.active ? ' on' : '') + (v.unread ? ' unread' : '') + '" data-act="open-conv" data-id="' + v.id + '">' +
        '<span class="sw-avatar">' + initials(c.name) + '</span>' +
        '<span class="ib-item-body"><span class="ib-item-top"><strong>' + esc(c.name) + '</strong><small>' + esc(v.time) + '</small></span>' +
        '<span class="ib-preview">' + esc(last.text) + '</span>' +
        ((v.bot || v.owner !== me.id) ? '<span class="ib-item-tags">' + (v.bot ? '<span class="sw-tag tone-peach">' + esc(v.channel) + '</span>' : '') + ownerTag(v.owner) + '</span>' : '') + '</span></button>';
    }).join('') : emptyState(db.conversations.length ? 'Không có hội thoại nào trong nhóm này.' : 'Chưa có khách nào nhắn. Khi khách bấm ảnh dịch vụ hoặc nút chat trên website và gửi tin, hội thoại sẽ tự hiện ở đây.');

    return '<div class="ib' + (ui.inbox.mobileChat ? ' show-chat' : '') + (active && ui.inbox.info ? ' show-info' : '') + '">' +
      '<section class="ib-list">' +
        '<div class="ib-list-head"><h1>Hộp thư</h1>' +
        liveNote() + '<div class="sw-chips">' + chip('chua-tra-loi', 'Chưa trả lời') + chip('cua-toi', 'Đang trao đổi') + chip('bot', 'Bot đã chuyển') + '</div>' + ownerSelect() + '</div>' +
        '<div class="ib-items">' + listHtml + '</div>' +
      '</section>' +
      (active ? chatPane(active) + (ui.inbox.info ? '<aside class="ib-info">' + customerPanel(customer(active.customerId)) + '</aside>' : '')
        : '<section class="ib-chat">' + emptyState('Chọn một hội thoại để bắt đầu.') + '</section>') +
      '</div>';
  }

  function chatPane(v) {
    const c = customer(v.customerId);
    const own = isMine(v) || (v.live && !v.owner);
    const quick = [SERVICES.includes(c.service) ? 'Bảng giá ' + c.service : 'Bảng giá', 'Concept đang được chọn nhiều', 'Khung giờ còn trống', 'Hướng dẫn đặt cọc', 'Lưu ý chuẩn bị cho bé'];
    return '<section class="ib-chat">' +
      '<header class="ib-chat-head">' +
        '<button type="button" class="sw-icon-btn ib-back" data-act="inbox-back" aria-label="Quay lại danh sách">' + icon('back') + '</button>' +
        '<div><strong>' + esc(c.name) + '</strong><small>Qua ' + esc(v.channel) + (v.online ? ' · đang online' : '') + (v.live && !v.owner ? ' · chưa có sale nhận' : '') + '</small></div>' +
        '<div class="ib-chat-actions">' +
          (own ? '<button type="button" class="sw-btn sw-btn-teal" data-act="call" data-id="' + c.id + '">' + icon('phone') + 'Gọi</button>' : '') +
          (isMine(v) ? '<button type="button" class="sw-btn" data-act="transfer" data-id="' + c.id + '">Chuyển người khác</button>' : '') +
          '<button type="button" class="sw-icon-btn sw-card-btn ib-info-btn' + (ui.inbox.info ? ' on' : '') + '" data-act="ib-info" data-id="' + c.id + '" title="Hồ sơ khách" aria-label="Hồ sơ khách" aria-pressed="' + ui.inbox.info + '">' + icon('menu') + '</button>' +
        '</div>' +
      '</header>' +
      '<div class="ib-msgs" id="ibMsgs">' +
        (v.bot && v.botSummary ? '<div class="ib-bot">' + icon('bot') + '<div><strong>Trợ lý ALOHA đã hỏi sẵn và chuyển cho bạn</strong><span>' + esc(v.botSummary) + '</span></div></div>' : '') +
        v.messages.map(m => '<div class="ib-msg ' + (m.from === 'sale' ? 'out' : 'in') + '"><p>' + esc(m.text) + '</p><small>' + esc(m.time) + (m.from === 'sale' ? ' · ' + esc(m.by || saleName(v.owner)) : '') + '</small></div>').join('') +
      '</div>' +
      (own ? '<div class="ib-compose">' +
        '<div class="ib-quick">' + quick.map(q => '<button type="button" class="sw-chip sw-chip-outline" data-act="quick-reply" data-id="' + esc(q) + '">' + esc(q) + '</button>').join('') + '</div>' +
        '<form class="ib-form" data-form="send-msg" data-id="' + v.id + '">' +
          '<input id="ibInput" type="text" placeholder="Nhập tin nhắn, gõ / để chèn mẫu trả lời" autocomplete="off">' +
          '<button type="submit" class="sw-btn sw-btn-accent">' + icon('send') + 'Gửi</button>' +
        '</form>' +
      '</div>' : '<div class="ib-compose">' + readOnlyNote(v.owner) + '</div>') +
    '</section>';
  }

  function quickReplyText(label, c) {
    const who = c.title + ' ' + c.short;
    if (label.startsWith('Bảng giá') && !SERVICES.includes(c.service)) return 'Dạ ' + who + ' đang quan tâm dịch vụ nào ạ (Newborn, Bé lớn, Sinh nhật, Bầu, Gia đình)? Em gửi bảng giá đúng gói cho mình nhé.';
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

  // Concept khách quan tâm: lấy từ field concept (nếu có) hoặc phần "Quan tâm:" trợ lý web hỏi sẵn; không có thì "Chưa chọn".
  function conceptOf(c) {
    if (c.concept) return c.concept;
    const v = db.conversations.find(x => x.customerId === c.id && x.botSummary);
    const m = v && /Quan tâm:\s*([^·]+)/.exec(v.botSummary);
    return m ? capital(m[1].trim().replace(/^concept\s+/i, '')) : 'Chưa chọn';
  }
  function customerPanel(c) {
    const own = isMine(c);
    return '<div class="ci">' +
      '<h2 class="ci-title">Thông tin khách hàng</h2>' +
      '<dl class="sw-dl ci-dl">' +
        '<dt>Tên:</dt><dd>' + esc(c.name) + '</dd>' +
        '<dt>SĐT:</dt><dd>' + (own ? fullPhone(c.phone) : maskPhone(c.phone)) + '</dd>' +
        '<dt>Địa chỉ:</dt><dd>' + esc(c.area || 'Chưa có') + '</dd>' +
        '<dt>Concept:</dt><dd>' + esc(conceptOf(c)) + '</dd>' +
      '</dl>' +
      '<div class="ci-tags">' + c.tags.map(t => '<span class="sw-tag tone-peach">' + esc(t) + '</span>').join('') + svcTag(c.service) + '</div>' +
      babyBlock(c) +
      (own ? '<button type="button" class="sw-btn sw-btn-accent sw-btn-block" data-act="book-for" data-id="' + c.id + '">' + icon('calendar') + 'Tạo lịch và gửi link cọc</button>' +
      '<button type="button" class="sw-btn sw-btn-block" data-act="send-quote" data-id="' + c.id + '">' + icon('send') + 'Gửi báo giá gói ' + esc(c.service) + '</button>' +
      '<button type="button" class="sw-btn sw-btn-block" data-act="callback" data-id="' + c.id + '">' + icon('clock') + 'Hẹn gọi lại</button>' : readOnlyNote(c.owner)) +
      '<small class="sw-label">Ghi chú nội bộ</small>' +
      noteBox(c) +
      '<p class="sw-muted ci-owner">Phụ trách: <strong>' + esc(saleName(c.owner)) + '</strong></p>' +
    '</div>';
  }

  function noteBox(c) {
    return '<textarea class="ci-note" data-note="' + c.id + '" rows="3" placeholder="Ghi chú chỉ nhân sự studio thấy"' + (isMine(c) ? '' : ' readonly') + '>' + esc(c.note) + '</textarea>';
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
    const linked=AlohaWorkflow.get() && AlohaWorkflow.get().orders.filter(o=>o.phone===c.phone);
    if(linked && linked.length)return linked.filter(o=>o.shotAt).length;
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
    if (dep && dep.state === 'expired') return { text: 'Hết giờ giữ, giữ lịch lại', tone: 'red' };
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
      (isMine(c) ? '<div class="cu-actions">' +
        '<button type="button" class="sw-btn sw-btn-teal" data-act="call" data-id="' + c.id + '">' + icon('phone') + 'Gọi</button>' +
        '<button type="button" class="sw-btn" data-act="msg" data-id="' + c.id + '">' + icon('chat') + 'Nhắn</button>' +
        '<button type="button" class="sw-btn sw-btn-accent" data-act="book-for" data-id="' + c.id + '">' + icon('calendar') + 'Tạo lịch</button>' +
      '</div>' : readOnlyNote(c.owner)) +
      '<div class="sw-soft"><small class="sw-label">Các bé</small>' +
        (b ? '<div class="cu-baby"><strong>' + esc(b.name || 'Bé') + '</strong><span class="sw-muted">' +
            (b.kind === 'due' ? 'dự sinh ' + fmtDMY(b.date) : 'sinh ' + fmtDMY(b.date) + ' · ' + ageText(b.date)) + '</span></div>' +
          (m && !offerDone && isMine(c) ? '<div class="cu-offer">' + icon('gift') + '<span>Bé sắp ' + m.label + ' (' + fmtDM(m.key) + '). Gợi ý gói ' + (m.birthday ? 'Sinh nhật' : 'chụp 100 ngày') + '.</span>' +
            '<button type="button" class="sw-btn" data-act="offer" data-key="cus:' + c.id + '">Gửi ưu đãi</button></div>' : '')
          : '<p class="sw-muted">Chưa có thông tin bé</p>') +
      '</div>' +
      '<div class="cu-stats"><div><strong>' + shootCount(c) + '</strong><small>Đơn đã chụp</small></div>' +
        '<div><strong>[Tổng]</strong><small>Tổng đã chi</small></div>' +
        '<div><strong>' + (c.referrals || 0) + '</strong><small>Khách giới thiệu</small></div></div>' +
      '<small class="sw-label">Lịch sử với studio</small>' +
      '<ol class="dp-log cu-hist">' + cusHistory(c).map(h => '<li class="' + (h.shoot ? '' : 'sale') + '"><div><time>' + esc(h.date) + '</time></div><p>' + esc(h.text) + '</p></li>').join('') + '</ol>' +
      '<small class="sw-label">Ghi chú</small>' +
      noteBox(c) +
    '</div>';
  }

  function viewCustomers() {
    const f = ui.cus; const lf = ui.lead;
    const board = f.mode === 'bang';
    const all = scoped(db.customers);
    const leads = all.filter(c => c.stage);
    setHead('Khách hàng', '');
    const sel = (name, label, opts, val) => '<label class="sw-pill-select">' + icon('filter') + '<span>' + label + ':</span><select data-lead-filter="' + name + '"><option value="">Tất cả</option>' +
      opts.map(o => '<option' + (o === val ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select></label>';
    const seg = '<div class="cu-seg" role="tablist" aria-label="Kiểu xem">' + [['bang', 'Bảng giai đoạn', 'filter'], ['danh-sach', 'Danh sách', 'users']].map(([k, l, ic]) =>
      '<button type="button" role="tab" aria-selected="' + (f.mode === k) + '" class="' + (f.mode === k ? 'on' : '') + '" data-act="cus-mode" data-id="' + k + '">' + icon(ic) + l + '</button>').join('') + '</div>';
    const toolbar = '<div class="kb-toolbar">' + seg + ownerSelect() +
      sel('source', 'Nguồn', SOURCES, lf.source) + sel('service', 'Dịch vụ', SERVICES.concat(['Tại nhà']), lf.service) + dateFilterHtml() +
      (board
        ? ''
        : '<button type="button" class="sw-btn cu-add" data-act="add-lead" data-id="moi">' + icon('userPlus') + 'Thêm khách</button>') +
    '</div>';
    const bySrcSvc = (c) => (!lf.source || c.source === lf.source) && (!lf.service || c.service === lf.service) && matchDate(c);
    return toolbar + (board ? customerBoard(leads.filter(bySrcSvc)) : customerList(all.filter(bySrcSvc)));
  }

  // Ngày gần nhất của khách, suy ra từ dòng thời gian trên thẻ (c.since: "2 giờ trước", "Hôm qua",
  // "3 ngày", "2 tuần trước", "Chụp 25/09", "Giữ 02/10 09:00"...). Không suy ra được thì null.
  function cusDate(c) {
    const s = String(c.since || '');
    const today = parseKey(TODAY);
    if (/phút|giờ trước|hôm nay|^vừa|^nhả lịch|^cọc/i.test(s)) return TODAY;
    if (/hôm qua/i.test(s)) return dateKey(addDays(today, -1));
    let m = /^(\d+)\s*ngày/i.exec(s); if (m) return dateKey(addDays(today, -m[1]));
    m = /^(\d+)\s*tuần/i.exec(s); if (m) return dateKey(addDays(today, -7 * m[1]));
    m = /(\d{2})\/(\d{2})(?:\/(\d{4}))?/.exec(s);
    if (m) {
      if (m[3]) return m[3] + '-' + m[2] + '-' + m[1];
      // Không ghi năm: chọn năm gần hôm nay nhất (vd 28/12 xem vào tháng 1 là năm trước).
      const y = today.getFullYear();
      const best = [y - 1, y, y + 1].map(n => new Date(n, m[2] - 1, +m[1])).sort((a, b) => Math.abs(a - today) - Math.abs(b - today))[0];
      return dateKey(best);
    }
    return null;
  }
  function matchDate(c) {
    const { dateMode: mode, dateVal: val } = ui.lead;
    if (!mode || !val) return true;
    const k = cusDate(c);
    if (!k) return false;
    return mode === 'ngay' ? k === val : mode === 'thang' ? k.slice(0, 7) === val : k.slice(0, 4) === val;
  }
  function dateFilterHtml() {
    const { dateMode: mode, dateVal: val } = ui.lead;
    const y = parseKey(TODAY).getFullYear();
    const modeSel = '<select data-lead-filter="dateMode" aria-label="Lọc theo thời gian">' +
      [['', 'Mọi lúc'], ['ngay', 'Ngày'], ['thang', 'Tháng'], ['nam', 'Năm']].map(([k, l]) => '<option value="' + k + '"' + (mode === k ? ' selected' : '') + '>' + l + '</option>').join('') + '</select>';
    const pick = mode === 'ngay' ? '<input type="date" class="cu-date" data-lead-filter="dateVal" value="' + esc(val) + '" aria-label="Chọn ngày">'
      : mode === 'thang' ? '<input type="month" class="cu-date" data-lead-filter="dateVal" value="' + esc(val) + '" aria-label="Chọn tháng">'
      : mode === 'nam' ? '<select data-lead-filter="dateVal" aria-label="Chọn năm">' + [y - 2, y - 1, y].map(n => '<option' + (String(n) === val ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>'
      : '';
    return '<label class="sw-pill-select cu-date-filter">' + icon('calendar') + '<span>Thời gian:</span>' + modeSel + pick + '</label>';
  }

  // Danh sách dạng bảng tính (người dùng yêu cầu 2026-10-07): tràn ngang, mỗi khách 1 dòng,
  // nút mắt cuối dòng mở hồ sơ dạng modal (thay cột hồ sơ bên phải). Đã bỏ lọc "Có bé sắp sinh nhật"
  // và cột Bé. Không có nút lọc nhóm riêng: danh sách hiện mọi khách, lọc bằng thanh lọc phía trên
  // (Sale phụ trách, Nguồn, Dịch vụ, Thời gian).
  function customerList(shown) {
    const sub = (c) => {
      const g = cusGroup(c);
      if (g === 'tiem-nang') return stageLabel(c.stage);
      if (g === 'khach-quen') return shootCount(c) + ' đơn';
      if (g === 'khong-mua') return c.lost.reason;
      return '';
    };
    return '<section class="sw-card sw-pad">' +
        '<div class="sw-table-wrap"><table class="sw-table cu-table cu-sheet">' +
          '<thead><tr><th>#</th><th>Khách hàng</th><th>SĐT</th><th>Nguồn</th><th>Dịch vụ</th><th>Giai đoạn</th><th>Phụ trách</th><th>Việc tiếp theo</th><th><span class="sr-only">Xem</span></th></tr></thead><tbody>' +
          (shown.length ? shown.map((c, i) => {
            const g = groupOf(c); const n = nextStep(c); const st = sub(c);
            return '<tr class="cu-row" data-id="' + c.id + '">' +
              '<td class="cu-num">' + (i + 1) + '</td>' +
              '<td><strong>' + esc(c.name) + '</strong><small class="sw-muted sw-block">' + esc(c.since) + '</small></td>' +
              '<td class="cu-nowrap">' + maskPhone(c.phone) + '</td>' +
              '<td>' + esc(c.source) + '</td>' +
              '<td>' + (c.service ? svcTag(c.service) : '<span class="sw-muted">—</span>') + '</td>' +
              '<td>' + badge(g.label, g.tone) + (st ? '<small class="sw-muted sw-block">' + esc(st) + '</small>' : '') + '</td>' +
              '<td class="cu-nowrap">' + esc(saleName(c.owner)) + (c.owner === me.id ? ' <span class="sw-muted">(tôi)</span>' : '') + '</td>' +
              '<td><strong class="cu-next' + (n.tone ? ' c-' + n.tone : '') + '">' + esc(n.text) + '</strong></td>' +
              '<td class="cu-eye"><button type="button" class="sw-eye-btn" data-act="cus-select" data-id="' + c.id + '" title="Xem hồ sơ khách" aria-label="Xem hồ sơ ' + esc(c.name) + '">' + icon('eye') + '</button></td></tr>';
          }).join('') : '<tr><td colspan="9">' + emptyState('Không có khách nào trong nhóm này.') + '</td></tr>') +
        '</tbody></table></div>' +
      '</section>';
  }

  function customerBoard(shown) {
    return '<div class="kb">' + STAGES.map((s, i) => {
        const cards = shown.filter(c => boardStage(c.stage) === s.id);
        return '<section class="kb-col kb-col-' + s.id + '" data-drop="' + s.id + '">' +
          '<header><h3>' + s.label + '</h3><span>' + cards.length + '</span></header>' +
          cards.map(c => leadCard(c, i)).join('') +
          '<button type="button" class="kb-add" data-act="add-lead" data-id="' + s.id + '">+ Thêm</button>' +
        '</section>';
      }).join('') + '</div>';
  }

  function leadCard(c, stageIdx) {
    if (!isMine(c)) {
      return '<article class="sw-card kb-card kb-card-ro">' +
        '<div class="kb-card-top"><strong>' + esc(c.name) + '</strong>' + svcTag(c.service) + '</div>' +
        '<small class="sw-muted">' + esc(c.source) + ' · ' + esc(c.since) + '</small>' +
        '<p class="kb-status c-' + c.status.tone + '">' + icon('clock') + esc(c.status.text) + '</p>' +
        '<p class="kb-owner" title="Khách của ' + esc(saleName(c.owner)) + ', bạn chỉ xem">' + icon('lock') + esc(saleName(c.owner)) + '</p></article>';
    }
    return '<article class="sw-card kb-card" draggable="true" data-drag="' + c.id + '">' +
      '<div class="kb-card-top"><strong>' + esc(c.name) + '</strong>' + svcTag(c.service) + '</div>' +
      '<small class="sw-muted">' + esc(c.source) + ' · ' + esc(c.since) + '</small>' +
      '<p class="kb-status c-' + c.status.tone + '">' + icon('clock') + esc(c.status.text) + '</p>' +
      '<div class="kb-actions">' +
        '<button type="button" class="sw-icon-btn kb-ic" data-act="call" data-id="' + c.id + '" title="Gọi" aria-label="Gọi ' + esc(c.name) + '">' + icon('phone') + '</button>' +
        '<button type="button" class="sw-icon-btn kb-ic" data-act="msg" data-id="' + c.id + '" title="Nhắn tin" aria-label="Nhắn tin ' + esc(c.name) + '">' + icon('chat') + '</button>' +
        (stageIdx < STAGES.length - 1 ? '<button type="button" class="sw-icon-btn kb-next" data-act="lead-next" data-id="' + c.id + '" title="Chuyển sang: ' + STAGES[stageIdx + 1].label + '" aria-label="Chuyển sang bước kế tiếp">' + icon('arrow') + '</button>' : '') +
      '</div></article>';
  }

  function moveLead(id, stage) {
    const c = myCustomer(id);
    if (!c || boardStage(c.stage) === stage) return;
    c.stage = stage;
    c.status = Object.assign({}, STAGE_DEFAULT_STATUS[stage]);
    c.since = 'Vừa cập nhật';
    toast('Đã chuyển ' + c.name + ' sang "' + stageLabel(stage) + '"');
    render();
  }

  // ---------- Trang: Lịch chụp ----------
  // Màu thẻ lịch chỉ theo 1 tiêu chí: trạng thái lịch hẹn (cùng tông với badge apStatus).
  // Dịch vụ (Newborn) và nơi chụp (tại nhà) ghi bằng chữ trên thẻ, không tô màu riêng (2026-10-07).
  function apKind(a) {
    return { 'giu-cho': 'hold', 'chua-thu-du': 'due', 'checkin': 'checkin' }[a.status] || 'paid';
  }

  function viewCalendar() {
    const cal = ui.cal;
    const ws = parseKey(cal.weekStart);
    const we = addDays(ws, 6);
    setHead('Lịch chụp', '');

    let cols;
    if (cal.mode === 'tuan') {
      cols = Array.from({ length: 7 }, (_, i) => { const k = dateKey(addDays(ws, i)); return { key: k, date: k, head: WEEKDAY[parseKey(k).getDay()], sub: fmtDM(k), today: k === TODAY }; });
    } else if (cal.mode === 'ngay') {
      cols = [{ key: cal.day, date: cal.day, head: weekdayOf(cal.day), sub: fmtDMY(cal.day), today: cal.day === TODAY }];
    } else {
      cols = db.rooms.map(r => ({ key: r.id, date: cal.day, room: r.id, head: r.id === 'Ngoài' ? 'Tại nhà' : r.label + (r.warm ? ' (ấm)' : '') }));
    }
    // Nút về hiện tại: chữ theo chế độ xem ("Tuần này" / "Hôm nay"), mờ đi khi đang xem đúng lúc này.
    const atNow = cal.mode === 'tuan' ? cal.weekStart === mondayOf(parseKey(TODAY)) : cal.day === TODAY;
    const todayBtn = '<button type="button" class="sw-btn cal-now' + (atNow ? ' at-now' : '') + '" data-act="cal-today"' + (atNow ? ' aria-disabled="true" title="Đang xem ' + (cal.mode === 'tuan' ? 'tuần này' : 'hôm nay') + '"' : '') + '>' +
      (cal.mode === 'tuan' ? (atNow ? 'Tuần này' : 'Về tuần này') : (atNow ? 'Hôm nay' : 'Về hôm nay')) + '</button>';
    const rangeLabel = cal.mode === 'tuan'
      ? fmtDM(dateKey(ws)) + ' – ' + fmtDMY(dateKey(we))
      : weekdayOf(cal.day) + ', ' + fmtDMY(cal.day);

    const hours = [];
    for (let h = DAY_START; h <= DAY_END; h++) hours.push(h);
    const bodyH = (DAY_END - DAY_START) * HOUR_PX;

    const colHtml = cols.map(col => {
      const evs = db.appointments.filter(a => a.date === col.date && (!col.room || a.room === col.room));
      return '<div class="cal-col' + (col.today ? ' today' : '') + '" style="height:' + bodyH + 'px">' + layoutEvents(evs).map(evHtml).join('') + '</div>';
    }).join('');

    const legend = '<b>Trạng thái:</b>' + [['hold', 'Giữ chỗ, chưa cọc'], ['due', 'Chưa thu đủ'], ['paid', 'Đã cọc'], ['checkin', 'Đã check-in']]
      .map(([k, l]) => '<span><i class="lg-' + k + '"></i>' + l + '</span>').join('') + '<span class="lg-sep"><i class="lg-mine"></i>Khách của tôi</span>';

    return '<div class="cal-layout' + (ui.qbOpen ? '' : ' qb-closed') + '">' +
      '<section class="sw-card cal-card">' +
        '<div class="cal-toolbar">' +
          '<button type="button" class="sw-icon-btn sw-card-btn" data-act="cal-prev" aria-label="Trước">' + icon('back') + '</button>' +
          todayBtn +
          '<button type="button" class="sw-icon-btn sw-card-btn" data-act="cal-next" aria-label="Sau">' + icon('next') + '</button>' +
          '<strong class="cal-range">' + rangeLabel + '</strong>' +
          '<div class="sw-chips cal-modes">' + [['tuan', 'Tuần'], ['ngay', 'Ngày'], ['phong', 'Theo phòng']].map(([k, l]) =>
            '<button type="button" class="sw-chip' + (cal.mode === k ? ' on' : '') + '" data-act="cal-mode" data-id="' + k + '">' + l + '</button>').join('') + '</div>' +
        '</div>' +
        '<div class="cal-legend">' + legend + '</div>' +
        '<div class="cal-scroll"><div class="cal-grid" style="--cols:' + cols.length + '">' +
          '<div class="cal-corner"></div>' +
          cols.map(c => '<div class="cal-head' + (c.today ? ' today' : '') + '"><span>' + esc(c.head) + '</span>' + (c.sub ? '<small>' + esc(c.sub) + '</small>' : '') + '</div>').join('') +
          '<div class="cal-times" style="height:' + bodyH + 'px">' + hours.map(h => '<span style="top:' + ((h - DAY_START) * HOUR_PX) + 'px">' + pad(h) + ':00</span>').join('') + '</div>' +
          colHtml +
        '</div></div>' +
      '</section>' +
      (ui.qbOpen ? '<aside class="sw-card qb" id="qbPanel">' + quickBookForm() + '</aside>' : '') +
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
      '<strong>' + esc(title) + '</strong><small>' + a.start + ' · ' + (a.room === 'Ngoài' ? 'Tại nhà' : esc(a.room) + (a.service === 'Newborn' ? ' · phòng ấm' : '')) + '</small></button>';
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
    // Mọi sale xem được liên hệ, cọc và tin nhắn của lịch (người dùng đổi 2026-09-27);
    // chỉ sale phụ trách mới nhắn, gọi, xác nhận cọc.
    if (c) rows.push(['Liên hệ', fullPhone(c.phone) + (c.area ? ' · ' + c.area : '')]);
    const dep = db.deposits.find(d => d.appointmentId === a.id || (a.depositCode && d.code === a.depositCode));
    if (dep) rows.push(['Đặt cọc', dep.code + ' · ' + depStateText(dep)]);
    const conv = c && db.conversations.find(v => v.customerId === c.id);
    const msgs = conv ? conv.messages.slice(-4) : [];
    openModal(a.service + ' · ' + a.label,
      '<dl class="sw-dl">' + rows.map(r => '<dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd>').join('') + '</dl>' +
      (c ? '<small class="sw-label ap-msgs-label">Tin nhắn gần đây' + (conv ? ' · qua ' + esc(conv.channel) : '') + '</small>' +
        '<div class="ap-msgs">' + (msgs.length ? msgs.map(m => '<div class="ib-msg ' + (m.from === 'sale' ? 'out' : 'in') + '"><p>' + esc(m.text) + '</p><small>' + esc(m.time) + (m.from === 'sale' ? ' · ' + esc(m.by || saleName(conv.owner)) : '') + '</small></div>').join('') : emptyState('Chưa có tin nhắn với khách này.')) + '</div>' : '') +
      (own
        ? (c ? '<div class="sw-modal-actions">' + (dep ? '<button type="button" class="sw-btn" data-act="view-deposit" data-code="' + dep.code + '">' + icon('qr') + 'Xem cọc</button>' : '') +
            '<button type="button" class="sw-btn" data-act="msg" data-id="' + c.id + '">' + icon('chat') + 'Nhắn khách</button><button type="button" class="sw-btn sw-btn-teal" data-act="call" data-id="' + c.id + '">' + icon('phone') + 'Gọi</button></div>' : '')
        : (c ? readOnlyNote(a.owner) + '<div class="sw-modal-actions">' +
            (dep ? '<button type="button" class="sw-btn" data-act="view-deposit" data-code="' + dep.code + '">' + icon('qr') + 'Xem cọc</button>' : '') +
            (conv ? '<button type="button" class="sw-btn" data-act="view-conv" data-id="' + conv.id + '">' + icon('chat') + 'Xem hội thoại</button>' : '') + '</div>'
          : '<p class="sw-note">Lịch do ' + esc(saleName(a.owner)) + ' phụ trách, chưa gắn hồ sơ khách trong CRM.</p>')));
  }
  function depStateText(d) {
    if (d.state === 'confirmed') return 'Đã xác nhận · ' + money(d.received);
    if (d.state === 'paid') return 'Tiền đã về ' + d.paidAt + ' · ' + money(d.received) + ', chờ xác nhận';
    if (d.state === 'short') return 'Nhận ' + money(d.received) + ', thiếu so với số tiền cọc';
    if (d.state === 'expired') return 'Hết giờ giữ ' + d.holdUntil + ', đã nhả khung giờ';
    if (d.state === 'opened') return 'Khách đã mở link, giữ đến ' + d.holdUntil;
    return 'Đã gửi link, chưa cọc · giữ đến ' + d.holdUntil;
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
      const worker=AlohaWorkflow.get() && AlohaWorkflow.get().employees.find(e=>e.phone===q.shooterPhone && e.role==='tho-anh');
      const ph=worker && worker.name;
      const workerBusy=ph && q.date && q.time && photographerBusy(ph,q.date,q.time,dur);
      return { value: r.id + '|' + (ph || ''), label: r.label + (workerBusy?' · thợ đã có lịch':''), disabled: busy || !ph || workerBusy, busy };
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
    const workflow=AlohaWorkflow.get();
    const crew=workflow ? workflow.employees.filter(e=>e.role==='tho-anh') : [];
    const currentRule=workflow && workflow.rules.slice().reverse().find(r=>r.service===q.service && r.pkg===q.pkg);
    if(!q.price && currentRule)q.price=currentRule.price;
    if(!q.shooterPhone && crew.length===1)q.shooterPhone=crew[0].phone;
    if(!q.editorPhone && crew.length===1)q.editorPhone=crew[0].phone;
    const opts = roomOptions();
    if (!q.room || !opts.some(o => o.value === q.room && !o.disabled)) q.room = (opts.find(o => !o.disabled) || { value: '' }).value;
    const lk = lookupPhone(q.phone);
    const online = lk.state === 'mine' && convOf(lk.customer.id) && convOf(lk.customer.id).online;
    return '<div class="qb-head"><h2>Tạo lịch nhanh</h2><button type="button" class="sw-icon-btn" data-act="qb-close" title="Đóng" aria-label="Đóng Tạo lịch nhanh">' + icon('close') + '</button></div>' +
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
          [...new Set(['Cơ bản', 'Tiêu chuẩn', 'Premium'].concat(workflow?workflow.rules.filter(r=>r.service===q.service).map(r=>r.pkg):[]))].map(p => '<option' + (q.pkg === p ? ' selected' : '') + '>' + esc(p) + '</option>').join('') + '</select></label>' +
        '<label class="qb-field"><span>Giá gói thực tế (đ)</span><input type="number" min="1" step="1" data-qb="price" value="'+esc(q.price||'')+'" placeholder="Giá gói"></label>'+
        (isSep?'<label class="qb-field"><span>Sale phụ trách</span><select data-qb="salePhone"><option value="">Chọn Sale</option>'+(workflow?workflow.employees.filter(e=>e.role==='sale').map(e=>'<option value="'+esc(e.phone)+'"'+(q.salePhone===e.phone?' selected':'')+'>'+esc(e.name)+'</option>').join(''):'')+'</select></label>':'')+
        '<label class="qb-field"><span>Thợ chụp phụ trách</span><select data-qb="shooterPhone"><option value="">Chọn thợ chụp</option>'+crew.map(e=>'<option value="'+esc(e.phone)+'"'+(q.shooterPhone===e.phone?' selected':'')+'>'+esc(e.name)+'</option>').join('')+'</select></label>'+
        '<label class="qb-field"><span>Thợ chỉnh ảnh phụ trách</span><select data-qb="editorPhone"><option value="">Chọn thợ chỉnh ảnh</option>'+crew.map(e=>'<option value="'+esc(e.phone)+'"'+(q.editorPhone===e.phone?' selected':'')+'>'+esc(e.name)+'</option>').join('')+'</select></label>'+
        '<div class="qb-deposit">' + icon('qr') + '<span>Cọc <strong>' + (q.price?money(Math.ceil(Number(q.price)*.5)):'50% giá gói') + '</strong> · Mã <strong>' + nextCode() + '</strong> · giữ lịch ' + CFG.holdHours + ' tiếng, quá giờ chưa cọc tự nhả</span></div>' +
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

  let bookingBusy=false;
  async function submitQuickBook() {
    if(bookingBusy)return;
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
      // The persisted order projects this customer back into the shared CRM on success.
    }
    const code = nextCode();
    const hold = holdUntilText();
    const apId = 'ap-' + Date.now();
    if(!q.pkg || !Number.isSafeInteger(Number(q.price)) || Number(q.price)<=0)return err('Chọn gói và nhập giá gói thực tế.');
    bookingBusy=true;
    const workflowOrderId=AlohaWorkflow.id();
    try { await AlohaWorkflow.command('book',{id:workflowOrderId,code,phone:c.phone,customerName:c.name,customerId:c.id,service:q.service,pkg:q.pkg,price:Number(q.price),date:q.date,time:q.time,duration:Math.round(dur*60),room,shooterPhone:q.shooterPhone,editorPhone:q.editorPhone,salePhone:q.salePhone||me.phone}); }
    catch(e) {bookingBusy=false;return err(e.message);}
    bookingBusy=false;
    if(db.appointments.some(a=>a.workflowOrderId===workflowOrderId)) {ui.qb.phone='';ui.qb.name='';render();toast('Đã lưu lịch. Thợ được phân công sẽ thấy cùng đơn này.');return;}
    db.appointments.push({ id: apId, date: q.date, start: q.time, dur, service: q.service, label: c.name.replace(/^Chị /, 'C. ').replace(/^Anh /, 'A. '), room, photographer: ph, status: 'giu-cho', owner: me.id, customerId: c.id, depositCode: code });
    db.deposits.unshift({ code, owner: me.id, customerId: c.id, appointmentId: apId, channels: q.channels.slice(), state: 'sent', sentAt: hm(demoNow()), holdUntil: hold, holdEnd: Date.now() + CFG.holdHours * 3600e3,
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
  function depStepCount(d) { return { expired: 2, sent: 1, opened: 2, short: 3, paid: 3, confirmed: 4 }[d.state] || 1; }
  // Trạng thái 1 dòng: chấm màu + chữ ngắn (thay nhãn viên thuốc dài).
  function depStatus(d) {
    const [text, tone] =
      d.state === 'confirmed' ? ['Đã xác nhận lịch', 'green']
      : d.state === 'paid' ? ['Tiền về lúc ' + d.paidAt, 'green']
      : d.state === 'expired' ? ['Hết giờ giữ ' + d.holdUntil + ' · đã nhả khung giờ', 'red']
      : d.state === 'opened' ? ['Đã mở link · giữ đến ' + d.holdUntil, 'blue']
      : d.state === 'short' ? ['Thiếu tiền cọc', 'red']
      : ['Chưa mở link · hết hạn giữ ' + d.holdUntil, 'amber'];
    const amount = d.received ? '<b class="dp-amt' + (d.state === 'short' ? ' c-red' : '') + '">' + money(d.received) + '</b>' : '';
    return '<span class="dp-status c-' + tone + '"><i></i>' + esc(text) + '</span>' + amount;
  }
  // Tiến độ 4 bước dạng thanh mini (tên bước nằm trong title).
  function depProgress(d) {
    const n = depStepCount(d);
    const label = DEP_STEPS.map((s, i) => (i < n ? '✓ ' : '○ ') + s).join(' · ');
    return '<span class="dp-prog" title="' + esc(label) + '" aria-label="Tiến độ: ' + esc(label) + '">' +
      DEP_STEPS.map((s, i) => '<i class="' + (i < n ? (d.state === 'short' && i === 2 ? 'warn' : 'done') : '') + '"></i>').join('') +
      '<small>' + n + '/4</small></span>';
  }
  // Nút mắt: hồ sơ khách của yêu cầu cọc chỉ mở khi bấm (người dùng yêu cầu 2026-09-27).
  function depEye(d) {
    return '<button type="button" class="sw-eye-btn" data-act="view-dep-profile" data-code="' + d.code + '" title="Xem hồ sơ khách" aria-label="Xem hồ sơ khách ' + esc(customer(d.customerId).name) + '">' + icon('eye') + '</button>';
  }
  function depAction(d) {
    if (!isMine(d)) return '';
    if (d.state === 'paid') return '<button type="button" class="sw-btn sw-btn-sky" data-act="confirm-deposit" data-code="' + d.code + '">' + icon('check') + 'Xác nhận</button>';
    if (d.state === 'opened') return '<button type="button" class="sw-btn" data-act="resend-deposit" data-code="' + d.code + '">' + icon('send') + 'Nhắc lại</button>';
    if (d.state === 'sent') return '<button type="button" class="sw-btn" data-act="resend-sms" data-code="' + d.code + '">' + icon('send') + 'Gửi lại qua SMS</button>';
    if (d.state === 'expired') return '<button type="button" class="sw-btn sw-btn-accent" data-act="book-for" data-id="' + d.customerId + '">' + icon('calendar') + 'Giữ lịch lại</button>';
    if (d.state === 'short') return '<button type="button" class="sw-btn sw-btn-accent" data-act="check-short" data-code="' + d.code + '">Kiểm tra</button>';
    return '';
  }
  function showDepProfile(code) {
    const d = db.deposits.find(x => x.code === code);
    if (!d) return;
    ui.dep.selected = code;
    openModal('Cọc ' + d.code, '<div class="dp-profile">' + depProfile(d) + '</div>');
  }

  function viewDeposits() {
    setHead('Đặt cọc', '');
    const deps = scoped(db.deposits);
    const shortOnes = deps.filter(d => d.state === 'short');
    const expiredOnes = deps.filter(d => d.state === 'expired');
    const manual = shortOnes.length + expiredOnes.length + db.unmatched.length;
    const groups = {
      all: () => true,
      'cho-coc': d => d.state === 'sent' || d.state === 'opened',
      'kiem-tra': d => d.state === 'short' || d.state === 'expired',
      'da-khop': d => d.state === 'paid' || d.state === 'confirmed'
    };
    const shown = deps.filter(groups[ui.dep.filter]);
    // Nút lọc dạng thanh chuyển (cùng kiểu "Bảng giai đoạn / Danh sách" ở trang Khách hàng).
    const chip = (k, l) => '<button type="button" role="tab" aria-selected="' + (ui.dep.filter === k) + '" class="' + (ui.dep.filter === k ? 'on' : '') + '" data-act="dep-filter" data-id="' + k + '">' + l + chipNum(k === 'kiem-tra' ? manual : deps.filter(groups[k]).length) + '</button>';

    return '<section class="sw-card sw-pad">' +
          '<div class="kb-toolbar dp-toolbar"><div class="cu-seg dp-seg" role="tablist" aria-label="Lọc yêu cầu đặt cọc">' + chip('all', 'Tất cả') + chip('cho-coc', 'Chờ cọc') + chip('kiem-tra', 'Cần kiểm tra') + chip('da-khop', 'Đã khớp') + '</div>' + ownerSelect() + '</div>' +
          db.unmatched.map(tx => '<div class="dp-unmatched"><div><strong>Chưa khớp mã · ' + money(tx.amount) + '</strong><small>' + tx.time + ' · "' + esc(tx.content) + '"</small></div>' +
            '<button type="button" class="sw-btn" data-act="assign-tx" data-id="' + tx.id + '">' + icon('userPlus') + 'Gán cho khách</button></div>').join('') +
          (shown.length ? shown.map(d => {
            const c = customer(d.customerId); const ap = appointmentOf(d);
            return '<div class="dp-row' + (d.code === ui.dep.selected ? ' on' : '') + '">' +
              '<div class="dp-who"><strong>' + esc(c.name) + '</strong>' + ownerTag(d.owner) +
                '<small><span class="dp-code">' + d.code + '</span> · ' + esc((ap ? ap.service : c.service) + (ap ? ' · ' + fmtDM(ap.date) + ' ' + ap.start : '')) + '</small></div>' +
              depProgress(d) +
              '<div class="dp-meta">' + depStatus(d) + '</div>' +
              '<div class="dp-action">' + depAction(d) + depEye(d) + '</div>' +
            '</div>';
          }).join('') : emptyState('Không có yêu cầu đặt cọc nào trong nhóm này.')) +
        '</section>';
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
      (isMine(d) ? '' : readOnlyNote(d.owner)) +
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
    setHead('Đơn và tiến độ ảnh', '');
    const orders = scoped(db.orders);
    const groups = {
      all: () => true, 'cho-chon': o => o.status === 'cho-chon', 'dang-chinh': o => o.status === 'dang-chinh',
      'qua-han': o => o.status === 'qua-han', 'cong-no': o => o.due > 0, 'da-giao': o => o.status === 'da-giao'
    };
    const chip = (k, l) => '<button type="button" role="tab" aria-selected="' + (ui.ord.filter === k) + '" class="' + (ui.ord.filter === k ? 'on' : '') + '" data-act="ord-filter" data-id="' + k + '">' + l + chipNum(orders.filter(groups[k]).length) + '</button>';
    const shown = orders.filter(groups[ui.ord.filter]);

    return '<section class="sw-card sw-pad">' +
        '<div class="kb-toolbar"><div class="cu-seg sw-seg od-seg" role="tablist" aria-label="Lọc đơn">' + chip('all', 'Tất cả') + chip('cho-chon', 'Chờ chọn ảnh') + chip('dang-chinh', 'Đang chỉnh') + chip('qua-han', 'Quá hạn') + chip('cong-no', 'Còn công nợ') + chip('da-giao', 'Đã giao') + '</div>' +
          ownerSelect() + '<button type="button" class="sw-btn od-remind" data-act="remind-all">' + icon('send') + 'Nhắc khách chưa chọn ảnh</button></div>' +
        '<div class="sw-table-wrap"><table class="sw-table">' +
          '<thead><tr><th>Mã đơn</th><th>Khách</th><th>Phụ trách</th><th>Dịch vụ</th><th>Ngày chụp</th><th>Trạng thái</th><th>Thanh toán</th><th></th></tr></thead><tbody>' +
          (shown.length ? shown.map(o => {
            const st = ORD_STATUS[o.status];
            const action = o.status === 'dang-chinh' && o.due > 0 ? 'Nhắc thanh toán' : (o.action || st.action || 'Xem');
            return '<tr><td><strong>#' + o.code + '</strong></td><td><strong>' + esc(o.customer) + '</strong></td><td class="sw-nowrap">' + esc(saleName(o.owner)) + (isMine(o) ? ' <span class="sw-muted">(tôi)</span>' : '') + '</td><td>' + esc(o.service) + '<small class="sw-muted sw-block">' + esc(o.pkg) + '</small></td><td>' + o.date + '</td>' +
              '<td>' + badge(st.text, st.tone) + '</td>' +
              '<td class="sw-nowrap">' + (o.due > 0 ? '<span class="c-red">Còn ' + money(o.due) + '</span>' : '<span class="sw-muted">Đã đủ</span>') + '</td>' +
              '<td class="sw-right"><span class="od-act">' + (isMine(o) ? '<button type="button" class="sw-btn" data-act="order-action" data-code="' + o.code + '" data-id="' + esc(action) + '">' + esc(action) + '</button>' : '') +
              '<button type="button" class="sw-eye-btn" data-act="view-order-progress" data-code="' + o.code + '" title="Xem chi tiết và ghi chú đơn" aria-label="Xem chi tiết đơn #' + o.code + '">' + icon('eye') + '</button></span></td></tr>';
          }).join('') : '<tr><td colspan="8">' + emptyState('Không có đơn nào trong nhóm này.') + '</td></tr>') +
          '</tbody></table></div>' +
      '</section>';
  }

  function showOrderProgress(code) {
    const o = db.orders.find(x => x.code === code);
    if (!o) return;
    const st = ORD_STATUS[o.status] || { text: 'Đang xử lý', tone: 'blue', step: 1 };
    const own = isMine(o);
    const c = (o.customerId && customer(o.customerId)) ||
              db.customers.find(x => x.name === o.customer || fold(x.name) === fold(o.customer)) ||
              { id: 'cus-' + o.code, name: o.customer, phone: '0981999000', service: o.service, area: 'Hà Nội', owner: o.owner };
    const ap = (c && c.id && db.appointments.find(a => a.customerId === c.id)) ||
               db.appointments.find(a => a.label === o.customer);

    const timeStr = ap
      ? (ap.start + ' · ' + weekdayOf(ap.date) + ' ' + fmtDMY(ap.date))
      : ('09:00 · ' + (o.date.includes('/') ? o.date + '/2026' : o.date));

    const roomStr = ap
      ? ((ap.room === 'Ngoài' ? 'Tại nhà khách' + (ap.place ? ' (' + ap.place + ')' : '') : roomLabel(ap.room)) + ' · Thợ ' + ap.photographer)
      : ((o.service === 'Tại nhà' ? 'Tại nhà khách' : 'Phòng 1') + ' · Thợ Tuấn');

    const rows = [
      ['Dịch vụ', o.service],
      ['Khách', o.customer],
      ['Thời gian', timeStr],
      ['Phòng · Thợ ảnh', roomStr],
      ['Trạng thái', st.text],
      ['Phụ trách', saleName(o.owner) + (own ? ' (tôi)' : '')],
      ['Liên hệ', fullPhone(c.phone) + (c.area ? ' · ' + c.area : '')]
    ];

    const action = o.status === 'dang-chinh' && o.due > 0 ? 'Nhắc thanh toán' : (o.action || st.action || '');
    const modalBody =
      '<dl class="sw-dl">' + rows.map(r => '<dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd>').join('') + '</dl>' +
      // Bỏ khối tiến độ 5 bước, chỉ giữ Ghi chú đơn (người dùng yêu cầu 2026-09-27).
      // Ghi chú sống trong bộ nhớ trang như mọi thao tác khác ở Không gian Sale.
      '<small class="sw-modal-section-title">Ghi chú</small>' +
      '<textarea class="ci-note" data-order-note="' + o.code + '" rows="4" placeholder="' + (own ? 'Ghi chú về đơn: khách dặn gì, cần lưu ý gì khi chỉnh và giao ảnh' : 'Chưa có ghi chú') + '"' + (own ? '' : ' readonly') + '>' + esc(o.note || '') + '</textarea>' +
      (own
        ? '<div class="sw-modal-actions">' +
            (action ? '<button type="button" class="sw-btn sw-btn-accent" data-act="order-action" data-code="' + o.code + '" data-id="' + esc(action) + '">' + esc(action) + '</button>' : '') +
            '<button type="button" class="sw-btn" data-act="msg" data-id="' + c.id + '">' + icon('chat') + 'Nhắn khách</button>' +
            '<button type="button" class="sw-btn sw-btn-teal" data-act="call" data-id="' + c.id + '">' + icon('phone') + 'Gọi</button>' +
          '</div>'
        : readOnlyNote(o.owner) +
          '<div class="sw-modal-actions">' +
            '<button type="button" class="sw-btn" data-act="msg" data-id="' + c.id + '">' + icon('chat') + 'Nhắn khách</button>' +
            '<button type="button" class="sw-btn sw-btn-teal" data-act="call" data-id="' + c.id + '">' + icon('phone') + 'Gọi</button>' +
          '</div>');

    openModal(o.service + ' · ' + o.customer, modalBody);
  }

  // ---------- Trang: Chuyển giao khách ----------
  // Luồng: Sale tạo yêu cầu -> Quản lý duyệt -> người nhận bấm "Nhận khách" -> hồ sơ,
  // hội thoại, lịch, cọc, đơn chuyển sang người nhận. Trước bước cuối khách vẫn thuộc
  // sale cũ, nên không có lúc nào khách bị bỏ trống không ai phụ trách.
  // Chưa có màn duyệt của Quản lý: đã bỏ nút "Mô phỏng: quản lý duyệt" (người dùng yêu cầu
  // 2026-10-15), yêu cầu gửi đi nằm ở "Chờ quản lý duyệt" cho tới khi có màn duyệt thật.
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
    const map = { 'moi': ['Mới', 'red'], 'tu-van': ['Đang tư vấn', 'amber'], 'bao-gia': ['Đang tư vấn', 'amber'], 'cho-coc': ['Chờ cọc', 'red'], 'da-chot': ['Đã chốt', 'green'] };
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
      actions = '<button type="button" class="sw-btn" data-act="tr-cancel" data-id="' + r.id + '">Huỷ</button>';
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

  // Khách của mình hiện trước; khách sale khác (chỉ xem) gom vào 1 mục thu gọn cho đỡ dài.
  function trListHtml(shown, row) {
    if (!shown.length) return emptyState('Không có khách nào trong nhóm này.');
    const own = shown.filter(isMine); const rest = shown.filter(c => !isMine(c));
    const restHtml = '<div class="tr-list">' + rest.map(row).join('') + '</div>';
    return (own.length ? '<div class="tr-list">' + own.map(row).join('') + '</div>' : '') +
      (!rest.length ? '' : own.length
        ? '<details class="tr-more"><summary>Khách của sale khác · ' + rest.length + ' <span class="sw-muted">(chỉ xem)</span></summary>' + restHtml + '</details>'
        : restHtml);
  }

  function viewTransfer() {
    setHead('Chuyển giao khách hàng', '');
    const t = ui.tr;
    const inc = trIncoming(); const outg = trOutgoing();
    // Số trên tab chỉ đếm yêu cầu còn đang chờ (người dùng yêu cầu 2026-09-27): trước đây
    // đếm cả yêu cầu đã xong nên "Đã gửi · 2" không cho biết còn việc gì cần theo dõi.
    const incOpen = inc.filter(r => TR_OPEN.includes(r.status)); const outOpen = outg.filter(r => TR_OPEN.includes(r.status));
    // Số trên tab: "Chuyển đến" = yêu cầu chờ bạn nhận (tô hồng), "Đã gửi" = yêu cầu còn đang chờ.
    const tabs = '<div class="cu-seg sw-seg tr-tabs" role="tablist" aria-label="Chuyển giao">' + [
      ['tao', 'Tạo yêu cầu', 0, 'Tạo yêu cầu chuyển khách'],
      ['den', 'Chuyển đến', trWaitingMe(), trWaitingMe() + ' yêu cầu chờ bạn nhận'],
      ['gui', 'Đã gửi', outOpen.length, outOpen.length + ' yêu cầu đang chờ']
    ].map(([k, l, n, tip]) =>
      '<button type="button" role="tab" aria-selected="' + (t.tab === k) + '" class="' + (t.tab === k ? 'on' : '') + '" data-act="tr-tab" data-id="' + k + '" title="' + tip + '">' + l +
        (n ? ' <span class="sw-chip-n' + (k === 'den' ? ' hot' : '') + '">' + n + '</span>' : '') + '</button>').join('') + '</div>';

    if (t.tab !== 'tao') {
      const den = t.tab === 'den';
      const open = den ? incOpen : outOpen;
      const done = (den ? inc : outg).filter(r => !TR_OPEN.includes(r.status));
      const group = (title, list, empty) => '<small class="sw-label">' + title + ' · ' + list.length + '</small>' +
        (list.length ? '<div class="tr-reqs">' + list.map(r => trRow(r, true)).join('') + '</div>' : emptyState(empty));
      return tabs + '<section class="sw-card sw-pad">' +
        '<div class="sw-card-head"><h2>' + (den ? 'Khách sale khác chuyển cho tôi' : 'Yêu cầu chuyển khách tôi đã gửi') + '</h2></div>' +
        group('Đang chờ', open, 'Không có yêu cầu nào đang chờ.') +
        group(den ? 'Đã nhận' : 'Đã chuyển xong', done, den ? 'Bạn chưa nhận khách nào từ sale khác.' : 'Chưa có yêu cầu nào hoàn tất.') +
      '</section>';
    }

    const all = scoped(db.customers);
    const mineCount = myCustomers().length;
    Object.keys(t.selected).forEach(id => { if (!myCustomer(id) || trLocked(id)) delete t.selected[id]; });
    const shown = all.filter(trFilter(t.filter));
    const picked = myCustomers().filter(c => t.selected[c.id]);
    const selectable = shown.filter(c => isMine(c) && !trLocked(c.id));
    const allOn = selectable.length > 0 && selectable.every(c => t.selected[c.id]);
    if (!picked.length) t.step = 1;

    const others = db.sales.filter(s => s.id !== me.id);
    const avail = others.filter(s => !onLeave(s));
    const minLoad = Math.min(...avail.map(saleLoad));
    if (!t.to || !avail.some(s => s.id === t.to)) t.to = (avail.slice().sort((a, b) => saleLoad(a) - saleLoad(b))[0] || {}).id || null;
    const note = t.noteTouched ? t.note : trDraft(picked);

    const custRow = (c) => {
      const other = !isMine(c);
      const locked = other || trLocked(c.id); const sub = trSubline(c);
      return '<label class="tr-item' + (t.selected[c.id] ? ' on' : '') + (locked ? ' locked' : '') + '">' +
        '<input type="checkbox" data-tr-pick="' + c.id + '"' + (t.selected[c.id] ? ' checked' : '') + (locked ? ' disabled' : '') + '>' +
        '<span class="tr-item-body"><strong>' + esc(c.name) + '</strong><small>' + esc(sub + (sub.includes(c.service) ? '' : ' · ' + c.service)) + '</small></span>' +
        (other ? badge('Của ' + saleName(c.owner), 'muted') : locked ? badge('Đang chờ chuyển', 'muted') : trBadge(c)) +
      '</label>';
    };
    const radio = (name, value, title, sub, extra) => '<label class="tr-radio"><input type="radio" name="tr-' + name + '" data-tr-field="' + name + '" value="' + value + '"' + (t[name] === value ? ' checked' : '') + '>' +
      '<span><strong>' + title + '</strong>' + (extra || '') + '<small>' + esc(sub) + '</small></span></label>';

    // Làm theo 2 bước (người dùng yêu cầu 2026-10-07): chọn khách xong bấm "Tiếp theo" mới hiện phần 2.
    // Yêu cầu đã gửi / chuyển đến xem ở 2 tab "Chuyển đến" và "Đã gửi" (bỏ khung "Yêu cầu gần đây" ở đây).
    if (t.step === 1) return tabs + '<div class="sw-stack tr-wrap">' +
        '<section class="sw-card sw-pad">' +
          '<div class="sw-card-head"><h2>Chọn khách cần chuyển</h2>' +
            '<button type="button" class="sw-btn" data-act="tr-all"' + (selectable.length ? '' : ' disabled') + '>' + (allOn ? 'Bỏ chọn' : 'Chọn tất cả') + '</button></div>' +
          '<div class="kb-toolbar tr-toolbar">' + ownerSelect() + '</div>' +
          '<div class="sw-chips tr-filters">' + [['all', 'Tất cả'], ['lich-7', 'Có lịch 7 ngày tới'], ['tu-van', 'Đang tư vấn'], ['cho-coc', 'Chờ cọc']].map(([k, l]) =>
            '<button type="button" class="sw-chip' + (t.filter === k ? ' on' : '') + '" data-act="tr-filter" data-id="' + k + '">' + l + '</button>').join('') + '</div>' +
          trListHtml(shown, custRow) +
          '<div class="tr-next-bar"><span class="sw-muted">Đã chọn <strong>' + picked.length + '</strong> / ' + mineCount + ' khách của bạn</span>' +
            '<button type="button" class="sw-btn sw-btn-accent" data-act="tr-next"' + (picked.length ? '' : ' disabled') + '>Tiếp theo' + icon('arrow') + '</button></div>' +
        '</section>' +
      '</div>';

    return tabs + '<div class="sw-stack tr-wrap">' +
      '<section class="sw-card sw-pad tr-picked">' +
        '<div class="sw-card-head"><h2>Chuyển ' + picked.length + ' khách</h2>' +
          '<button type="button" class="sw-btn" data-act="tr-back">' + icon('back') + 'Chọn lại khách</button></div>' +
        '<div class="sw-chips">' + picked.map(c => '<span class="sw-tag tone-beige">' + esc(c.name) + '</span>').join('') + '</div>' +
      '</section>' +
      '<section class="sw-card sw-pad tr-form">' +
        '<h2>Chuyển cho ai và chuyển thế nào</h2>' +
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
      '</section>' +
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
    t.selected = {}; t.note = ''; t.noteTouched = false; t.tab = 'gui'; t.step = 1;
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
    setHead('Báo cáo của tôi', 'Tính từ khách do ' + me.name + ' phụ trách · doanh số và thời gian phản hồi chưa có nguồn số liệu');
    const leads = myLeads();
    const reach = STAGES.map((s, i) => [s.label, leads.filter(c => STAGES.findIndex(x => x.id === boardStage(c.stage)) >= i).length]);
    const max = Math.max(1, reach[0][1]);
    const closed = leads.filter(c => c.stage === 'da-chot').length;
    const pct = Math.round(me.achieved / me.target * 100);
    const dueTotal = myOrders().reduce((s, o) => s + o.due, 0);
    return '<div class="sw-kpis sw-kpis-4">' +
        '<div class="sw-card sw-kpi"><small>Doanh số tháng</small><strong>' + me.achieved + ' triệu</strong><span class="c-teal">' + pct + '% mục tiêu ' + me.target + ' triệu</span></div>' +
        '<div class="sw-card sw-kpi"><small>Tỉ lệ chốt</small><strong>' + (leads.length ? Math.round(closed / leads.length * 100) : 0) + '%</strong><span class="c-teal">' + closed + '/' + leads.length + ' lead đã chốt</span></div>' +
        '<div class="sw-card sw-kpi"><small>Phản hồi trung bình</small><strong>' + (me.responseMin == null ? '—' : me.responseMin + ' phút') + '</strong><span class="c-amber">Mục tiêu dưới 10 phút</span></div>' +
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
    const c = customer(id);
    if (!c) return;
    openModal('Hồ sơ khách', customerPanel(c) + (!isMine(c) ? '' :
      '<div class="sw-modal-actions"><button type="button" class="sw-btn sw-btn-teal" data-act="call" data-id="' + c.id + '">' + icon('phone') + 'Gọi</button>' +
      '<button type="button" class="sw-btn" data-act="msg" data-id="' + c.id + '">' + icon('chat') + 'Nhắn</button></div>'));
  }

  function showCall(id, key) {
    const c = customer(id) || myCustomer(id) || db.customers.find(x => x.id === id);
    if (!c) return;
    openModal('Gọi ' + c.name,
      '<p class="sw-call-num">' + fullPhone(c.phone) + '</p><p class="sw-muted">' + esc(c.service + ' · ' + (c.source || 'Aloha Studio') + ' · ' + (c.status ? c.status.text : 'Đang xử lý')) + '</p>' +
      '<div class="sw-modal-actions"><a class="sw-btn sw-btn-teal" href="tel:' + c.phone + '">' + icon('phone') + 'Gọi ngay</a>' +
      '<button type="button" class="sw-btn" data-act="mark-called" data-id="' + c.id + '" data-key="' + esc(key || '') + '">' + icon('check') + 'Đánh dấu đã gọi</button></div>');
  }

  function openConversationFor(id) {
    const c = customer(id) || myCustomer(id) || db.customers.find(x => x.id === id);
    if (!c) return;
    let v = db.conversations.find(x => x.customerId === c.id);
    if (!v) {
      v = { id: 'cv-' + Date.now(), owner: c.owner || me.id, customerId: c.id, channel: 'Chat trực tiếp', time: 'Vừa xong', messages: [] };
      db.conversations.unshift(v);
    }
    if (ui.owner !== 'all' && ui.owner !== v.owner) ui.owner = 'all';
    ui.inbox.filter = v.unread && !v.done ? 'chua-tra-loi' : (v.bot ? 'bot' : 'cua-toi');
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
      if (v && v.unread && (v.owner === me.id || (v.live && !v.owner)) && ui.inbox.mobileChat !== false) {
        v.unread = false; renderChrome(route);
        if (v.live) liveMarkRead(v);
      }
      if (v && v.live && !v.loaded) liveLoadThread(v);
    }
  }
  window.addEventListener('hashchange', render);
  function hydrateWorkflow(state) {
    const employeeName=phone=>(state.employees.find(e=>e.phone===phone)||{}).name||phone;
    state.orders.forEach(o=>{
      const owner=(db.sales.find(s=>s.phone===o.salePhone)||{}).id||me.id;
      let c=db.customers.find(c=>c.phone===o.phone);
      if(!c) {c={id:o.customerId||'wf-customer-'+o.phone,owner,name:o.customerName,short:o.customerName.split(' ').pop(),title:'anh/chị',phone:o.phone,area:'',service:o.service,source:'Sale đặt lịch',stage:'cho-coc',since:o.date,status:{},tags:[],note:''};db.customers.push(c);}
      c.stage=o.status==='booked'?'cho-coc':'da-chot';c.status={text:o.shotAt?'Đã chụp':o.collected?'Đã cọc':'Chờ cọc',tone:o.shotAt?'teal':'blue'};
      const apId='wf-ap-'+o.id;
      if(o.status==='cancelled') {db.appointments=db.appointments.filter(a=>a.workflowOrderId!==o.id);return;}
      const ap={id:apId,workflowOrderId:o.id,date:o.date,start:o.time,dur:o.duration/60,service:o.service,label:o.customerName,room:o.room,photographer:employeeName(o.shooterPhone),status:o.shotAt?'da-chup':o.status==='shooting'?'checkin':o.status==='booked'?'giu-cho':'da-coc',owner,customerId:c.id,depositCode:o.code,pkg:o.pkg};
      const old=db.appointments.find(a=>a.workflowOrderId===o.id||a.depositCode===o.code);if(old)Object.assign(old,ap);else db.appointments.push(ap);
      const dep={code:o.code,workflowOrderId:o.id,owner,customerId:c.id,appointmentId:apId,channels:['Chat web'],state:o.collected>=Math.ceil(o.price*.5)?'confirmed':'sent',received:o.collected,amount:Math.ceil(o.price*.5),sentAt:hm(new Date(o.createdAt)),holdEnd:o.createdAt+CFG.holdHours*3600e3,holdUntil:hm(new Date(o.createdAt+CFG.holdHours*3600e3)),log:[]};
      const oldDep=db.deposits.find(d=>d.code===o.code);if(oldDep)Object.assign(oldDep,dep);else db.deposits.unshift(dep);
      if(o.shotAt) {
        const order={code:o.code,workflowOrderId:o.id,owner,customer:o.customerName,customerId:c.id,service:o.service,pkg:o.pkg,date:o.date,status:o.status==='delivered'?'da-giao':o.status==='editing'?'dang-chinh':'cho-chon',progress:'',due:'Theo đơn'};
        const oldOrder=db.orders.find(x=>x.code===o.code);if(oldOrder)Object.assign(oldOrder,order);else db.orders.push(order);
      }
    });
    if(!document.querySelector('#qbPanel:focus-within, #swModal:not([hidden]), #ibInput:focus'))render();
  }
  window.addEventListener('aloha:workflow',e=>hydrateWorkflow(e.detail));

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
      case 'view-deposit': case 'select-deposit-go': {
        const d = db.deposits.find(x => x.code === (code || id));
        if (d && ui.owner !== 'all' && ui.owner !== d.owner) ui.owner = 'all';
        ui.dep.selected = code || id; ui.dep.filter = 'all'; closeModal(); location.hash = '#dat-coc'; render(); return showDepProfile(code || id);
      }
      // Xem hội thoại của khách sale khác (chỉ đọc, không có ô trả lời).
      case 'view-conv': {
        const v = db.conversations.find(x => x.id === id); if (!v) return;
        if (ui.owner !== 'all' && ui.owner !== v.owner) ui.owner = 'all';
        ui.inbox.filter = v.unread && !v.done ? 'chua-tra-loi' : (v.bot ? 'bot' : 'cua-toi');
        closeModal(); location.hash = '#hop-thu/' + v.id; return;
      }
      case 'view-dep-profile': return showDepProfile(code);
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
      case 'view-order-progress': return showOrderProgress(code);

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
        if (v && v.live) liveSend(v, quickReplyText('Bảng giá', c));
        else if (v) { v.messages.push({ from: 'sale', text: quickReplyText('Bảng giá', c), time: hm(demoNow()) }); v.unread = false; }
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
        ui.qbOpen = true;
        closeModal(); if (location.hash === '#lich-chup') { render(); focusQuickBook(); } else location.hash = '#lich-chup'; return;
      }
      case 'qb-close': ui.qbOpen = false; return render();
      // Màn rộng: bật/tắt cột hồ sơ bên phải; màn hẹp (cột bị ẩn) thì mở hồ sơ dạng popup.
      case 'ib-info':
        if (window.matchMedia('(max-width: 1360px)').matches) return showProfile(id);
        ui.inbox.info = !ui.inbox.info; return render();
      // Chuyển khách luôn đi qua màn Chuyển giao (cần Quản lý duyệt), không chuyển thẳng.
      case 'transfer': {
        const c = myCustomer(id); if (!c) return;
        if (trLocked(c.id)) { ui.tr.tab = 'gui'; location.hash = '#chuyen-giao'; return toast(c.name + ' đang có yêu cầu chuyển giao chờ xử lý'); }
        Object.assign(ui.tr, { tab: 'tao', step: 1, filter: 'all', selected: { [c.id]: true }, note: '', noteTouched: false });
        closeModal(); location.hash = '#chuyen-giao'; return;
      }
      case 'goto-transfer': ui.tr.tab = 'den'; if (location.hash === '#chuyen-giao') return render(); location.hash = '#chuyen-giao'; return;
      case 'tr-tab': ui.tr.tab = id; return render();
      case 'tr-next': ui.tr.step = 2; render(); return window.scrollTo({ top: 0 });
      case 'tr-back': ui.tr.step = 1; return render();
      case 'tr-filter': ui.tr.filter = id; return render();
      case 'tr-all': {
        const inFilter = trFilter(ui.tr.filter);
        const list = scoped(db.customers).filter(c => isMine(c) && inFilter(c) && !trLocked(c.id));
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
      case 'tr-accept': {
        const r = db.transfers.find(x => x.id === id && x.status === 'cho-nhan' && (x.to === me.id || x.from === me.id)); if (!r) return;
        completeTransfer(r); ui.inbox.active = null; ui.inbox.mobileChat = false;
        render();
        return toast(r.to === me.id ? 'Đã nhận ' + r.names.join(', ') + ' từ ' + saleName(r.from) + '. Khách đã có trong danh sách của bạn.'
          : saleName(r.to) + ' đã nhận ' + r.names.join(', ') + '. Bạn không còn thấy hồ sơ khách này.');
      }

      // Khách hàng
      case 'cus-mode': ui.cus.mode = id; return render();
      case 'cus-select': {
        const c = customer(id); if (!c) return;
        return openModal('Hồ sơ khách', cusDetail(c));
      }

      // Kanban
      case 'lead-next': {
        const c = myCustomer(id); if (!c) return;
        const i = STAGES.findIndex(s => s.id === boardStage(c.stage));
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
      case 'qb-service': ui.qb.service = id; ui.qb.room = ''; ui.qb.price=''; return refreshQuickBook(true);
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
    if (t.dataset.orderNote) { const o = myOrders().find(x => x.code === t.dataset.orderNote); if (o) o.note = t.value; return; }
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
    if (t.hasAttribute('data-owner-filter')) {
      ui.owner = t.value;
      ui.inbox.active = null; ui.inbox.mobileChat = false; ui.dep.selected = null;
      return render();
    }
    if (t.dataset.leadFilter === 'dateMode') {
      ui.lead.dateMode = t.value;
      ui.lead.dateVal = t.value === 'ngay' ? TODAY : t.value === 'thang' ? TODAY.slice(0, 7) : t.value === 'nam' ? TODAY.slice(0, 4) : '';
      return render();
    }
    if (t.dataset.leadFilter) { ui.lead[t.dataset.leadFilter] = t.value; return render(); }
    if (t.dataset.trPick) {
      if (t.checked) ui.tr.selected[t.dataset.trPick] = true; else delete ui.tr.selected[t.dataset.trPick];
      return render();
    }
    if (t.dataset.trField) { if (t.value) ui.tr[t.dataset.trField] = t.value; return render(); }
    if (t.dataset.qb && ['date', 'time', 'room', 'pkg','shooterPhone','editorPhone','price','salePhone'].includes(t.dataset.qb)) {
      ui.qb[t.dataset.qb] = t.value;
      if(t.dataset.qb==='pkg') {ui.qb.price='';return refreshQuickBook(true);}
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
      if (v && v.live && text && (v.owner === me.id || !v.owner)) { input.value = ''; liveSend(v, text); return; }
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
  function focusQuickBook() {
    setTimeout(() => { const p = document.querySelector('[data-qb="phone"]'); if (p) { p.focus(); p.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }, 60);
  }
  document.getElementById('swQuickBtn').addEventListener('click', (e) => {
    ui.qbOpen = true;
    if (location.hash === '#lich-chup') { e.preventDefault(); render(); }
    focusQuickBook();
  });

  function tick() {
    let changed = expireHolds();
    const k = dateKey(new Date());
    if (k !== TODAY) {
      const old = TODAY;
      if (ui.cal.weekStart === mondayOf(parseKey(old))) ui.cal.weekStart = mondayOf(parseKey(k));
      if (ui.cal.day === old) ui.cal.day = k;
      TODAY = k; TOMORROW = dateKey(addDays(parseKey(k), 1));
      changed = true;
    }
    if (!changed) return;
    // Đang gõ trong ô nhập thì chỉ cập nhật khung, lần sau mới vẽ lại trang để không mất chữ.
    const a = document.activeElement;
    if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && document.getElementById('swView').contains(a)) { renderChrome(parseHash().route); pendingRender = true; return; }
    render();
  }
  let pendingRender = false;
  document.addEventListener('focusout', () => { if (pendingRender) { pendingRender = false; setTimeout(render, 0); } });
  setInterval(tick, 30000);

  // ---------- Khách từ web: đồng bộ với chat thật trên server ----------
  // Hỏi /api/sale-chat/inbox mỗi 3 giây (trang đang mở) hoặc 20 giây (tab ẩn). Cuộc trò
  // chuyện nào có tin mới (updatedAt đổi) thì tải đủ tin để cập nhật hội thoại + suy ra sale
  // phụ trách. Hồ sơ khách tạo 1 lần khi khách nhắn lần đầu; giai đoạn, ghi chú Sale đổi trên
  // trang chỉ sống trong bộ nhớ (chưa có backend CRM), tin nhắn thì luôn lấy từ server.
  const liveState = { status: 'loading', busy: false, seen: {} }; // seen: phone -> updatedAt đã tải đủ tin
  const LIVE_ID = (phone) => 'web-' + phone;

  function liveNote() {
    if (liveState.status === 'auth') return '<p class="sw-note sw-readonly">' + icon('lock') + '<span>Chưa kết nối được máy chủ chat. <button type="button" class="sw-link" data-act="live-relogin">Đăng nhập lại</button> để thấy tin nhắn của khách.</span></p>';
    if (liveState.status === 'offline') return '<p class="sw-note">Đang kết nối tới máy chủ chat… máy chủ có thể cần vài chục giây để khởi động.</p>';
    if (liveState.status === 'loading' && !db.conversations.length) return '<p class="sw-note">Đang tải tin nhắn của khách…</p>';
    return '';
  }

  function serviceFromTopic(topic) {
    const f = fold(topic);
    if (f.includes('be lon')) return 'Bé lớn';
    if (f.includes('sinh nhat')) return 'Sinh nhật';
    if (f.includes('newborn') || f.includes('so sinh')) return 'Newborn';
    if (f.includes('gia dinh')) return 'Gia đình';
    if (/\bbau\b/.test(f)) return 'Bầu';
    return 'Chưa chọn';
  }
  function relTime(ts) {
    const min = Math.max(0, Math.round((Date.now() - ts) / 60000));
    if (min < 1) return 'Vừa xong';
    if (min < 60) return min + ' phút';
    if (min < 24 * 60) return Math.floor(min / 60) + ' giờ';
    const d = new Date(ts); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1);
  }
  function msgTime(ts) {
    const d = new Date(ts);
    return dateKey(d) === TODAY ? hm(d) : pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + ' ' + hm(d);
  }
  const saleIdByName = (name) => (db.sales.find(s => s.name === name) || {}).id || null;
  const liveMsg = (m) => ({ from: m.from === 'sale' ? 'sale' : 'kh', text: m.text, time: msgTime(m.at), by: m.senderName, at: m.at });

  // Gộp 1 bản tóm tắt (và đủ tin nếu có) từ server vào hồ sơ + hội thoại trên trang.
  function liveMerge(sum, full) {
    const id = LIVE_ID(sum.phone);
    let c = customer(id) || db.customers.find(c=>c.phone===sum.phone);
    let v = db.conversations.find(x => x.id === id);
    const name = sum.customerName || 'Khách hàng';
    if (!c) {
      c = { id, owner: null, name, short: name.trim().split(/\s+/).pop(), title: 'anh/chị', phone: sum.phone, area: '',
        service: serviceFromTopic(sum.topic), source: 'Website', stage: 'moi', since: '', status: { text: 'Chưa trả lời', tone: 'red' },
        tags: ['Khách web'], note: '', web: true };
      db.customers.unshift(c);
    }
    if (!v) {
      v = { id, live: true, phone: sum.phone, owner: null, customerId: c.id, channel: 'Chat web', time: '', unread: false, messages: [], loaded: false };
      db.conversations.unshift(v);
    }
    c.name = name;
    if (sum.topic && c.service === 'Chưa chọn') c.service = serviceFromTopic(sum.topic);
    c.since = relTime(sum.updatedAt);
    v.time = relTime(sum.updatedAt);
    v.updatedAt = sum.updatedAt;
    v.unread = (sum.staffUnread || 0) > 0;
    if (full) {
      v.messages = full.messages.map(liveMsg);
      v.loaded = true;
      const firstSale = full.messages.find(m => m.from === 'sale' && saleIdByName(m.senderName));
      if (!v.owner && firstSale) {
        v.owner = c.owner = saleIdByName(firstSale.senderName);
        if (c.stage === 'moi') { c.stage = 'tu-van'; c.status = Object.assign({}, STAGE_DEFAULT_STATUS['tu-van']); }
      }
      const last = full.messages[full.messages.length - 1];
      if (last && last.from === 'khach' && c.stage !== 'moi') c.status = { text: 'Khách vừa nhắn', tone: 'amber' };
    } else if (!v.loaded && sum.last) {
      v.messages = [liveMsg(sum.last)];
    }
    const linked=AlohaWorkflow.get() && AlohaWorkflow.get().orders.find(o=>o.phone===sum.phone);
    if(linked){const owner=(db.sales.find(s=>s.phone===linked.salePhone)||{}).id;if(owner){c.owner=owner;v.owner=owner;}}
  }

  async function liveRefresh() {
    const sess = window.AlohaAuth.getSession();
    if (!sess || !sess.token) {
      if (liveState.status !== 'auth') { liveState.status = 'auth'; liveRerender(); }
      return;
    }
    if (liveState.busy) return;
    liveState.busy = true;
    let changed = false;
    try {
      const r = await window.AlohaAuth.api('/api/sale-chat/inbox');
      if (!r.ok) {
        const st = r.status === 401 ? 'auth' : 'offline';
        changed = st !== liveState.status; liveState.status = st;
        return;
      }
      if (liveState.status !== 'ok') changed = true;
      liveState.status = 'ok';
      for (const sum of (r.data.chats || [])) {
        const old = db.conversations.find(x => x.id === LIVE_ID(sum.phone));
        const before = old ? old.time + ':' + old.unread : '';
        let full = null;
        if (liveState.seen[sum.phone] !== sum.updatedAt) {
          const t = await window.AlohaAuth.api('/api/sale-chat/inbox/' + encodeURIComponent(sum.phone));
          if (t.ok && t.data.chat) { full = t.data.chat; liveState.seen[sum.phone] = sum.updatedAt; }
        }
        liveMerge(sum, full);
        const v = db.conversations.find(x => x.id === LIVE_ID(sum.phone));
        if (full || before !== v.time + ':' + v.unread) changed = true;
      }
    } finally {
      liveState.busy = false;
      if (changed) liveRerender();
    }
  }

  async function liveLoadThread(v) {
    if (v.loading) return;
    v.loading = true;
    const t = await window.AlohaAuth.api('/api/sale-chat/inbox/' + encodeURIComponent(v.phone));
    v.loading = false;
    if (!t.ok || !t.data.chat) return;
    liveState.seen[v.phone] = t.data.chat.updatedAt;
    liveMerge(Object.assign({}, t.data.chat, { staffUnread: v.unread ? 1 : 0 }), t.data.chat);
    liveRerender();
  }

  function liveMarkRead(v) {
    window.AlohaAuth.api('/api/sale-chat/inbox/' + encodeURIComponent(v.phone) + '/read', { method: 'POST' });
  }

  async function liveSend(v, text) {
    const r = await window.AlohaAuth.api('/api/sale-chat/inbox/' + encodeURIComponent(v.phone) + '/messages', { method: 'POST', body: { text } });
    if (!r.ok) {
      if (r.status === 401) liveState.status = 'auth';
      render();
      const inp = document.getElementById('ibInput'); if (inp && !inp.value) inp.value = text;
      return toast(r.status === 401 ? 'Phiên đăng nhập hết hạn, hãy đăng nhập lại rồi gửi.' : 'Chưa gửi được tin, kiểm tra kết nối rồi thử lại.');
    }
    const chat = r.data.chat;
    liveState.seen[v.phone] = chat.updatedAt;
    const claimed = !v.owner;
    liveMerge({ phone: chat.phone, customerName: chat.customerName, topic: chat.topic, updatedAt: chat.updatedAt, staffUnread: 0 }, chat);
    render();
    const inp = document.getElementById('ibInput'); if (inp) inp.focus();
    if (claimed && v.owner === me.id) toast('Bạn đã nhận khách ' + customer(v.customerId).name + '.');
  }

  // Vẽ lại sau khi có dữ liệu mới mà không làm mất chữ Sale đang gõ dở trong ô tin nhắn.
  function liveRerender() {
    const a = document.activeElement;
    const view = document.getElementById('swView');
    if (a && a.id === 'ibInput') {
      const val = a.value; const s0 = a.selectionStart; const s1 = a.selectionEnd;
      render();
      const inp = document.getElementById('ibInput');
      if (inp) { inp.value = val; inp.focus(); try { inp.setSelectionRange(s0, s1); } catch (e) { /* bỏ qua */ } }
      return;
    }
    if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && view.contains(a)) { renderChrome(parseHash().route); pendingRender = true; return; }
    if (!document.getElementById('swModal').hidden) { renderChrome(parseHash().route); return; } // đang mở popup: chỉ cập nhật menu
    render();
  }

  document.addEventListener('click', (e) => { if (e.target.closest('[data-act="live-relogin"]')) window.AlohaAuth.logout(); });
  setInterval(() => { if (document.visibilityState === 'visible') liveRefresh(); }, 3000);
  setInterval(() => { if (document.visibilityState !== 'visible') liveRefresh(); }, 20000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') liveRefresh(); });

  render();
  liveRefresh();
})();
