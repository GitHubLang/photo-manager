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
  await page.waitForTimeout(4000);

  // Check the full sider layout tree
  const siderTree = await page.evaluate(() => {
    const sider = document.querySelector('.ant-layout-has-sider');
    
    function describeElement(el, depth=0) {
      if (!el) return 'null';
      const style = window.getComputedStyle(el);
      return {
        tag: el.tagName,
        class: el.className.split(' ').slice(0, 2).join(' '),
        display: style.display,
        width: Math.round(parseFloat(style.width)),
        height: Math.round(parseFloat(style.height)),
        children: el.children.length,
        childrenSummary: Array.from(el.children).slice(0, 3).map(c => c.className.split(' ')[0] || c.tagName)
      };
    }
    
    return {
      sider: describeElement(sider),
      col0: describeElement(sider.children[0]),
      col1: describeElement(sider.children[1]),
      col2: describeElement(sider.children[2])
    };
  });
  console.log('Sider tree:', JSON.stringify(siderTree, null, 2));
  
  // Now let's look at what actually scrolls (where the cards would be)
  const scrollArea = await page.evaluate(() => {
    const sider = document.querySelector('.ant-layout-has-sider');
    const col1 = sider.children[1]; // 300px panel
    
    // Check if there's a scroll container
    const scrollable = Array.from(col1.querySelectorAll('*')).find(el => 
      window.getComputedStyle(el).overflowY === 'auto' ||
      window.getComputedStyle(el).overflowY === 'scroll'
    );
    
    if (scrollable) {
      return {
        found: true,
        class: scrollable.className,
        height: window.getComputedStyle(scrollable).height,
        scrollHeight: scrollable.scrollHeight,
        childCount: scrollable.children.length
      };
    }
    return { found: false, col1Children: col1.children.length };
  });
  console.log('\nScroll area:', JSON.stringify(scrollArea));
  
  // Check the card list div
  const cardListCheck = await page.evaluate(() => {
    // The panel container is 300px but only shows headers
    // Cards might be in a scrollable div inside
    const sider = document.querySelector('.ant-layout-has-sider');
    const col1 = sider.children[1];
    
    // Get ALL children recursively
    function getAllChildren(el, depth=0) {
      if (depth > 3 || !el) return [];
      const result = [];
      Array.from(el.children).forEach(child => {
        const style = window.getComputedStyle(child);
        if (child.children.length > 0 && style.display !== 'none') {
          result.push({
            tag: child.tagName,
            class: child.className.split(' ')[0],
            display: style.display,
            w: Math.round(parseFloat(style.width)),
            h: Math.round(parseFloat(style.height)),
            children: child.children.length
          });
          result.push(...getAllChildren(child, depth+1));
        }
      });
      return result;
    }
    
    return getAllChildren(col1);
  });
  console.log('\nAll visible nested elements:', JSON.stringify(cardListCheck, null, 2));

} catch (err) {
  console.error('Error:', err.message);
}

await browser.close();
