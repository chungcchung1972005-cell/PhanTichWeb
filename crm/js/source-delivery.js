document.addEventListener('DOMContentLoaded', () => {
  const section = document.getElementById('anh');
  const session = window.AlohaAuth && AlohaAuth.getSession();
  if (!section || !session || !['tho-anh','sep'].includes(session.role)) return;
  const sync = !!(window.AlohaEditSync && AlohaEditSync.enabled());
  const box = document.createElement('section'); box.className = 'source-delivery';
  box.innerHTML = `<h3>1. Gửi ảnh gốc cho khách chọn</h3>
    <p>Chụp xong → đưa ảnh vào một thư mục Drive → chia sẻ quyền xem cho tài khoản Google của khách → gửi bộ ảnh tại đây.</p>
    ${session.role === 'tho-anh' ? `<form id="sourceDeliveryForm">
      <div class="source-delivery-fields">
        <label>Số điện thoại khách<input name="phone" required pattern="0[0-9]{9,10}" placeholder="SĐT tài khoản khách"></label>
        <label>Mã đơn / buổi chụp<input name="orderCode" required pattern="#?[A-Za-z0-9-]{3,29}" placeholder="#AB240915"></label>
        <label>Tên khách<input name="customerName" maxlength="80" placeholder="Tên khách hàng"></label>
        <label>Dịch vụ<input name="serviceLabel" maxlength="40" placeholder="Newborn, sinh nhật..."></label>
      </div>
      <label>Thư mục Drive ảnh gốc<input name="folderUrl" type="url" required placeholder="https://drive.google.com/drive/folders/..."></label>
      <div class="source-delivery-actions"><button type="button" id="sourceReadFolder">Đọc ảnh từ Drive</button><button type="submit" id="sourceSendAlbum" disabled>Gửi bộ ảnh cho khách chọn</button></div>
      <p id="sourceDeliveryStatus" role="status"></p><div id="sourceDeliveryPreview"></div>
    </form>` : ''}
    <h4>Bộ ảnh gốc đã gửi</h4><div id="sourceDeliveryList"></div>`;
  section.querySelector('.photo-worker-bar').before(box);
  const esc = s => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function refresh() {
    const list = document.getElementById('sourceDeliveryList');
    const result = sync ? await AlohaEditSync.listSourceAlbums() : {ok:true, data:{albums:AlohaData.getSourceAlbums()}};
    if (!result.ok) { list.textContent = result.message; return; }
    const albums = result.data.albums || [];
    list.innerHTML = albums.length ? albums.slice().reverse().map(a => `<article class="source-delivery-item"><strong>${esc(a.orderCode)} · ${esc(a.customerName || a.phone)}</strong><p>${esc(a.phone)} · ${a.photos.length} ảnh gốc · gửi ${esc(new Date(a.createdAt).toLocaleString('vi-VN'))}</p><a href="${esc(a.folderUrl)}" target="_blank" rel="noopener noreferrer">Mở thư mục gốc</a><span> Khách đăng nhập → Ảnh của tôi → chọn bộ ảnh này để gửi yêu cầu sửa.</span></article>`).join('') : '<p>Chưa gửi bộ ảnh gốc nào. Khách chỉ bắt đầu chọn sau khi thợ giao ảnh.</p>';
  }
  const form = document.getElementById('sourceDeliveryForm');
  if (form) {
    let imported = null, loading = false;
    const status = document.getElementById('sourceDeliveryStatus');
    const send = document.getElementById('sourceSendAlbum');
    const read = document.getElementById('sourceReadFolder');
    form.elements.folderUrl.addEventListener('input', () => { imported = null; send.disabled = true; document.getElementById('sourceDeliveryPreview').replaceChildren(); });
    read.onclick = async () => {
      if (loading) return;
      imported = null; send.disabled = true; loading = true; read.disabled = true;
      status.textContent = 'Đang kết nối Drive và đọc ảnh trong thư mục...';
      try {
        imported = await AlohaDrive.readFolder(form.elements.folderUrl.value.trim());
        document.getElementById('sourceDeliveryPreview').innerHTML = `<p><strong>${imported.photos.length} ảnh gốc</strong> trong bộ ảnh này</p><ul>${imported.photos.slice(0,12).map(p => `<li>${esc(p.name)}</li>`).join('')}</ul>`;
        status.textContent = 'Đã đọc danh sách ảnh. Kiểm tra đúng khách và mã đơn rồi bấm gửi.'; send.disabled = false;
      } catch (e) { status.textContent = e.message; }
      finally { loading = false; read.disabled = false; }
    };
    form.onsubmit = async e => {
      e.preventDefault(); if (loading || !imported || !form.reportValidity()) return;
      const data = Object.assign(Object.fromEntries(new FormData(form)), imported);
      loading = true; send.disabled = true; read.disabled = true;
      try {
        const result = sync ? await AlohaEditSync.deliverSourceAlbum(data) : {ok:true, data:{album:AlohaData.deliverSourceAlbum(data)}};
        if (!result.ok) throw new Error(result.message);
        status.textContent = `Đã gửi ${data.photos.length} ảnh gốc cho ${data.phone}. Khách có thể chọn ảnh trong mục Ảnh của tôi.`;
        imported = null; document.getElementById('sourceDeliveryPreview').replaceChildren(); await refresh();
      } catch (e) { status.textContent = e.message; send.disabled = false; }
      finally { loading = false; read.disabled = false; }
    };
  }
  refresh(); window.addEventListener('storage', refresh);
});
