// Chạy 1 lần trên máy để lấy chìa khoá Drive dùng lâu dài (refresh token). Không ghi .env; chỉ in chìa khoá khi thành công.
require('dotenv').config({path:require('path').join(__dirname,'../.env')});
const http = require('http'), crypto = require('crypto'), {spawn} = require('child_process');
const PAGE = (text) => '<!doctype html><meta charset="utf-8"><p style="font:18px sans-serif;padding:40px">'+text+'</p>';
async function main() {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID, clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  if (!clientId || !clientSecret) { console.error('Chưa đặt GOOGLE_DRIVE_CLIENT_ID và GOOGLE_DRIVE_CLIENT_SECRET (gõ 2 dòng $env:... trước).'); process.exitCode=1; return; }
  const state = crypto.randomBytes(32).toString('hex'), verifier = crypto.randomBytes(48).toString('base64url');
  let redirect, used = false;
  const server = http.createServer(async (req,res) => {
    const url = new URL(req.url, redirect);
    if (url.pathname !== '/callback') {res.writeHead(404).end(); return;}
    res.setHeader('content-type','text/html; charset=utf-8');
    if (used || url.searchParams.get('state') !== state) {res.writeHead(400).end(PAGE('Phiên không hợp lệ, hãy chạy lại lệnh.')); return;}
    if (!url.searchParams.get('code')) {res.writeHead(400).end(PAGE('Bạn đã huỷ cấp quyền.')); console.error('Bạn đã huỷ cấp quyền.'); server.close(); clearTimeout(timer); process.exitCode=1; return;}
    used = true;
    try {
      const r = await fetch('https://oauth2.googleapis.com/token', {method:'POST', headers:{'content-type':'application/x-www-form-urlencoded'},
        body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,code:url.searchParams.get('code'),code_verifier:verifier,redirect_uri:redirect,grant_type:'authorization_code'}),signal:AbortSignal.timeout(15000)});
      const data = await r.json();
      if (!r.ok || !data.refresh_token) throw new Error('no_refresh_token');
      console.log('\nTHÀNH CÔNG. Chép dòng dưới đây ra chỗ an toàn, KHÔNG gửi vào chat:\nGOOGLE_DRIVE_REFRESH_TOKEN='+data.refresh_token);
      res.end(PAGE('Đã kết nối. Quay lại cửa sổ PowerShell, có thể đóng tab này.'));
    } catch (_) {console.error('Không lấy được chìa khoá: kiểm tra lại Client ID / Client secret. Nếu đã từng cấp quyền, gỡ "ALOHA Baby" ở myaccount.google.com/permissions rồi chạy lại.');res.writeHead(502).end(PAGE('Kết nối thất bại, xem cửa sổ PowerShell.'));process.exitCode=1;}
    finally {clearTimeout(timer);server.close();}
  });
  const timer = setTimeout(() => {console.error('Quá 5 phút chưa xong, hãy chạy lại lệnh.');server.close();process.exitCode=1;},300000);
  server.listen(0,'127.0.0.1'); await new Promise((resolve,reject) => {server.once('listening',resolve);server.once('error',reject);});
  redirect = 'http://127.0.0.1:'+server.address().port+'/callback';
  const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({client_id:clientId,redirect_uri:redirect,response_type:'code',scope:'https://www.googleapis.com/auth/drive',access_type:'offline',prompt:'consent',state,code_challenge:crypto.createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',login_hint:'chungcchung1972005@gmail.com'});
  console.log('Đang mở trình duyệt. Đăng nhập bằng chungcchung1972005@gmail.com.\nTrình duyệt không tự mở thì chép link này vào trình duyệt:\n'+url);
  const args = process.platform === 'win32' ? ['powershell.exe',['-NoProfile','-NonInteractive','-Command',"Start-Process '"+url+"'"]] : process.platform === 'darwin' ? ['open',[url]] : ['xdg-open',[url]];
  spawn(args[0],args[1],{stdio:'ignore',windowsHide:true}).on('error',()=>console.error('Hãy tự mở link ở trên.'));
}
main().catch(()=>{console.error('Không khởi động được: kiểm tra Client ID / Client secret.');process.exitCode=1;});
