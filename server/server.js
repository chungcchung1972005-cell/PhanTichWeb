// ALOHA Baby — server proxy nhỏ cho chatbot tư vấn.
// Nhiệm vụ DUY NHẤT: nhận tin nhắn từ chatbot trên trình duyệt, gọi Gemini API
// (Google Gemini) bằng API key giữ ở đây (biến môi trường, không bao giờ gửi về
// client), rồi trả lời về. Các trang HTML khác của site (đặt lịch, chọn ảnh,
// CRM...) vẫn là site tĩnh như cũ, KHÔNG đi qua server này.
//
// Chạy:
//   copy .env.example -> .env, điền GEMINI_API_KEY thật vào .env
//   npm install
//   npm start
// Server mặc định chạy ở http://localhost:3001

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const PORT = process.env.PORT || 3001;
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
const API_KEY = process.env.GEMINI_API_KEY;
// Domain thật của frontend sau khi public, cách nhau bằng dấu phẩy (vd
// "https://ten-nguoi-dung.github.io"). Để trống thì mở cho mọi origin (chỉ
// chấp nhận được khi test local) - xem server/DEPLOY.md.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

// Dữ liệu dịch vụ/giá THAM KHẢO — khớp với SERVICE_INFO trong js/script.js
// (kịch bản quick-reply) để chatbot AI không tư vấn lệch với UI kịch bản có
// sẵn. Đây là giá/gói MINH HOẠ, chưa phải bảng giá chính thức đã duyệt — xem
// .claude/rules/tech-defaults.md mục "Cấu hình chưa xác định".
const SERVICE_INFO = {
  'Bé lớn': { concepts: 'Ngoại cảnh công viên/phố cổ, phong cách Hàn Quốc tối giản, hoặc Vintage cổ điển', note: 'phù hợp bé khoảng 2-10 tuổi, có thể chụp thêm cùng bố mẹ', price: 'từ 1.500.000đ' },
  'Sinh nhật': { concepts: 'Sinh nhật rực rỡ nhiều bóng bay, theo mùa/lễ hội, hoặc tông pastel nhẹ nhàng', note: 'có thể kết hợp bánh kem, backdrop theo yêu cầu', price: 'từ 1.800.000đ' },
  'Bầu': { concepts: 'Vintage nhẹ nhàng trong studio, ngoại cảnh thiên nhiên, hoặc tối giản tôn dáng mẹ bầu', note: 'nhiều mẹ chọn chụp khi thai khoảng 32-36 tuần, tuỳ sức khoẻ mỗi mẹ', price: 'từ 2.000.000đ' },
  'Gia đình': { concepts: 'Ngoại cảnh công viên/biển, Vintage ấm áp trong studio, hoặc đồng phục tông màu cả nhà', note: 'không giới hạn số thành viên, chụp được nhiều thế hệ', price: 'từ 2.500.000đ' },
  'Newborn': { concepts: 'Newborn tự nhiên (organic), cuộn ủ (wrap) cổ điển, hoặc có bố mẹ/anh chị cùng khung hình', note: 'nhiều gia đình chọn chụp khi bé khoảng 5-14 ngày tuổi, studio giữ ấm phòng chụp phù hợp', price: 'từ 2.200.000đ' }
};

// Các đích điều hướng frontend hỗ trợ (khớp CHAT_ACTIONS trong js/script.js).
const ACTIONS = ['dat-lich', 'chon-anh', 'dich-vu', 'concept', 'album', 'gioi-thieu', 'tin-tuc', 'trang-chu'];

