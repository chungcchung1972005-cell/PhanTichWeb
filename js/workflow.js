(function(window) {
  const core=window.AlohaWorkflowCore, KEY='aloha_workflow_v1';
  let cache=null, storeKind='local', loading=null;
  const user=()=>window.AlohaAuth && AlohaAuth.getSession();
  const enabled=()=>!!(window.AlohaEditSync && AlohaEditSync.enabled());
  const id=()=> 'WF-'+(window.crypto.randomUUID ? crypto.randomUUID() : Date.now()+'-'+Math.random().toString(36).slice(2));
  function local() { const raw=localStorage.getItem(KEY); return raw ? JSON.parse(raw) : core.seed(); }
  function changed(state,kind) { cache=state;storeKind=kind;window.dispatchEvent(new CustomEvent('aloha:workflow',{detail:state}));return state; }
  async function call(path,body) {
    const res=await AlohaAuth.api('/api/workflow'+path,{method:body?'POST':'GET',body});
    if(!res.ok || !res.data || !res.data.state) throw new Error(res.data && res.data.message || 'Không kết nối được quy trình trên máy chủ. Chưa lưu thay đổi.');
    return changed(res.data.state,res.data.store);
  }
  async function refresh() {
    if(loading) return loading;
    loading=(enabled()?call(''):Promise.resolve().then(()=>{const raw=local(),s=core.expire(raw);if(s!==raw)localStorage.setItem(KEY,JSON.stringify(s));return changed(core.view(s,user()),'local');})).finally(()=>{loading=null;});
    return loading;
  }
  async function command(command,data) {
    if(enabled()) return call('/commands',{command,data});
    const state=core.apply(local(),user(),command,data);
    localStorage.setItem(KEY,JSON.stringify(state));return changed(core.view(state,user()),'local');
  }
  function progress(request,event) {
    if(enabled() || !request.workflowOrderId) return;
    const state=core.progress(local(),request,event);localStorage.setItem(KEY,JSON.stringify(state));
    if(user() && ['sep','sale','tho-anh'].includes(user().role)) changed(core.view(state,user()),'local');
  }
  function originalDelivered(orderId,albumId) {
    if(enabled()) return;
    const state=local(),o=state.orders.find(o=>o.id===orderId);
    if(o && ['shot','choosing'].includes(o.status)) {o.status='choosing';o.sourceAlbumId=albumId;localStorage.setItem(KEY,JSON.stringify(state));changed(core.view(state,user()),'local');}
  }
  window.addEventListener('storage',e=>{if(e.key===KEY && !enabled() && user() && ['sep','sale','tho-anh'].includes(user().role)) refresh().catch(()=>{});});
  window.AlohaWorkflow={id,refresh,command,progress,originalDelivered,enabled,get:()=>cache,store:()=>storeKind,
    localOrder(orderId) {return local().orders.find(o=>o.id===orderId);}
  };
})(window);
