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
      <input type="search" class="tho-ws-search" placeholder="Tìm tên, SĐT hoặc mã đơn" aria-label="Tìm khách">
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
    let orders = [], albums = [], filter = 'todo', openKey = null, tab = null, roundId = null, picflowFilter = 'all';
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
    function thoNorm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").trim(); }
    const searchBox = ws.querySelector(".tho-ws-search");
    if (searchBox) searchBox.addEventListener("input", () => renderList());
    function renderList() {
      const all = customers();
      const count = { todo: all.filter((c) => c.group === 'todo').length, wait: all.filter((c) => c.group === 'wait').length, all: all.length };
      ws.querySelectorAll('[data-n]').forEach((b) => { b.textContent = count[b.dataset.n] || ''; });
      const badge = tabsNav.querySelector('.tho-ws-count'); if (badge) { badge.hidden = !count.todo; badge.textContent = count.todo; }
      const q = thoNorm(searchBox ? searchBox.value : ""); const shown = all.filter((c) => (filter === "all" || c.group === filter) && (!q || thoNorm([c.key, c.name, c.phone, c.order && c.order.customerName, c.order && c.order.phone, c.order && c.order.orderCode].join(" ")).includes(q)));
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
      openKey = key; tab = defaultTab(c); roundId = null; lastRendered = ''; picflowFilter = 'all';
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
      roundId = b.dataset.round; lastRendered = ''; picflowFilter = 'all'; const c = customers().find((x) => x.key === openKey); if (c) refreshDetail(c, true);
    });

    // ---------------------------------------------------------------- Picflow: Trạng thái ảnh + bộ lọc số đếm
    function photoFilename(photoId) {
      const n = parseInt((String(photoId).match(/\d+/) || ['0'])[0], 10);
      return 'IMG_' + (7800 + ((n * 37 + 13) % 200)) + '.JPG';
    }

    function isPhotoDone(p, r) {
      if (!p || !r) return false;
      if (r.status === 'Hoàn thành' || p.matched === true) return true;
      const pIdStr = String(p.id || '');
      const pIdNum = pIdStr.replace(/\D+/g, '');
      if (Array.isArray(r.doneIds) && r.doneIds.some((id) => {
        const s = String(id || '');
        return s === pIdStr || (pIdNum && s.replace(/\D+/g, '') === pIdNum);
      })) {
        return true;
      }
      const delivery = r.driveJob && r.driveJob.delivery;
      if (delivery) {
        if (delivery.status === 'delivered') return true;
        const fname = p.name || photoFilename(p.id);
        if (Array.isArray(delivery.missing)) {
          if (!delivery.missing.includes(fname) && !delivery.missing.includes(pIdStr) && (Number(delivery.matched) > 0)) {
            return true;
          }
        }
      }
      return false;
    }

    function isPhotoRedo(p) {
      return !!(p && p.fromEdited === true);
    }

    function isPhotoTodo(p, r) {
      return !isPhotoDone(p, r) && !isPhotoRedo(p);
    }

    function renderPicflow(r, host) {
      const modalBody = host.querySelector('#kanbanModalBody') || host;
      const photos = Array.isArray(r.photos) ? r.photos : [];

      const countTodo = photos.filter((p) => isPhotoTodo(p, r)).length;
      const countDone = photos.filter((p) => isPhotoDone(p, r)).length;
      const countRedo = photos.filter((p) => isPhotoRedo(p)).length;
      const countAll = photos.length;

      // 1. Hàng chip lọc có số đếm (Cần sửa, Đã có bản sửa, Sửa lại, Tất cả)
      let bar = modalBody.querySelector('.tho-picflow-bar');
      if (!bar) {
        bar = document.createElement('div');
        bar.className = 'tho-picflow-bar';
        bar.setAttribute('role', 'tablist');
        bar.setAttribute('aria-label', 'Lọc trạng thái ảnh');
        const anchor = modalBody.querySelector('.photo-copy-row') || modalBody.querySelector('.kanban-photo-grid');
        if (anchor) modalBody.insertBefore(bar, anchor);
        else modalBody.prepend(bar);
      }

      bar.innerHTML = `
        <button type="button" class="tho-chip${picflowFilter === 'todo' ? ' is-active' : ''}" data-chip="todo" role="tab" aria-selected="${picflowFilter === 'todo'}">
          Cần sửa <b class="tho-chip-count">${countTodo}</b>
        </button>
        <button type="button" class="tho-chip${picflowFilter === 'done' ? ' is-active' : ''}" data-chip="done" role="tab" aria-selected="${picflowFilter === 'done'}">
          Đã có bản sửa <b class="tho-chip-count">${countDone}</b>
        </button>
        <button type="button" class="tho-chip${countRedo > 0 ? ' has-redo' : ''}${picflowFilter === 'redo' ? ' is-active' : ''}" data-chip="redo" role="tab" aria-selected="${picflowFilter === 'redo'}">
          Sửa lại <b class="tho-chip-count">${countRedo}</b>
        </button>
        <button type="button" class="tho-chip${picflowFilter === 'all' ? ' is-active' : ''}" data-chip="all" role="tab" aria-selected="${picflowFilter === 'all'}">
          Tất cả <b class="tho-chip-count">${countAll}</b>
        </button>
      `;

      bar.onclick = (e) => {
        const btn = e.target.closest('.tho-chip');
        if (!btn) return;
        picflowFilter = btn.dataset.chip || 'all';
        bar.querySelectorAll('.tho-chip').forEach((b) => {
          const active = b === btn;
          b.classList.toggle('is-active', active);
          b.setAttribute('aria-selected', String(active));
        });
        applyPicflowFilter();
      };

      // 2. Gắn nhãn trạng thái và ghi chú vào từng ô ảnh trong .kanban-photo-grid
      const grid = modalBody.querySelector('.kanban-photo-grid');
      let compactList = modalBody.querySelector('.tho-compact-photo-list');

      if (grid) {
        if (compactList) compactList.remove();
        photos.forEach((p, idx) => {
          const tile = grid.querySelector(`.kanban-photo-tile[data-photo-id="${esc(p.id)}"]`) || grid.children[idx];
          if (!tile) return;
          const done = isPhotoDone(p, r);
          const redo = isPhotoRedo(p);
          const todo = isPhotoTodo(p, r);

          tile.classList.toggle('is-todo', todo);
          tile.classList.toggle('is-done', done);
          tile.classList.toggle('is-redo', redo);

          let badgesEl = tile.querySelector('.tho-photo-badges');
          if (!badgesEl) {
            badgesEl = document.createElement('div');
            badgesEl.className = 'tho-photo-badges';
            const img = tile.querySelector('img');
            if (img && img.nextSibling) tile.insertBefore(badgesEl, img.nextSibling);
            else tile.prepend(badgesEl);
          }
          let badgesHtml = '';
          if (redo) badgesHtml += '<span class="tho-tag tho-tag-redo">Sửa lại</span>';
          if (done) badgesHtml += '<span class="tho-tag tho-tag-done">Đã có bản sửa</span>';
          if (todo) badgesHtml += '<span class="tho-tag tho-tag-todo">Cần sửa</span>';
          badgesEl.innerHTML = badgesHtml;

          let redoNoteEl = tile.querySelector('.tho-photo-redo-note');
          if (redo && !tile.querySelector("p.note")) {
            if (!redoNoteEl) {
              redoNoteEl = document.createElement('div');
              redoNoteEl.className = 'tho-photo-redo-note';
              if (badgesEl.nextSibling) tile.insertBefore(redoNoteEl, badgesEl.nextSibling);
              else tile.appendChild(redoNoteEl);
            }
            redoNoteEl.innerHTML = p.note
              ? `<strong>Ghi chú khách:</strong> "${esc(p.note)}"`
              : '<strong>Ghi chú:</strong> Khách yêu cầu chỉnh sửa lại ảnh này';
            redoNoteEl.hidden = false;
          } else if (redoNoteEl) {
            redoNoteEl.hidden = true;
          }
        });
      } else if (photos.length > 0) {
        // Trường hợp dự phòng nếu không tìm thấy .kanban-photo-grid: dựng danh sách gọn 64px
        if (!compactList) {
          compactList = document.createElement('div');
          compactList.className = 'tho-compact-photo-list';
          compactList.setAttribute('role', 'list');
          bar.insertAdjacentElement('afterend', compactList);
        }
        compactList.innerHTML = photos.map((p) => {
          const done = isPhotoDone(p, r);
          const redo = isPhotoRedo(p);
          const todo = isPhotoTodo(p, r);
          const fname = p.name || photoFilename(p.id);
          const badges = (redo ? '<span class="tho-tag tho-tag-redo">Sửa lại</span>' : '') +
                         (done ? '<span class="tho-tag tho-tag-done">Đã có bản sửa</span>' : '') +
                         (todo ? '<span class="tho-tag tho-tag-todo">Cần sửa</span>' : '');
          const cls = ['tho-compact-tile', todo ? 'is-todo' : '', done ? 'is-done' : '', redo ? 'is-redo' : ''].filter(Boolean).join(' ');
          const noteHtml = redo
            ? `<div class="tho-photo-redo-note">${p.note ? `<strong>Ghi chú khách:</strong> "${esc(p.note)}"` : 'Khách yêu cầu chỉnh sửa lại ảnh này'}</div>`
            : (p.note ? `<p class="tho-compact-note">"${esc(p.note)}"</p>` : '');
          return `
            <article class="${cls}" data-photo-id="${esc(p.id)}" role="listitem">
              <img class="tho-compact-img" src="${esc(p.src)}" alt="Ảnh ${esc(fname)}" loading="lazy">
              <div class="tho-compact-info">
                <div class="tho-compact-top">
                  <span class="tho-compact-name">${esc(fname)}</span>
                  <div class="tho-photo-badges">${badges}</div>
                </div>
                ${noteHtml}
              </div>
            </article>`;
        }).join('');
      }

      // Thông báo khi lọc không có kết quả
      let emptyEl = modalBody.querySelector('.tho-picflow-empty');
      if (!emptyEl) {
        emptyEl = document.createElement('p');
        emptyEl.className = 'tho-picflow-empty';
        emptyEl.hidden = true;
        if (grid) grid.insertAdjacentElement('afterend', emptyEl);
        else if (compactList) compactList.insertAdjacentElement('afterend', emptyEl);
        else bar.insertAdjacentElement('afterend', emptyEl);
      }

      // 3. Hàm lọc theo class (không vẽ lại khung)
      function applyPicflowFilter() {
        const tiles = modalBody.querySelectorAll('.kanban-photo-tile, .tho-compact-tile');
        let visible = 0;
        tiles.forEach((t) => {
          let show = false;
          if (picflowFilter === 'all') show = true;
          else if (picflowFilter === 'todo') show = t.classList.contains('is-todo');
          else if (picflowFilter === 'done') show = t.classList.contains('is-done');
          else if (picflowFilter === 'redo') show = t.classList.contains('is-redo');
          t.classList.toggle('is-picflow-hidden', !show);
          t.hidden = !show;
          if (show) visible++;
        });
        if (emptyEl) {
          emptyEl.hidden = visible > 0 || photos.length === 0;
          if (visible === 0 && photos.length > 0) {
            const labels = { todo: 'cần sửa', done: 'đã có bản sửa', redo: 'sửa lại' };
            emptyEl.textContent = `Không có ảnh nào ở mục ${labels[picflowFilter] || 'này'}.`;
          }
        }
      }

      applyPicflowFilter();

      // Theo dõi số đếm ảnh nhận trên Drive nếu có
      const driveCount = modalBody.querySelector('[data-drive-count]');
      if (driveCount && !driveCount._picflowObs) {
        driveCount._picflowObs = new MutationObserver(() => {
          renderPicflow(r, host);
        });
        driveCount._picflowObs.observe(driveCount, { childList: true, characterData: true, subtree: true });
      }
    }

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
      renderPicflow(r, reqHost);
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
    window.addEventListener('aloha:deposit-confirmed', (e) => {
      const detail = e.detail;
      if (window.AlohaWorkflow) {
        const wf = AlohaWorkflow.get();
        if (wf && wf.orders) { orders = wf.orders; renderList(); }
      }
      const session = window.AlohaAuth && AlohaAuth.getSession();
      if (session && session.role === 'tho-anh' && detail) {
        const noticeEl = document.createElement('div');
        noticeEl.className = 'tho-deposit-toast';
        noticeEl.innerHTML = `🔔 <strong>Lịch chụp mới:</strong> Đơn #${esc(detail.code)} đã cọc thành công!`;
        document.body.appendChild(noticeEl);
        setTimeout(() => { noticeEl.remove(); }, 5000);
      }
    });
    if (window.AlohaWorkflow) AlohaWorkflow.refresh().then((s) => { orders = s.orders || []; renderList(); }).catch(() => {});
    desk.subscribe({ onChange: renderList, onClose: () => { lastRendered = ''; renderList(); } });
    loadAlbums(); setInterval(loadAlbums, 30000);
    renderList();
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && openKey && document.body.classList.contains('tho-detail-open')) closeCustomer(); });
  });
})();
