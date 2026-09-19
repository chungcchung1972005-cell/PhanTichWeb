// ALOHA Baby — Khu vực quản trị dùng chung 1 file cho 3 vai trò nội bộ
// (Sale/CSKH, Thợ ảnh, Sếp). Dữ liệu DEMO tĩnh (minh hoạ bố cục), không phải
// số liệu thật, không kết nối API nào. Xem js/auth.js cho phần phân quyền.
document.addEventListener('DOMContentLoaded', () => {

  const session = AlohaAuth.getSession();
  const role = session ? session.role : null;
  document.getElementById('userName').textContent = (session && session.name) || 'Người dùng';
  document.getElementById('userRole').textContent = AlohaAuth.roleLabel(role);

  // ------------------------------- Ẩn/hiện tab + section theo đúng quyền -------------------------------
  function allowedForRole(el) {
    const roles = (el.dataset.roles || '').split(' ').filter(Boolean);
    return roles.length === 0 || roles.indexOf(role) !== -1;
  }

  const tabs = Array.from(document.querySelectorAll('#adminTabs a'));
  const sections = Array.from(document.querySelectorAll('.admin-section[data-roles], .admin-section[id]'));

  tabs.forEach(tab => { if (!allowedForRole(tab)) tab.remove(); });
  document.querySelectorAll('.admin-section').forEach(section => {
    if (section.dataset.roles && !allowedForRole(section)) section.remove();
  });

  const visibleTabs = document.querySelectorAll('#adminTabs a');
  if (visibleTabs.length === 0) {
    document.getElementById('emptyState').style.display = 'block';
  } else {
    visibleTabs.forEach((t, i) => t.classList.toggle('active', i === 0));
  }

  document.querySelectorAll('.admin-tabs a').forEach(link => {
    link.addEventListener('click', () => {
      document.querySelectorAll('.admin-tabs a').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    });
  });

  // ------------------------------- Biểu đồ khách mới theo tuần (chỉ Sếp) -------------------------------
  const WEEK_DATA = [
    { lbl: 'T1', val: 38 }, { lbl: 'T2', val: 52 }, { lbl: 'T3', val: 45 },
    { lbl: 'T4', val: 60 }, { lbl: 'T5', val: 71 }, { lbl: 'T6', val: 54 }
  ];
  const chartWrap = document.getElementById('newCustomerChart');
  if (chartWrap) {
    const maxVal = Math.max(...WEEK_DATA.map(d => d.val));
    WEEK_DATA.forEach(d => {
      const col = document.createElement('div');
      col.className = 'chart-bar-col';
      const heightPct = Math.round((d.val / maxVal) * 100);
      col.innerHTML = `<div class="chart-bar" style="height:${heightPct}%"></div><span class="lbl">${d.lbl}</span>`;
      chartWrap.appendChild(col);
    });
  }

  // ------------------------------- Phễu khách hàng (chỉ Sếp) -------------------------------
  const FUNNEL_DATA = [
    { name: 'Khách quan tâm', val: 320 },
    { name: 'Đã tư vấn', val: 210 },
    { name: 'Đã đặt lịch', val: 150 },
    { name: 'Đã chụp', val: 96 },
    { name: 'Hoàn thành', val: 88 }
  ];
  const funnelWrap = document.getElementById('funnelChart');
  if (funnelWrap) {
    const funnelMax = FUNNEL_DATA[0].val;
    FUNNEL_DATA.forEach(d => {
      const pct = Math.round((d.val / funnelMax) * 100);
      const row = document.createElement('div');
      row.className = 'funnel-row';
      row.innerHTML = `
        <span class="name">${d.name}</span>
        <div class="funnel-bar-track"><div class="funnel-bar" style="width:${pct}%"></div></div>
        <span class="val">${d.val} (${pct}%)</span>`;
      funnelWrap.appendChild(row);
    });
  }

  // ------------------------------- Khách hàng / CRM (1 nguồn dữ liệu, 2 kiểu hiển thị) -------------------------------
  // Sếp: xem đầy đủ hồ sơ. Sale: chỉ xem phần cần để chăm sóc khách, không có
  // trạng thái nội bộ dạng badge riêng của vận hành, gộp lịch sử ngắn gọn.
  const CUSTOMERS = [
    { name: 'Khách demo 01', phone: '0987 xxx 321', source: 'Facebook', status: 'dat-lich', label: 'Đã đặt lịch', badge: 'badge-dat-lich', created: '12/09/2026', note: 'Quan tâm gói Newborn.' },
    { name: 'Khách demo 02', phone: '0912 xxx 456', source: 'Giới thiệu', status: 'da-chup', label: 'Đã chụp', badge: 'badge-da-chup', created: '05/09/2026', note: 'Hỏi thêm về album in.' },
    { name: 'Khách demo 03', phone: '0977 xxx 789', source: 'TikTok', status: 'quan-tam', label: 'Khách quan tâm', badge: 'badge-quan-tam', created: '18/09/2026', note: 'Mới để lại số điện thoại.' },
    { name: 'Khách demo 04', phone: '0901 xxx 234', source: 'Website', status: 'hoan-thanh', label: 'Hoàn thành', badge: 'badge-hoan-thanh', created: '20/08/2026', note: 'Đã nhận ảnh, hẹn chụp 6 tháng tuổi.' },
    { name: 'Khách demo 05', phone: '0933 xxx 567', source: 'Instagram', status: 'tu-van', label: 'Đã tư vấn', badge: 'badge-tu-van', created: '15/09/2026', note: 'Đang cân nhắc gói Gia đình.' },
    { name: 'Khách demo 06', phone: '0966 xxx 890', source: 'Hotline', status: 'dat-lich', label: 'Đã đặt lịch', badge: 'badge-dat-lich', created: '10/09/2026', note: 'Chụp Bé lớn, concept Hàn Quốc.' },
    { name: 'Khách demo 07', phone: '0944 xxx 112', source: 'Đối tác spa bầu', status: 'quan-tam', label: 'Khách quan tâm', badge: 'badge-quan-tam', created: '19/09/2026', note: 'Chưa liên hệ lại.' }
  ];

  const custTable = document.getElementById('custTable');
  if (custTable) {
    const head = document.getElementById('custTableHead');
    const body = document.getElementById('custTableBody');
    const isSep = role === 'sep';

    if (isSep) {
      head.innerHTML = '<tr><th>Tên</th><th>SĐT</th><th>Nguồn khách</th><th>Trạng thái</th><th>Ngày tạo</th><th>Ghi chú</th></tr>';
    } else {
      document.getElementById('custSectionSub').textContent = 'Thông tin khách hàng để chăm sóc và tư vấn. Không hiển thị dữ liệu thanh toán/doanh thu.';
      head.innerHTML = '<tr><th>Liên hệ</th><th>Nguồn khách</th><th>Lịch sử lịch hẹn</th><th>Ghi chú tư vấn</th></tr>';
    }

    function renderCustomers(list) {
      if (isSep) {
        body.innerHTML = list.map(c => `
          <tr>
            <td>${c.name}</td><td>${c.phone}</td><td>${c.source}</td>
            <td><span class="badge ${c.badge}">${c.label}</span></td>
            <td>${c.created}</td><td>${c.note}</td>
          </tr>`).join('');
      } else {
        body.innerHTML = list.map(c => `
          <tr>
            <td>${c.name} · ${c.phone}</td>
            <td>${c.source}</td>
            <td>${c.label} (${c.created})</td>
            <td>${c.note}</td>
          </tr>`).join('');
      }
    }
    renderCustomers(CUSTOMERS);

    function applyCustomerFilters() {
      const q = document.getElementById('custSearch').value.trim().toLowerCase();
      const status = document.getElementById('custFilter').value;
      const filtered = CUSTOMERS.filter(c => {
        const matchQ = !q || c.name.toLowerCase().includes(q) || c.phone.includes(q);
        const matchStatus = !status || c.status === status;
        return matchQ && matchStatus;
      });
      renderCustomers(filtered);
    }
    document.getElementById('custSearch').addEventListener('input', applyCustomerFilters);
    document.getElementById('custFilter').addEventListener('change', applyCustomerFilters);
  }

  // ------------------------------- Lịch hẹn (Sếp + Sale) -------------------------------
  const APPOINTMENTS = {
    'sap-toi': [
      { time: '09:30 · 22/09', cust: 'Khách demo 06', service: 'Bé lớn', concept: 'Hàn Quốc', status: 'Sắp đến' },
      { time: '15:00 · 23/09', cust: 'Khách demo 01', service: 'Newborn', concept: 'Tự nhiên', status: 'Chờ xác nhận' }
    ],
    'hom-nay': [
      { time: '11:00', cust: 'Khách demo 05', service: 'Gia đình', concept: 'Ngoại cảnh', status: 'Đã đến/Đang chụp' }
    ],
    'da-qua': [
      { time: '09:00 · 20/08', cust: 'Khách demo 04', service: 'Newborn', concept: 'Tự nhiên', status: 'Hoàn thành' },
      { time: '14:00 · 05/09', cust: 'Khách demo 02', service: 'Sinh nhật', concept: 'Rực rỡ', status: 'Đã chụp' }
    ]
  };
  const apptBody = document.getElementById('apptTableBody');
  if (apptBody) {
    function renderAppointments(tab) {
      apptBody.innerHTML = APPOINTMENTS[tab].map(a => `
        <tr>
          <td>${a.time}</td><td>${a.cust}</td><td>${a.service}</td><td>${a.concept}</td>
          <td><span class="badge badge-dat-lich">${a.status}</span></td>
        </tr>`).join('');
    }
    renderAppointments('sap-toi');
    document.querySelectorAll('#apptTabs .ps-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('#apptTabs .ps-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        renderAppointments(tab.dataset.tab);
      });
    });
  }

  // ------------------------------- Yêu cầu chỉnh sửa THẬT từ khách (view "Ảnh của tôi" trong index.html) -------------------------------
  // Đọc từ kho dữ liệu demo dùng chung (localStorage cùng trình duyệt) — xem
  // js/data-store.js. Chèn thêm vào đúng cột kanban theo trạng thái, cạnh các
  // thẻ tĩnh minh hoạ có sẵn, để Thợ ảnh/Sếp thấy được yêu cầu khách vừa gửi.
  const STATUS_COL_ID = {
    'Chờ xử lý': 'kanbanCol-cho-xu-ly',
    'Đang thực hiện': 'kanbanCol-dang-thuc-hien',
    'Chờ QC': 'kanbanCol-cho-qc',
    'Hoàn thành': 'kanbanCol-hoan-thanh'
  };

  function renderEditRequests() {
    if (!window.AlohaData) return;
    document.querySelectorAll('.kanban-card.dynamic-request').forEach(el => el.remove());
    AlohaData.getEditRequests().forEach(req => {
      const col = document.getElementById(STATUS_COL_ID[req.status]);
      if (!col) return;
      const card = document.createElement('div');
      card.className = 'kanban-card dynamic-request';
      card.innerHTML = `
        <strong>${req.orderCode || req.id} <span class="badge badge-hoan-thanh" style="margin-left:4px;">Mới</span></strong>
        <span>${req.customerName} · ${req.serviceLabel || 'Chụp ảnh'} · ${req.photoCount} ảnh</span>
        ${req.note ? `<span style="display:block; margin-top:4px; font-style:italic;">"${req.note}"</span>` : ''}
        ${req.photoNotes && req.photoNotes.length ? `<span style="display:block; margin-top:4px; color:var(--pink-700); font-weight:700;">+${req.photoNotes.length} ảnh có ghi chú riêng</span>` : ''}
        ${req.status !== 'Hoàn thành' ? '<button type="button" class="kanban-advance-btn" data-id="' + req.id + '">Chuyển sang bước tiếp theo →</button>' : ''}
      `;
      col.appendChild(card);
    });
    document.querySelectorAll('.kanban-advance-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        AlohaData.advanceRequestStatus(btn.dataset.id);
        renderEditRequests();
      });
    });
  }
  renderEditRequests();

  // ------------------------------- Fade-in tối giản khi cuộn -------------------------------
  // Tôn trọng prefers-reduced-motion giống .reveal ở phần khách hàng (style.css)
  // -> không set opacity:0 ngay từ đầu, tránh nội dung "biến mất" cho người dùng
  // đã bật giảm hiệu ứng nếu IntersectionObserver không kịp chạy.
  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealSections = document.querySelectorAll('.admin-section');
  if (!prefersReducedMotion) {
    revealSections.forEach(s => { s.style.opacity = '0'; s.style.transform = 'translateY(10px)'; s.style.transition = 'opacity 0.5s ease, transform 0.5s ease'; });
  }
  if (!prefersReducedMotion && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0, rootMargin: '0px 0px -5% 0px' });
    revealSections.forEach(s => observer.observe(s));
  } else {
    revealSections.forEach(s => { s.style.opacity = '1'; s.style.transform = 'none'; });
  }
});
