// ALOHA Baby — view "Đặt lịch" (#/dat-lich trong index.html, xem js/router.js): đặt lịch với khung giờ cập nhật real-time.
// Đây là MÔ PHỎNG phía client (setInterval sinh dữ liệu ngẫu nhiên đại diện
// "khách khác đang thao tác") — KHÔNG phải đồng bộ real-time thật giữa nhiều
// người dùng. Bản triển khai thật cần WebSocket/SSE nối tới server giữ lịch.
// Xem .claude/rules/workflow.md (mục Real-time) và .claude/rules/tech-defaults.md.
document.addEventListener('DOMContentLoaded', () => {
  const slotGrid = document.getElementById('bkSlotGrid');
  if (!slotGrid) return; // không phải trang đặt lịch

  const TIMES = ['08:00', '09:30', '11:00', '13:30', '15:00', '16:30'];
  const HOLD_SECONDS = 300; // 5:00 — minh họa, thời gian giữ chỗ thật là cấu hình chưa xác định

  // Cấu hình giá + đặt cọc. Tỉ lệ cọc 50% giá chụp: người dùng chốt 2026-09-25.
  // TẤT CẢ GIÁ LÀ MINH HOẠ, chờ studio gửi bảng giá thật rồi thay số ở đây.
  // - basePrice: giá khởi điểm "từ ..." của dịch vụ (khớp SERVICE_INFO trong js/script.js
  //   và server/server.js), cũng là giá tạm tính cọc khi khách chọn concept "Khác".
  // - conceptPrice: giá riêng từng concept, key = slug concept trong js/albums.js.
  //   Concept chưa có giá ở đây thì dùng basePrice.
  const BOOKING_CONFIG = {
    depositRate: 0.5,
    basePrice: { 'Bé lớn': 1500000, 'Sinh nhật': 1800000, 'Bầu': 2000000, 'Gia đình': 2500000, 'Newborn': 2200000 },
    conceptPrice: {
      'Newborn': { 'cuon-u': 2200000, 'tu-nhien': 2400000, 'cung-bo-me': 2800000, 'hoa-la': 2600000, 'thu-ngo-nghinh': 2400000, 'den-trang': 2200000, 'trang-sao': 2900000 },
      'Bầu': { 'ngoai-canh': 2500000, 'vintage': 2000000, 'toi-gian': 2000000, 'cung-chong': 2400000, 'cung-be': 2600000, 'vong-hoa': 2200000, 'bien': 3200000 },
      'Sinh nhật': { 'bong-bay': 1800000, 'le-hoi': 2000000, 'pastel': 1800000, 'trung-thu': 2000000, 'cong-chua': 2200000, 'tiec-gia-dinh': 2500000, 'picnic': 2400000 },
      'Bé lớn': { 'ngoai-canh': 1900000, 'han-quoc': 1700000, 'vintage': 1500000, 'ao-dai': 1700000, 'nghe-nghiep': 1800000, 'mua-thu': 1900000, 'the-thao': 1600000 },
      'Gia đình': { 'dong-phuc': 2500000, 'ngoai-canh': 2900000, 'vintage': 2600000, 'bien': 3500000, 'nhieu-the-he': 3200000, 'anh-chi-em': 2700000, 'da-ngoai': 3000000 },
    },
  };
  const CUSTOM = 'custom'; // concept "Khác": khách tự lên ý tưởng, Sale trao đổi + báo giá sau

  // Phương thức thanh toán cọc. DEMO: chưa nối cổng thanh toán thật, QR/số tài khoản là minh hoạ.
  // Phương thức có QR: hiện mã là bắt đầu chờ tiền về ngay. Thẻ: khách bấm nút sang cổng VNPay rồi mới chờ.
  const PAY_METHODS = {
    bank: { label: 'Chuyển khoản ngân hàng', qr: true },
    momo: { label: 'Ví MoMo', qr: true },
    zalopay: { label: 'ZaloPay', qr: true },
    card: { label: 'Thẻ ATM / Visa / Mastercard (VNPay)', qr: false, button: 'Thanh toán qua VNPay' },
  };

  // Tự nhận diện thanh toán: trang hỏi trạng thái đơn định kỳ (polling), thấy "đã nhận tiền"
  // là tự chuyển sang màn thành công, khách không phải bấm "Tôi đã chuyển khoản".
  // DEMO: PaymentStatus.check() GIẢ LẬP ngân hàng báo có sau demoDetectMs, KHÔNG kiểm tra
  // tiền thật. Bản thật: thay check() bằng fetch tới server nhận webhook ngân hàng/cổng
  // thanh toán (PayOS/SePay/VNPay IPN) — các bước ở .claude/docs/tich-hop-thanh-toan.md.
  const PAYMENT_CONFIG = { pollMs: 2000, demoDetectMs: 8000 };
  const PaymentStatus = {
    startedAt: 0,
    start() { this.startedAt = Date.now(); },
    // Trả { status: 'pending' | 'paid', amount } giống API thật sẽ trả.
    async check(code, expectedAmount) {
      if (Date.now() - this.startedAt < PAYMENT_CONFIG.demoDetectMs) return { status: 'pending' };
      return { status: 'paid', orderCode: code, amount: expectedAmount };
    },
  };
  let payPollTimer = null;

  let currentStep = 1;
  let orderCode = null;
  let payMethod = null;
  let selectedService = null;
  let selectedConcept = null; // { slug, name } hoặc { slug: CUSTOM, name: 'Khác (theo ý tưởng riêng)' }
  let currentDateIndex = 0;
  let mySlot = null; // { dateKey, time }
  let countdownTimer = null;
  let holdSeconds = 0;

  const slotsByDate = {};

  function getDateKey(i) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  }

  function ensureDate(key) {
    if (!slotsByDate[key]) {
      const obj = {};
      TIMES.forEach((t) => {
        const r = Math.random();
        obj[t] = r < 0.15 ? 'full' : r < 0.32 ? 'holding' : 'free';
      });
      slotsByDate[key] = obj;
    }
    return slotsByDate[key];
  }

  function renderDates() {
    const row = document.getElementById('bkDateRow');
    const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    row.innerHTML = '';
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bk-date' + (i === currentDateIndex ? ' active' : '');
      btn.innerHTML = `<span class="dow">${i === 0 ? 'Hôm nay' : dayNames[d.getDay()]}</span><span class="dnum">${d.getDate()}/${d.getMonth() + 1}</span>`;
      btn.addEventListener('click', () => {
        currentDateIndex = i;
        renderDates();
        renderSlots();
      });
      row.appendChild(btn);
    }
  }

  function renderSlots(justUpdatedTime) {
    const key = getDateKey(currentDateIndex);
    const data = ensureDate(key);
    slotGrid.innerHTML = '';
    TIMES.forEach((t) => {
      const status = data[t];
      const isMine = mySlot && mySlot.dateKey === key && mySlot.time === t;
      const btn = document.createElement('button');
      btn.type = 'button';
      let cls = 'bk-slot ' + (isMine ? 'mine' : status);
      if (t === justUpdatedTime) cls += ' just-updated';
      btn.className = cls;
      let subText = status === 'free' ? 'Còn trống' : status === 'holding' ? 'Đang được giữ' : 'Hết chỗ';
      if (isMine) subText = 'Đang giữ cho bạn';
      btn.innerHTML = `${t}<span class="sub">${subText}</span>`;
      btn.disabled = !isMine && status !== 'free';
      btn.addEventListener('click', () => selectSlot(key, t));
      slotGrid.appendChild(btn);
    });
  }

  function selectSlot(dateKey, time) {
    if (mySlot) {
      // Nhả khung giờ cũ trước khi giữ khung mới (chỉ giữ 1 khung tại một thời điểm)
      slotsByDate[mySlot.dateKey][mySlot.time] = 'free';
    }
    slotsByDate[dateKey][time] = 'holding';
    mySlot = { dateKey, time };
    renderSlots();
    startHoldCountdown();
    updateSummaryDateTime();
    document.getElementById('bkNextBtn').disabled = false;
  }

  function updateCountdownText() {
    const m = Math.floor(holdSeconds / 60);
    const s = holdSeconds % 60;
    document.getElementById('bkCountdown').textContent = m + ':' + String(s).padStart(2, '0');
  }

  function startHoldCountdown() {
    clearInterval(countdownTimer);
    holdSeconds = HOLD_SECONDS;
    document.getElementById('bkHoldTimer').hidden = false;
    updateCountdownText();
    countdownTimer = setInterval(() => {
      holdSeconds--;
      if (holdSeconds <= 0) {
        clearInterval(countdownTimer);
        expireHold();
        return;
      }
      updateCountdownText();
    }, 1000);
  }

  function expireHold() {
    if (!mySlot) return;
    slotsByDate[mySlot.dateKey][mySlot.time] = 'free';
    mySlot = null;
    renderSlots();
    document.getElementById('bkHoldTimer').hidden = true;
    document.getElementById('bkNextBtn').disabled = true;
    updateSummaryDateTime();
    // Hết giờ giữ chỗ khi đang ở bước 3/4 thì khung giờ đã bị nhả: dừng chờ tiền, quay về bước 2 chọn lại
    if (currentStep >= 3) goToStep(2);
    if (currentStep === 2) {
      const badge = document.getElementById('bkLastUpdate');
      badge.textContent = badge.textContent + ' · hết giờ giữ chỗ, vui lòng chọn lại';
    }
  }

  function formatVND(n) {
    return n.toLocaleString('vi-VN') + 'đ';
  }

  const isCustom = () => !!selectedConcept && selectedConcept.slug === CUSTOM;

  // Giá: concept có sẵn -> giá concept; "Khác" -> tạm tính theo giá khởi điểm dịch vụ
  // (estimate = true: Sale báo giá chính xác sau khi trao đổi ý tưởng).
  function getAmounts() {
    const base = BOOKING_CONFIG.basePrice[selectedService] || 0;
    const byConcept = BOOKING_CONFIG.conceptPrice[selectedService] || {};
    const price = selectedConcept && !isCustom() ? byConcept[selectedConcept.slug] || base : base;
    const deposit = Math.round(price * BOOKING_CONFIG.depositRate);
    return { price, deposit, remain: price - deposit, estimate: isCustom() };
  }

  function updateSummaryPrice() {
    const { price, deposit, estimate } = getAmounts();
    document.getElementById('sumRate').textContent = Math.round(BOOKING_CONFIG.depositRate * 100);
    document.getElementById('sumConcept').textContent = selectedConcept ? selectedConcept.name : '—';
    let priceText = '—';
    if (price) priceText = !selectedConcept ? 'từ ' + formatVND(price) : estimate ? 'Sale báo giá' : formatVND(price);
    document.getElementById('sumPrice').textContent = priceText;
    document.getElementById('sumDeposit').textContent = price && selectedConcept ? formatVND(deposit) + (estimate ? ' (tạm tính)' : '') : '—';
  }

  // ---- Bước 1: chọn concept sau khi chọn dịch vụ (dữ liệu concept dùng chung js/albums.js) ----
  function conceptsOfService(name) {
    const list = (window.AlohaAlbums && window.AlohaAlbums.list) || [];
    const svc = list.find((s) => s.name === name);
    return svc ? { slug: svc.slug, concepts: svc.concepts } : { slug: '', concepts: [] };
  }

  function updateStep1Next() {
    if (currentStep === 1) document.getElementById('bkNextBtn').disabled = !(selectedService && selectedConcept);
  }

  function selectConcept(concept) {
    selectedConcept = concept;
    document.querySelectorAll('.bk-concept').forEach((el) => {
      const on = el.dataset.concept === concept.slug;
      el.classList.toggle('selected', on);
      el.querySelector('.bk-concept-pick').setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    document.getElementById('bkCustomBox').hidden = !isCustom();
    if (isCustom()) document.getElementById('bkCustomIdea').focus();
    updateSummaryPrice();
    updateStep1Next();
  }

  function renderConcepts() {
    const wrap = document.getElementById('bkConceptWrap');
    const grid = document.getElementById('bkConceptGrid');
    const { slug: svcSlug, concepts } = conceptsOfService(selectedService);
    const prices = BOOKING_CONFIG.conceptPrice[selectedService] || {};
    const base = BOOKING_CONFIG.basePrice[selectedService] || 0;
    document.getElementById('bkConceptSvc').textContent = selectedService;
    grid.innerHTML = '';
    concepts.forEach((c) => {
      const card = document.createElement('div');
      card.className = 'bk-concept';
      card.dataset.concept = c.slug;
      card.innerHTML = `
        <button type="button" class="bk-concept-pick" aria-pressed="false">
          <img src="${c.cover}" alt="" loading="lazy">
          <span class="bk-concept-name">${c.name}</span>
          <span class="bk-concept-price">${formatVND(prices[c.slug] || base)}</span>
        </button>
        <button type="button" class="bk-concept-view">Xem ảnh mẫu</button>`;
      card.querySelector('.bk-concept-pick').addEventListener('click', () => selectConcept({ slug: c.slug, name: c.name }));
      card.querySelector('.bk-concept-view').addEventListener('click', () => {
        const found = window.AlohaAlbums.lookup(svcSlug + '/' + c.slug);
        if (found && found.photos.length) window.AlohaAlbums.openViewer(found.photos, 0);
      });
      grid.appendChild(card);
    });
    // Ô "Khác": concept khách tự sáng tạo, cần trao đổi với Sale
    const custom = document.createElement('div');
    custom.className = 'bk-concept bk-concept-custom';
    custom.dataset.concept = CUSTOM;
    custom.innerHTML = `
      <button type="button" class="bk-concept-pick" aria-pressed="false">
        <span class="bk-concept-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2V17h6v-.3c0-.8.4-1.5 1-2A7 7 0 0 0 12 2z"/></svg></span>
        <span class="bk-concept-name">Khác</span>
        <span class="bk-concept-desc">Concept theo ý tưởng riêng của bạn, trao đổi cùng Sale</span>
        <span class="bk-concept-price">Sale báo giá</span>
      </button>`;
    custom.querySelector('.bk-concept-pick').addEventListener('click', () => selectConcept({ slug: CUSTOM, name: 'Khác (ý tưởng riêng)' }));
    grid.appendChild(custom);
    wrap.hidden = false;
  }

  function validateCustomIdea() {
    const input = document.getElementById('bkCustomIdea');
    const err = document.getElementById('bkCustomIdeaErr');
    const msg = isCustom() && !input.value.trim() ? 'Vui lòng mô tả sơ qua ý tưởng để Sale chuẩn bị tư vấn.' : '';
    input.classList.toggle('invalid', !!msg);
    err.textContent = msg;
    err.hidden = !msg;
    if (msg) input.focus();
    return !msg;
  }

  // Mã đơn dùng xuyên suốt (nội dung chuyển khoản, folder ảnh gốc...) — xem tech-defaults.md.
  // Demo sinh phía client: AB + yymmdd + 2 số ngẫu nhiên.
  function makeOrderCode() {
    const d = new Date();
    const ymd = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    return 'AB' + ymd + String(Math.floor(Math.random() * 100)).padStart(2, '0');
  }

  // Mã QR MINH HOẠ (không quét được): lưới 25x25 có 3 ô định vị ở góc, phần còn lại
  // sinh giả ngẫu nhiên theo mã đơn + phương thức để mỗi lựa chọn trông khác nhau.
  function fakeQrSvg(seedText) {
    const N = 25;
    let seed = 0;
    for (const ch of seedText) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const rand = () => ((seed = (seed * 1103515245 + 12345) >>> 0) >>> 16) % 2 === 0;
    const inFinder = (x, y) => (x < 8 && y < 8) || (x >= N - 8 && y < 8) || (x < 8 && y >= N - 8);
    let rects = '';
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (!inFinder(x, y) && rand()) rects += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
      }
    }
    const finder = (x, y) =>
      `<rect x="${x}" y="${y}" width="7" height="7"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#fff"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3"/>`;
    return `<svg viewBox="-1 -1 ${N + 2} ${N + 2}" role="img" aria-label="Mã QR minh hoạ" shape-rendering="crispEdges"><rect x="-1" y="-1" width="${N + 2}" height="${N + 2}" fill="#fff"/><g fill="#1f2340">${finder(0, 0)}${finder(N - 7, 0)}${finder(0, N - 7)}${rects}</g></svg>`;
  }

  function renderPayDetail() {
    const detail = document.getElementById('bkPayDetail');
    const qrBox = document.getElementById('bkPayQr');
    const info = document.getElementById('bkPayInfo');
    const nextBtn = document.getElementById('bkNextBtn');
    document.querySelectorAll('.bk-pay').forEach((b) => {
      const on = b.dataset.method === payMethod;
      b.classList.toggle('selected', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    stopWaitingPayment();
    if (!payMethod) {
      detail.hidden = true;
      nextBtn.textContent = 'Chọn phương thức thanh toán';
      nextBtn.disabled = true;
      return;
    }
    const m = PAY_METHODS[payMethod];
    const { deposit } = getAmounts();
    const amount = `<div><span>Số tiền</span><strong>${formatVND(deposit)}</strong></div>`;
    const memo = `<div><span>Nội dung</span><strong>${orderCode}</strong></div>`;
    detail.hidden = false;
    qrBox.hidden = !m.qr;
    qrBox.innerHTML = m.qr ? fakeQrSvg(orderCode + payMethod) + '<small>Mã QR minh hoạ, chưa quét được</small>' : '';
    if (payMethod === 'bank') {
      info.innerHTML = `<p>Mở app ngân hàng, quét mã VietQR hoặc chuyển khoản theo thông tin:</p>
        <div class="bk-pay-lines">
          <div><span>Chủ tài khoản</span><strong>ALOHA BABY STUDIO</strong></div>
          <div><span>Số tài khoản</span><strong>(minh hoạ, studio cập nhật)</strong></div>
          ${amount}${memo}
        </div>
        <p class="bk-pay-tip">Ghi đúng nội dung <strong>${orderCode}</strong> để hệ thống tự nhận diện khoản cọc.</p>`;
    } else if (payMethod === 'card') {
      info.innerHTML = `<p>Bấm "Thanh toán qua VNPay" để chuyển sang cổng thanh toán, nhập thẻ ATM nội địa hoặc Visa/Mastercard.</p>
        <div class="bk-pay-lines">${amount}${memo}</div>
        <p class="bk-pay-tip">Bản demo chưa kết nối cổng VNPay thật.</p>`;
    } else {
      info.innerHTML = `<p>Mở ứng dụng ${m.label}, chọn Quét mã và quét mã bên cạnh.</p>
        <div class="bk-pay-lines">${amount}<div><span>Lời nhắn</span><strong>${orderCode}</strong></div></div>`;
    }
    if (m.qr) {
      startWaitingPayment();
    } else {
      nextBtn.textContent = m.button;
      nextBtn.disabled = false;
    }
  }

  // ---- Chờ tiền về: hỏi trạng thái định kỳ, nhận được thì tự sang màn thành công ----
  function setPayStatus(waiting) {
    const box = document.getElementById('bkPayStatus');
    box.hidden = !waiting;
    if (!waiting) return;
    const viaCard = payMethod === 'card';
    box.innerHTML = `
      <span class="bk-pay-spinner" aria-hidden="true"></span>
      <div>
        <strong>${viaCard ? 'Đang chờ kết quả từ cổng VNPay...' : 'Đang chờ thanh toán...'}</strong>
        <p>Hệ thống tự xác nhận ngay khi nhận được tiền cọc, bạn không cần bấm gì thêm. Vui lòng giữ trang này mở.</p>
        <p class="bk-pay-demo">Bản demo: mô phỏng ngân hàng báo đã nhận tiền sau khoảng ${Math.round(PAYMENT_CONFIG.demoDetectMs / 1000)} giây, chưa kiểm tra giao dịch thật.</p>
      </div>`;
  }

  function startWaitingPayment() {
    stopWaitingPayment();
    const nextBtn = document.getElementById('bkNextBtn');
    nextBtn.textContent = 'Đang chờ thanh toán...';
    nextBtn.disabled = true;
    setPayStatus(true);
    PaymentStatus.start();
    const expected = getAmounts().deposit;
    const code = orderCode;
    payPollTimer = setInterval(async () => {
      const res = await PaymentStatus.check(code, expected);
      // Chỉ nhận khi đúng mã đơn đang chờ + đủ số tiền cọc (bản thật cũng phải đối chiếu 2 điều này)
      if (payPollTimer && res.status === 'paid' && res.orderCode === orderCode && res.amount >= expected) confirmPaid(res.amount);
    }, PAYMENT_CONFIG.pollMs);
  }

  function stopWaitingPayment() {
    clearInterval(payPollTimer);
    payPollTimer = null;
    const box = document.getElementById('bkPayStatus');
    if (box) box.hidden = true;
  }

  function confirmPaid(amount) {
    stopWaitingPayment();
    clearInterval(countdownTimer);
    document.getElementById('bkHoldTimer').hidden = true;
    document.getElementById('bkSuccessText').textContent =
      `Hệ thống đã tự động nhận tiền cọc ${formatVND(amount)} cho mã đơn #${orderCode} qua ${PAY_METHODS[payMethod].label} (bản demo: mô phỏng). ` +
      'Lịch ở trạng thái Chờ xác nhận, Sales sẽ gọi xác nhận lại thông tin bé và concept với bạn.' +
      (isCustom() ? ' Với concept theo ý tưởng riêng, Sale sẽ trao đổi chi tiết ý tưởng và báo giá chính xác.' : '');
    document.getElementById('bkSummaryBox').style.display = 'none';
    document.getElementById('bkSuccess').classList.add('show');
    document.getElementById('bkSuccess').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function renderDeposit() {
    if (!orderCode) orderCode = makeOrderCode();
    const { price, deposit, remain, estimate } = getAmounts();
    document.getElementById('depOrderCode').textContent = '#' + orderCode;
    document.getElementById('depServiceName').textContent = selectedService + ' · ' + selectedConcept.name;
    document.getElementById('depPrice').textContent = estimate ? 'Sale báo giá sau khi trao đổi' : formatVND(price);
    document.getElementById('depRateLabel').textContent = estimate
      ? `Tiền cọc tạm tính (${Math.round(BOOKING_CONFIG.depositRate * 100)}% giá khởi điểm ${formatVND(price)})`
      : `Tiền cọc (${Math.round(BOOKING_CONFIG.depositRate * 100)}%)`;
    document.getElementById('depAmount').textContent = formatVND(deposit);
    document.getElementById('depRemain').textContent = estimate ? 'Sale báo sau' : formatVND(remain);
    document.getElementById('depNote').textContent = estimate
      ? 'Concept theo ý tưởng riêng: Sale sẽ liên hệ trao đổi ý tưởng, đạo cụ và báo giá chính xác. Tiền cọc tạm tính theo giá khởi điểm của dịch vụ, phần chênh lệch (nếu có) Sale báo rõ trước khi chốt.'
      : 'Giá theo bảng giá tham khảo (minh hoạ). Nếu gói thực tế khác, Sales báo lại số tiền chính xác trước khi đối soát.';
    renderPayDetail();
  }

  function updateSummaryDateTime() {
    const d = new Date();
    d.setDate(d.getDate() + currentDateIndex);
    document.getElementById('sumDate').textContent = d.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' });
    document.getElementById('sumTime').textContent = mySlot ? mySlot.time : '—';
  }

  // Mô phỏng "khách khác đang thao tác": mỗi ~4.5s đổi trạng thái 1 khung giờ
  // ngẫu nhiên (không đụng khung mình đang giữ) trên ngày đang xem.
  function simulateLiveUpdate() {
    const key = getDateKey(currentDateIndex);
    const data = ensureDate(key);
    const candidates = TIMES.filter((t) => !(mySlot && mySlot.dateKey === key && mySlot.time === t));
    if (candidates.length === 0) return;
    const t = candidates[Math.floor(Math.random() * candidates.length)];
    const cur = data[t];
    let next = cur;
    if (cur === 'free') next = Math.random() < 0.45 ? 'holding' : 'free';
    else if (cur === 'holding') next = Math.random() < 0.5 ? 'full' : 'free';
    else if (cur === 'full') next = Math.random() < 0.15 ? 'free' : 'full';
    data[t] = next;
    if (currentStep === 2) renderSlots(next !== cur ? t : undefined);
    const badge = document.getElementById('bkLastUpdate');
    if (badge) badge.textContent = new Date().toLocaleTimeString('vi-VN');
  }

  function goToStep(step) {
    currentStep = step;
    if (step !== 4) stopWaitingPayment(); // rời bước Đặt cọc thì thôi chờ tiền
    [1, 2, 3, 4].forEach((i) => {
      document.getElementById('step' + i).hidden = i !== step;
      const stepEl = document.querySelector('.bk-step[data-step="' + i + '"]');
      stepEl.classList.toggle('active', i === step);
      stepEl.classList.toggle('done', i < step);
    });
    document.getElementById('bkBackBtn').hidden = step === 1;
    const nextBtn = document.getElementById('bkNextBtn');
    if (step === 1) {
      nextBtn.textContent = 'Tiếp tục';
      nextBtn.disabled = !(selectedService && selectedConcept);
    } else if (step === 2) {
      nextBtn.textContent = 'Tiếp tục';
      nextBtn.disabled = !mySlot;
      document.getElementById('bkLastUpdate').textContent = new Date().toLocaleTimeString('vi-VN');
    } else if (step === 3) {
      nextBtn.textContent = 'Xác nhận đặt lịch';
      nextBtn.disabled = false;
    } else if (step === 4) {
      nextBtn.disabled = false;
      renderDeposit();
    }
  }

  document.querySelectorAll('.bk-service').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.bk-service').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      if (selectedService !== btn.dataset.service) {
        selectedService = btn.dataset.service;
        selectedConcept = null; // đổi dịch vụ thì chọn lại concept
        document.getElementById('bkCustomBox').hidden = true;
        renderConcepts();
      }
      document.getElementById('sumService').textContent = selectedService;
      updateSummaryPrice();
      updateStep1Next();
      document.getElementById('bkConceptWrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  document.getElementById('bkCustomIdea').addEventListener('input', (e) => {
    if (e.target.classList.contains('invalid')) validateCustomIdea();
  });

  // Bước 3: chỉ các ô bắt buộc mới kiểm tra; Lưu ý sức khỏe + Ghi chú để trống được.
  const REQUIRED_FIELDS = [
    { id: 'bkChildName', check: (v) => (v.trim() ? '' : 'Vui lòng nhập tên bé.') },
    { id: 'bkChildDob', check: (v) => (v ? '' : 'Vui lòng chọn ngày sinh hoặc ngày dự sinh.') },
    {
      id: 'bkPeople',
      check: (v) => (/^\d+$/.test(v.trim()) && Number(v) >= 1 ? '' : 'Số người trong ảnh tối thiểu là 1.'),
    },
    {
      id: 'bkPhone',
      check: (v) => {
        const digits = v.replace(/[\s.\-]/g, '');
        if (!digits) return 'Vui lòng nhập số điện thoại.';
        return /^(0|\+84)\d{9}$/.test(digits) ? '' : 'Số điện thoại chưa đúng (10 số, VD: 0987 654 321).';
      },
    },
  ];

  function showFieldError(field, msg) {
    const input = document.getElementById(field.id);
    const err = document.getElementById(field.id + 'Err');
    input.classList.toggle('invalid', !!msg);
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    err.textContent = msg;
    err.hidden = !msg;
  }

  function validateForm() {
    let firstInvalid = null;
    REQUIRED_FIELDS.forEach((field) => {
      const input = document.getElementById(field.id);
      const msg = field.check(input.value);
      showFieldError(field, msg);
      if (msg && !firstInvalid) firstInvalid = input;
    });
    if (firstInvalid) firstInvalid.focus();
    return !firstInvalid;
  }

  // Đã báo lỗi ở ô nào thì kiểm tra lại ngay khi khách sửa ô đó
  REQUIRED_FIELDS.forEach((field) => {
    const input = document.getElementById(field.id);
    ['input', 'change'].forEach((evt) =>
      input.addEventListener(evt, () => {
        if (input.classList.contains('invalid')) showFieldError(field, field.check(input.value));
      })
    );
  });

  // Nhấn Enter trong form = bấm "Xác nhận đặt lịch" (không để form tự submit làm tải lại trang)
  document.getElementById('bkForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (currentStep === 3) document.getElementById('bkNextBtn').click();
  });

  document.querySelectorAll('.bk-pay').forEach((btn) => {
    btn.addEventListener('click', () => {
      payMethod = btn.dataset.method;
      renderPayDetail();
    });
  });

  document.getElementById('bkNextBtn').addEventListener('click', () => {
    if (currentStep === 1) {
      if (!validateCustomIdea()) return; // concept "Khác" phải có mô tả ý tưởng
      goToStep(2);
    } else if (currentStep === 2) {
      goToStep(3);
    } else if (currentStep === 3) {
      // Xác nhận đặt lịch -> sang bước Đặt cọc (hiện số tiền cọc + phương thức thanh toán)
      if (!validateForm()) return;
      goToStep(4);
      document.getElementById('step4').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (payMethod === 'card') {
      // Bước 4: nút chính chỉ dùng cho thẻ (sang cổng VNPay). QR thì tự chờ tiền, không có nút bấm.
      // DEMO: không mở cổng thật, chỉ bắt đầu chờ kết quả như khi cổng trả về.
      startWaitingPayment();
    }
  });

  document.getElementById('bkBackBtn').addEventListener('click', () => {
    if (currentStep > 1) goToStep(currentStep - 1);
  });

  renderDates();
  renderSlots();
  goToStep(1);
  setInterval(simulateLiveUpdate, 4500);
});
