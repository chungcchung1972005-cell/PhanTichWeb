document.addEventListener('DOMContentLoaded', () => {
  const u=AlohaAuth.getSession(); if(!u || !['sale','sep','tho-anh'].includes(u.role)) return;
  const salePage=!!document.getElementById('swView'), boss=u.role==='sep';
  // Sale uses this panel in sale.html; admin.html is also accessible for inbox only.
  if(!salePage && (!document.getElementById('anh') || u.role==='sale')) return;
  const panel=document.createElement(salePage?'details':'section');panel.id='quy-trinh';panel.className='wf-panel '+(salePage?'':'admin-section');
  if(salePage) { panel.innerHTML='<summary>Quy trình đơn chụp & thu nhập của tôi</summary><div class="wf-body"></div>';document.getElementById('swView').before(panel); }
  else {panel.innerHTML='<div class="wf-body"></div>';document.getElementById('anh').before(panel);}
  const body=panel.querySelector('.wf-body');
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const vnd=n=>n===null?'Chưa có mức công':Number(n||0).toLocaleString('vi-VN')+'đ';
  const names={booked:'Chờ cọc',confirmed:'Đã cọc · chờ chụp',shooting:'Đang chụp',shot:'Đã chụp · chờ gửi gốc',choosing:'Chờ khách chọn',editing:'Đang chỉnh ảnh',delivered:'Đã giao ảnh',cancelled:'Đã hủy'};
  const kinds={'sale-extra':'Hoa hồng Sale (ảnh thêm)',sale:'Hoa hồng Sale',shoot:'Công chụp',edit:'Công chỉnh trong gói','extra-edit':'Công chỉnh thêm'};
  const stages={pending:'Chờ duyệt',approved:'Đã duyệt · chờ chi',paid:'Đã chi'};
  let state=null, error='', busy=false, month=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'}).slice(0,7);
  const dateMonth=t=>new Date(t).toLocaleDateString('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'}).slice(0,7);
  function staffName(phone) {const e=state.employees.find(e=>e.phone===phone);return e?e.name:phone;}
  function field(label,name,type='text',value='',extra='') {return `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;}
  function render() {
    if(!state) {body.innerHTML='<p>Đang tải lịch làm việc và tiền công...</p>';return;}
    const entries=state.entries.filter(e=>dateMonth(e.createdAt)===month), totals=kind=>entries.filter(e=>!kind||e.kind===kind).reduce((n,e)=>n+(e.amount||0),0);
    const sumStatus=status=>entries.filter(e=>e.status===status).reduce((n,e)=>n+(e.amount||0),0);
    const rules=[...new Map(state.rules.map(r=>[r.service+'|'+r.pkg,r])).values()];
    body.innerHTML=`<header class="wf-head"><div><h2>${boss?'Quy trình & chia tiền theo đơn':'Lịch làm việc & thu nhập của tôi'}</h2><p>Sale đặt lịch → nhận cọc → chụp → gửi ảnh gốc → khách chọn → chỉnh & giao ảnh → duyệt, chi tiền công.</p></div><button type="button" data-wf="reload">Làm mới</button></header>
      <p class="wf-store">${AlohaWorkflow.store()==='local'?'Bản demo trên máy này; dữ liệu giữ sau khi tải lại và liên kết các vai trò trong cùng trình duyệt.':AlohaWorkflow.store()==='memory'?'Máy chủ đang lưu RAM; cần cấu hình MongoDB để giữ dữ liệu qua lần khởi động lại.':'Dữ liệu đồng bộ trên máy chủ.'}</p>
      ${error?`<p class="wf-error" role="alert">${esc(error)}</p>`:''}
      <div class="wf-toolbar"><label>Tháng ghi nhận<input type="month" id="wfMonth" value="${month}"></label><span>Tiền phát sinh theo ngày hoàn thành việc; tiền dự kiến chưa phải khoản đã nhận.</span></div>
      <div class="wf-kpis">${[...(boss||u.role==='sale'?[['Hoa hồng Sale',totals('sale')+totals('sale-extra')]]:[]),...(boss||u.role==='tho-anh'?[['Công chụp',totals('shoot')],['Công chỉnh ảnh',totals('edit')+totals('extra-edit')]]:[]),['Chờ duyệt',sumStatus('pending')],['Đã duyệt · chờ chi',sumStatus('approved')],['Đã nhận / đã chi',sumStatus('paid')]].map(([k,v])=>`<article><span>${k}</span><strong>${vnd(v)}</strong></article>`).join('')}</div>
      ${entries.some(e=>e.amount===null)?'<p>Có khoản đang chờ Sếp xác nhận mức công.</p>':''}
      ${boss?'<p>Mức chia hiện tại là số mẫu. Cấu hình mức chia ở cuối trang; đơn đã chốt giữ mức tại thời điểm xác nhận cọc.</p>':''}
      <h3>Đơn / buổi chụp ${boss?'toàn studio':'được phân công'}</h3>
      <div class="wf-orders">${state.orders.slice().reverse().map(o=>{
        const estimate=boss?AlohaWorkflowCore.amounts(o.policy,o.price):null;
        return `<article class="wf-order"><div class="wf-head"><strong>${esc(o.customerName)} · ${esc(o.code)}</strong><span class="wf-status">${names[o.status]}</span></div>
        <p>${esc(o.date)} ${esc(o.time)} · ${esc(o.service)} / ${esc(o.pkg)} · ${vnd(o.price)}</p><p>Sale: ${esc(staffName(o.salePhone))} · Chụp: ${esc(staffName(o.shooterPhone))} · Chỉnh: ${esc(staffName(o.editorPhone))}</p>
        <p>Đã thu ${vnd(o.collected)} / ${vnd(o.price+(o.extraFees||0))} · Còn lại ${vnd(o.price+(o.extraFees||0)-o.collected)}</p>
        <p class="wf-estimate">${boss?(estimate?`Mức chốt: Sale ${vnd(estimate.sale)} · chụp ${vnd(estimate.shoot)} · chỉnh ${vnd(estimate.edit)} · phần studio trong gói ${vnd(o.price-estimate.sale-estimate.shoot-estimate.edit)}`:'Chưa chốt mức chia'):`Tiền công trong gói dự kiến của tôi: ${vnd(o.myEstimate)}`}</p>
        <div class="wf-actions">${(boss||u.phone===o.shooterPhone)&&o.status==='confirmed'?`<button data-wf="checkin" data-id="${esc(o.id)}">Khách đã đến · bắt đầu chụp</button>`:''}${(boss||u.phone===o.shooterPhone)&&o.status==='shooting'?`<button data-wf="shot" data-id="${esc(o.id)}">Xác nhận đã chụp xong</button>`:''}${u.phone===o.shooterPhone&&['shot','choosing'].includes(o.status)?`<button data-wf="send-originals" data-id="${esc(o.id)}">Gửi ảnh gốc cho khách</button>`:''}${boss&&!o.policy&&o.status!=='booked'?`<button data-wf="apply-policy" data-id="${esc(o.id)}">Bổ sung quy tắc tiền công</button>`:''}</div>
        ${(boss||u.role==='sale')&&o.status!=='cancelled'&&o.collected<o.price+(o.extraFees||0)?`<details><summary>Đối soát khoản khách đã thanh toán</summary><form data-wf-form="payment" data-id="${esc(o.id)}" class="wf-form">${field('Số tiền thực nhận','amount','number','',`required min="1" max="${o.price+(o.extraFees||0)-o.collected}" step="1"`)}${field('Mã giao dịch / phiếu thu','reference','text','','required maxlength="150"')}<button>Xác nhận tiền đã nhận</button></form></details>`:''}
        </article>`;
      }).join('')||'<p>Chưa có lịch được phân công. Lịch Sale tạo sẽ xuất hiện tại đây, không cần nhập lại khách.</p>'}</div>
      <h3>Sổ tiền công ${boss?'toàn studio':'của tôi'}</h3><p>Chỉ phát sinh công chụp sau khi xác nhận đã chụp, công chỉnh sau khi gửi ảnh hoàn tất. Chỉ duyệt và chi khi khách đã thanh toán đủ.</p>
      <div class="wf-table-wrap"><table><thead><tr><th>Đơn / khách</th>${boss?'<th>Người nhận</th>':''}<th>Công việc</th><th>Số tiền</th><th>Trạng thái</th><th>Đối soát</th></tr></thead><tbody>${entries.map(e=>`<tr><td>${esc(e.orderCode)}<small>${esc(e.customerName)}</small></td>${boss?`<td>${esc(staffName(e.phone))}</td>`:''}<td>${kinds[e.kind]}${e.kind==='extra-edit'?' · '+e.quantity+' ảnh':''}</td><td>${vnd(e.amount)}</td><td>${stages[e.status]}</td><td>${e.reference?esc(e.reference):boss&&e.status==='pending'?`<button data-wf="approve-entry" data-id="${esc(e.id)}">Duyệt</button>`:boss&&e.status==='approved'?`<form data-wf-form="pay-entry" data-id="${esc(e.id)}"><input name="reference" required maxlength="150" placeholder="Mã chuyển khoản / phiếu chi"><button>Xác nhận đã chi</button></form>`:'Chờ Sếp đối soát'}</td></tr>`).join('')||'<tr><td colspan="6">Chưa phát sinh tiền công trong tháng này.</td></tr>'}</tbody></table></div>
      ${boss?`<details class="wf-settings"><summary>Cấu hình gói, mức chia cố định & nhân sự</summary><p>Mức chia mẫu để xem quy trình. Sửa mức tại đây cho các đơn xác nhận cọc về sau; không đổi số tiền đã chốt của đơn cũ.</p>
      <form data-wf-form="rule" class="wf-form">${field('Dịch vụ','service','text','Newborn','required list="wfServices"')}<datalist id="wfServices">${['Newborn','Bé lớn','Sinh nhật','Bầu','Gia đình'].map(x=>`<option>${x}</option>`).join('')}</datalist>${field('Tên gói','pkg','text','Cơ bản','required')}${field('Giá gói','price','number',1500000,'required min="1" step="1"')}${field('% hoa hồng Sale','sale','number',5,'required min="0" max="100" step="0.01"')}${field('Công chụp / gói','shoot','number',300000,'required min="0" step="1"')}${field('Công chỉnh / gói','edit','number',150000,'required min="0" step="1"')}${field('Công chỉnh thêm / ảnh','extraEditPerPhoto','number',20000,'required min="0" max="50000" step="1"')}<button>Lưu phiên bản mức chia</button></form>
      <div class="wf-table-wrap"><table><thead><tr><th>Dịch vụ / gói</th><th>Giá gói</th><th>Sale</th><th>Chụp</th><th>Chỉnh trong gói</th><th>Chỉnh thêm / ảnh</th></tr></thead><tbody>${rules.map(r=>`<tr><td>${esc(r.service)} / ${esc(r.pkg)} ${r.sample?'(mẫu)':''}</td><td>${vnd(r.price)}</td><td>${r.sale.mode==='percent'?esc(r.sale.value)+'%':vnd(r.sale.value)}</td><td>${vnd(r.shoot.value)}</td><td>${vnd(r.edit.value)}</td><td>${vnd(r.extraEditPerPhoto)}</td></tr>`).join('')}</tbody></table></div>
      <h4>Gán công việc theo tài khoản nhân sự</h4><form data-wf-form="employee" class="wf-form">${field('Tên nhân sự','name','text','','required')}${field('SĐT tài khoản đăng nhập','phone','tel','','required pattern="0[0-9]{9,10}"')}<label>Vai trò<select name="role"><option value="tho-anh">Thợ chụp / chỉnh ảnh</option><option value="sale">Sale</option></select></label><button>Lưu nhân sự</button></form><p>${state.employees.map(e=>esc(e.name)+' · '+esc(e.phone)+' · '+(e.role==='sale'?'Sale':'Thợ ảnh')).join('<br>')}</p></details>
      `:''}<p class="wf-message" role="status"></p>`;
    body.querySelector('#wfMonth').onchange=e=>{month=e.target.value;render();};
    body.querySelectorAll('button').forEach(b=>b.disabled=busy);
  }
  async function run(command,data) {
    if(busy) return;busy=true;error='';render();
    try {state=await AlohaWorkflow.command(command,data);} catch(e) {error=e.message;}
    finally {busy=false;render();}
  }
  body.addEventListener('click',async e=>{
    const b=e.target.closest('[data-wf]');if(!b)return;
    const command=b.dataset.wf;
    if(command==='reload') {try{state=await AlohaWorkflow.refresh();error='';}catch(err){error=err.message;}render();return;}
    if(command==='send-originals') {location.hash='anh';window.dispatchEvent(new CustomEvent('aloha:choose-source-order',{detail:b.dataset.id}));return;}
    run(command,{id:b.dataset.id});
  });
  body.addEventListener('submit',e=>{
    const form=e.target.closest('[data-wf-form]');if(!form)return;e.preventDefault();const command=form.dataset.wfForm;
    const data=Object.fromEntries(new FormData(form));data.id=form.dataset.id||AlohaWorkflow.id();
    if(command==='payment')data.amount=Number(data.amount);
    if(command==='rule') {['sale','shoot','edit'].forEach(k=>data[k]={mode:k==='sale'?'percent':'fixed',value:Number(data[k])});data.price=Number(data.price);data.extraEditPerPhoto=Number(data.extraEditPerPhoto);}
    run(command,data);
  });
  window.addEventListener('aloha:workflow',e=>{state=e.detail;render();});
  render();AlohaWorkflow.refresh().then(s=>{state=s;render();}).catch(e=>{body.textContent=e.message;});
  if(AlohaWorkflow.enabled())setInterval(()=>{if(!body.querySelector('form:focus-within'))AlohaWorkflow.refresh().catch(()=>{});},10000);
});
