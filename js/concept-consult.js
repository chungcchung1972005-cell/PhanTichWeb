// ALOHA Baby — Module Tư vấn Concept thông minh qua Chatbot (js/concept-consult.js)
// Quy trình:
// 1. Mẹ xem album Newborn hoặc Bé lớn, bấm "Tư vấn concept" bên cạnh concept ưng ý.
// 2. Kiểm tra đăng nhập (AlohaAuth): chưa đăng nhập -> chuyển sang login.html và lưu ngữ cảnh; đã đăng nhập -> mở chat.
// 3. Chatbox hỏi 3 bước (100% bấm nút chọn, KHÔNG cho gõ tay):
//    - Bước 1: Độ tuổi (7 ngày - 5 tháng | 6 tháng - 1 tuổi | 2 tuổi - 5 tuổi)
//    - Bước 2: Giới tính (Bé trai | Bé gái)
//    - Bước 3: Cân nặng (3kg - 5kg | 6kg - 8kg | > 10kg)
// 4. Lọc danh sách concept hợp lệ theo ma trận dữ liệu chính thức từ studio.
// 5. Kiểm tra concept mẹ bấm ban đầu có phù hợp không; thông báo và hiển thị danh sách concept gợi ý trực quan.
(function (window, document) {
  'use strict';

  // -------------------------------------------------------------------------
  // DỮ LIỆU PHÂN LOẠI CONCEPT CHÍNH THỨC (STUDIO ALOHA BABY)
  // -------------------------------------------------------------------------
  const CONSULT_DATA = {
    'nb_stage_1': {
      label: '7 ngày - 5 tháng',
      serviceSlug: 'newborn',
      serviceName: 'Newborn',
      groupName: 'Newborn (7 ngày – 5 tháng)',
      common: [
        'Coca baby', 'Concept ngựa nhỏ 2', 'Happy dream 2', 'Merry christmas 2',
        'Concept trung thu', 'Concept ngựa nhỏ', 'Harry potter'
      ],
      girlOnly: [
        'Concept ngựa pony', 'Concept hoa nhỏ', 'Concept quả chanh vàng', 'Labubu concept'
      ],
      boyOnly: [
        'Concept 2/9', 'Harvard concept'
      ]
    },
    'nb_stage_2': {
      label: '6 tháng - 1 tuổi',
      serviceSlug: 'newborn',
      serviceName: 'Newborn',
      groupName: 'Newborn (6 tháng – 1 tuổi)',
      common: [
        'Tết 2', 'Concept trung thu 2', 'Concept cừu nhỏ', 'Merry Christmas 1', 'Cam cam baby'
      ],
      girlOnly: [
        'Hello kitty', 'Concept giấc mơ', 'Nàng tiên xanh', 'Concept tím mộng mơ',
        'Concept cà chua', 'Khu vườn thần bí', 'Concept ngựa Pony 2'
      ],
      boyOnly: []
    },
    'be_lon': {
      label: '2 tuổi - 5 tuổi',
      serviceSlug: 'be-lon',
      serviceName: 'Bé lớn',
      groupName: 'Bé lớn (2 – 5 tuổi)',
      common: [
        'Merry christmas 3', 'Tết', 'Chú ong nhỏ', 'Bé cá concept', 'Tết độc lập',
        'Nông trại vui vẻ', 'Harry potter 2', 'Halloween 1', 'Harry potter',
        'Halloween 3', 'Halloween 2', 'Trung thu', 'Quả táo nhỏ', 'Giấc mơ vui vẻ'
      ],
      boyOnly: [
        'Vịt donal', 'Mặt trời nhỏ', 'Concept nhà thám hiểm', 'Basic concept',
        'Trung thu', 'Merry christmas 4', 'Chú chuột nhỏ', 'Quả táo nhỏ',
        'Little boy', 'Basic concept 3', 'Ponyo boy', 'Giấc mơ vui vẻ', 'Basic concept 2'
      ],
      girlOnly: [
        'Tết độc lập 2', 'Summer vibe 2', 'Marry christmas 2', 'Hỷ lân',
        'Concept vịt nhỏ', 'Chú ong nhỏ', 'Bạch tuyết', 'Tết độc lập', 'Summer vibe',
        'Marry christmas', 'Hanbok baby', 'Concept mùa thu', 'Blooming baby', 'Tết',
        'Nông trại vui vẻ', 'Little girl', 'Dâu tây hồng', 'Concept hoa nhí',
        'Bé cá concept', 'Summer vibe 3', 'Merry christmas 3', 'Khu vườn cổ tích',
        'Công chúa tóc mây', 'Concept bông hoa nhỏ', 'Basic concept', 'Cô phù thuỷ nhỏ'
      ]
    }
  };

  // Chuẩn hoá chuỗi để so sánh linh hoạt tên concept với dữ liệu albums
  function norm(str) {
    return String(str || '').toLowerCase()
      .replace(/harvard/g, 'havard')
      .replace(/merry/g, 'marry')
      .replace(/harry/g, 'hary')
      .replace(/2\/9/g, '2_9')
      .replace(/[^a-z0-9]/g, '');
  }

  // Tra cứu concept thực tế từ window.AlohaAlbums
  function resolveAlbumConcept(serviceSlug, conceptName, gender) {
    const list = (window.AlohaAlbums && window.AlohaAlbums.list) || [];
    const svc = list.find((s) => s.slug === serviceSlug);
    if (!svc || !svc.concepts) return null;

    const nTarget = norm(conceptName);
    // Trường hợp đặc biệt "Basic concept" ở Bé lớn có phân biệt trai/gái
    if (nTarget === 'basicconcept') {
      if (gender === 'Bé trai') {
        const found = svc.concepts.find((c) => c.slug === 'basic-concept-be-trai');
        if (found) return found;
      } else if (gender === 'Bé gái') {
        const found = svc.concepts.find((c) => c.slug === 'basic-concept-be-gai');
        if (found) return found;
      }
    }

    return svc.concepts.find((c) => {
      const cNorm = norm(c.name);
      const sNorm = norm(c.slug);
      return cNorm === nTarget || sNorm === nTarget;
    }) || null;
  }

  // Lọc danh sách concept phù hợp theo nhóm tuổi và giới tính
  function filterConcepts(stageKey, gender) {
    const group = CONSULT_DATA[stageKey];
    if (!group) return [];

    let names = [];
    if (gender === 'Bé trai') {
      names = [...group.common, ...group.boyOnly];
    } else {
      names = [...group.common, ...group.girlOnly];
    }

    // Khử trùng lặp tên
    const uniqueNames = [];
    const seen = new Set();
    names.forEach((name) => {
      const nKey = norm(name);
      if (!seen.has(nKey)) {
        seen.add(nKey);
        uniqueNames.push(name);
      }
    });

    // Ánh xạ sang đối tượng concept thực tế có ảnh
    const results = [];
    uniqueNames.forEach((name) => {
      const actual = resolveAlbumConcept(group.serviceSlug, name, gender);
      if (actual) {
        results.push({
          displayName: name,
          slug: actual.slug,
          serviceSlug: group.serviceSlug,
          name: actual.name,
          desc: actual.desc,
          count: actual.count || (actual.photos ? actual.photos.length : 0),
          cover: actual.cover || (actual.photos ? actual.photos[0] : ''),
          href: '#/album/' + group.serviceSlug + '/' + actual.slug
        });
      }
    });

    return results;
  }

  // -------------------------------------------------------------------------
  // QUẢN LÝ GIAO DIỆN CHAT TRONG QUÁ TRÌNH TƯ VẤN
  // -------------------------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const CHAT_PANEL_ID = 'chatPanel';
  const CHAT_BODY_ID = 'chatBody';
  const CHAT_INPUT_FORM_ID = 'chatInputForm';
  const PENDING_KEY = 'aloha_consult_pending';

  let currentSession = null; // { initialService, initialConcept, initialName, stageKey, gender, weight }

  // Cuộn khung chat xuống đáy
  function scrollToBottom() {
    const body = $(CHAT_BODY_ID);
    if (body) {
      requestAnimationFrame(() => {
        body.scrollTop = body.scrollHeight;
      });
    }
  }

  // Thêm tin nhắn bot
  function botReply(text, delay = 450) {
    return new Promise((resolve) => {
      const body = $(CHAT_BODY_ID);
      if (!body) return resolve();

      // Hiệu ứng typing
      const typing = document.createElement('div');
      typing.className = 'chat-msg bot chat-typing';
      typing.innerHTML = '<span></span><span></span><span></span>';
      body.appendChild(typing);
      scrollToBottom();

      setTimeout(() => {
        typing.remove();
        const msg = document.createElement('div');
        msg.className = 'chat-msg bot';
        msg.innerHTML = text.replace(/\n/g, '<br>');
        body.appendChild(msg);
        scrollToBottom();
        resolve(msg);
      }, delay);
    });
  }

  // Thêm tin nhắn người dùng (khi bấm nút chọn)
  function userReply(text) {
    const body = $(CHAT_BODY_ID);
    if (!body) return;
    const msg = document.createElement('div');
    msg.className = 'chat-msg user';
    msg.textContent = text;
    body.appendChild(msg);
    scrollToBottom();
  }

  // Thêm phân cách thông báo
  function addDivider(text) {
    const body = $(CHAT_BODY_ID);
    if (!body) return;
    const div = document.createElement('div');
    div.className = 'chat-divider';
    div.innerHTML = `<span>${text}</span>`;
    body.appendChild(div);
    scrollToBottom();
  }

  // Hiển thị các nút bấm để khách chọn (KHÔNG CHO GÕ TAY)
  function showOptionButtons(options, onPick) {
    const body = $(CHAT_BODY_ID);
    if (!body) return;

    // Xoá các cụm nút quick reply cũ nếu còn
    body.querySelectorAll('.chat-quick').forEach((el) => el.remove());

    const wrap = document.createElement('div');
    wrap.className = 'chat-quick chat-consult-options';

    options.forEach((opt) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chat-consult-btn';
      btn.textContent = opt.label || opt;
      btn.addEventListener('click', () => {
        wrap.remove();
        onPick(opt.value !== undefined ? opt.value : opt);
      });
      wrap.appendChild(btn);
    });

    body.appendChild(wrap);
    scrollToBottom();
  }

  // Khoá / Mở ô nhập tay
  function setInputLocked(locked) {
    const form = $(CHAT_INPUT_FORM_ID);
    const input = $('chatInput');
    if (!form || !input) return;

    if (locked) {
      form.style.display = 'none';
      input.disabled = true;
      input.placeholder = 'Mẹ chọn các lựa chọn bên trên nhé...';
    } else {
      form.style.display = '';
      input.disabled = false;
      input.placeholder = 'Nhập câu hỏi cho trợ lý...';
    }
  }

  // -------------------------------------------------------------------------
  // QUY TRÌNH HỘI THOẠI 3 BƯỚC NÚT BẤM
  // -------------------------------------------------------------------------

  // Bước 1: Chào hỏi & Thu thập độ tuổi
  async function step1_AskAge() {
    setInputLocked(true);
    await botReply(
      'Em chào mẹ ạ! ❤️ Aloha rất vui được đồng hành cùng mẹ lưu giữ những khoảnh khắc đáng yêu của bé.\n' +
      'Để tư vấn những concept phù hợp nhất, mẹ cho em hỏi bé nhà mình hiện tại được bao nhiêu tháng hoặc bao nhiêu tuổi rồi ạ?'
    );

    const ageOptions = [
      { label: '👶 7 ngày - 5 tháng', value: 'nb_stage_1' },
      { label: '🍼 6 tháng - 1 tuổi', value: 'nb_stage_2' },
      { label: '🧒 2 tuổi - 5 tuổi', value: 'be_lon' }
    ];

    showOptionButtons(ageOptions, (stageKey) => {
      const chosenLabel = ageOptions.find((o) => o.value === stageKey).label;
      userReply(chosenLabel);
      currentSession.stageKey = stageKey;
      step2_AskGender();
    });
  }

  // Bước 2: Thu thập giới tính
  async function step2_AskGender() {
    await botReply('Dạ, bé nhà mình là bé trai hay bé gái ạ? 🥰');

    const genderOptions = [
      { label: '👦 Bé trai', value: 'Bé trai' },
      { label: '👧 Bé gái', value: 'Bé gái' }
    ];

    showOptionButtons(genderOptions, (gender) => {
      userReply(gender);
      currentSession.gender = gender;
      step3_AskWeight();
    });
  }

  // Bước 3: Thu thập cân nặng
  async function step3_AskWeight() {
    await botReply(
      'Hiện tại bé nhà mình nặng khoảng bao nhiêu kg rồi mẹ nhỉ? ' +
      'Em xin thông tin này để Aloha nắm rõ hơn về đặc điểm của bé khi tư vấn concept ạ.'
    );

    const weightOptions = [
      { label: '⚖️ 3kg - 5kg', value: '3kg - 5kg' },
      { label: '⚖️ 6kg - 8kg', value: '6kg - 8kg' },
      { label: '⚖️ > 10kg', value: '> 10kg' }
    ];

    showOptionButtons(weightOptions, (weight) => {
      userReply(weight);
      currentSession.weight = weight;
      step4_RecommendConcepts();
    });
  }

  // Bước 4 & 5: Lọc, đối soát và hiển thị danh sách concept
  async function step4_RecommendConcepts() {
    const { stageKey, gender, initialConcept, initialName, initialService } = currentSession;
    const stageInfo = CONSULT_DATA[stageKey];
    const filteredConcepts = filterConcepts(stageKey, gender);

    // 1. Kiểm tra tính tương thích của concept mẹ đã chọn ban đầu (nếu có)
    let isMatched = false;
    let matchedItem = null;

    if (initialConcept) {
      matchedItem = filteredConcepts.find((c) =>
        norm(c.slug) === norm(initialConcept) || norm(c.name) === norm(initialName)
      );
      if (matchedItem) isMatched = true;
    }

    if (initialConcept && isMatched) {
      await botReply(
        `Dạ tuyệt vời quá! Concept **"${matchedItem.displayName}"** mẹ đang quan tâm rất phù hợp với bé nhà mình luôn ạ! ❤️\n` +
        `Ngoài ra, Aloha gửi mẹ danh sách các concept phù hợp nhất cho bé ${gender.toLowerCase()} giai đoạn **${stageInfo.label}** bên dưới để mẹ thoải mái tham khảo:`
      );
    } else if (initialConcept && !isMatched) {
      await botReply(
        `Dạ, concept **"${initialName || initialConcept}"** hiện chưa nằm trong danh sách phù hợp với độ tuổi/giới tính của bé nhà mình ạ.\n` +
        `Aloha gợi ý cho mẹ những concept khác phù hợp và xinh xắn hơn cho bé ${gender.toLowerCase()} giai đoạn **${stageInfo.label}** nhé! ❤️`
      );
    } else {
      await botReply(
        `Dạ, với độ tuổi và giới tính của bé nhà mình, Aloha có một số concept rất phù hợp để mẹ tham khảo đây ạ! ❤️\n` +
        `Mẹ có thể bấm vào từng concept bên dưới để xem hình ảnh thực tế và lựa chọn phong cách mình yêu thích nhé!`
      );
    }

    // 2. Render danh sách concept trực quan ngay trong ô chat
    renderConceptCardsInChat(filteredConcepts);
  }

  // Render danh sách card concept trong ô chat (xem trực quan, bấm chuyển trang bên trái)
  function renderConceptCardsInChat(concepts) {
    const body = $(CHAT_BODY_ID);
    if (!body) return;

    const listWrap = document.createElement('div');
    listWrap.className = 'chat-consult-list';

    const countHeader = document.createElement('div');
    countHeader.className = 'chat-consult-count';
    countHeader.innerHTML = `<span>Gợi ý <strong>${concepts.length} concept</strong> phù hợp cho bé</span>`;
    listWrap.appendChild(countHeader);

    concepts.forEach((c) => {
      const card = document.createElement('div');
      card.className = 'chat-concept-card';
      card.innerHTML = `
        <div class="chat-concept-img">
          <img src="${c.cover}" alt="${c.displayName}" loading="lazy">
        </div>
        <div class="chat-concept-info">
          <h4 class="chat-concept-title">${c.displayName}</h4>
          <span class="chat-concept-meta">${c.count} ảnh mẫu</span>
        </div>
        <div class="chat-concept-action">
          <button type="button" class="btn-chat-view-concept" title="Xem ảnh concept ${c.displayName}">
            <span>Xem ảnh</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        </div>
      `;

      // Khi mẹ bấm vào card hoặc nút xem ảnh:
      // Tự động điều hướng album bên trái tới concept đó mà KHÔNG ĐÓNG KHUNG CHAT!
      const btnView = card.querySelector('.btn-chat-view-concept');
      const triggerView = (e) => {
        if (e) e.preventDefault();
        // Cập nhật hash để view album bên trái chuyển sang đúng concept
        window.location.hash = c.href;
        // Highlight thẻ đang xem trong chat
        listWrap.querySelectorAll('.chat-concept-card').forEach((el) => el.classList.remove('active'));
        card.classList.add('active');
      };

      card.addEventListener('click', triggerView);
      if (btnView) btnView.addEventListener('click', triggerView);

      listWrap.appendChild(card);
    });

    body.appendChild(listWrap);
    scrollToBottom();

    // Hướng dẫn tiếp theo & nút kết nối Sale
    setTimeout(async () => {
      await botReply(
        'Mẹ bấm vào concept nào thì album bên trái sẽ mở toàn bộ ảnh của concept đó để mẹ xem rõ nét nhé. ' +
        'Nếu mẹ ưng ý concept nào hoặc cần tư vấn sâu hơn, mẹ có thể bấm nút bên dưới ạ! 🥰',
        300
      );

      const actionOptions = [
        { label: '💬 Nhắn tư vấn viên Sale', value: 'chat_sale' },
        { label: '📅 Đặt lịch chụp ngay', value: 'booking' },
        { label: '🔄 Tư vấn lại từ đầu', value: 'restart' }
      ];

      showOptionButtons(actionOptions, (act) => {
        if (act === 'chat_sale') {
          userReply('Aloha kết nối giúp mình với tư vấn viên Sale nhé');
          setInputLocked(false);
          if (window.AlohaChatbot && window.AlohaChatbot.openSale) {
            window.AlohaChatbot.openSale(currentSession.initialService || 'newborn');
          }
        } else if (act === 'booking') {
          userReply('Mình muốn đặt lịch chụp');
          window.location.hash = '#/dat-lich';
        } else if (act === 'restart') {
          userReply('Tư vấn lại');
          startConsultation(currentSession.initialService, null, null);
        }
      });
    }, 500);
  }

  // -------------------------------------------------------------------------
  // KHỞI ĐỘNG LUỒNG TƯ VẤN (PUBLIC API)
  // -------------------------------------------------------------------------
  function startConsultation(serviceSlug, conceptSlug, conceptName) {
    // Chỉ áp dụng cho Newborn và Bé lớn
    if (serviceSlug !== 'newborn' && serviceSlug !== 'be-lon') return;

    // 1. Kiểm tra đăng nhập
    const isLogged = window.AlohaAuth && AlohaAuth.isLoggedIn();
    if (!isLogged) {
      // Lưu lại ngữ cảnh concept mẹ đang chọn vào sessionStorage
      sessionStorage.setItem(
        PENDING_KEY,
        JSON.stringify({
          service: serviceSlug,
          concept: conceptSlug,
          name: conceptName
        })
      );
      // Chuyển sang login.html kèm param next để đăng nhập xong quay lại đúng trang
      const nextRoute = conceptSlug ? `album/${serviceSlug}/${conceptSlug}` : `album/${serviceSlug}`;
      window.location.href = `login.html?next=${encodeURIComponent(nextRoute)}`;
      return;
    }

    // 2. Mẹ đã đăng nhập -> Mở khung chat và khởi tạo phiên tư vấn
    currentSession = {
      initialService: serviceSlug,
      initialConcept: conceptSlug || null,
      initialName: conceptName || null,
      stageKey: null,
      gender: null,
      weight: null
    };

    if (window.AlohaChatbot && window.AlohaChatbot.open) {
      window.AlohaChatbot.open();
    } else {
      const panel = $(CHAT_PANEL_ID);
      if (panel) {
        panel.classList.add('open');
        panel.setAttribute('aria-hidden', 'false');
      }
    }

    const sub = $('chatSubtitle');
    if (sub) sub.textContent = 'Tư vấn Concept';

    // Thêm đường kẻ phân đoạn mới
    const conceptTag = conceptName ? `concept "${conceptName}"` : 'concept';
    addDivider(`Tư vấn ${conceptTag}`);

    // Bắt đầu bước 1
    step1_AskAge();
  }

  // Tự động kiểm tra sau khi đăng nhập thành công quay lại
  function checkPendingConsultAfterLogin() {
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (window.AlohaAuth && AlohaAuth.isLoggedIn()) {
        sessionStorage.removeItem(PENDING_KEY);
        setTimeout(() => {
          startConsultation(data.service, data.concept, data.name);
        }, 500);
      }
    } catch (e) {
      // Bỏ qua lỗi parse
    }
  }

  // Khởi chạy khi DOM sẵn sàng
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkPendingConsultAfterLogin);
  } else {
    setTimeout(checkPendingConsultAfterLogin, 300);
  }

  // Export public API
  window.AlohaConceptConsult = {
    start: startConsultation,
    checkPending: checkPendingConsultAfterLogin,
    data: CONSULT_DATA,
    filterConcepts: filterConcepts
  };

})(window, document);

