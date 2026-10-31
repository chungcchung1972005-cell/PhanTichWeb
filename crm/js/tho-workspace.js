// ALOHA Baby — màn làm việc của Thợ ảnh (31/10/2026, Chung: "giao diện thợ lướt lướt, mọi thông tin 1 trang,
// chia thành các phần, bấm vào khách mới thấy tải ảnh, đăng ảnh, chat riêng").
// Menu thợ còn 3 mục, mỗi lúc hiện 1 mục: Khách của tôi · Thu nhập · Đã hoàn tất.
// "Khách của tôi": danh sách khách bên trái, bấm khách → khung chi tiết bên phải (điện thoại: phủ kín màn)
// có 3 tab Ảnh gốc / Ảnh cần chỉnh / Chat. Tab 2, 3 dùng lại nguyên phần chi tiết yêu cầu của admin.js
// (window.AlohaThoDesk) nên mọi tính năng cũ (zip, kéo thả, khớp tay, Hoàn tất, chat) giữ nguyên.
// Chỉ chạy cho Thợ ảnh khi bật đồng bộ (editSync); Sếp và chế độ cũ không đổi.
(function () {
  const session = window.AlohaAuth && AlohaAuth.getSession && AlohaAuth.getSession();
  if (!session || session.role !== 'tho-anh' || !window.AlohaEditSync || !AlohaEditSync.enabled()) return;
  // Thu nhập mở thẳng tab "Thu nhập" (workflow-ui đọc khoá này khi vẽ)
  try { localStorage.setItem('aloha_admin_ui_wf', 'income'); } catch (e) { /* bỏ qua */ }
  document.documentElement.classList.add('tho-ws-on');

  document.addEventListener('DOMContentLoaded', () => {
    const desk = window.AlohaThoDesk, tabsNav = document.getElementById('adminTabs');
    const anh = document.getElementById('anh');
    if (!desk || !tabsNav || !anh) return;
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    // ---------------------------------------------------------------- Menu: 1 mục 1 lúc
    const ICON_USERS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><circle cx="17.5" cy="9" r="2.4"/><path d="M20.5 19.5c0-2.3-1.4-4-3.6-4.4"/></svg>';
    const ICON_MONEY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6.5 9.5v5M17.5 9.5v5"/></svg>';
    const linkAnh = tabsNav.querySelector('a[href="#anh"]'), linkWf = tabsNav.querySelector('a[href="#quy-trinh"]');
    if (linkAnh) { linkAnh.setAttribute('href', '#khach-cua-toi'); linkAnh.innerHTML = ICON_USERS + '<span>Khách của tôi</span><b class="tho-ws-count" hidden></b>'; linkAnh.dataset.label = 'Khách của tôi'; }
    if (linkWf) { linkWf.innerHTML = ICON_MONEY + '<span>Thu nhập</span>'; linkWf.dataset.label = 'Thu nhập'; tabsNav.append(linkWf); }
    const done = tabsNav.querySelector('a[href="#hoan-tat"]'); if (done && linkWf) tabsNav.append(done);
    if (linkAnh) tabsNav.prepend(linkAnh);

    const ws = document.createElement('section');
    ws.className = 'admin-section tho-ws'; ws.id = 'khach-cua-toi';
    ws.innerHTML = `<header class="tho-ws-head"><h2>Khách của tôi</h2>
        <div class="tho-ws-filter" role="tablist" aria-label="Lọc khách">
          <button type="button" role="tab" data-f="todo" aria-selected="true">Cần làm <b data-n="todo"></b></button>
          <button type="button" role="tab" data-f="wait" aria-selected="false">Chờ khách <b data-n="wait"></b></button>
          <button type="button" role="tab" data-f="all" aria-selected="false">Tất cả <b data-n="all"></b></button>
        </div></header>
      <div class="tho-ws-body">
        <div class="tho-ws-list" role="list"></div>
        <aside class="tho-detail" aria-label="Chi tiết khách" hidden>
          <div class="tho-detail-top">
            <button type="button" class="tho-detail-back" aria-label="Quay lại danh sách">‹ Quay lại</button>
            <div class="tho-detail-title"></div>
          </div>
          <div class="tho-detail-tabs" role="tablist" aria-label="Việc với khách này">
            <button type="button" role="tab" data-t="goc">Ảnh gốc</button>
            <button type="button" role="tab" data-t="chinh">Ảnh cần chỉnh</button>
            <button type="button" role="tab" data-t="chat">Chat</button>
          </div>
          <div class="tho-detail-pane" data-pane="goc"></div>
          <div class="tho-detail-pane" data-pane="req"><div class="tho-rounds" role="group" aria-label="Chọn lượt chỉnh"></div><div class="tho-req-host"></div><p class="tho-empty" hidden></p></div>
        </aside>
        <p class="tho-ws-pick">Chọn một khách bên trái để xem ảnh gốc, ảnh cần chỉnh và chat.</p>
      </div>`;
    anh.before(ws);

    const pages = () => ['khach-cua-toi', 'quy-trinh', 'hoan-tat'].map((id) => document.getElementById(id)).filter(Boolean);
    function showPage(id) {
      if (!pages().some((p) => p.id === id)) id = 'khach-cua-toi';
      document.querySelectorAll('.admin-section').forEach((s) => { s.hidden = s.id !== id; });
      tabsNav.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + id));
      window.scrollTo(0, 0);
    }
    tabsNav.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]'); if (!a) return;
      e.preventDefault(); history.replaceState(null, '', '#' + a.getAttribute('href').slice(1)); showPage(a.getAttribute('href').slice(1));
    });
    showPage((location.hash || '').slice(1));

    // ---------------------------------------------------------------- Dữ liệu: đơn (workflow) + yêu cầu chỉnh
    let orders = [], albums = [], filter = 'todo', openKey = null, tab = null, roundId = null;
    const ST = {
      booked: ['Chờ khách cọc', 'wait'], confirmed: ['Chờ ngày chụp', 'todo'], shooting: ['Đang chụp', 'todo'],
      shot: ['Cần gửi ảnh gốc', 'todo'], choosing: ['Chờ khách chọn ảnh', 'wait'], editing: ['Đang chỉnh ảnh', 'todo'],
      delivered: ['Đã giao ảnh', 'done'], cancelled: ['Đã hủy', 'done']
    };
    function customers() {
      const reqs = desk.requests(), map = new Map();
      orders.filter((o) => o.status !== 'cancelled').forEach((o) => map.set(o.id, { key: o.id, order: o, name: o.customerName, code: o.code, reqs: [] }));
      reqs.forEach((r) => {
        const key = r.workflowOrderId || ('code:' + r.orderCode);
        if (!map.has(key)) map.set(key, { key, order: null, name: r.customerName, code: r.orderCode, reqs: [] });
        map.get(key).reqs.push(r);
      });
      return [...map.values()].map((c) => {
        c.reqs.sort((a, b) => (b.round || 1) - (a.round || 1) || b.createdAt - a.createdAt);
        const open = c.reqs.filter((r) => r.status !== 'Hoàn thành');
        c.unread = c.reqs.filter((r) => desk.awaitingReply(r)).length;
        c.isNew = c.reqs.some((r) => !r.staffSeen && r.status !== 'Hoàn thành');
        const st = c.order ? ST[c.order.status] || [c.order.status, 'wait'] : ['', 'wait'];
        if (open.length) { const n = open.reduce((s, r) => s + (r.photos || []).length, 0); c.line = 'Cần chỉnh ' + n + ' ảnh' + (open.length > 1 ? ' · ' + open.length + ' lượt' : ''); c.group = 'todo'; }
        else { c.line = st[0] || 'Đã xong'; c.group = st[1]; }
        if (c.unread) c.group = 'todo';
        c.sort = (c.unread ? 0 : 1e15) + (c.group === 'todo' ? 0 : 1e14) - Math.max(c.order?.updatedAt || 0, ...c.reqs.map((r) => r.updatedAt || r.createdAt || 0));
        return c;
      }).sort((a, b) => a.sort - b.sort);
    }

    // ---------------------------------------------------------------- Danh sách
    const list = ws.querySelector('.tho-ws-list'), detail = ws.querySelector('.tho-detail');
    function renderList() {
      const all = customers();
      const count = { todo: all.filter((c) => c.group === 'todo').length, wait: all.filter((c) => c.group === 'wait').length, all: all.length };
      ws.querySelectorAll('[data-n]').forEach((b) => { b.textContent = count[b.dataset.n] || ''; });
      const badge = tabsNav.querySelector('.tho-ws-count'); if (badge) { badge.hidden = !count.todo; badge.textContent = count.todo; }
      const shown = all.filter((c) => filter === 'all' || c.group === filter);
      list.innerHTML = shown.length ? shown.map((c) => `<button type="button" role="listitem" class="tho-cust${c.key === openKey ? ' is-open' : ''}${c.group === 'todo' ? ' is-todo' : ''}" data-key="${esc(c.key)}">
          <span class="tho-cust-name">${esc(c.name || 'Khách')}${c.isNew ? '<em class="tho-new">Mới</em>' : ''}</span>
          <span class="tho-cust-code">${esc(c.code || '')}${c.order ? ' · ' + esc(c.order.service || '') : ''}</span>
          <span class="tho-cust-line">${esc(c.line)}</span>
          ${c.unread ? `<span class="tho-cust-chat" aria-label="${c.unread} tin chờ trả lời">💬 ${c.unread}</span>` : ''}
        </button>`).join('')
        : `<p class="tho-empty">${filter === 'todo' ? 'Không có việc cần làm. Nghỉ tay chút nhé!' : 'Chưa có khách nào ở mục này.'}</p>`;
      if (openKey) { const c = all.find((x) => x.key === openKey); if (c) refreshDetail(c); }
    }
    ws.querySelector('.tho-ws-filter').addEventListener('click', (e) => {
      const b = e.target.closest('[data-f]'); if (!b) return;
      filter = b.dataset.f; ws.querySelectorAll('[data-f]').forEach((x) => x.setAttribute('aria-selected', String(x === b))); renderList();
    });
    list.addEventListener('click', (e) => { const b = e.target.closest('[data-key]'); if (b) openCustomer(b.dataset.key); });

    // ---------------------------------------------------------------- Chi tiết khách
    const reqHost = ws.querySelector('.tho-req-host'), rounds = ws.querySelector('.tho-rounds'), reqEmpty = ws.querySelector('[data-pane="req"] .tho-empty');
    let lastRendered = '';
    function defaultTab(c) {
      if (c.unread) return 'chat';
      if (c.reqs.some((r) => r.status !== 'Hoàn thành')) return 'chinh';
      return 'goc';
    }
    function openCustomer(key) {
      const c = customers().find((x) => x.key === key); if (!c) return;
      openKey = key; tab = defaultTab(c); roundId = null; lastRendered = '';
      detail.hidden = false; ws.classList.add('has-detail');
      list.querySelectorAll('.tho-cust').forEach((b) => b.classList.toggle('is-open', b.dataset.key === key));
      refreshDetail(c, true);
      if (matchMedia('(max-width: 900px)').matches) document.body.classList.add('tho-detail-open');
    }
    function closeCustomer() {
      openKey = null; detail.hidden = true; ws.classList.remove('has-detail'); document.body.classList.remove('tho-detail-open');
      list.querySelectorAll('.tho-cust').forEach((b) => b.classList.remove('is-open'));
    }
    ws.querySelector('.tho-detail-back').addEventListener('click', closeCustomer);
    ws.querySelector('.tho-detail-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-t]'); if (!b || b.disabled) return;
      tab = b.dataset.t; const c = customers().find((x) => x.key === openKey); if (c) refreshDetail(c, true);
    });
    rounds.addEventListener('click', (e) => {
      const b = e.target.closest('[data-round]'); if (!b) return;
      roundId = b.dataset.round; lastRendered = ''; const c = customers().find((x) => x.key === openKey); if (c) refreshDetail(c, true);
    });

    function refreshDetail(c, force) {
      const o = c.order;
      ws.querySelector('.tho-detail-title').innerHTML = `<strong>${esc(c.name || 'Khách')}</strong><span>${esc(c.code || '')}${o ? ' · ' + esc(o.service || '') + ' · ' + esc(o.date || '') + ' ' + esc(o.time || '') : ''}</span>`;
      detail.dataset.tab = tab;
      ws.querySelectorAll('[data-t]').forEach((b) => {
        b.setAttribute('aria-selected', String(b.dataset.t === tab));
        if (b.dataset.t === 'chat') b.innerHTML = 'Chat' + (c.unread ? ` <b class="tho-tab-dot">${c.unread}</b>` : '');
        if (b.dataset.t === 'chinh') { const n = c.reqs.filter((r) => r.status !== 'Hoàn thành').length; b.innerHTML = 'Ảnh cần chỉnh' + (n ? ` <b class="tho-tab-n">${n}</b>` : ''); }
      });
      ws.querySelector('[data-pane="goc"]').hidden = tab !== 'goc';
      ws.querySelector('[data-pane="req"]').hidden = tab === 'goc';
      if (tab === 'goc') { if (force) renderOriginals(c); return; }
      // Ảnh cần chỉnh / Chat: dùng chung khung chi tiết yêu cầu, CSS ẩn phần không thuộc tab
      if (!c.reqs.length) {
        rounds.innerHTML = ''; reqHost.hidden = true; reqEmpty.hidden = false;
        reqEmpty.textContent = tab === 'chat' ? 'Khách chưa gửi ảnh cần chỉnh nên chưa có cuộc trò chuyện. Chat mở khi khách gửi lượt đầu tiên.' : 'Khách chưa gửi ảnh cần chỉnh.';
        return;
      }
      if (!roundId || !c.reqs.some((r) => r.id === roundId)) roundId = (c.reqs.find((r) => r.status !== 'Hoàn thành') || c.reqs[0]).id;
      rounds.innerHTML = c.reqs.length > 1 ? c.reqs.map((r) => `<button type="button" data-round="${esc(r.id)}" aria-pressed="${r.id === roundId}">Lượt ${esc(r.round || 1)} · ${r.status === 'Hoàn thành' ? 'Xong' : (r.photos || []).length + ' ảnh'}</button>`).join('') : '';
      reqHost.hidden = false; reqEmpty.hidden = true;
      const r = c.reqs.find((x) => x.id === roundId);
      // Vẽ lại khi đổi lượt / yêu cầu đổi (rev, trạng thái); tin nhắn mới do admin.js tự làm mới khung chat
      const sig = r.id + '|' + r.rev + '|' + r.status + '|' + (r.driveJob?.delivery?.matched || 0);
      if (force || sig !== lastRendered) {
        if (reqHost.contains(document.activeElement) && sig.split('|')[0] === lastRendered.split('|')[0] && document.activeElement.matches('textarea,input')) return; // đang gõ: không vẽ đè
        desk.render(r.id, reqHost); lastRendered = sig;
      }
      if (tab === 'chat') { const l = document.getElementById('kanbanChatList'); if (l) l.scrollTop = l.scrollHeight; }
    }

    // Tab Ảnh gốc: việc của buổi chụp + kéo thả ảnh gốc (đi thẳng lên Drive như trước)
    const gocPane = ws.querySelector('[data-pane="goc"]');
    function renderOriginals(c) {
      const o = c.order;
      if (!o) { gocPane.innerHTML = '<p class="tho-empty">Yêu cầu này không gắn với lịch chụp nào (dữ liệu cũ).</p>'; return; }
      const mine = albums.filter((a) => a.workflowOrderId === o.id).sort((a, b) => b.createdAt - a.createdAt);
      const st = ST[o.status] || [o.status];
      const canUpload = ['shot', 'choosing', 'editing'].includes(o.status) && o.shooterPhone === session.phone;
      gocPane.innerHTML = `<div class="tho-step"><span class="tho-step-label">Trạng thái</span><strong>${esc(st[0])}</strong>
          ${o.status === 'confirmed' && o.shooterPhone === session.phone ? '<button type="button" class="btn btn-primary" data-cmd="checkin">Khách đã đến (Check-in)</button>' : ''}
          ${o.status === 'shooting' && o.shooterPhone === session.phone ? '<button type="button" class="btn btn-primary" data-cmd="shot">Xác nhận đã chụp xong</button>' : ''}
        </div>
        ${canUpload ? `<h3 class="tho-sub">${mine.length ? 'Gửi thêm ảnh gốc' : 'Gửi ảnh gốc cho khách chọn'}</h3><p class="tho-hint">Ảnh lưu thẳng vào Drive, khách thấy ngay trong "Ảnh của tôi".</p><div class="tho-goc-upload"></div>`
          : o.status === 'booked' || o.status === 'confirmed' || o.status === 'shooting' ? '<p class="tho-hint">Chụp xong (bấm "Xác nhận đã chụp xong") thì gửi ảnh gốc ở đây.</p>' : ''}
        ${mine.length ? `<h3 class="tho-sub">Đã gửi cho khách</h3><ul class="tho-albums">${mine.map((a) => `<li><strong>${(a.photos || []).length} ảnh gốc</strong> · gửi ${esc(new Date(a.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }))}${a.folderUrl ? ` · <a href="${esc(a.folderUrl)}" target="_blank" rel="noopener noreferrer">Xem trên Drive</a>` : ''}</li>`).join('')}</ul>` : ''}
        <p class="tho-msg" role="status"></p>`;
      const up = gocPane.querySelector('.tho-goc-upload');
      if (up) AlohaEditSync.mountUpload(up, '/orders/' + encodeURIComponent(o.id), async () => { await loadAlbums(); });
      gocPane.querySelectorAll('[data-cmd]').forEach((b) => b.onclick = async () => {
        b.disabled = true; const msg = gocPane.querySelector('.tho-msg');
        try { const state = await AlohaWorkflow.command(b.dataset.cmd, { id: o.id }); orders = state.orders || orders; }
        catch (e) { msg.textContent = e.message; b.disabled = false; return; }
        renderList(); const fresh = customers().find((x) => x.key === o.id); if (fresh) renderOriginals(fresh);
      });
    }

    // ---------------------------------------------------------------- Tải dữ liệu
    async function loadAlbums() {
      const r = await AlohaEditSync.listSourceAlbums();
      if (r.ok) { albums = r.data.albums || []; const c = customers().find((x) => x.key === openKey); if (c && tab === 'goc' && !gocPane.querySelector('.drive-upload-list:not(:empty)')) renderOriginals(c); }
    }
    window.addEventListener('aloha:workflow', (e) => { orders = (e.detail && e.detail.orders) || orders; renderList(); });
    if (window.AlohaWorkflow) AlohaWorkflow.refresh().then((s) => { orders = s.orders || []; renderList(); }).catch(() => {});
    desk.subscribe({ onChange: renderList, onClose: () => { lastRendered = ''; renderList(); } });
    loadAlbums(); setInterval(loadAlbums, 30000);
    renderList();
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && openKey && document.body.classList.contains('tho-detail-open')) closeCustomer(); });
  });
})();
