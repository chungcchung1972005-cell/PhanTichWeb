// ALOHA Baby — mục "Tiền chưa khớp" của Sếp (2026-10-31). Đọc /api/edit-requests/unmatched-payments
// (máy chủ tự đối chiếu biên lai SePay với yêu cầu chỉnh ảnh), 30 giây hỏi lại 1 lần.
// Không có mục này trên trang (vai trò khác) thì không làm gì.
(function () {
  const box = document.getElementById('unmatchedList');
  const session = window.AlohaAuth && AlohaAuth.getSession && AlohaAuth.getSession();
  // Chỉ Sếp, và chỉ khi bật đồng bộ ảnh (cờ editSync) như mọi phần gọi /api/edit-requests khác
  if (!box || !session || session.role !== 'sep' || !window.AlohaEditSync || !AlohaEditSync.enabled()) return;
  const tab = document.querySelector('#adminTabs a[href="#tien-chua-khop"]');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => Number(n || 0).toLocaleString('vi-VN') + 'đ';
  const when = (ts) => { const d = new Date(ts); const p = (n) => String(n).padStart(2, '0'); return p(d.getHours()) + ':' + p(d.getMinutes()) + ' ' + p(d.getDate()) + '/' + p(d.getMonth() + 1); };

  function setBadge(n) {
    if (!tab) return;
    let b = tab.querySelector('.admin-tab-badge');
    if (!n) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('span'); b.className = 'admin-tab-badge'; tab.appendChild(b); }
    b.textContent = n;
  }

  function render(data) {
    const list = data.payments || [];
    setBadge(data.open || 0);
    box.innerHTML = list.length ? list.map((p) =>
      '<div class="unmatched-row">' +
        '<div class="unmatched-info"><strong><span class="unmatched-amount">' + money(p.amount) + '</span> · ' + esc(p.reason) + '</strong>' +
        '<small>' + when(p.at) + ' · Nội dung: "' + esc(p.content) + '"' + (p.customerName ? ' · ' + esc(p.customerName) : '') + (p.phone ? ' ' + esc(p.phone) : '') + (p.orderCode ? ' · Đơn ' + esc(p.orderCode) : '') + '</small></div>' +
        '<button type="button" class="btn btn-outline btn-sm" data-resolve="' + esc(p.id) + '">Đã xử lý</button>' +
      '</div>').join('')
      : '<p class="unmatched-empty">Không có khoản nào cần xử lý. Mọi khoản tiền về đều đã tự khớp.</p>';
  }

  let busy = false;
  async function load() {
    if (busy) return; busy = true;
    try {
      const r = await AlohaAuth.api('/api/edit-requests/unmatched-payments');
      if (r.ok) render(r.data);
      else if (!box.querySelector('.unmatched-row')) box.innerHTML = '<p class="unmatched-empty">Chưa kết nối được máy chủ, đang thử lại…</p>';
    } catch (_) { /* thử lại lượt sau */ } finally { busy = false; }
  }

  box.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-resolve]'); if (!btn) return;
    btn.disabled = true;
    const r = await AlohaAuth.api('/api/edit-requests/unmatched-payments/' + encodeURIComponent(btn.dataset.resolve) + '/resolve', { method: 'POST' });
    if (!r.ok) { btn.disabled = false; btn.textContent = 'Thử lại'; return; }
    load();
  });

  load();
  setInterval(load, 30000);
})();
