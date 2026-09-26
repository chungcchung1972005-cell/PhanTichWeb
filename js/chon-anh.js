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

  // Ảnh lấy từ album Google Photos (js/google-photos-data.js, sinh bởi
  // _screenshots/fetch-google-photos.js), không giới hạn số ảnh. Không có file
  // dữ liệu đó thì quay về bộ ảnh demo trong images/my-photos/.
  const albumPhotos = (typeof GOOGLE_PHOTOS_DATA !== 'undefined' && GOOGLE_PHOTOS_DATA.length) ? GOOGLE_PHOTOS_DATA : null;
  const photos = albumPhotos
    ? albumPhotos.map(p => ({ id: p.id, src: p.thumb, large: p.medium, full: p.full }))
    : Array.from({ length: Math.min(record.photoCount || 16, 16) }, (_, i) => {
        const src = 'images/my-photos/photo-' + (i + 1) + '.jpg';
        return { id: 'ph-' + (i + 1), src, large: src, full: src };
      });

  const heartIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-4.35-9.5-8.5C.7 9.2 2.4 6 5.6 6c1.8 0 3.1 1 3.9 2.3.8 1.3 1 1.3 1 1.3s.2 0 1-1.3C12.3 7 13.6 6 15.4 6c3.2 0 4.9 3.2 3.1 6.5C16 16.65 12 21 12 21z"/></svg>';

  grid.innerHTML = photos.map((p, i) => `
    <div class="ps-photo" data-id="${p.id}">
      <img src="${p.src}" alt="Ảnh gốc số ${i + 1}, buổi chụp ${record.serviceLabel}" loading="lazy" decoding="async" referrerpolicy="no-referrer">
      <span class="ps-photo-badge">Ảnh gốc</span>
      <span class="ps-zoom-hint" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M11 8v6M8 11h6"/></svg></span>
      <button type="button" class="ps-heart" aria-label="Chọn ảnh số ${i + 1}" aria-pressed="false">${heartIcon}</button>
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
      // Chuyển sang tab Yêu thích (trừ khi đang xem ảnh lớn trong lightbox)
      if (!isLightboxOpen()) switchToTab('liked');
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
          <h3 id="psQrTitle">Chỉ một bước nữa thôi, ảnh của bé sắp được gửi đi</h3>
          <p class="ps-qr-subtitle">Bạn đã chọn thêm những khoảnh khắc thật đáng yêu ngoài gói 10 ảnh. Hoàn tất phí chỉnh sửa bên dưới nhé.</p>
        </div>
      </div>

      <!-- Đếm ngược thời hạn mã QR (30 phút) -->
      <div class="ps-qr-countdown" id="psQrCountdown">
        <div class="ps-qr-countdown-row">
          <span class="ps-qr-countdown-label" id="psQrCountdownLabel">Mã QR có hiệu lực trong</span>
          <strong class="ps-qr-countdown-time" id="psQrCountdownTime">30:00</strong>
        </div>
        <div class="ps-qr-countdown-bar"><span id="psQrCountdownFill"></span></div>
        <p class="ps-qr-paystatus" id="psQrPayStatus">
          <span class="ps-qr-paystatus-dot"></span>
          <span id="psQrPayStatusText">Đang chờ tiền về. Chuyển khoản xong, ảnh sẽ tự động được gửi tới Thợ ảnh.</span>
        </p>
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
            <strong id="psBankAccNum">0967237146</strong>
            <button type="button" class="ps-copy-btn" data-copy="0967237146">Sao chép</button>
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

      <!-- Thông điệp: chỉ gửi ảnh sau khi thanh toán (không còn nút "đã chuyển khoản"/"thanh toán sau") -->
      <div class="ps-qr-promise">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>
        <div>
          <strong>Thanh toán để ảnh của bé được gửi đến tay những người thợ có tâm, có tầm nhất của ALOHA Baby.</strong>
          <p>Ảnh chỉ được gửi đi chỉnh sửa sau khi studio nhận được thanh toán. Nếu chưa thanh toán, yêu cầu sẽ chưa được gửi.</p>
        </div>
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

  // ===== Thanh toán tự động qua SePay =====
  // Ngân hàng báo tiền về -> SePay gọi webhook của server/ (server/server.js,
  // /api/sepay-webhook) -> trang này hỏi server mỗi vài giây xem mã thanh toán
  // đã có tiền chưa. Có tiền đủ số -> tự gửi yêu cầu tới Thợ ảnh, không cần
  // khách bấm gì. Không thanh toán thì yêu cầu không được gửi.
  const isLocalHost = location.protocol === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const PAYMENT_API_BASE = isLocalHost ? 'http://localhost:3001' : 'https://phantichweb.onrender.com';
  const QR_VALID_MS = 30 * 60 * 1000; // Mã QR có hiệu lực 30 phút
  const PAY_POLL_MS = 4000;           // hỏi trạng thái thanh toán mỗi 4 giây

  let qr = null;        // { code, count, fee, deadline } của mã QR đang chờ tiền
  let qrTicker = null;
  let lastPoll = 0;
  let polling = false;

  function randomSuffix() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const buf = new Uint32Array(4);
    crypto.getRandomValues(buf);
    return Array.from(buf, n => chars[n % chars.length]).join('');
  }

  // Khoá chọn ảnh khi đang chờ tiền, để danh sách gửi đi khớp đúng số tiền đã trả
  function lockSelection(locked) {
    document.querySelectorAll('.ps-heart').forEach((btn) => { btn.disabled = locked; });
  }

  function setPayStatus(text, isError) {
    document.getElementById('psQrPayStatusText').textContent = text;
    document.getElementById('psQrPayStatus').classList.toggle('is-error', !!isError);
  }

  function renderQrCountdown() {
    const left = qr ? Math.max(0, qr.deadline - Date.now()) : 0;
    const mm = String(Math.floor(left / 60000)).padStart(2, '0');
    const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, '0');
    const modal = qrOverlay.querySelector('.ps-qr-modal');
    document.getElementById('psQrCountdownTime').textContent = left > 0 ? `${mm}:${ss}` : '00:00';
    document.getElementById('psQrCountdownFill').style.width = (left / QR_VALID_MS * 100) + '%';
    document.getElementById('psQrCountdownLabel').textContent = left > 0
      ? 'Mã QR có hiệu lực trong'
      : 'Mã QR đã hết hạn, bấm "Gửi yêu cầu chỉnh sửa" để nhận mã mới';
    modal.classList.toggle('is-urgent', left > 0 && left <= 5 * 60 * 1000);
    modal.classList.toggle('is-expired', left === 0);
  }

  function stopPaymentWatch() {
    if (qrTicker) { clearInterval(qrTicker); qrTicker = null; }
  }

  async function checkPayment() {
    if (!qr || polling) return;
    polling = true;
    const watching = qr;
    try {
      const url = `${PAYMENT_API_BASE}/api/payment-status?code=${encodeURIComponent(watching.code)}&amount=${watching.fee}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (qr !== watching) return; // mã đã đổi/hết hạn trong lúc chờ phản hồi
      if (data.paid) {
        onPaid(watching);
      } else {
        setPayStatus('Đang chờ tiền về. Chuyển khoản xong, ảnh sẽ tự động được gửi tới Thợ ảnh.');
      }
    } catch (err) {
      if (qr === watching) {
        setPayStatus('Chưa kết nối được hệ thống xác nhận thanh toán, đang thử lại. Nếu đã chuyển khoản, bạn gọi hotline 0938.125.222 để được hỗ trợ nhé.', true);
      }
    } finally {
      polling = false;
    }
  }

  function tick() {
    renderQrCountdown();
    if (!qr) return;
    if (Date.now() >= qr.deadline) {
      // Hết 30 phút chưa thấy tiền: huỷ mã, mở khoá chọn ảnh, yêu cầu vẫn chưa gửi
      qr = null;
      stopPaymentWatch();
      lockSelection(false);
      if (!qrOverlay.classList.contains('show')) showUnpaidBanner();
      return;
    }
    if (Date.now() - lastPoll >= PAY_POLL_MS) {
      lastPoll = Date.now();
      checkPayment();
    }
  }

  function onPaid(paid) {
    qr = null;
    stopPaymentWatch();
    qrOverlay.classList.remove('show');
    executeSubmit(paid.count, paid.fee, 'Đã thanh toán (tự động xác nhận qua SePay)');
  }

  function openQrPaymentModal(extraCount, extraFee) {
    // Mở lại khi mã còn hạn và cùng số tiền: giữ nguyên mã + thời gian còn lại.
    // Chưa có mã, hết hạn hoặc đổi số ảnh: cấp mã thanh toán mới, đếm lại 30 phút.
    if (!qr || Date.now() >= qr.deadline || extraFee !== qr.fee) {
      const cleanCode = (record.orderCode || 'AB240915').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      qr = {
        code: `${cleanCode}CS${extraCount}${randomSuffix()}`,
        count: extraCount,
        fee: extraFee,
        deadline: Date.now() + QR_VALID_MS
      };
    }
    lockSelection(true);
    setPayStatus('Đang chờ tiền về. Chuyển khoản xong, ảnh sẽ tự động được gửi tới Thợ ảnh.');
    renderQrCountdown();
    if (!qrTicker) {
      lastPoll = 0;
      qrTicker = setInterval(tick, 1000);
    }

    // Nội dung CK là mã thanh toán riêng của lần này (viết liền, không dấu cách)
    // để server đối chiếu chính xác, không nhầm với giao dịch khác.
    const qrDescription = qr.code;
    const bankId = 'MB';
    const accountNo = '0967237146';
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
    if (qrImg.getAttribute('src') !== qrUrl) qrImg.src = qrUrl;

    qrOverlay.classList.add('show');
    tick();
  }

  // Đóng modal KHÔNG gửi yêu cầu. Nếu mã còn hạn, trang vẫn tiếp tục chờ tiền về
  // ở nền: khách chuyển khoản xong là ảnh tự gửi đi, không cần mở lại modal.
  function closeQrPaymentModal() {
    qrOverlay.classList.remove('show');
    showUnpaidBanner();
  }

  function showUnpaidBanner() {
    const waiting = !!qr && Date.now() < qr.deadline;
    banner.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
      <div class="ps-banner-info">
        <strong>Ảnh của bé chưa được gửi đi</strong>
        <p>${waiting
          ? 'Hệ thống đang chờ thanh toán phí ảnh chọn thêm. Bạn chuyển khoản xong, ảnh sẽ tự động được gửi tới Thợ ảnh, không cần thao tác gì thêm. Danh sách ảnh tạm khoá trong lúc chờ.'
          : 'Mã QR đã hết hạn. Bấm "Gửi yêu cầu chỉnh sửa" để nhận mã mới và hoàn tất thanh toán.'}</p>
        ${waiting ? '<button type="button" class="ps-reopen-qr-link" id="psContinuePayBtn">Xem lại mã QR</button>' : ''}
      </div>
    `;
    const continueBtn = banner.querySelector('#psContinuePayBtn');
    if (continueBtn) {
      continueBtn.addEventListener('click', () => {
        if (qr) openQrPaymentModal(qr.count, qr.fee);
      });
    }
    banner.classList.add('show');
  }

  document.getElementById('psQrCloseBtn').addEventListener('click', closeQrPaymentModal);

  qrOverlay.addEventListener('click', (e) => {
    if (e.target === qrOverlay) closeQrPaymentModal();
  });

  let currentFilter = 'all';

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
    syncLightbox();
  }

  // ===== Xử lý click: tim = chọn ảnh, bấm vào ảnh = mở xem ảnh lớn =====
  grid.addEventListener('click', (e) => {
    const heart = e.target.closest('.ps-heart');
    if (heart) { toggleSelect(heart.closest('.ps-photo').dataset.id); return; }
    const photoCard = e.target.closest('.ps-photo');
    if (photoCard) openLightbox(photoCard.dataset.id);
  });

  // Chọn/bỏ chọn 1 ảnh (dùng chung cho nút tim trên lưới và trong lightbox)
  function toggleSelect(id) {
    const card = grid.querySelector(`.ps-photo[data-id="${id}"]`);
    const heartBtn = card && card.querySelector('.ps-heart');
    if (!heartBtn || heartBtn.disabled) return;

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
  }

  // ===== Lightbox: xem ảnh lớn, thu phóng, lướt, yêu thích + ghi chú chỉnh sửa =====
  const lb = document.createElement('div');
  lb.className = 'ps-lightbox';
  lb.id = 'psLightbox';
  lb.setAttribute('role', 'dialog');
  lb.setAttribute('aria-modal', 'true');
  lb.setAttribute('aria-label', 'Xem ảnh lớn');
  lb.innerHTML = `
    <div class="ps-lb-overlay"></div>
    <div class="ps-lb-shell">
      <div class="ps-lb-top">
        <span class="ps-lb-counter" id="psLbCounter">1 / 1</span>
        <div class="ps-lb-actions">
          <button type="button" id="psLbZoomOut" aria-label="Thu nhỏ">&minus;</button>
          <button type="button" id="psLbZoomReset" aria-label="Về kích thước vừa khung" class="ps-lb-zoom-val">100%</button>
          <button type="button" id="psLbZoomIn" aria-label="Phóng to">+</button>
        </div>
        <button type="button" class="ps-lb-close" id="psLbClose" aria-label="Đóng">&times;</button>
      </div>
      <div class="ps-lb-stage" id="psLbStage">
        <img class="ps-lb-img" id="psLbImg" alt="" draggable="false" referrerpolicy="no-referrer">
        <button type="button" class="ps-lb-prev" id="psLbPrev" aria-label="Ảnh trước">&#8249;</button>
        <button type="button" class="ps-lb-next" id="psLbNext" aria-label="Ảnh sau">&#8250;</button>
      </div>
      <div class="ps-lb-panel">
        <div class="ps-lb-fav-row">
          <button type="button" class="ps-lb-fav" id="psLbFav" aria-pressed="false">${heartIcon}<span id="psLbFavText">Chọn làm yêu thích</span></button>
          <span class="ps-lb-favinfo" id="psLbFavInfo"></span>
        </div>
        <div class="ps-lb-note" id="psLbNoteWrap" hidden>
          <label for="psLbNote">Ghi chú chỉnh sửa cho ảnh này <span class="ps-lb-extra" id="psLbExtra" hidden>Ảnh chọn thêm +50K</span></label>
          <textarea id="psLbNote" rows="2" placeholder="Vd: làm sáng da, xoá vết đỏ trên má, chỉnh màu ấm hơn..."></textarea>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(lb);

  const lbImg = lb.querySelector('#psLbImg');
  const lbStage = lb.querySelector('#psLbStage');
  const lbNote = lb.querySelector('#psLbNote');
  const LB_MIN = 1, LB_MAX = 5;
  let lbIds = [];       // danh sách ảnh đang lướt (theo tab lúc mở)
  let lbIndex = 0;
  let lbScale = 1, lbX = 0, lbY = 0;

  function isLightboxOpen() { return lb.classList.contains('show'); }

  function applyLbTransform() {
    lbImg.style.transform = `translate(${lbX}px, ${lbY}px) scale(${lbScale})`;
    lb.querySelector('#psLbZoomReset').textContent = Math.round(lbScale * 100) + '%';
    lbStage.classList.toggle('is-zoomed', lbScale > 1);
    // Phóng to thì đổi sang ảnh kích thước gốc cho nét
    const p = photoById[lbIds[lbIndex]];
    if (lbScale > 1.5 && p && lbImg.dataset.res !== 'full') {
      lbImg.dataset.res = 'full';
      lbImg.src = p.full;
    }
  }

  function setZoom(next, cx, cy) {
    const s = Math.min(LB_MAX, Math.max(LB_MIN, next));
    if (s === LB_MIN) { lbX = 0; lbY = 0; }
    else if (cx != null) {
      // Giữ nguyên điểm dưới con trỏ khi phóng/thu
      const r = lbStage.getBoundingClientRect();
      const ox = cx - r.left - r.width / 2, oy = cy - r.top - r.height / 2;
      lbX = ox - (ox - lbX) * (s / lbScale);
      lbY = oy - (oy - lbY) * (s / lbScale);
    }
    lbScale = s;
    applyLbTransform();
  }

  function showLbPhoto(index) {
    lbIndex = (index + lbIds.length) % lbIds.length;
    const id = lbIds[lbIndex];
    const p = photoById[id];
    lbScale = 1; lbX = 0; lbY = 0;
    lbImg.dataset.res = 'large';
    // Luôn nạp đúng ghi chú của ảnh mới (syncLightbox bỏ qua khi ô ghi chú đang được
    // chọn, nên nếu không nạp ở đây thì chữ của ảnh trước sẽ "dính" sang ảnh này)
    lbNote.value = photoNotes.get(id) || '';
    lbImg.src = p.large;
    lbImg.alt = `Ảnh số ${photos.indexOf(p) + 1}`;
    applyLbTransform();
    lb.querySelector('#psLbCounter').textContent = `${lbIndex + 1} / ${lbIds.length}`;
    const single = lbIds.length < 2;
    lb.querySelector('#psLbPrev').hidden = single;
    lb.querySelector('#psLbNext').hidden = single;
    // Tải trước ảnh kế bên để lướt mượt
    [lbIndex - 1, lbIndex + 1].forEach(i => {
      const n = photoById[lbIds[(i + lbIds.length) % lbIds.length]];
      if (n) new Image().src = n.large;
    });
    syncLightbox();
  }

  // Cập nhật nút tim + ô ghi chú theo trạng thái chọn hiện tại
  function syncLightbox() {
    if (!isLightboxOpen()) return;
    const id = lbIds[lbIndex];
    const isSel = selected.has(id);
    const heart = grid.querySelector(`.ps-photo[data-id="${id}"] .ps-heart`);
    const locked = !heart || heart.disabled;
    const favBtn = lb.querySelector('#psLbFav');
    favBtn.classList.toggle('active', isSel);
    favBtn.setAttribute('aria-pressed', String(isSel));
    favBtn.disabled = locked;
    lb.querySelector('#psLbFavText').textContent = isSel ? 'Đã chọn yêu thích' : 'Chọn làm yêu thích';
    lb.querySelector('#psLbFavInfo').textContent = locked && !isSel
      ? 'Danh sách ảnh đang khoá'
      : `Đã chọn ${selected.size}/${PACKAGE_COUNT} ảnh trong gói`;
    lb.querySelector('#psLbNoteWrap').hidden = !isSel;
    lb.querySelector('#psLbExtra').hidden = !extraPhotos.has(id);
    if (document.activeElement !== lbNote) lbNote.value = photoNotes.get(id) || '';
    lbNote.readOnly = locked;
  }

  function openLightbox(id) {
    const visible = Array.from(grid.querySelectorAll('.ps-photo:not(.hidden-by-filter)')).map(c => c.dataset.id);
    lbIds = visible.includes(id) ? visible : photos.map(p => p.id);
    lb.classList.add('show');
    document.body.style.overflow = 'hidden';
    showLbPhoto(lbIds.indexOf(id));
    lb.querySelector('#psLbClose').focus();
  }

  function closeLightbox() {
    lb.classList.remove('show');
    if (document.activeElement === lbNote) lbNote.blur();
    document.body.style.overflow = '';
    lbImg.removeAttribute('src');
  }

  lb.querySelector('#psLbClose').addEventListener('click', closeLightbox);
  lb.querySelector('.ps-lb-overlay').addEventListener('click', closeLightbox);
  lb.querySelector('#psLbPrev').addEventListener('click', () => showLbPhoto(lbIndex - 1));
  lb.querySelector('#psLbNext').addEventListener('click', () => showLbPhoto(lbIndex + 1));
  lb.querySelector('#psLbZoomIn').addEventListener('click', () => setZoom(lbScale * 1.5));
  lb.querySelector('#psLbZoomOut').addEventListener('click', () => setZoom(lbScale / 1.5));
  lb.querySelector('#psLbZoomReset').addEventListener('click', () => setZoom(1));
  lb.querySelector('#psLbFav').addEventListener('click', () => toggleSelect(lbIds[lbIndex]));
  lbNote.addEventListener('input', () => photoNotes.set(lbIds[lbIndex], lbNote.value));

  lbStage.addEventListener('wheel', (e) => {
    e.preventDefault();
    setZoom(lbScale * (e.deltaY < 0 ? 1.2 : 1 / 1.2), e.clientX, e.clientY);
  }, { passive: false });
  lbImg.addEventListener('dblclick', (e) => setZoom(lbScale > 1 ? 1 : 2.5, e.clientX, e.clientY));

  // Kéo để di chuyển khi đang phóng to, vuốt ngang để lướt ảnh, 2 ngón để thu phóng
  const pointers = new Map();
  let dragStart = null, pinchStart = null;
  lbStage.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    lbStage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchStart = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: lbScale };
      dragStart = null;
    } else {
      dragStart = { x: e.clientX, y: e.clientY, lbX, lbY, t: Date.now() };
    }
  });
  lbStage.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinchStart && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      setZoom(pinchStart.scale * Math.hypot(a.x - b.x, a.y - b.y) / pinchStart.dist, (a.x + b.x) / 2, (a.y + b.y) / 2);
    } else if (dragStart && lbScale > 1) {
      lbX = dragStart.lbX + (e.clientX - dragStart.x);
      lbY = dragStart.lbY + (e.clientY - dragStart.y);
      applyLbTransform();
    }
  });
  function endPointer(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStart = null;
    if (dragStart && lbScale === 1 && pointers.size === 0) {
      const dx = e.clientX - dragStart.x, dy = e.clientY - dragStart.y;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) && Date.now() - dragStart.t < 800) {
        showLbPhoto(lbIndex + (dx < 0 ? 1 : -1));
      }
    }
    if (pointers.size === 0) dragStart = null;
  }
  lbStage.addEventListener('pointerup', endPointer);
  lbStage.addEventListener('pointercancel', endPointer);

  document.addEventListener('keydown', (e) => {
    if (!isLightboxOpen()) return;
    if (e.key === 'Escape') { closeLightbox(); return; }
    if (e.target === lbNote) return; // đang gõ ghi chú
    if (e.key === 'ArrowLeft') showLbPhoto(lbIndex - 1);
    else if (e.key === 'ArrowRight') showLbPhoto(lbIndex + 1);
    else if (e.key === '+' || e.key === '=') setZoom(lbScale * 1.5);
    else if (e.key === '-') setZoom(lbScale / 1.5);
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
          <strong>Đã nhận thanh toán, ảnh của bé đã được gửi tới đội ngũ Thợ ảnh!</strong>
          <p>Bộ ảnh gồm <strong>${selected.size} ảnh</strong> (10 ảnh có trong gói + <strong>${extraCount} ảnh chọn thêm: ${extraFee.toLocaleString('vi-VN')}đ</strong>). Danh sách ảnh đã được khóa, bạn có thể theo dõi tiến độ tại mục Lịch hẹn.</p>
        </div>
      `;
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


