import { chromium } from '@playwright/test';

const browser = await chromium.launch({ 
  headless: true,
  executablePath: 'C:\\Users\\ADMIN\\AppData\\Local\\ms-playwright\\chromium-1217\\chrome-win64\\chrome.exe'
});

const page = await browser.newPage();
const allLogs = [];

page.on('console', msg => allLogs.push(`[${msg.type()}] ${msg.text()}`));

try {
  await page.goto('http://192.168.71.55:4173/', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForSelector('.ant-menu', { timeout: 5000 });
  
  // Inject a debug hook into React state
  await page.evaluate(() => {
    // Try to find React internal state
    window.__debug_scoreTasks = null;
    window.__debug_activeMenu = null;
  });

  // Click 评分记录
  await page.locator('.ant-menu-item', { hasText: '评分记录' }).click();
  await page.waitForTimeout(5000);
  
  // Get the full innerHTML of the sider children
  const siderChildren = await page.evaluate(() => {
    const sider = document.querySelector('.ant-layout-sider-children');
    if (!sider) return 'NO SIDER';
    return sider.innerHTML.substring(0, 2000);
  });
  console.log('Sider children HTML:\n', siderChildren);
  
  // Check all divs in the sider and their content
  const siderStructure = await page.evaluate(() => {
    const siderChildren = document.querySelector('.ant-layout-sider-children');
    if (!siderChildren) return {};
    
    const result = [];
    Array.from(siderChildren.children).forEach((child, idx) => {
      result.push({
        idx,
        tag: child.tagName,
        class: child.className,
        childCount: child.children.length,
        textContent: child.textContent?.substring(0, 100)
      });
      if (child.children.length > 0) {
        Array.from(child.children).forEach((grandchild, gidx) => {
          result.push({
            idx: `${idx}.${gidx}`,
            tag: grandchild.tagName,
            class: grandchild.className,
            childCount: grandchild.children.length,
            textContent: grandchild.textContent?.substring(0, 100)
          });
        });
      }
    });
    return result;
  });
  console.log('\nSider structure:', JSON.stringify(siderStructure, null, 2));
  
  // Get ALL console logs
  console.log('\nAll console logs:');
  allLogs.forEach(log => console.log(log));
  
  // Try clicking文案记录 instead to see if that works
  console.log('\n--- Now clicking 文案记录 ---');
  await page.locator('.ant-menu-item', { hasText: '文案记录' }).click();
  await page.waitForTimeout(3000);
  
  const captionContent = await page.evaluate(() => {
    const sider = document.querySelector('.ant-layout-sider-children');
    if (!sider) return 'NO SIDER';
    return sider.textContent?.substring(0, 300);
  });
  console.log('After 文案记录 click:', captionContent);
  
  // Check for caption panel
  const captionPanelDivs = await page.evaluate(() => {
    const allDivs = document.querySelectorAll('div');
    return Array.from(allDivs).filter(d => 
      String(d.className).includes('caption')
    ).length;
  });
  console.log('Caption divs count:', captionPanelDivs);

} catch (err) {
  console.error('Error:', err.message);
}

await browser.close();
