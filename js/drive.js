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
      return `<a href="${escape(drive.url)}" target="_blank" rel="noopener noreferrer">Mở ${drive.folder ? 'thư mục' : 'ảnh'} trên Drive</a><details class="aloha-drive-preview"><summary>Xem ngay tại đây</summary><iframe title="Ảnh trên Google Drive" loading="lazy" src="${escape(drive.embed)}" referrerpolicy="no-referrer" allow="fullscreen"></iframe><small>Nếu chưa thấy ảnh, thử tải lại hoặc mở liên kết Drive.</small></details>`;
    }).join('');
  }
  const scripts = new Map();
  async function readFolder(url) {
    if (!window.AlohaAuth || !AlohaAuth.api) throw new Error('Không kết nối được máy chủ để đọc Google Drive.');
    let result;
    try { result=await AlohaAuth.api('/api/edit-requests/drive-folder?url='+encodeURIComponent(url)); }
    catch (_) { throw new Error('Không kết nối được máy chủ để đọc Google Drive.'); }
    if (result.status === 0) throw new Error('Không kết nối được máy chủ để đọc Google Drive.');
    if (!result.ok) throw new Error(result.data && result.data.message || 'Không đọc được thư mục Drive trên máy chủ. Kiểm tra kết nối và đăng nhập nhân viên.');
    return result.data;
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
    const c=window.AlohaDriveConfig;
    if (!c.clientId || !c.apiKey || !c.appId || !form || !input || form.querySelector('.aloha-drive-tools')) return;
    const tools = document.createElement('div'); tools.className = 'aloha-drive-tools';
    tools.innerHTML = '<button type="button">Chọn ảnh từ Drive</button><small>Dán link Drive vào tin nhắn để gửi ảnh/thư mục cho bên kia.</small><span role="status"></span>';
    form.appendChild(tools);
    tools.querySelector('button').onclick = async () => {
      try { await pick(docs => { input.value = [input.value, ...docs.map(d => d.url || 'https://drive.google.com/file/d/' + d.id + '/view')].filter(Boolean).join('\n'); input.dispatchEvent(new Event('input', { bubbles: true })); input.focus(); }); }
      catch (e) { tools.querySelector('[role=status]').textContent = e.message; }
    };
  }
  return { parse, render, pick, attach, readFolder };
})();
