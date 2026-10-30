// ALOHA Baby - view "Ảnh của tôi" (#/chon-anh trong index.html, xem js/router.js): chọn ảnh cần chỉnh sửa hậu kỳ.
// Thợ giao thư mục Drive trước; khách chọn đúng file đã giao để yêu cầu chỉnh.
// Xem .claude/rules/workflow.md (mục "Giao diện chọn ảnh") và
// .claude/rules/tech-defaults.md (mục "Cấu hình chưa xác định").
document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('psGrid');
  if (!grid) return; // không phải trang chọn ảnh

  const EXTRA_PRICE = 50000;     // đơn giá mỗi ảnh chỉnh sửa thêm: 50K/tấm
  let PACKAGE_COUNT = 10;      // gói tiêu chuẩn: 10 tấm ảnh miễn phí

  // Hồ sơ hiển thị được lấy từ bộ ảnh thợ giao, kể cả khách chưa có hồ sơ demo.
  const session = window.AlohaAuth ? AlohaAuth.getSession() : null;
  const record = session ? {orderCode:'', serviceLabel:'', packageLabel:'10 ảnh'} : null;
  let sourceAlbum = null;

  const emptyState = document.getElementById('psEmptyState');
  const psContent = document.getElementById('psContent');

  if (!record) {
    if (emptyState) emptyState.hidden = false;
    if (psContent) psContent.style.display = 'none';
    document.getElementById('psOrderInfo').textContent = 'Chưa có buổi chụp nào được ghi nhận cho tài khoản này.';
    const summaryCard = document.getElementById('psSummaryCard');
    if (summaryCard) summaryCard.style.display = 'none';
    return;
  }

  document.getElementById('psOrderInfo').textContent = 'Đang tải bộ ảnh gốc thợ gửi cho bạn...';

  // Only photos explicitly delivered to this customer belong in this grid.
  const photos = [];

  const heartIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-4.35-9.5-8.5C.7 9.2 2.4 6 5.6 6c1.8 0 3.1 1 3.9 2.3.8 1.3 1 1.3 1 1.3s.2 0 1-1.3C12.3 7 13.6 6 15.4 6c3.2 0 4.9 3.2 3.1 6.5C16 16.65 12 21 12 21z"/></svg>';

  grid.replaceChildren();

  const selected = new Set();
  const extraPhotos = new Set();   // ảnh chỉnh sửa thêm (vượt gói)
  let extraModeActive = false;     // khách đã đồng ý chỉnh sửa thêm
  const sentPhotoIds = new Set();
  let requestSent = false;
  // Đồng bộ yêu cầu chỉnh ảnh qua server (cờ editSync trong js/features.js, thêm 2026-10-15).
  // TẮT (mặc định): luồng AlohaData/localStorage cũ, không đổi gì. BẬT: gửi yêu cầu, tải lại trạng
  // thái đã gửi, tin nhắn, "đã xem" đi qua AlohaEditSync (server/edit-requests.js); server lỗi thì
  // báo lỗi, KHÔNG ghi localStorage thay thế và KHÔNG báo đã gửi. Dữ liệu server chỉ giữ trong bộ
  // nhớ trang (không lưu localStorage/sessionStorage). Yêu cầu cũ trong localStorage KHÔNG được
  // chuyển lên server. Hồ sơ gói chụp (getCustomerRecord) vẫn đọc từ AlohaData vì API chưa có.
  const SYNC = !!(window.AlohaEditSync && AlohaEditSync.enabled());
  let syncRequests = [];           // yêu cầu của khách theo server (bản mới nhất đã tải)
  let syncLoaded = false;          // đã tải được danh sách từ server ít nhất 1 lần
  let syncError = '';              // lỗi lần tải gần nhất (hiện trong tab Ảnh đã chỉnh)
  let chatError = '';              // lỗi gửi tin nhắn gần nhất (giữ tới khi gửi lại thành công)
  let submitting = false;          // đang chờ server xác nhận gửi yêu cầu
  let paidPending = null;          // đã thanh toán ảnh chọn thêm nhưng gửi lỗi -> cho gửi lại, không bắt trả lại tiền
  const photoNotes = new Map();
  const photoOptions = new Map();
  const editOptions = ['Chỉnh da', 'Chỉnh màu', 'Ánh sáng', 'Xóa chi tiết thừa', 'Khác'];
  let parentRequestId = '';
  let round = 1;
  // Lượt sau không có ảnh miễn phí: ẩn "/ 0", ghi rõ giá mỗi ảnh
  function showQuota() { const q=document.getElementById('psQuotaPart'),n=document.getElementById('psPaidNote'); if(q) q.hidden=PACKAGE_COUNT===0; if(n) n.hidden=PACKAGE_COUNT!==0;
    const lead=document.getElementById('psExtraLead'),note=document.getElementById('psExtraNote');
    if(lead) lead.textContent=PACKAGE_COUNT===0?'Lượt chỉnh thêm:':'Vượt';
    if(note) note.textContent=PACKAGE_COUNT===0?'(Từ lượt thứ 2, mỗi ảnh chỉnh 50.000đ)':'(Đơn giá: 50.000đ / ảnh chỉnh sửa thêm ngoài gói 10 ảnh)'; }
  function combinedNote(id) { return [...(photoOptions.get(id) || []).filter(o => o !== 'Khác'), photoNotes.get(id) || ''].filter(Boolean).join(' · '); }
  // Nhãn ngắn cho vừa ô ảnh trên điện thoại; giá trị gửi thợ vẫn là tên đầy đủ
  const CHIP_SHORT = { 'Chỉnh da': 'Da', 'Chỉnh màu': 'Màu', 'Ánh sáng': 'Ánh sáng', 'Xóa chi tiết thừa': 'Xoá vật thừa', 'Khác': 'Khác' };
  function editChips() {
    return editOptions.map(label => `<button type="button" class="ps-edit-chip" value="${label}" aria-pressed="false" title="${label}">${CHIP_SHORT[label] || label}</button>`).join('');
  }
  function syncEditor(editor, id, locked) {
    editor.querySelectorAll('.ps-edit-chip').forEach(button => {
      button.setAttribute('aria-pressed', String((photoOptions.get(id) || []).includes(button.value)));
      button.disabled = locked;
    });
    const note = editor.querySelector('input');
    if (document.activeElement !== note) note.value = photoNotes.get(id) || '';
    note.readOnly = locked;
    note.hidden = !(photoOptions.get(id) || []).includes('Khác');
  }
  function bindEditor(editor, getId) {
    editor.addEventListener('click', e => {
      e.stopPropagation();
      const button = e.target.closest('.ps-edit-chip'), id = getId();
      if (!button || button.disabled || sentPhotoIds.has(id) || isSelectionLocked()) return;
      const options = new Set(photoOptions.get(id) || []);
      if (options.has(button.value)) options.delete(button.value); else options.add(button.value);
      photoOptions.set(id, editOptions.filter(option => options.has(option)));
      const note = editor.querySelector('input');
      if (button.value === 'Khác') {
        if (options.has('Khác')) setTimeout(() => note.focus(), 0);
        else photoNotes.delete(id); // tắt Khác thì bỏ luôn ghi chú
      }
      updateSummary();
    });
    editor.querySelector('input').addEventListener('input', e => {
      const id = getId();
      if (sentPhotoIds.has(id) || isSelectionLocked()) return;
      photoNotes.set(id, e.target.value);
      updateSummary();
    });
  }
  function syncGridEditors() {
    document.querySelectorAll('.ps-photo').forEach(card => {
      const id = card.dataset.id, editor = card.querySelector('.ps-grid-editor');
      if (!editor) return;
      editor.hidden = !selected.has(id) || sentPhotoIds.has(id);
      if (!editor.hidden) syncEditor(editor, id, isSelectionLocked() || photoById[id]?.previewOnly);
    });
  }
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
      const card = document.querySelector(`[data-id="${pendingExtraId}"]`);
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
      const card = document.querySelector(`[data-id="${pendingExtraId}"]`);
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
  let lastPaidCode='';
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
    document.querySelectorAll('.ps-heart').forEach((btn) => { btn.disabled = locked; btn.setAttribute('aria-disabled', String(locked || sentPhotoIds.has(btn.closest('.ps-photo').dataset.id))); });
    if (locked) hideUndo();
    syncBulkButtons();
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
      renderCart();
      if (!qrOverlay.classList.contains('show')) showUnpaidBanner();
      return;
    }
    if (Date.now() - lastPoll >= PAY_POLL_MS) {
      lastPoll = Date.now();
      checkPayment();
    }
  }

  function onPaid(paid) {
    lastPaidCode=paid.code;
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
    renderCart();
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
    const pct = Math.min(100, (n / (PACKAGE_COUNT || 1)) * 100);
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

    // Chế độ đồng bộ: chưa tải xong dữ liệu server (chưa biết đã gửi chưa) hoặc đang gửi -> khoá nút
    submitBtn.disabled = !sourceAlbum || n === 0 || requestSent || (SYNC && (!syncLoaded || submitting));
    syncGridEditors();
    syncLightbox();
    syncBulkButtons();
    renderCart();
  }

  // ===== Xử lý click: tim = chọn ảnh, bấm vào ảnh = mở xem ảnh lớn =====
  document.getElementById('view-chon-anh').addEventListener('click', (e) => {
    if (e.target.closest('.ps-grid-editor')) return;
    if (e.target.closest('a')) return;
    const heart = e.target.closest('.ps-heart');
    if (heart) { toggleSelect(heart.closest('.ps-photo').dataset.id); return; }
    const photoCard = e.target.closest('.ps-photo');
    if (photoCard) openLightbox(photoCard.dataset.id);
  });

  // Chọn/bỏ chọn 1 ảnh (dùng chung cho nút tim trên lưới và trong lightbox)
  function toggleSelect(id) {
    const card = document.querySelector(`.ps-photo[data-id="${id}"]`);
    const heartBtn = card && card.querySelector('.ps-heart');
    if(sentPhotoIds.has(id)) {
      const target=lb.classList.contains('show') ? lb.querySelector('#psLbFav') : heartBtn;
      let hint=document.getElementById('psLockedHint');if(!hint){hint=document.createElement('span');hint.id='psLockedHint';hint.setAttribute('role','status');}
      hint.textContent='Đã gửi thợ; bạn vẫn có thể chọn ảnh khác.';target?.after(hint);setTimeout(()=>hint.remove(),4000);return;
    }
    if (!heartBtn || heartBtn.disabled || photoById[id]?.previewOnly) return;
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
    return submitting || !!paidPending || !!(qr && Date.now()<qr.deadline) || (SYNC && !syncLoaded);
  }
  // Ảnh đang hiện trong lưới (theo tab đang xem) mà chưa được chọn
  function visibleUnselectedIds() {
    return Array.from(grid.querySelectorAll('.ps-photo:not(.hidden-by-filter)'), (c) => c.dataset.id)
      .filter((id) => !selected.has(id) && !sentPhotoIds.has(id));
  }
  function syncBulkButtons() {
    if (!selectAllBtn || !clearAllBtn) return;
    const locked = isSelectionLocked();
    selectAllBtn.disabled = locked || visibleUnselectedIds().length === 0;
    clearAllBtn.disabled = locked || selected.size === 0;
  }
  function setCardSelected(id, on, extra) {
    const card = document.querySelector(`.ps-photo[data-id="${id}"]`);
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
    undoBtn.focus({ preventScroll: true });
    bulkUndo.scrollIntoView({ block: 'center', behavior: 'instant' });
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
          <span class="ps-lb-extra" id="psLbExtra" hidden>Ảnh chọn thêm +50K</span>
          <div class="ps-edit-chips" id="psEditOptions" role="group" aria-label="Cách chỉnh sửa">${editChips()}</div>
          <input id="psLbNote" class="ps-edit-note" type="text" aria-label="Ghi chú thêm cho ảnh" placeholder="Bạn muốn chỉnh gì khác?">
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
    lbImg.alt = p.name || `Ảnh số ${photos.indexOf(p) + 1}`;
    applyLbTransform();
    lb.querySelector('#psLbCounter').textContent = `${lbIndex + 1} / ${lbIds.length}${p.name ? ' · ' + p.name : ''}`;
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
    const heart = document.querySelector(`.ps-photo[data-id="${id}"] .ps-heart`);
    const locked = sentPhotoIds.has(id) || !heart || heart.disabled;
    const favBtn = lb.querySelector('#psLbFav');
    favBtn.classList.toggle('active', isSel);
    favBtn.setAttribute('aria-pressed', String(isSel));
    favBtn.disabled = locked && !sentPhotoIds.has(id); favBtn.style.opacity=requestSent?'0.35':'';
    lb.querySelector('#psLbFavText').textContent = isSel ? 'Đã chọn yêu thích' : 'Chọn làm yêu thích';
    lb.querySelector('#psLbFavInfo').textContent = locked && !isSel
      ? 'Danh sách ảnh đang khoá'
      : PACKAGE_COUNT === 0 ? `Đã chọn ${selected.size} ảnh · 50.000đ/ảnh` : `Đã chọn ${selected.size}/${PACKAGE_COUNT} ảnh trong gói`;
    lb.querySelector('#psLbNoteWrap').hidden = !isSel || sentPhotoIds.has(id);
    lb.querySelector('#psLbExtra').hidden = !extraPhotos.has(id);
    if (document.activeElement !== lbNote) lbNote.value = photoNotes.get(id) || '';
    lbNote.readOnly = locked;
    syncEditor(lb.querySelector('#psLbNoteWrap'), id, locked);
  }

  function openLightbox(id) {
    const host = document.querySelector(`.ps-photo[data-id="${id}"]`)?.parentElement || grid;
    const visible = Array.from(host.querySelectorAll('.ps-photo:not(.hidden-by-filter)')).map(c => c.dataset.id);
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
  bindEditor(lb.querySelector('#psLbNoteWrap'), () => lbIds[lbIndex]);

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

    grid.querySelectorAll('.ps-photo').forEach((card) => {
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
    const drv = document.getElementById('psDrivePanel'); if (drv) drv.hidden = editedMode;
    try { toolbar.hidden = editedMode; } catch (e) {}
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
  function executeSubmit(extraCount, extraFee, paymentStatus) {
    if (SYNC) { submitToServer(extraCount, extraFee, paymentStatus); return; }
    if (window.AlohaData && session) {
      const perPhotoNotes = Array.from(selected)
        .map(id => ({ id, note: combinedNote(id).trim() }))
        .filter(n => n.note);
      const allSelectedPhotos = Array.from(selected)
        .map(id => Object.assign({}, photoById[id], {note:(photoNotes.get(id)||'').trim(), editOptions:photoOptions.get(id)||[], isExtra:extraPhotos.has(id)}));

      AlohaData.createEditRequest({
        phone: session.phone,
        customerName: session.name,
        orderCode: record.orderCode,
        parentRequestId,
        sourceAlbumId:sourceAlbum.id,
        workflowOrderId:sourceAlbum.workflowOrderId,
        editorPhone:sourceAlbum.editorPhone,
        sourceFolderUrl:sourceAlbum.folderUrl,
        round,
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
    showSubmittedUi(extraCount, extraFee);
  }

  // Chỉ khóa ảnh đã gửi, xóa lựa chọn mới và chuẩn bị lượt tiếp theo sau khi lưu thành công.
  function showSubmittedUi(extraCount, extraFee) {
    if (extraCount > 0) {
      banner.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        <div class="ps-banner-info">
          <strong>Đã nhận thanh toán, ảnh của bé đã được gửi tới đội ngũ Thợ ảnh!</strong>
          <p>Lượt ${round}: <strong>${selected.size} ảnh</strong>, miễn phí ${PACKAGE_COUNT} ảnh; <strong>${extraCount} ảnh tính phí: ${extraFee.toLocaleString('vi-VN')}đ</strong>. Theo dõi tiến độ và nhận ảnh ở tab "Ảnh đã chỉnh".</p>
        </div>
      `;
    } else {
      banner.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        <span>Đã gửi yêu cầu chỉnh sửa cho đội ngũ Thợ ảnh. Bạn có thể gửi thêm ảnh bất cứ lúc nào với phí 50.000đ/ảnh. Theo dõi tiến độ từng lượt ở tab "Ảnh đã chỉnh".</span>
      `;
    }

    banner.classList.add('show');
    selected.clear(); extraPhotos.clear(); photoNotes.clear(); photoOptions.clear(); lastPaidCode='';
    document.querySelectorAll('.ps-photo').forEach(c=>setCardSelected(c.dataset.id,false,false));
    document.getElementById('psNote').value='';
    restoreSentRequest(); updateSummary();
    banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // Banner lỗi (chế độ đồng bộ): server chưa xác nhận -> nói rõ yêu cầu CHƯA được gửi
  function showSubmitError(message) {
    banner.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
      <div class="ps-banner-info">
        <strong>Yêu cầu chỉnh sửa CHƯA được gửi</strong>
        <p></p>
      </div>`;
    banner.querySelector('p').textContent = message;
    banner.setAttribute('role', 'alert');
    banner.classList.add('show');
    banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // Chế độ đồng bộ: gửi yêu cầu lên server, CHỈ khoá + báo "đã gửi" khi server xác nhận.
  // Lỗi (mất mạng, 401/403, 409, dữ liệu sai...) -> báo lỗi, giữ nguyên ảnh đã chọn + ghi chú để gửi lại,
  // không ghi gì vào localStorage. SĐT + tên khách server lấy từ token, không gửi từ trang.
  async function submitToServer(extraCount, extraFee, paymentStatus) {
    if (submitting || requestSent) return;
    submitting = true;
    // Đã thanh toán ảnh chọn thêm: nhớ lại (chỉ trong bộ nhớ trang) để gửi lại không bắt trả lại tiền
    paidPending = extraFee > 0 ? { count: extraCount, fee: extraFee, status: paymentStatus } : null;
    document.querySelectorAll('.ps-heart').forEach((btn) => { btn.disabled = false; btn.setAttribute('aria-disabled','true'); btn.style.opacity='0.35'; });
    hideUndo();
    syncBulkButtons();
    submitBtn.disabled = true;
    submitBtn.textContent = 'Đang gửi yêu cầu...';
    const res = await AlohaEditSync.create({
      orderCode: record.orderCode,
        parentRequestId,
        sourceAlbumId:sourceAlbum.id,
        round,
      serviceLabel: record.serviceLabel,
      note: document.getElementById('psNote').value.trim(),
      photos: Array.from(selected).map(id => ({ id, src: photoById[id].src, note: (photoNotes.get(id)||'').trim(), editOptions:photoOptions.get(id)||[], isExtra: extraPhotos.has(id) })),
      extraFee: extraFee,
      paymentStatus: paymentStatus,
      paymentCode:lastPaidCode
    });
    submitting = false;
    if (res.ok && res.data && res.data.request) {
      paidPending = null;
      banner.removeAttribute('role');
      syncRequests = syncRequests.filter((r) => r.id !== res.data.request.id).concat([res.data.request]);
      showSubmittedUi(extraCount, extraFee);
      renderEdited(true);
      return;
    }
    // Đã trả tiền thì giữ khoá danh sách (đúng bộ ảnh đã thanh toán); chưa trả thì mở khoá để sửa
    if (!paidPending) document.querySelectorAll('.ps-heart').forEach((btn) => { btn.disabled = false; });
    syncBulkButtons();
    submitBtn.textContent = paidPending ? 'Gửi lại yêu cầu (đã thanh toán)' : 'Gửi yêu cầu chỉnh sửa';
    updateSummary();
    showSubmitError(res.message + (paidPending
      ? ' Bạn đã thanh toán phí ảnh chọn thêm: bấm "Gửi lại yêu cầu", không cần thanh toán lại. Cần hỗ trợ gọi hotline 0938.125.222.'
      : ' Ảnh đã chọn và ghi chú vẫn được giữ nguyên, bạn bấm gửi lại khi kết nối ổn định.'));
  }

  // ===== Submit =====
  submitBtn.addEventListener('click', () => {
    if (selected.size === 0) return;
    if (SYNC) {
      if (!syncLoaded || submitting || requestSent) return;
      // Đã thanh toán nhưng lần gửi trước lỗi -> gửi lại đúng bộ ảnh đã trả tiền, không mở lại QR
      if (paidPending) { submitToServer(paidPending.count, paidPending.fee, paidPending.status); return; }
    }

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
  if (window.AlohaDrive) AlohaDrive.attach(chatForm, chatInput);
  let editedSig = '';
  let aiPending = null; // id tin của khách đang chờ Trợ lý AI trả lời
  let chatSending = false; // chế độ đồng bộ: đang chờ server lưu tin nhắn

  const escHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtTime = (t) => new Date(t).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });

  function renderRevisionTools(req) {
    document.getElementById('psRoundTools')?.remove();
    if (!req) return;
    const tools = document.createElement('div'); tools.id = 'psRoundTools';
    const label = document.createElement('p');
    label.textContent = `Lượt ${req.round || 1} · Phí chỉnh: ${(req.extraFee || 0).toLocaleString('vi-VN')}đ. Lượt đầu miễn phí 10 ảnh; thêm ảnh 50.000đ/ảnh. Từ lượt 2: 50.000đ/ảnh.`;
    tools.appendChild(label);
    const history = (SYNC ? syncRequests : AlohaData.getEditRequests().filter(r => r.phone === session.phone)).filter(r => r.orderCode === record.orderCode && r.id !== req.id).sort((a,b) => a.createdAt-b.createdAt);
    history.forEach(old => { const line = document.createElement('details'); const title = document.createElement('summary'); title.textContent = `Lượt ${old.round || 1} · ${old.photoCount} ảnh · ${old.status}`; line.appendChild(title); const body = document.createElement('div'); body.innerHTML = escHtml(old.note || '') + (old.resultLink ? '<a target="_blank" rel="noopener noreferrer" href="'+escHtml(old.resultLink)+'">Mở trên Google Drive</a>' : ''); line.appendChild(body);
      if(old.status==='Hoàn thành') {
        const happy=document.createElement('button');happy.type='button';happy.textContent=old.customerFeedback==='satisfied'?'Đã hài lòng':'Hài lòng lượt '+(old.round||1);
        happy.onclick=async()=>{if(SYNC){const res=await AlohaEditSync.feedback(old.id,'satisfied');if(!res.ok){label.textContent=res.message;return;}keepServerCopy(res.data.request);}else{AlohaWorkflow.progress(AlohaData.setCustomerFeedback(old.id,'satisfied'),'delivered');}happy.textContent='Đã hài lòng';};body.appendChild(happy);
      }
      tools.appendChild(line); });
    if(req.status==='Hoàn thành') {
      const happy=document.createElement('button');happy.type='button';happy.textContent=req.customerFeedback==='satisfied'?'Đã hài lòng':'Hài lòng';
      happy.onclick=async()=>{if(SYNC){const res=await AlohaEditSync.feedback(req.id,'satisfied');if(!res.ok){label.textContent=res.message;return;}keepServerCopy(res.data.request);}else{AlohaWorkflow.progress(AlohaData.setCustomerFeedback(req.id,'satisfied'),'delivered');}happy.textContent='Đã hài lòng';};tools.appendChild(happy);
    }
    resultBody.appendChild(tools);
  }

  function renderJourney(req) {
    const step = !req ? 1 : req.resultLink ? 3 : 2;
    document.querySelectorAll('#psJourney li').forEach((el, i) => {
      el.classList.toggle('current', i + 1 === step);
      if (i + 1 === step) el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current');
    });
  }
  function renderResultPhotos(req) {
    const completed = (SYNC ? syncRequests : AlohaData.getEditRequests().filter(r => r.phone === session.phone))
      .filter(r => r.orderCode === record.orderCode && r.resultLink);
    const gallery = document.createElement('div'); gallery.className = 'ps-result-gallery';
    const seen = new Set();
    completed.forEach(r => (r.resultPhotos || []).forEach(p => {
      if (seen.has(p.id)) return; seen.add(p.id);
      const card = addDrivePhoto(Object.assign({}, p, {fromEdited:true,previewOnly:r.status !== 'Hoàn thành'}), gallery);
      if (card) {
        card.classList.toggle('selected', selected.has(p.id));
        card.querySelector('.ps-heart').disabled = r.status !== 'Hoàn thành' || isSelectionLocked();
        card.querySelector('.ps-grid-editor').hidden = !selected.has(p.id);
        syncEditor(card.querySelector('.ps-grid-editor'), p.id, sentPhotoIds.has(p.id) || r.status !== 'Hoàn thành');
      }
    }));
    resultBody.appendChild(gallery);
    if (gallery.children.length) {
      const again = document.createElement('button'); again.type = 'button'; again.className = 'ps-revise'; again.textContent = 'Tôi muốn chỉnh tiếp';
      again.onclick = () => { gallery.classList.add('is-revising'); gallery.querySelector('.ps-heart')?.focus(); };
      resultBody.appendChild(again);
    } else if (req?.resultLink) {
      const hint = document.createElement('p'); hint.textContent = 'Chưa xem trước được, mở trên Drive'; resultBody.appendChild(hint);
    }
  }

  function latestRequest() {
    // Chế độ đồng bộ: chỉ dữ liệu server trả (server đã lọc đúng yêu cầu của khách theo token,
    // không có link ảnh gốc). Không đọc yêu cầu cũ trong localStorage.
    if (SYNC) return syncRequests.filter(r => r.sourceAlbumId === sourceAlbum?.id).slice().sort((a, b) => b.createdAt - a.createdAt)[0] || null;
    if (!window.AlohaData || !session) return null;
    return AlohaData.getEditRequests()
      .filter((r) => r.phone === session.phone && r.sourceAlbumId === sourceAlbum?.id)
      .sort((a, b) => b.createdAt - a.createdAt)[0] || null;
  }
  // Thay 1 yêu cầu trong bộ nhớ trang bằng bản server vừa trả
  function keepServerCopy(req) {
    if (req && req.id) syncRequests = syncRequests.filter((r) => r.id !== req.id).concat([req]);
  }
  // Tải lại yêu cầu của khách từ server (GET /me). Lỗi -> giữ bản đã tải, ghi lỗi để hiện ra.
  async function refreshFromServer() {
    const res = await AlohaEditSync.mine();
    if (res.ok && res.data && Array.isArray(res.data.requests)) {
      const firstLoad = !syncLoaded;
      syncRequests = res.data.requests;
      syncLoaded = true;
      syncError = '';
      if (firstLoad) onSyncFirstLoad();
      else {restoreSentRequest();updateSummary();}
    } else {
      syncError = res.message || 'Không tải được dữ liệu từ máy chủ.';
    }
    renderSyncStatus();
    return res;
  }
  // Lần đầu tải được dữ liệu server (lúc mở trang, hoặc ở vòng hỏi sau khi lần đầu lỗi):
  // mở khoá nút gửi nếu chưa gửi, hoặc khôi phục đúng trạng thái đã gửi
  function onSyncFirstLoad() {
    if (banner.getAttribute('role') === 'alert') { banner.classList.remove('show'); banner.removeAttribute('role'); }
    submitBtn.textContent = 'Gửi yêu cầu chỉnh sửa';
    restoreSentRequest();
    updateSummary();
  }
  // Dòng báo lỗi kết nối trong tab "Ảnh đã chỉnh" (chỉ chế độ đồng bộ)
  let syncStatusEl = null;
  function renderSyncStatus() {
    if (!SYNC || !editedPanel) return;
    if (!syncStatusEl) {
      syncStatusEl = document.createElement('p');
      syncStatusEl.className = 'ps-chat-empty ps-sync-status';
      syncStatusEl.setAttribute('role', 'status');
      editedPanel.insertBefore(syncStatusEl, editedPanel.firstChild);
    }
    const parts = [];
    if (chatError) parts.push('Tin nhắn CHƯA được gửi: ' + chatError);
    if (syncError) parts.push('Chưa cập nhật được từ máy chủ: ' + syncError);
    syncStatusEl.hidden = !parts.length;
    syncStatusEl.textContent = parts.join(' ');
  }
  let seenPending = false;
  // "Tin mới" = thợ vừa gửi link hoặc nhắn thêm mà khách chưa mở tab xem
  function newsSig(req) {
    const staffMsgs = (Array.isArray(req.messages) ? req.messages : []).filter((m) => m.from === 'staff').length;
    return (req.resultLink || '') + '|' + staffMsgs;
  }
  // Dấu "đã xem" nằm trong chính yêu cầu (customerSeenEditedSig), không tạo kho localStorage riêng
  function markEditedSeen(req) {
    const sig = newsSig(req);
    if (SYNC) {
      // Chỉ tắt chấm báo khi server đã lưu "đã xem"
      if ((req.customerSeenEditedSig || '') === sig || seenPending) return;
      seenPending = true;
      AlohaEditSync.markSeen(req.id, { editedSig: sig }).then((res) => {
        seenPending = false;
        if (res.ok && res.data) { keepServerCopy(res.data.request); updateEditedDot(latestRequest()); }
      });
      return;
    }
    if (req.customerSeenEditedSig !== sig) { AlohaData.markCustomerSeenEdited(req.id, sig); req.customerSeenEditedSig = sig; }
  }
  function updateEditedDot(req) {
    if (!editedTab) return;
    const hasNews = !!req && newsSig(req) !== '|0' && (req.customerSeenEditedSig || '') !== newsSig(req);
    let dot = editedTab.querySelector('.ps-tab-dot');
    if (hasNews && !dot) {
      dot = document.createElement('span');
      dot.className = 'ps-tab-dot';
      dot.setAttribute('aria-label', 'Có cập nhật mới');
      editedTab.appendChild(dot);
    } else if (!hasNews && dot) dot.remove();
  }

  function renderEdited(force) {
    const req = latestRequest();
    const open = !!editedPanel && !editedPanel.hidden;
    if (open && req) markEditedSeen(req);
    updateEditedDot(req);
    renderJourney(req);
    if (!open) return;
    const msgs = req && Array.isArray(req.messages) ? req.messages : [];
    const sig = req ? [req.id, req.status, req.resultLink || '', msgs.length, aiPending || ''].join('|') : 'none';
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
      resultTitle.textContent = 'Ảnh đã chỉnh';
      resultMeta.innerHTML = `Mã đơn <strong>${escHtml(req.orderCode || req.id)}</strong> · ${escHtml(req.photoCount || (req.photos || []).length)} ảnh · gửi lúc ${escHtml(fmtTime(req.createdAt))}`;
      // Tiến độ: số bước đã xong (1 = đã gửi, 2 = thợ chỉnh xong, 3 = đã có link)
      const stepper = '';
      if (safeLink) {
        resultBody.innerHTML = stepper + `
          <a class="ps-result-link" id="psResultLink" target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>
            <span>Mở trên Google Drive</span>
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

    renderResultPhotos(req);
    renderRevisionTools(req);
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
          <div>${window.AlohaDrive ? AlohaDrive.render(m.text) : escHtml(m.text)}</div>
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
      if (SYNC) {
        // Gửi qua server (người gửi = khách theo token). Lỗi -> giữ nguyên chữ đã gõ, báo lỗi, không
        // ghi localStorage. Trợ lý tự động KHÔNG chạy ở chế độ này: server chưa có cách lưu an toàn
        // tin 'ai' (API chặn client tự ghi 'ai') -> tin chờ thợ chỉnh ảnh trả lời, không bịa câu trả lời.
        if (chatSending) return;
        chatSending = true;
        chatSend.disabled = true;
        const res = await AlohaEditSync.addMessage(req.id, text);
        chatSending = false;
        if (!res.ok || !res.data) {
          chatError = res.message || 'Không gửi được tin nhắn.';
          renderSyncStatus();
          chatSend.disabled = false;
          return;
        }
        chatError = '';
        renderSyncStatus();
        keepServerCopy(res.data.request);
        chatInput.value = '';
        autoSizeChat();
        renderEdited(true);
        chatInput.focus();
        return;
      }
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
  if (SYNC) {
    // Chế độ đồng bộ: hỏi server 4 giây/lần (dữ liệu chỉ giữ trong bộ nhớ trang)
    let meLoading = false;
    setInterval(async () => {
      if (meLoading) return;
      meLoading = true;
      await refreshFromServer();
      meLoading = false;
      renderEdited(false);
    }, 4000);
  } else {
    window.addEventListener('storage', (e) => { if (e.key === 'aloha_demo_db') { restoreSentRequest(); updateSummary(); renderEdited(false); } });
    setInterval(() => { restoreSentRequest(); updateSummary(); renderEdited(false); }, 4000);
  }

  // Giỏ ảnh dính đáy; giữ ID của ô đếm cũ cho logic và tích hợp hiện có.
  const cart = document.getElementById('psCart');
  const toolbar = document.createElement('div');
  toolbar.className = 'ps-cart-toolbar';
  toolbar.appendChild(selectAllBtn);
  toolbar.appendChild(document.getElementById('psBulkUndo'));
  cart.querySelector('.ps-cart-actions').prepend(clearAllBtn);
  clearAllBtn.querySelector('span').textContent = 'Bỏ chọn';
  document.getElementById('psCartQr').addEventListener('click', () => {
    if (qr) openQrPaymentModal(qr.count, qr.fee);
  });
  function renderCart() {
    const waiting = !!qr && Date.now() < qr.deadline;
    const active = !document.getElementById('view-chon-anh').hidden && selected.size > 0;
    cart.hidden = !active;
    document.body.classList.toggle('ps-cart-open', active);
    const feeCount = Math.max(0, selected.size - PACKAGE_COUNT);
    document.getElementById('psCartCount').textContent = 'Đã chọn ' + selected.size + ' ảnh';
    document.getElementById('psCartDetail').textContent = waiting ? 'Đang chờ thanh toán…' : feeCount ? feeCount + ' × 50.000đ' : '10 ảnh miễn phí lượt đầu';
    document.getElementById('psCartTotal').textContent = feeCount ? (feeCount * EXTRA_PRICE).toLocaleString('vi-VN') + 'đ' : 'Miễn phí';
    const missing = [...selected].filter(id => !(photoOptions.get(id) || []).length && !(photoNotes.get(id) || '').trim()).length;
    const reminder = document.getElementById('psCartMissing');
    reminder.hidden = missing === 0;
    reminder.textContent = missing + ' ảnh chưa ghi cách sửa';
    document.getElementById('psCartQr').hidden = !waiting;
    submitBtn.hidden = waiting;
    clearAllBtn.hidden = waiting;
    submitBtn.textContent = submitting ? 'Đang gửi…' : paidPending ? 'Gửi lại cho thợ' : feeCount ? 'Thanh toán' : 'Gửi cho thợ';
    document.documentElement.style.setProperty('--ps-cart-height', active ? cart.getBoundingClientRect().height + 'px' : '0px');
  }
  window.addEventListener('hashchange', renderCart);
  window.addEventListener('ps:filterchange', renderCart);
  window.addEventListener('resize', renderCart);

  const drivePanel = document.createElement('section'); drivePanel.id = 'psDrivePanel';
  drivePanel.innerHTML = '<h2>Chọn ảnh để chỉnh sửa</h2><p>Thả tim ảnh muốn sửa, chọn cách sửa, rồi bấm Gửi cho thợ</p><label for="psSourceAlbum">Bộ ảnh / buổi chụp</label><select id="psSourceAlbum" aria-label="Bộ ảnh thợ đã gửi"></select><p role="status">Đang tải bộ ảnh...</p><div id="psSourceFolder"></div><button type="button" id="psReloadAlbums">Tải lại bộ ảnh</button>';
  grid.before(drivePanel);
  document.querySelector('#view-chon-anh .ps-head-row')?.after(document.getElementById('psJourney'));
  grid.before(toolbar);
  function addDrivePhoto(doc, target = grid) {
    const id = doc.id;
    if (target.querySelector(`[data-id="${id}"]`)) return;
    const src = doc.src;
    const photo = Object.assign({}, doc, {src, large:src.replace('sz=w1000','sz=w2000'), full:src.replace('sz=w1000','sz=w2000')});
    if (!photoById[id]) photos.push(photo);
    photoById[id] = photo;
    const card = document.createElement('div'); card.className = 'ps-photo'; card.dataset.id = id;
    const image = document.createElement('img'); image.src = src; image.alt = doc.name || 'Ảnh từ Drive'; image.loading = 'lazy'; image.referrerPolicy = 'no-referrer'; card.appendChild(image);
    const badge = document.createElement('span'); badge.className = 'ps-photo-badge'; badge.textContent = doc.name; card.appendChild(badge);
    const link = document.createElement('a'); link.className = 'ps-drive-file-link'; link.href = doc.driveUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Mở file gốc'; card.appendChild(link);
    const heart = document.createElement('button'); heart.type = 'button'; heart.className = 'ps-heart'; heart.setAttribute('aria-label', 'Chọn ảnh từ Drive'); heart.setAttribute('aria-pressed', 'false'); heart.innerHTML = heartIcon; card.appendChild(heart);
    image.onerror = () => { driveStatus.textContent = 'Không tải được ảnh. Thử tải lại hoặc mở thư mục Drive.'; };
    const editor = document.createElement('div'); editor.className = 'ps-grid-editor'; editor.hidden = true;
    editor.innerHTML = `<div class="ps-edit-chips" role="group" aria-label="Cách chỉnh sửa">${editChips()}</div><input type="text" class="ps-edit-note" aria-label="Ghi chú thêm cho ảnh" placeholder="Bạn muốn chỉnh gì khác?">`;
    bindEditor(editor, () => id); card.appendChild(editor);
    target.appendChild(card);
    return card;
  }
  const driveStatus = drivePanel.querySelector('[role=status]');
  let sourceAlbums = [], sourceSignature = '';
  function showSourceAlbum(album) {
    closeLightbox(); hideUndo();
    sourceAlbum = album || null; photos.length = 0; grid.replaceChildren();
    lastPaidCode='';
    const driveLink = document.getElementById('psDriveLink');
    if (driveLink) { driveLink.hidden = !album; if (album) driveLink.href = album.folderUrl; else driveLink.removeAttribute('href'); }
    Object.keys(photoById).forEach(id => delete photoById[id]);
    selected.clear(); extraPhotos.clear(); photoNotes.clear(); photoOptions.clear();
    sentPhotoIds.clear(); requestSent = false; parentRequestId = ''; round = 1; PACKAGE_COUNT = 10; extraModeActive = false; paidPending = null;
    packageEl.textContent = '10';
    // Giữ banner lỗi (mất kết nối / không tải được yêu cầu) để khách vẫn thấy vì sao nút gửi bị khoá
    if (banner.getAttribute('role') !== 'alert') banner.classList.remove('show');
    const note = document.getElementById('psNote'); note.value = ''; note.readOnly = false;
    submitBtn.textContent = 'Gửi ảnh đã chọn cho thợ chỉnh';
    if (!album) {
      record.orderCode = ''; driveStatus.textContent = 'Thợ chưa gửi ảnh gốc cho bạn. Bộ ảnh sẽ hiện ở đây sau khi thợ gửi.';
      document.getElementById('psSourceFolder').replaceChildren();
      document.getElementById('psOrderInfo').textContent = 'Chờ thợ gửi ảnh gốc của buổi chụp.';
    } else {
      record.orderCode = album.orderCode; record.serviceLabel = album.serviceLabel || '';
      document.getElementById('psOrderInfo').textContent = `Mã đơn ${album.orderCode} · ${album.serviceLabel || 'Buổi chụp'} · ${album.photos.length} ảnh gốc`;
      driveStatus.textContent = `${album.staffName || 'Thợ ảnh'} đã gửi ${album.photos.length} ảnh. Chọn ảnh bên dưới để yêu cầu chỉnh sửa.`;
      document.getElementById('psSourceFolder').replaceChildren();
      album.photos.forEach(p => addDrivePhoto(p));
      const prior=(SYNC?syncRequests:AlohaData.getEditRequests()).filter(r=>r.orderCode===album.orderCode).sort((a,b)=>b.createdAt-a.createdAt)[0];
      if(prior && prior.sourceAlbumId!==album.id){round=(prior.round||1)+1;PACKAGE_COUNT=0;extraModeActive=true;parentRequestId=prior.id;packageEl.textContent='0';showQuota();}
      restoreSentRequest();
    }
    editedSig = ''; updateSummary(); applyFilter('all'); renderEdited(true);
  }
  async function loadSourceAlbums(force = false) {
    const result = SYNC ? await AlohaEditSync.sourceAlbums(force) : {ok:true, data:{albums:AlohaData.getSourceAlbums(session.phone)}};
    if (!result.ok) { driveStatus.textContent = result.message; return; }
    const albums = (result.data.albums || []).slice().sort((a,b) => b.createdAt-a.createdAt);
    const signature = albums.map(a => a.id).join('|');
    if (!force && signature === sourceSignature && sourceAlbum) return;
    sourceSignature = signature; sourceAlbums = albums;
    const select = document.getElementById('psSourceAlbum'); select.replaceChildren();
    albums.forEach(a => { const option = document.createElement('option'); option.value = a.id; option.textContent = `${a.orderCode} · ${a.serviceLabel || 'Buổi chụp'} · ${a.photos.length} ảnh · ${fmtTime(a.createdAt)}`; select.appendChild(option); });
    select.disabled = !albums.length;
    select.hidden = albums.length <= 1;
    drivePanel.querySelector("label").hidden = albums.length <= 1;
    const album = albums.find(a => sourceAlbum && a.id === sourceAlbum.id) || albums[0];
    if (album) select.value = album.id;
    if (!sourceAlbum || !album || sourceAlbum.id !== album.id || force) showSourceAlbum(album);
  }
  document.getElementById('psSourceAlbum').onchange = e => {
    if (submitting || paidPending || (qr && Date.now() < qr.deadline)) { e.target.value = sourceAlbum.id; driveStatus.textContent = 'Hãy hoàn tất lượt đang gửi hoặc thanh toán trước khi đổi bộ ảnh.'; return; }
    showSourceAlbum(sourceAlbums.find(a => a.id === e.target.value));
  };
  document.getElementById('psReloadAlbums').onclick = () => loadSourceAlbums(true);
  window.addEventListener('storage', () => { if (!SYNC) loadSourceAlbums(); });
  if (SYNC) setInterval(() => loadSourceAlbums(), 10000);
  loadSourceAlbums();

  // Khôi phục khóa ảnh của mọi lượt đang mở; ảnh đã giao có thể chọn lại với phí lượt sau.
  function restoreSentRequest() {
    if (!sourceAlbum) return;
    const history=(SYNC?syncRequests:AlohaData.getEditRequests().filter(r=>r.phone===session.phone)).filter(r=>r.orderCode===sourceAlbum.orderCode);
    requestSent=false;
    round=history.length?Math.max(...history.map(r=>r.round||1))+1:1;
    PACKAGE_COUNT=round===1?10:0; extraModeActive=round>1;
    packageEl.textContent=String(PACKAGE_COUNT);showQuota();
    sentPhotoIds.clear();
    history.filter(r=>r.status!=='Hoàn thành').forEach(r=>(r.photos||[]).forEach(p=>sentPhotoIds.add(p.id)));
    document.querySelectorAll('.ps-photo').forEach(card=>{
      const locked=sentPhotoIds.has(card.dataset.id),btn=card.querySelector('.ps-heart');
      btn.disabled=submitting || !!paidPending || !!(qr && Date.now()<qr.deadline);
      btn.setAttribute('aria-disabled',String(locked || btn.disabled));btn.style.opacity=locked?'0.35':'';
      card.querySelector('.ps-sent-label')?.remove();
      if(locked) {selected.delete(card.dataset.id);extraPhotos.delete(card.dataset.id);setCardSelected(card.dataset.id,false,false);const label=document.createElement('span');label.className='ps-sent-label';label.textContent='Đã gửi thợ';card.appendChild(label);}
    });
    submitBtn.textContent='Gửi ảnh đã chọn cho thợ chỉnh';
  }

  if (SYNC) {
    // Chưa biết khách đã gửi yêu cầu chưa cho tới khi server trả lời -> khoá nút gửi (updateSummary),
    // tránh gửi trùng. Tải lỗi thì giữ khoá + báo lỗi, không đoán theo localStorage.
    submitBtn.textContent = 'Đang tải dữ liệu...';
    refreshFromServer().then((res) => {
      if (!res.ok && !syncLoaded) {
        submitBtn.textContent = 'Chưa kết nối được máy chủ';
        showSubmitError(res.message + ' Chưa kiểm tra được bạn đã gửi yêu cầu hay chưa nên tạm khoá nút gửi. Trang sẽ tự thử lại vài giây một lần.');
      }
      updateSummary();
      renderEdited(true);
    });
  } else {
    restoreSentRequest();
  }

  updateSummary();
  applyFilter('all');
});


