import { chromium } from '@playwright/test';

const browser = await chromium.launch({ 
  headless: true,
  executablePath: 'C:\\Users\\ADMIN\\AppData\\Local\\ms-playwright\\chromium-1217\\chrome-win64\\chrome.exe'
});

const page = await browser.newPage();
page.on('console', msg => {
  const text = msg.text();
  if (text.includes('SCORE') || text.includes('DEBUG') || text.includes('panel') || text.includes('tasks')) {
    console.log('[CONSOLE]', text);
  }
});

try {
  await page.goto('http://192.168.71.55:4173/', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForSelector('.ant-menu', { timeout: 5000 });
  
  await page.locator('.ant-menu-item', { hasText: '评分记录' }).click();
  await page.waitForTimeout(4000);

  const result = await page.evaluate(() => {
    const sider = document.querySelector('.ant-layout-has-sider');
    const col1 = sider.children[1];
    
    // Get the Spin container
    const spin = col1.querySelector('.ant-spin');
    const spinContainer = spin ? spin.querySelector('.ant-spin-container') : null;
    
    // Get the flex column div (card list)
    const cardList = spinContainer ? spinContainer.querySelector('div[style*="flex-direction: column"]') : null;
    
    const results = {
      spinFound: !!spin,
      spinContainerFound: !!spinContainer,
      cardListFound: !!cardList,
    };
    
    if (spinContainer) {
      results.spinContainerHTML = spinContainer.innerHTML.substring(0, 300);
      results.spinContainerChildren = spinContainer.children.length;
      results.spinContainerStyle = {
        display: window.getComputedStyle(spinContainer).display,
        flexDirection: window.getComputedStyle(spinContainer).flexDirection,
        gap: window.getComputedStyle(spinContainer).gap,
        height: window.getComputedStyle(spinContainer).height
      };
    }
    
    if (cardList) {
      results.cardListChildren = cardList.children.length;
      results.cardListStyle = {
        display: window.getComputedStyle(cardList).display,
        height: window.getComputedStyle(cardList).height
      };
    }
    
    // Check all divs in col1 for any with cards
    const allDivs = col1.querySelectorAll('div');
    results.allDivsWithChildren = Array.from(allDivs).filter(d => d.children.length > 0).map(d => ({
      childCount: d.children.length,
      class: d.className.substring(0, 50),
      style: window.getComputedStyle(d).display
    }));
    
    // Check scoreTasks state via React Fiber
    const reactFiber = Object.keys(window).find(k => k.startsWith('__reactFiber'));
    if (reactFiber) {
      // Try to find the App component's state
      const allFibers = document.querySelectorAll('*');
      let scoreTasksLen = 'not found';
      for (const el of allFibers) {
        const key = Object.keys(el).find(k => k.startsWith('__reactFiber'));
        if (key) {
          const fiber = el[key];
          try {
            const stateNode = fiber?.return?.return?.memoizedState;
            if (stateNode && typeof stateNode === 'object') {
              // Look for scoreTasks
            }
          } catch(e) {}
        }
      }
    }
    
    return results;
  });
  
  console.log('\nSpin + card list details:', JSON.stringify(result, null, 2));

} catch (err) {
  console.error('Error:', err.message);
}

await browser.close();
