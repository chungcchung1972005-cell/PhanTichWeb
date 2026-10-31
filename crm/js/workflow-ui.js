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
  const stages={pending:'Dự kiến',approved:'Đã chốt · chờ trả',paid:'Đã nhận'};
  let state=null, error='', busy=false, month=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'}).slice(0,7);
  const dateMonth=t=>new Date(t).toLocaleDateString('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'}).slice(0,7);
  function staffName(phone) {const e=state.employees.find(e=>e.phone===phone);return e?e.name:phone;}
  function field(label,name,type='text',value='',extra='') {return `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;}
  const tabs=boss?[['orders','Đơn'],['income','Tiền công'],['settings','Cấu hình']]:[['orders','Việc của tôi'],['income','Thu nhập']];
  let tab='orders';
  try {const saved=localStorage.getItem('aloha_admin_ui_wf');if(tabs.some(t=>t[0]===saved))tab=saved;} catch(e) {}
  function selectTab(next) {
    tab=next;try {localStorage.setItem('aloha_admin_ui_wf',tab);} catch(e) {}
    body.querySelectorAll('[data-wf-tab]').forEach(b=>{b.setAttribute('aria-selected',String(b.dataset.wfTab===tab));b.tabIndex=b.dataset.wfTab===tab?0:-1;});
    body.querySelectorAll('[data-wf-pane]').forEach(p=>p.hidden=p.dataset.wfPane!==tab);
  }
  function render() {
    if(!state) {body.innerHTML='<p>Đang tải lịch làm việc và tiền công...</p>';return;}
    const entries=state.entries.filter(e=>(e.confirmedMonth || dateMonth(e.createdAt))===month);
    const sumStatus=status=>entries.filter(e=>e.status===status).reduce((n,e)=>n+(e.amount||0),0);
    const rules=[...new Map(state.rules.map(r=>[r.service+'|'+r.pkg,r])).values()];
    body.innerHTML=`<header class="wf-head"><h2>${boss?'Quy trình & chia tiền':document.documentElement.classList.contains('tho-ws-on')?'Thu nhập':'Lịch làm việc & thu nhập'}</h2><button type="button" data-wf="reload">Làm mới</button></header>
      <div class="wf-tabs" role="tablist" aria-label="${boss?'Quản lý quy trình':'Công việc của tôi'}">${tabs.map(([key,label])=>`<button type="button" role="tab" id="wf-tab-${key}" aria-controls="wf-pane-${key}" data-wf-tab="${key}">${label}</button>`).join('')}</div>
      ${error?`<p class="wf-error" role="alert">${esc(error)}</p>`:''}
      <section id="wf-pane-income" role="tabpanel" aria-labelledby="wf-tab-income" data-wf-pane="income"><div class="wf-toolbar"><label>Tháng ghi nhận<input type="month" id="wfMonth" value="${month}"></label><span>Tiền phát sinh theo ngày hoàn thành việc; tiền dự kiến chưa phải khoản đã nhận.</span></div>
      <div class="wf-kpis">${[['pending','Dự kiến · chờ khách xác nhận',sumStatus('pending')],['approved','Đã chốt · chờ trả',sumStatus('approved')],['paid','Đã nhận',sumStatus('paid')]].map(([c,k,v])=>`<article class="wf-money-${c}"><span>${k}</span><strong>${vnd(v)}</strong></article>`).join('')}</div>
      ${entries.some(e=>e.amount===null)?'<p>Có khoản đang chờ Sếp xác nhận mức công.</p>':''}
      </section><section id="wf-pane-orders" role="tabpanel" aria-labelledby="wf-tab-orders" data-wf-pane="orders">
      <h3>Đơn / buổi chụp ${boss?'toàn studio':'được phân công'}</h3>
      <div class="wf-orders">${state.orders.slice().reverse().map(o=>{
        const estimate=boss?AlohaWorkflowCore.amounts(o.policy,o.price):null;
        return `<article class="wf-order"><div class="wf-head"><strong>${esc(o.customerName)} · ${esc(o.code)} · ${esc(o.time)}</strong><span class="wf-status wf-status-${esc(o.status)}">${names[o.status]}</span></div>
        <details class="wf-order-detail"><summary>Chi tiết đơn</summary><p>${esc(o.date)} ${esc(o.time)} · ${esc(o.service)} / ${esc(o.pkg)} · ${vnd(o.price)}</p><p>Sale: ${esc(staffName(o.salePhone))} · Chụp: ${esc(staffName(o.shooterPhone))} · Chỉnh: ${esc(staffName(o.editorPhone))}</p>
        <p>Đã thu ${vnd(o.collected)} / ${vnd(o.price+(o.extraFees||0))} · Còn lại ${vnd(o.price+(o.extraFees||0)-o.collected)}</p>
        <p class="wf-estimate">${boss?(estimate?`Mức chốt: Sale ${vnd(estimate.sale)} · chụp ${vnd(estimate.shoot)} · chỉnh ${vnd(estimate.edit)} · phần studio trong gói ${vnd(o.price-estimate.sale-estimate.shoot-estimate.edit)}`:'Chưa chốt mức chia'):`Tiền công trong gói dự kiến của tôi: ${vnd(o.myEstimate)}`}</p>
        </details><div class="wf-actions">${(boss||u.phone===o.shooterPhone)&&o.status==='confirmed'?`<button data-wf="checkin" data-id="${esc(o.id)}">Check-in</button>`:''}${(boss||u.phone===o.shooterPhone)&&o.status==='shooting'?`<button data-wf="shot" data-id="${esc(o.id)}">Xác nhận đã chụp</button>`:''}${(boss||u.phone===o.shooterPhone)&&o.status==='shot'?`<button data-wf="send-originals" data-id="${esc(o.id)}">Gửi ảnh gốc</button>`:''}${boss&&!o.policy&&!['booked','confirmed','shooting','shot','cancelled','delivered'].includes(o.status)?`<button data-wf="apply-policy" data-id="${esc(o.id)}">Bổ sung quy tắc tiền công</button>`:''}</div>
        ${(boss||u.role==='sale')&&o.status!=='cancelled'&&o.collected<o.price+(o.extraFees||0)?`<details><summary>Đối soát khoản khách đã thanh toán</summary><form data-wf-form="payment" data-id="${esc(o.id)}" class="wf-form">${field('Số tiền thực nhận','amount','number','',`required min="1" max="${o.price+(o.extraFees||0)-o.collected}" step="1"`)}${field('Mã giao dịch / phiếu thu','reference','text','','required maxlength="150"')}<button>Xác nhận tiền đã nhận</button></form></details>`:''}
        </article>`;
      }).join('')||'<p>Chưa có lịch được phân công. Lịch Sale tạo sẽ xuất hiện tại đây, không cần nhập lại khách.</p>'}</div>
      </section><section data-wf-income-rest> ${boss?`<h3>Tất toán tháng ${esc(month)}</h3><div class="wf-table-wrap"><table><thead><tr><th>Nhân viên</th><th>Tổng đã chốt</th><th>Đã trả</th><th>Còn lại</th><th>Thanh toán</th></tr></thead><tbody>${[...new Set(entries.filter(e=>['approved','paid'].includes(e.status)).map(e=>e.phone))].map(phone=>{const rows=entries.filter(e=>e.phone===phone),sum=status=>rows.filter(e=>e.status===status).reduce((n,e)=>n+(e.amount||0),0);return `<tr><td>${esc(staffName(phone))}</td><td>${vnd(sum('approved')+sum('paid'))}</td><td>${vnd(sum('paid'))}</td><td>${vnd(sum('approved'))}</td><td>${sum('approved')?`<form data-wf-form="pay-month"><input type="hidden" name="phone" value="${esc(phone)}"><input type="hidden" name="month" value="${month}"><input name="reference" required maxlength="150" placeholder="Mã chuyển khoản / phiếu chi"><button>Đã trả</button></form>`:'Đã trả'}</td></tr>`;}).join('')}</tbody></table></div>`:''}
      <h3>Sổ tiền công ${boss?'toàn studio':'của tôi'}</h3><p>Chỉ phát sinh công chụp sau khi xác nhận đã chụp, công chỉnh sau khi gửi ảnh hoàn tất. Tự chốt khi khách hài lòng và thanh toán đủ.</p>
      <div class="wf-table-wrap"><table><thead><tr><th>Đơn / khách</th>${boss?'<th>Người nhận</th>':''}<th>Công việc</th><th>Số tiền</th><th>Trạng thái</th><th>Đối soát</th></tr></thead><tbody>${entries.map(e=>`<tr class="wf-money-${esc(e.status)}"><td>${esc(e.orderCode)}<small>${esc(e.customerName)}</small></td>${boss?`<td>${esc(staffName(e.phone))}</td>`:''}<td>${kinds[e.kind]}${e.kind==='extra-edit'?' · '+e.quantity+' ảnh':''}</td><td>${vnd(e.amount)}</td><td><span class="wf-money-tag">${stages[e.status]}</span></td><td>${e.reference?esc(e.reference):e.status==='pending'?esc(e.waitReason||'Chờ khách xác nhận'):'Đã chốt'}</td></tr>`).join('')||'<tr><td colspan="6">Chưa phát sinh tiền công trong tháng này.</td></tr>'}</tbody></table></div>
      </section>${boss?`<section id="wf-pane-settings" role="tabpanel" aria-labelledby="wf-tab-settings" data-wf-pane="settings"><details open class="wf-settings"><summary>Cấu hình gói, mức chia cố định & nhân sự</summary><p>Mức chia mẫu để xem quy trình. Sửa mức tại đây cho các đơn xác nhận cọc về sau; không đổi số tiền đã chốt của đơn cũ.</p>
      <form data-wf-form="settings" class="wf-form">${field('Số ngày tự coi là hài lòng','satisfactionDays','number',state.settings?.satisfactionDays ?? 3,'required min="1" max="365"')}<button>Lưu số ngày</button></form><form data-wf-form="rule" class="wf-form">${field('Dịch vụ','service','text','Newborn','required list="wfServices"')}<datalist id="wfServices">${['Newborn','Bé lớn','Sinh nhật','Bầu','Gia đình'].map(x=>`<option>${x}</option>`).join('')}</datalist>${field('Tên gói','pkg','text','Cơ bản','required')}${field('Giá gói','price','number',1500000,'required min="1" step="1"')}${field('% hoa hồng Sale','sale','number',5,'required min="0" max="100" step="0.01"')}${field('Công chụp / gói','shoot','number',300000,'required min="0" step="1"')}${field('Công chỉnh / gói','edit','number',150000,'required min="0" step="1"')}${field('Công chỉnh thêm / ảnh','extraEditPerPhoto','number',20000,'required min="0" max="50000" step="1"')}<button>Lưu phiên bản mức chia</button></form>
      <div class="wf-table-wrap"><table><thead><tr><th>Dịch vụ / gói</th><th>Giá gói</th><th>Sale</th><th>Chụp</th><th>Chỉnh trong gói</th><th>Chỉnh thêm / ảnh</th></tr></thead><tbody>${rules.map(r=>`<tr><td>${esc(r.service)} / ${esc(r.pkg)} ${r.sample?'(mẫu)':''}</td><td>${vnd(r.price)}</td><td>${r.sale.mode==='percent'?esc(r.sale.value)+'%':vnd(r.sale.value)}</td><td>${vnd(r.shoot.value)}</td><td>${vnd(r.edit.value)}</td><td>${vnd(r.extraEditPerPhoto)}</td></tr>`).join('')}</tbody></table></div>
      <h4>Gán công việc theo tài khoản nhân sự</h4><form data-wf-form="employee" class="wf-form">${field('Tên nhân sự','name','text','','required')}${field('SĐT tài khoản đăng nhập','phone','tel','','required pattern="0[0-9]{9,10}"')}<label>Vai trò<select name="role"><option value="tho-anh">Thợ chụp / chỉnh ảnh</option><option value="sale">Sale</option></select></label><button>Lưu nhân sự</button></form><p>${state.employees.map(e=>esc(e.name)+' · '+esc(e.phone)+' · '+(e.role==='sale'?'Sale':'Thợ ảnh')).join('<br>')}</p></details></section>
      `:''}<p class="wf-message" role="status"></p>`;
    body.querySelector('[data-wf-pane="income"]').append(...body.querySelector('[data-wf-income-rest]').childNodes);
    body.querySelector('[data-wf-income-rest]').remove();
    const orders=body.querySelector('.wf-orders'),done=document.createElement('details');
    done.className='wf-done';
    orders.querySelectorAll('.wf-order').forEach((card,i)=>{
      const order=state.orders.slice().reverse()[i];
      const payment=card.querySelector('[data-wf-form=payment]')?.closest('details');
      if(payment)card.querySelector('.wf-order-detail').append(payment);
      const actions=card.querySelector('.wf-actions');
      if(['delivered','cancelled'].includes(order.status)) {
        const row=document.createElement('details'),summary=document.createElement('summary');row.className='wf-order-done';
        summary.append(card.querySelector('.wf-head'));row.append(summary,...card.children);done.append(row);card.remove();
      }
      if(!actions.children.length&&!['delivered','cancelled'].includes(order.status)) {
        const link=document.createElement('a');link.className='wf-next';
        link.href=order.status==='booked'?(boss?'sale.html#dat-coc':'#tin-nhan'):'#anh';
        link.textContent=order.status==='booked'?(boss?'Xác nhận cọc':'Nhắn Sale'):order.status==='editing'?'Chỉnh & giao ảnh':'Xem tiến độ ảnh';actions.append(link);
      }
    });
    if(done.children.length) {const summary=document.createElement('summary');summary.textContent='Đã xong ('+done.children.length+')';done.prepend(summary);orders.after(done);}
    body.querySelectorAll('table').forEach(table=>{const labels=[...table.querySelectorAll('th')].map(th=>th.textContent);table.querySelectorAll('tbody tr').forEach(tr=>[...tr.children].forEach((td,i)=>td.dataset.label=td.colSpan>1?'':labels[i]||''));});
    selectTab(tab);
    body.querySelector('#wfMonth').onchange=e=>{month=e.target.value;render();};
    body.querySelectorAll('button').forEach(b=>b.disabled=busy);
  }
  async function run(command,data) {
    if(busy) return;busy=true;error='';render();
    try {state=await AlohaWorkflow.command(command,data);} catch(e) {error=e.message;}
    finally {busy=false;render();}
  }
  body.addEventListener('click',async e=>{
    const t=e.target.closest('[data-wf-tab]');if(t){selectTab(t.dataset.wfTab);return;}
    const b=e.target.closest('[data-wf]');if(!b)return;
    const command=b.dataset.wf;
    if(command==='reload') {try{state=await AlohaWorkflow.refresh();error='';}catch(err){error=err.message;}render();return;}
    if(command==='send-originals') {location.hash='anh';window.dispatchEvent(new CustomEvent('aloha:choose-source-order',{detail:b.dataset.id}));return;}
    run(command,{id:b.dataset.id});
  });
  body.addEventListener('keydown',e=>{
    const t=e.target.closest('[data-wf-tab]');if(!t||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
    e.preventDefault();let i=tabs.findIndex(x=>x[0]===tab);
    i=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
    selectTab(tabs[i][0]);body.querySelector('[data-wf-tab="'+tab+'"]').focus();
  });
  body.addEventListener('submit',e=>{
    const form=e.target.closest('[data-wf-form]');if(!form)return;e.preventDefault();const command=form.dataset.wfForm;
    const data=Object.fromEntries(new FormData(form));data.id=form.dataset.id||AlohaWorkflow.id();
    if(command==='settings')data.satisfactionDays=Number(data.satisfactionDays);
    if(command==='payment')data.amount=Number(data.amount);
    if(command==='rule') {['sale','shoot','edit'].forEach(k=>data[k]={mode:k==='sale'?'percent':'fixed',value:Number(data[k])});data.price=Number(data.price);data.extraEditPerPhoto=Number(data.extraEditPerPhoto);}
    run(command,data);
  });
  window.addEventListener('aloha:workflow',e=>{state=e.detail;render();});
  render();AlohaWorkflow.refresh().then(s=>{state=s;render();}).catch(e=>{body.textContent=e.message;});
  if(AlohaWorkflow.enabled())setInterval(()=>{if(!body.querySelector('form:focus-within'))AlohaWorkflow.refresh().catch(()=>{});},10000);
});
