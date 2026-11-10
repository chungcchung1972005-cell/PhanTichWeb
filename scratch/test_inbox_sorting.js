const puppeteer = require('../_screenshots/node_modules/puppeteer-core');
const env = require('../_screenshots/test-env');
const assert = require('assert/strict');

(async () => {
  const browser = await puppeteer.launch({ executablePath: env.CHROME_PATH, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

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

  const result = await page.evaluate(async () => {
    const chats = [
      { phone: 'k1', customerName: 'Khách 13/10', topic: '', updatedAt: 1791829748600, staffUnread: 1, last: { text: '13/10', at: 1791829748600 } },
      { phone: 'k2', customerName: 'Khách 16/10', topic: '', updatedAt: 1792116976102, staffUnread: 1, last: { text: '16/10', at: 1792116976102 } },
      { phone: 'k3', customerName: 'Khách 20/10', topic: '', updatedAt: 1792514071307, staffUnread: 1, last: { text: '20/10', at: 1792514071307 } },
      { phone: 'k4', customerName: 'Khách 21/10', topic: '', updatedAt: 1792517450783, staffUnread: 1, last: { text: '21/10', at: 1792517450783 } }
    ];

    window.AlohaAuth.api = async (path) => {
      if (path.endsWith('/inbox')) return { ok: true, status: 200, data: { chats } };
      for (const c of chats) {
        if (path.includes(c.phone)) return { ok: true, status: 200, data: { chat: { ...c, messages: [{ from: 'khach', text: c.last.text, at: c.updatedAt }] } } };
      }
      return { ok: true, status: 200, data: {} };
    };

    // Wait for the 3s live polling interval to fire
    await new Promise(r => setTimeout(r, 3500));

    // Now simulate customer k1 (13/10) sending a brand new message right now
    const now = Date.now();
    chats[0].updatedAt = now;
    chats[0].last = { text: 'Tin mới vừa gửi!', at: now };

    // Wait for next polling
    await new Promise(r => setTimeout(r, 3500));

    const items = [...document.querySelectorAll('.ib-item')].map(el => {
      return {
        name: el.querySelector('strong')?.textContent?.trim(),
        time: el.querySelector('small')?.textContent?.trim(),
        preview: el.querySelector('.ib-preview')?.textContent?.trim()
      };
    });
    return items;
  });

  console.log('After new message from Khách 13/10:', result);
  assert.equal(result[0].preview, 'Tin mới vừa gửi!', 'Customer with newest message must jump to the very top (index 0)');
  assert.equal(result[1].preview, '21/10');
  assert.equal(result[2].preview, '20/10');
  assert.equal(result[3].preview, '16/10');

  console.log('PASS: Conversation automatically jumps to top when new message arrives!');
  await browser.close();
})();
