const express = require('express');
const core = require('../js/workflow-core');
const {createStoreFromEnv, safeError} = require('./edit-requests-store');
const {requireAuth, EDIT_DEMO_SCOPE, isPublicDemoPhone} = require('./sale-chat');
function createService(store) {
  let queue=Promise.resolve(), requestsStore=null;
  const initial=() => ({id:'studio-workflow',rev:1,...core.seed(),createdAt:Date.now(),updatedAt:Date.now()});
  async function read() {
    let s=await store.get('studio-workflow');
    if(!s) { try { s=await store.insert(initial()); } catch(e) { s=await store.get('studio-workflow'); if(!s) throw e; } }
    return s;
  }
  function update(fn) {
    const run=queue.then(async () => {
      for(let i=0;i<5;i++) {
        const s=await read(), next=fn(s);
        const result=await store.updateIfRev(s.id,s.rev,{orders:next.orders,rules:next.rules,entries:next.entries,employees:next.employees,audit:next.audit,settings:next.settings || {}});
        if(result && result.doc) return result.doc;
      }
      throw new Error('Dữ liệu vừa thay đổi. Vui lòng tải lại và thử lại.');
    });
    queue=run.catch(()=>{}); return run;
  }
  return {
    read, storeKind:store.kind,
    // Làm mới đơn của khách demo: về "đang chọn ảnh", bỏ các lượt chỉnh + tiền công chỉnh chưa trả
    resetDemoOrders(ids) { return update(s=>{const next=JSON.parse(JSON.stringify(s));
      next.orders.filter(o=>ids.includes(o.id)).forEach(o=>{Object.assign(o,{status:'choosing',rounds:{},requestIds:[],firstRequestId:null,extraFees:0,deliveredAt:null,customerFeedback:null,updatedAt:Date.now()});});
      next.entries=next.entries.filter(e=>!(ids.includes(e.orderId) && ['edit','extra-edit','sale-extra'].includes(e.kind) && e.status!=='paid'));
      return next;}); },
    attachRequestsStore(s) { requestsStore=s; },
    change(user,command,data) { return update(s => core.apply(s,user,command,data)); },
    progress(request,event) { return update(s=>core.progress(s,request,event)); },
    async sourceOrder(user,id) {
      const order=(await read()).orders.find(o=>o.id===id);
      if(!order || user.role!=='tho-anh' || order.shooterPhone!==user.phone || !order.shotAt) throw new Error('Chọn buổi chụp đã hoàn tất do bạn phụ trách.');
      return order;
    },
    async originalDelivered(id,albumId) {
      return update(s=>{const next=JSON.parse(JSON.stringify(s)),o=next.orders.find(o=>o.id===id); if(o && ['shot','choosing'].includes(o.status)) {o.status='choosing';o.sourceAlbumId=albumId;o.updatedAt=Date.now();} return next;});
    },
    async reconcile() {
      if(!requestsStore) return update(s=>core.reconcile(s));
      const records=(await requestsStore.listAll()).filter(r=>r.workflowOrderId).sort((a,b)=>a.createdAt-b.createdAt);
      return update(s=>{
        let next=core.expire(s);
        records.forEach(r=>{ if(!next.orders.some(o=>o.id===r.workflowOrderId)) return;
          if(r.kind==='source-album') { const o=next.orders.find(o=>o.id===r.workflowOrderId); if(['shot','choosing'].includes(o.status)) {o.status='choosing';o.sourceAlbumId=r.id;} }
          else {next=core.progress(next,r,'selected');if(r.status==='Hoàn thành') next=core.progress(next,r,'delivered');}
        }); return core.reconcile(next);
      });
    }
  };
}
function createRouter(service) {
  const router=express.Router();
  router.use(requireAuth(['sale','sep','tho-anh'],{allowScopes:[EDIT_DEMO_SCOPE]}));
  router.use((req,res,next)=>{
    if(process.env.EDIT_REQUESTS_ALLOW_PUBLIC_DEMO_STAFF!=='1' && !req.user.scope && ['sep','tho-anh'].includes(req.user.role) && isPublicDemoPhone(req.user.phone)) return res.status(403).json({error:'forbidden',message:'Tài khoản demo công khai không dùng dữ liệu nội bộ trên máy chủ.'});
    next();
  });
  router.get('/',async(req,res)=>{try {res.json({state:core.view(await service.reconcile(),req.user),store:service.storeKind});} catch(e) {console.error('workflow:',safeError(e));res.status(503).json({message:'Chưa tải được quy trình. Vui lòng thử lại.'});}});
  router.post('/commands',async(req,res)=>{try {
    const s=await service.change(req.user,req.body.command,req.body.data);
    res.json({state:core.view(s,req.user),store:service.storeKind});
  } catch(e) {res.status(400).json({message:e.message});}});
  return router;
}
const storage=createStoreFromEnv({...process.env,EDIT_REQUESTS_COLLECTION:'studio_workflow'});
if(storage.configError) console.error('workflow:',storage.configError);
const service=createService(storage.store);
module.exports={service,router:createRouter(service),createService,createRouter};
