// ALOHA Baby — Module Tư vấn Concept thông minh qua Chatbot (js/concept-consult.js)
// Quy trình:
// 1. Mẹ xem album Newborn hoặc Bé lớn, bấm "Tư vấn concept" bên cạnh concept ưng ý.
// 2. Kiểm tra đăng nhập (AlohaAuth): chưa đăng nhập -> chuyển sang login.html và lưu ngữ cảnh; đã đăng nhập -> mở chat.
// 3. Chatbox hỏi 3 bước (100% bấm nút chọn, KHÔNG cho gõ tay):
//    - Bước 1: Độ tuổi (7 ngày - 5 tháng | 6 tháng - 1 tuổi | 2 tuổi - 5 tuổi)
//    - Bước 2: Giới tính (Bé trai | Bé gái)
//    - Bước 3: Cân nặng (Newborn: 3kg - 5kg | 6kg - 8kg; Bé lớn có thêm: > 10kg)
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

  // Kiểm tra đăng nhập trước khi tư vấn concept: nếu chưa đăng nhập thì chuyển sang login.html
  function ensureConsultAuth(serviceSlug, conceptSlug, conceptName) {
    const isLogged = window.AlohaAuth && window.AlohaAuth.isLoggedIn();
    if (!isLogged) {
      sessionStorage.setItem(
        PENDING_KEY,
        JSON.stringify({
          service: serviceSlug || 'newborn',
          concept: conceptSlug || null,
          name: conceptName || null
        })
      );
      const nextRoute = conceptSlug ? `album/${serviceSlug || 'newborn'}/${conceptSlug}` : `album/${serviceSlug || 'newborn'}`;
      window.location.href = `login.html?next=${encodeURIComponent(nextRoute)}`;
      return false;
    }
    return true;
  }

  let currentSession = null; // { initialService, initialConcept, initialName, stageKey, gender, weight }

  // Ghi nhận thống kê concept được khách hàng quan tâm / tư vấn
  function recordConceptInterest(conceptName, serviceSlug) {
    if (!conceptName) return;
    try {
      const KEY = 'aloha_concept_stats';
      const raw = localStorage.getItem(KEY);
      const stats = raw ? JSON.parse(raw) : {};
      const normKey = conceptName.trim();
      const svcMap = { 'newborn': 'Newborn', 'be-lon': 'Bé lớn', 'bau': 'Bầu', 'gia-dinh': 'Gia đình', 'sinh-nhat': 'Sinh nhật' };
      const displaySvc = svcMap[serviceSlug] || serviceSlug || 'Newborn';
      if (!stats[normKey]) {
        stats[normKey] = { name: normKey, service: displaySvc, count: 0, lastAt: Date.now() };
      }
      stats[normKey].count = (stats[normKey].count || 0) + 1;
      stats[normKey].lastAt = Date.now();
      localStorage.setItem(KEY, JSON.stringify(stats));
      window.dispatchEvent(new CustomEvent('aloha:concept-stat-updated', { detail: stats }));
    } catch (e) {}
  }

  // Cuộn khung chat xuống đáy
  function scrollToBottom() {
    const body = $(CHAT_BODY_ID);
    if (body) {
      requestAnimationFrame(() => {
        body.scrollTop = body.scrollHeight;
      });
    }
  }

  function getAiTarget() {
    let target = document.getElementById('chatAiView');
    if (!target) {
      const body = $(CHAT_BODY_ID);
      if (body) {
        target = document.createElement('div');
        target.className = 'chat-ai-view';
        target.id = 'chatAiView';
        body.prepend(target);
      }
    }
    return target || $(CHAT_BODY_ID);
  }

  // Thêm tin nhắn bot
  function botReply(text, delay = 450) {
    return new Promise((resolve) => {
      const body = getAiTarget();
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
    const body = getAiTarget();
    if (!body) return;
    const msg = document.createElement('div');
    msg.className = 'chat-msg user';
    msg.textContent = text;
    body.appendChild(msg);
    scrollToBottom();
  }

  // Thêm phân cách thông báo
  function addDivider(text) {
    const body = getAiTarget();
    if (!body) return;
    const div = document.createElement('div');
    div.className = 'chat-divider';
    div.innerHTML = `<span>${text}</span>`;
    body.appendChild(div);
    scrollToBottom();
  }

  // Hiển thị các nút bấm để khách chọn (KHÔNG CHO GÕ TAY)
  function showOptionButtons(options, onPick) {
    const body = getAiTarget();
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

    const serviceSlug = (currentSession && currentSession.initialService) ||
      (window.location.hash.includes('be-lon') ? 'be-lon' : 'newborn');
    const isBeLon = serviceSlug === 'be-lon';

    const weightOptions = [
      { label: '⚖️ 3kg - 5kg', value: '3kg - 5kg' },
      { label: '⚖️ 6kg - 8kg', value: '6kg - 8kg' }
    ];

    if (isBeLon) {
      weightOptions.push({ label: '⚖️ > 10kg', value: '> 10kg' });
    }

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

    // Lưu thông tin bé và concept tư vấn vào Journey để tự động chuyển sang Sale
    if (window.AlohaJourney && currentSession) {
      window.AlohaJourney.add('lead', {
        service: initialService || 'newborn',
        gender: gender || '',
        age: (stageInfo && stageInfo.label) || stageKey || '',
        weight: currentSession.weight || '',
        concept: initialName || initialConcept || '',
        note: ''
      });
    }
    if (initialName || initialConcept) {
      recordConceptInterest(initialName || initialConcept, initialService);
    }

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
      renderConceptCardsInChat(filteredConcepts);
    } else if (initialConcept && !isMatched) {
      // 1. Áp dụng bộ lọc và điều hướng màn hình bên trái sang danh sách concept phù hợp cho bé
      if (window.AlohaAlbums && window.AlohaAlbums.applyConsultFilter) {
        window.AlohaAlbums.applyConsultFilter({
          serviceSlug: stageInfo.serviceSlug,
          stageLabel: stageInfo.label,
          gender: gender,
          concepts: filteredConcepts
        });
      }

      const targetHash = `#/album/${stageInfo.serviceSlug}`;
      if (window.location.hash !== targetHash) {
        window.location.hash = targetHash;
      } else if (window.AlohaAlbums) {
        window.AlohaAlbums.render(stageInfo.serviceSlug);
      }
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });

      // 2. Bot gửi tin nhắn thông báo concept chưa nằm trong danh sách phù hợp
      await botReply(
        `Dạ, concept **"${initialName || initialConcept}"** hiện chưa nằm trong danh sách phù hợp với độ tuổi/giới tính của bé nhà mình ạ.\n` +
        `Aloha đã lọc sẵn danh sách concept phù hợp cho bé ở màn hình bên trái để mẹ click xem nhé! ❤️`
      );

      // 3. Hiển thị 2 phương án lựa chọn trong ô chat
      const choiceOptions = [
        { label: '✨ Chọn concept phù hợp cho bé', value: 'pick_suitable' },
        { label: `💬 Vẫn muốn chụp concept "${initialName || initialConcept}"`, value: 'keep_concept' },
        { label: '🔄 Chọn lại thông tin bé', value: 'restart_info' }
      ];

      showOptionButtons(choiceOptions, async (choice) => {
        if (choice === 'pick_suitable') {
          userReply('✨ Mình muốn xem các concept phù hợp cho bé');
          await botReply(
            `Dạ tuyệt vời ạ! Mẹ có thể bấm vào từng ô concept ở màn hình bên trái để xem trọn bộ ảnh to rõ nét, hoặc xem nhanh danh sách gợi ý dưới đây nhé: 🥰`
          );
          renderConceptCardsInChat(filteredConcepts);
        } else if (choice === 'keep_concept') {
          userReply(`💬 Mình vẫn muốn chụp concept "${initialName || initialConcept}"`);
          await botReply(
            `Dạ mẹ yên tâm nhé! Em đã ghi nhận thông tin của bé và concept **"${initialName || initialConcept}"** mẹ đang quan tâm để chuyển sang Tư vấn viên Sale. Bạn Sale sẽ liên hệ hỗ trợ mẹ xem xét linh động điều chỉnh trang phục/bối cảnh cho bé ạ! ❤️`
          );
          setTimeout(() => {
            setInputLocked(false);
            if (window.AlohaChatbot && window.AlohaChatbot.openSale) {
              window.AlohaChatbot.openSale(
                stageInfo.serviceSlug,
                `Khách muốn chụp concept "${initialName || initialConcept}" cho bé ${gender.toLowerCase()} (${stageInfo.label}, ${currentSession.weight || ''})`
              );
            } else if (window.AlohaSaleChat) {
              window.AlohaSaleChat.open(`Concept ${initialName || initialConcept} (${stageInfo.label})`);
            }
          }, 800);
        } else if (choice === 'restart_info') {
          userReply('🔄 Chọn lại thông tin bé');
          step1_AskAge();
        }
      });
    } else {
      await botReply(
        `Dạ, với độ tuổi và giới tính của bé nhà mình, Aloha có một số concept rất phù hợp để mẹ tham khảo đây ạ! ❤️\n` +
        `Mẹ có thể bấm vào từng concept bên dưới để xem hình ảnh thực tế và lựa chọn phong cách mình yêu thích nhé!`
      );
      renderConceptCardsInChat(filteredConcepts);
    }
  }

  // Render danh sách card concept trong ô chat (xem trực quan, bấm chuyển trang bên trái)
  function renderConceptCardsInChat(concepts) {
    const body = getAiTarget();
    if (!body) return;

    const listWrap = document.createElement('div');
    listWrap.className = 'chat-consult-list';

    const isBau = currentSession && currentSession.initialService === 'bau';
    const forLabel = isBau ? 'cho mẹ bầu' : 'cho bé';
    const salutation = isBau ? 'bạn' : 'mẹ';

    const countHeader = document.createElement('div');
    countHeader.className = 'chat-consult-count';
    countHeader.innerHTML = `<span>Gợi ý <strong>${concepts.length} concept</strong> phù hợp ${forLabel}</span>`;
    listWrap.appendChild(countHeader);

    concepts.forEach((c) => {
      const card = document.createElement('div');
      card.className = 'chat-concept-card';
      card.dataset.slug = c.slug;
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
        if (currentSession) {
          currentSession.selectedConcept = c.slug;
          currentSession.selectedName = c.displayName;
        }
      };

      card.addEventListener('click', triggerView);
      if (btnView) btnView.addEventListener('click', triggerView);

      listWrap.appendChild(card);
    });

    body.appendChild(listWrap);
    scrollToBottom();

    // Hướng dẫn tiếp theo & nút kết nối Sale
    setTimeout(async () => {
      const isBau = currentSession && currentSession.initialService === 'bau';
      const isGiaDinh = currentSession && currentSession.initialService === 'gia-dinh';
      const isStyleConsult = isBau || isGiaDinh;
      const salutation = isStyleConsult ? 'bạn' : 'mẹ';
      await botReply(
        `${isStyleConsult ? 'Bạn' : 'Mẹ'} bấm vào concept nào thì album bên trái sẽ mở toàn bộ ảnh của concept đó để xem rõ nét nhé. ` +
        `Nếu ${salutation} ưng ý concept nào hoặc cần tư vấn sâu hơn, ${salutation} có thể bấm nút bên dưới ạ! 🥰`,
        300
      );

      const selectedConceptSlug = currentSession ? (currentSession.selectedConcept || currentSession.initialConcept) : null;
      const selectedConceptName = currentSession ? (currentSession.selectedName || currentSession.initialName) : null;

      const actionOptions = isStyleConsult
        ? [
            ...(selectedConceptSlug ? [{ label: '👁️ Xem chi tiết concept', value: 'view_detail' }] : []),
            { label: '💬 Chat trực tiếp với Sale', value: 'chat_sale' },
            { label: '🔄 Tư vấn lại từ đầu', value: 'restart_all' }
          ]
        : [
            ...(selectedConceptSlug ? [{ label: '👁️ Xem chi tiết concept', value: 'view_detail' }] : []),
            { label: '💬 Nhắn tư vấn viên Sale', value: 'chat_sale' },
            { label: '📅 Đặt lịch chụp ngay', value: 'booking' },
            { label: '🔄 Tư vấn lại từ đầu', value: 'restart' }
          ];

      const handleActionChoice = async (act) => {
        if (act === 'view_detail') {
          userReply('👁️ Xem chi tiết concept');
          const serviceSlug = isBau ? 'bau' : (isGiaDinh ? 'gia-dinh' : (currentSession.initialService || 'newborn'));
          const targetSlug = selectedConceptSlug;
          const targetName = selectedConceptName || 'đã chọn';
          const targetRoute = `album/${serviceSlug}/${targetSlug}`;
          const targetHash = `#/album/${serviceSlug}/${targetSlug}`;

          if (window.AlohaRouter && window.AlohaRouter.navigateTo) {
            window.AlohaRouter.navigateTo(targetRoute);
          }
          if (window.location.hash !== targetHash) {
            window.location.hash = targetHash;
          } else if (window.AlohaAlbums) {
            window.AlohaAlbums.render(`${serviceSlug}/${targetSlug}`);
          }
          window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

          await botReply(
            `Dạ, Aloha đang mở toàn bộ ảnh mẫu của concept **"${targetName}"** ở màn hình bên trái để ${salutation} xem chi tiết rõ nét nhé! ❤️`
          );

          const afterDetailOptions = isStyleConsult
            ? [
                { label: '💬 Chat trực tiếp với Sale', value: 'chat_sale' },
                { label: '🔄 Tư vấn lại từ đầu', value: 'restart_all' }
              ]
            : [
                { label: '💬 Nhắn tư vấn viên Sale', value: 'chat_sale' },
                { label: '📅 Đặt lịch chụp ngay', value: 'booking' },
                { label: '🔄 Tư vấn lại từ đầu', value: 'restart' }
              ];
          showOptionButtons(afterDetailOptions, (nextAct) => handleActionChoice(nextAct));
        } else if (act === 'chat_sale') {
          userReply(isStyleConsult ? '💬 Mình muốn chat trực tiếp với Sale' : '💬 Nhắn tư vấn viên Sale');
          setInputLocked(false);
          const topicDesc = isBau ? 'bau' : (isGiaDinh ? 'gia-dinh' : (currentSession.initialService || 'newborn'));
          const serviceTitle = isBau ? 'Bầu' : (isGiaDinh ? 'Gia đình' : '');
          const chosenConcept = selectedConceptName || (currentSession && (currentSession.initialName || currentSession.initialConcept)) || '';

          if (window.AlohaJourney) {
            window.AlohaJourney.add('lead', {
              service: topicDesc,
              gender: currentSession ? (currentSession.gender || '') : '',
              age: currentSession ? (currentSession.stageKey || '') : '',
              weight: currentSession ? (currentSession.weight || '') : '',
              concept: chosenConcept,
              note: ''
            });
          }
          if (chosenConcept) {
            recordConceptInterest(chosenConcept, topicDesc);
          }

          if (window.AlohaChatbot && window.AlohaChatbot.openSale) {
            window.AlohaChatbot.openSale(topicDesc);
          }
          if (isStyleConsult && window.AlohaSaleChat && window.AlohaSaleChat.send) {
            window.AlohaSaleChat.send(selectedConceptName ? `Mình đang quan tâm concept "${selectedConceptName}" chụp ảnh ${serviceTitle}, tư vấn chi tiết giúp mình với ạ!` : `Mình đang quan tâm concept chụp ảnh ${serviceTitle}, tư vấn chi tiết giúp mình với ạ!`);
          }
        } else if (act === 'booking') {
          userReply('Mình muốn đặt lịch chụp');
          window.location.hash = '#/dat-lich';
        } else if (act === 'restart_all') {
          userReply('🔄 Tư vấn lại từ đầu');
          const currentSvc = isBau ? 'bau' : (isGiaDinh ? 'gia-dinh' : 'bau');
          if (window.AlohaAlbums && window.AlohaAlbums.clearConsultFilter) {
            window.AlohaAlbums.clearConsultFilter();
          }
          if (window.AlohaRouter && window.AlohaRouter.navigateTo) {
            window.AlohaRouter.navigateTo(`album/${currentSvc}`);
          }
          if (window.location.hash !== `#/album/${currentSvc}`) {
            window.location.hash = `#/album/${currentSvc}`;
          } else if (window.AlohaAlbums) {
            window.AlohaAlbums.render(currentSvc);
          }
          window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
          if (isBau) {
            startBauConsultation(null, null, false);
          } else if (isGiaDinh) {
            startGiaDinhConsultation(null, null, false);
          }
        } else if (act === 'restart') {
          userReply('Tư vấn lại');
          startConsultation(currentSession.initialService, null, null);
        }
      };

      showOptionButtons(actionOptions, handleActionChoice);
    }, 500);
  }

  // -------------------------------------------------------------------------
  // LUỒNG TƯ VẤN CONCEPT BẦU (PHONG CÁCH ẤM ÁP / MÁT MẺ)
  // -------------------------------------------------------------------------
  const BAU_AM_AP_NAMES = [
    'Basic concept 1',
    'Gấu bông',
    'Khu vườn bí mật',
    'Mùa thu 1',
    'Khúc giao mùa',
    'Thanh âm',
    'Điệp vũ hoa gian'
  ];

  function getBauConceptsByStyle(styleKey) {
    const list = (window.AlohaAlbums && window.AlohaAlbums.list) || [];
    const bauService = list.find((s) => s.slug === 'bau');
    if (!bauService || !bauService.concepts) return [];

    const isAmAp = styleKey === 'am_ap';
    const amApNorms = new Set(BAU_AM_AP_NAMES.map(norm));

    return bauService.concepts
      .filter((c) => {
        const inAmAp = amApNorms.has(norm(c.name)) || amApNorms.has(norm(c.slug));
        return isAmAp ? inAmAp : !inAmAp;
      })
      .map((c) => ({
        displayName: c.name,
        slug: c.slug,
        serviceSlug: 'bau',
        name: c.name,
        desc: c.desc,
        count: (c.photos ? c.photos.length : 0),
        cover: (c.photos && c.photos[0]) || '',
        href: '#/album/bau/' + c.slug
      }));
  }

  async function startBauConsultation(conceptSlug, conceptName, skipGreeting = false) {
    if (!ensureConsultAuth('bau', conceptSlug, conceptName)) return;
    // 1. Dọn dẹp quick reply cũ và các tin nhắn chào chung cũ trong ô chat
    const body = getAiTarget();
    if (body) {
      body.querySelectorAll('.chat-quick').forEach((el) => el.remove());
      body.querySelectorAll('.chat-msg.bot').forEach((m) => {
        if (m.textContent.includes('Bạn đang quan tâm concept Bầu') || m.textContent.includes('ALOHA Baby gửi mình các concept chụp ảnh Bầu')) {
          m.remove();
        }
      });
    }

    // 2. Mở khung chat nếu chưa mở
    if (window.AlohaChatbot && window.AlohaChatbot.backToAi) {
      window.AlohaChatbot.backToAi();
    }
    if (window.AlohaChatbot && window.AlohaChatbot.open) {
      window.AlohaChatbot.open(true);
    } else {
      const panel = $(CHAT_PANEL_ID);
      if (panel) {
        panel.classList.add('open');
        panel.setAttribute('aria-hidden', 'false');
      }
    }

    const sub = $('chatSubtitle');
    if (sub) sub.textContent = 'Tư vấn Concept';

    // 3. Đảm bảo hiển thị màn hình album Bầu bên trái với ĐẦY ĐỦ TẤT CẢ concept trước
    if (window.AlohaAlbums && window.AlohaAlbums.clearConsultFilter) {
      window.AlohaAlbums.clearConsultFilter();
    }
    if (window.location.hash !== '#/album/bau') {
      window.location.hash = '#/album/bau';
    }
    if (window.AlohaRouter && window.AlohaRouter.showView) {
      window.AlohaRouter.showView('album/bau');
    } else if (window.AlohaAlbums) {
      window.AlohaAlbums.render('bau');
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

    currentSession = {
      initialService: 'bau',
      initialConcept: conceptSlug || null,
      initialName: conceptName || null,
      stageKey: 'bau',
      gender: 'Mẹ bầu',
      weight: null
    };

    if (conceptName || conceptSlug) {
      recordConceptInterest(conceptName || conceptSlug, 'bau');
    }

    setInputLocked(true);

    if (!skipGreeting) {
      await botReply('Aloha xin chào! Bạn đang quan tâm concept Bầu, dạ không biết mình đang quan tâm phong cách nào ạ .');
    }

    // Khách có 2 lựa chọn: Ấm áp / Mát mẻ
    const styleOptions = [
      { label: '🌸 Ấm áp', value: 'am_ap', name: 'Ấm áp' },
      { label: '🌿 Mát mẻ', value: 'mat_me', name: 'Mát mẻ' }
    ];

    showOptionButtons(styleOptions, async (styleKey) => {
      const selected = styleOptions.find((o) => o.value === styleKey) || styleOptions[0];
      userReply(selected.name);

      const targetConcepts = getBauConceptsByStyle(styleKey);

      // 1. Lọc và điều hướng bên trái qua các concept tương ứng
      if (window.AlohaAlbums && window.AlohaAlbums.applyConsultFilter) {
        window.AlohaAlbums.applyConsultFilter({
          serviceSlug: 'bau',
          styleName: selected.name,
          stageLabel: selected.name,
          gender: 'Mẹ bầu',
          concepts: targetConcepts
        });
      }

      if (window.location.hash !== '#/album/bau') {
        window.location.hash = '#/album/bau';
      } else if (window.AlohaAlbums) {
        window.AlohaAlbums.render('bau');
      }
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });

      // 2. Bot phản hồi trong ô chat đúng mẫu yêu cầu:
      // "Dạ Aloha gửi bạn các concept phù hợp với phong cách [khách đã chọn] bên trái, bạn có thể tham khảo ạ!"
      await botReply(
        `Dạ Aloha gửi bạn các concept phù hợp với phong cách ${selected.name} bên trái, bạn có thể tham khảo ạ! ❤️`
      );

      // 3. Render danh sách card concept trong ô chat để xem nhanh
      renderConceptCardsInChat(targetConcepts);
    });
  }

  // -------------------------------------------------------------------------
  // LUỒNG TƯ VẤN KHI KHÁCH BẤM TRỰC TIẾP VÀO 1 CONCEPT BẦU CỤ THỂ BÊN TRÁI
  // -------------------------------------------------------------------------
  async function startBauDirectConceptConsult(conceptSlug, conceptName) {
    if (!ensureConsultAuth('bau', conceptSlug, conceptName)) return;
    // 1. Dọn dẹp quick reply cũ và các tin nhắn chào chung cũ trong ô chat
    const body = getAiTarget();
    if (body) {
      body.querySelectorAll('.chat-quick').forEach((el) => el.remove());
      body.querySelectorAll('.chat-msg.bot').forEach((m) => {
        if (m.textContent.includes('Bạn đang quan tâm concept Bầu') || m.textContent.includes('ALOHA Baby gửi mình các concept chụp ảnh Bầu')) {
          m.remove();
        }
      });
    }

    // 2. Mở khung chat nếu đang đóng
    if (window.AlohaChatbot && window.AlohaChatbot.backToAi) {
      window.AlohaChatbot.backToAi();
    }
    if (window.AlohaChatbot && window.AlohaChatbot.open) {
      window.AlohaChatbot.open(true);
    } else {
      const panel = $(CHAT_PANEL_ID);
      if (panel) {
        panel.classList.add('open');
        panel.setAttribute('aria-hidden', 'false');
      }
    }

    const sub = $('chatSubtitle');
    if (sub) sub.textContent = 'Tư vấn Concept';

    currentSession = {
      initialService: 'bau',
      initialConcept: conceptSlug || null,
      initialName: conceptName || null,
      stageKey: 'bau',
      gender: 'Mẹ bầu',
      weight: null
    };

    if (conceptName || conceptSlug) {
      recordConceptInterest(conceptName || conceptSlug, 'bau');
    }

    setInputLocked(true);

    // Chuẩn hoá tìm concept trong danh sách album Bầu nếu có
    let targetConcept = null;
    if (window.AlohaAlbums && window.AlohaAlbums.list) {
      const bauAlbum = window.AlohaAlbums.list.find((s) => s.slug === 'bau');
      if (bauAlbum && bauAlbum.concepts) {
        if (conceptSlug) {
          targetConcept = bauAlbum.concepts.find((c) => c.slug === conceptSlug);
        }
        if (!targetConcept && conceptName) {
          const norm = String(conceptName).toLowerCase().replace(/[^a-z0-9]/g, '');
          targetConcept = bauAlbum.concepts.find((c) => String(c.name).toLowerCase().replace(/[^a-z0-9]/g, '') === norm);
        }
      }
    }
    const finalSlug = targetConcept ? targetConcept.slug : (conceptSlug || '');
    const displayName = (targetConcept && targetConcept.name) || conceptName || conceptSlug || 'Bầu';

    // Hỏi trực tiếp về concept khách vừa bấm bên trái
    await botReply(
      `Dạ, bạn đang quan tâm concept **"${displayName}"** chụp ảnh Bầu đúng không ạ? ❤️\n` +
      `Aloha có thể kết nối bạn chat trực tiếp với tư vấn viên Sale để được tư vấn chi tiết về trang phục, bối cảnh và gói chụp này nhé!`
    );

    const handleConnectSale = async () => {
      userReply('💬 Mình muốn chat trực tiếp với Sale');
      await botReply(`Dạ em chuyển tiếp thông tin concept **"${displayName}"** và kết nối bạn với tư vấn viên Sale ngay nhé! ❤️`);
      setTimeout(() => {
        setInputLocked(false);
        if (window.AlohaChatbot && window.AlohaChatbot.openSale) {
          window.AlohaChatbot.openSale('bau');
        }
        if (window.AlohaSaleChat && window.AlohaSaleChat.send) {
          window.AlohaSaleChat.send(`Mình đang quan tâm concept "${displayName}" chụp ảnh Bầu, tư vấn chi tiết giúp mình với ạ!`);
        }
      }, 600);
    };

    const handleRestartAll = () => {
      userReply('🔄 Tư vấn lại từ đầu');
      if (window.AlohaAlbums && window.AlohaAlbums.clearConsultFilter) {
        window.AlohaAlbums.clearConsultFilter();
      }
      if (window.AlohaRouter && window.AlohaRouter.navigateTo) {
        window.AlohaRouter.navigateTo('album/bau');
      }
      if (window.location.hash !== '#/album/bau') {
        window.location.hash = '#/album/bau';
      } else if (window.AlohaAlbums) {
        window.AlohaAlbums.render('bau');
      }
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });

      startBauConsultation(null, null, false);
    };

    const handleViewDetail = async () => {
      userReply('👁️ Xem chi tiết concept');

      // Đồng thời bên trái hiện đầy đủ ảnh của concept họ đã chọn
      const targetRoute = `album/bau/${finalSlug}`;
      const targetHash = `#/album/bau/${finalSlug}`;

      if (window.AlohaRouter && window.AlohaRouter.navigateTo) {
        window.AlohaRouter.navigateTo(targetRoute);
      }
      if (window.location.hash !== targetHash) {
        window.location.hash = targetHash;
      } else if (window.AlohaAlbums) {
        window.AlohaAlbums.render(`bau/${finalSlug}`);
      }
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

      await botReply(
        `Dạ, Aloha đang mở toàn bộ ảnh mẫu của concept **"${displayName}"** ở màn hình bên trái để bạn xem chi tiết rõ nét nhé! ❤️\n` +
        `Nếu bạn ưng ý concept này hoặc cần tư vấn sâu hơn về trang phục và gói chụp, bạn có thể chọn kết nối với Sale bên dưới ạ! 🥰`
      );

      const afterViewOptions = [
        { label: '💬 Chat trực tiếp với Sale', value: 'chat_sale' },
        { label: '🔄 Tư vấn lại từ đầu', value: 'restart_all' }
      ];

      showOptionButtons(afterViewOptions, (act) => {
        if (act === 'chat_sale') handleConnectSale();
        else if (act === 'restart_all') handleRestartAll();
      });
    };

    // 3 lựa chọn theo đúng nghiệp vụ: Xem chi tiết concept | Chat trực tiếp với Sale | Tư vấn lại từ đầu
    const directOptions = [
      { label: '👁️ Xem chi tiết concept', value: 'view_detail' },
      { label: '💬 Chat trực tiếp với Sale', value: 'chat_sale' },
      { label: '🔄 Tư vấn lại từ đầu', value: 'restart_all' }
    ];

    showOptionButtons(directOptions, (choice) => {
      if (choice === 'view_detail') {
        handleViewDetail();
      } else if (choice === 'chat_sale') {
        handleConnectSale();
      } else if (choice === 'restart_all') {
        handleRestartAll();
      }
    });
  }

  // -------------------------------------------------------------------------
  // LUỒNG TƯ VẤN CONCEPT GIA ĐÌNH (PHONG CÁCH ẤM ÁP / MÁT MẺ)
  // -------------------------------------------------------------------------
  const GIA_DINH_AM_AP_NAMES = [
    'Merry christmas',
    'Mẹ con ngày Tết',
    'Phú quý',
    'Tết như ý',
    'Simple love',
    'Tết đầu đời',
    'Tết đoàn viên',
    'Xuân hồng phúc',
    'Xuân kim phúc',
    'Đào xuân'
  ];

  function getGiaDinhConceptsByStyle(styleKey) {
    const list = (window.AlohaAlbums && window.AlohaAlbums.list) || [];
    const gdService = list.find((s) => s.slug === 'gia-dinh');
    if (!gdService || !gdService.concepts) return [];

    const isAmAp = styleKey === 'am_ap';
    const amApNorms = new Set(GIA_DINH_AM_AP_NAMES.map(norm));

    return gdService.concepts
      .filter((c) => {
        const inAmAp = amApNorms.has(norm(c.name)) || amApNorms.has(norm(c.slug));
        return isAmAp ? inAmAp : !inAmAp;
      })
      .map((c) => ({
        displayName: c.name,
        slug: c.slug,
        serviceSlug: 'gia-dinh',
        name: c.name,
        desc: c.desc,
        count: (c.photos ? c.photos.length : 0),
        cover: (c.photos && c.photos[0]) || '',
        href: '#/album/gia-dinh/' + c.slug
      }));
  }

  async function startGiaDinhConsultation(conceptSlug, conceptName, skipGreeting = false) {
    if (!ensureConsultAuth('gia-dinh', conceptSlug, conceptName)) return;
    // 1. Dọn dẹp quick reply cũ và các tin nhắn chào chung cũ trong ô chat
    const body = getAiTarget();
    if (body) {
      body.querySelectorAll('.chat-quick').forEach((el) => el.remove());
      body.querySelectorAll('.chat-msg.bot').forEach((m) => {
        if (m.textContent.includes('Bạn đang quan tâm concept Gia đình') || m.textContent.includes('ALOHA Baby gửi mình các concept chụp ảnh Gia đình')) {
          m.remove();
        }
      });
    }

    // 2. Mở khung chat nếu chưa mở
    if (window.AlohaChatbot && window.AlohaChatbot.backToAi) {
      window.AlohaChatbot.backToAi();
    }
    if (window.AlohaChatbot && window.AlohaChatbot.open) {
      window.AlohaChatbot.open(true);
    } else {
      const panel = $(CHAT_PANEL_ID);
      if (panel) {
        panel.classList.add('open');
        panel.setAttribute('aria-hidden', 'false');
      }
    }

    const sub = $('chatSubtitle');
    if (sub) sub.textContent = 'Tư vấn Concept';

    // 3. Đảm bảo hiển thị màn hình album Gia đình bên trái với ĐẦY ĐỦ TẤT CẢ concept trước
    if (window.AlohaAlbums && window.AlohaAlbums.clearConsultFilter) {
      window.AlohaAlbums.clearConsultFilter();
    }
    if (window.location.hash !== '#/album/gia-dinh') {
      window.location.hash = '#/album/gia-dinh';
    }
    if (window.AlohaRouter && window.AlohaRouter.showView) {
      window.AlohaRouter.showView('album/gia-dinh');
    } else if (window.AlohaAlbums) {
      window.AlohaAlbums.render('gia-dinh');
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

    currentSession = {
      initialService: 'gia-dinh',
      initialConcept: conceptSlug || null,
      initialName: conceptName || null,
      stageKey: 'gia-dinh',
      gender: 'Gia đình',
      weight: null
    };

    if (conceptName || conceptSlug) {
      recordConceptInterest(conceptName || conceptSlug, 'gia-dinh');
    }

    setInputLocked(true);

    if (!skipGreeting) {
      await botReply('Aloha xin chào! Bạn đang quan tâm concept Gia đình, dạ không biết mình đang quan tâm phong cách nào ạ .');
    }

    // Khách có 2 lựa chọn: Ấm áp / Mát mẻ
    const styleOptions = [
      { label: '🌸 Ấm áp', value: 'am_ap', name: 'Ấm áp' },
      { label: '🌿 Mát mẻ', value: 'mat_me', name: 'Mát mẻ' }
    ];

    showOptionButtons(styleOptions, async (styleKey) => {
      const selected = styleOptions.find((o) => o.value === styleKey) || styleOptions[0];
      userReply(selected.name);

      const targetConcepts = getGiaDinhConceptsByStyle(styleKey);

      // 1. Lọc và điều hướng bên trái qua các concept tương ứng
      if (window.AlohaAlbums && window.AlohaAlbums.applyConsultFilter) {
        window.AlohaAlbums.applyConsultFilter({
          serviceSlug: 'gia-dinh',
          styleName: selected.name,
          stageLabel: selected.name,
          gender: 'Gia đình',
          concepts: targetConcepts
        });
      }

      if (window.location.hash !== '#/album/gia-dinh') {
        window.location.hash = '#/album/gia-dinh';
      } else if (window.AlohaAlbums) {
        window.AlohaAlbums.render('gia-dinh');
      }
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });

      // 2. Bot phản hồi trong ô chat
      await botReply(
        `Dạ Aloha gửi bạn các concept phù hợp với phong cách ${selected.name} bên trái, bạn có thể tham khảo ạ! ❤️`
      );

      // 3. Render danh sách card concept trong ô chat để xem nhanh
      renderConceptCardsInChat(targetConcepts);
    });
  }

  // -------------------------------------------------------------------------
  // LUỒNG TƯ VẤN KHI KHÁCH BẤM TRỰC TIẾP VÀO 1 CONCEPT GIA ĐÌNH CỤ THỂ BÊN TRÁI
  // -------------------------------------------------------------------------
  async function startGiaDinhDirectConceptConsult(conceptSlug, conceptName) {
    if (!ensureConsultAuth('gia-dinh', conceptSlug, conceptName)) return;
    // 1. Dọn dẹp quick reply cũ và các tin nhắn chào chung cũ trong ô chat
    const body = getAiTarget();
    if (body) {
      body.querySelectorAll('.chat-quick').forEach((el) => el.remove());
      body.querySelectorAll('.chat-msg.bot').forEach((m) => {
        if (m.textContent.includes('Bạn đang quan tâm concept Gia đình') || m.textContent.includes('ALOHA Baby gửi mình các concept chụp ảnh Gia đình')) {
          m.remove();
        }
      });
    }

    // 2. Mở khung chat nếu đang đóng
    if (window.AlohaChatbot && window.AlohaChatbot.backToAi) {
      window.AlohaChatbot.backToAi();
    }
    if (window.AlohaChatbot && window.AlohaChatbot.open) {
      window.AlohaChatbot.open(true);
    } else {
      const panel = $(CHAT_PANEL_ID);
      if (panel) {
        panel.classList.add('open');
        panel.setAttribute('aria-hidden', 'false');
      }
    }

    const sub = $('chatSubtitle');
    if (sub) sub.textContent = 'Tư vấn Concept';

    currentSession = {
      initialService: 'gia-dinh',
      initialConcept: conceptSlug || null,
      initialName: conceptName || null,
      stageKey: 'gia-dinh',
      gender: 'Gia đình',
      weight: null
    };

    if (conceptName || conceptSlug) {
      recordConceptInterest(conceptName || conceptSlug, 'gia-dinh');
    }

    setInputLocked(true);

    // Chuẩn hoá tìm concept trong danh sách album Gia đình nếu có
    let targetConcept = null;
    if (window.AlohaAlbums && window.AlohaAlbums.list) {
      const gdAlbum = window.AlohaAlbums.list.find((s) => s.slug === 'gia-dinh');
      if (gdAlbum && gdAlbum.concepts) {
        if (conceptSlug) {
          targetConcept = gdAlbum.concepts.find((c) => c.slug === conceptSlug);
        }
        if (!targetConcept && conceptName) {
          const n = norm(conceptName);
          targetConcept = gdAlbum.concepts.find((c) => norm(c.name) === n);
        }
      }
    }
    const finalSlug = targetConcept ? targetConcept.slug : (conceptSlug || '');
    const displayName = (targetConcept && targetConcept.name) || conceptName || conceptSlug || 'Gia đình';

    // Hỏi trực tiếp về concept khách vừa bấm bên trái
    await botReply(
      `Dạ, bạn đang quan tâm concept **"${displayName}"** chụp ảnh Gia đình đúng không ạ? ❤️\n` +
      `Aloha có thể kết nối bạn chat trực tiếp với tư vấn viên Sale để được tư vấn chi tiết về trang phục, bối cảnh và gói chụp này nhé!`
    );

    const handleConnectSale = async () => {
      userReply('💬 Mình muốn chat trực tiếp với Sale');
      await botReply(`Dạ em chuyển tiếp thông tin concept **"${displayName}"** và kết nối bạn với tư vấn viên Sale ngay nhé! ❤️`);
      setTimeout(() => {
        setInputLocked(false);
        if (window.AlohaChatbot && window.AlohaChatbot.openSale) {
          window.AlohaChatbot.openSale('gia-dinh');
        }
        if (window.AlohaSaleChat && window.AlohaSaleChat.send) {
          window.AlohaSaleChat.send(`Mình đang quan tâm concept "${displayName}" chụp ảnh Gia đình, tư vấn chi tiết giúp mình với ạ!`);
        }
      }, 600);
    };

    const handleRestartAll = () => {
      userReply('🔄 Tư vấn lại từ đầu');
      if (window.AlohaAlbums && window.AlohaAlbums.clearConsultFilter) {
        window.AlohaAlbums.clearConsultFilter();
      }
      if (window.AlohaRouter && window.AlohaRouter.navigateTo) {
        window.AlohaRouter.navigateTo('album/gia-dinh');
      }
      if (window.location.hash !== '#/album/gia-dinh') {
        window.location.hash = '#/album/gia-dinh';
      } else if (window.AlohaAlbums) {
        window.AlohaAlbums.render('gia-dinh');
      }
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });

      startGiaDinhConsultation(null, null, false);
    };

    const handleViewDetail = async () => {
      userReply('👁️ Xem chi tiết concept');

      // Đồng thời bên trái hiện đầy đủ ảnh của concept họ đã chọn
      const targetRoute = `album/gia-dinh/${finalSlug}`;
      const targetHash = `#/album/gia-dinh/${finalSlug}`;

      if (window.AlohaRouter && window.AlohaRouter.navigateTo) {
        window.AlohaRouter.navigateTo(targetRoute);
      }
      if (window.location.hash !== targetHash) {
        window.location.hash = targetHash;
      } else if (window.AlohaAlbums) {
        window.AlohaAlbums.render(`gia-dinh/${finalSlug}`);
      }
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

      await botReply(
        `Dạ, Aloha đang mở toàn bộ ảnh mẫu của concept **"${displayName}"** ở màn hình bên trái để bạn xem chi tiết rõ nét nhé! ❤️\n` +
        `Nếu bạn ưng ý concept này hoặc cần tư vấn sâu hơn về trang phục và gói chụp, bạn có thể chọn kết nối với Sale bên dưới ạ! 🥰`
      );

      const afterViewOptions = [
        { label: '💬 Chat trực tiếp với Sale', value: 'chat_sale' },
        { label: '🔄 Tư vấn lại từ đầu', value: 'restart_all' }
      ];

      showOptionButtons(afterViewOptions, (act) => {
        if (act === 'chat_sale') handleConnectSale();
        else if (act === 'restart_all') handleRestartAll();
      });
    };

    // 3 lựa chọn theo đúng nghiệp vụ: Xem chi tiết concept | Chat trực tiếp với Sale | Tư vấn lại từ đầu
    const directOptions = [
      { label: '👁️ Xem chi tiết concept', value: 'view_detail' },
      { label: '💬 Chat trực tiếp với Sale', value: 'chat_sale' },
      { label: '🔄 Tư vấn lại từ đầu', value: 'restart_all' }
    ];

    showOptionButtons(directOptions, (choice) => {
      if (choice === 'view_detail') {
        handleViewDetail();
      } else if (choice === 'chat_sale') {
        handleConnectSale();
      } else if (choice === 'restart_all') {
        handleRestartAll();
      }
    });
  }

  // -------------------------------------------------------------------------
  // KHỞI ĐỘNG LUỒNG TƯ VẤN (PUBLIC API)
  // -------------------------------------------------------------------------
  function startConsultation(serviceSlug, conceptSlug, conceptName) {
    // 1. Kiểm tra đăng nhập BẮT BUỘC cho tất cả dịch vụ/concept
    if (!ensureConsultAuth(serviceSlug, conceptSlug, conceptName)) return;

    // Luồng tư vấn riêng cho Bầu theo phong cách (Ấm áp / Mát mẻ) hoặc Chat trực tiếp với Sale
    if (serviceSlug === 'bau') {
      if (conceptSlug || conceptName) {
        startBauDirectConceptConsult(conceptSlug, conceptName);
      } else {
        startBauConsultation();
      }
      return;
    }

    // Luồng tư vấn riêng cho Gia đình theo phong cách (Ấm áp / Mát mẻ) hoặc Chat trực tiếp với Sale
    if (serviceSlug === 'gia-dinh') {
      if (conceptSlug || conceptName) {
        startGiaDinhDirectConceptConsult(conceptSlug, conceptName);
      } else {
        startGiaDinhConsultation();
      }
      return;
    }

    // Dịch vụ Sinh nhật: tạm thời mở khung chat tư vấn trong khi chờ kịch bản chi tiết
    if (serviceSlug !== 'newborn' && serviceSlug !== 'be-lon') {
      if (window.AlohaChatbot && window.AlohaChatbot.open) {
        window.AlohaChatbot.open();
      }
      return;
    }

    // 2. Mẹ đã đăng nhập -> Mở khung chat và khởi tạo phiên tư vấn
    if (window.AlohaAlbums && window.AlohaAlbums.clearConsultFilter) {
      window.AlohaAlbums.clearConsultFilter();
    }
    currentSession = {
      initialService: serviceSlug,
      initialConcept: conceptSlug || null,
      initialName: conceptName || null,
      stageKey: null,
      gender: null,
      weight: null
    };

    if (window.AlohaChatbot && window.AlohaChatbot.backToAi) {
      window.AlohaChatbot.backToAi();
    }
    if (window.AlohaChatbot && window.AlohaChatbot.open) {
      window.AlohaChatbot.open(true);
    } else {
      const panel = $(CHAT_PANEL_ID);
      if (panel) {
        panel.classList.add('open');
        panel.setAttribute('aria-hidden', 'false');
      }
    }

    // Dọn dẹp các nút bấm cũ và các tin nhắn chào chung trong ô chat
    const body = getAiTarget();
    if (body) {
      body.querySelectorAll('.chat-quick').forEach((el) => el.remove());
      body.querySelectorAll('.chat-msg.bot').forEach((m) => {
        if (m.textContent.includes('Bạn đang quan tâm concept') || m.textContent.includes('ALOHA Baby gửi mình các concept')) {
          m.remove();
        }
      });
    }

    const sub = $('chatSubtitle');
    if (sub) sub.textContent = 'Tư vấn Concept';

    // Bắt đầu bước 1: Hỏi tuổi
    step1_AskAge();
  }

  // Tự động kiểm tra sau khi đăng nhập thành công quay lại
  function checkPendingConsultAfterLogin() {
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (window.AlohaAuth && window.AlohaAuth.isLoggedIn()) {
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

  // Đồng bộ khi mẹ click xem concept trên màn hình album bên trái
  window.addEventListener('hashchange', () => {
    if (!currentSession || !currentSession.stageKey) return;
    const hash = window.location.hash || '';
    const m = hash.match(/^#\/album\/([^\/]+)\/([^\/?]+)/);
    if (!m) return;
    const conceptSlug = m[2];
    const listWrap = document.querySelector('.chat-consult-list');
    if (!listWrap) return;
    listWrap.querySelectorAll('.chat-concept-card').forEach((c) => {
      if (c.dataset && c.dataset.slug === conceptSlug) {
        c.classList.add('active');
        c.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        c.classList.remove('active');
      }
    });
  });

  // Export public API
  window.AlohaConceptConsult = {
    start: startConsultation,
    startBau: startBauConsultation,
    startBauDirect: startBauDirectConceptConsult,
    getBauConceptsByStyle: getBauConceptsByStyle,
    startGiaDinh: startGiaDinhConsultation,
    startGiaDinhDirect: startGiaDinhDirectConceptConsult,
    getGiaDinhConceptsByStyle: getGiaDinhConceptsByStyle,
    isConsulting: () => !!currentSession,
    endConsult: () => { currentSession = null; },
    checkPending: checkPendingConsultAfterLogin,
    data: CONSULT_DATA,
    filterConcepts: filterConcepts,
    recordConceptInterest: recordConceptInterest,
    getConceptStats: () => {
      try {
        const raw = localStorage.getItem('aloha_concept_stats');
        return raw ? JSON.parse(raw) : {};
      } catch (e) {
        return {};
      }
    }
  };

})(window, document);

