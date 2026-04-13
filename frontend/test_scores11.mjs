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

  // Check the panel container
  const panelInfo = await page.evaluate(() => {
    const layout = document.querySelector('.ant-layout-has-sider');
    const children = layout.children;
    const panelContainer = children[1]; // The 300px div
    
    const info = {
      class: panelContainer.className,
      id: panelContainer.id,
      childCount: panelContainer.children.length,
      children: []
    };
    
    Array.from(panelContainer.children).forEach((child, i) => {
      info.children.push({
        index: i,
        class: child.className,
        tag: child.tagName,
        display: window.getComputedStyle(child).display,
        width: window.getComputedStyle(child).width,
        height: window.getComputedStyle(child).height,
        text: child.textContent?.substring(0, 80)
      });
    });
    
    // Check if the ScorePanel or FolderDrawer is somewhere else in DOM
    const allPanels = [];
    document.querySelectorAll('*').forEach(el => {
      const cls = String(el.className || '');
      if (cls.includes('folder-drawer') || cls.includes('score-panel') || cls.includes('caption-panel') || cls.includes('folder-drawer')) {
        allPanels.push({
          tag: el.tagName,
          class: cls.substring(0, 80),
          display: window.getComputedStyle(el).display,
          text: el.textContent?.substring(0, 50)
        });
      }
    });
    info.allPanels = allPanels;
    
    return info;
  });
  
  console.log('Panel container:', JSON.stringify(panelInfo, null, 2));
  
} catch (err) {
  console.error('Error:', err.message);
}

await browser.close();
