// OAuth credentials are server-only. Never include Google's error body in logs/errors.
function createAuth(env = process.env, options = {}) {
  const fetcher = options.fetch || fetch, now = options.now || Date.now;
  let token = '', expiresAt = 0, pending;
  const isConnected = () => ['CLIENT_ID','CLIENT_SECRET','REFRESH_TOKEN'].every(k => !!env['GOOGLE_DRIVE_' + k]);
  async function getAccessToken(force = false) {
    if (!isConnected()) throw new Error('drive_not_connected');
    if (!force && token && now() < expiresAt) return token;
    if (pending) return pending;
    pending = (async () => {
      const response = await fetcher(options.tokenUrl || 'https://oauth2.googleapis.com/token', {
        method: 'POST', headers: {'content-type':'application/x-www-form-urlencoded'},
        body: new URLSearchParams({client_id:env.GOOGLE_DRIVE_CLIENT_ID, client_secret:env.GOOGLE_DRIVE_CLIENT_SECRET,
          refresh_token:env.GOOGLE_DRIVE_REFRESH_TOKEN, grant_type:'refresh_token'}), signal:AbortSignal.timeout(15000)
      });
      if (!response.ok) throw new Error('drive_token_refresh_failed');
      const data = await response.json();
      if (!data.access_token || !(Number(data.expires_in) > 0)) throw new Error('drive_token_invalid');
      token = data.access_token;
      expiresAt = now() + Math.max(0, Number(data.expires_in) * 1000 - 30000);
      return token;
    })();
    try { return await pending; } finally { pending = null; }
  }
  return {isConnected, getAccessToken};
}
module.exports = {...createAuth(), createAuth};
