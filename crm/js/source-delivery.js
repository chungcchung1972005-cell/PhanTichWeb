document.addEventListener('DOMContentLoaded', () => {
  const section = document.getElementById('anh');
  const session = window.AlohaAuth && AlohaAuth.getSession();
  if (!section || !session || !['tho-anh','sep'].includes(session.role)) return;
  const sync = !!(window.AlohaEditSync && AlohaEditSync.enabled());
  const box = document.createElement('section'); box.className = 'source-delivery';
  box.innerHTML = `<h3>1. Gửi ảnh gốc cho khách chọn</h3>
    <p>Chọn khách đã chụp từ lịch Sale, dán link Drive và gửi. Thông tin khách, mã đơn, dịch vụ và người chỉnh ảnh được lấy tự động.</p>
    ${session.role === 'tho-anh' ? `<form id="sourceDeliveryForm">
      <label>Khách / buổi chụp đã hoàn tất<select name="workflowOrderId" id="sourceOrderSelect" required><option value="">Đang tải khách đã chụp...</option></select></label>
      <div id="sourceOrderSummary"></div>
      <label>Thư mục Drive ảnh gốc<input name="folderUrl" type="url" required placeholder="https://drive.google.com/drive/folders/..."></label>
      <div class="source-delivery-actions"><button type="submit" id="sourceSendAlbum" disabled>Gửi link ảnh gốc cho khách chọn</button></div>
      <p id="sourceDeliveryStatus" role="status"></p><div id="sourceDeliveryPreview"></div>
    </form>` : ''}
    <h4>Bộ ảnh gốc đã gửi</h4><div id="sourceDeliveryList"></div>`;
  section.querySelector('.photo-worker-bar').before(box);
  const esc = s => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function refresh() {
    const state=AlohaWorkflow.get() || await AlohaWorkflow.refresh();
    const select=document.getElementById('sourceOrderSelect');
    if(select) {
      const selected=select.value;
      const orders=state.orders.filter(o=>o.shooterPhone===session.phone && ['shot','choosing'].includes(o.status));
      select.innerHTML='<option value="">Chọn khách đã chụp...</option>'+orders.map(o=>`<option value="${esc(o.id)}">${esc(o.customerName)} · ${esc(o.code)} · ${esc(o.date)} · ${esc(o.pkg)}</option>`).join('');
      if(orders.some(o=>o.id===selected))select.value=selected;
      const o=orders.find(o=>o.id===select.value);
      document.getElementById('sourceOrderSummary').textContent=o?`${o.customerName} · ${o.phone} · ${o.service} / ${o.pkg} · Mã đơn ${o.code}`:orders.length?'':'Chưa có khách đã chụp do bạn phụ trách. Vào Lịch làm việc để check-in và xác nhận chụp xong.';
      document.getElementById('sourceSendAlbum').disabled=!o;
    }
    const list = document.getElementById('sourceDeliveryList');
    const result = sync ? await AlohaEditSync.listSourceAlbums() : {ok:true, data:{albums:AlohaData.getSourceAlbums()}};
    if (!result.ok) { list.textContent = result.message; return; }
    const albums = result.data.albums || [];
    list.innerHTML = albums.length ? albums.slice().reverse().map(a => `<article class="source-delivery-item"><strong>${esc(a.orderCode)} · ${esc(a.customerName || a.phone)}</strong><p>${esc(a.phone)} · ${a.photos.length} ảnh gốc · gửi ${esc(new Date(a.createdAt).toLocaleString('vi-VN'))}</p><a href="${esc(a.folderUrl)}" target="_blank" rel="noopener noreferrer">Mở thư mục gốc</a><span> Khách đăng nhập → Ảnh của tôi → chọn bộ ảnh này để gửi yêu cầu sửa.</span></article>`).join('') : '<p>Chưa gửi bộ ảnh gốc nào. Khách chỉ bắt đầu chọn sau khi thợ giao ảnh.</p>';
  }
  const form = document.getElementById('sourceDeliveryForm');
  if (form) {
    let loading = false;
    const status = document.getElementById('sourceDeliveryStatus');
    const send = document.getElementById('sourceSendAlbum');
    form.elements.workflowOrderId.onchange=()=>refresh().catch(e=>{status.textContent=e.message;});
    form.onsubmit = async e => {
      e.preventDefault(); if (loading || !form.reportValidity()) return;
      const orderId=form.elements.workflowOrderId.value, folderUrl=form.elements.folderUrl.value.trim();
      loading = true; send.disabled = true; form.elements.workflowOrderId.disabled=true;form.elements.folderUrl.disabled=true;
      try {
        status.textContent='Đang đọc ảnh từ Drive và gửi cho khách...';
        const imported=await AlohaDrive.readFolder(folderUrl);
        const data=Object.assign({workflowOrderId:orderId},imported);
        const result = sync ? await AlohaEditSync.deliverSourceAlbum(data) : {ok:true, data:{album:AlohaData.deliverSourceAlbum(data)}};
        if (!result.ok) throw new Error(result.message);
        const album=result.data.album;
        status.textContent = `Đã gửi ${data.photos.length} ảnh gốc cho ${album.customerName}. Khách có thể chọn ảnh trong mục Ảnh của tôi.`;
        form.elements.folderUrl.value='';document.getElementById('sourceDeliveryPreview').replaceChildren(); await refresh();
      } catch (e) { status.textContent = e.message; send.disabled = false; }
      finally { loading = false; form.elements.workflowOrderId.disabled=false;form.elements.folderUrl.disabled=false;send.disabled=!form.elements.workflowOrderId.value; }
    };
  }
  window.addEventListener('aloha:choose-source-order',async e=>{await refresh();const select=document.getElementById('sourceOrderSelect');if(select){select.value=e.detail;select.dispatchEvent(new Event('change'));box.scrollIntoView({behavior:'smooth'});form.elements.folderUrl.focus();}});
  refresh().catch(e=>{document.getElementById('sourceDeliveryList').textContent=e.message;});
  window.addEventListener('aloha:workflow',()=>refresh().catch(()=>{}));
  window.addEventListener('storage',()=>refresh().catch(()=>{}));
});
