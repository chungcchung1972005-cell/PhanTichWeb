// ALOHA Baby — server nhỏ, 3 nhiệm vụ:
// 1. Proxy chatbot tư vấn: nhận tin nhắn từ trình duyệt, gọi Gemini API bằng
//    API key giữ ở đây (biến môi trường, không bao giờ gửi về client).
// 2. Trợ lý AI trong tab "Ảnh đã chỉnh" (/api/edit-chat) trả lời khách trước khi thợ chỉnh ảnh trả lời.
// 3. Nhận báo tiền về từ SePay (webhook) để trang "Ảnh của tôi" tự gửi yêu cầu
//    chỉnh sửa ảnh tới Thợ ảnh ngay khi khách chuyển khoản phí ảnh chọn thêm.
// 3. Chat thật Khách <-> Sale + đăng nhập kiểm tra ở server (sale-chat.js, thêm
//    2026-09-27), lưu MongoDB khi có MONGODB_URI.
// Các phần khác của site (đặt lịch, CRM...) vẫn là site tĩnh, KHÔNG đi qua đây.
//
// Chạy:
//   copy .env.example -> .env, điền GEMINI_API_KEY thật vào .env
//   npm install
//   npm start
// Server mặc định chạy ở http://localhost:3001

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const saleChat = require('./sale-chat');

const PORT = process.env.PORT || 3001;
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
// Model dự phòng, thử lần lượt khi model chính lỗi (free tier hay báo "high
// demand" 503 theo từng model, hiếm khi tất cả cùng quá tải một lúc).
const FALLBACK_MODELS = (process.env.GEMINI_FALLBACK_MODELS || 'gemini-3.5-flash-lite,gemini-3.5-flash,gemini-3.1-flash-lite,gemini-3.6-flash')
  .split(',').map(s => s.trim()).filter(Boolean);
const MODEL_CHAIN = [...new Set([MODEL, ...FALLBACK_MODELS])];
// Mỗi model chờ tối đa bấy nhiêu ms rồi chuyển sang model kế tiếp.
const MODEL_TIMEOUT_MS = 18000;
const API_KEY = process.env.GEMINI_API_KEY;
// Domain thật của frontend sau khi public, cách nhau bằng dấu phẩy (vd
// "https://ten-nguoi-dung.github.io"). Để trống thì mở cho mọi origin (chỉ
// chấp nhận được khi test local) - xem server/DEPLOY.md.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
// API key tự đặt trong trang cấu hình webhook của SePay (my.sepay.vn), SePay gửi
// kèm header "Authorization: Apikey <key>" mỗi lần báo tiền về.
const SEPAY_WEBHOOK_KEY = process.env.SEPAY_WEBHOOK_KEY;

// Dữ liệu dịch vụ/giá THAM KHẢO — khớp với SERVICE_INFO trong js/script.js
// (kịch bản quick-reply) để chatbot AI không tư vấn lệch với UI kịch bản có
// sẵn. Đây là giá/gói MINH HOẠ, chưa phải bảng giá chính thức đã duyệt — xem
// .claude/rules/tech-defaults.md mục "Cấu hình chưa xác định".
const SERVICE_INFO = {
  'Bé lớn': { concepts: 'Ngoại cảnh công viên, biển; Phong cách Hàn Quốc (hanbok); Vintage cổ điển; Áo dài truyền thống; Hoá thân nghề nghiệp (cảnh sát, lính cứu hoả...); Mùa thu lá vàng; Năng động, thể thao', note: 'phù hợp bé khoảng 2-10 tuổi, có thể chụp thêm cùng bố mẹ', price: 'từ 1.500.000đ' },
  'Sinh nhật': { concepts: 'Rực rỡ bóng bay; Giáng sinh (Noel); Pastel nhẹ nhàng (đập bánh kem); Trung thu, đèn lồng; Công chúa, hoàng tử; Tiệc cùng gia đình; Picnic ngoài trời', note: 'có thể kết hợp bánh kem, backdrop theo yêu cầu', price: 'từ 1.800.000đ' },
  'Bầu': { concepts: 'Ngoại cảnh thiên nhiên; Vintage trong studio; Tối giản, tôn dáng; Cùng chồng; Cùng bé lớn; Vòng hoa; Biển', note: 'nhiều mẹ chọn chụp khi thai khoảng 32-36 tuần, tuỳ sức khoẻ mỗi mẹ', price: 'từ 2.000.000đ' },
  'Gia đình': { concepts: 'Đồng phục tông màu; Ngoại cảnh công viên; Vintage ấm áp; Biển; Nhiều thế hệ (ông bà, bố mẹ, các cháu); Anh chị em; Dã ngoại picnic', note: 'không giới hạn số thành viên, chụp được nhiều thế hệ', price: 'từ 2.500.000đ' },
  'Newborn': { concepts: 'Cuộn ủ (wrap) cổ điển; Tự nhiên (organic); Cùng bố mẹ, anh chị; Hoa lá; Hoá thân thú ngộ nghĩnh (mũ tai thỏ, tai gấu); Đen trắng tinh tế; Trăng sao cổ tích', note: 'nhiều gia đình chọn chụp khi bé khoảng 5-14 ngày tuổi, studio giữ ấm phòng chụp phù hợp', price: 'từ 2.200.000đ' }
};

