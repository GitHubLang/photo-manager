import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\Users\ADMIN\AppData\Local\ms-playwright\chromium-1217\chrome-win64\chrome.exe',
    headless: true,
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  
  // Collect console errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push('PAGE ERROR: ' + err.message));
  
  console.log('=== Testing refactored photo-manager ===\n');
  
  // Test 1: Load main page
  console.log('1. Loading main page...');
  await page.goto('http://192.168.71.55:4177/', { waitUntil: 'networkidle', timeout: 15000 });
  const title = await page.title();
  console.log('   Title:', title);
  
  // Test 2: Check main UI elements
  console.log('\n2. Checking UI elements...');
  
  // Top toolbar
  const toolbarText = await page.locator('.top-toolbar').textContent().catch(() => 'NOT FOUND');
  console.log('   Top toolbar:', toolbarText.includes('摄影素材') ? 'OK' : 'MISSING');
  
  // Sidebar menu
  const menuItems = await page.locator('.ant-menu-item').count();
  console.log('   Menu items:', menuItems, menuItems > 0 ? 'OK' : 'MISSING');
  
  // Test 3: Check folders loaded
  console.log('\n3. Checking folder loading...');
  await page.waitForTimeout(2000);
  const folderCount = await page.locator('.ant-tree-treenode').count();
  console.log('   Folder tree nodes:', folderCount, folderCount > 0 ? 'OK' : 'EMPTY');
  
  // Test 4: Select a folder and check images load
  console.log('\n4. Testing folder selection and image loading...');
  const firstFolder = page.locator('.ant-tree-node-content-wrapper').first();
  if (await firstFolder.count() > 0) {
    await firstFolder.click();
    await page.waitForTimeout(3000);
    const imageCards = await page.locator('.image-card').count();
    console.log('   Image cards loaded:', imageCards, imageCards > 0 ? 'OK' : 'NONE');
  } else {
    console.log('   No folder found to click');
  }
  
  // Test 5: Check search bar
  console.log('\n5. Testing search...');
  const searchInput = page.locator('.ant-input-search').first();
  if (await searchInput.count() > 0) {
    await searchInput.fill('test');
    await page.waitForTimeout(1000);
    console.log('   Search input: OK');
  } else {
    console.log('   Search input: NOT FOUND');
  }
  
  // Test 6: Check score panel toggle
  console.log('\n6. Testing score panel...');
  const scoreMenuItem = page.locator('.ant-menu-item').filter({ hasText: '评分记录' }).first();
  if (await scoreMenuItem.count() > 0) {
    await scoreMenuItem.click();
    await page.waitForTimeout(2000);
    const scorePanel = await page.locator('.ant-spin').count();
    console.log('   Score panel interaction: OK');
  }
  
  // Test 7: Check action bar
  console.log('\n7. Checking action bar...');
  const actionBar = await page.locator('.action-bar').count();
  console.log('   Action bar present:', actionBar > 0 ? 'OK' : 'MISSING');
  
  // Report errors
  console.log('\n=== Console Errors ===');
  if (errors.length === 0) {
    console.log('No console errors! Clean build.');
  } else {
    errors.forEach(e => console.log('ERROR:', e));
  }
  
  await browser.close();
  console.log('\n=== Test Complete ===');
})().catch(e => {
  console.error('Test failed:', e.message);
  process.exit(1);
});
