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

  // Check full DOM structure - get all children of the sider
  const siderContent = await page.evaluate(() => {
    const sider = document.querySelector('.folder-sider');
    if (!sider) return 'NO SIDER';
    
    // Get ALL direct children elements
    const children = Array.from(sider.children).map(child => ({
      tag: child.tagName,
      class: child.className,
      id: child.id,
      childCount: child.children.length
    }));
    
    // Also get the Layout wrapper
    const layout = document.querySelector('.app-layout');
    const layoutChildren = layout ? Array.from(layout.children).map(c => ({
      tag: c.tagName,
      class: c.className,
      childCount: c.children.length
    })) : 'no layout';
    
    return {
      siderChildren: children,
      layoutChildren
    };
  });
  console.log('Sider children:', JSON.stringify(siderContent, null, 2));

  // Check for the score panel - maybe it IS in DOM but not visible
  const allPanels = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('*').forEach(el => {
      const cls = String(el.className || '');
      if (cls.includes('folder-sider') || cls.includes('folder-drawer') || 
          (cls.includes('folder') && cls.includes('panel'))) {
        const style = window.getComputedStyle(el);
        results.push({
          class: cls,
          tag: el.tagName,
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          width: style.width,
          height: style.height,
          transform: style.transform,
          overflow: style.overflow,
          zIndex: style.zIndex
        });
      }
    });
    return results;
  });
  console.log('\nAll folder panels:', JSON.stringify(allPanels, null, 2));

  // Find the score panel div specifically
  const scorePanelDiv = await page.evaluate(() => {
    const allDivs = document.querySelectorAll('div');
    const scorePanel = [];
    allDivs.forEach(div => {
      const cls = String(div.className || '');
      if (cls.includes('score-panel') || cls.includes('scorePanel')) {
        const style = window.getComputedStyle(div);
        scorePanel.push({
          class: cls,
          display: style.display,
          opacity: style.opacity,
          width: style.width,
          height: style.height,
          transform: style.transform,
          innerHTML: div.innerHTML.substring(0, 200)
        });
      }
    });
    return scorePanel;
  });
  console.log('\nScore panel divs:', JSON.stringify(scorePanelDiv, null, 2));

  // Check visibility of all major sections
  const pageSections = await page.evaluate(() => {
    const layout = document.querySelector('.app-layout');
    if (!layout) return 'no layout';
    const sections = [];
    layout.querySelectorAll('> *').forEach(child => {
      const style = window.getComputedStyle(child);
      sections.push({
        tag: child.tagName,
        class: child.className.split(' ')[0],
        display: style.display,
        opacity: style.opacity,
        width: style.width,
        height: style.height,
        visibility: style.visibility
      });
    });
    return sections;
  });
  console.log('\nPage sections:', JSON.stringify(pageSections, null, 2));

  // Try clicking and waiting for React to re-render
  console.log('\nRe-clicking and checking again...');
  await page.locator('.ant-menu-item', { hasText: '评分记录' }).click();
  await page.waitForTimeout(5000);

  const afterReclick = await page.evaluate(() => {
    const sider = document.querySelector('.folder-sider');
    return sider ? {
      textContent: sider.textContent.substring(0, 200),
      childCount: sider.children.length,
      innerHTML: sider.innerHTML.substring(0, 500)
    } : 'no sider';
  });
  console.log('\nAfter reclick:', JSON.stringify(afterReclick, null, 2));

} catch (err) {
  console.error('Error:', err.message);
}

await browser.close();
