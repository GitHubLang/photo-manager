import { chromium } from '@playwright/test';

const browser = await chromium.launch({ 
  headless: true,
  executablePath: 'C:\\Users\\ADMIN\\AppData\\Local\\ms-playwright\\chromium-1217\\chrome-win64\\chrome.exe'
});

const page = await browser.newPage();

try {
  await page.goto('http://192.168.71.55:4173/', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForSelector('.ant-menu', { timeout: 5000 });

  // Click 文案记录
  await page.locator('.ant-menu-item', { hasText: '文案记录' }).click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'D:/MySoftware/photo-manager/frontend/shot_caption.png', fullPage: true });
  console.log('Caption shot saved');

  // Click 评分记录
  await page.locator('.ant-menu-item', { hasText: '评分记录' }).click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'D:/MySoftware/photo-manager/frontend/shot_scores.png', fullPage: true });
  console.log('Scores shot saved');

  // Check the full layout - look at what div has class name starting with "folder-drawer" or "score"
  const allPanels = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('div[class]').forEach(d => {
      const cls = String(d.className || '');
      if (cls.includes('folder-drawer') || cls.includes('score-panel') || 
          cls.includes('caption-panel') || cls.includes('drawer')) {
        const style = window.getComputedStyle(d);
        results.push({
          class: cls.substring(0, 60),
          display: style.display,
          opacity: style.opacity,
          width: style.width,
          height: style.height,
          transform: style.transform,
          overflow: style.overflow,
          text: d.textContent?.substring(0, 50).replace(/\s+/g, ' ')
        });
      }
    });
    return results;
  });
  console.log('\nDrawer/panel divs:', JSON.stringify(allPanels, null, 2));

} catch (err) {
  console.error('Error:', err.message);
}

await browser.close();
