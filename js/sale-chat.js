// ALOHA Baby — khung chat trực tiếp Khách <-> Sale (thêm 2026-09-27).
//
// Từ 2026-09-28 là KHUNG NHỎ Ở GÓC phải dưới (#saleChatPanel), mở bằng nút chat nổi, như
// chatbot ban đầu (người dùng yêu cầu; 27/09 từng là màn chat toàn trang #/chat-sale).
// Khách chưa đăng nhập bấm nút chat -> #/chat-sale -> router đưa sang login.html -> đăng nhập
// xong quay lại, router gọi AlohaSaleChat.open() mở khung ngay trên trang.
// Đang xem album 1 dịch vụ (#/album/<dịch vụ>...) thì khung chat tự ghi dịch vụ đó làm chủ đề.
//
// Khi chatbot AI BẬT (js/features.js aiChat: true, mặc định từ 2026-09-28): không dùng khung
// riêng ở trên mà chat với Sale NGAY TRONG khung chatbot (js/script.js gọi embed() khi khách bấm
// "Nhắn trực tiếp với Sale"), kèm gửi Sale bản tóm tắt những gì khách đã xem/hỏi (summaryText,
// dựng từ hành trình trong js/router.js), server lưu thành tin hệ thống chỉ Sale/Sếp thấy.
//
// Mở đầu là các tin chào TỰ ĐỘNG của Sale, đến lần lượt như người thật: "đang trả lời..." ->
// tin 1 -> nghỉ -> "đang trả lời..." -> tin 2 ... thời gian gõ tuỳ độ dài câu; xong thì hiện
// nút gợi ý câu hỏi. Lời chào chỉ hiển thị (không lưu, ghi rõ "Tin nhắn tự động").
//
// CHAT THẬT qua server (server/sale-chat.js, người dùng chọn 2026-09-27): tin khách gửi lên
// server bằng mã đăng nhập (AlohaAuth.api), mọi tài khoản Sale đọc và trả lời trong
// crm/admin.html mục "Tin nhắn" - khác máy, khác trình duyệt vẫn thấy nhau. Trang tự hỏi
// server tin mới mỗi 2.5 giây khi đang mở khung chat (polling).
//
// Khi chatbot AI đang tắt (js/features.js, aiChat: false), nút chat nổi và các lối vào
// khung chat cũ (Tư vấn concept ngay, Báo giá, Khuyến mại, Hỗ trợ...) mở khung này.
(function (window) {
  const $ = (id) => document.getElementById(id);
  const view = $('saleChatPanel');
  const card = view && view.querySelector('.sc-main');
  let thread = $('scThread');
  const form = $('scForm');
  let input = $('scInput');
  let sendBtn = $('scSend');
  const topicLine = $('scTopicLine');
  let statusBox = $('scStatus');
  const toggleBtn = $('chatToggle');
  const closeBtn = $('scClose');
  if (!view || !card || !thread || !form || !input || !window.AlohaAuth) return;
  // Đích vẽ hiện tại. embed() đổi sang phần tử trong khung chatbot, unembed() trả lại khung riêng.
  const PANEL = { thread, input, sendBtn, statusBox };
  let scroller = thread;   // phần tử cuộn (khi nhúng là cả thân khung chatbot)
  let embedded = false;
  const wired = new WeakSet();

  const FEATURES = window.ALOHA_FEATURES || {};
  const POLL_ACTIVE_MS = 2500;   // đang mở khung chat
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
    const a = slug && document.querySelector('.svc-list a[href="#/album/' + slug + '"]');
    return a ? a.textContent.trim() : '';
  }
  // Đang xem album của 1 dịch vụ -> lấy dịch vụ đó làm chủ đề chat.
  function topicFromPage() {
    const m = /^#\/album\/([a-z-]+)/.exec(window.location.hash);
    return m ? m[1] : '';
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

  // Tin hệ thống (from 'he-thong', bản tóm tắt gửi Sale) không hiện cho khách.
  const serverMsgs = () => ((cache.chat && cache.chat.messages) || []).filter((m) => m.from !== 'he-thong');

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
    const nearBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 80;
    const hasMine = msgs.some((m) => m.from === 'khach') || pending.length > 0;

    // Lời chào luôn đứng trước tin đầu tiên: đã có tin thì lấy giờ tin đầu nếu sớm hơn,
    // để giờ hiển thị không bị ngược thứ tự.
    const greetTime = msgs.length ? Math.min(greetAt[me.phone] || Infinity, msgs[0].at) : greetAt[me.phone];
    const greetDay = greetTime ? dayLabel(greetTime) : '';
    thread.innerHTML = (greetDay ? `<div class="sc-day"><span>${greetDay}</span></div>` : '') +
      greetingHtml(me, g, st, !hasMine, greetTime) + messagesHtml(msgs, greetDay) + pendingHtml();
    msgs.forEach((m) => seenIds.add(m.id));
    if (force || nearBottom) scroller.scrollTop = scroller.scrollHeight;
    if (input.disabled) thread.querySelectorAll('.sc-chip').forEach((b) => { b.disabled = true; });
  }

  // Đang nhúng trong khung chatbot: chat Sale chưa dùng được thì vẫn có lối quay lại trợ lý AI.
  function backToAi() {
    return embedded ? ' Trong lúc chờ, bạn có thể <button type="button" id="scBackAi">quay lại trợ lý AI</button>.' : '';
  }

  // Dòng báo trạng thái kết nối ngay dưới đầu khung chat.
  function renderStatus() {
    if (!statusBox) return;
    const s = cache.status;
    statusBox.hidden = !(s === 'offline' || s === 'auth');
    statusBox.className = 'sc-status' + (s === 'auth' ? ' sc-status-auth' : '');
    if (s === 'offline') {
      statusBox.innerHTML = 'Đang kết nối tới máy chủ chat… Máy chủ có thể cần vài chục giây để khởi động, tin nhắn sẽ gửi được ngay khi kết nối xong.' + backToAi();
    } else if (s === 'auth') {
      statusBox.innerHTML = 'Tài khoản chưa kết nối được với máy chủ chat. <button type="button" id="scRelogin">Đăng nhập lại</button> để nhắn cho Sale.' + backToAi();
    }
    const locked = s === 'auth';
    input.disabled = locked;
    input.placeholder = locked ? 'Đăng nhập lại để nhắn cho Sale' : 'Nhập tin nhắn cho Sale...';
    if (locked) sendBtn.disabled = true;
    else updateSendState();
    // Chưa gửi được thì nút gợi ý cũng mờ đi, không để khách bấm mà không thấy gì xảy ra.
    thread.querySelectorAll('.sc-chip').forEach((b) => { b.disabled = locked; });
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

  // Chấm đỏ trên nút chat nổi: Sale đã trả lời mà khách chưa mở chat xem.
  function unread() {
    const me = customer();
    return me && cache.phone === me.phone && cache.chat ? (cache.chat.customerUnread || 0) : 0;
  }
  function updateDot() {
    const dot = document.querySelector('#chatToggle .dot');
    if (dot) dot.hidden = active || !unread();
  }

  function updateSendState() {
    sendBtn.disabled = input.disabled || !input.value.trim();
    // Ô nhập tự cao theo nội dung, tối đa ~5 dòng rồi cuộn trong ô.
    if (input.tagName !== 'TEXTAREA') return;
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

  // ---------------------------------------------------------------- Mở / đóng khung chat
  // topic: slug dịch vụ (vd 'bau'); bỏ trống thì lấy dịch vụ của album đang xem (nếu có).
  function open(topic) {
    if (FEATURES.aiChat !== false) {
      // Chatbot AI bật: chat với Sale ngay trong khung chatbot (js/script.js). Lúc tải trang
      // (vd vừa đăng nhập với next=chat-sale) khung chatbot chưa sẵn sàng -> chờ trang dựng xong.
      if (window.AlohaChatbot) window.AlohaChatbot.openSale(topic);
      else document.addEventListener('DOMContentLoaded', () => { if (window.AlohaChatbot) window.AlohaChatbot.openSale(topic); });
      return;
    }
    const me = customer();
    if (!me) return;
    const slug = String(topic || '').split('/')[0] || topicFromPage();
    const newTopic = topicLabel(slug) ? slug : '';
    if (active) {
      // Đang mở rồi: chỉ đổi chủ đề nếu khác, không chào lại từ đầu.
      if (newTopic && newTopic !== topicSlug) { topicSlug = newTopic; topicLine.textContent = topicLabel(topicSlug); render(true); }
      return;
    }
    active = true;
    topicSlug = newTopic;
    if (topicLine) topicLine.textContent = topicLabel(topicSlug) || 'Tư vấn chung';
    view.classList.add('open');
    view.setAttribute('aria-hidden', 'false');
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');

    if (cache.phone !== me.phone) { cache = { phone: me.phone, chat: null, status: 'loading' }; pending = []; }
    seenIds = new Set(serverMsgs().map((m) => m.id));
    freshShow = true;
    stopSeq();
    // Khách chưa nhắn gì -> MỖI lần mở khung chat, các tin chào đến lần lượt kèm "đang trả lời…"
    // (người dùng yêu cầu 2026-09-27). Máy bật giảm hiệu ứng thì vẫn đến lần lượt, chỉ bỏ
    // chuyển động (css/pages.css). Đã có tin thì hiện lịch sử như ứng dụng nhắn tin thật
    // (chưa biết thì cứ bắt đầu chào, server báo có tin thì afterData() dừng lại).
    if (!serverMsgs().length && !pending.length) startSeq(me);
    else if (!greetAt[me.phone]) greetAt[me.phone] = Date.now();
    lastKey = '';
    render(true);
    renderStatus();
    updateDot();
    fetchChat();
    // Chỉ tự đặt con trỏ trên máy tính: trên điện thoại sẽ bật bàn phím che mất lời chào.
    if (window.matchMedia('(pointer: fine)').matches) setTimeout(() => input.focus({ preventScroll: true }), 50);
  }

  function close() {
    if (!active) return;
    active = false;
    stopSeq(); // đóng giữa chừng thì dừng hẹn giờ; mở lại sẽ chào lại từ đầu nếu khách chưa nhắn
    view.classList.remove('open');
    view.setAttribute('aria-hidden', 'true');
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
    if (view.contains(document.activeElement)) document.activeElement.blur();
    updateDot();
  }

  // ---------------------------------------------------------------- Nhúng vào khung chatbot AI
  // o: { container (nơi vẽ tin Sale), scroller, input, sendBtn, statusBox, topic (slug) }.
  // Gọi lại khi khung chatbot mở lại ở chế độ Sale (không chào lại từ đầu).
  function embed(o) {
    const me = customer();
    if (!me || !o || !o.container) return;
    const first = !embedded || thread !== o.container;
    thread = o.container; scroller = o.scroller || o.container;
    input = o.input; sendBtn = o.sendBtn; statusBox = o.statusBox || null;
    embedded = true;
    active = true;
    wire(thread, statusBox);
    if (o.topic !== undefined) {
      const slug = String(o.topic || '').split('/')[0] || topicFromPage();
      if (topicLabel(slug)) topicSlug = slug; else if (first) topicSlug = '';
    }
    if (cache.phone !== me.phone) { cache = { phone: me.phone, chat: null, status: 'loading' }; pending = []; }
    if (first) {
      seenIds = new Set(serverMsgs().map((m) => m.id));
      freshShow = true;
      stopSeq();
      if (!serverMsgs().length && !pending.length) startSeq(me);
      else if (!greetAt[me.phone]) greetAt[me.phone] = Date.now();
    }
    lastKey = '';
    render(true);
    renderStatus();
    updateDot();
    fetchChat();
  }
  // Thu nhỏ khung chatbot khi đang ở chế độ Sale: ngừng đánh dấu đã đọc, vẫn nhớ chế độ.
  function pause() {
    if (!active) return;
    active = false;
    if (seq) { stopSeq(); if (embedded) render(true); }
    updateDot();
  }
  // Quay lại trợ lý AI: tin Sale đã hiện giữ nguyên trong khung chatbot, trả đích vẽ về khung riêng.
  function unembed() {
    pause();
    if (!embedded) return;
    embedded = false;
    thread = PANEL.thread; scroller = PANEL.thread; input = PANEL.input; sendBtn = PANEL.sendBtn; statusBox = PANEL.statusBox;
  }

  // Bản tóm tắt gửi Sale: khách quan tâm dịch vụ nào, đã xem concept/ảnh/trang nào, đã hỏi
  // trợ lý AI những gì (hành trình trong phiên, js/router.js). Chữ thuần, tối đa ~1900 ký tự.
  function summaryText() {
    const list = (window.AlohaJourney && window.AlohaJourney.list()) || [];
    const count = {};
    const concepts = [];
    const pages = [];
    const asks = [];
    let photos = 0;
    list.forEach((it) => {
      if (it.service) count[it.service] = (count[it.service] || 0) + (it.type === 'service' ? 2 : 1);
      if (it.type === 'concept') {
        const name = it.concept + ' (' + (topicLabel(it.service) || it.service) + ')';
        if (concepts.indexOf(name) === -1) concepts.push(name);
      }
      if (it.type === 'photo') photos += 1;
      if (it.type === 'page' && it.label && pages.indexOf(it.label) === -1) pages.push(it.label);
      if (it.type === 'ask' && it.label && asks.indexOf(it.label) === -1) asks.push(it.label);
    });
    const services = Object.keys(count).sort((a, b) => count[b] - count[a]).map((sl) => topicLabel(sl) || sl);
    const lines = [];
    if (topicSlug) lines.push('Đang hỏi về: ' + topicLabel(topicSlug));
    if (services.length) lines.push('Quan tâm nhiều nhất: ' + services.slice(0, 3).join(', '));
    if (concepts.length) lines.push('Concept đã xem: ' + concepts.slice(-6).join('; '));
    if (photos) lines.push('Đã mở xem lớn ' + photos + ' ảnh mẫu');
    if (pages.length) lines.push('Trang đã đọc: ' + pages.slice(-4).join('; '));
    if (asks.length) lines.push('Đã hỏi trợ lý AI: ' + asks.slice(-6).map((q) => '"' + q.slice(0, 120) + '"').join('; '));
    if (!lines.length) lines.push('Khách chưa xem album hay hỏi trợ lý AI trước khi chuyển sang Sale.');
    return lines.join('\n').slice(0, 1900);
  }
  let lastSummary = '';
  async function handoff() {
    const me = customer();
    if (!me || !me.token) return;
    const text = summaryText();
    if (text === lastSummary) return; // chuyển qua lại nhiều lần mà không xem thêm gì -> không gửi lặp
    lastSummary = text;
    const r = await AlohaAuth.api('/api/sale-chat/me/handoff', { method: 'POST', body: { summary: text, topic: topicLabel(topicSlug) } });
    if (r.ok) { setChat(me, r.data.chat); if (active) render(false); } else lastSummary = '';
  }

  // Nút gợi ý / Gửi lại / Đăng nhập lại trong phần tin nhắn (gắn 1 lần cho mỗi phần tử).
  function wire(threadEl, statusEl) {
    if (threadEl && !wired.has(threadEl)) {
      wired.add(threadEl);
      threadEl.addEventListener('click', (e) => {
        if (threadEl !== thread) return;
        const chip = e.target.closest('.sc-chip');
        if (chip && !input.disabled) { send(chip.dataset.text); return; }
        const retry = e.target.closest('.sc-retry');
        if (retry) {
          const item = pending.find((x) => x.id === retry.dataset.retry);
          if (item) send(item.text, item);
        }
      });
    }
    if (statusEl && !wired.has(statusEl)) {
      wired.add(statusEl);
      statusEl.addEventListener('click', (e) => {
        if (e.target.id === 'scRelogin') AlohaAuth.logout('chat-sale' + (topicSlug ? '/' + topicSlug : ''));
        if (e.target.id === 'scBackAi' && window.AlohaChatbot && window.AlohaChatbot.backToAi) window.AlohaChatbot.backToAi();
      });
    }
  }

  // Chưa đăng nhập (hoặc tài khoản nhân viên) -> đi qua route #/chat-sale để router bắt
  // đăng nhập, đăng nhập xong router mở lại khung chat.
  function openOrLogin(topic) {
    if (customer()) open(topic);
    else window.location.hash = '/chat-sale' + (topic ? '/' + topic : '');
  }

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

  wire(thread, statusBox);

  // Chatbot AI đang tắt -> nút chat nổi mở/thu nhỏ khung chat Sale; các lối vào khung chat
  // cũ (Tư vấn concept ngay, Báo giá...) và link #/chat-sale mở khung ngay trên trang đang xem.
  if (FEATURES.aiChat === false) {
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-controls', 'saleChatPanel');
      toggleBtn.setAttribute('aria-expanded', 'false');
      toggleBtn.addEventListener('click', (e) => { e.preventDefault(); if (active) close(); else openOrLogin(''); });
    }
    const goChat = (e) => { if (e) e.preventDefault(); openOrLogin(''); };
    ['conceptChatBtn', 'topbarPartner', 'topbarSupport', 'navPricing', 'navPromo'].forEach((id) => {
      const el = $(id);
      if (el) el.addEventListener('click', goChat);
    });
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#/chat-sale"]');
    if (!a || e.defaultPrevented || !customer()) return; // chưa đăng nhập: để router bắt đăng nhập
    e.preventDefault();
    open(a.getAttribute('href').split('/').slice(2).join('/'));
  });
  if (closeBtn) closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && active && !embedded) close(); });

  // Hỏi server tin mới: dày khi đang mở khung chat, thưa khi đóng (chỉ để bật chấm đỏ).
  let lastIdlePoll = 0;
  setInterval(() => {
    const me = customer();
    if (!me || document.visibilityState !== 'visible') return;
    if (active) { fetchChat(); return; } // không có mã thì fetchChat() tự báo "Đăng nhập lại"
    if (me.token && Date.now() - lastIdlePoll >= POLL_IDLE_MS) { lastIdlePoll = Date.now(); fetchChat(); }
  }, POLL_ACTIVE_MS);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && active) fetchChat(); });
  if (customer()) { lastIdlePoll = Date.now(); fetchChat(); }

  window.AlohaSaleChat = { open, close, embed, pause, unembed, send, handoff, summaryText, unread, isEmbedded: () => embedded };

  // Tải trang thẳng vào #/chat-sale (vd vừa đăng nhập xong): router chạy trước khi file này
  // nạp nên đã để lại yêu cầu mở khung chat -> mở ở đây.
  const waiting = window.AlohaRouter && window.AlohaRouter.takePendingSaleChat ? window.AlohaRouter.takePendingSaleChat() : null;
  if (waiting !== null) open(waiting);
})(window);
