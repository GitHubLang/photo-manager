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
  
  // Wait for API call
  await page.waitForResponse(r => r.url().includes('score-tasks'), { timeout: 10000 });
  console.log('API call detected');
  
  // Wait more for React to render
  await page.waitForTimeout(5000);
  
  // Check what's in the score panel
  const scorePanelContent = await page.evaluate(() => {
    // Find the score sidebar panel
    const sider = document.querySelector('.folder-sider');
    if (!sider) return 'No sider found';
    
    // Get all text in the sider
    const text = sider.textContent;
    return text;
  });
  console.log('\nScore panel text:\n', scorePanelContent?.substring(0, 800));
  
  // Check for ant-card elements specifically in the sidebar
  const sidebarCards = await page.evaluate(() => {
    const sider = document.querySelector('.folder-sider');
    if (!sider) return { count: 0 };
    const cards = sider.querySelectorAll('.ant-card');
    return {
      count: cards.length,
      firstTexts: Array.from(cards).slice(0, 3).map(c => c.textContent?.substring(0, 50))
    };
  });
  console.log('\nSidebar cards:', JSON.stringify(sidebarCards));
  
  // Check for empty component
  const emptyState = await page.evaluate(() => {
    const sider = document.querySelector('.folder-sider');
    if (!sider) return false;
    const empty = sider.querySelector('.ant-empty');
    return empty ? { found: true, text: empty.textContent } : { found: false };
  });
  console.log('\nEmpty state:', JSON.stringify(emptyState));
  
  // Try clicking and waiting longer
  console.log('\nRe-clicking to retry...');
  await page.locator('.ant-menu-item', { hasText: '评分记录' }).click();
  await page.waitForTimeout(8000);
  
  const sidebarCards2 = await page.evaluate(() => {
    const sider = document.querySelector('.folder-sider');
    if (!sider) return { count: 0 };
    const cards = sider.querySelectorAll('.ant-card');
    return {
      count: cards.length,
      firstTexts: Array.from(cards).slice(0, 3).map(c => c.textContent?.substring(0, 50))
    };
  });
  console.log('Sidebar cards after 8s:', JSON.stringify(sidebarCards2));

  // Save screenshot
  await page.screenshot({ path: 'D:/MySoftware/photo-manager/frontend/test_scores4.png', fullPage: true });
  console.log('\nScreenshot saved');

} catch (err) {
  console.error('Error:', err.message);
}

await browser.close();
