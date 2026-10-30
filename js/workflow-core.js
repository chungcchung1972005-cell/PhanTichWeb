// One order connects Sale booking, crew, original delivery, retouching and staff earnings.
(function(root, factory) { const api = factory(); if (typeof module === 'object' && module.exports) module.exports = api; else root.AlohaWorkflowCore = api; })(typeof window === 'undefined' ? globalThis : window, () => {
  const copy = x => JSON.parse(JSON.stringify(x));
  const phone = x => /^0\d{9,10}$/.test(x || '');
  const money = x => Number.isSafeInteger(x) && x >= 0 && x <= 1000000000;
  const text = (x, n=120) => typeof x === 'string' ? x.trim().slice(0,n) : '';
  const fail = message => { throw new Error(message); };
  const assert = (ok, message) => { if (!ok) fail(message); };
  const internal = ['sale','sep','tho-anh'];
  const key = (service, pkg) => (service.trim()+'|'+pkg.trim()).toLocaleLowerCase('vi');
  function empty() { return {orders:[], rules:[], entries:[], employees:[], audit:[]}; }
  function seed() {
    const s=empty();
    s.employees=[{phone:'0900000002',name:'Ngọc Anh',role:'sale'},{phone:'0900000005',name:'Minh Thư',role:'sale'},{phone:'0900000006',name:'Thu Hà',role:'sale'},{phone:'0900000003',name:'Thợ ảnh demo',role:'tho-anh'}];
    ['Newborn','Bé lớn','Sinh nhật','Bầu','Gia đình'].forEach(service=>[
      {pkg:'Cơ bản',price:1500000,shoot:300000,edit:150000},
      {pkg:'Tiêu chuẩn',price:2500000,shoot:500000,edit:250000},
      {pkg:'Premium',price:3500000,shoot:700000,edit:350000}
    ].forEach((p,i)=>s.rules.push({id:'sample-'+service+'-'+i,service,pkg:p.pkg,price:p.price,sale:{mode:'percent',value:5},shoot:{mode:'fixed',value:p.shoot},edit:{mode:'fixed',value:p.edit},extraEditPerPhoto:20000,sample:true,createdAt:0})));
    return s;
  }
  const allowedOrder = (u,o) => u.role === 'sep' || (u.role === 'sale' && o.salePhone === u.phone) || (u.role === 'tho-anh' && [o.shooterPhone,o.editorPhone].includes(u.phone));
  function view(state, user) {
    const s = copy(state);
    s.orders = s.orders.filter(o => allowedOrder(user,o));
    s.entries = s.entries.filter(e => user.role === 'sep' || (e.phone === user.phone && (user.role==='sale' ? ['sale','sale-extra'].includes(e.kind) : ['shoot','edit','extra-edit'].includes(e.kind))));
    if (user.role !== 'sep') {
      s.audit = [];
      // Booking needs public package names/prices, never the studio compensation schedule.
      s.rules = user.role==='sale' ? s.rules.map(r=>({id:r.id,service:r.service,pkg:r.pkg,price:r.price})) : [];
      s.orders.forEach(o => { o.myEstimate=o.policy ? (user.role==='sale' && user.phone===o.salePhone?cut(o.policy.sale,o.price):0)+(user.role==='tho-anh' && user.phone===o.shooterPhone?cut(o.policy.shoot,o.price):0)+(user.role==='tho-anh' && user.phone===o.editorPhone?cut(o.policy.edit,o.price):0) : null; delete o.policy; });
    }
    return s;
  }
  function policyFor(s,o) { return s.rules.slice().reverse().find(r => key(r.service,r.pkg) === key(o.service,o.pkg)) || null; }
  const cut = (r,price) => r.mode === 'percent' ? Math.round(price*r.value/100) : r.value;
  function expire(input,now=Date.now()) {
    if(!input.orders.some(o=>o.status==='booked' && o.collected===0 && o.createdAt+3600000<=now))return input;
    const s=copy(input);
    s.orders.filter(o=>o.status==='booked' && o.collected===0 && o.createdAt+3600000<=now).forEach(o=>{o.status='cancelled';o.updatedAt=now;log(s,{phone:'system',name:'Hết giờ giữ lịch'},'expired',o.id,now);});return s;
  }
  const monthOf = t => new Date(t).toLocaleDateString('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'}).slice(0,7);
  function reconcile(input,now=Date.now()) {
    const s=copy(expire(input,now));
    s.orders.forEach(o=>{
      const settled=r=>r && r.deliveredAt && r.customerFeedback!=='revision' && (r.customerFeedback==='satisfied' || now>=r.deliveredAt+(s.settings?.satisfactionDays ?? 3)*86400000);
      const done=o.status==='delivered' && o.deliveredAt && o.customerFeedback!=='revision' && (o.customerFeedback==='satisfied' || now>=o.deliveredAt+(s.settings?.satisfactionDays ?? 3)*86400000);
      o.completed=o.rounds ? Object.values(o.rounds).every(settled) : !!done;
      s.entries.filter(e=>e.orderId===o.id && e.status!=='paid').forEach(e=>{
        const roundId=e.requestId || (o.rounds && Object.keys(o.rounds).find(id=>e.id.startsWith(id+':')));
        const r=o.rounds && o.rounds[roundId || o.firstRequestId];
        const ready=r ? settled(r) : done;
        const funded=o.collected>=o.price+(o.extraFees||0) || (r && o.collected-(o.extraFees||0)>=o.price && r.paid);
        const eligible=ready && funded && e.amount!==null;
        if(eligible && e.status==='pending') {e.status='approved';e.approvedAt=now;e.confirmedMonth=monthOf(now);}
        e.waitReason=ready && !funded?'Chờ khách thanh toán đủ':'Chờ khách xác nhận';
      });
    });return s;
  }
  function amounts(policy,price) { return policy ? {sale:cut(policy.sale,price),shoot:cut(policy.shoot,price),edit:cut(policy.edit,price)} : null; }
  function log(s,u,action,id,now) { s.audit.push({id,action,by:u.phone,name:u.name || '',at:now}); }
  function accrue(s,o,kind,person,id,quantity,now) {
    if (s.entries.some(e => e.id === id)) return;
    const values = amounts(o.policy,o.price);
    const amount = !values ? null : kind === 'sale-extra' ? (o.policy.sale.mode==='percent'?cut(o.policy.sale,quantity):0) : kind === 'extra-edit' ? quantity*o.policy.extraEditPerPhoto : values[kind];
    s.entries.push({id,orderId:o.id,orderCode:o.code,customerName:o.customerName,kind,phone:person,quantity,amount,policyId:o.policy && o.policy.id,status:'pending',createdAt:now});
  }
  function apply(input,user,command,data,now=Date.now()) {
    assert(user && internal.includes(user.role), 'Không có quyền quản lý quy trình.');
    const s = copy(reconcile(input || empty(),now)); const d = data || {};
    if (command === 'employee') {
      assert(user.role === 'sep','Chỉ Sếp được quản lý nhân sự.');
      assert(phone(d.phone) && text(d.name) && ['sale','tho-anh'].includes(d.role),'Nhân sự cần tên, SĐT đăng nhập và vai trò hợp lệ.');
      const exists = s.employees.find(e => e.phone === d.phone);
      assert(!exists || exists.role === d.role || !s.orders.some(o => [o.salePhone,o.shooterPhone,o.editorPhone].includes(d.phone)), 'Nhân sự đã có đơn; không đổi vai trò trên dữ liệu cũ.');
      s.employees = s.employees.filter(e => e.phone !== d.phone).concat([{phone:d.phone,name:text(d.name),role:d.role}]);
    } else if (command === 'rule') {
      assert(user.role === 'sep','Chỉ Sếp được cấu hình chia tiền.');
      assert(text(d.service) && text(d.pkg) && money(d.extraEditPerPhoto) && d.extraEditPerPhoto <= 50000,'Nhập dịch vụ, gói và công chỉnh thêm từ 0 đến 50.000đ/ảnh.');
      ['sale','shoot','edit'].forEach(k => assert(d[k] && ['fixed','percent'].includes(d[k].mode) && Number.isFinite(d[k].value) && d[k].value >= 0 && (d[k].mode === 'percent' ? d[k].value <= 100 : money(d[k].value)),'Mức chia tiền chưa hợp lệ.'));
      assert(['sale','shoot','edit'].reduce((n,k) => n + (d[k].mode === 'percent' ? d[k].value : 0),0) <= 100,'Tổng tỷ lệ không được vượt 100%.');
      assert(money(d.price) && d.price > 0,'Nhập giá gói áp dụng.');
      s.rules.push({id:text(d.id,80),service:text(d.service),pkg:text(d.pkg),price:d.price,sale:copy(d.sale),shoot:copy(d.shoot),edit:copy(d.edit),extraEditPerPhoto:d.extraEditPerPhoto,createdAt:now});
    } else if (command === 'book') {
      assert(['sale','sep'].includes(user.role),'Chỉ Sale hoặc Sếp được tạo lịch.');
      assert(text(d.id,80) && /^#?[A-Za-z0-9-]{3,29}$/.test(d.code || '') && phone(d.phone) && text(d.customerName) && text(d.service) && text(d.pkg) && money(d.price) && d.price > 0,'Cần khách, mã đơn, dịch vụ, gói và giá gói hợp lệ.');
      assert(/^\d{4}-\d{2}-\d{2}$/.test(d.date || '') && /^([01]\d|2[0-3]):[0-5]\d$/.test(d.time || ''),'Ngày giờ chụp không hợp lệ.');
      assert(!s.orders.some(o => o.id === d.id || o.code.replace(/^#/,'') === d.code.replace(/^#/,'')),'Mã đơn đã tồn tại. Tải lại lịch để chọn mã mới.');
      const existing=s.orders.find(o=>o.phone===d.phone && o.status!=='cancelled');
      assert(user.role==='sep' || !existing || existing.salePhone===user.phone,'Khách này đã có Sale khác phụ trách. Cần chuyển giao trước khi tạo đơn mới.');
      const salePhone = user.role === 'sale' ? user.phone : d.salePhone;
      assert(phone(salePhone),'Cần gán Sale phụ trách.');
      [d.shooterPhone,d.editorPhone].forEach(p => assert(s.employees.some(e => e.role === 'tho-anh' && e.phone === p),'Chọn thợ chụp và thợ chỉnh từ danh sách nhân sự do Sếp cấu hình.'));
      const duration = Number(d.duration) || 120; assert(Number.isInteger(duration) && duration >= 30 && duration <= 480,'Thời lượng buổi chụp không hợp lệ.');
      const minutes = t => +t.slice(0,2)*60 + +t.slice(3);
      assert(!s.orders.some(o => o.status !== 'cancelled' && o.date === d.date && (o.shooterPhone === d.shooterPhone || (d.room && d.room!=='Ngoài' && o.room===d.room)) && minutes(o.time) < minutes(d.time)+duration && minutes(o.time)+o.duration > minutes(d.time)), 'Thợ hoặc phòng đã có lịch trùng giờ.');
      const o = {id:text(d.id,80),code:d.code,phone:d.phone,customerName:text(d.customerName),customerId:existing && existing.customerId || text(d.customerId,80),service:text(d.service),pkg:text(d.pkg),price:d.price,date:d.date,time:d.time,duration,room:text(d.room),salePhone,shooterPhone:d.shooterPhone,editorPhone:d.editorPhone,status:'booked',collected:0,payments:[],createdAt:now,updatedAt:now,policy:null};
      s.orders.push(o);
    } else if(command==='settings') {
      assert(user.role==='sep' && Number.isInteger(d.satisfactionDays) && d.satisfactionDays>=1 && d.satisfactionDays<=365,'Số ngày phải từ 1 đến 365.');
      s.settings={...s.settings,satisfactionDays:d.satisfactionDays};
    } else if(command==='pay-month') {
      assert(user.role==='sep' && /^\d{4}-\d{2}$/.test(d.month||'') && text(d.reference,150),'Cần tháng và mã chuyển khoản/phiếu chi.');
      assert(!s.entries.some(e=>e.reference===text(d.reference,150)),'Mã chi đã được sử dụng.');
      const entries=s.entries.filter(e=>e.phone===d.phone && e.status==='approved' && (e.confirmedMonth||monthOf(e.approvedAt))===d.month);
      assert(entries.length,'Không còn khoản đã chốt cần trả trong tháng.');
      entries.forEach(e=>{e.status='paid';e.paidAt=now;e.reference=text(d.reference,150);e.paidBy=user.phone;});
    } else {
      const o = s.orders.find(o => o.id === d.id); assert(o && allowedOrder(user,o),'Không tìm thấy đơn thuộc quyền phụ trách.');
      if (command === 'payment') {
        assert(user.role === 'sep' || (user.role === 'sale' && o.salePhone === user.phone),'Chỉ Sale phụ trách hoặc Sếp được đối soát tiền khách.');
        assert(money(d.amount) && d.amount > 0 && text(d.reference,150),'Cần số tiền thực nhận và mã giao dịch/phiếu thu.');
        assert(!s.orders.some(x => x.payments.some(p => p.reference === text(d.reference,150))),'Mã giao dịch này đã được ghi nhận.');
        assert(o.status !== 'cancelled' && o.collected+d.amount <= o.price+(o.extraFees || 0),'Số tiền vượt công nợ hoặc đơn đã hủy.');
        o.payments.push({amount:d.amount,reference:text(d.reference,150),by:user.phone,at:now}); o.collected+=d.amount;
        if (o.status === 'booked' && o.collected >= Math.ceil(o.price*.5)) { o.status='confirmed'; o.policy=copy(policyFor(s,o)); }
      } else if (command === 'checkin') {
        assert(user.role === 'sep' || user.phone === o.shooterPhone,'Chỉ thợ chụp phụ trách hoặc Sếp được check-in.');
        assert(o.status === 'confirmed','Lịch phải được xác nhận cọc trước khi check-in.'); o.status='shooting';
      } else if (command === 'shot') {
        assert(user.role === 'sep' || user.phone === o.shooterPhone,'Chỉ thợ chụp phụ trách hoặc Sếp được xác nhận đã chụp.');
        assert(o.status === 'shooting','Cần check-in trước khi xác nhận đã chụp.'); o.status='shot'; o.shotAt=now;
        accrue(s,o,'sale',o.salePhone,o.id+':sale',1,now); accrue(s,o,'shoot',o.shooterPhone,o.id+':shoot',1,now);
      } else if (command === 'apply-policy') {
        assert(user.role === 'sep','Chỉ Sếp được bổ sung quy tắc cho đơn.');
        assert(!o.policy,'Đơn đã chốt quy tắc; không thay đổi tiền công của dữ liệu cũ.');
        const p = policyFor(s,o); assert(p,'Chưa có quy tắc cho dịch vụ/gói này.');
        const a = amounts(p,o.price); assert(a.sale+a.shoot+a.edit <= o.price,'Tổng chia vượt giá gói.'); o.policy=copy(p);
        s.entries.filter(e => e.orderId===o.id && e.amount===null && e.status==='pending').forEach(e => { e.amount=e.kind==='sale-extra'?(p.sale.mode==='percent'?cut(p.sale,e.quantity):0):e.kind==='extra-edit'?e.quantity*p.extraEditPerPhoto:a[e.kind]; e.policyId=p.id; });
      } else if (command === 'cancel') {
        assert(['sale','sep'].includes(user.role) && o.status==='booked' && o.collected===0,'Chỉ hủy lịch chưa cọc và chưa thực hiện.'); o.status='cancelled';
      } else fail('Thao tác không hợp lệ.');
      o.updatedAt=now;
    }
    s.orders.forEach(o => { const a=amounts(o.policy,o.price); if(a) assert(a.sale+a.shoot+a.edit<=o.price,'Tổng tiền Sale + công chụp + công chỉnh vượt giá gói.'); });
    if(command==='rule') {const p=s.rules.at(-1),a=amounts(p,p.price);assert(a.sale+a.shoot+a.edit<=p.price,'Tổng chia tiền không được vượt giá gói.');}
    log(s,user,command,d.id || '',now); return reconcile(s,now);
  }
  // Server / local store use these hooks with authoritative edit-request data only.
  function progress(input,request,event,now=Date.now()) {
    const s=copy(input), o=s.orders.find(o => o.id===request.workflowOrderId);
    assert(o,'Không tìm thấy đơn liên kết.');
    if(!o.rounds) o.rounds={};
    if(!o.firstRequestId || (request.round||1)===1) o.firstRequestId=request.id;
    const previous=o.rounds[request.id] || {};
    o.rounds[request.id]={...previous,paid:!!request.verifiedPayment || !(request.extraFee>0)};
    if(event==='selected') {
      const tag='request:'+request.id;
      if(!o.requestIds) o.requestIds=[];
      if(!o.requestIds.includes(tag)) { o.requestIds.push(tag); o.extraFees=(o.extraFees||0)+(request.extraFee||0); o.status='editing'; o.customerFeedback=null; o.deliveredAt=null; }
      if(request.extraFee>0) accrue(s,o,'sale-extra',o.salePhone,request.id+':sale-extra',request.extraFee,now);
      const receipt=request.verifiedPayment;
      if(receipt && money(receipt.amount) && receipt.amount===(request.extraFee||0) && !s.orders.some(order=>order.payments.some(p=>p.reference===receipt.reference))) {
        o.payments.push({amount:receipt.amount,reference:receipt.reference,by:'sepay',at:now});o.collected+=receipt.amount;
      }
    } else if(event==='delivered') {
      const round=request.round||1;
      if(round===1) accrue(s,o,'edit',o.editorPhone,request.id+':edit',1,now);
      const count=round===1 ? request.extraCount||0 : request.photoCount;
      if(count) accrue(s,o,'extra-edit',o.editorPhone,request.id+':extra-edit',count,now);
      Object.assign(o.rounds[request.id],{deliveredAt:request.completedAt || previous.deliveredAt || request.updatedAt || now,customerFeedback:Object.prototype.hasOwnProperty.call(request,'customerFeedback')?request.customerFeedback:previous.customerFeedback || null});
      if(request.id===o.firstRequestId) {o.deliveredAt=o.rounds[request.id].deliveredAt;o.customerFeedback=request.customerFeedback || null;}

    }
    o.status=Object.values(o.rounds).every(r=>r.deliveredAt)?'delivered':'editing';
    o.updatedAt=now; return reconcile(s,now);
  }
  return {empty,seed,expire,reconcile,apply,view,progress,amounts,cut,allowedOrder};
});
