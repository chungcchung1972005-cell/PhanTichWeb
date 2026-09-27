// Cấu hình dùng chung cho mọi script trong _screenshots/: tự tìm thư mục dự án
// và Chrome trên máy đang chạy, để test chạy được trên máy của mọi thành viên
// (trước đây mỗi file ghi cứng D:\PhanTichWeb và C:\Program Files\...\chrome.exe).
//
// Chrome ở chỗ lạ thì đặt biến môi trường trước khi chạy, vd PowerShell:
//   $env:CHROME_PATH = 'C:\duong\dan\chrome.exe'; node _screenshots/test-auth.js
const fs = require('fs');
const path = require('path');

// Thư mục gốc dự án (cha của _screenshots/)
const ROOT = path.resolve(__dirname, '..');
// Cùng thư mục đó, dạng dấu "/" và có "/" ở cuối, vd "C:/Users/a/PhanTichWeb/"
const ROOT_POSIX = ROOT.replace(/\\/g, '/') + '/';
// URL file:// tới thư mục dự án, dùng: ROOT_URL + 'index.html'
const ROOT_URL = 'file:///' + ROOT_POSIX.replace(/^\/+/, '');

function fromRoot(...parts) { return path.join(ROOT, ...parts); }
// Đường dẫn file ảnh chụp màn hình trong _screenshots/
function shot(name) { return path.join(__dirname, name); }

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const local = process.env.LOCALAPPDATA || '';
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(local, 'Google\\Chrome\\Application\\chrome.exe'),
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium'
  ];
  const found = candidates.find(p => p && fs.existsSync(p));
  if (!found) throw new Error('Không tìm thấy Chrome/Edge. Đặt biến môi trường CHROME_PATH trỏ tới chrome.exe rồi chạy lại.');
  return found;
}
const CHROME_PATH = findChrome();

module.exports = { ROOT, ROOT_POSIX, ROOT_URL, CHROME_PATH, fromRoot, shot };
