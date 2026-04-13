import { chromium } from 'playwright';

const browser = await chromium.launch({ executablePath: 'C:\\Users\\ADMIN\\AppData\\Local\\ms-playwright\\chromium-1217\\chrome-win64\\chrome.exe', args: ['--no-sandbox'] });
const page = await browser.newPage();

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

// Find all ant-card elements and their exact DOM position
const allCards = await page.evaluate(() => {
  const cards = Array.from(document.querySelectorAll('.ant-card'));
  return cards.slice(0, 5).map((c, i) => {
    const rect = c.getBoundingClientRect();
    const style = window.getComputedStyle(c);
    return {
      index: i,
      text: c.textContent.substring(0, 80),
      rect: JSON.stringify(rect),
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      width: style.width,
      height: style.height,
      overflow: style.overflow,
      parentDisplay: window.getComputedStyle(c.parentElement).display,
      grandparentDisplay: window.getComputedStyle(c.parentElement.parentElement).display,
    };
  });
});
console.log('=== ALL CARDS (first 5) ===');
console.log(JSON.stringify(allCards, null, 2));

// Find the panel and its exact content
const panelContent = await page.evaluate(() => {
  const allDivs = Array.from(document.querySelectorAll('div'));
  let debugDiv = allDivs.find(d => d.textContent && d.textContent.includes('DEBUG: scores panel'));
  if (!debugDiv) return { error: 'no debug div' };

  // Walk up from debug div to find panel
  let panel = debugDiv;
  while (panel && !(panel.className && panel.className.includes('ant-layout'))) {
    panel = panel.parentElement;
  }

  if (!panel) panel = debugDiv.parentElement;
  while (panel && panel.id !== 'root' && panel.className !== 'ant-layout-sider') {
    panel = panel.parentElement;
  }

  // The actual panel content is likely inside some wrapper
  let contentDiv = debugDiv.parentElement;
  while (contentDiv && contentDiv !== panel) {
    const style = window.getComputedStyle(contentDiv);
    if (style.display !== 'none' && style.visibility !== 'hidden') {
      const children = Array.from(contentDiv.children).map(c => ({
        tag: c.tagName,
        class: c.className.substring(0, 50),
        display: window.getComputedStyle(c).display,
        childCount: c.children.length,
        overflow: window.getComputedStyle(c).overflow,
      }));
      if (children.length > 0) {
        console.log('Content div:', {
          display: style.display,
          overflow: style.overflow,
          width: style.width,
          height: style.height,
          children
        });
      }
    }
    contentDiv = contentDiv.parentElement;
  }

  // Check debug div's parent (should be the panel content area)
  let parent = debugDiv.parentElement;
  const parentInfo = [];
  for (let i = 0; i < 5 && parent; i++) {
    const style = window.getComputedStyle(parent);
    parentInfo.push({
      tag: parent.tagName,
      class: parent.className.substring(0, 50),
      display: style.display,
      overflow: style.overflow,
      width: style.width,
      height: style.height,
      childCount: parent.children.length
    });
    parent = parent.parentElement;
  }
  return { parentInfo };
});
console.log('\n=== PANEL PARENTS ===');
console.log(JSON.stringify(panelContent, null, 2));

// Check if the card container div exists and its state
const cardContainer = await page.evaluate(() => {
  // Find the spin container in panel
  const allDivs = Array.from(document.querySelectorAll('div'));
  let debugDiv = allDivs.find(d => d.textContent && d.textContent.includes('DEBUG: scores panel'));
  if (!debugDiv) return { error: 'no debug div' };

  // Find spin in panel
  const spins = Array.from(document.querySelectorAll('.ant-spin'));
  for (const spin of spins) {
    let p = spin.parentElement;
    let found = false;
    while (p) {
      if (p.textContent && p.textContent.includes('DEBUG: scores panel')) {
        found = true;
        break;
      }
      p = p.parentElement;
    }
    if (found) {
      // The spin's next sibling should be the card container
      const nextSibling = spin.nextElementSibling;
      const prevSibling = spin.previousElementSibling;
      return {
        spinFound: true,
        spinHTML: spin.outerHTML.substring(0, 200),
        spinDisplay: window.getComputedStyle(spin).display,
        spinVisibility: window.getComputedStyle(spin).visibility,
        spinOpacity: window.getComputedStyle(spin).opacity,
        nextSiblingTag: nextSibling ? nextSibling.tagName : null,
        nextSiblingClass: nextSibling ? nextSibling.className.substring(0, 50) : null,
        nextSiblingDisplay: nextSibling ? window.getComputedStyle(nextSibling).display : null,
        prevSiblingTag: prevSibling ? prevSibling.tagName : null,
        prevSiblingClass: prevSibling ? prevSibling.className.substring(0, 50) : null,
      };
    }
  }
  return { spinFound: false };
});
console.log('\n=== CARD CONTAINER ===');
console.log(JSON.stringify(cardContainer, null, 2));

console.log('\n=== RELEVANT LOGS ===');
const relevant = logs.filter(l => l.includes('SCORE') || l.includes('DEBUG') || l.includes('tasks') || l.includes('panel'));
console.log(relevant.join('\n'));

await browser.close();
