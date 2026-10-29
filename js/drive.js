// Public browser configuration only; never put a client secret here.
window.AlohaDriveConfig = window.AlohaDriveConfig || { clientId: '', apiKey: '', appId: '' };
window.AlohaDrive = (() => {
  const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function parse(value) {
    try {
      const u = new URL(value);
      if (u.protocol !== 'https:' || !['drive.google.com', 'docs.google.com'].includes(u.hostname)) return null;
      const folder = u.pathname.match(/\/folders\/([\w-]+)/);
      const file = u.pathname.match(/\/d\/([\w-]+)/);
      const id = (folder || file || [])[1] || u.searchParams.get('id');
      if (!id || !/^[\w-]{10,200}$/.test(id)) return null;
      return { id, folder: !!folder, resourceKey: u.searchParams.get('resourcekey') || '', url: u.href, embed: folder ? 'https://drive.google.com/embeddedfolderview?id=' + id + '#grid' : 'https://drive.google.com/file/d/' + id + '/preview' };
    } catch (_) { return null; }
  }
  function render(text) {
    return String(text || '').split(/(https:\/\/[^\s<>"']+)/g).map(part => {
      const drive = parse(part);
      if (!drive) return escape(part);
      return `<a href="${escape(drive.url)}" target="_blank" rel="noopener noreferrer">Mở ${drive.folder ? 'thư mục' : 'ảnh'} trên Drive</a><details class="aloha-drive-preview"><summary>Xem ngay tại đây</summary><iframe title="Ảnh trên Google Drive" loading="lazy" src="${escape(drive.embed)}" referrerpolicy="no-referrer" allow="fullscreen"></iframe><small>Nếu chưa thấy ảnh, mở Drive và đăng nhập tài khoản được chia sẻ.</small></details>`;
    }).join('');
  }
  const scripts = new Map();
  let readToken = null;
  async function authorizeRead() {
    const c = window.AlohaDriveConfig;
    if (!c.clientId) throw new Error('Studio chưa cấu hình kết nối Google Drive. Cần kết nối trước khi tải danh sách ảnh gốc.');
    await script('https://accounts.google.com/gsi/client');
    return new Promise((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({client_id:c.clientId, scope:'https://www.googleapis.com/auth/drive.readonly',
        callback: r => { if (r.error) reject(new Error('Không được cấp quyền đọc Drive.')); else { readToken = {value:r.access_token, until:Date.now() + (r.expires_in || 3600)*1000}; resolve(readToken.value); } },
        error_callback: () => reject(new Error('Chưa kết nối Google Drive. Vui lòng thử lại.'))});
      client.requestAccessToken({prompt:'select_account'});
    });
  }
  async function readFolder(url) {
    const folder = parse(url);
    if (!folder || !folder.folder) throw new Error('Vui lòng nhập link thư mục Google Drive ảnh gốc.');
    const token = await authorizeRead();
    const headers = {Authorization:'Bearer ' + token};
    if (folder.resourceKey) headers['X-Goog-Drive-Resource-Keys'] = folder.id + '/' + folder.resourceKey;
    let pageToken = ''; const photos = [];
    do {
      const q = new URLSearchParams({q:`'${folder.id}' in parents and trashed = false and mimeType contains 'image/'`, fields:'nextPageToken,files(id,name,resourceKey)', orderBy:'name', pageSize:'1000', supportsAllDrives:'true', includeItemsFromAllDrives:'true'});
      if (pageToken) q.set('pageToken', pageToken);
      const response = await fetch('https://www.googleapis.com/drive/v3/files?' + q, {headers});
      if (!response.ok) throw new Error('Không đọc được thư mục. Hãy kiểm tra quyền truy cập của tài khoản Google vừa kết nối.');
      const data = await response.json();
      photos.push(...(data.files || []).map(p => ({id:'drive-' + p.id, driveFileId:p.id, name:p.name, resourceKey:p.resourceKey || '', src:'https://drive.google.com/thumbnail?id=' + p.id + '&sz=w1000', driveUrl:'https://drive.google.com/file/d/' + p.id + '/view' + (p.resourceKey ? '?resourcekey=' + encodeURIComponent(p.resourceKey) : '')})));
      if (photos.length > 2000) throw new Error('Mỗi bộ ảnh hỗ trợ tối đa 2.000 ảnh. Vui lòng chia thành các buổi riêng.');
      pageToken = data.nextPageToken || '';
    } while (pageToken);
    if (!photos.length) throw new Error('Thư mục chưa có ảnh. Hãy đặt ảnh trực tiếp trong thư mục này.');
    return {folderId:folder.id, folderUrl:folder.url, photos};
  }
  async function loadPrivatePhoto(photo) {
    if (!readToken || readToken.until <= Date.now()) throw new Error('Cần kết nối Google để xem ảnh riêng tư.');
    const headers = {Authorization:'Bearer ' + readToken.value};
    if (photo.resourceKey) headers['X-Goog-Drive-Resource-Keys'] = photo.driveFileId + '/' + photo.resourceKey;
    const response = await fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(photo.driveFileId) + '?alt=media&supportsAllDrives=true', {headers});
    if (!response.ok) throw new Error('Không mở được ảnh. Nhờ thợ chia sẻ thư mục cho tài khoản Google của bạn.');
    return URL.createObjectURL(await response.blob());
  }
  function script(src) {
    if (!scripts.has(src)) scripts.set(src, new Promise((resolve, reject) => {
      const el = document.createElement('script'); el.src = src; el.onload = resolve;
      el.onerror = () => { scripts.delete(src); reject(new Error('Không tải được Google Drive. Vui lòng thử lại.')); };
      document.head.appendChild(el);
    }));
    return scripts.get(src);
  }
  async function pick(onPick) {
    const c = window.AlohaDriveConfig;
    if (!c.clientId || !c.apiKey || !c.appId) throw new Error('Studio chưa kết nối tính năng chọn ảnh Google Drive. Bạn vẫn có thể dán link ảnh hoặc thư mục bên dưới.');
    await Promise.all([script('https://apis.google.com/js/api.js'), script('https://accounts.google.com/gsi/client')]);
    await new Promise(resolve => gapi.load('picker', resolve));
    const client = google.accounts.oauth2.initTokenClient({ client_id: c.clientId, scope: 'https://www.googleapis.com/auth/drive.file', callback: response => {
      if (response.error) return;
      new google.picker.PickerBuilder().setAppId(c.appId).setDeveloperKey(c.apiKey)
        .setOAuthToken(response.access_token).setOrigin(location.origin)
        .addView(new google.picker.DocsView().setMimeTypes('image/jpeg,image/png,image/webp'))
        .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
        .setCallback(data => { if (data.action === google.picker.Action.PICKED) onPick(data.docs); })
        .build().setVisible(true);
    }});
    client.requestAccessToken({ prompt: 'consent' });
  }
  function attach(form, input) {
    if (!form || !input || form.querySelector('.aloha-drive-tools')) return;
    const tools = document.createElement('div'); tools.className = 'aloha-drive-tools';
    tools.innerHTML = '<button type="button">Chọn ảnh từ Drive</button><small>Dán link Drive vào tin nhắn để gửi ảnh/thư mục cho bên kia.</small><span role="status"></span>';
    form.appendChild(tools);
    tools.querySelector('button').onclick = async () => {
      try { await pick(docs => { input.value = [input.value, ...docs.map(d => d.url || 'https://drive.google.com/file/d/' + d.id + '/view')].filter(Boolean).join('\n'); input.dispatchEvent(new Event('input', { bubbles: true })); input.focus(); }); }
      catch (e) { tools.querySelector('[role=status]').textContent = e.message; }
    };
  }
  return { parse, render, pick, attach, readFolder, authorizeRead, loadPrivatePhoto };
})();
