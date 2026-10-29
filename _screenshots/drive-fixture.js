const http=require('http');
async function startDrive(files=[{id:'test-file-0001',name:'IMG_0001.JPG'}]) {
  const server=http.createServer((req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify({files}));});
  server.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  process.env.GOOGLE_DRIVE_API_KEY='fixture-key';
  process.env.GOOGLE_DRIVE_API_BASE='http://127.0.0.1:'+server.address().port;
  return server;
}
module.exports={startDrive};
