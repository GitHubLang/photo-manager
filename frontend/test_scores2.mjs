import { chromium } from '@playwright/test';

const browser = await chromium.launch({ 
  headless: true,
  executablePath: 'C:\\Users\\ADMIN\\AppData\\Local\\ms-playwright\\chromium-1217\\chrome-win64\\chrome.exe'
});

const page = await browser.newPage();
const consoleLogs = [];

page.on('console', msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));

try {
  await page.goto('http://192.168.71.55:4173/', { waitUntil: 'networkidle', timeout: 15000 });
  console.log('Page loaded');

  // Wait for menu to be visible
  await page.waitForSelector('.ant-menu', { timeout: 5000 });
  console.log('Menu visible');

  // Click 评分记录 in menu
  const menuItem = page.locator('.ant-menu-item', { hasText: '评分记录' });
  console.log('Menu items count:', await page.locator('.ant-menu-item').count());
  console.log('Clicking 评分记录...');
  await menuItem.click();
  await page.waitForTimeout(2000);

  // Check state
  const url = page.url();
  console.log('URL:', url);

  // Look for score panel (sidebar)
  const scorePanelVisible = await page.locator('[class*="score"]').count();
  console.log('Elements with score in class:', scorePanelVisible);

  // Look for the sidebar panel content
  const siderPanel = await page.locator('.folder-sider').count();
  console.log('Folder sider found:', siderPanel);

  // Check all menu items classes
  const menuHTML = await page.locator('.ant-menu').innerHTML();
  console.log('\nMenu HTML (first 1000 chars):\n', menuHTML.substring(0, 1000));

  // Look for score panel in DOM
  const panelHTML = await page.evaluate(() => {
    const allDivs = document.querySelectorAll('div');
    const scoreDivs = [];
    for (const div of allDivs) {
      if (div.className && String(div.className).includes('score')) {
        scoreDivs.push({
          class: div.className,
          id: div.id,
          style: window.getComputedStyle(div).display,
          text: div.textContent?.substring(0, 50)
        });
      }
    }
    return scoreDivs;
  });
  console.log('\nScore divs in DOM:', JSON.stringify(panelHTML, null, 2));

  // Check scoreTasks state via console
  const scoreTasksState = await page.evaluate(() => {
    // Try to find React component tree
    const root = document.getElementById('root');
    return root ? 'Root exists' : 'Root missing';
  });
  console.log('\nRoot:', scoreTasksState);

  console.log('\nConsole logs:', consoleLogs.slice(-20));

} catch (err) {
  console.error('Error:', err.message);
}

await browser.close();