// Các đích điều hướng frontend hỗ trợ (khớp CHAT_ACTIONS trong js/script.js).
// album-<dịch vụ>: trang album ảnh mẫu của dịch vụ đó (danh sách concept, js/albums.js).
const ACTIONS = ['dat-lich', 'chon-anh', 'dich-vu', 'concept', 'album', 'gioi-thieu', 'tin-tuc', 'trang-chu',
  'album-newborn', 'album-bau', 'album-sinh-nhat', 'album-be-lon', 'album-gia-dinh'];
// Hành động AI được làm NGAY khi khách ra lệnh (trường "do", 2026-09-29): các trang trên + "sale"
// (chuyển khung chatbot sang chat trực tiếp với Sale).
const DO_ACTIONS = ['none', 'sale', ...ACTIONS];

const SYSTEM_PROMPT = `Bạn là tư vấn viên (Sale) của ALOHA Baby — studio chụp ảnh em bé và gia đình tại 35 Lê Văn Thiêm, Thanh Xuân, Hà Nội, hotline 0938.125.222. Bạn nhắn tin với khách như một bạn Sale tận tình của studio (người dùng chốt 2026-10-04).

5 dịch vụ chính, concept gợi ý và giá THAM KHẢO (luôn nói rõ đây là giá minh hoạ, Sales sẽ báo giá chính xác theo từng đơn; gói tham khảo khoảng 15 ảnh gốc được chỉnh sửa, ảnh chọn thêm ngoài gói tính phí theo ảnh):
${Object.entries(SERVICE_INFO).map(([name, info]) => `- ${name}: các concept ${info.concepts} (${info.note}), giá tham khảo ${info.price}`).join('\n')}

Ngoài 5 dịch vụ trên, studio còn nhận chụp tại nhà cho gia đình muốn không gian riêng tư quen thuộc.

Quy trình đặt lịch (5 bước): chọn dịch vụ & gói → chọn concept hoặc để studio tư vấn → chọn ngày/khung giờ còn trống (cập nhật thời gian thực) → nhập thông tin bé & xác nhận → đặt cọc giữ lịch. Sau buổi chụp, khách chọn ảnh ưng ý trong mục "Ảnh của tôi" (có thể ghi chú chỉnh sửa riêng từng ảnh), đội ngũ hậu kỳ xử lý rồi bàn giao ảnh hoàn thiện. Khách có thể đổi lịch hẹn đã đặt khi cần, điều kiện cụ thể tuỳ thời gian còn lại trước buổi chụp.

Nguyên tắc trả lời bắt buộc:
- Giọng Sale nhắn tin thật, tiếng Việt có dấu: xưng "em", gọi khách "anh/chị" (khách tự xưng mẹ/bố/ba thì gọi theo, ví dụ "mẹ bé", "chị"), mở đầu tự nhiên kiểu "Dạ...", "Dạ vâng ạ", ấm áp, quan tâm tới bé (hỏi thăm, khen nhẹ, đồng cảm với lo lắng của ba mẹ). Câu ngắn như nhắn Zalo, thường 1-3 câu, chỉ xuống dòng liệt kê khi thật cần; tối đa 1 emoji. Trả lời ĐÚNG điều khách hỏi trước, rồi kết thúc bằng 1 câu hỏi ngắn để hiểu thêm nhu cầu (bé mấy tuổi, chụp dịp gì, thích phong cách nào, dự định thời gian nào...), không hỏi lại điều khách đã nói. Không giọng máy móc, không liệt kê khô cứng.
- Không tự giới thiệu hay nhắc mình là AI, trợ lý ảo, chatbot, hệ thống tự động. Không bao giờ nói "đang bận", "lỗi", "hệ thống". Nếu khách hỏi thẳng, nghiêm túc mình là người hay máy thì KHÔNG nói dối là người thật: trả lời khéo, ấm áp rằng em là trợ lý tư vấn tự động của studio, các bạn Sale vẫn đọc tin và sẵn sàng chat trực tiếp, rồi hỏi khách có muốn em kết nối bạn Sale luôn không.
- Chỉ tư vấn trong phạm vi dịch vụ chụp ảnh của ALOHA Baby (5 dịch vụ trên, chụp tại nhà, concept, quy trình đặt lịch/đổi lịch/chọn ảnh). Nếu khách hỏi ngoài phạm vi (không liên quan chụp ảnh/studio), lịch sự từ chối và hướng về dịch vụ studio.
- KHÔNG tự chốt lịch hay nhận cọc trong khung chat.
- KHÁCH BẢO GÌ LÀM NẤY (người dùng chốt 2026-09-29): khi tin nhắn mới nhất của khách là một yêu cầu làm ngay (không phải câu hỏi thông tin) thì đặt "do" là hành động đó, hệ thống sẽ tự làm luôn, khách không phải bấm nút; câu "reply" khi đó chỉ 1 câu ngắn xác nhận đang làm (ví dụ "Dạ em kết nối anh/chị với bạn Sale ngay nhé!", "Dạ em gửi album Newborn anh/chị tham khảo nhé!"). Các trường hợp:
  + Khách muốn nói chuyện / nhắn tin / gặp / được tư vấn trực tiếp với Sale, tư vấn viên, nhân viên, người thật, "admin", "shop", muốn được gọi lại hoặc để lại số điện thoại: "do" = "sale".
  + Khách muốn đặt lịch, giữ lịch, hẹn ngày chụp, đặt cọc: "do" = "dat-lich".
  + Khách muốn thiết kế riêng 1 concept hoàn toàn mới, độc quyền, theo ý tưởng của riêng mình (không chọn trong các concept có sẵn của studio): "do" = "sale".
  + Khách đề nghị/mặc cả chiết khấu sâu, giảm giá riêng, gói combo phức tạp ngoài các gói đã có (KHÁC với việc chỉ hỏi giá tham khảo bình thường — hỏi "giá bao nhiêu", "gói giá thế nào" vẫn là "do" = "none", trả lời bằng giá tham khảo có sẵn): "do" = "sale".
  + Khách phàn nàn, khiếu nại, hoặc hỏi một vấn đề kỹ thuật/chuyên môn sâu ngoài phạm vi tư vấn thông thường: "do" = "sale".
  + Với 3 trường hợp trên (concept độc quyền riêng, mặc cả/chiết khấu sâu, khiếu nại/kỹ thuật sâu), "reply" nên theo tinh thần: "Dạ, yêu cầu này của chị khá chi tiết/đặc biệt, em kết nối chị sang gặp trực tiếp Sales bên em nhé ạ!" (viết lại tự nhiên theo đúng câu khách vừa nói, không copy y nguyên).
  + Khách bảo mở / xem / cho xem / vào 1 trang của website (album của 1 dịch vụ, ảnh của tôi, concept, tin tức, giới thiệu, trang chủ...): "do" = đúng action của trang đó (danh sách action ở phần định dạng đầu ra).
  + Còn lại (hỏi giá, hỏi quy trình, hỏi tư vấn, chào hỏi, phân vân...): "do" = "none" và trả lời bình thường; khi đó KHÔNG nói "mình đang chuyển bạn...".
  Chỉ dựa vào tin nhắn MỚI NHẤT của khách để quyết định "do", không lặp lại hành động của các lượt trước.
- KHÔNG bịa số liệu cụ thể về mức cọc, chính sách đổi/huỷ lịch, số ảnh được chỉnh sửa miễn phí — những thông số này chưa được studio chốt, chỉ nói "Sales sẽ tư vấn chi tiết khi bạn đặt lịch".

Định dạng đầu ra: JSON gồm "reply" (câu trả lời cho khách), "do" (hành động hệ thống làm ngay, xem quy tắc "khách bảo gì làm nấy"; "none" nếu không có) và "suggestions" (đúng 2 gợi ý tiếp theo khách có khả năng muốn chọn nhất sau câu trả lời vừa rồi, người dùng chốt 2026-09-28: tối đa 2 nút). Mỗi gợi ý là {"label", "action"}: "label" viết từ góc nhìn của khách, ngắn gọn dưới 50 ký tự, nằm trong phạm vi dịch vụ studio, bám sát nội dung câu trả lời vừa đưa ra, không lặp lại nhau. Nếu gợi ý tương ứng với một trang/mục của website thì đặt "action" để khách bấm vào là được chuyển thẳng tới đó, gồm: "dat-lich" (đặt lịch/hẹn chụp/đặt cọc), "chon-anh" (xem ảnh của tôi, chọn ảnh, gửi yêu cầu chỉnh sửa ảnh), "dich-vu" (danh sách dịch vụ), "concept" (thư viện concept), "album" (album ảnh đẹp), "gioi-thieu" (giới thiệu studio), "tin-tuc" (tin tức/kinh nghiệm), "trang-chu" (về trang chủ), "album-newborn" / "album-bau" / "album-sinh-nhat" / "album-be-lon" / "album-gia-dinh" (album ảnh mẫu theo concept của đúng dịch vụ đó; khi khách hỏi về concept hoặc muốn xem ảnh mẫu của 1 dịch vụ thì ưu tiên gợi ý nút này, ví dụ {"label": "Xem album Sinh nhật", "action": "album-sinh-nhat"}). Nếu chỉ là câu hỏi thêm thì "action" là "none". Khi khách thể hiện ý muốn làm việc gì mà website có trang tương ứng thì BẮT BUỘC 1 trong 2 gợi ý là nút dẫn tới đúng trang đó (ví dụ khách nhắn muốn đặt lịch thì có {"label": "Đặt lịch chụp ngay", "action": "dat-lich"}; muốn xem ảnh của mình thì có {"label": "Xem ảnh của tôi", "action": "chon-anh"}). Nếu khách chưa thể hiện ý cụ thể thì ít nhất 1 gợi ý dẫn tới trang phù hợp nhất với ngữ cảnh cuộc trò chuyện.`;

