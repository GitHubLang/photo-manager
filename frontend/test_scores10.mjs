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
  await page.waitForTimeout(3000);

  // Get the full layout structure - what React actually rendered
  const fullDOM = await page.evaluate(() => {
    const appLayout = document.querySelector('.app-layout');
    if (!appLayout) return 'no app-layout';
    
    // Get ALL elements with their computed display/opacity
    const results = [];
    
    // Check the Layout.Content area
    const content = document.querySelector('.app-layout > div:last-child');
    if (content) {
      results.push({
        where: 'app-layout content div',
        class: content.className.split(' ').slice(0, 3).join(' '),
        display: window.getComputedStyle(content).display,
        opacity: window.getComputedStyle(content).opacity,
        width: window.getComputedStyle(content).width,
        height: window.getComputedStyle(content).height,
        childCount: content.children.length
      });
    }
    
    // Check what's inside content
    if (content) {
      Array.from(content.children).forEach((child, i) => {
        const style = window.getComputedStyle(child);
        results.push({
          where: `content child ${i}`,
          class: child.className.split(' ')[0],
          display: style.display,
          opacity: style.opacity,
          width: style.width,
          height: style.height,
          childCount: child.children.length
        });
      });
    }
    
    // Find ALL divs with 'folder-drawer' or score related classes
    document.querySelectorAll('*').forEach(el => {
      const cls = String(el.className || '');
      if (cls.includes('folder-drawer') || cls.includes('score-panel') || cls.includes('caption-panel')) {
        const style = window.getComputedStyle(el);
        results.push({
          where: 'found in page',
          class: cls.substring(0, 60),
          display: style.display,
          opacity: style.opacity,
          width: style.width,
          height: style.height,
          text: el.textContent?.substring(0, 50)
        });
      }
    });
    
    return results;
  });
  
  console.log('DOM structure:', JSON.stringify(fullDOM, null, 2));
  
  // Also check the full page layout
  const layoutAll = await page.evaluate(() => {
    const layout = document.querySelector('.ant-layout-has-sider');
    if (!layout) return 'no layout with sider';
    const style = window.getComputedStyle(layout);
    return {
      display: style.display,
      width: style.width,
      height: style.height,
      opacity: style.opacity,
      children: layout.children.length,
      childClasses: Array.from(layout.children).map(c => c.className.split(' ')[0])
    };
  });
  console.log('\nLayout with sider:', JSON.stringify(layoutAll));

} catch (err) {
  console.error('Error:', err.message);
}

await browser.close();
