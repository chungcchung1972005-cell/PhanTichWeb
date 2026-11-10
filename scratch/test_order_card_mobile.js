const puppeteer = require('../_screenshots/node_modules/puppeteer-core');
const env = require('../_screenshots/test-env');

(async () => {
  const browser = await puppeteer.launch({ executablePath: env.CHROME_PATH, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('aloha_auth', JSON.stringify({
      role: 'sale',
      name: 'Ngọc Anh',
      phone: '0900000002',
      token: 'fixture'
    }));
  });

  await page.goto(env.ROOT_URL + 'crm/sale.html#hop-thu', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.AlohaOrderQRModal !== 'undefined');

  const metrics = await page.evaluate(() => {
    const orderData = {
      code: 'DP1440',
      customerName: 'Sơn Xuân',
      phone: '0969969055',
      service: 'Bé lớn',
      pkg: 'Gói Tiêu chuẩn (2.500.000đ)',
      concept: 'tết',
      date: '2026-11-11',
      time: '09:00',
      room: 'Studio ALOHA Baby (P1)',
      shooterName: 'Thợ ảnh demo',
      depositAmount: 1250000,
      price: 2500000,
      qrUrl: 'https://img.vietqr.io/image/970422-0938125222-compact2.png'
    };

    const html = AlohaOrderQRModal.renderOrderCardHtml(orderData, { isSale: true });
    let msgsEl = document.getElementById('ibMsgs');
    if (!msgsEl) {
      msgsEl = document.createElement('div');
      msgsEl.className = 'ib-msgs';
      document.body.appendChild(msgsEl);
    }
    const wrap = document.createElement('div');
    wrap.className = 'ib-msg out';
    wrap.innerHTML = html + '<small>13:33 · Ngọc Anh</small>';
    msgsEl.appendChild(wrap);

    const card = wrap.querySelector('.chat-order-card');
    const details = card.querySelector('.coc-details');
    const qrSection = card.querySelector('.coc-qr-section');
    const qrImg = card.querySelector('.coc-qr-img-wrap');
    const bankInfo = card.querySelector('.coc-bank-info');
    const simBtn = card.querySelector('.btn-sim-deposit');

    const getBox = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height, display: style.display, position: style.position, flexDir: style.flexDirection };
    };

    return {
      card: getBox(card),
      details: getBox(details),
      qrSection: getBox(qrSection),
      qrImg: getBox(qrImg),
      bankInfo: getBox(bankInfo),
      simBtn: getBox(simBtn)
    };
  });

  console.log('Metrics:', JSON.stringify(metrics, null, 2));
  await page.screenshot({ path: '_screenshots/debug_order_card_mobile.png', fullPage: true });
  await browser.close();
})();
