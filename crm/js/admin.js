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

  // ------------------------------- Quản lý chụp & chỉnh ảnh: kanban đầy đủ chức năng -------------------------------
  // Gộp 2 nguồn thành 1 danh sách duy nhất để render và xử lý giống hệt nhau:
  //  - Yêu cầu THẬT từ khách (view "Ảnh của tôi") -> AlohaData (localStorage,
  //    xem js/data-store.js), tiến độ (doneIds) persist thật qua AlohaData.togglePhotoDone.
  //  - Dữ liệu nền minh hoạ (STATIC_REQUESTS ngay dưới đây) -> chỉ tồn tại
  //    trong bộ nhớ JS của trang này (giống cách CUSTOMERS/APPOINTMENTS ở trên
  //    đã làm), tiến độ lưu tạm trong staticDoneMap, mất khi tải lại trang.
  // Người dùng yêu cầu: bấm được vào thẻ, biết yêu cầu nào tới trước (ưu tiên
  // xử lý), thấy đúng những ảnh nào cần làm, và có cách Thợ ảnh tự confirm
  // tiến độ để Sếp quan sát được — toàn bộ xử lý trong khối này.
  const STATUS_COL_ID = {
    'Chờ xử lý': 'kanbanCol-cho-xu-ly',
    'Đang thực hiện': 'kanbanCol-dang-thuc-hien',
    'Chờ QC': 'kanbanCol-cho-qc',
    'Hoàn thành': 'kanbanCol-hoan-thanh'
  };

  const now = Date.now();
  const HOUR = 3600 * 1000;
  const staticDoneMap = {}; // requestId -> Set(photoId) đã đánh dấu xong, chỉ tồn tại trong phiên xem trang này

  // Ảnh nền minh hoạ dùng lại đúng 16 ảnh demo có sẵn trong images/my-photos/,
  // KHÔNG phải ảnh thật của khách demo 02/03/04/05/06 (những khách này chỉ có
  // trong bảng CUSTOMERS ở trên, chưa có ảnh thật gắn kèm).
  const STATIC_REQUESTS = [
    { id: 'static-1', orderCode: '#AB240930', customerName: 'Khách demo 05', serviceLabel: 'Gia đình', status: 'Chờ xử lý', note: 'Muốn ảnh tông sáng, ít chỉnh da.', createdAt: now - 26 * HOUR, photoIds: [1, 2, 3, 4], doneIds: [] },
    { id: 'static-2', orderCode: '#AB240902', customerName: 'Khách demo 02', serviceLabel: 'Sinh nhật', status: 'Đang thực hiện', note: 'Xoá phông lộn xộn phía sau bé.', createdAt: now - 3 * 24 * HOUR, photoIds: [5, 6, 7, 8, 9], doneIds: [5, 6] },
    { id: 'static-3', orderCode: '#AB240888', customerName: 'Khách demo 03', serviceLabel: 'Bầu', status: 'Chờ QC', note: '', createdAt: now - 5 * 24 * HOUR, photoIds: [10, 11, 12], doneIds: [10, 11, 12] },
    { id: 'static-4', orderCode: '#AB240871', customerName: 'Khách demo 04', serviceLabel: 'Bé lớn', status: 'Hoàn thành', note: '', createdAt: now - 9 * 24 * HOUR, photoIds: [13, 14], doneIds: [13, 14] },
    { id: 'static-5', orderCode: '#AB240860', customerName: 'Khách demo 06', serviceLabel: 'Newborn', status: 'Hoàn thành', note: '', createdAt: now - 10 * 24 * HOUR, photoIds: [15, 16], doneIds: [15, 16] }
  ].map(r => {
    staticDoneMap[r.id] = new Set(r.doneIds.map(n => 'ph-' + n));
    return {
      id: r.id, orderCode: r.orderCode, customerName: r.customerName, serviceLabel: r.serviceLabel,
      status: r.status, note: r.note, createdAt: r.createdAt, isStatic: true,
      photos: r.photoIds.map(n => ({ id: 'ph-' + n, src: '../images/my-photos/photo-' + n + '.jpg', note: '' })),
      photoCount: r.photoIds.length
    };
  });

  function formatRelativeTime(ts) {
    const diffMs = Date.now() - ts;
    const min = Math.floor(diffMs / 60000);
    if (min < 1) return 'Vừa xong';
    if (min < 60) return min + ' phút trước';
    const hr = Math.floor(min / 60);
    if (hr < 24) return hr + ' giờ trước';
    const day = Math.floor(hr / 24);
    return day + ' ngày trước';
  }

  function getDoneIds(req) {
    if (req.isStatic) return Array.from(staticDoneMap[req.id] || []);
    return Array.isArray(req.doneIds) ? req.doneIds : [];
  }

  function togglePhotoDone(req, photoId) {
    if (req.isStatic) {
      const set = staticDoneMap[req.id] || (staticDoneMap[req.id] = new Set());
      if (set.has(photoId)) set.delete(photoId); else set.add(photoId);
    } else if (window.AlohaData) {
      // Đồng bộ lại req.doneIds trong bộ nhớ ngay sau khi ghi xuống localStorage,
      // vì `req` đang giữ ở đây là bản chụp lúc mở modal (không tự cập nhật theo store).
      const updated = AlohaData.togglePhotoDone(req.id, photoId);
      if (updated) req.doneIds = updated.doneIds.slice();
    }
  }

  function canAdvance(req) {
    if (req.status !== 'Đang thực hiện') return true;
    const total = (req.photos || []).length;
    if (total === 0) return true;
    return getDoneIds(req).length === total;
  }

  function advance(req) {
    if (req.isStatic) {
      const idx = AlohaData.STATUS_FLOW.indexOf(req.status);
      if (idx >= 0 && idx < AlohaData.STATUS_FLOW.length - 1) req.status = AlohaData.STATUS_FLOW[idx + 1];
    } else if (window.AlohaData) {
      AlohaData.advanceRequestStatus(req.id);
    }
  }

  function getAllRequests() {
    // js/data-store.js lưu photo.src tương đối với index.html ở thư mục gốc
    // (vd "images/my-photos/photo-1.jpg") - trang này (crm/admin.html) nằm
    // sâu hơn 1 cấp nên phải thêm "../" khi hiển thị lại ở đây.
    const real = (window.AlohaData ? AlohaData.getEditRequests() : []).map(r => Object.assign({ isStatic: false }, r, {
      photos: (r.photos || []).map(p => Object.assign({}, p, { src: '../' + p.src }))
    }));
    return STATIC_REQUESTS.concat(real);
  }

  const canEditProgress = role === 'tho-anh';

  function renderEditRequests() {
    const board = document.querySelector('.kanban');
    if (!board) return;
    document.querySelectorAll('.kanban-col').forEach(col => {
      col.querySelectorAll('.kanban-card').forEach(el => el.remove());
    });

    const buckets = {};
    getAllRequests().forEach(req => {
      (buckets[req.status] = buckets[req.status] || []).push(req);
    });

    Object.keys(STATUS_COL_ID).forEach(status => {
      const col = document.getElementById(STATUS_COL_ID[status]);
      if (!col) return;
      const list = (buckets[status] || []).slice().sort((a, b) => a.createdAt - b.createdAt);
      list.forEach((req, i) => {
        const doneCount = getDoneIds(req).length;
        const total = (req.photos || []).length;
        const card = document.createElement('div');
        card.className = 'kanban-card';
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', 'Xem chi tiết yêu cầu ' + (req.orderCode || req.id));
        card.innerHTML = `
          <div class="kanban-card-top">
            <span class="priority-badge" title="Thứ tự ưu tiên xử lý trong cột này: đến trước làm trước">#${i + 1}</span>
            <strong>${req.orderCode || req.id}</strong>
            ${!req.isStatic ? '<span class="badge badge-hoan-thanh">Mới</span>' : ''}
          </div>
          <span>${req.customerName} · ${req.serviceLabel || 'Chụp ảnh'} · ${total || req.photoCount || 0} ảnh</span>
          <span class="kanban-card-time">Gửi ${formatRelativeTime(req.createdAt)}</span>
          ${req.photoNotes && req.photoNotes.length ? `<span class="kanban-card-notes-hint">+${req.photoNotes.length} ảnh có ghi chú riêng</span>` : ''}
          ${total > 0 ? `
          <div class="kanban-progress-track"><div class="kanban-progress-fill${doneCount === total ? ' done' : ''}" style="width:${Math.round(doneCount / total * 100)}%"></div></div>
          <span class="kanban-progress-label">Đã xong ${doneCount}/${total} ảnh</span>` : ''}
          ${req.status !== 'Hoàn thành' ? `<button type="button" class="kanban-advance-btn" data-id="${req.id}"${canAdvance(req) ? '' : ' disabled title="Thợ ảnh cần đánh dấu xong hết ảnh trước khi chuyển bước"'}>Chuyển sang bước tiếp theo →</button>` : ''}
        `;
        card.addEventListener('click', () => openRequestModal(req));
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openRequestModal(req); }
        });
        const advBtn = card.querySelector('.kanban-advance-btn');
        if (advBtn) {
          advBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (advBtn.disabled) return;
            advance(req);
            renderEditRequests();
          });
        }
        col.appendChild(card);
      });
    });
  }

  // ------------------------------- Modal chi tiết 1 yêu cầu -------------------------------
  const modalOverlay = document.getElementById('kanbanModalOverlay');
  const modalBody = document.getElementById('kanbanModalBody');
  const modalClose = document.getElementById('kanbanModalClose');

  function openRequestModal(req) {
    if (!modalOverlay || !modalBody) return;
    renderModalBody(req);
    modalOverlay.classList.add('open');
    modalOverlay.setAttribute('aria-hidden', 'false');
  }

  function closeModal() {
    if (!modalOverlay) return;
    modalOverlay.classList.remove('open');
    modalOverlay.setAttribute('aria-hidden', 'true');
  }
  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (modalOverlay) modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay && modalOverlay.classList.contains('open')) closeModal();
  });

  const STATUS_BADGE_CLASS = {
    'Chờ xử lý': 'badge-quan-tam',
    'Đang thực hiện': 'badge-tu-van',
    'Chờ QC': 'badge-da-chup',
    'Hoàn thành': 'badge-hoan-thanh'
  };

  function renderModalBody(req) {
    const doneIds = getDoneIds(req);
    const total = (req.photos || []).length;
    const pct = total ? Math.round(doneIds.length / total * 100) : 0;
    modalBody.innerHTML = `
      <h3 id="kanbanModalTitle">${req.orderCode || req.id}</h3>
      <p class="kanban-modal-meta">${req.customerName} · ${req.serviceLabel || 'Chụp ảnh'} · <span class="badge ${STATUS_BADGE_CLASS[req.status] || 'badge-dat-lich'}">${req.status}</span></p>
      <p class="kanban-modal-meta">Gửi yêu cầu ${formatRelativeTime(req.createdAt)}</p>
      ${req.note ? `<p class="kanban-modal-note">Ghi chú chung: "${req.note}"</p>` : ''}
      ${total > 0 ? `
      <div class="kanban-modal-progress">
        <div class="kanban-progress-track"><div class="kanban-progress-fill${pct === 100 ? ' done' : ''}" style="width:${pct}%"></div></div>
        <span class="kanban-progress-label">Đã xong ${doneIds.length}/${total} ảnh${!canEditProgress ? ' (Thợ ảnh cập nhật)' : ''}</span>
      </div>
      <div class="kanban-photo-grid">
        ${req.photos.map(p => {
          const done = doneIds.indexOf(p.id) !== -1;
          return `
          <div class="kanban-photo-tile${done ? ' done' : ''}" data-photo-id="${p.id}">
            <img src="${p.src}" alt="Ảnh ${p.id} trong yêu cầu ${req.orderCode || req.id}" loading="lazy">
            ${p.note ? `<p class="note">"${p.note}"</p>` : ''}
            ${canEditProgress
              ? `<button type="button" class="photo-done-toggle" data-photo-id="${p.id}">${done ? '✓ Đã xong' : 'Đánh dấu đã xong'}</button>`
              : `<span class="photo-done-flag${done ? ' done' : ''}">${done ? '✓ Đã xong' : 'Chưa xong'}</span>`}
          </div>`;
        }).join('')}
      </div>` : '<p class="kanban-modal-meta">Yêu cầu này chưa có dữ liệu chi tiết từng ảnh (dữ liệu cũ).</p>'}
      ${req.status !== 'Hoàn thành' ? `
      <button type="button" class="btn btn-primary kanban-modal-advance"${canAdvance(req) ? '' : ' disabled title="Thợ ảnh cần đánh dấu xong hết ảnh trước khi chuyển bước"'}>Chuyển sang bước tiếp theo →</button>` : ''}
    `;

    if (canEditProgress) {
      modalBody.querySelectorAll('.photo-done-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
          togglePhotoDone(req, btn.dataset.photoId);
          renderModalBody(req);
          renderEditRequests();
        });
      });
    }
    const advBtn = modalBody.querySelector('.kanban-modal-advance');
    if (advBtn) {
      advBtn.addEventListener('click', () => {
        if (advBtn.disabled) return;
        advance(req);
        closeModal();
        renderEditRequests();
      });
    }
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
