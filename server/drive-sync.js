const crypto=require('crypto');
const FOLDER='application/vnd.google-apps.folder';
const normalize=s=>String(s).replace(/\s/g,'').toLowerCase();
const escape=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function instruction(r) {
  const cell='style="border:1px solid #ccc;padding:6px;vertical-align:top"';
  const rows=r.photos.map((p,i)=>'<tr><td '+cell+'>'+(i+1)+'</td><td '+cell+'><img width="120" src="https://drive.google.com/thumbnail?id='+encodeURIComponent(p.driveFileId)+'&amp;sz=w200"></td><td '+cell+'><b>'+escape(p.name)+'</b></td><td '+cell+'>'+escape((p.editOptions||[]).join(', ')||'Theo ghi chú chung')+'</td><td '+cell+'>'+escape(p.note)+'</td></tr>').join('');
  return '<!doctype html><html><head><meta charset="utf-8"><title>Yêu cầu chỉnh</title></head><body>'+
    '<h1>Yêu cầu chỉnh ảnh · '+escape(r.orderCode)+'</h1>'+
    '<p><b>Khách:</b> '+escape(r.customerName)+' · <b>Lượt:</b> '+escape(r.round)+' · <b>Số ảnh:</b> '+r.photos.length+'</p>'+
    (r.note?'<p><b>Ghi chú chung:</b> '+escape(r.note)+'</p>':'')+
    '<p>Chỉnh xong lưu vào thư mục <b>DA-CHINH</b> cùng lượt, <b>giữ nguyên tên file</b>.</p>'+
    '<table style="border-collapse:collapse"><tr><th '+cell+'>#</th><th '+cell+'>Ảnh</th><th '+cell+'>Tên file</th><th '+cell+'>Khách muốn sửa</th><th '+cell+'>Ghi chú</th></tr>'+rows+'</table></body></html>';
}

