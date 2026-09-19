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

  let currentStep = 1;
  let selectedService = null;
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
    if (currentStep === 2) {
      const badge = document.getElementById('bkLastUpdate');
      badge.textContent = badge.textContent + ' · hết giờ giữ chỗ, vui lòng chọn lại';
    }
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
    [1, 2, 3].forEach((i) => {
      document.getElementById('step' + i).hidden = i !== step;
      const stepEl = document.querySelector('.bk-step[data-step="' + i + '"]');
      stepEl.classList.toggle('active', i === step);
      stepEl.classList.toggle('done', i < step);
    });
    document.getElementById('bkBackBtn').hidden = step === 1;
    const nextBtn = document.getElementById('bkNextBtn');
    if (step === 1) {
      nextBtn.textContent = 'Tiếp tục';
      nextBtn.disabled = !selectedService;
    } else if (step === 2) {
      nextBtn.textContent = 'Tiếp tục';
      nextBtn.disabled = !mySlot;
      document.getElementById('bkLastUpdate').textContent = new Date().toLocaleTimeString('vi-VN');
    } else if (step === 3) {
      nextBtn.textContent = 'Xác nhận đặt lịch';
      nextBtn.disabled = false;
    }
  }

  document.querySelectorAll('.bk-service').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.bk-service').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedService = btn.dataset.service;
      document.getElementById('sumService').textContent = selectedService;
      document.getElementById('bkNextBtn').disabled = false;
    });
  });

  document.getElementById('bkNextBtn').addEventListener('click', () => {
    if (currentStep < 3) {
      goToStep(currentStep + 1);
    } else {
      clearInterval(countdownTimer);
      document.getElementById('bkSummaryBox').style.display = 'none';
      document.getElementById('bkSuccess').classList.add('show');
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
