import { chromium } from '@playwright/test';

const browser = await chromium.launch({ 
  headless: true,
  executablePath: 'C:\\Users\\ADMIN\\AppData\\Local\\ms-playwright\\chromium-1217\\chrome-win64\\chrome.exe'
});

const page = await browser.newPage();
const logs = [];
page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));

try {
  await page.goto('http://192.168.71.55:4173/', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForSelector('.ant-menu', { timeout: 5000 });

  // Test 文案记录 - should work
  console.log('=== Testing 文案记录 ===');
  await page.locator('.ant-menu-item', { hasText: '文案记录' }).click();
  await page.waitForTimeout(3000);
  
  const captionDivs = await page.evaluate(() => {
    const allDivs = document.querySelectorAll('div');
    return Array.from(allDivs).filter(d => 
      String(d.className).includes('caption') && d.textContent?.includes('文案记录')
    ).map(d => ({
      class: d.className.substring(0, 50),
      display: window.getComputedStyle(d).display,
      text: d.textContent?.substring(0, 80)
    }));
  });
  console.log('Caption divs found:', captionDivs.length);
  captionDivs.forEach(d => console.log(' ', JSON.stringify(d)));

  // Now test 评分记录
  console.log('\n=== Testing 评分记录 ===');
  await page.locator('.ant-menu-item', { hasText: '评分记录' }).click();
  await page.waitForTimeout(3000);

  const scoreDivs = await page.evaluate(() => {
    const allDivs = document.querySelectorAll('div');
    return Array.from(allDivs).filter(d => 
      String(d.className).includes('score') && d.textContent?.includes('评分记录')
    ).map(d => ({
      class: d.className.substring(0, 50),
      display: window.getComputedStyle(d).display,
      opacity: window.getComputedStyle(d).opacity,
      text: d.textContent?.substring(0, 80)
    }));
  });
  console.log('Score divs found:', scoreDivs.length);
  scoreDivs.forEach(d => console.log(' ', JSON.stringify(d)));

  // Check the full DOM structure of sider children
  const siderStructure = await page.evaluate(() => {
    const sider = document.querySelector('.ant-layout-sider-children');
    if (!sider) return 'NO SIDER';
    return Array.from(sider.children).map(c => ({
      tag: c.tagName,
      class: c.className.substring(0, 50),
      childCount: c.children.length,
      text: c.textContent?.substring(0, 100)
    }));
  });
  console.log('\nSider children:', JSON.stringify(siderStructure, null, 2));

  // Check which panel condition is met by looking at what renders
  const panels = await page.evaluate(() => {
    // Get the entire body HTML and look for the panel
    const body = document.body.innerHTML;
    // Look for "activeMenu" or "scores" panel
    const hasScorePanel = body.includes('scoreTasksTotal') || body.includes('共925条');
    const hasCaptionPanel = body.includes('captionHistory') || body.includes('暂无文案');
    return { hasScorePanel, hasCaptionPanel };
  });
  console.log('\nPanels in DOM:', JSON.stringify(panels));

  console.log('\nAll logs:', logs);

} catch (err) {
  console.error('Error:', err.message);
}

await browser.close();
