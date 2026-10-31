// ALOHA Baby — khu quản trị (Sếp, Sale) hiện MỖI LÚC 1 MỤC thay vì cuộn cả trang dài (31/10/2026,
// Chung: các màn khác "chia theo mục đẹp như của thợ ảnh"). Bấm menu = sang mục đó; khối không có mục
// riêng trên menu (vd biểu đồ, đội Sale dưới Tổng quan) đi theo mục đứng trước nó. Nội dung từng mục giữ nguyên.
// Thợ ảnh có màn riêng (crm/js/tho-workspace.js) nên bỏ qua ở đây.
document.addEventListener('DOMContentLoaded', () => {
  if (document.documentElement.classList.contains('tho-ws-on')) return;
  const nav = document.getElementById('adminTabs');
  if (!nav) return;
  const links = [...nav.querySelectorAll('a[href^="#"]')];
  if (links.length < 2) return;
  const ids = links.map((a) => a.getAttribute('href').slice(1));
  // Gán mỗi section vào mục menu gần nhất phía trên nó (theo thứ tự trong trang)
  const owner = new Map();
  let current = null;
  document.querySelectorAll('.admin-body .admin-section').forEach((s) => {
    if (s.id && ids.includes(s.id)) current = s.id;
    owner.set(s, current || ids[0]);
  });
  document.documentElement.classList.add('admin-pages-on');

  function show(id, scroll) {
    if (!ids.includes(id)) id = (links.find((a) => a.classList.contains('active')) || links[0]).getAttribute('href').slice(1);
    owner.forEach((page, s) => { s.hidden = page !== id; });
    links.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + id));
    if (scroll) window.scrollTo(0, 0);
  }
  nav.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]'); if (!a) return;
    e.preventDefault();
    const id = a.getAttribute('href').slice(1);
    history.replaceState(null, '', '#' + id);
    show(id, true);
  });
  // Link trong trang trỏ tới mục khác (vd "#tin-nhan", "#anh") vẫn đổi mục đúng
  window.addEventListener('hashchange', () => show(location.hash.slice(1), true));
  show(location.hash.slice(1), false);
});
