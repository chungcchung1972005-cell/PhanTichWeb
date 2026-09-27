// ALOHA Baby — màn hình chat trực tiếp Khách <-> Sale (view #/chat-sale, thêm 2026-09-27).
//
// Luồng: khách bấm 1 trong 5 ảnh / dòng dịch vụ đầu trang chủ (#/chat-sale/<dịch vụ>)
// -> chưa đăng nhập thì sang login.html -> đăng nhập xong quay về đúng #/chat-sale/<dịch vụ>
// -> js/router.js hiện view-chat và gọi AlohaSaleChat.show(<dịch vụ>).
// Đã đăng nhập mà bấm ẢNH: ảnh phóng to phủ màn hình rồi mới mở màn chat (zoomToChat).
//
// Mở đầu là các tin chào TỰ ĐỘNG của Sale, đến lần lượt như người thật: "đang trả lời..." ->
// tin 1 -> nghỉ -> "đang trả lời..." -> tin 2 ... thời gian gõ tuỳ độ dài câu; xong thì hiện
// nút gợi ý câu hỏi. Lời chào chỉ hiển thị (không lưu, ghi rõ "Tin nhắn tự động").
//
// CHAT THẬT qua server (server/sale-chat.js, người dùng chọn 2026-09-27): tin khách gửi lên
// server bằng mã đăng nhập (AlohaAuth.api), mọi tài khoản Sale đọc và trả lời trong
// crm/admin.html mục "Tin nhắn" - khác máy, khác trình duyệt vẫn thấy nhau. Trang tự hỏi
// server tin mới mỗi 2.5 giây khi đang mở màn chat (polling).
//
// Khi chatbot AI đang tắt (js/features.js, aiChat: false), nút chat nổi và các lối vào
// khung chat cũ (Tư vấn concept ngay, Báo giá, Khuyến mại, Hỗ trợ...) cũng dẫn tới màn này.
(function (window) {
  const $ = (id) => document.getElementById(id);
  const view = $('view-chat');
  const card = view && view.querySelector('.sc-main');
  const thread = $('scThread');
  const form = $('scForm');
  const input = $('scInput');
  const sendBtn = $('scSend');
  const topicLine = $('scTopicLine');
  const statusBox = $('scStatus');
  if (!view || !card || !thread || !form || !input || !window.AlohaAuth) return;

  const FEATURES = window.ALOHA_FEATURES || {};
  const TITLE = 'Chat với Sale | ALOHA Baby';
  const POLL_ACTIVE_MS = 2500;   // đang mở màn chat
  const POLL_IDLE_MS = 20000;    // ở trang khác: chỉ để bật chấm đỏ khi Sale trả lời
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const AVATAR = '<span class="sc-avatar sc-avatar-sm" aria-hidden="true"><img src="images/logo-mark.svg" alt="" width="18" height="18"></span>';
  const TYPING = '<div class="sc-typing-row"><div class="sc-bubble sc-typing" aria-hidden="true"><span></span><span></span><span></span></div>' +
    '<span class="sc-typing-note">Tư vấn viên đang trả lời…</span></div>';

  let active = false;      // view chat đang hiện
  let topicSlug = '';      // dịch vụ khách vừa chọn (slug)
  let lastKey = '';        // tránh vẽ lại khi không có gì mới (giữ vị trí cuộn)
  let seenIds = new Set(); // tin đã vẽ -> tin mới đến sau mới có hiệu ứng "bật lên"
  let freshShow = false;   // vừa mở màn chat: lần tải đầu từ server không "bật lên" cả lịch sử
  let seq = null;          // chuỗi lời chào đang chạy: { phone, shown, typing, chips, pop, timers[] }
  const greetAt = {};      // giờ lời chào xuất hiện (chỉ để hiện giờ dưới lời chào)

  // Dữ liệu từ server. status: 'loading' | 'ok' | 'offline' (không kết nối được) |
  // 'auth' (thiếu hoặc hết hạn mã đăng nhập -> cần đăng nhập lại).
  let cache = { phone: null, chat: null, status: 'loading' };
  let pending = [];        // tin khách vừa gửi, chờ server nhận: { id, text, at, failed }
  let fetching = false;

  function customer() {
    const s = AlohaAuth.getSession();
    return s && s.role === 'khach-hang' ? s : null;
  }

  // Nhãn dịch vụ lấy đúng chữ trên dòng 5 dịch vụ đầu trang chủ, không viết lại lần nữa.
  function topicLabel(slug) {
    const a = slug && document.querySelector('.svc-list a[href="#/chat-sale/' + slug + '"]');
    return a ? a.textContent.trim() : '';
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }
  const pad2 = (n) => String(n).padStart(2, '0');
  const hm = (ts) => { const d = new Date(ts); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
  function dayLabel(ts) {
    const d = new Date(ts);
    if (d.toDateString() === new Date().toDateString()) return 'Hôm nay';
    if (d.toDateString() === new Date(Date.now() - 864e5).toDateString()) return 'Hôm qua';
    return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear();
  }

  // ---------------------------------------------------------------- Lời chào tự động
  // Không hứa thời gian phản hồi (studio chưa có cam kết thật), chỉ chào + hỏi nhu cầu +
  // gợi ý câu hỏi thường gặp theo dịch vụ.
  function greeting(me, topic) {
    const h = new Date().getHours();
    const part = h < 11 ? 'buổi sáng' : h < 14 ? 'buổi trưa' : h < 18 ? 'buổi chiều' : 'buổi tối';
    const name = esc(me.name || 'ba mẹ');
    const bubbles = [
      `Chào ${name}, chúc ba mẹ một ${part} thật vui! 👋`,
      'Em là tư vấn viên của ALOHA Baby. Rất vui được đồng hành cùng gia đình mình lưu giữ những khoảnh khắc đáng yêu nhất của bé.',
      topic
        ? `Em thấy ba mẹ đang quan tâm dịch vụ <strong>${esc(topic)}</strong>. Ba mẹ muốn em gửi bảng giá, gợi ý concept hay tìm khung giờ chụp phù hợp ạ?`
        : 'Ba mẹ đang cần tư vấn điều gì ạ? Em có thể gợi ý concept, gửi bảng giá hoặc giúp mình chọn lịch chụp hợp với bé.'
    ];
    const chips = topic
      ? [
          { label: 'Bảng giá ' + topic, text: `Cho mình xin bảng giá dịch vụ ${topic} ạ.` },
          { label: 'Gợi ý concept', text: `Mình muốn xem gợi ý concept cho dịch vụ ${topic}.` },
          { label: 'Lịch trống gần nhất', text: 'Studio còn lịch trống gần nhất vào ngày nào ạ?' },
          { label: 'Cần chuẩn bị gì?', text: `Đi chụp ${topic} thì gia đình mình cần chuẩn bị những gì ạ?` }
        ]
      : [
          { label: 'Tư vấn chọn dịch vụ', text: 'Mình cần tư vấn nên chọn dịch vụ chụp nào cho bé ạ.' },
          { label: 'Bảng giá các gói', text: 'Cho mình xin bảng giá các gói chụp ạ.' },
          { label: 'Lịch trống gần nhất', text: 'Studio còn lịch trống gần nhất vào ngày nào ạ?' },
          { label: 'Chụp ảnh tại nhà', text: 'Studio có nhận chụp ảnh tại nhà không ạ?' }
        ];
    return { bubbles, chips };
  }

  // g: kết quả greeting(); st: { shown, typing, chips, pop } - mặc định là hiện đủ, không hiệu ứng.
  function greetingHtml(me, g, st, withChips, greetTime) {
    const bubbles = g.bubbles.slice(0, st.shown)
      .map((b, i) => `<div class="sc-bubble${st.pop === i ? ' sc-pop' : ''}">${b}</div>`).join('');
    const chips = withChips && st.chips
      ? `<div class="sc-chips${st.pop === 'chips' ? ' sc-pop' : ''}" role="group" aria-label="Câu hỏi gợi ý">
          ${g.chips.map((c) => `<button type="button" class="sc-chip" data-text="${esc(c.text)}">${esc(c.label)}</button>`).join('')}
        </div>`
      : '';
    const time = !st.typing && st.shown === g.bubbles.length && greetTime ? `<time>${hm(greetTime)}</time>` : '';
    return `<div class="sc-row from-sale sc-auto">
      ${AVATAR}
      <div class="sc-stack">
        <span class="sc-name">ALOHA Baby <em>· Tin nhắn tự động</em></span>
        ${bubbles}${st.typing ? TYPING : ''}${chips}${time}
      </div>
    </div>`;
  }

  // Thời gian "gõ" 1 tin: câu dài gõ lâu hơn, trong khoảng 0.7 - 1.6 giây.
  function typingMs(html) {
    const len = html.replace(/<[^>]+>/g, '').length;
    return Math.max(700, Math.min(1600, 400 + len * 10));
  }

  function stopSeq() {
    if (seq) seq.timers.forEach(clearTimeout);
    seq = null;
  }

  // Chạy chuỗi lời chào: nghỉ một nhịp cho khung chat hiện xong -> đang trả lời -> tin 1 ->
  // nghỉ -> đang trả lời -> tin 2 -> ... -> nút gợi ý.
  function startSeq(me) {
    stopSeq();
    const g = greeting(me, topicLabel(topicSlug));
    seq = { phone: me.phone, shown: 0, typing: false, chips: false, pop: null, timers: [] };
    let t = 450;
    const at = (ms, fn) => { seq.timers.push(setTimeout(() => { if (seq) { fn(); render(true); } }, ms)); };
    g.bubbles.forEach((b, i) => {
      at(t, () => { seq.typing = true; seq.pop = null; });
      t += typingMs(b);
      at(t, () => {
        seq.typing = false; seq.shown = i + 1; seq.pop = i;
        if (i === 0) greetAt[me.phone] = Date.now();
      });
      t += 400;
    });
    at(t - 150, () => { seq.chips = true; seq.pop = 'chips'; });
    at(t + 500, () => { seq = null; });
  }

  // ---------------------------------------------------------------- Vẽ cuộc trò chuyện
  // Gom các tin liền nhau của cùng 1 người thành 1 nhóm (1 avatar, 1 tên, giờ ở tin cuối),
  // chèn dòng ngày khi sang ngày mới. Tin chưa từng vẽ (vừa gửi / Sale vừa trả lời) thì
  // "bật lên" nhẹ, như ứng dụng nhắn tin thật.
  function messagesHtml(msgs, startDay) {
    let html = '';
    let lastDay = startDay || '';
    for (let i = 0; i < msgs.length; ) {
      const first = msgs[i];
      const day = dayLabel(first.at);
      if (day !== lastDay) { html += `<div class="sc-day"><span>${day}</span></div>`; lastDay = day; }
      const group = [first];
      let j = i + 1;
      while (j < msgs.length && msgs[j].from === first.from && msgs[j].senderName === first.senderName &&
             dayLabel(msgs[j].at) === day && msgs[j].at - msgs[j - 1].at < 5 * 60 * 1000) {
        group.push(msgs[j]);
        j++;
      }
      const bubbles = group.map((m) => `<div class="sc-bubble${seenIds.has(m.id) ? '' : ' sc-pop'}">${esc(m.text)}</div>`).join('');
      const time = `<time>${hm(group[group.length - 1].at)}</time>`;
      html += first.from === 'sale'
        ? `<div class="sc-row from-sale">${AVATAR}<div class="sc-stack"><span class="sc-name">${esc(first.senderName || 'Sale ALOHA Baby')}</span>${bubbles}${time}</div></div>`
        : `<div class="sc-row from-me"><div class="sc-stack">${bubbles}${time}</div></div>`;
      i = j;
    }
    return html;
  }

  // Tin đang gửi / gửi lỗi (chưa có trên server) - luôn ở cuối, bên phải.
  function pendingHtml() {
    if (!pending.length) return '';
    return `<div class="sc-row from-me"><div class="sc-stack">
      ${pending.map((p) => `<div class="sc-bubble sc-pop${p.failed ? ' sc-failed' : ' sc-sending'}">${esc(p.text)}</div>
        ${p.failed ? `<button type="button" class="sc-retry" data-retry="${p.id}">Chưa gửi được · Gửi lại</button>` : ''}`).join('')}
      ${pending.some((p) => !p.failed) ? '<time>Đang gửi…</time>' : ''}
    </div></div>`;
  }

  const serverMsgs = () => (cache.chat && cache.chat.messages) || [];

  function render(force) {
    const me = customer();
    if (!me) return;
    const msgs = serverMsgs();
    const topic = topicLabel(topicSlug);
    const g = greeting(me, topic);
    const st = seq && seq.phone === me.phone ? seq : { shown: g.bubbles.length, typing: false, chips: true, pop: null };
    const key = [me.phone, topic, msgs.length, msgs.length ? msgs[msgs.length - 1].id : '',
      pending.map((p) => p.id + (p.failed ? '!' : '')).join(',')].join('|');
    if (!force && key === lastKey) return;
    lastKey = key;
    const nearBottom = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 80;
    const hasMine = msgs.some((m) => m.from === 'khach') || pending.length > 0;

    // Lời chào luôn đứng trước tin đầu tiên: đã có tin thì lấy giờ tin đầu nếu sớm hơn,
    // để giờ hiển thị không bị ngược thứ tự.
    const greetTime = msgs.length ? Math.min(greetAt[me.phone] || Infinity, msgs[0].at) : greetAt[me.phone];
    const greetDay = greetTime ? dayLabel(greetTime) : '';
    thread.innerHTML = (greetDay ? `<div class="sc-day"><span>${greetDay}</span></div>` : '') +
      greetingHtml(me, g, st, !hasMine, greetTime) + messagesHtml(msgs, greetDay) + pendingHtml();
    msgs.forEach((m) => seenIds.add(m.id));
    if (force || nearBottom) thread.scrollTop = thread.scrollHeight;
  }

  // Dòng báo trạng thái kết nối ngay dưới đầu khung chat.
  function renderStatus() {
    if (!statusBox) return;
    const s = cache.status;
    statusBox.hidden = !(s === 'offline' || s === 'auth');
    statusBox.className = 'sc-status' + (s === 'auth' ? ' sc-status-auth' : '');
    if (s === 'offline') {
      statusBox.innerHTML = 'Đang kết nối tới máy chủ chat… Máy chủ có thể cần vài chục giây để khởi động, tin nhắn sẽ gửi được ngay khi kết nối xong.';
    } else if (s === 'auth') {
      statusBox.innerHTML = 'Tài khoản chưa kết nối được với máy chủ chat. <button type="button" id="scRelogin">Đăng nhập lại</button> để nhắn cho Sale.';
    }
    const locked = s === 'auth';
    input.disabled = locked;
    input.placeholder = locked ? 'Đăng nhập lại để nhắn cho Sale' : 'Nhập tin nhắn cho Sale...';
    if (locked) sendBtn.disabled = true;
    else updateSendState();
  }

  // ---------------------------------------------------------------- Trao đổi với server
  function setChat(me, chat) {
    if (cache.phone !== me.phone) cache = { phone: me.phone, chat: null, status: 'loading' };
    cache.chat = chat;
    cache.status = 'ok';
  }
  function setError(me, status) {
    if (cache.phone !== me.phone) cache = { phone: me.phone, chat: null, status: 'loading' };
    cache.status = status === 401 ? 'auth' : 'offline';
  }

  async function fetchChat() {
    const me = customer();
    if (!me) return;
    if (!me.token) { setError(me, 401); afterData(); return; }
    if (fetching) return;
    fetching = true;
    const r = await AlohaAuth.api('/api/sale-chat/me');
    fetching = false;
    if (r.ok) setChat(me, r.data.chat); else setError(me, r.status);
    afterData();
  }

  function afterData() {
    if (active) {
      if (freshShow && cache.status === 'ok') {
        // Lần tải đầu sau khi mở màn chat: lịch sử cũ hiện luôn, không "bật lên" từng tin.
        serverMsgs().forEach((m) => seenIds.add(m.id));
        freshShow = false;
      }
      // Đã có tin (nhắn từ máy khác / lần trước) -> dừng lời chào đang chạy, hiện lịch sử.
      if (seq && serverMsgs().length) stopSeq();
      render(false);
      markRead();
      renderStatus();
    }
    updateDot();
  }

  async function markRead() {
    const me = customer();
    if (!me || !active || document.visibilityState !== 'visible' || !cache.chat || !cache.chat.customerUnread) return;
    cache.chat.customerUnread = 0;
    updateDot();
    const r = await AlohaAuth.api('/api/sale-chat/me/read', { method: 'POST' });
    if (r.ok && r.data.chat) cache.chat = r.data.chat;
  }

  // Chấm đỏ trên nút chat nổi: Sale đã trả lời mà khách chưa mở màn chat xem.
  function updateDot() {
    const dot = document.querySelector('#chatToggle .dot');
    if (!dot || FEATURES.aiChat !== false) return;
    const me = customer();
    dot.hidden = !(me && cache.phone === me.phone && cache.chat && cache.chat.customerUnread > 0);
  }

  function updateSendState() {
    sendBtn.disabled = input.disabled || !input.value.trim();
    // Ô nhập tự cao theo nội dung, tối đa ~5 dòng rồi cuộn trong ô.
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 132) + 'px';
  }

  async function send(text, retryOf) {
    const me = customer();
    const clean = String(text || '').trim();
    if (!me || !clean) return;
    // Khách nhắn trước khi lời chào chạy xong -> hiện nốt lời chào ngay, không chen ngang.
    stopSeq();
    if (retryOf) pending = pending.filter((p) => p !== retryOf);
    const item = { id: 'tmp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), text: clean, at: Date.now(), failed: false };
    pending.push(item);
    render(true);
    const r = me.token
      ? await AlohaAuth.api('/api/sale-chat/me/messages', { method: 'POST', body: { text: clean, topic: topicLabel(topicSlug) } })
      : { ok: false, status: 401 };
    if (r.ok) {
      pending = pending.filter((p) => p !== item);
      setChat(me, r.data.chat);
      // Tin vừa gửi thành công vẫn "bật lên" 1 lần (đã hiện ở dạng đang gửi, không lặp lại).
      serverMsgs().slice(-1).forEach((m) => seenIds.add(m.id));
    } else {
      item.failed = true;
      if (r.status === 401 || r.status === 0 || r.status >= 500) setError(me, r.status);
    }
    render(true);
    renderStatus();
  }

  // Khung chat cao đúng phần khung nhìn còn lại dưới thanh điều hướng.
  function fitHeight() {
    const header = document.querySelector('.site-header');
    const topbar = document.querySelector('.topbar');
    const top = (header ? header.offsetHeight : 0) + (topbar ? topbar.offsetHeight : 0);
    view.style.setProperty('--sc-top', top + 'px');
  }

  // ---------------------------------------------------------------- Gọi từ router
  function show(param) {
    active = true;
    const slug = String(param || '').split('/')[0];
    topicSlug = topicLabel(slug) ? slug : '';
    if (topicLine) topicLine.textContent = topicLabel(topicSlug) || 'Tư vấn chung';
    fitHeight();

    const me = customer();
    if (me && cache.phone !== me.phone) { cache = { phone: me.phone, chat: null, status: 'loading' }; pending = []; }
    seenIds = new Set(serverMsgs().map((m) => m.id));
    freshShow = true;
    stopSeq();
    // Khách chưa nhắn gì -> MỖI lần mở màn chat, các tin chào đến lần lượt kèm "đang trả lời…"
    // (người dùng yêu cầu 2026-09-27). Máy bật giảm hiệu ứng thì vẫn đến lần lượt, chỉ bỏ
    // chuyển động (css/pages.css). Đã có tin thì hiện lịch sử như ứng dụng nhắn tin thật
    // (chưa biết thì cứ bắt đầu chào, server báo có tin thì afterData() dừng lại).
    if (me && !serverMsgs().length && !pending.length) startSeq(me);
    else if (me && !greetAt[me.phone]) greetAt[me.phone] = Date.now();
    lastKey = '';
    render(true);
    renderStatus();
    fetchChat();

    // Khung chat trượt nhẹ lên mỗi lần mở màn này.
    if (!reduceMotion) {
      card.classList.remove('sc-in');
      void card.offsetWidth;
      card.classList.add('sc-in');
    }
    // Chỉ tự đặt con trỏ trên máy tính: trên điện thoại sẽ bật bàn phím che mất lời chào.
    if (window.matchMedia('(pointer: fine)').matches) setTimeout(() => input.focus({ preventScroll: true }), 50);
    return TITLE;
  }

  function hide() {
    active = false;
    stopSeq(); // rời màn chat giữa chừng thì dừng hẹn giờ; mở lại sẽ chào lại từ đầu nếu khách chưa nhắn
  }

  // ---------------------------------------------------------------- Ảnh phóng to sang màn chat
  // Khách ĐÃ đăng nhập bấm 1 trong 5 ảnh dịch vụ: bản sao của ảnh phóng từ đúng vị trí ô ảnh
  // ra phủ kín màn hình (phủ dần một lớp hồng nhạt), đổi sang màn chat bên dưới rồi mờ đi.
  // Chưa đăng nhập thì để link chạy bình thường (router đưa sang trang đăng nhập).
  function zoomToChat(tile) {
    const route = tile.getAttribute('href').slice(2);
    const img = tile.querySelector('img');
    const r = tile.getBoundingClientRect();
    const ghost = document.createElement('div');
    ghost.className = 'sc-zoom';
    ghost.setAttribute('aria-hidden', 'true');
    ghost.style.backgroundImage = `url("${(img && (img.currentSrc || img.src)) || ''}")`;
    document.body.appendChild(ghost);
    const from = { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', borderRadius: '16px' };
    const to = { left: '0px', top: '0px', width: window.innerWidth + 'px', height: window.innerHeight + 'px', borderRadius: '0px' };
    Object.assign(ghost.style, from);
    const tint = document.createElement('span'); // lớp hồng nhạt phủ dần, để lúc lộ màn chat không bị giật màu
    ghost.appendChild(tint);
    const grow = ghost.animate([from, to], { duration: 480, easing: 'cubic-bezier(0.3, 0.7, 0.2, 1)', fill: 'forwards' });
    tint.animate([{ opacity: 0 }, { opacity: 0.94 }], { duration: 480, easing: 'ease-in', fill: 'forwards' });
    grow.onfinish = () => {
      history.pushState(null, '', '#/' + route);
      window.AlohaRouter.navigateTo(route);
      const fade = ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, easing: 'ease-out', fill: 'forwards' });
      fade.onfinish = () => ghost.remove();
    };
  }

  document.addEventListener('click', (e) => {
    const tile = e.target.closest('a.svc-tile[href^="#/chat-sale/"]');
    if (!tile || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!customer() || reduceMotion || !window.AlohaRouter || !Element.prototype.animate) return;
    e.preventDefault();
    zoomToChat(tile);
  });

  // ---------------------------------------------------------------- Sự kiện
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value;
    if (!text.trim() || input.disabled) return;
    input.value = '';
    updateSendState();
    send(text);
    input.focus();
  });
  input.addEventListener('input', updateSendState);
  // Enter gửi, Shift+Enter xuống dòng (bỏ qua lúc đang gõ dấu tiếng Việt bằng bộ gõ).
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  thread.addEventListener('click', (e) => {
    const chip = e.target.closest('.sc-chip');
    if (chip && !input.disabled) { send(chip.dataset.text); return; }
    const retry = e.target.closest('.sc-retry');
    if (retry) {
      const item = pending.find((p) => p.id === retry.dataset.retry);
      if (item) send(item.text, item);
    }
  });

  if (statusBox) {
    statusBox.addEventListener('click', (e) => {
      if (e.target.id === 'scRelogin') AlohaAuth.logout('chat-sale' + (topicSlug ? '/' + topicSlug : ''));
    });
  }

  // Chatbot AI đang tắt -> nút chat nổi + các lối vào khung chat cũ dẫn tới màn chat Sale
  // (router tự bắt đăng nhập nếu cần).
  if (FEATURES.aiChat === false) {
    const goChat = (e) => { if (e) e.preventDefault(); window.location.hash = '/chat-sale'; };
    ['chatToggle', 'conceptChatBtn', 'topbarPartner', 'topbarSupport', 'navPricing', 'navPromo'].forEach((id) => {
      const el = $(id);
      if (el) el.addEventListener('click', goChat);
    });
  }

  // Hỏi server tin mới: dày khi đang mở màn chat, thưa khi ở trang khác (chỉ để bật chấm đỏ).
  let lastIdlePoll = 0;
  setInterval(() => {
    const me = customer();
    if (!me || document.visibilityState !== 'visible') return;
    if (active) { fetchChat(); return; } // không có mã thì fetchChat() tự báo "Đăng nhập lại"
    if (me.token && FEATURES.aiChat === false && Date.now() - lastIdlePoll >= POLL_IDLE_MS) { lastIdlePoll = Date.now(); fetchChat(); }
  }, POLL_ACTIVE_MS);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && active) fetchChat(); });
  window.addEventListener('resize', () => { if (active) fitHeight(); });
  if (FEATURES.aiChat === false && customer()) { lastIdlePoll = Date.now(); fetchChat(); }

  window.AlohaSaleChat = { show, hide };

  // Tải trang thẳng vào #/chat-sale (vd vừa đăng nhập xong): router đã chạy trước khi file
  // này nạp nên chưa vẽ được -> tự vẽ ở đây.
  const route = window.AlohaRouter && window.AlohaRouter.parseRoute ? window.AlohaRouter.parseRoute() : null;
  if (route && route.split('/')[0] === 'chat-sale' && !view.hidden) document.title = show(route.split('/').slice(1).join('/'));
})(window);
