import { chromium } from '@playwright/test';

const browser = await chromium.launch({ 
  headless: true,
  executablePath: 'C:\\Users\\ADMIN\\AppData\\Local\\ms-playwright\\chromium-1217\\chrome-win64\\chrome.exe'
});

const page = await browser.newPage();
page.on('console', msg => {
  if (msg.text().includes('DEBUG') || msg.text().includes('setScoreTasks') || msg.text().includes('score')) {
    console.log('[CONSOLE]', msg.text());
  }
});

try {
  await page.goto('http://192.168.71.55:4173/', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForSelector('.ant-menu', { timeout: 5000 });

  // Click 评分记录
  await page.locator('.ant-menu-item', { hasText: '评分记录' }).click();
  await page.waitForTimeout(4000);

  // Check for ant-card elements in the DOM
  const cardCheck = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.ant-card'));
    return {
      count: cards.length,
      first5: cards.slice(0, 5).map(c => ({
        class: c.className.substring(0, 60),
        display: window.getComputedStyle(c).display,
        width: window.getComputedStyle(c).width,
        height: window.getComputedStyle(c).height,
        opacity: window.getComputedStyle(c).opacity,
        visible: window.getComputedStyle(c).visibility,
        text: c.textContent?.substring(0, 80)
      }))
    };
  });
  console.log('ANT-CARD elements:', JSON.stringify(cardCheck, null, 2));
  
  // Check if Spin is still spinning
  const spinCheck = await page.evaluate(() => {
    const spins = Array.from(document.querySelectorAll('.ant-spin'));
    return spins.map(s => ({
      display: window.getComputedStyle(s).display,
      opacity: window.getComputedStyle(s).opacity,
      height: window.getComputedStyle(s).height,
      visible: window.getComputedStyle(s).visibility,
      isSpinning: s.getAttribute('class')?.includes('ant-spin-spinning')
    }));
  });
  console.log('\nANT-SPIN elements:', JSON.stringify(spinCheck));

  // Check the panel's full innerHTML to see if cards are there
  const panelHTML = await page.evaluate(() => {
    const sider = document.querySelector('.ant-layout-has-sider');
    const col1 = sider.children[1];
    return col1.innerHTML;
  });
  console.log('\nPanel innerHTML length:', panelHTML.length);
  console.log('Panel innerHTML (last 1500 chars):', panelHTML.substring(Math.max(0, panelHTML.length - 1500)));

} catch (err) {
  console.error('Error:', err.message);
}

await browser.close();
