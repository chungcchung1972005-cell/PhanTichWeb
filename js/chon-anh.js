// ALOHA Baby — view "Ảnh của tôi" (#/chon-anh trong index.html, xem js/router.js): chọn ảnh cần chỉnh sửa hậu kỳ.
// Demo phía client: dữ liệu ảnh, gói, đơn giá vượt gói đều là MINH HỌA.
// Xem .claude/rules/workflow.md (mục "Giao diện chọn ảnh") và
// .claude/rules/tech-defaults.md (mục "Cấu hình chưa xác định").
document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('psGrid');
  if (!grid) return; // không phải trang chọn ảnh

  const EXTRA_PRICE = 150000;    // đơn giá mỗi ảnh vượt gói — minh họa

  // Chỉ hiện ảnh khi tài khoản này đã từng có buổi chụp (xem js/data-store.js).
  // Khách mới đăng ký chưa từng đặt lịch -> chưa có ảnh nào, hiện trạng thái rỗng.
  const session = window.AlohaAuth ? AlohaAuth.getSession() : null;
  const record = (window.AlohaData && session) ? AlohaData.getCustomerRecord(session.phone) : null;
  const emptyState = document.getElementById('psEmptyState');
  const psContent = document.getElementById('psContent');

  if (!record || !record.hasShoot) {
    if (emptyState) emptyState.hidden = false;
    if (psContent) psContent.style.display = 'none';
    document.getElementById('psOrderInfo').textContent = 'Chưa có buổi chụp nào được ghi nhận cho tài khoản này.';
    const summaryCard = document.getElementById('psSummaryCard');
    if (summaryCard) summaryCard.style.display = 'none';
    return;
  }

  document.getElementById('psOrderInfo').innerHTML =
    `Mã đơn <strong>${record.orderCode}</strong>, buổi chụp ${record.serviceLabel}, gói ${record.packageLabel}`;

  const PACKAGE_COUNT = record.packageCount || 15; // số ảnh trong gói — minh họa, cấu hình thật do studio đặt
  const PHOTO_COUNT = record.photoCount || 16;

  // Ảnh gốc thật (stock miễn phí bản quyền, dùng làm ảnh minh hoạ cho buổi
  // chụp demo — không phải ảnh thật của khách) — xem images/my-photos/.
  const photos = Array.from({ length: PHOTO_COUNT }, (_, i) => ({
    id: 'ph-' + (i + 1),
    src: 'images/my-photos/photo-' + (i + 1) + '.jpg'
  }));

  const heartIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-4.35-9.5-8.5C.7 9.2 2.4 6 5.6 6c1.8 0 3.1 1 3.9 2.3.8 1.3 1 1.3 1 1.3s.2 0 1-1.3C12.3 7 13.6 6 15.4 6c3.2 0 4.9 3.2 3.1 6.5C16 16.65 12 21 12 21z"/></svg>';

  grid.innerHTML = photos.map((p) => `
    <div class="ps-photo" data-id="${p.id}">
      <img src="${p.src}" alt="Ảnh gốc buổi chụp ${record.serviceLabel}" loading="lazy">
      <span class="ps-photo-badge">Ảnh gốc</span>
      <button type="button" class="ps-heart" aria-label="Chọn ảnh ${p.id}" aria-pressed="false">${heartIcon}</button>
    </div>
  `).join('');

  const selected = new Set();
  const photoNotes = new Map(); // id -> ghi chú riêng cho ảnh đó
  const photoById = Object.fromEntries(photos.map(p => [p.id, p]));
  const countEl = document.getElementById('selectedCount');
  const packageEl = document.getElementById('packageCount');
  const barEl = document.getElementById('psProgressBar');
  const extraBox = document.getElementById('psExtra');
  const extraCountEl = document.getElementById('extraCount');
  const extraFeeEl = document.getElementById('extraFee');
  const submitBtn = document.getElementById('psSubmitBtn');
  const banner = document.getElementById('psSubmittedBanner');
  const photoNotesSection = document.getElementById('psPhotoNotes');
  const photoNotesList = document.getElementById('psPhotoNotesList');

  // Ghi chú riêng cho từng ảnh đã chọn — chỉ ảnh nào được thả tim mới cần
  // ghi chú riêng, cạnh "Ghi chú chỉnh sửa chung" áp dụng cho cả bộ.
  function renderPhotoNotes() {
    if (!photoNotesSection || !photoNotesList) return;
    const ids = Array.from(selected);
    photoNotesSection.hidden = ids.length === 0;
    if (ids.length === 0) return;

    photoNotesList.innerHTML = ids.map(id => `
      <div class="ps-photo-note-row" data-id="${id}">
        <img src="${photoById[id].src}" alt="Ảnh ${id}">
        <textarea placeholder="Ghi chú riêng cho ảnh này (vd: xoá vết đỏ trên má)...">${photoNotes.get(id) || ''}</textarea>
      </div>
    `).join('');
    photoNotesList.querySelectorAll('textarea').forEach(ta => {
      ta.addEventListener('input', () => {
        const id = ta.closest('.ps-photo-note-row').dataset.id;
        photoNotes.set(id, ta.value);
      });
    });
  }

  packageEl.textContent = PACKAGE_COUNT;

  function updateSummary() {
    const n = selected.size;
    countEl.textContent = n;
    const pct = Math.min(100, (n / PACKAGE_COUNT) * 100);
    barEl.style.width = pct + '%';
    barEl.classList.toggle('over', n > PACKAGE_COUNT);

    if (n > PACKAGE_COUNT) {
      const extra = n - PACKAGE_COUNT;
      extraBox.hidden = false;
      extraCountEl.textContent = extra;
      extraFeeEl.textContent = (extra * EXTRA_PRICE).toLocaleString('vi-VN') + 'đ';
    } else {
      extraBox.hidden = true;
    }

    submitBtn.disabled = n === 0;
  }

  grid.addEventListener('click', (e) => {
    const heartBtn = e.target.closest('.ps-heart');
    if (!heartBtn || heartBtn.disabled) return;
    const card = heartBtn.closest('.ps-photo');
    const id = card.dataset.id;
    const isSelected = card.classList.toggle('selected');
    heartBtn.setAttribute('aria-pressed', isSelected);
    if (isSelected) selected.add(id); else selected.delete(id);
    updateSummary();
    renderPhotoNotes();
  });

  // Tabs: Tất cả / Ảnh gốc (toàn bộ ảnh trong trang này đều là ảnh gốc chờ chọn) / Yêu thích (đã chọn)
  document.querySelectorAll('.ps-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.ps-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const filter = tab.dataset.filter;
      document.querySelectorAll('.ps-photo').forEach((card) => {
        const show = filter === 'all' || filter === 'original' || (filter === 'liked' && card.classList.contains('selected'));
        card.classList.toggle('hidden-by-filter', !show);
      });
    });
  });

  submitBtn.addEventListener('click', () => {
    if (selected.size === 0) return;
    // Khóa toàn bộ lựa chọn sau khi gửi (đúng luồng trong workflow.md)
    document.querySelectorAll('.ps-heart').forEach((btn) => { btn.disabled = true; });
    submitBtn.disabled = true;
    submitBtn.textContent = 'Đã gửi yêu cầu';
    banner.classList.add('show');
    banner.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Tạo yêu cầu thật trong kho dữ liệu demo dùng chung -> Thợ ảnh/Sếp đăng
    // nhập trên cùng trình duyệt sẽ thấy yêu cầu này trong crm/admin.html.
    if (window.AlohaData && session) {
      const perPhotoNotes = Array.from(selected)
        .map(id => ({ id, note: (photoNotes.get(id) || '').trim() }))
        .filter(n => n.note);
      // Danh sách đầy đủ ảnh đã chọn (kèm src + ghi chú riêng nếu có) -> Thợ
      // ảnh/Sếp xem được đúng những ảnh nào nằm trong yêu cầu này.
      const allSelectedPhotos = Array.from(selected)
        .map(id => ({ id, src: photoById[id].src, note: (photoNotes.get(id) || '').trim() }));

      AlohaData.createEditRequest({
        phone: session.phone,
        customerName: session.name,
        orderCode: record.orderCode,
        serviceLabel: record.serviceLabel,
        photoCount: selected.size,
        note: document.getElementById('psNote').value.trim(),
        photoNotes: perPhotoNotes,
        photos: allSelectedPhotos
      });
    }

    if (photoNotesSection) photoNotesSection.hidden = true;
  });

  updateSummary();
});
