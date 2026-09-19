// ALOHA Baby — server proxy nhỏ cho chatbot tư vấn.
// Nhiệm vụ DUY NHẤT: nhận tin nhắn từ chatbot trên trình duyệt, gọi Claude API
// (Anthropic) bằng API key giữ ở đây (biến môi trường, không bao giờ gửi về
// client), rồi trả lời về. Các trang HTML khác của site (đặt lịch, chọn ảnh,
// CRM...) vẫn là site tĩnh như cũ, KHÔNG đi qua server này.
//
// Chạy:
//   copy .env.example -> .env, điền ANTHROPIC_API_KEY thật vào .env
//   npm install
//   npm start
// Server mặc định chạy ở http://localhost:3001

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const PORT = process.env.PORT || 3001;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
const API_KEY = process.env.ANTHROPIC_API_KEY;

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

const SYSTEM_PROMPT = `Bạn là trợ lý tư vấn của ALOHA Baby — studio chụp ảnh em bé và gia đình tại 35 Lê Văn Thiêm, Thanh Xuân, Hà Nội, hotline 0938.125.222.

5 dịch vụ chính, concept gợi ý và giá THAM KHẢO (luôn nói rõ đây là giá minh hoạ, Sales sẽ báo giá chính xác theo từng đơn; gói tham khảo khoảng 15 ảnh gốc được chỉnh sửa, ảnh chọn thêm ngoài gói tính phí theo ảnh):
${Object.entries(SERVICE_INFO).map(([name, info]) => `- ${name}: concept gợi ý ${info.concepts} (${info.note}), giá tham khảo ${info.price}`).join('\n')}

Ngoài 5 dịch vụ trên, studio còn nhận chụp tại nhà cho gia đình muốn không gian riêng tư quen thuộc.

Quy trình đặt lịch (5 bước): chọn dịch vụ & gói → chọn concept hoặc để studio tư vấn → chọn ngày/khung giờ còn trống (cập nhật thời gian thực) → nhập thông tin bé & xác nhận → đặt cọc giữ lịch. Sau buổi chụp, khách chọn ảnh ưng ý trong mục "Ảnh của tôi" (có thể ghi chú chỉnh sửa riêng từng ảnh), đội ngũ hậu kỳ xử lý rồi bàn giao ảnh hoàn thiện. Khách có thể đổi lịch hẹn đã đặt khi cần, điều kiện cụ thể tuỳ thời gian còn lại trước buổi chụp.

Nguyên tắc trả lời bắt buộc:
- Trả lời thân thiện, đủ ý nhưng không lan man, bằng tiếng Việt có dấu — ưu tiên 2-4 câu, có thể xuống dòng liệt kê khi hữu ích cho khách dễ đọc.
- Chỉ tư vấn trong phạm vi dịch vụ chụp ảnh của ALOHA Baby (5 dịch vụ trên, chụp tại nhà, concept, quy trình đặt lịch/đổi lịch/chọn ảnh). Nếu khách hỏi ngoài phạm vi (không liên quan chụp ảnh/studio), lịch sự từ chối và hướng về dịch vụ studio.
- KHÔNG tự chốt lịch hay nhận cọc trong khung chat. Khi khách muốn đặt lịch, hướng dẫn họ bấm nút "Đặt lịch ngay" trên trang để vào đúng luồng đặt lịch chính thức.
- KHÔNG bịa số liệu cụ thể về mức cọc, chính sách đổi/huỷ lịch, số ảnh được chỉnh sửa miễn phí — những thông số này chưa được studio chốt, chỉ nói "Sales sẽ tư vấn chi tiết khi bạn đặt lịch".
- Không tự nhận là con người thay cho AI nếu khách hỏi thẳng.`;

const app = express();
app.use(cors());
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

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: cleanMessages
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Anthropic API error:', data);
      return res.status(502).json({ error: 'upstream_error', detail: data.error && data.error.message });
    }
    const text = (data.content || []).map(block => block.text || '').join('').trim();
    return res.json({ reply: text || 'Xin lỗi, mình chưa nghĩ ra câu trả lời phù hợp. Bạn có thể gọi hotline 0938.125.222 để được hỗ trợ trực tiếp nhé.' });
  } catch (err) {
    console.error('Chat proxy error:', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

app.get('/api/health', (req, res) => res.json({ ok: true, hasKey: !!API_KEY }));

app.listen(PORT, () => {
  console.log(`ALOHA Baby chat server đang chạy tại http://localhost:${PORT}`);
  if (!API_KEY) console.warn('CẢNH BÁO: chưa có ANTHROPIC_API_KEY trong .env — chatbot AI sẽ không trả lời được.');
});
