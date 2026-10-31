// Authenticated SePay receipts; Mongo _id uniquely identifies the transaction.
const {createStoreFromEnv} = require('./edit-requests-store');
const normalize = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
function createReceiptStore(store, incomingTx = []) {
  return {
    kind:store.kind, incomingTx, normalize,
    async add(tx) {
      if (tx.id == null || !String(tx.id).trim()) throw new Error('bad_transaction_id');
      const id = String(tx.id);
      if (store.kind === 'memory') {
        if (incomingTx.some(t => String(t.id) === id)) return false;
        incomingTx.push({...tx, id, content:normalize(tx.content)});
        if (incomingTx.length > 500) incomingTx.splice(0, incomingTx.length - 500);
        return true;
      }
      if (await store.get(id)) return false;
      try { await store.insert({...tx, id, content:normalize(tx.content), createdAt:tx.at || Date.now()}); }
      catch (e) { if (e.code === 11000) return false; throw e; }
      return true;
    },
    async listAll() { return store.kind === 'memory' ? incomingTx.map(t => ({...t})) : store.listAll(); },
    async find(code, amount) {
      const c = normalize(code);
      if (c.length < 8 || c.length > 60) return null;
      const records = store.kind === 'memory' ? incomingTx : await store.listAll();
      return records.find(t => t.id != null && t.content.includes(c) && t.amount >= amount) || null;
    }
  };
}
function fromEnv(env = process.env) {
  const result = createStoreFromEnv({...env, EDIT_REQUESTS_COLLECTION:'payment_receipts'});
  if (result.configError) console.error('payment-receipts:', result.configError);
  return createReceiptStore(result.store);
}
module.exports = {...fromEnv(), createReceiptStore, createStoreFromEnv:fromEnv};
