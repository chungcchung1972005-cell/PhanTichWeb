// Public, link-shared source folders; credentials stay on the server.
function folderId(value) {
  try { const u = new URL(value); return u.protocol === "https:" && ["drive.google.com", "docs.google.com"].includes(u.hostname) ? (u.pathname.match(/\/folders\/([\w-]{10,200})(?:\/|$)/) || [])[1] || "" : ""; } catch (_) { return ""; }
}
async function readFolder(value) {
  let folder;
  try { folder = new URL(value); } catch (_) {}
  const match = folder && folder.pathname.match(/\/folders\/([\w-]{10,200})(?:\/|$)/);
  if (!folder || folder.protocol !== 'https:' || !['drive.google.com','docs.google.com'].includes(folder.hostname) || !match) throw new Error('Vui lòng nhập link thư mục Google Drive ảnh gốc.');
  if (!process.env.GOOGLE_DRIVE_API_KEY) throw new Error('Studio chưa cấu hình mã Google Drive trên máy chủ.');
  const folderId=match[1], resourceKey=folder.searchParams.get('resourcekey'), photos=[];
  const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),10000);
  let pageToken=''; const pages=new Set();
  const base=(process.env.GOOGLE_DRIVE_API_BASE || 'https://www.googleapis.com').replace(/\/$/,'');
  const permissionError=()=>Object.assign(new Error("Không đọc được thư mục. Kiểm tra thư mục đã để 'Bất kỳ ai có đường liên kết' chưa."),{drivePermission:true});
  try {
    // Thư mục chưa chia sẻ: files.list vẫn trả danh sách rỗng (không 403) -> hỏi chính thư mục trước
    // để báo đúng "chưa để công khai" thay vì "chưa có ảnh".
    try {
      const meta=new URLSearchParams({key:process.env.GOOGLE_DRIVE_API_KEY,fields:'id,mimeType',supportsAllDrives:'true'});
      const r=await fetch(base+'/drive/v3/files/'+encodeURIComponent(folderId)+'?'+meta,{headers:resourceKey?{'X-Goog-Drive-Resource-Keys':folderId+'/'+resourceKey}:{},signal:controller.signal});
      if(r.status===403 || r.status===404) throw permissionError();
      if(!r.ok) throw new Error();
    } catch(e) { if(e.drivePermission) throw e; throw new Error('Google Drive không phản hồi, thử lại sau.'); }
    do {
      const q=new URLSearchParams({key:process.env.GOOGLE_DRIVE_API_KEY,q:`'${folderId}' in parents and trashed = false and mimeType contains 'image/'`,fields:'nextPageToken,files(id,name,resourceKey)',orderBy:'name',pageSize:'1000',supportsAllDrives:'true',includeItemsFromAllDrives:'true'});
      if(pageToken) q.set('pageToken',pageToken);
      const headers=resourceKey?{'X-Goog-Drive-Resource-Keys':folderId+'/'+resourceKey}:{};
      let response, data;
      try {
        response=await fetch((process.env.GOOGLE_DRIVE_API_BASE || 'https://www.googleapis.com').replace(/\/$/,'')+'/drive/v3/files?'+q,{headers,signal:controller.signal});
        if(response.status===403 || response.status===404) throw Object.assign(new Error("Không đọc được thư mục. Kiểm tra thư mục đã để 'Bất kỳ ai có đường liên kết' chưa."),{drivePermission:true});
        if(!response.ok) throw new Error();
        data=await response.json();
      } catch(e) { if(e.drivePermission) throw e; throw new Error('Google Drive không phản hồi, thử lại sau.'); }
      for(const f of data.files || []) {
        if(!/^[\w-]{1,190}$/.test(f.id) || typeof f.name!=='string') throw new Error('Google Drive không phản hồi, thử lại sau.');
        const rk=f.resourceKey || '';
        photos.push({id:'drive-'+f.id,driveFileId:f.id,name:f.name,resourceKey:rk,src:'https://drive.google.com/thumbnail?id='+f.id+'&sz=w1000',driveUrl:'https://drive.google.com/file/d/'+f.id+'/view'+(rk?'?resourcekey='+encodeURIComponent(rk):'')});
      }
      if(photos.length>2000) throw new Error('Mỗi bộ ảnh hỗ trợ tối đa 2.000 ảnh. Vui lòng chia thành các buổi riêng.');
      pageToken=data.nextPageToken || '';
      if(pageToken && pages.has(pageToken)) throw new Error('Google Drive không phản hồi, thử lại sau.');
      pages.add(pageToken);
    } while(pageToken);
    if(!photos.length) throw new Error('Thư mục chưa có ảnh. Hãy đặt ảnh trực tiếp trong thư mục này.');
    return {folderId,folderUrl:folder.href,photos};
  } finally {clearTimeout(timer);}
}
function createWriter(options = {}) {
  const auth = options.auth || require('./drive-auth');
  const base = (options.base || process.env.GOOGLE_DRIVE_API_BASE || 'https://www.googleapis.com').replace(/\/$/, '');
  const sleep = options.sleep || (ms => new Promise(r => setTimeout(r, ms)));
  async function request(path, init = {}) {
    let refreshed = false;
    for (let attempt = 0; ; attempt++) {
      const token = await auth.getAccessToken();
      const response = await (options.fetch || fetch)(base + path, {...init, headers:{...init.headers, authorization:'Bearer ' + token}, signal:AbortSignal.timeout(20000)});
      if (response.status === 401 && !refreshed) {
        await response.text(); await auth.getAccessToken(true); refreshed = true; continue;
      }
      const data = await response.json().catch(() => ({}));
      if (response.ok) return data;
      const rate403 = response.status === 403 && (data.error?.errors || []).some(e => ['rateLimitExceeded','userRateLimitExceeded'].includes(e.reason));
      if (attempt < 4 && (rate403 || response.status === 429 || response.status >= 500)) {
        const retry = response.headers.get('retry-after');
        const delay = retry ? (/^\d+(\.\d+)?$/.test(retry) ? Number(retry)*1000 : Date.parse(retry)-Date.now()) : 0;
        await sleep(Math.min(60000, Math.max(delay || 0, 250 * 2 ** attempt + Math.random()*100))); continue;
      }
      throw Object.assign(new Error('drive_request_failed'), {status:response.status});
    }
  }
  const json = data => ({method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(data)});
  const escape = s => String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  return {
    async ensureFolder(parentId, name) {
      const q = new URLSearchParams({q:`'${escape(parentId)}' in parents and name = '${escape(name)}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`, fields:'files(id,name)', supportsAllDrives:'true', includeItemsFromAllDrives:'true'});
      const found = await request('/drive/v3/files?' + q);
      return found.files?.[0] || request('/drive/v3/files?supportsAllDrives=true', json({name, parents:[parentId], mimeType:'application/vnd.google-apps.folder'}));
    },
    copyFile: (fileId, parentId, name) => request('/drive/v3/files/' + encodeURIComponent(fileId) + '/copy?supportsAllDrives=true', json({name, parents:[parentId]})),
    uploadText(parentId, name, mime, text) {
      const boundary = 'aloha_' + require('crypto').randomBytes(16).toString('hex');
      const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({name,parents:[parentId],mimeType:mime})}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n${text}\r\n--${boundary}--\r\n`;
      return request('/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true', {method:'POST', headers:{'content-type':'multipart/related; boundary='+boundary}, body});
    },
    getStartPageToken: () => request('/drive/v3/changes/startPageToken?supportsAllDrives=true'),
    listChanges: pageToken => request('/drive/v3/changes?' + new URLSearchParams({pageToken, supportsAllDrives:'true', includeItemsFromAllDrives:'true', fields:'nextPageToken,newStartPageToken,changes(fileId,removed,file(id,name,parents,mimeType,trashed))'}))
  };
}
module.exports={readFolder,folderId,createWriter,...createWriter()};
