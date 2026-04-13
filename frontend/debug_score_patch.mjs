import { chromium } from '@playwright/test';

const browser = await chromium.launch({ 
  headless: true,
  executablePath: 'C:\\Users\\ADMIN\\AppData\\Local\\ms-playwright\\chromium-1217\\chrome-win64\\chrome.exe'
});

const page = await browser.newPage();
const allLogs = [];

page.on('console', msg => allLogs.push(`[${msg.type()}] ${msg.text()}`));
page.on('request', req => {
  if (req.url().includes('score-tasks')) {
    allLogs.push(`[REQUEST] ${req.method()} ${req.url()}`);
  }
});
page.on('response', res => {
  if (res.url().includes('score-tasks')) {
    allLogs.push(`[RESPONSE] ${res.status()} ${res.url()}`);
  }
});

try {
  await page.goto('http://192.168.71.55:4173/', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForSelector('.ant-menu', { timeout: 5000 });
  
  // Intercept and log ALL requests
  console.log('Page loaded. Clicking 评分记录...');
  
  // Setup response listener BEFORE clicking
  const responsePromise = page.waitForResponse('**/score-tasks**', { timeout: 15000 }).catch(e => {
    allLogs.push(`[TIMEOUT] waitForResponse: ${e.message}`);
    return null;
  });
  
  // Click
  await page.locator('.ant-menu-item', { hasText: '评分记录' }).click();
  console.log('Clicked. Waiting for response...');
  
  // Wait for it
  const response = await responsePromise;
  if (response) {
    const body = await response.text();
    allLogs.push(`[BODY] ${body.substring(0, 200)}`);
  }
  
  // Also wait a bit and check console
  await page.waitForTimeout(3000);
  
  console.log('\n=== ALL LOGS ===');
  allLogs.forEach(log => console.log(log));
  
  // Check sidebar
  const sidebar = await page.evaluate(() => {
    const sider = document.querySelector('.folder-sider');
    if (!sider) return 'NO SIDER';
    const text = sider.textContent;
    return text.includes('暂无记录') ? 'SHOWS EMPTY' : 
           text.includes('共') ? 'HAS COUNT' : 'OTHER: ' + text.substring(0, 100);
  });
  console.log('\nSidebar:', sidebar);
  
  // Check if cards appeared
  const cards = await page.evaluate(() => {
    const sider = document.querySelector('.folder-sider');
    return sider ? sider.querySelectorAll('.ant-card').length : 0;
  });
  console.log('Cards in sidebar:', cards);

} catch (err) {
  console.error('Error:', err.message);
}

await browser.close();
