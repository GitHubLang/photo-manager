import { chromium } from '@playwright/test';

const browser = await chromium.launch({ 
  headless: true,
  executablePath: 'C:\\Users\\ADMIN\\AppData\\Local\\ms-playwright\\chromium-1217\\chrome-win64\\chrome.exe'
});

const page = await browser.newPage();
const errors = [];
const consoleLogs = [];

page.on('console', msg => {
  consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
});

page.on('pageerror', err => {
  errors.push(err.message);
});

page.on('response', response => {
  if (response.url().includes('score-tasks')) {
    console.log('SCORE-TASKS RESPONSE:', response.status(), response.url());
    response.text().then(body => {
      console.log('BODY:', body.substring(0, 500));
    });
  }
});

try {
  await page.goto('http://192.168.71.55:4173/', { waitUntil: 'networkidle', timeout: 15000 });
  console.log('Page loaded OK');
  
  // Check page title
  console.log('Title:', await page.title());
  
  // Look for the menu
  const menuItems = await page.$$eval('.ant-menu-item', els => els.map(e => e.textContent?.trim()).filter(Boolean));
  console.log('Menu items:', menuItems);
  
  // Click scores tab
  const scoresTab = await page.$('text=评分记录');
  if (scoresTab) {
    console.log('Found 评分记录 tab, clicking...');
    await scoresTab.click();
    await page.waitForTimeout(3000);
    
    // Check URL
    console.log('URL after click:', page.url());
    
    // Check console logs
    console.log('\nConsole logs:');
    consoleLogs.forEach(log => console.log(log));
    
    console.log('\nErrors:');
    errors.forEach(e => console.log('ERROR:', e));
    
    // Check for visible cards
    const cards = await page.$$('.ant-card');
    console.log('\nCards found:', cards.length);
    
    // Check score panel content
    const panelContent = await page.$eval('.score-panel', el => el.innerHTML).catch(() => 'not found');
    console.log('\nScore panel exists:', panelContent !== 'not found');
    console.log('Score panel content length:', panelContent.length);
    
    // Take screenshot
    await page.screenshot({ path: 'D:/MySoftware/photo-manager/frontend/test_scores.png', fullPage: true });
    console.log('\nScreenshot saved to D:/MySoftware/photo-manager/frontend/test_scores.png');
  } else {
    console.log('评分记录 tab not found!');
    // Check if there's a scores tab in bottom nav
    const bottomTabs = await page.$$('.bottom-tab-item');
    console.log('Bottom tabs:', await Promise.all(bottomTabs.map(t => t.textContent())));
  }
  
} catch (err) {
  console.error('Test error:', err.message);
}

await browser.close();
