// ALOHA Baby — module phân quyền dùng chung (window.AlohaAuth).
// Đây là MÔ PHỎNG đăng nhập/phân quyền phía client (lưu localStorage), phục vụ
// demo 4 vai trò trên site tĩnh chưa có backend — KHÔNG phải xác thực bảo mật
// thật. Bản triển khai thật cần server xác thực + session/JWT.
(function (window) {
  const STORAGE_KEY = 'aloha_auth';

  // Trang chủ + Đặt lịch + Ảnh của tôi đã gộp vào index.html (SPA nhỏ dùng
  // location.hash, xem js/router.js) — 'khach-hang' trỏ tới route hash, không
  // còn là file .html riêng.
  const ROLE_HOME = {
    'khach-hang': 'index.html#/chon-anh',
    'tho-anh': 'crm/admin.html',
    'sale': 'crm/sale.html', // Không gian Sale riêng (5 tài khoản sale)
    'sep': 'crm/admin.html'
  };

  const ROLE_LABEL = {
    'khach-hang': 'Khách hàng',
    'tho-anh': 'Thợ ảnh',
    'sale': 'Sale/CSKH',
    'sep': 'Sếp'
  };

  // Trang gọi requireRole() có thể nằm ở root (index.html...) hoặc trong crm/.
  // roleHome() luôn trả đường dẫn tính từ root; nơi gọi tự thêm tiền tố nếu cần.
  function isInSubfolder() {
    return window.location.pathname.replace(/\\/g, '/').includes('/crm/');
  }

  function withBasePrefix(pathFromRoot) {
    return isInSubfolder() && !pathFromRoot.startsWith('crm/')
      ? '../' + pathFromRoot
      : isInSubfolder() ? pathFromRoot.replace(/^crm\//, '') : pathFromRoot;
  }

  function getSession() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !ROLE_HOME[data.role]) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function isLoggedIn() {
    return !!getSession();
  }

  function getRole() {
    const s = getSession();
    return s ? s.role : null;
  }

  // token (thêm 2026-09-27): mã đăng nhập do server cấp (server/sale-chat.js), dùng cho chat
  // thật Khách <-> Sale. Không có (server chưa chạy lúc đăng nhập) thì các phần khác vẫn
  // chạy như cũ, riêng chat báo "chưa kết nối máy chủ".
  function login(role, name, phone, token) {
    if (!ROLE_HOME[role]) throw new Error('Vai trò không hợp lệ: ' + role);
    const session = { role, name: name || ROLE_LABEL[role], phone: phone || '', loginAt: Date.now() };
    if (token) session.token = token;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    return session;
  }

  // ---------------------------------------------------------------- Gọi server (chat thật)
  // Mở từ máy (file://) hoặc localhost -> server local `npm start` (cổng 3001); còn lại ->
  // server đã deploy trên Render. Cùng quy ước với CHAT_API_URL trong js/script.js.
  const isLocal = location.protocol === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const API_BASE = isLocal ? 'http://localhost:3001' : 'https://phantichweb.onrender.com';

  // Trả về { ok, status, data }; status 0 = không kết nối được (server tắt/ngủ/mất mạng).
  async function api(path, opts) {
    const o = opts || {};
    const headers = { 'content-type': 'application/json' };
    const s = getSession();
    if (o.auth !== false && s && s.token) headers.authorization = 'Bearer ' + s.token;
    try {
      const res = await fetch(API_BASE + path, {
        method: o.method || 'GET',
        headers,
        body: o.body ? JSON.stringify(o.body) : undefined,
        signal: AbortSignal.timeout ? AbortSignal.timeout(o.timeout || 15000) : undefined
      });
      let data = null;
      try { data = await res.json(); } catch (e) { /* phản hồi không phải JSON */ }
      return { ok: res.ok, status: res.status, data };
    } catch (e) {
      return { ok: false, status: 0, data: null };
    }
  }

  // Render bản miễn phí ngủ khi lâu không có ai dùng, lần gọi đầu có thể mất vài chục giây.
  // Gọi "đánh thức" sớm (vd lúc vừa mở trang đăng nhập) để lúc bấm Đăng nhập server đã dậy.
  function wakeServer() {
    api('/api/health', { auth: false, timeout: 60000 });
  }
  const serverLogin = (phone, password) =>
    api('/api/sale-chat/auth/login', { method: 'POST', auth: false, body: { phone, password }, timeout: 25000 });
  const serverRegister = (name, phone, password) =>
    api('/api/sale-chat/auth/register', { method: 'POST', auth: false, body: { name, phone, password }, timeout: 25000 });
  // Đăng nhập bằng Google (thêm 2026-09-27): server trả Client ID (null = chưa bật), kiểm tra
  // ID token Google; lần đầu trả { needPhone, ticket } để khách nhập SĐT rồi gọi googleComplete.
  const serverConfig = () => api('/api/sale-chat/auth/config', { auth: false, timeout: 60000 });
  const serverGoogle = (credential) =>
    api('/api/sale-chat/auth/google', { method: 'POST', auth: false, body: { credential }, timeout: 25000 });
  const serverGoogleComplete = (ticket, name, phone) =>
    api('/api/sale-chat/auth/google/complete', { method: 'POST', auth: false, body: { ticket, name, phone }, timeout: 25000 });

  // next (tuỳ chọn): route quay lại sau khi đăng nhập lại, vd 'chat-sale/bau'.
  function logout(next) {
    window.localStorage.removeItem(STORAGE_KEY);
    window.location.href = withBasePrefix('login.html') + (typeof next === 'string' && next ? '?next=' + encodeURIComponent(next) : '');
  }

  function roleHome(role) {
    const path = ROLE_HOME[role];
    return path ? withBasePrefix(path) : withBasePrefix('login.html');
  }

  function roleLabel(role) {
    return ROLE_LABEL[role] || 'Khách';
  }

  function requireRole(allowedRoles) {
    const session = getSession();
    if (!session) {
      const next = encodeURIComponent(window.location.pathname.split('/').pop());
      window.location.replace(withBasePrefix('login.html') + '?next=' + next);
      return;
    }
    if (allowedRoles && allowedRoles.indexOf(session.role) === -1) {
      window.location.replace(roleHome(session.role));
    }
  }

  window.AlohaAuth = {
    getSession, isLoggedIn, getRole,
    login, logout,
    roleHome, roleLabel,
    requireRole,
    api, wakeServer, serverLogin, serverRegister, serverConfig, serverGoogle, serverGoogleComplete, API_BASE
  };
})(window);
