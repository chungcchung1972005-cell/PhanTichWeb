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
  // Hạn thanh toán ảnh chọn thêm (phút), cấu hình dùng chung trong js/data-store.js
  const PAY_MIN = (window.AlohaData && AlohaData.EXTRA_PAY_MINUTES) || 30;

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
      <span class="ps-photo-badge" title="Ảnh số ${i + 1}">#${i + 1}</span>
      <span class="ps-zoom-hint" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M11 8v6M8 11h6"/></svg></span>
      <button type="button" class="ps-heart" aria-label="Chọn ảnh số ${i + 1}" aria-pressed="false">${heartIcon}</button>
    </div>
  `).join('');

  const selected = new Set();
  const extraPhotos = new Set();   // ảnh chỉnh sửa thêm (vượt gói)
  let extraModeActive = false;     // khách đã đồng ý chỉnh sửa thêm
  let requestSent = false;         // đã gửi yêu cầu chỉnh sửa (lần này hoặc từ trước) -> nút gửi khoá hẳn
  let draftTimer = null;           // hẹn giờ lưu nháp ảnh đang chọn dở
  // Số thứ tự ảnh (#5) = số trong id 'ph-5'; dùng chung lưới ảnh, xem ảnh lớn, trang Thợ ảnh
  const photoNo = (id) => { const m = /^ph-(\d+)$/.exec(id || ''); return m ? m[1] : ''; };
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
  const selectAllBtn = document.getElementById('psSelectAllBtn');
  const clearAllBtn = document.getElementById('psClearAllBtn');
  const bulkUndo = document.getElementById('psBulkUndo');

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
          <h3 id="psQrTitle">Thanh toán trong ${PAY_MIN} phút để gửi ảnh chọn thêm</h3>
          <p class="ps-qr-subtitle" id="psQrSubtitle"></p>
        </div>
      </div>

      <!-- Đếm ngược hạn thanh toán ảnh chọn thêm (30 phút kể từ lúc gửi yêu cầu) -->
      <div class="ps-qr-countdown" id="psQrCountdown">
        <div class="ps-qr-countdown-row">
          <span class="ps-qr-countdown-label" id="psQrCountdownLabel">Thời gian thanh toán còn lại</span>
          <strong class="ps-qr-countdown-time" id="psQrCountdownTime">${String(PAY_MIN).padStart(2, "0")}:00</strong>
        </div>
        <div class="ps-qr-countdown-bar"><span id="psQrCountdownFill"></span></div>
        <p class="ps-qr-paystatus" id="psQrPayStatus">
          <span class="ps-qr-paystatus-dot"></span>
          <span id="psQrPayStatusText">Đang chờ tiền về. Chuyển khoản xong, ảnh chọn thêm sẽ tự động được gửi tới thợ.</span>
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

      <!-- Thông điệp: ảnh chọn thêm chỉ gửi đi sau khi thanh toán, quá 30 phút thì không gửi -->
      <div class="ps-qr-promise">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>
        <div>
          <strong>Thanh toán để ảnh của bé được gửi đến tay những người thợ có tâm, có tầm nhất của ALOHA Baby.</strong>
          <p>${PACKAGE_COUNT} ảnh trong gói đã được gửi cho thợ. Ảnh chọn thêm chỉ được gửi đi sau khi studio nhận được thanh toán; quá ${PAY_MIN} phút chưa thanh toán, các ảnh chọn thêm sẽ không được gửi đi.</p>
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

  // ===== Ảnh chọn thêm: gửi ảnh trong gói ngay, ảnh chọn thêm chờ thanh toán 30 phút =====
  // Người dùng chốt 2026-09-28 (trước đó: chưa thanh toán thì CẢ yêu cầu chưa được gửi).
  // Bấm gửi -> ảnh trong gói tới thợ ngay; ảnh chọn thêm nằm chờ trong chính yêu cầu
  // (extraPending, js/data-store.js). Ngân hàng báo tiền về -> SePay gọi webhook của server/
  // (/api/sepay-webhook) -> trang này hỏi server mỗi vài giây xem mã thanh toán đã có tiền
  // chưa. Đủ tiền trong 30 phút -> ảnh chọn thêm tự gửi tới thợ; quá hạn -> không được gửi.
  // Hạn lưu trong yêu cầu nên tải lại trang / sang trang khác của web vẫn đếm tiếp.
  const isLocalHost = location.protocol === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const PAYMENT_API_BASE = isLocalHost ? 'http://localhost:3001' : 'https://phantichweb.onrender.com';
  const QR_VALID_MS = PAY_MIN * 60 * 1000; // Hạn thanh toán ảnh chọn thêm kể từ lúc gửi (cấu hình: js/data-store.js)
  const PAY_POLL_MS = 4000;           // hỏi trạng thái thanh toán mỗi 4 giây
  const HOTLINE = '0938.125.222';

  let payTicker = null;
  let lastPoll = 0;
  let polling = false;
  let watching = null; // extraPending đang theo dõi (để biết ảnh nào khi tab khác đã chốt)
  let qrShown = null;  // extraPending đang hiện trong modal QR

  function randomSuffix() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const buf = new Uint32Array(4);
    crypto.getRandomValues(buf);
    return Array.from(buf, n => chars[n % chars.length]).join('');
  }
  // Nội dung CK là mã thanh toán riêng của lần này (viết liền, không dấu cách)
  // để server đối chiếu chính xác, không nhầm với giao dịch khác.
  function paymentCode(count) {
    const cleanCode = (record.orderCode || 'AB240915').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return `${cleanCode}CS${count}${randomSuffix()}`;
  }

  // Yêu cầu mới nhất của khách nếu còn ảnh chọn thêm chờ thanh toán
  function pendingRequest() {
    const req = latestRequest();
    return req && req.extraPending ? req : null;
  }
  const fmtLeft = (ms) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  };

  function setPayStatus(text, isError) {
    document.getElementById('psQrPayStatusText').textContent = text;
    document.getElementById('psQrPayStatus').classList.toggle('is-error', !!isError);
  }

  // Đồng hồ dùng chung: modal QR + mọi chỗ có [data-pay-left] (thông báo đầu trang, tab "Ảnh đã chỉnh")
  function renderPayCountdown() {
    const pend = pendingRequest();
    const left = pend ? Math.max(0, pend.extraPending.deadline - Date.now()) : 0;
    document.querySelectorAll('[data-pay-left]').forEach((el) => { el.textContent = fmtLeft(left); });
    if (!qrShown) return;
    const live = !!pend && pend.extraPending.code === qrShown.code;
    const leftQr = live ? left : 0;
    const modal = qrOverlay.querySelector('.ps-qr-modal');
    document.getElementById('psQrCountdownTime').textContent = fmtLeft(leftQr);
    document.getElementById('psQrCountdownFill').style.width = (leftQr / QR_VALID_MS * 100) + '%';
    document.getElementById('psQrCountdownLabel').textContent = leftQr > 0
      ? 'Thời gian thanh toán còn lại'
      : live ? `Đã hết ${PAY_MIN} phút, đang xác nhận thanh toán lần cuối...`
        : `Đã hết ${PAY_MIN} phút, ${qrShown.count} ảnh chọn thêm không được gửi đi`;
    modal.classList.toggle('is-urgent', leftQr > 0 && leftQr <= 5 * 60 * 1000);
    modal.classList.toggle('is-expired', leftQr === 0);
  }

  function startPayWatch() {
    const req = pendingRequest();
    if (!req) return;
    watching = req.extraPending;
    if (payTicker) return;
    lastPoll = 0;
    payTicker = setInterval(payTick, 1000);
    payTick();
  }
  function stopPayWatch() {
    if (payTicker) { clearInterval(payTicker); payTicker = null; }
  }

  async function payTick() {
    const req = pendingRequest();
    if (!req || !watching || req.extraPending.code !== watching.code) {
      // Đã chốt ở tab khác cùng trình duyệt -> cập nhật giao diện theo dữ liệu
      stopPayWatch();
      const done = latestRequest();
      if (watching && done) showSettled(done, watching, !done.extraDropped);
      return;
    }
    const p = req.extraPending;
    renderPayCountdown();
    const expired = Date.now() >= p.deadline;
    // Vừa hết hạn: thông báo đầu trang chuyển sang "đang xác nhận thanh toán"
    if (expired && banner.dataset.kind === 'pending') renderSentBanner(req);
    // Hết thời gian chờ tiền về chậm thì kiểm tra lần cuối ngay, không đợi lượt 4 giây
    const lastCall = Date.now() >= p.deadline + AlohaData.EXTRA_PAY_LATE_MS;
    if (polling || (!lastCall && Date.now() - lastPoll < PAY_POLL_MS)) return;
    lastPoll = Date.now();
    polling = true;
    const result = await AlohaData.checkExtraPayment(PAYMENT_API_BASE, p);
    polling = false;
    const fresh = pendingRequest();
    if (!fresh || fresh.extraPending.code !== p.code) return; // tab khác vừa chốt, lượt sau cập nhật
    if (result === 'paid') { settleExtras(fresh, true); return; }
    if (expired) {
      // Hết hạn: chờ thêm tối đa EXTRA_PAY_LATE_MS cho ngân hàng/SePay báo chậm, máy chủ khởi động;
      // hết thời gian chờ mà vẫn chưa thấy tiền -> ảnh chọn thêm không được gửi
      if (AlohaData.extraExpiredDecision(p, result) === 'drop') settleExtras(fresh, false);
      return;
    }
    setPayStatus(result === 'error'
      ? `Chưa kết nối được hệ thống xác nhận thanh toán, đang thử lại. Nếu đã chuyển khoản, bạn gọi hotline ${HOTLINE} để được hỗ trợ nhé.`
      : 'Đang chờ tiền về. Chuyển khoản xong, ảnh chọn thêm sẽ tự động được gửi tới thợ.', result === 'error');
  }

  function settleExtras(req, paid) {
    const p = req.extraPending;
    AlohaData.settleExtraPayment(req.id, paid, paid ? 'Đã thanh toán (tự động xác nhận qua SePay)' : '');
    stopPayWatch();
    showSettled(latestRequest(), p, paid);
  }

  // Giao diện sau khi chốt: đã thanh toán -> đóng mã QR, báo đã gửi ảnh chọn thêm; quá hạn ->
  // bỏ chọn các ảnh chọn thêm trên lưới (cho khớp với ảnh thợ nhận), mã QR chuyển "hết hạn".
  function showSettled(req, p, paid) {
    watching = null;
    if (paid) {
      qrOverlay.classList.remove('show');
      qrShown = null;
    } else {
      (p.photos || []).forEach((ph) => {
        selected.delete(ph.id);
        extraPhotos.delete(ph.id);
        setCardSelected(ph.id, false, false);
      });
      extraModeActive = false;
      updateSummary();
      applyFilter(currentFilter);
    }
    renderPayCountdown();
    renderSentBanner(req, paid ? 'paid' : 'dropped');
    renderEdited(true);
  }

  function openQrPaymentModal(p) {
    if (!p) return;
    qrShown = p;
    const bankId = 'MB';
    const accountNo = '0967237146';
    const accountName = 'ALOHA BABY STUDIO';
    const qrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${p.fee}&addInfo=${encodeURIComponent(p.code)}&accountName=${encodeURIComponent(accountName)}`;

    document.getElementById('psQrSubtitle').innerHTML =
      `${PACKAGE_COUNT} ảnh trong gói đã được gửi cho thợ. <strong>${p.count} ảnh chọn thêm</strong> chỉ được gửi tới thợ khi studio nhận đủ tiền trong ${PAY_MIN} phút; quá hạn chưa thanh toán, các ảnh này sẽ không được gửi đi.`;
    document.getElementById('psQrCustCode').textContent = record.orderCode || '#AB240915';
    document.getElementById('psQrExtraCount').textContent = p.count;
    document.getElementById('psQrExtraSub').textContent = p.count;
    document.getElementById('psQrTotalAmount').textContent = fmtVnd(p.fee);
    document.getElementById('psBankAmount').textContent = fmtVnd(p.fee);
    document.getElementById('psBankContent').textContent = p.code;

    // Cập nhật giá trị nút copy
    document.getElementById('psCopyAmountBtn').dataset.copy = p.fee;
    document.getElementById('psCopyContentBtn').dataset.copy = p.code;

    const qrImg = document.getElementById('psQrImage');
    if (qrImg.getAttribute('src') !== qrUrl) qrImg.src = qrUrl;

    setPayStatus('Đang chờ tiền về. Chuyển khoản xong, ảnh chọn thêm sẽ tự động được gửi tới thợ.');
    renderPayCountdown();
    qrOverlay.classList.add('show');
  }

  // Đóng modal: trang vẫn chờ tiền về ở nền (thông báo đầu trang có nút "Thanh toán ngay"),
  // khách chuyển khoản xong là ảnh chọn thêm tự gửi đi, không cần mở lại modal.
  function closeQrPaymentModal() {
    qrOverlay.classList.remove('show');
    qrShown = null;
  }

  document.getElementById('psQrCloseBtn').addEventListener('click', closeQrPaymentModal);

  qrOverlay.addEventListener('click', (e) => {
    if (e.target === qrOverlay) closeQrPaymentModal();
  });

  // Nút "Thanh toán ngay" / "Xem tiến độ" nằm ở thông báo đầu trang và tab "Ảnh đã chỉnh"
  // (vẽ lại liên tục) -> bắt sự kiện chung một chỗ.
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-open-pay]')) {
      const req = pendingRequest();
      if (req) openQrPaymentModal(req.extraPending);
    } else if (e.target.closest('[data-go-edited]')) {
      switchToTab('edited');
      const tabs = document.querySelector('.ps-tabs');
      if (tabs) tabs.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  const BANNER_ICONS = {
    check: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
    clock: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M12 7v5l3.2 2"/></svg>',
    alert: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>'
  };
  const goEditedBtn = (cls) => `<button type="button" class="ps-banner-btn${cls ? ' ' + cls : ''}" id="psGoEdited" data-go-edited>Xem tiến độ</button>`;

  // Thông báo đầu lưới ảnh sau khi đã gửi yêu cầu. kind: 'pending' / 'checking' (còn ảnh chọn thêm
  // chờ thanh toán / đã hết hạn, đang xác nhận lần cuối; tự chọn khi yêu cầu còn extraPending),
  // 'paid' / 'dropped' (vừa chốt xong), còn lại là "đã gửi" (gửi trong gói, tải lại trang về sau).
  function renderSentBanner(req, kind) {
    if (!req) return;
    const p = req.extraPending;
    if (p) kind = Date.now() >= p.deadline ? 'checking' : 'pending';
    const count = req.photoCount || (req.photos || []).length;
    let html;
    if (kind === 'checking') {
      html = BANNER_ICONS.clock + `
        <div class="ps-banner-info">
          <strong>Đã hết ${PAY_MIN} phút, đang xác nhận thanh toán ${escHtml(p.count)} ảnh chọn thêm</strong>
          <p>Nếu studio đã nhận được ${escHtml(fmtVnd(p.fee))} (ngân hàng có thể báo chậm vài phút), ảnh chọn thêm vẫn được gửi tới thợ. Chưa thanh toán thì các ảnh này sẽ không được gửi đi; ${escHtml(count)} ảnh trong gói vẫn được chỉnh bình thường.</p>
          ${goEditedBtn('ps-banner-btn--ghost')}
        </div>`;
    } else if (kind === 'pending') {
      html = BANNER_ICONS.clock + `
        <div class="ps-banner-info">
          <strong>Đã gửi ${escHtml(count)} ảnh trong gói cho thợ. Còn ${escHtml(p.count)} ảnh chọn thêm chờ thanh toán</strong>
          <p>Thanh toán <b>${escHtml(fmtVnd(p.fee))}</b> trong <b class="ps-pay-left" data-pay-left>${fmtLeft(p.deadline - Date.now())}</b> để ${escHtml(p.count)} ảnh chọn thêm được gửi tới thợ. Quá ${PAY_MIN} phút chưa thanh toán, các ảnh này sẽ không được gửi đi; ${escHtml(count)} ảnh trong gói vẫn được chỉnh bình thường.</p>
          <div class="ps-banner-actions">
            <button type="button" class="ps-banner-btn" data-open-pay>Thanh toán ngay</button>
            ${goEditedBtn('ps-banner-btn--ghost')}
          </div>
        </div>`;
    } else if (kind === 'paid') {
      html = BANNER_ICONS.check + `
        <div class="ps-banner-info">
          <strong>Đã nhận thanh toán, ${escHtml(req.extraCount)} ảnh chọn thêm đã được gửi tới thợ!</strong>
          <p>Bộ ảnh gồm <strong>${escHtml(count)} ảnh</strong> (${PACKAGE_COUNT} ảnh trong gói + ${escHtml(req.extraCount)} ảnh chọn thêm: ${escHtml(fmtVnd(req.extraFee || 0))}). Danh sách ảnh đã được khóa, bạn theo dõi tiến độ và nhận ảnh đã chỉnh ở tab "Ảnh đã chỉnh" nhé.</p>
          ${goEditedBtn()}
        </div>`;
    } else if (kind === 'dropped' && req.extraDropped) {
      const d = req.extraDropped;
      html = BANNER_ICONS.alert + `
        <div class="ps-banner-info">
          <strong>${escHtml(d.count)} ảnh chọn thêm không được gửi đi</strong>
          <p>Đã quá ${PAY_MIN} phút mà studio chưa nhận được thanh toán ${escHtml(fmtVnd(d.fee || 0))}, nên ${escHtml(d.count)} ảnh chọn thêm không được gửi cho thợ. ${escHtml(count)} ảnh trong gói vẫn được chỉnh bình thường. Nếu bạn đã chuyển khoản, gọi hotline ${HOTLINE} để được hỗ trợ.</p>
          ${goEditedBtn('ps-banner-btn--ghost')}
        </div>`;
    } else {
      const d = req.extraDropped;
      kind = 'sent';
      html = BANNER_ICONS.check + `
        <div class="ps-banner-info">
          <strong>Bạn đã gửi ${escHtml(count)} ảnh cho thợ chỉnh ảnh lúc ${escHtml(fmtTime(req.createdAt))}</strong>
          <p>Danh sách ảnh đã được khóa. Theo dõi tiến độ, nhận ảnh đã chỉnh và trò chuyện với thợ ở tab "Ảnh đã chỉnh".${d ? ` ${escHtml(d.count)} ảnh chọn thêm không được gửi vì quá ${PAY_MIN} phút chưa thanh toán.` : ''}</p>
          ${goEditedBtn()}
        </div>`;
    }
    banner.className = 'ps-submitted-banner show' + (kind === 'pending' || kind === 'checking' ? ' is-pending' : kind === 'dropped' ? ' is-dropped' : '');
    banner.dataset.kind = kind;
    banner.innerHTML = html;
  }

  let currentFilter = 'all';

  packageEl.textContent = PACKAGE_COUNT;
  document.querySelectorAll('[data-pay-minutes]').forEach((el) => { el.textContent = PAY_MIN; });

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

    submitBtn.disabled = n === 0 || requestSent;
    const likedCount = document.getElementById('psLikedCount');
    if (likedCount) likedCount.textContent = n;
    syncLightbox();
    scheduleDraftSave();
    syncBulkButtons();
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
    hideUndo(); // đã tự chọn/bỏ chọn tiếp thì không Hoàn tác "Bỏ chọn tất cả" được nữa

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
      } else {
        // Bỏ 1 ảnh trong gói khi đang có ảnh chọn thêm: ảnh chọn thêm mới nhất được
        // đưa vào gói, để số ảnh viền cam luôn khớp số ảnh tính phí
        while (extraPhotos.size > selected.size - PACKAGE_COUNT) {
          const last = [...extraPhotos].pop();
          extraPhotos.delete(last);
          setCardSelected(last, true, false);
        }
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

  // ===== Chọn / bỏ chọn nhanh (2 nút dưới bộ đếm "Đã chọn") =====
  // "Chọn tất cả" luôn báo trước số ảnh vượt gói + phí dự kiến (album có thể vài trăm ảnh,
  // lỡ tay là phát sinh phí lớn). "Bỏ chọn tất cả" không hỏi lại nhưng cho Hoàn tác vài giây.
  const fmtVnd = (n) => n.toLocaleString('vi-VN') + 'đ';
  let pendingSelectAll = null;
  let undoSnapshot = null, undoTimer = null;

  const selectAllModal = document.createElement('div');
  selectAllModal.className = 'ps-modal-overlay';
  selectAllModal.id = 'psSelectAllModal';
  selectAllModal.innerHTML = `
    <div class="ps-modal ps-modal--confirm" role="dialog" aria-modal="true" aria-labelledby="psSelectAllTitle">
      <div class="ps-modal-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="14" height="14" rx="3"/><path d="M7 3h11a3 3 0 0 1 3 3v11"/><path d="m6.5 16 3-3 2.5 2.5 1.5-1.5 2 2"/></svg>
      </div>
      <h3 class="ps-modal-title" id="psSelectAllTitle"></h3>
      <p class="ps-modal-text" id="psSelectAllText"></p>
      <div class="ps-modal-cost"><span>Chi phí chỉnh sửa thêm dự kiến</span><strong id="psSelectAllFee"></strong></div>
      <p class="ps-modal-hint">Bạn vẫn có thể bỏ bớt ảnh trước khi gửi yêu cầu.</p>
      <div class="ps-modal-actions">
        <button type="button" class="ps-modal-btn ps-modal-no" id="psSelectAllCancel">Để mình tự chọn</button>
        <button type="button" class="ps-modal-btn ps-modal-yes" id="psSelectAllConfirm">Chọn tất cả</button>
      </div>
    </div>
  `;
  document.body.appendChild(selectAllModal);

  function isSelectionLocked() {
    const heart = grid.querySelector('.ps-heart');
    return !heart || heart.disabled;
  }
  // Ảnh đang hiện trong lưới (theo tab đang xem) mà chưa được chọn
  function visibleUnselectedIds() {
    return Array.from(grid.querySelectorAll('.ps-photo:not(.hidden-by-filter)'), (c) => c.dataset.id)
      .filter((id) => !selected.has(id));
  }
  function syncBulkButtons() {
    if (!selectAllBtn || !clearAllBtn) return;
    const locked = isSelectionLocked();
    selectAllBtn.disabled = locked || visibleUnselectedIds().length === 0;
    clearAllBtn.disabled = locked || selected.size === 0;
  }
  function setCardSelected(id, on, extra) {
    const card = grid.querySelector(`.ps-photo[data-id="${id}"]`);
    if (!card) return;
    card.classList.toggle('selected', on);
    card.classList.toggle('ps-extra-photo', on && extra);
    card.querySelector('.ps-heart').setAttribute('aria-pressed', String(on));
  }
  function hideUndo() {
    undoSnapshot = null;
    clearTimeout(undoTimer);
    if (bulkUndo) bulkUndo.innerHTML = '';
  }

  // Chọn thêm các ảnh: ảnh vượt quá số ảnh trong gói được đánh dấu "chỉnh sửa thêm"
  function applySelectAll(ids) {
    hideUndo();
    ids.forEach((id) => {
      const extra = selected.size >= PACKAGE_COUNT;
      if (extra) extraPhotos.add(id);
      selected.add(id);
      setCardSelected(id, true, extra);
    });
    if (selected.size > PACKAGE_COUNT) extraModeActive = true;
    updateSummary();
    applyFilter(currentFilter);
  }
  function closeSelectAllModal() {
    selectAllModal.classList.remove('show');
    pendingSelectAll = null;
    if (selectAllBtn && !selectAllBtn.disabled) selectAllBtn.focus();
  }

  if (selectAllBtn) selectAllBtn.addEventListener('click', () => {
    const ids = visibleUnselectedIds();
    if (!ids.length || isSelectionLocked()) return;
    const total = selected.size + ids.length;
    const extra = Math.max(0, total - PACKAGE_COUNT);
    if (extra === 0) { applySelectAll(ids); return; }
    pendingSelectAll = ids;
    document.getElementById('psSelectAllTitle').textContent = `Chọn tất cả ${total} ảnh?`;
    document.getElementById('psSelectAllText').innerHTML =
      `Gói của bạn có <strong>${PACKAGE_COUNT} ảnh</strong> chỉnh sửa miễn phí. <strong>${extra} ảnh</strong> còn lại sẽ tính phí chỉnh sửa thêm ${fmtVnd(EXTRA_PRICE)}/ảnh.`;
    document.getElementById('psSelectAllFee').textContent = fmtVnd(extra * EXTRA_PRICE);
    selectAllModal.classList.add('show');
    document.getElementById('psSelectAllCancel').focus(); // mặc định là lựa chọn an toàn
  });
  document.getElementById('psSelectAllCancel').addEventListener('click', closeSelectAllModal);
  document.getElementById('psSelectAllConfirm').addEventListener('click', () => {
    const ids = pendingSelectAll;
    closeSelectAllModal();
    if (ids && !isSelectionLocked()) applySelectAll(ids);
  });
  selectAllModal.addEventListener('click', (e) => { if (e.target === selectAllModal) closeSelectAllModal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && selectAllModal.classList.contains('show')) closeSelectAllModal();
  });

  if (clearAllBtn) clearAllBtn.addEventListener('click', () => {
    if (!selected.size || isSelectionLocked()) return;
    const snapshot = { ids: [...selected], extra: new Set(extraPhotos), mode: extraModeActive };
    snapshot.ids.forEach((id) => setCardSelected(id, false, false));
    selected.clear();
    extraPhotos.clear();
    extraModeActive = false;
    updateSummary();
    applyFilter(currentFilter);
    showUndo(snapshot);
  });

  function showUndo(snapshot) {
    hideUndo();
    if (!bulkUndo) return;
    undoSnapshot = snapshot;
    bulkUndo.innerHTML = `<span>Đã bỏ chọn ${snapshot.ids.length} ảnh.</span><button type="button" class="ps-bulk-undo-btn">Hoàn tác</button>`;
    const undoBtn = bulkUndo.querySelector('button');
    undoBtn.addEventListener('click', () => {
      const s = undoSnapshot;
      hideUndo();
      if (!s || isSelectionLocked()) return;
      s.ids.forEach((id) => {
        selected.add(id);
        if (s.extra.has(id)) extraPhotos.add(id);
        setCardSelected(id, true, s.extra.has(id));
      });
      extraModeActive = s.mode;
      updateSummary();
      applyFilter(currentFilter);
      if (clearAllBtn) clearAllBtn.focus();
    });
    undoBtn.focus();
    undoTimer = setTimeout(hideUndo, 8000);
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
    lb.querySelector('#psLbCounter').textContent = `Ảnh #${photoNo(id)} · ${lbIndex + 1} / ${lbIds.length}`;
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
    pointers.clear();
    dragStart = pinchStart = null;
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
  lbNote.addEventListener('input', () => { photoNotes.set(lbIds[lbIndex], lbNote.value); scheduleDraftSave(); });

  lbStage.addEventListener('wheel', (e) => {
    e.preventDefault();
    setZoom(lbScale * (e.deltaY < 0 ? 1.2 : 1 / 1.2), e.clientX, e.clientY);
  }, { passive: false });
  lbImg.addEventListener('dblclick', (e) => setZoom(lbScale > 1 ? 1 : 2.5, e.clientX, e.clientY));

  // Kéo để di chuyển khi đang phóng to, vuốt ngang để lướt ảnh, 2 ngón để thu phóng.
  // Bấm (không kéo) vào vùng tối quanh ảnh thì đóng lightbox, quay lại lưới ảnh.
  const pointers = new Map();
  let dragStart = null, pinchStart = null;
  let downOnBackdrop = false; // cú chạm bắt đầu ở vùng tối (không phải ảnh, không phải nút)
  let gestured = false;       // cú chạm vừa rồi đã kéo/vuốt/chụm 2 ngón nên không tính là "bấm"
  lbStage.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    if (pointers.size === 0) { downOnBackdrop = e.target === lbStage; gestured = false; }
    lbStage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchStart = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: lbScale };
      dragStart = null;
      gestured = true;
    } else {
      dragStart = { x: e.clientX, y: e.clientY, lbX, lbY, t: Date.now() };
    }
  });
  lbStage.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (dragStart && Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y) > 6) gestured = true;
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

  // Trình duyệt vẫn phát "click" sau khi kéo/vuốt, và do setPointerCapture nên click có thể
  // rơi vào chính lbStage dù bấm trên ảnh -> xét nơi BẮT ĐẦU chạm, không xét e.target.
  lbStage.addEventListener('click', (e) => {
    if (e.target.closest('button') || gestured || !downOnBackdrop) return;
    closeLightbox();
  });
  // Thanh trên cùng: bấm chỗ trống (kể cả ô đếm ảnh) cũng đóng, trừ các nút
  lb.querySelector('.ps-lb-top').addEventListener('click', (e) => {
    if (!e.target.closest('button, .ps-lb-actions')) closeLightbox();
  });

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
      generalNoteBox.hidden = (filter === 'all' || filter === 'edited');
    }
    // Tab "Ảnh đã chỉnh": ẩn lưới ảnh + nút gửi yêu cầu, hiện ô link + chat với thợ
    const editedMode = filter === 'edited';
    grid.style.display = editedMode ? 'none' : '';
    const submitBar = document.querySelector('.ps-submit-bar');
    if (submitBar) submitBar.style.display = editedMode ? 'none' : '';
    const panel = document.getElementById('psEditedPanel');
    if (panel) panel.hidden = !editedMode;
    renderEdited(true);
    syncBulkButtons();
    window.dispatchEvent(new Event('ps:filterchange'));
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
  // Ảnh trong gói gửi thợ ngay. Có ảnh chọn thêm thì các ảnh đó chờ thanh toán 30 phút
  // (extraPending), mở luôn mã QR (xem khối "Ảnh chọn thêm" ở trên).
  function executeSubmit() {
    const extraCount = Math.max(0, selected.size - PACKAGE_COUNT);
    // Ảnh chọn thêm = ảnh viền cam. Phòng khi số ảnh viền cam lệch số ảnh tính phí: lấy các ảnh chọn sau cùng
    let extraIds = [...selected].filter((id) => extraPhotos.has(id));
    if (extraIds.length !== extraCount) {
      extraIds = [...selected].slice(PACKAGE_COUNT);
      extraPhotos.clear();
      extraIds.forEach((id) => extraPhotos.add(id));
      selected.forEach((id) => setCardSelected(id, true, extraPhotos.has(id)));
    }

    requestSent = true;
    clearTimeout(draftTimer);
    if (window.AlohaData && AlohaData.saveSelectionDraft && session) AlohaData.saveSelectionDraft(session.phone, null); // đã gửi -> xoá nháp
    document.querySelectorAll('.ps-heart').forEach((btn) => { btn.disabled = true; });
    hideUndo();
    syncBulkButtons();
    submitBtn.disabled = true;
    submitBtn.textContent = 'Đã gửi yêu cầu';
    if (!window.AlohaData || !session) return;

    const toPhoto = (id) => ({ id, src: photoById[id].src, note: (photoNotes.get(id) || '').trim(), isExtra: extraPhotos.has(id) });
    const inPackage = [...selected].filter((id) => !extraPhotos.has(id)).map(toPhoto);
    const extras = extraIds.map(toPhoto);
    const req = AlohaData.createEditRequest({
      phone: session.phone,
      customerName: session.name,
      orderCode: record.orderCode,
      serviceLabel: record.serviceLabel,
      photoCount: inPackage.length,
      extraCount: 0,
      extraFee: 0,
      paymentStatus: 'Trong gói 10 ảnh',
      note: document.getElementById('psNote').value.trim(),
      photoNotes: inPackage.filter((p) => p.note).map((p) => ({ id: p.id, note: p.note })),
      photos: inPackage,
      extraPending: extras.length ? {
        code: paymentCode(extras.length),
        count: extras.length,
        fee: extras.length * EXTRA_PRICE,
        deadline: Date.now() + QR_VALID_MS,
        photos: extras
      } : null
    });

    renderSentBanner(req, 'sent');
    renderEdited(true);
    banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (req.extraPending) {
      startPayWatch();
      openQrPaymentModal(req.extraPending);
    }
  }

  // ===== Xem lại trước khi gửi (gửi rồi là khoá danh sách ảnh) =====
  const reviewModal = document.createElement('div');
  reviewModal.className = 'ps-modal-overlay';
  reviewModal.id = 'psReviewModal';
  reviewModal.innerHTML = `
    <div class="ps-modal ps-modal--confirm ps-modal--review" role="dialog" aria-modal="true" aria-labelledby="psReviewTitle">
      <h3 class="ps-modal-title" id="psReviewTitle">Xem lại trước khi gửi cho thợ</h3>
      <p class="ps-review-sum" id="psReviewSum"></p>
      <div class="ps-review-grid" id="psReviewGrid"></div>
      <div class="ps-review-note" id="psReviewNote"></div>
      <p class="ps-review-pay" id="psReviewPay" hidden></p>
      <p class="ps-modal-hint">Sau khi gửi, danh sách ảnh sẽ được khoá để thợ bắt đầu chỉnh.</p>
      <div class="ps-modal-actions">
        <button type="button" class="ps-modal-btn ps-modal-no" id="psReviewBack">Quay lại chỉnh</button>
        <button type="button" class="ps-modal-btn ps-modal-yes" id="psReviewConfirm">Gửi cho thợ</button>
      </div>
    </div>
  `;
  document.body.appendChild(reviewModal);
  const escR = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function openReview() {
    const ids = [...selected].sort((a, b) => Number(photoNo(a)) - Number(photoNo(b)));
    const extraCount = Math.max(0, selected.size - PACKAGE_COUNT);
    const extraFee = extraCount * EXTRA_PRICE;
    document.getElementById('psReviewSum').innerHTML = `<strong>${selected.size} ảnh</strong> · ${Math.min(selected.size, PACKAGE_COUNT)} ảnh trong gói`
      + (extraCount ? ` · <strong>${extraCount} ảnh chọn thêm (${fmtVnd(extraFee)})</strong>, viền cam` : '');
    document.getElementById('psReviewGrid').innerHTML = ids.map((id) => {
      const note = (photoNotes.get(id) || '').trim();
      return `
        <figure class="ps-review-item${extraPhotos.has(id) ? ' is-extra' : ''}">
          <img src="${escR(photoById[id].src)}" alt="Ảnh #${photoNo(id)}" loading="lazy" referrerpolicy="no-referrer">
          <figcaption>#${photoNo(id)}</figcaption>
          ${note ? `<p class="ps-review-photo-note" title="${escR(note)}">${escR(note)}</p>` : ''}
        </figure>`;
    }).join('');
    const general = ((document.getElementById('psNote') || {}).value || '').trim();
    document.getElementById('psReviewNote').innerHTML = general
      ? `<strong>Ghi chú chung:</strong> ${escR(general)}`
      : 'Chưa có ghi chú chung cho cả bộ. Bạn có thể thêm ở tab Yêu thích.';
    // Có ảnh chọn thêm: báo trước ảnh trong gói gửi ngay, ảnh chọn thêm phải thanh toán trong 30 phút
    const payNote = document.getElementById('psReviewPay');
    payNote.hidden = !extraCount;
    payNote.innerHTML = extraCount
      ? `<strong>${PACKAGE_COUNT} ảnh trong gói được gửi cho thợ ngay.</strong> ${extraCount} ảnh chọn thêm (${fmtVnd(extraFee)}) cần thanh toán qua mã QR trong <strong>${PAY_MIN} phút</strong> để được gửi tiếp; quá hạn chưa thanh toán, các ảnh này sẽ không được gửi đi.`
      : '';
    document.getElementById('psReviewConfirm').textContent = extraCount ? `Gửi & thanh toán ${fmtVnd(extraFee)}` : 'Gửi cho thợ';
    reviewModal.classList.add('show');
    document.getElementById('psReviewConfirm').focus();
  }
  function closeReview() {
    reviewModal.classList.remove('show');
  }
  document.getElementById('psReviewBack').addEventListener('click', () => { closeReview(); submitBtn.focus(); });
  reviewModal.addEventListener('click', (e) => { if (e.target === reviewModal) closeReview(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && reviewModal.classList.contains('show')) closeReview(); });
  document.getElementById('psReviewConfirm').addEventListener('click', () => {
    closeReview();
    if (selected.size === 0 || requestSent) return;
    // Ảnh trong gói gửi ngay; vượt gói thì mở thêm mã QR cho ảnh chọn thêm
    executeSubmit();
  });

  // ===== Submit: mở bước xem lại =====
  submitBtn.addEventListener('click', () => {
    if (selected.size === 0 || requestSent) return;
    openReview();
  });

  // ===== Tab "Ảnh đã chỉnh": link thư mục ảnh đã chỉnh Thợ ảnh gửi + chat với Thợ ảnh =====
  // Dữ liệu nằm trong yêu cầu chỉnh sửa mới nhất của khách (resultLink, messages trong
  // aloha_demo_db). Mô phỏng phía client: chỉ cập nhật được giữa các tab CÙNG trình duyệt.
  const editedTab = document.querySelector('.ps-tab[data-filter="edited"]');
  const editedPanel = document.getElementById('psEditedPanel');
  const resultMeta = document.getElementById('psResultMeta');
  const resultIcon = document.getElementById('psResultIcon');
  const resultTitle = document.getElementById('psResultTitle');
  const chatCard = document.getElementById('psChatCard');
  const RESULT_ICONS = {
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 3 10.5 13.5"/><path d="M21 3 14.5 21l-4-7.5L3 9.5z"/></svg>',
    sent: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.8L16 10"/></svg>',
    done: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="m9.5 13.5 1.8 1.8 3.7-3.8"/></svg>'
  };
  const resultBody = document.getElementById('psResultBody');
  const chatList = document.getElementById('psChatList');
  const chatForm = document.getElementById('psChatForm');
  const chatInput = document.getElementById('psChatInput');
  const chatSend = document.getElementById('psChatSend');
  const chatQuick = document.getElementById('psChatQuick');
  let editedSig = '';
  let aiPending = null; // id tin của khách đang chờ Trợ lý AI trả lời

  const escHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtTime = (t) => new Date(t).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });

  function latestRequest() {
    if (!window.AlohaData || !session) return null;
    return AlohaData.getEditRequests()
      .filter((r) => r.phone === session.phone)
      .sort((a, b) => b.createdAt - a.createdAt)[0] || null;
  }
  // "Tin mới" = thợ vừa gửi link hoặc nhắn thêm mà khách chưa mở tab xem
  function newsSig(req) { return AlohaData.editedNewsSig(req); }
  // Dấu "đã xem" nằm trong chính yêu cầu (customerSeenEditedSig), không tạo kho localStorage riêng
  function markEditedSeen(req) {
    const sig = newsSig(req);
    if (req.customerSeenEditedSig !== sig) { AlohaData.markCustomerSeenEdited(req.id, sig); req.customerSeenEditedSig = sig; }
  }
  function updateEditedDot(req) {
    if (!editedTab) return;
    const news = req ? AlohaData.editedNews(req) : null; // cùng cách tính với chuông thông báo
    const hasNews = !!news && (news.linkNew || news.replyNew);
    let dot = editedTab.querySelector('.ps-tab-dot');
    if (hasNews && !dot) {
      dot = document.createElement('span');
      dot.className = 'ps-tab-dot';
      dot.setAttribute('aria-label', 'Có cập nhật mới');
      editedTab.appendChild(dot);
    } else if (!hasNews && dot) dot.remove();
  }

  // Ô trong tab "Ảnh đã chỉnh": ảnh chọn thêm đang chờ thanh toán (kèm đồng hồ + nút thanh toán)
  // hoặc đã không được gửi vì quá hạn. Đồng hồ [data-pay-left] do renderPayCountdown cập nhật.
  function extraPayBox(req) {
    const p = req.extraPending;
    if (p && Date.now() >= p.deadline) return `
          <div class="ps-extra-pay is-pending">
            <strong>Đang xác nhận thanh toán ${escHtml(p.count)} ảnh chọn thêm</strong>
            <p>Đã hết ${PAY_MIN} phút. Nếu studio đã nhận được ${escHtml(fmtVnd(p.fee))} (ngân hàng có thể báo chậm vài phút), các ảnh này vẫn được gửi tới thợ; chưa thanh toán thì sẽ không được gửi đi.</p>
          </div>`;
    if (p) return `
          <div class="ps-extra-pay is-pending">
            <strong>${escHtml(p.count)} ảnh chọn thêm đang chờ thanh toán · còn <b data-pay-left>${fmtLeft(p.deadline - Date.now())}</b></strong>
            <p>Thanh toán ${escHtml(fmtVnd(p.fee))} trong ${PAY_MIN} phút kể từ lúc gửi để các ảnh này được gửi tới thợ. Quá hạn chưa thanh toán, ảnh chọn thêm sẽ không được gửi đi.</p>
            <button type="button" class="ps-extra-pay-btn" data-open-pay>Thanh toán ngay</button>
          </div>`;
    const d = req.extraDropped;
    if (d) return `
          <div class="ps-extra-pay is-dropped">
            <strong>${escHtml(d.count)} ảnh chọn thêm không được gửi đi</strong>
            <p>Quá ${PAY_MIN} phút studio chưa nhận được thanh toán ${escHtml(fmtVnd(d.fee || 0))}. ${escHtml(req.photoCount || (req.photos || []).length)} ảnh trong gói vẫn được chỉnh bình thường. Nếu bạn đã chuyển khoản, gọi hotline ${HOTLINE} để được hỗ trợ.</p>
          </div>`;
    return '';
  }

  function renderEdited(force) {
    const req = latestRequest();
    const open = !!editedPanel && !editedPanel.hidden;
    // Chỉ tính "đã xem" khi khách thật sự đang nhìn tab này: đang ở view "Ảnh của tôi" và
    // cửa sổ đang mở (ở Trang chủ thì tin mới vẫn phải hiện nổi bật trên chuông thông báo).
    const view = document.getElementById('view-chon-anh');
    const viewing = open && !(view && view.hidden) && !document.hidden;
    if (viewing && req) markEditedSeen(req);
    updateEditedDot(req);
    if (!open) return;
    const msgs = req && Array.isArray(req.messages) ? req.messages : [];
    const sig = req ? [req.id, req.status, req.resultLink || '', msgs.length, aiPending || '',
      (req.extraPending ? (Date.now() >= req.extraPending.deadline ? 'X' : 'P') : '') + (req.extraDropped ? 'D' : '') + (req.extraCount || 0)].join('|') : 'none';
    if (!force && sig === editedSig) return;
    const prevCount = editedSig.split('|')[3];
    editedSig = sig;

    // --- Ô "Ảnh đã chỉnh": chưa gửi yêu cầu -> hướng dẫn chọn & gửi ảnh cho thợ; đã gửi ->
    // báo đã gửi + tiến độ 3 bước; thợ gửi link -> nút mở thư mục ảnh đã chỉnh.
    if (chatCard) chatCard.hidden = !req; // chưa gửi thì chưa có gì để trao đổi với thợ
    if (!req) {
      const n = selected.size;
      resultIcon.innerHTML = RESULT_ICONS.send;
      resultTitle.textContent = 'Chưa gửi ảnh cho thợ chỉnh ảnh';
      resultMeta.textContent = 'Chọn những tấm bạn ưng nhất rồi gửi, thợ chỉnh ảnh sẽ bắt đầu và gửi lại link ảnh đã chỉnh ngay tại đây.';
      resultBody.innerHTML = `
        <ol class="ps-send-steps">
          <li class="${n ? 'done' : ''}"><span>1</span><div>Thả tim những ảnh bạn yêu thích${n ? ` <strong>(đã chọn ${n})</strong>` : ''}</div></li>
          <li><span>2</span><div>Ghi chú mong muốn chỉnh sửa (nếu có)</div></li>
          <li><span>3</span><div>Bấm "Gửi yêu cầu chỉnh sửa"</div></li>
        </ol>
        <button type="button" class="ps-result-link ps-send-cta" id="psGoSelect">${n ? 'Xem ảnh đã chọn & gửi cho thợ' : 'Chọn ảnh để gửi cho thợ'}</button>`;
      document.getElementById('psGoSelect').addEventListener('click', () => {
        switchToTab(selected.size ? 'liked' : 'all');
        const tabs = document.querySelector('.ps-tabs');
        if (tabs) tabs.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } else {
      const safeLink = /^https:\/\//i.test(req.resultLink || '') ? req.resultLink : '';
      resultIcon.innerHTML = safeLink ? RESULT_ICONS.done : RESULT_ICONS.sent;
      resultTitle.textContent = safeLink ? 'Ảnh đã chỉnh của bé đã sẵn sàng' : 'Yêu cầu chỉnh sửa đã được gửi đến thợ ảnh';
      resultMeta.innerHTML = `Mã đơn <strong>${escHtml(req.orderCode || req.id)}</strong> · ${escHtml(req.photoCount || (req.photos || []).length)} ảnh · gửi lúc ${escHtml(fmtTime(req.createdAt))}`;
      // Tiến độ: số bước đã xong (1 = đã gửi, 2 = thợ chỉnh xong, 3 = đã có link)
      const doneSteps = safeLink ? 3 : req.status === 'Hoàn thành' ? 2 : 1;
      const stepper = `<ol class="ps-progress-steps" aria-label="Tiến độ chỉnh sửa">${['Đã gửi cho thợ', 'Thợ đang chỉnh ảnh', 'Nhận ảnh đã chỉnh']
        .map((t, i) => `<li class="${i < doneSteps ? 'done' : i === doneSteps ? 'current' : ''}"><span></span>${t}</li>`).join('')}</ol>`
        + extraPayBox(req);
      if (safeLink) {
        resultBody.innerHTML = stepper + `
          <a class="ps-result-link" id="psResultLink" target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>
            <span>Mở thư mục ảnh đã chỉnh</span>
          </a>
          <div class="ps-result-url"><span id="psResultUrl"></span><button type="button" class="ps-result-copy" id="psResultCopy">Sao chép link</button></div>
          <p class="ps-result-time">Thợ gửi lúc ${escHtml(fmtTime(req.resultLinkAt || req.createdAt))}</p>`;
        // Gán qua thuộc tính DOM (không nối chuỗi HTML); link đã được data-store chặn chỉ cho https
        document.getElementById('psResultLink').href = safeLink;
        document.getElementById('psResultUrl').textContent = safeLink;
        document.getElementById('psResultCopy').addEventListener('click', (e) => {
          const btn = e.currentTarget;
          const done = () => { btn.textContent = 'Đã sao chép'; setTimeout(() => { btn.textContent = 'Sao chép link'; }, 1800); };
          if (navigator.clipboard) navigator.clipboard.writeText(safeLink).then(done, () => {});
        });
      } else {
        const waitText = req.status === 'Hoàn thành'
          ? 'Ảnh của bé đã chỉnh xong, thợ đang tải ảnh lên. Link ảnh đã chỉnh sẽ hiện ở đây trong ít phút.'
          : req.status === 'Đang thực hiện'
            ? 'Thợ đang chỉnh ảnh của bé. Link ảnh đã chỉnh sẽ hiện ở đây ngay khi thợ gửi.'
            : 'Thợ chỉnh ảnh đã nhận yêu cầu và sẽ bắt đầu sớm. Link ảnh đã chỉnh sẽ hiện ở đây ngay khi thợ gửi.';
        resultBody.innerHTML = stepper + `
          <p class="ps-result-waiting"><span class="ps-result-pulse" aria-hidden="true"></span>${waitText}</p>`;
      }
    }

    // --- Chat với thợ chỉnh ảnh. Người dùng chốt (2026-09-27): tin của trợ lý tự động hiện
    // như tin của thợ chỉnh ảnh, giao diện khách không nhắc tới AI. Trang quản trị vẫn ghi rõ
    // tin nào do trợ lý tự động trả lời, và trợ lý không nói dối nếu khách hỏi thẳng (server/).
    chatInput.disabled = chatSend.disabled = !req || aiPending;
    if (chatQuick) chatQuick.querySelectorAll('button').forEach((b) => { b.disabled = !req || !!aiPending; });
    chatInput.placeholder = req ? 'Nhắn cho thợ chỉnh ảnh...' : 'Gửi yêu cầu chỉnh sửa trước để trò chuyện';
    if (!msgs.length && !aiPending) {
      chatList.innerHTML = `<p class="ps-chat-empty">${req ? 'Chưa có tin nhắn. Bạn cần hỏi gì về ảnh của bé cứ nhắn, thợ chỉnh ảnh sẽ trả lời bạn ngay.' : 'Khung trò chuyện sẽ mở khi bạn đã gửi yêu cầu chỉnh sửa.'}</p>`;
    } else {
      chatList.innerHTML = msgs.map((m) => {
        const mine = m.from === 'customer';
        const name = mine ? '' : `<span class="ps-msg-name">${escHtml(m.from === 'ai' ? STAFF_VOICE : (m.name || STAFF_VOICE))}</span>`;
        return `
        <div class="ps-msg ${mine ? 'from-me' : 'from-staff'}">
          ${name}
          <p>${escHtml(m.text)}</p>
          <time>${escHtml(fmtTime(m.at))}</time>
        </div>`;
      }).join('') + (aiPending ? `
        <div class="ps-msg from-staff is-typing" aria-label="Thợ chỉnh ảnh đang trả lời">
          <span class="ps-msg-name">${STAFF_VOICE}</span>
          <p><span class="ps-typing"><i></i><i></i><i></i></span></p>
        </div>` : '');
      if (String(msgs.length) !== prevCount || aiPending) chatList.scrollTop = chatList.scrollHeight;
    }
  }

  function autoSizeChat() {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
  }

  // Gửi tin của khách: lưu ngay (mặc định cần thợ xem), rồi hỏi trợ lý tự động (server/ ->
  // Gemini) kèm đúng thông tin đơn. Trả lời đủ thì bỏ cờ "cần thợ"; trợ lý không phản hồi thì
  // chỉ báo đã nhận tin và để nguyên cho thợ trả lời (không bịa câu trả lời).
  const STAFF_VOICE = 'Thợ chỉnh ảnh ALOHA';
  const AI_NAME = STAFF_VOICE;
  async function askEditAssistant(req, msgId) {
    const history = (Array.isArray(req.messages) ? req.messages : []).slice(-12).map((m) => ({
      role: m.from === 'customer' ? 'user' : 'assistant',
      content: m.from === 'staff' ? '(Thợ chỉnh ảnh trả lời) ' + m.text : m.text
    }));
    const context = {
      orderCode: req.orderCode || '', serviceLabel: req.serviceLabel || '',
      photoCount: req.photoCount || (req.photos || []).length, extraCount: req.extraCount || 0,
      status: req.status, hasLink: !!req.resultLink
    };
    try {
      const res = await fetch(PAYMENT_API_BASE + '/api/edit-chat', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: history, context })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (!data || typeof data.reply !== 'string' || !data.reply.trim()) throw new Error('empty');
      AlohaData.setMessageNeedsStaff(req.id, msgId, data.forward !== false);
      AlohaData.addRequestMessage(req.id, 'ai', AI_NAME, data.reply);
    } catch (err) {
      AlohaData.addRequestMessage(req.id, 'ai', AI_NAME, 'Mình đã nhận được tin nhắn của bạn rồi nhé. Thợ chỉnh ảnh sẽ xem kỹ và phản hồi bạn sớm nhất.');
    }
  }
  if (chatForm) {
    chatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const req = latestRequest();
      const text = chatInput.value.trim();
      if (!req || !text || aiPending) return;
      const saved = AlohaData.addRequestMessage(req.id, 'customer', (session && session.name) || 'Khách hàng', text);
      if (!saved) return;
      chatInput.value = '';
      autoSizeChat();
      aiPending = saved.messages[saved.messages.length - 1].id;
      renderEdited(true);
      await askEditAssistant(saved, aiPending);
      aiPending = null;
      renderEdited(true);
      chatInput.focus();
    });
    chatInput.addEventListener('input', autoSizeChat);
    // Câu hỏi nhanh: điền sẵn câu hỏi rồi gửi luôn
    if (chatQuick) chatQuick.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-q]');
      if (!b || b.disabled) return;
      chatInput.value = b.dataset.q;
      chatForm.requestSubmit();
    });
    // Enter để gửi, Shift+Enter để xuống dòng
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); chatForm.requestSubmit(); }
    });
  }
  // Thợ gửi link / trả lời ở tab khác cùng trình duyệt -> cập nhật không cần tải lại trang
  window.addEventListener('storage', (e) => { if (e.key === 'aloha_demo_db') renderEdited(false); });
  setInterval(() => renderEdited(false), 4000);

  // ===== Ô "Đã chọn" nổi theo khi cuộn xem ảnh =====
  // Ô gốc ở đầu trang cuộn khuất thì chính ô đó chuyển sang position: fixed ngay dưới thanh
  // menu (giữ nguyên số liệu + nút chọn nhanh); ô giữ chỗ cùng kích thước để trang không giật.
  const summaryCard = document.getElementById('psSummaryCard');
  const siteHeader = document.querySelector('.site-header');
  if (summaryCard) {
    const slot = document.createElement('div');
    slot.className = 'ps-summary-slot';
    summaryCard.parentNode.insertBefore(slot, summaryCard);
    slot.appendChild(summaryCard);
    let floating = false, ticking = false;

    function setFloating(on, slotRect) {
      floating = on;
      summaryCard.classList.toggle('is-floating', on);
      slot.style.width = on ? slotRect.width + 'px' : '';
      slot.style.height = on ? slotRect.height + 'px' : '';
      if (!on) summaryCard.style.top = summaryCard.style.left = summaryCard.style.width = '';
    }
    function placeSummary() {
      ticking = false;
      const view = document.getElementById('view-chon-anh');
      const active = !!view && !view.hidden && currentFilter !== 'edited';
      const headerBottom = siteHeader ? Math.max(0, siteHeader.getBoundingClientRect().bottom) : 0;
      const slotRect = slot.getBoundingClientRect();
      const shouldFloat = active && slotRect.height > 0 && slotRect.bottom < headerBottom + 8;
      if (shouldFloat !== floating) setFloating(shouldFloat, slotRect);
      if (!floating) return;
      summaryCard.style.top = headerBottom + 10 + 'px';
      // Màn rộng: nổi đúng cột bên phải như vị trí gốc; màn hẹp: trải ngang (xem CSS)
      const wide = window.innerWidth > 768;
      summaryCard.style.left = wide ? slotRect.left + 'px' : '';
      summaryCard.style.width = wide ? slotRect.width + 'px' : '';
    }
    const requestPlace = () => { if (!ticking) { ticking = true; requestAnimationFrame(placeSummary); } };
    window.addEventListener('scroll', requestPlace, { passive: true });
    window.addEventListener('resize', () => { if (floating) setFloating(false); requestPlace(); });
    window.addEventListener('hashchange', requestPlace);
    window.addEventListener('ps:filterchange', requestPlace);
    requestPlace();
  }

  // ===== Đã gửi yêu cầu từ trước (tải lại trang / quay lại sau) -> khôi phục đúng trạng thái đã gửi =====
  // Trước đây tải lại trang là lưới ảnh mở khoá, khách gửi được thêm yêu cầu trong khi tab
  // "Ảnh đã chỉnh" báo đã gửi -> 2 thông tin trái nhau. Giờ: đánh dấu lại đúng ảnh đã gửi
  // (kể cả ảnh vượt gói, ghi chú), khoá lưới + nút gửi, và báo rõ đã gửi lúc nào.
  function restoreSentRequest() {
    const req = latestRequest();
    if (!req) return;
    requestSent = true;
    const sentPhotos = Array.isArray(req.photos) ? req.photos : [];
    // Yêu cầu cũ chưa lưu cờ isExtra: ảnh từ thứ (gói + 1) trở đi là ảnh vượt gói
    const hasExtraFlag = sentPhotos.some((p) => 'isExtra' in p);
    // Ảnh chọn thêm còn chờ thanh toán: vẫn hiện đã chọn (viền cam) như lúc gửi
    const pendingPhotos = req.extraPending && Array.isArray(req.extraPending.photos) ? req.extraPending.photos : [];
    sentPhotos.forEach((p, i) => {
      if (!photoById[p.id]) return;
      const extra = hasExtraFlag ? !!p.isExtra : i >= PACKAGE_COUNT;
      selected.add(p.id);
      if (extra) extraPhotos.add(p.id);
      if (p.note) photoNotes.set(p.id, p.note);
      setCardSelected(p.id, true, extra);
    });
    pendingPhotos.forEach((p) => {
      if (!photoById[p.id]) return;
      selected.add(p.id);
      extraPhotos.add(p.id);
      if (p.note) photoNotes.set(p.id, p.note);
      setCardSelected(p.id, true, true);
    });
    extraModeActive = extraPhotos.size > 0;
    const noteEl = document.getElementById('psNote');
    if (noteEl) { noteEl.value = req.note || ''; noteEl.readOnly = true; }
    document.querySelectorAll('.ps-heart').forEach((btn) => { btn.disabled = true; });
    submitBtn.textContent = 'Đã gửi yêu cầu';
    renderSentBanner(req, 'sent');
    // Còn ảnh chọn thêm chờ thanh toán -> đếm tiếp; đã quá hạn khi tải lại thì kiểm tra lần cuối rồi chốt
    if (req.extraPending) startPayWatch();
  }
  restoreSentRequest();

  // ===== Nhớ ảnh đang chọn dở (chưa gửi): tải lại trang / quay lại sau vẫn còn =====
  function scheduleDraftSave() {
    if (requestSent || !window.AlohaData || !AlohaData.saveSelectionDraft || !session) return;
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      if (requestSent) return;
      const notes = {};
      photoNotes.forEach((v, k) => { if (v && v.trim()) notes[k] = v; });
      const noteEl = document.getElementById('psNote');
      const general = noteEl ? noteEl.value : '';
      const hasAnything = selected.size || Object.keys(notes).length || general.trim();
      AlohaData.saveSelectionDraft(session.phone, hasAnything ? { ids: [...selected], extra: [...extraPhotos], notes, general } : null);
    }, 300);
  }
  function restoreDraft() {
    if (requestSent || !window.AlohaData || !AlohaData.getSelectionDraft || !session) return;
    const d = AlohaData.getSelectionDraft(session.phone);
    if (!d) return;
    const extra = new Set(d.extra || []);
    (d.ids || []).forEach((id) => {
      if (!photoById[id]) return;
      selected.add(id);
      if (extra.has(id)) extraPhotos.add(id);
      setCardSelected(id, true, extra.has(id));
    });
    extraModeActive = extraPhotos.size > 0;
    Object.entries(d.notes || {}).forEach(([k, v]) => { if (photoById[k]) photoNotes.set(k, v); });
    const noteEl = document.getElementById('psNote');
    if (noteEl && d.general) noteEl.value = d.general;
    if (selected.size && bulkUndo) {
      bulkUndo.innerHTML = `<span>Đã giữ lại ${selected.size} ảnh bạn chọn lần trước.</span>`;
      clearTimeout(undoTimer);
      undoTimer = setTimeout(hideUndo, 6000);
    }
  }
  restoreDraft();

  // Cho chuông thông báo (js/script.js) mở thẳng tab "Ảnh đã chỉnh" / mã QR ảnh chọn thêm
  window.AlohaPhotos = {
    openEditedTab() {
      switchToTab('edited');
      const tabs = document.querySelector('.ps-tabs');
      if (tabs) tabs.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    openPayment() {
      const req = pendingRequest();
      if (req) openQrPaymentModal(req.extraPending); else this.openEditedTab();
    }
  };
  const psNoteEl = document.getElementById('psNote');
  if (psNoteEl) psNoteEl.addEventListener('input', scheduleDraftSave);
  const allCount = document.getElementById('psAllCount');
  if (allCount) allCount.textContent = photos.length;

  updateSummary();
  applyFilter('all');
});


