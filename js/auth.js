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
    'sale': 'crm/admin.html',
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

  function login(role, name, phone) {
    if (!ROLE_HOME[role]) throw new Error('Vai trò không hợp lệ: ' + role);
    const session = { role, name: name || ROLE_LABEL[role], phone: phone || '', loginAt: Date.now() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    return session;
  }

  function logout() {
    window.localStorage.removeItem(STORAGE_KEY);
    window.location.href = withBasePrefix('login.html');
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
    requireRole
  };
})(window);
