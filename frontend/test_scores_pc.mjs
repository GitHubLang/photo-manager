import { chromium } from 'playwright';

const browser = await chromium.launch({ executablePath: 'C:\\Users\\ADMIN\\AppData\\Local\\ms-playwright\\chromium-1217\\chrome-win64\\chrome.exe', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 720 });

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

console.log('=== ALL SCORE API LOGS ===');
logs.filter(l => l.includes('SCORE') || l.includes('tasks')).forEach(l => console.log(l));

// Now check the actual DOM structure of the PC panel
const domInfo = await page.evaluate(() => {
  // Find the PC scores panel - it has "评分记录" as header and "收起" button
  // The mobile version is in a Drawer, PC version is inline in the layout
  const allDivs = Array.from(document.querySelectorAll('div'));

  // Look for the debug div first
  const debugDiv = allDivs.find(d => d.textContent && d.textContent.includes('DEBUG: scores panel'));
  if (!debugDiv) return { error: 'no debug div' };

  // Get the immediate parent of debug div
  const panelRoot = debugDiv.parentElement;
  const panelStyle = window.getComputedStyle(panelRoot);

  // Find ALL children recursively within the panel
  function getAllChildren(el, depth = 0) {
    if (depth > 5 || !el) return [];
    const children = [];
    for (const child of el.children) {
      const style = window.getComputedStyle(child);
      children.push({
        tag: child.tagName,
        class: child.className.substring(0, 60),
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        width: style.width,
        height: style.height,
        overflow: style.overflow,
        textPreview: child.textContent.substring(0, 80).replace(/\s+/g, ' '),
        childCount: child.children.length,
      });
      if (child.children.length > 0 && depth < 3) {
        children[children.length-1]._children = getAllChildren(child, depth+1);
      }
    }
    return children;
  }

  return {
    panelTag: panelRoot.tagName,
    panelClass: panelRoot.className.substring(0, 60),
    panelDisplay: panelStyle.display,
    panelVisibility: panelStyle.visibility,
    panelWidth: panelStyle.width,
    panelHeight: panelStyle.height,
    panelOverflow: panelStyle.overflow,
    directChildren: getAllChildren(panelRoot, 0),
    debugText: debugDiv.textContent.substring(0, 100),
  };
});
console.log('\n=== PC PANEL DOM ===');
console.log(JSON.stringify(domInfo, null, 2));

// Check all ant-card elements
const cardInfo = await page.evaluate(() => {
  const cards = Array.from(document.querySelectorAll('.ant-card'));
  return {
    total: cards.length,
    samples: cards.slice(0, 3).map(c => ({
      class: c.className.substring(0, 60),
      text: c.textContent.substring(0, 80),
      rect: c.getBoundingClientRect(),
      style: {
        display: window.getComputedStyle(c).display,
        visibility: window.getComputedStyle(c).visibility,
        opacity: window.getComputedStyle(c).opacity,
        width: window.getComputedStyle(c).width,
        height: window.getComputedStyle(c).height,
      }
    }))
  };
});
console.log('\n=== CARDS ===');
console.log(JSON.stringify(cardInfo, null, 2));

// Check ant-spin inside panel
const spinInfo = await page.evaluate(() => {
  const spins = Array.from(document.querySelectorAll('.ant-spin'));
  return spins.map(s => {
    const style = window.getComputedStyle(s);
    const parentStyle = window.getComputedStyle(s.parentElement);
    return {
      class: s.className,
      spinning: s.classList.contains('ant-spin-spinning'),
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      width: style.width,
      height: style.height,
      parentDisplay: parentStyle.display,
      parentClass: s.parentElement.className.substring(0, 60),
      parentText: s.parentElement.textContent.substring(0, 100),
    };
  });
});
console.log('\n=== SPINS ===');
console.log(JSON.stringify(spinInfo, null, 2));

await browser.close();
