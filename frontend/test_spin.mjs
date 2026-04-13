import { chromium } from 'playwright';

const browser = await chromium.launch({ executablePath: 'C:\\Users\\ADMIN\\AppData\\Local\\ms-playwright\\chromium-1217\\chrome-win64\\chrome.exe', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 720 });

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

// Get detailed info about the spin in the scores panel
const spinDetails = await page.evaluate(() => {
  const allDivs = Array.from(document.querySelectorAll('div'));
  const debugDiv = allDivs.find(d => d.textContent && d.textContent.includes('DEBUG: scores panel'));
  if (!debugDiv) return { error: 'no debug div' };

  // Get the panel (direct parent of debug div)
  const panel = debugDiv.parentElement;

  // Find spin inside panel
  const spins = Array.from(document.querySelectorAll('.ant-spin'));
  let panelSpin = null;
  for (const s of spins) {
    let p = s;
    while (p && p !== panel) {
      p = p.parentElement;
    }
    if (p === panel) {
      panelSpin = s;
      break;
    }
  }

  if (!panelSpin) return { error: 'no panel spin found' };

  // Get ALL styles on the spin and its computed styles
  const spinStyles = {
    computed: {
      display: window.getComputedStyle(panelSpin).display,
      visibility: window.getComputedStyle(panelSpin).visibility,
      opacity: window.getComputedStyle(panelSpin).opacity,
      width: window.getComputedStyle(panelSpin).width,
      height: window.getComputedStyle(panelSpin).height,
      minHeight: window.getComputedStyle(panelSpin).minHeight,
      maxHeight: window.getComputedStyle(panelSpin).maxHeight,
      overflow: window.getComputedStyle(panelSpin).overflow,
      position: window.getComputedStyle(panelSpin).position,
      flexGrow: window.getComputedStyle(panelSpin).flexGrow,
      flexShrink: window.getComputedStyle(panelSpin).flexShrink,
    },
    inline: panelSpin.style.cssText,
    classList: Array.from(panelSpin.classList),
    childCount: panelSpin.children.length,
    innerHTML: panelSpin.innerHTML.substring(0, 500),
    boundingRect: panelSpin.getBoundingClientRect(),
  };

  // Get the panel styles
  const panelStyles = {
    computed: {
      display: window.getComputedStyle(panel).display,
      visibility: window.getComputedStyle(panel).visibility,
      width: window.getComputedStyle(panel).width,
      height: window.getComputedStyle(panel).height,
      minHeight: window.getComputedStyle(panel).minHeight,
      maxHeight: window.getComputedStyle(panel).maxHeight,
      overflow: window.getComputedStyle(panel).overflow,
      flexDirection: window.getComputedStyle(panel).flexDirection,
      alignItems: window.getComputedStyle(panel).alignItems,
      justifyContent: window.getComputedStyle(panel).justifyContent,
      gap: window.getComputedStyle(panel).gap,
    },
    inline: panel.style.cssText,
    childCount: panel.children.length,
  };

  // Get panel's children
  const panelChildren = Array.from(panel.children).map((c, i) => {
    const style = window.getComputedStyle(c);
    return {
      index: i,
      tag: c.tagName,
      class: c.className.substring(0, 50),
      display: style.display,
      width: style.width,
      height: style.height,
      minHeight: style.minHeight,
      flex: style.flex,
      flexBasis: style.flexBasis,
    };
  });

  // Check the ant-spin-indicator (the actual spinner)
  const indicator = panelSpin.querySelector('.ant-spin-indicator');
  const spinChildren = Array.from(panelSpin.children).map((c, i) => {
    const style = window.getComputedStyle(c);
    return {
      index: i,
      tag: c.tagName,
      class: c.className,
      display: style.display,
      width: style.width,
      height: style.height,
      innerHTML: c.innerHTML.substring(0, 100),
    };
  });

  return { spinStyles, panelStyles, panelChildren, indicatorExists: !!indicator, spinChildren };
});
console.log('=== SPIN DETAILS ===');
console.log(JSON.stringify(spinDetails, null, 2));

await browser.close();
