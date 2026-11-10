// ALOHA Baby — Module Tạo Đơn & Gửi Cọc QR trong CSKH (crm/js/order-qr-modal.js)
// Hỗ trợ Sale tạo đơn nhanh khi đang chat với khách, tự động sinh mã VietQR
// có sẵn số tiền + mã giao dịch, gửi thẻ đơn hàng vào ô chat, và tự động
// cập nhật thông báo cho Khách, Sale và Thợ ảnh sau khi cọc thành công.

(function (window, document) {
  'use strict';

  const BANK_CONFIG = {
    bankId: 'MB',
    bankName: 'Ngân hàng Quân Đội (MB Bank)',
    accountNo: '0938125222',
    accountName: 'ALOHA BABY STUDIO',
    hotline: '0938.125.222',
    address: '35 Lê Văn Thiêm, Thanh Xuân, Hà Nội'
  };

  const PACKAGES = {
    'Cơ bản': 1500000,
    'Tiêu chuẩn': 2500000,
    'Premium': 3500000
  };

  const SERVICES = ['Newborn', 'Bé lớn', 'Sinh nhật', 'Bầu', 'Gia đình'];

  // Bộ nhớ các đơn đã cọc thành công trong phiên
  window._alohaConfirmedOrders = window._alohaConfirmedOrders || new Set();

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function money(n) {
    return Number(n || 0).toLocaleString('vi-VN') + 'đ';
  }

  function generateCode() {
    const chars = '0123456789';
    let rand = '';
    for (let i = 0; i < 4; i++) rand += chars[Math.floor(Math.random() * chars.length)];
    return 'DP' + rand;
  }

  function getVietQRUrl(amount, ref) {
    const safeRef = String(ref || '').replace(/[^A-Za-z0-9]/g, '');
    const memo = 'ALOHA ' + safeRef;
    return `https://img.vietqr.io/image/${BANK_CONFIG.bankId}-${BANK_CONFIG.accountNo}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(memo)}&accountName=${encodeURIComponent(BANK_CONFIG.accountName)}`;
  }

  // Lấy danh sách thợ ảnh từ Workflow
  function getPhotographers() {
    const wf = window.AlohaWorkflow && window.AlohaWorkflow.get();
    if (wf && Array.isArray(wf.employees)) {
      const crew = wf.employees.filter(e => e.role === 'tho-anh');
      if (crew.length) return crew;
    }
    // Fallback: thợ ảnh demo mặc định khớp với tài khoản tho-anh của workflow
    return [
      { name: 'Thợ ảnh demo (Tuấn)', phone: '0900000003' }
    ];
  }

  // Kiểm tra đơn đã cọc hay chưa
  function isOrderConfirmed(code) {
    if (!code) return false;
    const clean = code.replace(/^#/, '');
    if (window._alohaConfirmedOrders && (window._alohaConfirmedOrders.has(clean) || window._alohaConfirmedOrders.has('#' + clean))) {
      return true;
    }
    if (window.AlohaWorkflow && window.AlohaWorkflow.get) {
      const wf = AlohaWorkflow.get();
      if (wf && wf.orders) {
        const o = wf.orders.find(x => x.code === clean || x.code === '#' + clean || (x.id && x.id.includes(clean)));
        if (o && (o.status === 'confirmed' || o.status === 'shooting' || o.status === 'shot' || o.status === 'delivered')) {
          return true;
        }
      }
    }
    return false;
  }

  // Trích xuất dữ liệu đơn hàng từ văn bản tin nhắn
  function parseOrderData(text) {
    if (!text || !text.includes('[ĐƠN ĐẶT LỊCH CHỤP ALOHA BABY]')) return null;
    const codeMatch = text.match(/Mã đơn:\s*#?([A-Za-z0-9]+)/i);
    const custMatch = text.match(/Khách hàng:\s*([^\n(]+)(?:\(([^)]+)\))?/i);
    const srvMatch = text.match(/Dịch vụ:\s*([^\n]+)/i);
    const conceptMatch = text.match(/Concept:\s*([^\n]+)/i);
    const timeMatch = text.match(/Thời gian:\s*([^\n]+)/i);
    const roomMatch = text.match(/Địa điểm:\s*([^\n]+)/i);
    const shooterMatch = text.match(/Thợ chụp phụ trách:\s*([^\n]+)/i);
    const depMatch = text.match(/Tiền cọc giữ lịch:\s*([0-9.,]+)/i);
    const memoMatch = text.match(/Cú pháp chuyển khoản:\s*([^\n]+)/i);

    const code = codeMatch ? codeMatch[1].trim() : 'DP1000';
    const customerName = custMatch ? custMatch[1].trim() : 'Khách hàng';
    let babyName = '', babyAge = '';
    if (custMatch && custMatch[2]) {
      const bparts = custMatch[2].split('·').map(s => s.trim());
      babyName = bparts[0].replace(/^Bé\s*/i, '');
      babyAge = bparts[1] || '';
    }
    const depStr = depMatch ? depMatch[1].replace(/\D/g, '') : '1000000';
    const depAmt = Number(depStr) || 1000000;
    const memo = memoMatch ? memoMatch[1].trim() : ('ALOHA ' + code);

    let service = 'Newborn', pkg = 'Tiêu chuẩn', price = 2500000;
    if (srvMatch) {
      const rawSrv = srvMatch[1];
      if (rawSrv.includes('Newborn')) service = 'Newborn';
      else if (rawSrv.includes('Bé lớn')) service = 'Bé lớn';
      else if (rawSrv.includes('Sinh nhật')) service = 'Sinh nhật';
      else if (rawSrv.includes('Bầu')) service = 'Bầu';
      else if (rawSrv.includes('Gia đình')) service = 'Gia đình';

      if (rawSrv.includes('Cơ bản')) { pkg = 'Cơ bản'; price = 1500000; }
      else if (rawSrv.includes('Premium')) { pkg = 'Premium'; price = 3500000; }
      else { pkg = 'Tiêu chuẩn'; price = 2500000; }
    }

    let date = '', time = '';
    if (timeMatch) {
      const rawTime = timeMatch[1];
      const tParts = rawTime.match(/(\d{1,2}:\d{2})\s+ngày\s+(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})/);
      if (tParts) {
        time = tParts[1];
        date = tParts[2];
      } else {
        time = rawTime;
      }
    }

    return {
      code,
      customerName,
      babyName: babyName || 'Bé',
      babyAge,
      service,
      pkg,
      price,
      concept: conceptMatch ? conceptMatch[1].trim() : '',
      date: date || '2026-11-10',
      time: time || '09:00',
      room: roomMatch ? roomMatch[1].trim() : 'Studio ALOHA',
      shooterName: shooterMatch ? shooterMatch[1].trim() : 'Thợ ảnh demo (Tuấn)',
      depositAmount: depAmt,
      memo,
      qrUrl: getVietQRUrl(depAmt, code)
    };
  }

  // Render HTML của Order Card hiển thị trong chat
  function renderOrderCardHtml(data, options) {
    if (!data) return '';
    const opts = options || {};
    const confirmed = isOrderConfirmed(data.code);
    const qrUrl = data.qrUrl || getVietQRUrl(data.depositAmount, data.code);
    const memo = data.memo || ('ALOHA ' + data.code);
    const cleanPkg = String(data.pkg || 'Tiêu chuẩn').replace(/^Gói\s+/i, '').replace(/\s*\([^)]*\)/g, '').trim();

    return `
      <div class="chat-order-card ${confirmed ? 'is-confirmed' : 'is-pending'}" data-order-code="${esc(data.code)}" data-amount="${data.depositAmount || ''}">
        <div class="coc-badge aor-badge">
          <span class="coc-badge-icon aor-badge-icon">${confirmed ? '✅' : '📸'}</span>
          <strong>ĐƠN ĐẶT LỊCH #${esc(data.code)}</strong>
          <span class="coc-status-pill aor-status-pill ${confirmed ? 'pill-success' : 'pill-wait'}">
            ${confirmed ? 'Đã cọc · Chờ ngày chụp' : 'Chờ cọc (Giữ chỗ 60p)'}
          </span>
        </div>
        
        <div class="coc-details aor-details">
          <div class="coc-row aor-row">
            <span class="coc-label aor-label">Bé yêu:</span>
            <strong class="coc-val aor-val">${esc(data.babyName || 'Bé')}${data.babyAge ? ' (' + esc(data.babyAge) + ')' : ''}</strong>
          </div>
          ${opts.isSale ? `
            <div class="coc-row aor-row">
              <span class="coc-label aor-label">Phụ huynh:</span>
              <span class="coc-val aor-val">${esc(data.customerName || 'Khách')}${data.phone ? ' · ' + esc(data.phone) : ''}</span>
            </div>
          ` : ''}
          <div class="coc-row aor-row">
            <span class="coc-label aor-label">Gói chụp:</span>
            <span class="coc-val aor-val"><strong>${esc(data.service || 'Chụp ảnh')}</strong> · Gói ${esc(cleanPkg || 'Tiêu chuẩn')} (${money(data.price)})</span>
          </div>
          <div class="coc-row aor-row">
            <span class="coc-label aor-label">Concept:</span>
            <span class="coc-val aor-val">${esc(data.concept || 'Studio tư vấn')}</span>
          </div>
          <div class="coc-row aor-row">
            <span class="coc-label aor-label">Lịch chụp:</span>
            <span class="coc-val aor-val"><strong>📅 ${esc(data.time || '09:00')} ngày ${esc(data.date || '')}</strong></span>
          </div>
          <div class="coc-row aor-row">
            <span class="coc-label aor-label">Phòng chụp:</span>
            <span class="coc-val aor-val">📍 ${esc(data.room || 'Studio ALOHA')}</span>
          </div>
          ${opts.isSale ? `
            <div class="coc-row aor-row">
              <span class="coc-label aor-label">Thợ phụ trách:</span>
              <span class="coc-val aor-val">📷 ${esc(data.shooterName || 'Thợ ảnh ALOHA')}</span>
            </div>
          ` : ''}
        </div>

        <div class="coc-qr-box coc-qr-section aor-qr-section">
          <div class="coc-qr-img-wrap aor-qr-img-wrap">
            <img src="${qrUrl}" alt="VietQR đặt cọc" class="coc-qr-img aor-qr-img" loading="lazy">
            <div class="coc-qr-scan-hint aor-qr-scan-hint">Quét mã bằng App Ngân hàng</div>
          </div>
          <div class="coc-bank-info aor-bank-info">
            <div class="coc-bank-row aor-bank-row">
              <span class="cbr-k">Ngân hàng:</span>
              <strong class="cbr-v">${BANK_CONFIG.bankName}</strong>
            </div>
            <div class="coc-bank-row aor-bank-row">
              <span class="cbr-k">Số tài khoản:</span>
              <div class="cbr-v-wrap">
                <strong class="cbr-v mono">${BANK_CONFIG.accountNo}</strong>
                <button type="button" class="btn-copy-sm" data-copy="${BANK_CONFIG.accountNo}" title="Sao chép STK">📋 Copy</button>
              </div>
            </div>
            <div class="coc-bank-row aor-bank-row">
              <span class="cbr-k">Chủ tài khoản:</span>
              <strong class="cbr-v">${BANK_CONFIG.accountName}</strong>
            </div>
            <div class="coc-bank-row aor-bank-row">
              <span class="cbr-k">Tiền cọc giữ lịch:</span>
              <strong class="cbr-v coc-deposit-amt aor-deposit-amt">${money(data.depositAmount)}</strong>
            </div>
            <div class="coc-bank-row aor-bank-row">
              <span class="cbr-k">Nội dung CK:</span>
              <div class="cbr-v-wrap">
                <strong class="cbr-v mono" style="color:var(--pink-600);">${esc(memo)}</strong>
                <button type="button" class="btn-copy-sm" data-copy="${esc(memo)}" title="Sao chép nội dung CK">📋 Copy</button>
              </div>
            </div>
          </div>
        </div>

        <div class="coc-actions aor-actions">
          ${!confirmed ? (
            opts.isSale ? `
              <button type="button" class="btn-sim-deposit" data-code="${esc(data.code)}" data-amt="${data.depositAmount}">
                ⚡ Xác nhận đã nhận cọc (Mô phỏng tiền về)
              </button>
            ` : `
              <div class="coc-wait-note aor-wait-note" style="font-size:12.5px; color:#475569; text-align:center; padding:8px 10px; background:#f8fafc; border-radius:10px; border:1px dashed #cbd5e1; width:100%;">
                ⏱️ <em>Lịch chụp sẽ tự động kích hoạt ngay khi ngân hàng ghi nhận chuyển khoản.</em>
              </div>
            `
          ) : (
            opts.isSale ? `
              <div class="coc-confirmed-banner aor-confirmed-banner">
                🎉 <strong>Cọc đã được xác nhận thành công!</strong> Thợ ảnh đã nhận lịch vào danh sách việc.
              </div>
            ` : `
              <div class="coc-confirmed-banner aor-confirmed-banner">
                🎉 <strong>Đã nhận cọc thành công!</strong> Studio đã khóa lịch giữ chỗ cho bé. Hẹn gặp gia đình mình nhé! ❤️
              </div>
            `
          )}
        </div>
      </div>
    `;
  }

  // Tạo khung Modal DOM
  let modalEl = null;

  function ensureModalDOM() {
    if (modalEl) return modalEl;
    modalEl = document.createElement('div');
    modalEl.id = 'alohaOrderQRModal';
    modalEl.className = 'aloha-order-modal-backdrop';
    modalEl.hidden = true;
    modalEl.innerHTML = `
      <div class="aloha-order-modal-card" role="dialog" aria-modal="true" aria-labelledby="alohaOrderModalTitle">
        <header class="aloha-order-modal-head">
          <div class="aloha-head-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v.01M14 21h3M21 18v3"/></svg>
          </div>
          <div>
            <h3 id="alohaOrderModalTitle">Tạo Đơn Chụp &amp; Gửi Cọc VietQR</h3>
            <p class="aloha-modal-sub">Điền thông tin buổi chụp để sinh mã QR có sẵn số tiền &amp; cú pháp giao dịch</p>
          </div>
          <button type="button" class="aloha-modal-close" id="alohaOrderModalClose" data-act="close-order-modal" aria-label="Đóng">&times;</button>
        </header>

        <form id="alohaOrderForm" class="aloha-order-form" novalidate>
          <div class="aloha-form-grid">
            <!-- Cột trái: Thông tin khách & Lịch hẹn -->
            <div class="aloha-form-col">
              <h4 class="aloha-col-title">👤 Thông tin Khách hàng &amp; Bé</h4>
              
              <div class="aloha-form-row">
                <label class="aloha-field">
                  <span>Mã Khách hàng</span>
                  <input type="text" id="aofCustId" readonly class="input-readonly">
                </label>
                <label class="aloha-field">
                  <span>Số điện thoại <b class="req">*</b></span>
                  <input type="tel" id="aofPhone" required placeholder="0912 345 678">
                </label>
              </div>

              <div class="aloha-form-row">
                <label class="aloha-field">
                  <span>Tên phụ huynh / Mẹ <b class="req">*</b></span>
                  <input type="text" id="aofCustName" required placeholder="Chị Lan / Mẹ Bắp">
                </label>
                <label class="aloha-field">
                  <span>Tên của bé <b class="req">*</b></span>
                  <input type="text" id="aofBabyName" required placeholder="Bé Bắp / Bé Na">
                </label>
              </div>

              <div class="aloha-form-row">
                <label class="aloha-field">
                  <span>Tuổi / Tháng tuổi của bé</span>
                  <input type="text" id="aofBabyAge" placeholder="Vd: 3 tháng / 1 tuổi">
                </label>
                <label class="aloha-field">
                  <span>Concept dự kiến</span>
                  <input type="text" id="aofConcept" placeholder="Vd: Happy dream 2 / Tết">
                </label>
              </div>

              <h4 class="aloha-col-title" style="margin-top:14px;">📅 Lịch Hẹn &amp; Phân Công Thợ</h4>

              <div class="aloha-form-row">
                <label class="aloha-field">
                  <span>Dịch vụ <b class="req">*</b></span>
                  <select id="aofService">
                    ${SERVICES.map(s => `<option value="${s}">${s}</option>`).join('')}
                  </select>
                </label>
                <label class="aloha-field">
                  <span>Gói chụp <b class="req">*</b></span>
                  <select id="aofPkg">
                    <option value="Cơ bản">Gói Cơ bản (1.500.000đ)</option>
                    <option value="Tiêu chuẩn" selected>Gói Tiêu chuẩn (2.500.000đ)</option>
                    <option value="Premium">Gói Premium (3.500.000đ)</option>
                  </select>
                </label>
              </div>

              <div class="aloha-form-row">
                <label class="aloha-field">
                  <span>Ngày chụp <b class="req">*</b></span>
                  <input type="date" id="aofDate" required>
                </label>
                <label class="aloha-field">
                  <span>Giờ chụp <b class="req">*</b></span>
                  <input type="time" id="aofTime" required value="09:00" step="1800">
                </label>
              </div>

              <div class="aloha-form-row">
                <label class="aloha-field">
                  <span>Phòng chụp / Địa điểm</span>
                  <select id="aofRoom">
                    <option value="P1">Phòng 1 (Sưởi ấm - chuyên Newborn)</option>
                    <option value="P2">Phòng 2 (Ánh sáng tự nhiên - Bé lớn)</option>
                    <option value="P3">Phòng 3 (Gia đình / Sinh nhật)</option>
                    <option value="Tại nhà">Chụp tận nơi tại nhà</option>
                  </select>
                </label>
                <label class="aloha-field">
                  <span>Thợ ảnh phụ trách <b class="req">*</b></span>
                  <select id="aofShooter" required></select>
                </label>
              </div>
            </div>

            <!-- Cột phải: Chi phí, Mã giao dịch & Live VietQR Preview -->
            <div class="aloha-form-col aloha-col-qr">
              <h4 class="aloha-col-title">💳 Chi phí &amp; Mã Thanh toán VietQR</h4>

              <div class="aloha-form-row">
                <label class="aloha-field">
                  <span>Tổng giá gói chụp</span>
                  <input type="number" id="aofPrice" value="2500000" step="50000">
                </label>
                <label class="aloha-field">
                  <span>Số tiền cọc giữ lịch (50%) <b class="req">*</b></span>
                  <input type="number" id="aofDeposit" value="1250000" step="50000">
                </label>
              </div>

              <div class="aloha-form-row">
                <label class="aloha-field" style="flex:1;">
                  <span>Mã đơn / Cú pháp CK <b class="req">*</b></span>
                  <div class="aloha-input-btn-wrap">
                    <input type="text" id="aofCode" readonly style="font-weight:700; color:var(--pink-600); text-transform:uppercase;">
                    <button type="button" class="btn-refresh-code" id="aofRegenCode" title="Đổi mã mới">🔄</button>
                  </div>
                </label>
              </div>

              <!-- Thẻ Xem trước mã QR -->
              <div class="aloha-qr-preview-card">
                <div class="aloha-qr-img-wrap">
                  <img id="aofQrPreviewImg" src="" alt="Mã VietQR đặt cọc">
                </div>
                <div class="aloha-qr-info">
                  <p class="aloha-qr-bank"><strong>${BANK_CONFIG.bankName}</strong></p>
                  <p class="aloha-qr-acc">STK: <strong>${BANK_CONFIG.accountNo}</strong></p>
                  <p class="aloha-qr-name">${BANK_CONFIG.accountName}</p>
                  <p class="aloha-qr-memo">Cú pháp: <strong id="aofMemoPreview">ALOHA DP1234</strong></p>
                  <p class="aloha-qr-amt">Số tiền: <strong id="aofAmtPreview">1.250.000đ</strong></p>
                </div>
              </div>

              <div class="aloha-hold-notice">
                ⏱️ <em>Khung giờ chụp sẽ được <strong>khóa giữ chỗ trong 60 phút</strong> kể từ khi gửi mã QR.</em>
              </div>

              <div class="aloha-modal-error" id="aofError" hidden></div>
            </div>
          </div>

          <footer class="aloha-order-modal-foot">
            <button type="button" class="btn btn-outline" id="aofBtnCancel" data-act="close-order-modal">Hủy bỏ</button>
            <button type="submit" class="btn btn-primary" id="aofBtnSubmit">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></svg>
              <span class="btn-text-full">Xác nhận tạo đơn &amp; Gửi cọc QR vào Chat</span>
              <span class="btn-text-short">Tạo đơn &amp; Gửi cọc QR</span>
            </button>
          </footer>
        </form>
      </div>
    `;

    document.body.appendChild(modalEl);

    // Event listeners nội bộ của modal
    const closeBtn = document.getElementById('alohaOrderModalClose');
    const cancelBtn = document.getElementById('aofBtnCancel');
    if (closeBtn) closeBtn.onclick = closeModal;
    if (cancelBtn) cancelBtn.onclick = closeModal;
    modalEl.onclick = (e) => { if (e.target === modalEl) closeModal(); };

    // Bắt sự kiện phím Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalEl && !modalEl.hidden && modalEl.style.display !== 'none') {
        closeModal();
      }
    });

    // Tự động tính cọc khi đổi gói
    document.getElementById('aofPkg').onchange = (e) => {
      const price = PACKAGES[e.target.value] || 2500000;
      document.getElementById('aofPrice').value = price;
      document.getElementById('aofDeposit').value = Math.ceil(price * 0.5);
      updateQRPreview();
    };

    document.getElementById('aofPrice').oninput = () => {
      const price = Number(document.getElementById('aofPrice').value) || 0;
      document.getElementById('aofDeposit').value = Math.ceil(price * 0.5);
      updateQRPreview();
    };

    document.getElementById('aofDeposit').oninput = updateQRPreview;

    document.getElementById('aofRegenCode').onclick = () => {
      document.getElementById('aofCode').value = generateCode();
      updateQRPreview();
    };

    document.getElementById('alohaOrderForm').onsubmit = handleFormSubmit;

    return modalEl;
  }

  function updateQRPreview() {
    const code = document.getElementById('aofCode').value || 'DP1000';
    const deposit = Number(document.getElementById('aofDeposit').value) || 1250000;
    const memo = 'ALOHA ' + code;
    document.getElementById('aofMemoPreview').textContent = memo;
    document.getElementById('aofAmtPreview').textContent = money(deposit);
    const url = getVietQRUrl(deposit, code);
    document.getElementById('aofQrPreviewImg').src = url;
  }

  let currentContext = null;

  function openModal(ctx) {
    currentContext = ctx || {};
    ensureModalDOM();

    // Điền ngày mặc định: ngày mai
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomStr = tomorrow.toISOString().slice(0, 10);

    const isGuest = String(ctx.phone || '').startsWith('khach-vang-lai-');
    const safePhone = isGuest ? '' : ((ctx.phone || '').replace(/\D/g, '') || '');
    document.getElementById('aofCustId').value = ctx.customerId || (safePhone ? 'KH-' + safePhone : 'KH-MOI');
    document.getElementById('aofPhone').value = safePhone;
    document.getElementById('aofCustName').value = (ctx.customerName === 'Khách vãng lai' || ctx.customerName === 'Khách hàng') ? '' : (ctx.customerName || '');
    document.getElementById('aofBabyName').value = ctx.babyName || '';
    document.getElementById('aofBabyAge').value = ctx.babyAge || '';
    document.getElementById('aofConcept').value = ctx.concept || '';
    document.getElementById('aofService').value = ctx.service || 'Newborn';
    document.getElementById('aofPkg').value = ctx.pkg || 'Tiêu chuẩn';
    document.getElementById('aofDate').value = ctx.date || tomStr;
    document.getElementById('aofDate').min = new Date().toISOString().slice(0, 10);
    document.getElementById('aofTime').value = ctx.time || '09:00';
    document.getElementById('aofRoom').value = ctx.room || 'P1';

    // Lưu lại phone của cuộc hội thoại chat đang mở để gửi tin nhắn chính xác
    currentContext.chatPhone = ctx.chatPhone || ctx.phone || '';
    currentContext.convId = ctx.convId || '';

    // Populate photographers
    const shooters = getPhotographers();
    const shooterSelect = document.getElementById('aofShooter');
    shooterSelect.innerHTML = shooters.map(s => `<option value="${s.phone}">${esc(s.name)}</option>`).join('');

    const initialPrice = PACKAGES[ctx.pkg || 'Tiêu chuẩn'] || 2500000;
    document.getElementById('aofPrice').value = initialPrice;
    document.getElementById('aofDeposit').value = Math.ceil(initialPrice * 0.5);

    document.getElementById('aofCode').value = generateCode();
    document.getElementById('aofError').hidden = true;

    updateQRPreview();
    modalEl.hidden = false;
    modalEl.style.display = 'flex';
    modalEl.classList.remove('is-hidden');
    document.body.classList.add('aloha-modal-open');
    const formGrid = modalEl.querySelector('.aloha-form-grid');
    if (formGrid) formGrid.scrollTop = 0;
    const cardEl = modalEl.querySelector('.aloha-order-modal-card');
    if (cardEl) cardEl.scrollTop = 0;
  }

  function closeModal() {
    if (modalEl) {
      modalEl.hidden = true;
      modalEl.style.display = 'none';
      modalEl.classList.add('is-hidden');
    }
    document.body.classList.remove('aloha-modal-open');
  }

  async function handleFormSubmit(e) {
    e.preventDefault();
    const errBox = document.getElementById('aofError');
    errBox.hidden = true;

    const phone = document.getElementById('aofPhone').value.trim().replace(/\D/g, '');
    const custName = document.getElementById('aofCustName').value.trim();
    const babyName = document.getElementById('aofBabyName').value.trim();
    const babyAge = document.getElementById('aofBabyAge').value.trim();
    const concept = document.getElementById('aofConcept').value.trim();
    const service = document.getElementById('aofService').value;
    const pkg = document.getElementById('aofPkg').value;
    const date = document.getElementById('aofDate').value;
    const time = document.getElementById('aofTime').value;
    const room = document.getElementById('aofRoom').value;
    const shooterPhone = document.getElementById('aofShooter').value;
    const price = Number(document.getElementById('aofPrice').value) || 0;
    const depositAmount = Number(document.getElementById('aofDeposit').value) || 0;
    const code = document.getElementById('aofCode').value.trim();

    if (!phone || phone.length < 9) {
      errBox.textContent = 'Vui lòng nhập số điện thoại hợp lệ.';
      errBox.hidden = false;
      return;
    }
    if (!custName) {
      errBox.textContent = 'Vui lòng nhập tên phụ huynh / khách hàng.';
      errBox.hidden = false;
      return;
    }
    if (!babyName) {
      errBox.textContent = 'Vui lòng nhập tên của bé để thợ chuẩn bị concept.';
      errBox.hidden = false;
      return;
    }
    if (!date || !time) {
      errBox.textContent = 'Vui lòng chọn ngày và giờ chụp.';
      errBox.hidden = false;
      return;
    }
    if (depositAmount <= 0) {
      errBox.textContent = 'Số tiền đặt cọc phải lớn hơn 0đ.';
      errBox.hidden = false;
      return;
    }

    const shooters = getPhotographers();
    const shooterObj = shooters.find(s => s.phone === shooterPhone) || shooters[0];

    const btnSubmit = document.getElementById('aofBtnSubmit');
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Đang tạo đơn & gửi...';

    const orderId = 'WF-ORD-' + code + '-' + Date.now();
    const cardText = 
      `📸 [ĐƠN ĐẶT LỊCH CHỤP ALOHA BABY]\n` +
      `• Mã đơn: #${code}\n` +
      `• Khách hàng: ${custName} (Bé ${babyName}${babyAge ? ' · ' + babyAge : ''})\n` +
      `• Dịch vụ: ${service} · Gói ${pkg} (${money(price)})\n` +
      `• Concept: ${concept || 'Studio tư vấn'}\n` +
      `• Thời gian: ${time} ngày ${date}\n` +
      `• Địa điểm: Studio ALOHA Baby (${room})\n` +
      `• Thợ chụp phụ trách: ${shooterObj.name}\n` +
      `• Tiền cọc giữ lịch: ${money(depositAmount)}\n` +
      `• Cú pháp chuyển khoản: ALOHA ${code}\n` +
      `(Khung giờ được khóa giữ chỗ trong 60 phút)`;

    const orderData = {
      orderId,
      code,
      phone,
      customerName: custName,
      babyName,
      babyAge,
      service,
      pkg,
      concept: concept || 'Studio tư vấn',
      date,
      time,
      duration: 120, // 2 tiếng
      room,
      shooterPhone,
      shooterName: shooterObj.name,
      price,
      depositAmount,
      bank: BANK_CONFIG,
      memo: 'ALOHA ' + code,
      qrUrl: getVietQRUrl(depositAmount, code),
      holdMinutes: 60,
      createdAt: Date.now(),
      cardText
    };

    try {
      // 1. Lưu vào Workflow nếu có AlohaWorkflow
      if (window.AlohaWorkflow && window.AlohaWorkflow.command) {
        try {
          const session = window.AlohaAuth && AlohaAuth.getSession();
          const salePhone = (session && session.phone) || '0900000002';
          await window.AlohaWorkflow.command('book', {
            id: orderId,
            code: code,
            phone: phone,
            customerName: custName,
            customerId: (currentContext && currentContext.customerId) || ('KH-' + phone),
            service: service,
            pkg: pkg,
            price: price,
            date: date,
            time: time,
            duration: 120,
            room: room,
            shooterPhone: shooterPhone,
            editorPhone: shooterPhone, // phân công cùng thợ
            salePhone: salePhone
          });
        } catch (wfErr) {
          console.warn('Workflow book server warning, saving to local state:', wfErr.message);
          try {
            const KEY = 'aloha_workflow_v1';
            const raw = localStorage.getItem(KEY);
            const state = raw ? JSON.parse(raw) : (window.AlohaWorkflowCore ? AlohaWorkflowCore.seed() : { orders: [], employees: [] });
            if (!state.orders) state.orders = [];
            if (!state.orders.some(o => o.id === orderId || o.code === code)) {
              state.orders.push({
                id: orderId,
                code: code,
                phone: phone,
                customerName: custName,
                customerId: (currentContext && currentContext.customerId) || ('KH-' + phone),
                service: service,
                pkg: pkg,
                price: price,
                date: date,
                time: time,
                duration: 120,
                room: room,
                shooterPhone: shooterPhone,
                editorPhone: shooterPhone,
                salePhone: salePhone,
                status: 'booked',
                collected: 0,
                payments: [],
                createdAt: Date.now(),
                updatedAt: Date.now()
              });
              localStorage.setItem(KEY, JSON.stringify(state));
              window.dispatchEvent(new CustomEvent('aloha:workflow', { detail: state }));
            }
          } catch (localErr) {
            console.warn('Local fallback error:', localErr);
          }
        }
      }

      // 2. Gửi tin nhắn chứa Order Card vào hội thoại chat
      await sendOrderCardToChat(orderData);

      closeModal();
      if (typeof currentContext.onCreated === 'function') {
        currentContext.onCreated(orderData);
      }
    } catch (err) {
      errBox.textContent = 'Lỗi tạo đơn: ' + err.message;
      errBox.hidden = false;
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Xác nhận tạo đơn & Gửi cọc QR vào Chat';
    }
  }

  // Gửi Order Card vào chat (hỗ trợ cả server API và local state)
  async function sendOrderCardToChat(data) {
    const destPhone = (currentContext && currentContext.chatPhone) || data.phone;
    if (window.AlohaAuth && AlohaAuth.api && destPhone) {
      try {
        await AlohaAuth.api('/api/sale-chat/inbox/' + encodeURIComponent(destPhone) + '/messages', {
          method: 'POST',
          body: {
            text: data.cardText,
            orderData: data
          }
        });
      } catch (e) {
        console.warn('Chưa gửi qua server, fallback local chat:', e);
      }
    }

    // Gửi sự kiện để giao diện CRM Sale hoặc Admin tự cập nhật
    window.dispatchEvent(new CustomEvent('aloha:order-created', {
      detail: Object.assign({}, data, { chatPhone: destPhone })
    }));
  }

  // Hàm xác nhận tiền cọc thành công (được gọi bởi Webhook SePay, nút Xác nhận cọc, hoặc nút Mô phỏng)
  async function confirmDeposit(code, amount, ref) {
    const cleanCode = String(code || '').replace(/^#/, '');
    const amt = Number(amount) || 1250000;
    const cleanRef = ref || ('SEPAY-' + cleanCode + '-' + Date.now().toString().slice(-4));

    // Đánh dấu đơn đã cọc trong bộ nhớ
    window._alohaConfirmedOrders.add(cleanCode);
    window._alohaConfirmedOrders.add('#' + cleanCode);

    // 1. Cập nhật Workflow
    if (window.AlohaWorkflow && window.AlohaWorkflow.command) {
      try {
        const wf = AlohaWorkflow.get();
        const order = wf && wf.orders && wf.orders.find(o => o.code === cleanCode || o.code === '#' + cleanCode || (o.id && o.id.includes(cleanCode)));
        if (order) {
          await AlohaWorkflow.command('payment', {
            id: order.id,
            amount: amt,
            reference: cleanRef
          });
        }
      } catch (e) {
        console.warn('Workflow payment server warning, saving to local state:', e.message);
        try {
          const KEY = 'aloha_workflow_v1';
          const raw = localStorage.getItem(KEY);
          if (raw) {
            const state = JSON.parse(raw);
            const o = (state.orders || []).find(x => x.code === cleanCode || x.code === '#' + cleanCode || (x.id && x.id.includes(cleanCode)));
            if (o) {
              o.payments = o.payments || [];
              o.payments.push({ amount: amt, reference: cleanRef, at: Date.now() });
              o.collected = (o.collected || 0) + amt;
              if (o.collected >= Math.ceil(o.price * 0.5)) {
                o.status = 'confirmed';
              }
              o.updatedAt = Date.now();
              localStorage.setItem(KEY, JSON.stringify(state));
              window.dispatchEvent(new CustomEvent('aloha:workflow', { detail: state }));
            }
          }
        } catch (localErr) {
          console.warn('Local payment fallback error:', localErr);
        }
      }
    }

    // 2. Gửi tin nhắn chúc mừng & xác nhận chính thức vào chat
    const successMsg = 
      `🎉 ALOHA XÁC NHẬN: Đã nhận thành công ${money(amt)} tiền đặt cọc cho đơn #${cleanCode}!\n` +
      `Lịch hẹn chụp ảnh của gia đình đã được xác nhận chính thức trên hệ thống studio.\n` +
      `Đội ngũ thợ ảnh và ekip ALOHA đã nhận lịch và sẵn sàng chuẩn bị buổi chụp thật chu đáo cho bé! Hẹn gặp mẹ và bé nhé! ❤️`;

    // Cập nhật DOM các thẻ Order Card đang hiển thị trên màn hình
    document.querySelectorAll(`.chat-order-card[data-order-code="${cleanCode}"]`).forEach(card => {
      card.classList.remove('is-pending');
      card.classList.add('is-confirmed');
      const pill = card.querySelector('.coc-status-pill');
      if (pill) {
        pill.className = 'coc-status-pill pill-success';
        pill.textContent = 'Đã cọc · Chờ ngày chụp';
      }
      const icon = card.querySelector('.coc-badge-icon');
      if (icon) icon.textContent = '✅';
      const actions = card.querySelector('.coc-actions');
      if (actions) {
        actions.innerHTML = `
          <div class="coc-confirmed-banner">
            🎉 <strong>Cọc đã được xác nhận thành công!</strong> Thợ ảnh đã nhận lịch vào danh sách việc.
          </div>
        `;
      }
    });

    window.dispatchEvent(new CustomEvent('aloha:deposit-confirmed', {
      detail: { code: cleanCode, amount: amt, reference: cleanRef, message: successMsg }
    }));

    return true;
  }

  // Delegated event listener cho nút Copy và nút Mô phỏng cọc
  document.addEventListener('click', (e) => {
    // 1. Nút sao chép
    const copyBtn = e.target.closest('[data-copy]');
    if (copyBtn) {
      const text = copyBtn.getAttribute('data-copy');
      if (text && navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
          const old = copyBtn.innerHTML;
          copyBtn.innerHTML = '✓ Đã chép';
          setTimeout(() => { copyBtn.innerHTML = old; }, 1500);
        }).catch(() => {});
      }
    }

    // 2. Nút mô phỏng cọc
    const simBtn = e.target.closest('.btn-sim-deposit');
    if (simBtn) {
      const code = simBtn.getAttribute('data-code');
      const amt = Number(simBtn.getAttribute('data-amt')) || 1250000;
      if (code) {
        simBtn.disabled = true;
        simBtn.textContent = 'Đang xử lý xác nhận...';
        confirmDeposit(code, amt);
      }
    }
  });

  // Tự động kiểm tra tiền cọc qua SePay cho các thẻ đơn hàng đang chờ cọc trên màn hình
  const isLocalHost = location.protocol === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const PAYMENT_API_BASE = (window.AlohaAuth && AlohaAuth.API_BASE) || 
    (isLocalHost ? 'http://localhost:3001' : 'https://phantichweb.onrender.com');

  let isPollingDeposits = false;
  async function pollPendingOrderDeposits() {
    if (isPollingDeposits) return;
    const pendingCards = document.querySelectorAll('.chat-order-card.is-pending');
    if (!pendingCards.length) return;

    isPollingDeposits = true;
    try {
      for (const card of pendingCards) {
        const code = card.getAttribute('data-order-code');
        const amt = Number(card.getAttribute('data-amount')) || 1250000;
        if (!code) continue;

        const clean = code.replace(/^#/, '');
        if (isOrderConfirmed(clean)) {
          confirmDeposit(clean, amt);
          continue;
        }

        try {
          const res = await fetch(`${PAYMENT_API_BASE}/api/payment-status?code=${encodeURIComponent(clean)}&amount=${amt}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.paid) {
              confirmDeposit(clean, amt);
            }
          }
        } catch (_) {}
      }
    } finally {
      isPollingDeposits = false;
    }
  }

  // Khởi động kiểm tra cọc tự động mỗi 4 giây
  if (typeof window !== 'undefined') {
    setInterval(pollPendingOrderDeposits, 4000);
    window.addEventListener('aloha:workflow', pollPendingOrderDeposits);
  }

  // Public API
  window.AlohaOrderQRModal = {
    open: openModal,
    close: closeModal,
    confirmDeposit: confirmDeposit,
    getVietQRUrl: getVietQRUrl,
    money: money,
    BANK: BANK_CONFIG,
    parseOrderData: parseOrderData,
    renderOrderCardHtml: renderOrderCardHtml,
    isOrderConfirmed: isOrderConfirmed
  };

})(window, document);
