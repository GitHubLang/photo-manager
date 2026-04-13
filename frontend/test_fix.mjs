import { chromium } from 'playwright';

const browser = await chromium.launch({ executablePath: 'C:\\Users\\ADMIN\\AppData\\Local\\ms-playwright\\chromium-1217\\chrome-win64\\chrome.exe', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 720 });

const logs = [];
page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));

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

// Check results
const results = await page.evaluate(() => {
  const allDivs = Array.from(document.querySelectorAll('div'));
  const debugDiv = allDivs.find(d => d.textContent && d.textContent.includes('scores panel'));
  const allCards = Array.from(document.querySelectorAll('.ant-card'));
  const allEmpties = Array.from(document.querySelectorAll('.ant-empty'));

  // Check panel
  let panelCards = 0;
  let panelEmpty = false;
  let debugText = null;
  if (debugDiv) {
    debugText = debugDiv.textContent.trim().substring(0, 50);
    let p = debugDiv.parentElement;
    while (p) {
      const cards = p.querySelectorAll('.ant-card');
      panelCards += cards.length;
      if (p.querySelector('.ant-empty')) panelEmpty = true;
      p = p.parentElement;
      if (p && p.tagName === 'BODY') break;
    }
  }

  // Check for spin with cards inside
  const spins = Array.from(document.querySelectorAll('.ant-spin'));
  let spinWithCards = null;
  for (const spin of spins) {
    const cards = spin.querySelectorAll('.ant-card');
    if (cards.length > 0) {
      const spinParent = spin.parentElement;
      let isInPanel = false;
      if (debugDiv) {
        let p = debugDiv.parentElement;
        while (p && p.tagName !== 'BODY') {
          if (p === spinParent) { isInPanel = true; break; }
          p = p.parentElement;
        }
      }
      spinWithCards = { cards: cards.length, isInPanel, spinHeight: spin.getBoundingClientRect().height };
    }
  }

  return {
    debugText,
    panelCards,
    panelEmpty,
    totalCards: allCards.length,
    totalEmpties: allEmpties.length,
    spinWithCards,
    // Check ant-spin-container height
    spinContainerHeight: (() => {
      const containers = document.querySelectorAll('.ant-spin-container');
      for (const c of containers) {
        if (c.closest('.scores-panel') || (debugDiv && debugDiv.parentElement?.contains(c))) {
          return c.getBoundingClientRect().height;
        }
      }
      return containers.length > 0 ? containers[0].getBoundingClientRect().height : 'none';
    })()
  };
});
console.log('Results:', JSON.stringify(results, null, 2));

// Show logs
console.log('\nRelevant logs:');
logs.filter(l => l.includes('SCORE') || l.includes('tasks')).forEach(l => console.log(l));

await browser.close();
