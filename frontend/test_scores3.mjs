import { chromium } from '@playwright/test';

const browser = await chromium.launch({ 
  headless: true,
  executablePath: 'C:\\Users\\ADMIN\\AppData\\Local\\ms-playwright\\chromium-1217\\chrome-win64\\chrome.exe'
});

const page = await browser.newPage();

try {
  await page.goto('http://192.168.71.55:4173/', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForSelector('.ant-menu', { timeout: 5000 });

  // Click 评分记录
  await page.locator('.ant-menu-item', { hasText: '评分记录' }).click();
  await page.waitForTimeout(2000);

  // Get all DOM text to find what's visible
  const bodyText = await page.locator('body').innerText();
  console.log('Body text (first 500):\n', bodyText.substring(0, 500));

  // Check what panels exist in DOM
  const panels = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('[class*="panel"], [class*="drawer"], [class*="sider"]').forEach(el => {
      const cls = el.className;
      const style = window.getComputedStyle(el);
      results.push({
        class: cls,
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        width: style.width,
        height: style.height,
        transform: style.transform,
        text: el.textContent?.substring(0, 30).replace(/\s+/g, ' ')
      });
    });
    return results;
  });
  console.log('\nPanels/drawers in DOM:');
  panels.forEach(p => console.log(`  class="${p.class}" display=${p.display} opacity=${p.opacity} size=${p.width}x${p.height} text="${p.text}"`));

  // Get full class list of all divs
  const allDivClasses = await page.evaluate(() => {
    const classes = new Set();
    document.querySelectorAll('div[class]').forEach(el => {
      String(el.className).split(' ').forEach(c => { if (c.trim()) classes.add(c.trim()); });
    });
    return Array.from(classes).sort();
  });
  console.log('\nAll div classes:', allDivClasses.join(', '));

  // Check for the sidebar score panel specifically
  const scorePanelCheck = await page.evaluate(() => {
    // Look for elements with 'score' in class that might be the sidebar panel
    const allEls = document.querySelectorAll('*');
    const scorePanels = [];
    allEls.forEach(el => {
      const cls = String(el.className || '');
      if (cls.includes('score') && cls.includes('panel') || cls.includes('drawer')) {
        const style = window.getComputedStyle(el);
        scorePanels.push({
          class: cls,
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          width: style.width,
          height: style.height,
          transform: style.transform,
          overflow: style.overflow
        });
      }
    });
    return scorePanels;
  });
  console.log('\nScore panels/drawers:');
  scorePanelCheck.forEach(p => console.log(JSON.stringify(p)));

  // Check for cards in the score panel area
  const scoreCards = await page.evaluate(() => {
    // Find all ant-card elements
    const cards = document.querySelectorAll('.ant-card');
    return {
      count: cards.length,
      firstFew: Array.from(cards).slice(0, 3).map(c => ({
        class: c.className,
        text: c.textContent?.substring(0, 50).replace(/\s+/g, ' ')
      }))
    };
  });
  console.log('\nCards:', JSON.stringify(scoreCards));

  // Save screenshot
  await page.screenshot({ path: 'D:/MySoftware/photo-manager/frontend/test_scores3.png', fullPage: true });
  console.log('\nScreenshot saved');

} catch (err) {
  console.error('Error:', err.message);
}

await browser.close();
