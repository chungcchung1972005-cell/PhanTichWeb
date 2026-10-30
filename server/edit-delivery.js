// Shared by manual links/completion and the Drive delivery scanner.
function resultLinks(link, photos, at = Date.now(), unavailable = false) {
  return {resultLink:link, resultPhotos:photos, resultLinkAt:link ? at : null, resultPreviewUnavailable:unavailable};
}
async function complete({store, workflow, request, rev = request.rev, set = {}, at = Date.now()}) {
  const result = await store.updateIfRev(request.id, rev, {
    ...set, doneIds:request.photos.map(p => p.id), status:'Hoàn thành', completedAt:at
  }, {notDone:true});
  if (result?.doc?.workflowOrderId) await workflow.progress(result.doc, 'delivered');
  return result;
}
module.exports = {resultLinks, complete};