function createService({store,workflow,syncStore,drive=require('./drive'),enabled=()=>require('./drive-auth').isConnected(),env=process.env,now=Date.now}) {
  let running=false,lastKick=-Infinity,folderQueue=Promise.resolve(),originalQueue=Promise.resolve(),originalCache=new Map(); const jobs=new Map();
  async function patch(id,set) {for(let i=0;i<20;i++){const r=await store.get(id);if(!r)throw Error('request_missing');const out=await store.updateIfRev(id,r.rev,set);if(out?.doc)return out.doc;}throw Error('drive_state_conflict');}
  function folder(parent,name) {
    const result=folderQueue.then(async()=>{const f=await drive.ensureFolder(parent,name);await drive.shareFolder(f.id);return f.id;});
    folderQueue=result.catch(()=>{});return result;
  }
  async function root() {const id=env.ALOHA_DRIVE_ROOT_ID || await syncStore.getRoot() || await folder('root','ALOHA');await syncStore.setRoot(id);return id;}
  async function orderFolder(o) {
    const rootId=await root(), children=await drive.listFiles(rootId), saved=await syncStore.getFolder(o.id);
    const id=children.find(f=>f.id===saved && f.mimeType===FOLDER)?.id ||
      children.find(f=>f.mimeType===FOLDER && normalize(f.name)===normalize(o.code))?.id || await folder(rootId,o.code);
    await syncStore.setFolder(o.id,id);await drive.shareFolder(id);return id;
  }
  async function syncOnce() {
    if(!enabled())return {disabled:true};if(running)return {locked:true};running=true;
    try {
      let cursor=await syncStore.getCursor();if(!cursor)cursor=(await drive.getStartPageToken()).startPageToken;
      let next=cursor;
      try {
        do {const changes=await drive.listChanges(next);next=changes.nextPageToken;if(!next)cursor=changes.newStartPageToken||cursor;}while(next);
      } catch(e) {
        if(e.status!==410)throw e;
        cursor=(await drive.getStartPageToken()).startPageToken;
      }
      await root();
      // Full reconciliation also catches missed moves and files waiting for a second stable observation.
      const knownAlbums=(await store.listAll()).filter(a=>a.kind==='source-album');
      for(const o of (await workflow.read()).orders.filter(o=>['shot','choosing'].includes(o.status) || (o.status!=='cancelled' && knownAlbums.some(a=>a.workflowOrderId===o.id)))) {
        const parent=await orderFolder(o), goc=(await drive.listFiles(parent)).find(f=>f.mimeType===FOLDER && f.name==='GOC');if(!goc){await folder(parent,'GOC');continue;}
        const files=(await drive.listFiles(goc.id)).filter(f=>f.mimeType?.startsWith('image/'));
        const previous=(await syncStore.getState('scan:'+goc.id))?.files||{},observed={},stable=[];
        for(const f of files){const sig=String(f.size)+':'+(f.modifiedTime||'');observed[f.id]=sig;if(Number(f.size)>0 && previous[f.id]===sig)stable.push({id:'drive-'+f.id,driveFileId:f.id,name:f.name,resourceKey:f.resourceKey||'',src:'https://drive.google.com/thumbnail?id='+encodeURIComponent(f.id)+'&sz=w1000',driveUrl:'https://drive.google.com/file/d/'+encodeURIComponent(f.id)+'/view'});}
        await syncStore.setState('scan:'+goc.id,{files:observed});if(!stable.length)continue;
        const albums=(await store.listAll()).filter(a=>a.kind==='source-album'&&a.workflowOrderId===o.id);
        let album=albums.find(a=>a.folderId===goc.id)||albums[0];
        const data={driveManaged:true,folderId:goc.id,folderUrl:'https://drive.google.com/drive/folders/'+goc.id,photos:stable};
        if(album){if(JSON.stringify(album.photos)!==JSON.stringify(stable)||album.folderId!==goc.id)album=await patch(album.id,data);}
        else {if(await store.count()>=2000)throw Error('store_full');album=await store.insert({id:'AL-auto-'+crypto.createHash('sha256').update(o.id).digest('hex').slice(0,24),kind:'source-album',phone:o.phone,orderCode:o.code,workflowOrderId:o.id,shooterPhone:o.shooterPhone,editorPhone:o.editorPhone,customerName:o.customerName,serviceLabel:o.service,staffName:'Drive',createdAt:now(),updatedAt:now(),rev:1,...data});}
        await workflow.originalDelivered(o.id,album.id);
      }
      for(const r of await store.listAll()) {
        if(r.kind==='source-album' || r.status==='Hoàn thành' || r.driveJob?.status!=='done' || !r.driveJob.outputFolderId)continue;
        try {await require('./drive-delivery').scan({store,workflow,syncStore,drive,request:r,now,env});}
        catch(e) {
          const current=await store.get(r.id);
          if(current && current.rev===r.rev && current.status!=='Hoàn thành')
            await store.updateIfRev(r.id,r.rev,{driveJob:{...r.driveJob,delivery:{status:'waiting',matched:0,total:r.photos.length,missing:r.photos.map(p=>p.name),unknown:[],error:'Không quét được ảnh đã chỉnh. Vui lòng thử lại.'}}},{notDone:true});
        }
      }
      await syncStore.setCursor(cursor);return {ok:true};
    } finally {running=false;}
  }
  async function runJob(id) {
    let r=await store.get(id);if(!r||r.kind==='source-album'||r.driveJob?.status==='done')return;
    let job={...r.driveJob,status:'copying',message:''};await patch(id,{driveJob:job});
    try {
      const o=(await workflow.read()).orders.find(o=>o.id===r.workflowOrderId);if(!o)throw Error('order_missing');
      job.orderFolderId=await orderFolder(o);job.roundFolderId=await folder(job.orderFolderId,'LUOT-'+r.round);
      job.inputFolderId=await folder(job.roundFolderId,'CAN-CHINH');job.outputFolderId=await folder(job.roundFolderId,'DA-CHINH');job.copies={...job.copies};await patch(id,{driveJob:job});
      const existing=await drive.listFiles(job.inputFolderId);
      for(const p of r.photos) {
        if(!p.driveFileId)throw Error('photo_missing_drive_id');
        if(!job.copies[p.id]) {const found=existing.find(f=>f.appProperties?.alohaRequest===id && f.appProperties?.alohaPhoto===p.id);const f=found||await drive.copyFile(p.driveFileId,job.inputFolderId,p.name,{alohaRequest:id,alohaPhoto:p.id});job.copies[p.id]=f.id;await patch(id,{driveJob:job});}
      }
      if(!job.htmlFileId){const found=existing.find(f=>/^YEU-CAU-CHINH/.test(f.name));job.htmlFileId=found?.id||(await drive.uploadText(job.inputFolderId,'YEU-CAU-CHINH','text/html',instruction(r),'application/vnd.google-apps.document')).id;}
      job.status='done';await patch(id,{driveJob:job});
    } catch(e) {job.status='error';job.message='Không chép được ảnh lên Drive. Vui lòng thử lại.';await patch(id,{driveJob:job});}
  }
  function enqueue(id) {if(!enabled()||jobs.has(id))return jobs.get(id);const pending=new Promise(resolve=>setImmediate(resolve)).then(()=>runJob(id)).finally(()=>jobs.delete(id));jobs.set(id,pending);pending.catch(()=>console.error('drive job: state unavailable'));return pending;}
  function kick(){if(enabled()&&now()-lastKick>=30000){lastKick=now();syncOnce().catch(()=>console.error('drive sync failed'));}}
  function start(){if(!enabled())return;const t=setInterval(()=>{syncOnce().catch(()=>console.error('drive sync failed'));store.listAll().then(rs=>rs.filter(r=>r.driveJob&&['pending','copying'].includes(r.driveJob.status)).forEach(r=>enqueue(r.id))).catch(()=>{});},90000);t.unref();return t;}
  return {syncOnce,enqueue,kick,start,enabled,originalFolder(o){
    // Xếp hàng: thợ kéo nhiều ảnh cùng lúc → nhiều lệnh gọi song song; chạy lần lượt để ensureFolder
    // thấy thư mục lần trước vừa tạo, không đẻ trùng thư mục đơn / GOC (lỗi thấy trên web thật 31/10/2026).
    if(originalCache.has(o.id))return originalCache.get(o.id);
    const result=originalQueue.then(async()=>{const rootId=env.ALOHA_DRIVE_ROOT_ID || await syncStore.getRoot() || (await drive.ensureFolder('root','ALOHA')).id;await syncStore.setRoot(rootId);const parent=(await drive.ensureFolder(rootId,o.code)).id;await syncStore.setFolder(o.id,parent);return (await drive.ensureFolder(parent,'GOC')).id;});
    originalQueue=result.catch(()=>{});originalCache.set(o.id,result);result.catch(()=>originalCache.delete(o.id));return result;}};
}
function syncHandler(service,env=process.env) {return async(req,res)=>{const key=req.get('x-sync-key')||'';if(!env.DRIVE_SYNC_KEY||Buffer.byteLength(key)!==Buffer.byteLength(env.DRIVE_SYNC_KEY)||!crypto.timingSafeEqual(Buffer.from(key),Buffer.from(env.DRIVE_SYNC_KEY)))return res.status(401).json({error:'unauthorized'});try{res.json(await service.syncOnce());}catch(_){res.status(503).json({error:'drive_sync_failed'});}};}
module.exports={createService,instruction,syncHandler};