const SYSTEM_PROMPT = `Bạn là trợ lý tư vấn của ALOHA Baby — studio chụp ảnh em bé và gia đình tại 35 Lê Văn Thiêm, Thanh Xuân, Hà Nội, hotline 0938.125.222.

5 dịch vụ chính, concept gợi ý và giá THAM KHẢO (luôn nói rõ đây là giá minh hoạ, Sales sẽ báo giá chính xác theo từng đơn; gói tham khảo khoảng 15 ảnh gốc được chỉnh sửa, ảnh chọn thêm ngoài gói tính phí theo ảnh):
${Object.entries(SERVICE_INFO).map(([name, info]) => `- ${name}: concept gợi ý ${info.concepts} (${info.note}), giá tham khảo ${info.price}`).join('\n')}

Ngoài 5 dịch vụ trên, studio còn nhận chụp tại nhà cho gia đình muốn không gian riêng tư quen thuộc.

Quy trình đặt lịch (5 bước): chọn dịch vụ & gói → chọn concept hoặc để studio tư vấn → chọn ngày/khung giờ còn trống (cập nhật thời gian thực) → nhập thông tin bé & xác nhận → đặt cọc giữ lịch. Sau buổi chụp, khách chọn ảnh ưng ý trong mục "Ảnh của tôi" (có thể ghi chú chỉnh sửa riêng từng ảnh), đội ngũ hậu kỳ xử lý rồi bàn giao ảnh hoàn thiện. Khách có thể đổi lịch hẹn đã đặt khi cần, điều kiện cụ thể tuỳ thời gian còn lại trước buổi chụp.

Nguyên tắc trả lời bắt buộc:
- Trả lời thân thiện, đủ ý nhưng không lan man, bằng tiếng Việt có dấu — ưu tiên 2-4 câu, có thể xuống dòng liệt kê khi hữu ích cho khách dễ đọc.
- Chỉ tư vấn trong phạm vi dịch vụ chụp ảnh của ALOHA Baby (5 dịch vụ trên, chụp tại nhà, concept, quy trình đặt lịch/đổi lịch/chọn ảnh). Nếu khách hỏi ngoài phạm vi (không liên quan chụp ảnh/studio), lịch sự từ chối và hướng về dịch vụ studio.
- KHÔNG tự chốt lịch hay nhận cọc trong khung chat. Bạn không tự chuyển trang: hệ thống chỉ chuyển khách khi khách bấm nút gợi ý bên dưới câu trả lời. Khi khách muốn đặt lịch (hoặc xem ảnh, xem dịch vụ...), trả lời ngắn gọn bằng chữ rồi mời khách bấm nút tương ứng ở các gợi ý bên dưới (ví dụ "bạn bấm nút Đặt lịch chụp ngay bên dưới để vào trang đặt lịch nhé"), không nói kiểu "mình đang chuyển bạn tới...".
- KHÔNG bịa số liệu cụ thể về mức cọc, chính sách đổi/huỷ lịch, số ảnh được chỉnh sửa miễn phí — những thông số này chưa được studio chốt, chỉ nói "Sales sẽ tư vấn chi tiết khi bạn đặt lịch".
- Không tự nhận là con người thay cho AI nếu khách hỏi thẳng.

Định dạng đầu ra: JSON gồm "reply" (câu trả lời cho khách) và "suggestions" (đúng 3 gợi ý tiếp theo khách có khả năng muốn chọn nhất sau câu trả lời vừa rồi). Mỗi gợi ý là {"label", "action"}: "label" viết từ góc nhìn của khách, ngắn gọn dưới 50 ký tự, nằm trong phạm vi dịch vụ studio, bám sát nội dung câu trả lời vừa đưa ra, không lặp lại nhau. Nếu gợi ý tương ứng với một trang/mục của website thì đặt "action" để khách bấm vào là được chuyển thẳng tới đó, gồm: "dat-lich" (đặt lịch/hẹn chụp/đặt cọc), "chon-anh" (xem ảnh của tôi, chọn ảnh, gửi yêu cầu chỉnh sửa ảnh), "dich-vu" (danh sách dịch vụ), "concept" (thư viện concept), "album" (album ảnh đẹp), "gioi-thieu" (giới thiệu studio), "tin-tuc" (tin tức/kinh nghiệm), "trang-chu" (về trang chủ). Nếu chỉ là câu hỏi thêm thì "action" là "none". Khi khách thể hiện ý muốn làm việc gì mà website có trang tương ứng thì BẮT BUỘC 1 trong 3 gợi ý là nút dẫn tới đúng trang đó (ví dụ khách nhắn muốn đặt lịch thì có {"label": "Đặt lịch chụp ngay", "action": "dat-lich"}; muốn xem ảnh của mình thì có {"label": "Xem ảnh của tôi", "action": "chon-anh"}). Nếu khách chưa thể hiện ý cụ thể thì ít nhất 1 gợi ý dẫn tới trang phù hợp nhất với ngữ cảnh cuộc trò chuyện.`;

const app = express();
if (ALLOWED_ORIGINS.length) {
  app.use(cors({ origin: ALLOWED_ORIGINS }));
} else {
  app.use(cors());
  console.warn('CẢNH BÁO: chưa đặt ALLOWED_ORIGINS, CORS đang mở cho MỌI website gọi vào - chỉ chấp nhận được khi test local.');
}
app.use(express.json({ limit: '200kb' }));

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

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
    const payload = JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: {
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              reply: { type: 'STRING' },
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
            required: ['reply', 'suggestions']
          }
        }
    });

    // Free tier hay báo 503 tạm thời khi quá tải: thử lại tối đa 2 lần rồi mới báo lỗi.
    // Không thử lại 429 (hết hạn mức free), thử lại chỉ tốn thêm lượt.
    let response, data;
    for (let attempt = 0; attempt < 3; attempt++) {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': API_KEY },
        body: payload
      });
      data = await response.json();
      if (response.ok || response.status !== 503) break;
      await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
    }
    if (!response.ok) {
      console.error('Gemini API error:', data);
      return res.status(502).json({ error: 'upstream_error', detail: data.error && data.error.message });
    }
    if (data.promptFeedback && data.promptFeedback.blockReason) {
      console.error('Gemini blocked prompt:', data.promptFeedback);
    }
    const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
    const text = parts.map(p => p.text || '').join('').trim();
    let reply = text;
    let suggestions = [];
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed.reply === 'string') reply = parsed.reply.trim();
      if (parsed && Array.isArray(parsed.suggestions)) {
        suggestions = parsed.suggestions
          .filter(s => s && typeof s.label === 'string' && s.label.trim())
          .map(s => ({ label: s.label.trim().slice(0, 80), action: ACTIONS.includes(s.action) ? s.action : 'none' }))
          .slice(0, 3);
      }
    } catch (e) {
      // Không phải JSON: giữ nguyên text làm câu trả lời, frontend tự dùng gợi ý dự phòng.
    }
    return res.json({ reply: reply || 'Xin lỗi, mình chưa nghĩ ra câu trả lời phù hợp. Bạn có thể gọi hotline 0938.125.222 để được hỗ trợ trực tiếp nhé.', suggestions });
  } catch (err) {
    console.error('Chat proxy error:', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

app.get('/api/health', (req, res) => res.json({ ok: true, hasKey: !!API_KEY }));

app.listen(PORT, () => {
  console.log(`ALOHA Baby chat server đang chạy tại http://localhost:${PORT}`);
  if (!API_KEY) console.warn('CẢNH BÁO: chưa có GEMINI_API_KEY trong .env — chatbot AI sẽ không trả lời được.');
});