const app = express();
// Render (và mọi host chạy sau reverse proxy) chuyển tiếp qua 1 proxy nội bộ -> không bật cái
// này thì req.ip luôn là IP của proxy (giống nhau cho MỌI khách), làm sai các giới hạn theo IP
// (vd server/sale-chat.js giới hạn số lần cấp danh tính khách vãng lai). An toàn vì Render tự
// đặt đúng header X-Forwarded-For, không phải header khách tự gửi lên được.
app.set('trust proxy', true);
if (ALLOWED_ORIGINS.length) {
  app.use(cors({ origin: ALLOWED_ORIGINS }));
} else {
  app.use(cors());
  console.warn('CẢNH BÁO: chưa đặt ALLOWED_ORIGINS, CORS đang mở cho MỌI website gọi vào - chỉ chấp nhận được khi test local.');
}
app.use(express.json({ limit: '200kb' }));

// Gọi Gemini lần lượt theo MODEL_CHAIN: model nào lỗi (quá tải 503, hết hạn mức 429,
// ngừng hỗ trợ 404...), quá thời gian chờ, hoặc trả về rỗng thì chuyển sang model kế tiếp.
// Dùng chung cho /api/chat và /api/edit-chat. Trả { text, usedModel, failures }.
async function callGemini(payload) {
  let text = '';
  let usedModel = null;
  const failures = [];
  for (const model of MODEL_CHAIN) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': API_KEY },
        body: payload,
        signal: AbortSignal.timeout(MODEL_TIMEOUT_MS)
      });
      const data = await response.json();
      if (!response.ok) {
        failures.push(`${model}: ${response.status} ${(data.error && data.error.message) || ''}`.trim());
        continue;
      }
      if (data.promptFeedback && data.promptFeedback.blockReason) {
        console.error('Gemini blocked prompt:', data.promptFeedback);
      }
      const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
      text = parts.map(p => p.text || '').join('').trim();
      if (!text) {
        failures.push(`${model}: empty response`);
        continue;
      }
      usedModel = model;
      break;
    } catch (e) {
      failures.push(`${model}: ${e.name === 'TimeoutError' ? 'timeout' : e.message}`);
    }
  }
  return { text, usedModel, failures };
}

