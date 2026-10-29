// Public, link-shared source folders; credentials stay on the server.
async function readFolder(value) {
  let folder;
  try { folder = new URL(value); } catch (_) {}
  const match = folder && folder.pathname.match(/\/folders\/([\w-]{10,200})(?:\/|$)/);
  if (!folder || folder.protocol !== 'https:' || !['drive.google.com','docs.google.com'].includes(folder.hostname) || !match) throw new Error('Vui lòng nhập link thư mục Google Drive ảnh gốc.');
  if (!process.env.GOOGLE_DRIVE_API_KEY) throw new Error('Studio chưa cấu hình mã Google Drive trên máy chủ.');
  const folderId=match[1], resourceKey=folder.searchParams.get('resourcekey'), photos=[];
  const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),10000);
  let pageToken=''; const pages=new Set();
  try {
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
module.exports={readFolder};
