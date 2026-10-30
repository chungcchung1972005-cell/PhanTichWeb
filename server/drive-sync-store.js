const {createStoreFromEnv} = require('./edit-requests-store');
function createSyncStore(store) {
  return {
    kind: store.kind,
    getState: async id => await store.get(id),
    setState: put,
    getRoot: async () => (await store.get('root'))?.folderId || null,
    setRoot: folderId => put('root',{folderId}),
    getCursor: async () => (await store.get('cursor'))?.pageToken || null,
    getFolder: async orderId => (await store.get('order:' + orderId))?.folderId || null,
    async setCursor(pageToken) { return put('cursor', {pageToken}); },
    async setFolder(orderId, folderId) { return put('order:' + orderId, {folderId}); }
  };
  async function put(id, value) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const rec = await store.get(id);
      if (!rec) {
        try { return await store.insert({id, rev:1, ...value, createdAt:Date.now(), updatedAt:Date.now()}); }
        catch (e) { if (e.code !== 11000) throw e; }
      } else {
        const result = await store.updateIfRev(id, rec.rev, value);
        if (result?.doc) return result.doc;
      }
    }
    throw new Error('drive_sync_conflict');
  }
}
function fromEnv(env = process.env) {
  const result = createStoreFromEnv({...env, EDIT_REQUESTS_COLLECTION:'drive_sync_state'});
  if (result.configError) console.error('drive-sync:', result.configError);
  return createSyncStore(result.store);
}
module.exports = {createSyncStore, createStoreFromEnv:fromEnv};
