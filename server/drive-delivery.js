const delivery = require('./edit-delivery');
const DEFAULT_SUFFIXES = ['_edit','-edit','_final','-final','_retouch',' (1)'];
const stem = name => String(name || '').replace(/\.[^.]+$/, '').toLowerCase();
function matchPhotos(photos, files, suffixes = DEFAULT_SUFFIXES) {
  const groups = new Map(), matches = photos.map(() => []), unknown = [], errors = [];
  photos.forEach((p,i) => { const key=stem(p.name); groups.set(key,[...(groups.get(key)||[]),i]); });
  for (const [key,ids] of groups) if(ids.length>1) errors.push('Trùng tên gốc: '+photos[ids[0]].name);
  for (const f of files.filter(f=>f.mimeType?.startsWith('image/') && Number(f.size)>0)) {
    const pending=[stem(f.name)], seen=new Set(), ids=new Set();
    while(pending.length) {
      const key=pending.pop();if(seen.has(key))continue;seen.add(key);
      (groups.get(key)||[]).forEach(i=>ids.add(i));
      for(const suffix of suffixes) if(suffix && key.endsWith(suffix.toLowerCase()))pending.push(key.slice(0,-suffix.length));
    }
    if(!ids.size)unknown.push(f.name); else ids.forEach(i=>matches[i].push(f));
    if(ids.size>1)errors.push('File khớp nhiều ảnh yêu cầu: '+f.name);
  }
  matches.forEach((fs,i)=>{if(fs.length>1)errors.push('Nhiều file khớp: '+photos[i].name);});
  return {matches, unknown, errors, missing:photos.filter((p,i)=>!matches[i].length).map(p=>p.name)};
}
function photo(f) {
  const id=encodeURIComponent(f.id), rk=f.resourceKey||'';
  return {id:'drive-'+f.id,driveFileId:f.id,name:f.name,resourceKey:rk,
    src:'https://drive.google.com/thumbnail?id='+id+'&sz=w1000',
    driveUrl:'https://drive.google.com/file/d/'+id+'/view'+(rk?'?resourcekey='+encodeURIComponent(rk):'')};
}
async function scan({store,workflow,syncStore,drive,request:r,now,env}) {
  const files=await drive.listFiles(r.driveJob.outputFolderId);
  // Optional JSON array of literal suffixes, e.g. ["_edit","-final"].
  const suffixes=env.DRIVE_DELIVERY_SUFFIXES === undefined ? DEFAULT_SUFFIXES : JSON.parse(env.DRIVE_DELIVERY_SUFFIXES);
  if(!Array.isArray(suffixes)||suffixes.some(s=>typeof s!=='string'))throw Error('invalid_delivery_suffixes');
  const m=matchPhotos(r.photos,files,suffixes), matched=m.matches.filter(fs=>fs.length===1).length;
  const stateKey='delivery:'+r.id, previous=await syncStore.getState(stateKey);
  const signature=JSON.stringify(m.matches.map(fs=>fs.map(f=>[f.id,String(f.size),f.modifiedTime]).sort((a,b)=>a[0].localeCompare(b[0]))));
  const at=now(), same=previous?.signature===signature && previous.folderId===r.driveJob.outputFolderId;
  const firstSeen=same ? previous.firstSeen : at;
  await syncStore.setState(stateKey,{signature,folderId:r.driveJob.outputFolderId,firstSeen,lastSeen:at});
  const stable=same && at-firstSeen>=60000 && m.matches.flat().every(f=>Number.isFinite(Date.parse(f.modifiedTime)) && at-Date.parse(f.modifiedTime)>=120000);
  const status={status:'waiting',matched,total:r.photos.length,missing:m.missing,unknown:m.unknown};
  if(m.errors.length)status.error=m.errors.join('; ');
  if(r.photos.length && matched===r.photos.length && !m.errors.length && stable) {
    const resultPhotos=m.matches.map(fs=>photo(fs[0]));
    return delivery.complete({store,workflow,request:r,at,set:{
      ...delivery.resultLinks('https://drive.google.com/drive/folders/'+r.driveJob.outputFolderId,resultPhotos,at),
      driveJob:{...r.driveJob,delivery:{status:'delivered',at,matched,unknown:m.unknown}}
    }});
  }
  if(JSON.stringify(r.driveJob.delivery)!==JSON.stringify(status))
    return store.updateIfRev(r.id,r.rev,{driveJob:{...r.driveJob,delivery:status}},{notDone:true});
}
module.exports={scan,matchPhotos,DEFAULT_SUFFIXES};
