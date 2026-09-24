// ALOHA Baby - view "Ảnh của tôi" (#/chon-anh trong index.html, xem js/router.js): chọn ảnh cần chỉnh sửa hậu kỳ.
// Demo phía client: dữ liệu ảnh, gói, đơn giá vượt gói đều là MINH HỌA.
// Xem .claude/rules/workflow.md (mục "Giao diện chọn ảnh") và
// .claude/rules/tech-defaults.md (mục "Cấu hình chưa xác định").
document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('psGrid');
  if (!grid) return; // không phải trang chọn ảnh

  const EXTRA_PRICE = 50000;     // đơn giá mỗi ảnh chỉnh sửa thêm: 50K/tấm
  const PACKAGE_COUNT = 10;      // gói tiêu chuẩn: 10 tấm ảnh miễn phí
  const FAV_LIMIT = 10;          // giới hạn ảnh yêu thích miễn phí trong gói

  // Chỉ hiện ảnh khi tài khoản này đã từng có buổi chụp (xem js/data-store.js).
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

  const PHOTO_COUNT = record.photoCount || 16;

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
  const extraPhotos = new Set();   // ảnh chỉnh sửa thêm (vượt gói)
  let extraModeActive = false;     // khách đã đồng ý chỉnh sửa thêm
  const photoNotes = new Map();
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
  const generalNoteBox = document.getElementById('psGeneralNote');

  // ===== Tạo popup hỏi chỉnh sửa thêm =====
  const overlay = document.createElement('div');
  overlay.className = 'ps-modal-overlay';
  overlay.innerHTML = `
    <div class="ps-modal">
      <div class="ps-modal-emoji">📸</div>
      <p class="ps-modal-text">Bạn có muốn chỉnh sửa thêm ảnh cho bé yêu nhà mình?<br><strong>Chỉ 50K/tấm thui nè 💕</strong></p>
      <div class="ps-modal-actions">
        <button class="ps-modal-btn ps-modal-yes">Yes</button>
        <button class="ps-modal-btn ps-modal-no">No</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  let pendingExtraId = null; // id ảnh đang chờ xác nhận

  overlay.querySelector('.ps-modal-yes').addEventListener('click', () => {
    overlay.classList.remove('show');
    if (pendingExtraId) {
      extraModeActive = true;
      extraPhotos.add(pendingExtraId);
      selected.add(pendingExtraId);
      const card = grid.querySelector(`[data-id="${pendingExtraId}"]`);
      if (card) {
        card.classList.add('selected', 'ps-extra-photo');
        card.querySelector('.ps-heart').setAttribute('aria-pressed', 'true');
      }
      updateSummary();
      renderPhotoNotes();
      // Chuyển sang tab Yêu thích
      switchToTab('liked');
      pendingExtraId = null;
    }
  });

  overlay.querySelector('.ps-modal-no').addEventListener('click', () => {
    overlay.classList.remove('show');
    if (pendingExtraId) {
      // Bỏ chọn ảnh vừa bấm
      const card = grid.querySelector(`[data-id="${pendingExtraId}"]`);
      if (card) {
        card.classList.remove('selected');
        card.querySelector('.ps-heart').setAttribute('aria-pressed', 'false');
      }
      selected.delete(pendingExtraId);
      pendingExtraId = null;
      updateSummary();
    }
  });

  // ===== Ô dấu cộng (thêm ảnh yêu thích) =====
  const addBox = document.createElement('div');
  addBox.className = 'ps-add-photo';
  addBox.innerHTML = `
    <div class="ps-add-icon">+</div>
    <span>Thêm ảnh</span>
  `;
  addBox.addEventListener('click', () => {
    // Chuyển về tab Tất cả để khách chọn thêm ảnh
    switchToTab('all');
  });

  // ===== Modal QR Chuyển Khoản Cá Nhân Hóa =====
  const qrOverlay = document.createElement('div');
  qrOverlay.className = 'ps-qr-overlay';
  qrOverlay.id = 'psQrModalOverlay';
  qrOverlay.innerHTML = `
    <div class="ps-qr-modal" role="dialog" aria-modal="true" aria-labelledby="psQrTitle">
      <button type="button" class="ps-qr-close" id="psQrCloseBtn" aria-label="Đóng popup">&times;</button>
      
      <div class="ps-qr-header">
        <div class="ps-qr-icon-wrap">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
            <line x1="7" y1="7" x2="7.01" y2="7"></line>
            <line x1="17" y1="7" x2="17.01" y2="7"></line>
            <line x1="7" y1="17" x2="7.01" y2="17"></line>
            <line x1="17" y1="17" x2="17.01" y2="17"></line>
          </svg>
        </div>
        <div>
          <h3 id="psQrTitle">Mã QR Chuyển Khoản Cá Nhân Hóa</h3>
          <p class="ps-qr-subtitle">Thanh toán phí chỉnh sửa ảnh thêm ngoài gói 10 ảnh</p>
        </div>
      </div>

      <!-- Tóm tắt chi phí & nhân tự động -->
      <div class="ps-qr-calc-card">
        <div class="ps-qr-calc-row">
          <span>Mã khách hàng:</span>
          <strong class="ps-code-tag" id="psQrCustCode">#AB240915</strong>
        </div>
        <div class="ps-qr-calc-row">
          <span>Gói tiêu chuẩn:</span>
          <span>10 ảnh (Đã bao gồm)</span>
        </div>
        <div class="ps-qr-calc-row">
          <span>Số ảnh chọn thêm:</span>
          <strong class="ps-extra-count-tag">+<span id="psQrExtraCount">0</span> ảnh</strong>
        </div>
        <div class="ps-qr-calc-row">
          <span>Đơn giá chỉnh sửa thêm:</span>
          <span>50.000đ / ảnh</span>
        </div>
        <div class="ps-qr-calc-total">
          <div>
            <span class="ps-total-label">Số tiền khách cần chuyển:</span>
            <small class="ps-total-sub">(Hệ thống tự động tính: 50K × <span id="psQrExtraSub">0</span> ảnh)</small>
          </div>
          <div class="ps-total-val" id="psQrTotalAmount">0đ</div>
        </div>
      </div>

      <!-- Khung hiển thị ảnh QR VietQR -->
      <div class="ps-qr-frame">
        <div class="ps-qr-img-wrapper">
          <img id="psQrImage" src="" alt="Mã QR Chuyển khoản VietQR" class="ps-qr-img" />
        </div>
        <p class="ps-qr-hint">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Quét bằng ứng dụng <strong>Ngân hàng</strong> hoặc <strong>MoMo</strong> (STK, số tiền & nội dung đã được điền tự động).
        </p>
      </div>

      <!-- Bảng thông tin chuyển khoản thủ công & copy -->
      <div class="ps-bank-details">
        <div class="ps-bank-row">
          <div class="ps-bank-label">Ngân hàng:</div>
          <div class="ps-bank-val"><strong>MB Bank</strong> (Ngân hàng Quân Đội)</div>
        </div>
        <div class="ps-bank-row">
          <div class="ps-bank-label">Số tài khoản:</div>
          <div class="ps-bank-val">
            <strong id="psBankAccNum">0938125222</strong>
            <button type="button" class="ps-copy-btn" data-copy="0938125222">Sao chép</button>
          </div>
        </div>
        <div class="ps-bank-row">
          <div class="ps-bank-label">Chủ tài khoản:</div>
          <div class="ps-bank-val"><strong>ALOHA BABY STUDIO</strong></div>
        </div>
        <div class="ps-bank-row">
          <div class="ps-bank-label">Số tiền:</div>
          <div class="ps-bank-val">
            <strong class="highlight" id="psBankAmount">0đ</strong>
            <button type="button" class="ps-copy-btn" id="psCopyAmountBtn" data-copy="">Sao chép</button>
          </div>
        </div>
        <div class="ps-bank-row">
          <div class="ps-bank-label">Nội dung CK:</div>
          <div class="ps-bank-val">
            <strong class="highlight" id="psBankContent">AB240915 CS ANH</strong>
            <button type="button" class="ps-copy-btn" id="psCopyContentBtn" data-copy="">Sao chép</button>
          </div>
        </div>
      </div>

      <!-- Nút hành động -->
      <div class="ps-qr-actions">
        <button type="button" class="btn btn-primary ps-qr-confirm-btn" id="psQrConfirmPaidBtn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
          Tôi đã chuyển khoản xong
        </button>
        <button type="button" class="btn btn-secondary ps-qr-later-btn" id="psQrLaterBtn">Thanh toán sau & Đóng</button>
      </div>
    </div>
  `;
  document.body.appendChild(qrOverlay);

  // Copy thông tin ngân hàng
  qrOverlay.querySelectorAll('.ps-copy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = btn.dataset.copy;
      if (!val) return;
      navigator.clipboard.writeText(val).then(() => {
        const origText = btn.textContent;
        btn.textContent = '✓ Đã chép';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = origText;
          btn.classList.remove('copied');
        }, 2000);
      });
    });
  });

  let currentPendingExtraCount = 0;
  let currentPendingExtraFee = 0;

  function openQrPaymentModal(extraCount, extraFee) {
    currentPendingExtraCount = extraCount;
    currentPendingExtraFee = extraFee;

    const cleanCode = (record.orderCode || 'AB240915').replace(/[^a-zA-Z0-9]/g, '');
    const qrDescription = `${cleanCode} CS ${extraCount} ANH`;
    const bankId = 'MB';
    const accountNo = '0938125222';
    const accountName = 'ALOHA BABY STUDIO';
    const qrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${extraFee}&addInfo=${encodeURIComponent(qrDescription)}&accountName=${encodeURIComponent(accountName)}`;

    document.getElementById('psQrCustCode').textContent = record.orderCode || '#AB240915';
    document.getElementById('psQrExtraCount').textContent = extraCount;
    document.getElementById('psQrExtraSub').textContent = extraCount;
    document.getElementById('psQrTotalAmount').textContent = extraFee.toLocaleString('vi-VN') + 'đ';
    document.getElementById('psBankAmount').textContent = extraFee.toLocaleString('vi-VN') + 'đ';
    document.getElementById('psBankContent').textContent = qrDescription;
    
    // Cập nhật giá trị nút copy
    document.getElementById('psCopyAmountBtn').dataset.copy = extraFee;
    document.getElementById('psCopyContentBtn').dataset.copy = qrDescription;

    const qrImg = document.getElementById('psQrImage');
    qrImg.src = qrUrl;

    qrOverlay.classList.add('show');
  }

  function closeQrPaymentModal() {
    qrOverlay.classList.remove('show');
  }

  document.getElementById('psQrCloseBtn').addEventListener('click', () => {
    closeQrPaymentModal();
    executeSubmit(currentPendingExtraCount, currentPendingExtraFee, 'Chờ chuyển khoản');
  });

  document.getElementById('psQrLaterBtn').addEventListener('click', () => {
    closeQrPaymentModal();
    executeSubmit(currentPendingExtraCount, currentPendingExtraFee, 'Chờ chuyển khoản');
  });

  document.getElementById('psQrConfirmPaidBtn').addEventListener('click', () => {
    closeQrPaymentModal();
    executeSubmit(currentPendingExtraCount, currentPendingExtraFee, 'Khách xác nhận đã chuyển khoản');
  });

  qrOverlay.addEventListener('click', (e) => {
    if (e.target === qrOverlay) {
      closeQrPaymentModal();
      executeSubmit(currentPendingExtraCount, currentPendingExtraFee, 'Chờ chuyển khoản');
    }
  });

  let currentFilter = 'all';

  function renderPhotoNotes() {
    if (!photoNotesSection || !photoNotesList) return;
    const ids = Array.from(selected);

    // Ẩn mục ghi chú riêng khi ở tab "Ảnh gốc" hoặc "Tất cả", chỉ hiển thị ở tab "Yêu thích" khi có ảnh chọn
    if (currentFilter === 'original' || currentFilter === 'all' || ids.length === 0) {
      photoNotesSection.hidden = true;
    } else {
      photoNotesSection.hidden = false;
    }

    if (ids.length === 0) return;

    photoNotesList.innerHTML = ids.map(id => `
      <div class="ps-photo-note-row" data-id="${id}">
        <img src="${photoById[id].src}" alt="Ảnh ${id}">
        ${extraPhotos.has(id) ? '<span class="ps-extra-tag">Chỉnh sửa thêm +50K</span>' : ''}
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

    const extraCount = Math.max(0, n - PACKAGE_COUNT);
    if (extraCount > 0) {
      extraBox.hidden = false;
      extraCountEl.textContent = extraCount;
      extraFeeEl.textContent = (extraCount * EXTRA_PRICE).toLocaleString('vi-VN') + 'đ';
    } else {
      extraBox.hidden = true;
    }

    submitBtn.disabled = n === 0;
  }

  // ===== Xử lý click chọn ảnh =====
  grid.addEventListener('click', (e) => {
    const heartBtn = e.target.closest('.ps-heart');
    if (!heartBtn || heartBtn.disabled) return;
    const card = heartBtn.closest('.ps-photo');
    const id = card.dataset.id;

    // Nếu đang bỏ chọn
    if (selected.has(id)) {
      card.classList.remove('selected', 'ps-extra-photo');
      heartBtn.setAttribute('aria-pressed', 'false');
      selected.delete(id);
      extraPhotos.delete(id);

      // Nếu số ảnh còn lại <= PACKAGE_COUNT thì không còn ảnh nào là extra nữa
      if (selected.size <= PACKAGE_COUNT) {
        extraPhotos.clear();
        extraModeActive = false;
        document.querySelectorAll('.ps-photo').forEach(c => {
          c.classList.remove('ps-extra-photo');
        });
      }

      updateSummary();
      renderPhotoNotes();
      return;
    }

    // Nếu đã đủ giới hạn PACKAGE_COUNT (10 ảnh)
    if (selected.size >= PACKAGE_COUNT) {
      if (extraModeActive) {
        // Đã đồng ý chỉnh sửa thêm -> thêm trực tiếp
        extraPhotos.add(id);
        selected.add(id);
        card.classList.add('selected', 'ps-extra-photo');
        heartBtn.setAttribute('aria-pressed', 'true');
        updateSummary();
        renderPhotoNotes();
      } else {
        // Chưa đồng ý -> hiện popup hỏi
        pendingExtraId = id;
        overlay.classList.add('show');
      }
      return;
    }

    // Chưa đạt giới hạn -> chọn bình thường trong gói
    card.classList.add('selected');
    heartBtn.setAttribute('aria-pressed', 'true');
    selected.add(id);
    updateSummary();
    renderPhotoNotes();
  });

  // ===== Hàm chuyển tab =====
  function switchToTab(filterName) {
    document.querySelectorAll('.ps-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.filter === filterName);
    });
    applyFilter(filterName);
  }

  function applyFilter(filter) {
    currentFilter = filter;

    // Xoá ô dấu cộng cũ nếu có
    const existingAdd = grid.querySelector('.ps-add-photo');
    if (existingAdd) existingAdd.remove();

    document.querySelectorAll('.ps-photo').forEach((card) => {
      let show;
      if (filter === 'all' || filter === 'original') {
        show = true;
        // Hiện badge "Chỉnh sửa thêm" trên ảnh extra ở mọi tab
        card.classList.toggle('ps-extra-photo', extraPhotos.has(card.dataset.id));
      } else if (filter === 'liked') {
        show = card.classList.contains('selected');
      }
      card.classList.toggle('hidden-by-filter', !show);
    });

    // Thêm ô dấu cộng ở tab Yêu thích
    if (filter === 'liked') {
      grid.appendChild(addBox);
    }

    // Ẩn mục ghi chú chung khi ở tab "Tất cả" (chỉ xóa/ẩn ở mục Tất cả theo yêu cầu)
    if (generalNoteBox) {
      generalNoteBox.hidden = (filter === 'all');
    }

    // Ẩn mục ghi chú riêng khi ở tab "Ảnh gốc" (và "Tất cả"), chỉ hiện ở tab "Yêu thích"
    renderPhotoNotes();
  }

  // ===== Tabs =====
  document.querySelectorAll('.ps-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.ps-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      applyFilter(tab.dataset.filter);
    });
  });

  // ===== Hàm thực thi gửi yêu cầu lên hệ thống =====
  function executeSubmit(extraCount, extraFee, paymentStatus) {
    document.querySelectorAll('.ps-heart').forEach((btn) => { btn.disabled = true; });
    submitBtn.disabled = true;
    submitBtn.textContent = 'Đã gửi yêu cầu';

    if (extraCount > 0) {
      banner.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        <div class="ps-banner-info">
          <strong>Đã gửi yêu cầu chỉnh sửa cho đội ngũ Thợ ảnh!</strong>
          <p>Bộ ảnh gồm <strong>${selected.size} ảnh</strong> (10 ảnh có trong gói + <strong>${extraCount} ảnh chọn thêm: ${extraFee.toLocaleString('vi-VN')}đ</strong>). Danh sách ảnh đã được khóa, bạn có thể theo dõi tiến độ tại mục Lịch hẹn.</p>
          <button type="button" class="ps-reopen-qr-link" id="psReopenQrBtn">🔍 Xem lại mã QR chuyển khoản</button>
        </div>
      `;
      const reopenBtn = banner.querySelector('#psReopenQrBtn');
      if (reopenBtn) {
        reopenBtn.addEventListener('click', () => {
          openQrPaymentModal(extraCount, extraFee);
        });
      }
    } else {
      banner.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        <span>Đã gửi yêu cầu chỉnh sửa cho đội ngũ Thợ ảnh (10 ảnh trong gói). Danh sách ảnh đã được khóa, bạn có thể theo dõi tiến độ tại mục Lịch hẹn.</span>
      `;
    }

    banner.classList.add('show');
    banner.scrollIntoView({ behavior: 'smooth', block: 'center' });

    if (window.AlohaData && session) {
      const perPhotoNotes = Array.from(selected)
        .map(id => ({ id, note: (photoNotes.get(id) || '').trim() }))
        .filter(n => n.note);
      const allSelectedPhotos = Array.from(selected)
        .map(id => ({ id, src: photoById[id].src, note: (photoNotes.get(id) || '').trim(), isExtra: extraPhotos.has(id) }));

      AlohaData.createEditRequest({
        phone: session.phone,
        customerName: session.name,
        orderCode: record.orderCode,
        serviceLabel: record.serviceLabel,
        photoCount: selected.size,
        extraCount: extraCount,
        extraFee: extraFee,
        paymentStatus: paymentStatus,
        note: document.getElementById('psNote').value.trim(),
        photoNotes: perPhotoNotes,
        photos: allSelectedPhotos
      });
    }

    if (photoNotesSection) photoNotesSection.hidden = true;
  }

  // ===== Submit =====
  submitBtn.addEventListener('click', () => {
    if (selected.size === 0) return;

    const extraCount = Math.max(0, selected.size - PACKAGE_COUNT);
    const extraFee = extraCount * EXTRA_PRICE;

    if (extraCount > 0) {
      // Tự động nhảy lên mã QR chuyển khoản cá nhân hóa!
      openQrPaymentModal(extraCount, extraFee);
    } else {
      // Trong gói 10 ảnh -> gửi ngay không cần thanh toán thêm
      executeSubmit(0, 0, 'Trong gói 10 ảnh');
    }
  });

  updateSummary();
  applyFilter('all');
});