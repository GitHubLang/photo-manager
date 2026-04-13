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

  // Get the full 3-column layout details
  const layout = await page.evaluate(() => {
    const sider = document.querySelector('.ant-layout-has-sider');
    const cols = sider.children;
    return {
      col0: { class: cols[0].className, w: cols[0].clientWidth, h: cols[0].clientHeight },
      col1: { class: cols[1].className, w: cols[1].clientWidth, h: cols[1].clientHeight, childCount: cols[1].children.length },
      col2: { class: cols[2].className, w: cols[2].clientWidth, h: cols[2].clientHeight }
    };
  });
  console.log('3-column layout:', JSON.stringify(layout));

  // Check what's in the 300px column (col1)
  const col1Details = await page.evaluate(() => {
    const sider = document.querySelector('.ant-layout-has-sider');
    const col1 = sider.children[1];
    return {
      innerHTML: col1.innerHTML.substring(0, 2000),
      scrollHeight: col1.scrollHeight,
      scrollWidth: col1.scrollWidth
    };
  });
  console.log('\nCol1 innerHTML preview:', col1Details.innerHTML.substring(0, 1000));
  
  // Check if cards are rendered anywhere - look for task cards
  const cardCheck = await page.evaluate(() => {
    // Look for elements with task-related classes
    const allDivs = Array.from(document.querySelectorAll('div')).slice(0, 200);
    const cards = allDivs.filter(d => {
      const cls = d.className || '';
      return cls.includes('task-card') || cls.includes('score-card') || 
             cls.includes('ant-card') || cls.includes('item-card') ||
             cls.includes('list-item');
    });
    
    // Also check text content of divs
    const scoreDivs = allDivs.filter(d => 
      d.textContent && d.textContent.includes('completed') && d.children.length > 0
    );
    
    return {
      foundCards: cards.slice(0, 5).map(c => ({ class: c.className, text: c.textContent?.substring(0, 60) })),
      scoreDivs: scoreDivs.slice(0, 3).map(d => ({ class: d.className, text: d.textContent?.substring(0, 60) }))
    };
  });
  console.log('\nCards found:', JSON.stringify(cardCheck));

} catch (err) {
  console.error('Error:', err.message);
}

await browser.close();
