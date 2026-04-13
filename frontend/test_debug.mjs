import { chromium } from 'playwright';

const browser = await chromium.launch({ executablePath: 'C:\\Users\\ADMIN\\AppData\\Local\\ms-playwright\\chromium-1217\\chrome-win64\\chrome.exe', args: ['--no-sandbox'] });
const page = await browser.newPage();

// Capture ALL console messages
const logs = [];
page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', err => logs.push(`[PAGE ERROR] ${err.message}`));

await page.goto('http://localhost:4173', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(2000);

// Click scores menu
await page.evaluate(() => {
  const items = document.querySelectorAll('.ant-menu-item');
  for (const item of items) {
    if (item.textContent && item.textContent.includes('评分')) {
      item.click();
      break;
    }
  }
});
await page.waitForTimeout(5000);

// Deep debug - check exact structure inside panel
const debug = await page.evaluate(() => {
  const allDivs = Array.from(document.querySelectorAll('div'));
  let debugDiv = allDivs.find(d => d.textContent && d.textContent.includes('DEBUG: scores panel'));
  if (!debugDiv) return { error: 'no debug div' };

  const panel = debugDiv.parentElement;
  const panelHTML = panel.outerHTML.substring(0, 2000);
  const panelStyle = window.getComputedStyle(panel);
  const childCount = panel.children.length;
  const allChildren = Array.from(panel.children).map(c => ({
    tag: c.tagName,
    class: c.className,
    id: c.id,
    style: c.style.cssText,
    visible: window.getComputedStyle(c).display !== 'none',
    children: c.children.length
  }));

  return {
    panelDisplay: panelStyle.display,
    panelVisibility: panelStyle.visibility,
    panelWidth: panelStyle.width,
    panelHeight: panelStyle.height,
    panelOverflow: panelStyle.overflow,
    childCount,
    children: allChildren,
    panelHTML
  };
});
console.log('=== PANEL DEBUG ===');
console.log(JSON.stringify(debug, null, 2));

// Check if cards are in DOM
const cardCheck = await page.evaluate(() => {
  const allCards = Array.from(document.querySelectorAll('.ant-card'));
  const cardParents = allCards.map(c => {
    let parent = c.parentElement;
    let depth = 0;
    while (parent && depth < 5) {
      if (parent.textContent && parent.textContent.includes('DEBUG: scores panel')) {
        return { found: true, depth };
      }
      parent = parent.parentElement;
      depth++;
    }
    return { found: false, depth };
  });
  const inPanel = cardParents.filter(p => p.found).length;
  const totalCards = allCards.length;

  // Find the Spin inside panel
  const allSpins = Array.from(document.querySelectorAll('.ant-spin'));
  let spinInPanel = null;
  for (const s of allSpins) {
    let p = s.parentElement;
    while (p) {
      if (p.textContent && p.textContent.includes('DEBUG: scores panel')) {
        spinInPanel = {
          spinning: s.className.includes('ant-spin-spinning'),
          visible: window.getComputedStyle(s).display !== 'none',
          parentVisible: window.getComputedStyle(p).display !== 'none'
        };
        break;
      }
      p = p.parentElement;
    }
    if (spinInPanel) break;
  }

  // Find the Empty inside panel
  const allEmpties = Array.from(document.querySelectorAll('.ant-empty'));
  let emptyInPanel = null;
  for (const e of allEmpties) {
    let p = e.parentElement;
    while (p) {
      if (p.textContent && p.textContent.includes('DEBUG: scores panel')) {
        emptyInPanel = {
          text: e.textContent.substring(0, 100),
          visible: window.getComputedStyle(e).display !== 'none',
          parentVisible: window.getComputedStyle(p).display !== 'none'
        };
        break;
      }
      p = p.parentElement;
    }
    if (emptyInPanel) break;
  }

  return { totalCards, inPanel, spinInPanel, emptyInPanel };
});
console.log('\n=== CARD CHECK ===');
console.log(JSON.stringify(cardCheck, null, 2));

// Also check what [SCORE API] logs say
console.log('\n=== CONSOLE LOGS ===');
console.log(logs.filter(l => l.includes('SCORE') || l.includes('API') || l.includes('DEBUG') || l.includes('tasks')).join('\n'));

await browser.close();