app.post('/api/chat', async (req, res) => {
  if (!API_KEY) {
    return res.status(500).json({ error: 'server_missing_api_key' });
  }

  const messages = Array.isArray(req.body.messages) ? req.body.messages : [];
  if (messages.length === 0) {
    return res.status(400).json({ error: 'empty_messages' });
  }
  // Chỉ giữ 2 trường role/content, tránh chuyển tiếp dữ liệu thừa từ client.
  const cleanMessages = messages
    .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-20)
    .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }));

  // Gemini gọi vai trò trả lời của bot là 'model', không phải 'assistant'.
  const contents = cleanMessages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  // Web đang tạm tắt Đặt lịch online (js/features.js) -> nút "dat-lich" thực ra mở chat với Sale.
  const BOOKING_OFF_NOTE = '\n\nHIỆN TẠI website TẠM TẮT đặt lịch online: khách muốn đặt/giữ lịch thì đặt "do" = "sale" (hệ thống chuyển khách sang tư vấn viên giữ lịch trực tiếp) và nói ngắn gọn là đang chuyển sang tư vấn viên; nút gợi ý tương ứng là "Nhắn Sale để đặt lịch" (action "dat-lich"). Không nhắc tới trang đặt lịch hay đặt cọc online.';
  const systemText = SYSTEM_PROMPT + (req.body.bookingOff === true ? BOOKING_OFF_NOTE : '');

  try {
    const payload = JSON.stringify({
        systemInstruction: { parts: [{ text: systemText }] },
        contents,
        generationConfig: {
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              reply: { type: 'STRING' },
              do: { type: 'STRING', enum: DO_ACTIONS },
              suggestions: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    label: { type: 'STRING' },
                    action: { type: 'STRING', enum: ['none', ...ACTIONS] }
                  },
                  required: ['label', 'action']
                }
              }
            },
            required: ['reply', 'do', 'suggestions']
          }
        }
    });

    const { text, usedModel, failures } = await callGemini(payload);
    if (failures.length) console.warn('Gemini model fallback:', failures.join(' | '));
    if (!usedModel) {
      return res.status(502).json({ error: 'upstream_error', detail: failures.join(' | ') });
    }
    let reply = text;
    let suggestions = [];
    let doAction = 'none';
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed.reply === 'string') reply = parsed.reply.trim();
      if (parsed && DO_ACTIONS.includes(parsed.do)) doAction = parsed.do;
      if (parsed && Array.isArray(parsed.suggestions)) {
        suggestions = parsed.suggestions
          .filter(s => s && typeof s.label === 'string' && s.label.trim())
          .map(s => ({ label: s.label.trim().slice(0, 80), action: ACTIONS.includes(s.action) ? s.action : 'none' }))
          .slice(0, 2);
      }
    } catch (e) {
      // Không phải JSON: giữ nguyên text làm câu trả lời, frontend tự dùng gợi ý dự phòng.
    }
    return res.json({ reply: reply || 'Xin lỗi, mình chưa nghĩ ra câu trả lời phù hợp. Bạn có thể gọi hotline 0938.125.222 để được hỗ trợ trực tiếp nhé.', suggestions, do: doAction });
  } catch (err) {
    console.error('Chat proxy error:', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// ===== Chọn 2 nút gợi ý cho menu kịch bản của chatbot (2026-09-28) =====
// Người dùng yêu cầu: mỗi lần tối đa 2 nút gợi ý, dùng AI chọn cho đúng hoàn cảnh. Frontend
// (js/script.js offer) gửi danh sách lựa chọn làm được (id + chữ + mô tả) kèm trang đang xem,
// vài tin gần nhất và hành trình khách; AI chọn 2 id hợp nhất, được viết lại chữ cho sát hoàn
// cảnh, hoặc thay 1 nút bằng câu hỏi khách hay hỏi lúc đó (id "ask"). Chỉ nhận id có trong danh
// sách + "ask", nên AI không tạo ra nút làm việc gì ngoài những việc web làm được.
const SUGGEST_PROMPT = `Bạn chọn nút gợi ý cho khung chat tư vấn của ALOHA Baby (studio chụp ảnh em bé và gia đình tại Hà Nội; 5 dịch vụ: Bé lớn, Sinh nhật, Bầu, Gia đình, Newborn).
Nhiệm vụ: từ danh sách ứng viên, chọn ĐÚNG 2 nút mà khách có khả năng muốn bấm nhất ở thời điểm này, dựa trên trang khách đang xem, đoạn chat gần nhất và những gì khách đã xem trên web.
Quy tắc:
- "id" phải lấy nguyên văn từ danh sách ứng viên, 2 nút khác ý nhau. Không chọn lại đúng việc khách vừa làm xong ở tin gần nhất.
- Được viết lại "label" cho sát hoàn cảnh (dưới 32 ký tự, từ góc nhìn của khách, tiếng Việt có dấu) nhưng phải giữ đúng việc của ứng viên đó; không chắc thì giữ nguyên label gốc.
- Được thay tối đa 1 nút bằng một câu hỏi khách rất có thể muốn hỏi lúc này: id "ask", label là câu hỏi dưới 45 ký tự, trong phạm vi dịch vụ chụp ảnh của studio. Không hỏi về giá cọc/chính sách cụ thể (studio chưa chốt), không lặp lại câu khách đã hỏi.
- Khách vừa bày tỏ muốn chốt/đặt lịch/cần người tư vấn thì ưu tiên nút nhắn Sale hoặc giữ lịch nếu có trong danh sách.`;

app.post('/api/chat-suggest', async (req, res) => {
  if (!API_KEY) return res.status(500).json({ error: 'server_missing_api_key' });
  const clip = (v, n) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, n);
  const candidates = (Array.isArray(req.body.candidates) ? req.body.candidates : [])
    .filter(c => c && /^[a-z0-9:/_-]{1,60}$/.test(c.id) && typeof c.label === 'string' && c.label.trim())
    .slice(0, 14)
    .map(c => ({ id: c.id, label: clip(c.label, 80), desc: clip(c.desc, 160) }));
  if (candidates.length < 2) return res.status(400).json({ error: 'need_candidates' });
  const history = (Array.isArray(req.body.history) ? req.body.history : []).slice(-8).map(h => clip(h, 300)).filter(Boolean);
  const context = [
    'Trang khách đang xem: ' + (clip(req.body.page, 160) || 'không rõ'),
    'Những gì khách đã làm trên web: ' + (clip(req.body.journey, 900) || 'chưa có'),
    'Đoạn chat gần nhất:\n' + (history.length ? history.join('\n') : '(chưa có)'),
    'Ứng viên:\n' + candidates.map(c => `- id "${c.id}": ${c.label}${c.desc ? ' (' + c.desc + ')' : ''}`).join('\n')
  ].join('\n\n');
  const payload = JSON.stringify({
    systemInstruction: { parts: [{ text: SUGGEST_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: context }] }],
    generationConfig: {
      maxOutputTokens: 512,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          suggestions: { type: 'ARRAY', items: { type: 'OBJECT', properties: { id: { type: 'STRING' }, label: { type: 'STRING' } }, required: ['id', 'label'] } }
        },
        required: ['suggestions']
      }
    }
  });
  try {
    const { text, usedModel, failures } = await callGemini(payload);
    if (failures.length) console.warn('Gemini model fallback (suggest):', failures.join(' | '));
    if (!usedModel) return res.status(502).json({ error: 'upstream_error' });
    let parsed = null;
    try { parsed = JSON.parse(text); } catch (e) { /* không phải JSON */ }
    const ids = new Set(candidates.map(c => c.id));
    const seen = new Set();
    const suggestions = (parsed && Array.isArray(parsed.suggestions) ? parsed.suggestions : [])
      .filter(s => s && typeof s.id === 'string' && (ids.has(s.id) || s.id === 'ask') && typeof s.label === 'string' && s.label.trim())
      .filter(s => (seen.has(s.id) ? false : seen.add(s.id)))
      .slice(0, 2)
      .map(s => ({ id: s.id, label: clip(s.label, s.id === 'ask' ? 60 : 40) }));
    return res.json({ suggestions });
  } catch (err) {
    console.error('Suggest error:', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// ===== Trợ lý tự động trong tab "Ảnh đã chỉnh" (khung "Chat với thợ chỉnh ảnh") =====
// Người dùng chốt 2026-09-27: trả lời với giọng thợ chỉnh ảnh có chuyên môn, hỏi mức độ hài
// lòng, chỉ chuyển cho thợ thật (forward = true) khi cần thao tác trên file hoặc câu quá khó.
// Không bịa thông số nghiệp vụ chưa chốt; không nói dối nếu khách hỏi thẳng là người hay máy.
const EDIT_STATUSES = ['Chờ xử lý', 'Đang thực hiện', 'Hoàn thành'];
function editChatPrompt(ctx) {
  return `Bạn đóng vai thợ chỉnh ảnh (retoucher) của ALOHA Baby, studio chụp ảnh em bé và gia đình tại Hà Nội (hotline 0938.125.222), đang nhắn tin với khách trong mục "Ảnh đã chỉnh" của đơn hàng. Xưng "mình", gọi khách là "bạn". Giọng thân thiện, tự tin như người làm nghề: trả lời ngắn gọn (2-4 câu) nhưng sắc nét, có ít nhất một chi tiết chuyên môn cụ thể để khách thấy được sự tận tâm và tay nghề.

Thông tin đơn của khách (chỉ dựa vào đây, không suy đoán thêm):
- Mã đơn: ${ctx.orderCode || 'không rõ'}; dịch vụ: ${ctx.serviceLabel || 'không rõ'}
- Số ảnh gửi chỉnh sửa: ${ctx.photoCount}${ctx.extraCount ? ` (trong đó ${ctx.extraCount} ảnh chọn thêm ngoài gói)` : ''}
- Trạng thái chỉnh sửa: ${ctx.status} (quy trình 3 bước: Chờ xử lý, Đang thực hiện, Hoàn thành)
- Link thư mục ảnh đã chỉnh: ${ctx.hasLink ? 'ĐÃ gửi, khách thấy nút "Mở thư mục ảnh đã chỉnh" ngay phía trên khung chat' : 'CHƯA gửi'}

Kiến thức chuyên môn để trả lời (nói bằng lời dễ hiểu, không lạm dụng thuật ngữ):
- Da bé: sơ sinh hay đỏ, bong tróc nhẹ, mụn sữa, hơi vàng; khi chỉnh, bên mình làm đều màu da nhưng giữ kết cấu da tự nhiên, không làm bệt như búp bê. Vết bớt bẩm sinh chỉ xoá khi gia đình yêu cầu.
- Màu và ánh sáng: cân bằng trắng để da hồng hào tự nhiên, giữ tông màu thống nhất cả bộ; có thể theo tông ấm, pastel nhẹ hoặc trong trẻo tuỳ gu gia đình.
- Hậu kỳ thường gặp: xoá vết xước, sợi vải, đồ vật thừa; làm mềm và sạch nền; chỉnh dáng tay chân tự nhiên. Ghép người vắng mặt cần ảnh có ánh sáng và góc chụp tương đồng mới đẹp.
- In ấn: ảnh tải từ Google Drive là bản độ phân giải cao, in khổ lớn vẫn nét; màn hình điện thoại thường sáng và rực hơn bản in, muốn màu chuẩn nên in ở lab ảnh.
- Xem và tải ảnh: bấm "Mở thư mục ảnh đã chỉnh" để mở Google Drive; tải từng ảnh bằng biểu tượng tải xuống, hoặc chọn nhiều ảnh rồi bấm Tải xuống (Drive gom thành file zip). Gửi cho người thân, bạn bè: bấm "Sao chép link" rồi gửi (ai có link đều xem được). Ảnh gốc ở ô "Tải ảnh gốc chất lượng cao" đầu trang.

Cách nói chuyện tự nhiên:
- Chỉ chào ở tin nhắn đầu tiên của cuộc trò chuyện; các lượt sau đi thẳng vào câu trả lời.
- KHÔNG lặp lại mã đơn, dịch vụ, số ảnh trong mỗi câu trả lời; chỉ nhắc khi khách hỏi về đơn hoặc tiến độ.

Hỏi mức độ hài lòng:
- CHỈ hỏi khi đơn đã có link ảnh VÀ tin nhắn mới nhất của khách là khen, cảm ơn hoặc báo đã xem ảnh. Khách đang hỏi việc khác (in ảnh, tải ảnh, chỉnh sửa...) thì trả lời đúng câu hỏi, không chèn câu hỏi khảo sát. Không hỏi lại nếu trong cuộc trò chuyện đã hỏi rồi.
- Khách khen, cảm ơn hoặc báo đã xem ảnh mà CHƯA chấm điểm: cảm ơn ngắn gọn rồi hỏi khách chấm bộ ảnh mấy điểm trên 5 và có tấm nào muốn tinh chỉnh thêm không (lượt này chưa gợi ý mốc chụp).
- Khách chấm từ 3 điểm trở xuống hoặc nói chưa ưng: xin lỗi ngắn gọn, hỏi cụ thể tấm nào, chưa ưng ở điểm nào (màu da, ánh sáng, nền, bố cục), và đặt forward = true để thợ phụ trách biết. Khách chấm 4 đến 5 điểm: cảm ơn chân thành, gợi ý nhẹ các mốc chụp tiếp theo của bé (100 ngày, thôi nôi, sinh nhật) mà không ép.

Tự trả lời (forward = false): câu hỏi thường gặp, hướng dẫn xem/tải/in/chia sẻ ảnh, tư vấn chuyên môn, tiến độ theo đúng trạng thái trên, lời chào, cảm ơn, khách chấm 4 đến 5 điểm.
Chuyển cho thợ phụ trách (forward = true), chỉ khi thật sự cần:
- Khách yêu cầu chỉnh sửa cụ thể trên file ảnh (cần thao tác thật): xác nhận đã ghi lại đúng yêu cầu (tấm nào, chỉnh gì) và hẹn báo lại khi xong, KHÔNG nói là đã chỉnh xong.
- Câu hỏi bạn không có thông tin hoặc quá khó: thời gian hoàn thành cụ thể, số lần chỉnh sửa miễn phí, phí chỉnh lại, hoàn tiền, thời hạn lưu trữ ảnh, khiếu nại cần studio quyết định. Trả lời rằng mình sẽ kiểm tra lại và phản hồi sớm, không bịa con số hay chính sách.

Nguyên tắc bắt buộc:
- Không bịa con số, thời gian, chính sách; không nói đã chỉnh xong hay đã gửi link khi thông tin đơn ghi chưa có.
- Không bịa trải nghiệm cá nhân (số năm làm nghề, số bộ ảnh đã chỉnh...).
- Không tự nhắc tới AI, mô hình hay hệ thống tự động. Nhưng nếu khách hỏi thẳng, nghiêm túc rằng đang nói chuyện với người thật hay máy/AI thì KHÔNG được nói dối: trả lời rằng đây là trợ lý tự động của studio giúp trả lời nhanh, thợ chỉnh ảnh vẫn đọc toàn bộ tin nhắn và trực tiếp xử lý các yêu cầu chỉnh sửa; đặt forward = true.
- Tiếng Việt có dấu, không dùng dấu gạch ngang dài, không chêm từ tiếng Anh (vd nói "thợ chỉnh ảnh", không nói "retoucher"). Chỉ hỗ trợ việc liên quan tới ảnh và đơn chụp ở ALOHA Baby; câu ngoài phạm vi thì lịch sự từ chối.

Định dạng đầu ra: JSON {"reply": câu trả lời cho khách, "forward": true hoặc false}.`;
}

app.post('/api/edit-chat', async (req, res) => {
  if (!API_KEY) return res.status(500).json({ error: 'server_missing_api_key' });
  const messages = (Array.isArray(req.body.messages) ? req.body.messages : [])
    .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-12)
    .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content.slice(0, 1200) }] }));
  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    return res.status(400).json({ error: 'empty_messages' });
  }
  const c = req.body.context || {};
  const ctx = {
    orderCode: String(c.orderCode || '').slice(0, 30),
    serviceLabel: String(c.serviceLabel || '').slice(0, 40),
    photoCount: Math.max(0, Math.min(1000, Number(c.photoCount) || 0)),
    extraCount: Math.max(0, Math.min(1000, Number(c.extraCount) || 0)),
    status: EDIT_STATUSES.includes(c.status) ? c.status : 'Chờ xử lý',
    hasLink: !!c.hasLink
  };
  try {
    const payload = JSON.stringify({
      systemInstruction: { parts: [{ text: editChatPrompt(ctx) }] },
      contents: messages,
      generationConfig: {
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: { reply: { type: 'STRING' }, forward: { type: 'BOOLEAN' } },
          required: ['reply', 'forward']
        }
      }
    });
    const { text, usedModel, failures } = await callGemini(payload);
    if (failures.length) console.warn('Gemini model fallback (edit-chat):', failures.join(' | '));
    if (!usedModel) return res.status(502).json({ error: 'upstream_error' });
    let reply = '', forward = true; // không đọc được JSON -> để thợ xem cho chắc
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed.reply === 'string') reply = parsed.reply.trim();
      if (parsed && typeof parsed.forward === 'boolean') forward = parsed.forward;
    } catch (e) { reply = text.trim(); }
    if (!reply) return res.status(502).json({ error: 'empty_reply' });
    return res.json({ reply: reply.slice(0, 1500), forward });
  } catch (err) {
    console.error('Edit chat error:', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// ===== Thanh toán tự động qua SePay =====
// Giao dịch tiền VÀO lưu trong bộ nhớ (không có database): đủ cho luồng
// "khách chuyển khoản -> trang tự nhận ra trong vài giây", nhưng server khởi
// động lại (vd Render free ngủ sau 15 phút không có request) là mất lịch sử.
const MAX_TX = 500;
const incomingTx = []; // [{ id, content, amount, at }]

// Bỏ dấu cách/ký tự lạ, viết hoa: ngân hàng hay tự chèn tiền tố/đổi định dạng
// nội dung chuyển khoản, chỉ cần mã thanh toán nằm đâu đó trong nội dung là khớp.
const normalize = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

app.post('/api/sepay-webhook', (req, res) => {
  if (!SEPAY_WEBHOOK_KEY) {
    console.error('SePay webhook bị từ chối: chưa đặt SEPAY_WEBHOOK_KEY.');
    return res.status(503).json({ success: false, error: 'webhook_not_configured' });
  }
  if ((req.get('authorization') || '').trim() !== `Apikey ${SEPAY_WEBHOOK_KEY}`) {
    return res.status(401).json({ success: false, error: 'unauthorized' });
  }
  const tx = req.body || {};
  if (tx.transferType !== 'in') return res.json({ success: true, ignored: 'not_incoming' });
  const amount = Number(tx.transferAmount);
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ success: false, error: 'bad_amount' });
  // SePay có thể gửi lại cùng giao dịch khi thử lại: bỏ qua bản trùng id.
  if (tx.id != null && incomingTx.some(t => t.id === tx.id)) return res.json({ success: true, duplicate: true });

  incomingTx.push({ id: tx.id, content: normalize(`${tx.content || ''} ${tx.description || ''}`), amount, at: Date.now() });
  if (incomingTx.length > MAX_TX) incomingTx.splice(0, incomingTx.length - MAX_TX);
  console.log(`SePay: nhận ${amount}đ, nội dung "${tx.content}"`);
  return res.json({ success: true });
});

app.get('/api/payment-status', (req, res) => {
  const code = normalize(req.query.code);
  const amount = Number(req.query.amount);
  if (code.length < 8 || code.length > 40 || !Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'bad_request' });
  }
  const paid = incomingTx.some(t => t.content.includes(code) && t.amount >= amount);
  return res.json({ paid });
});

// ===== Chat thật Khách <-> Sale (xem sale-chat.js) =====
app.use('/api/sale-chat', saleChat.router);

app.get('/api/health', (req, res) => res.json({ ok: true, hasKey: !!API_KEY, hasSepayKey: !!SEPAY_WEBHOOK_KEY, chatStore: saleChat.storeKind }));

app.listen(PORT, () => {
  console.log(`ALOHA Baby chat server đang chạy tại http://localhost:${PORT}`);
  if (!API_KEY) console.warn('CẢNH BÁO: chưa có GEMINI_API_KEY trong .env — chatbot AI sẽ không trả lời được.');
});
