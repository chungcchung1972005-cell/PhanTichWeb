// Only the authenticated SePay webhook writes these receipts. No client claim is a receipt.
const incomingTx=[];
const normalize=s=>String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
function find(code,amount) {
  const c=normalize(code);
  return c.length>=8 && c.length<=60 ? incomingTx.find(t=>t.id!=null && t.content.includes(c) && t.amount>=amount) : null;
}
module.exports={incomingTx,normalize,find};
