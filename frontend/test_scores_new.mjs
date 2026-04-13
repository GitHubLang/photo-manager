import { chromium } from 'playwright';

const browser = await chromium.launch({ executablePath: 'C:\\Users\\ADMIN\\AppData\\Local\\ms-playwright\\chromium-1217\\chrome-win64\\chrome.exe', args: ['--no-sandbox'] });
const page = await browser.newPage();

await page.goto('http://localhost:4173', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(3000);

console.log('Title:', await page.title());
console.log('URL:', page.url());

// Check if panel is visible
const panelInfo = await page.evaluate(() => {
  const allDivs = document.querySelectorAll('div');
  let debugDiv = null;
  for (const d of allDivs) {
    if (d.textContent && d.textContent.includes('DEBUG: scores panel')) {
      debugDiv = d;
      break;
    }
  }
  return {
    hasDebug: !!debugDiv,
    debugText: debugDiv ? debugDiv.textContent.trim() : null,
    debugVisible: debugDiv ? debugDiv.offsetParent !== null : false,
    debugOffset: debugDiv ? JSON.stringify(debugDiv.getBoundingClientRect()) : null,
  };
});
console.log('Panel info:', JSON.stringify(panelInfo));

// Click scores menu item
const menuResult = await page.evaluate(() => {
  const items = document.querySelectorAll('.ant-menu-item');
  for (const item of items) {
    if (item.textContent && item.textContent.includes('评分')) {
      item.click();
      return item.textContent.trim();
    }
  }
  return null;
});
console.log('Clicked:', menuResult);

await page.waitForTimeout(4000);

// Check after click
const afterClick = await page.evaluate(() => {
  const allDivs = document.querySelectorAll('div');
  let debugDiv = null;
  for (const d of allDivs) {
    if (d.textContent && d.textContent.includes('DEBUG: scores panel')) {
      debugDiv = d;
      break;
    }
  }
  return {
    hasDebug: !!debugDiv,
    debugText: debugDiv ? debugDiv.textContent.trim() : null,
    debugVisible: debugDiv ? debugDiv.offsetParent !== null : false,
    debugOffset: debugDiv ? JSON.stringify(debugDiv.getBoundingClientRect()) : null,
  };
});
console.log('After click:', JSON.stringify(afterClick));

// Check for cards in the panel
const cardInfo = await page.evaluate(() => {
  const cards = document.querySelectorAll('.ant-card');
  let inPanel = 0;
  for (const c of cards) {
    let p = c.parentElement;
    while (p) {
      if (p.textContent && p.textContent.includes('DEBUG: scores panel')) {
        inPanel++;
        break;
      }
      p = p.parentElement;
    }
  }
  return { totalCards: cards.length, inPanel };
});
console.log('Cards:', JSON.stringify(cardInfo));

// Check for Empty component
const emptyInfo = await page.evaluate(() => {
  const empties = document.querySelectorAll('.ant-empty');
  let inPanel = 0;
  for (const e of empties) {
    if (e.textContent && e.textContent.includes('暂无记录')) {
      let p = e.parentElement;
      while (p) {
        if (p.textContent && p.textContent.includes('DEBUG: scores panel')) {
          inPanel++;
          break;
        }
        p = p.parentElement;
      }
    }
  }
  return { totalEmpties: empties.length, inPanel };
});
console.log('Empty:', JSON.stringify(emptyInfo));

// Check for spin
const spinInfo = await page.evaluate(() => {
  const spins = document.querySelectorAll('.ant-spin');
  return spins.length;
});
console.log('Spins:', spinInfo);

// Console logs
const logs = [];
page.on('console', msg => { if (msg.type() === 'log' || msg.type() === 'error') logs.push(`[${msg.type()}] ${msg.text()}`); });
await page.waitForTimeout(1000);

await browser.close();
console.log('Logs:', logs.slice(0, 10));
