import { chromium } from '@playwright/test';

const browser = await chromium.launch({ 
  headless: true,
  executablePath: 'C:\\Users\\ADMIN\\AppData\\Local\\ms-playwright\\chromium-1217\\chrome-win64\\chrome.exe'
});

const page = await browser.newPage();

try {
  await page.goto('http://192.168.71.55:4173/', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForSelector('.ant-menu', { timeout: 5000 });

  // Try clicking 文案记录 instead - maybe that panel works
  console.log('=== Clicking 文案记录 ===');
  await page.locator('.ant-menu-item', { hasText: '文案记录' }).click();
  await page.waitForTimeout(3000);
  
  const captionPanel = await page.evaluate(() => {
    const allDivs = document.querySelectorAll('div');
    const captionDivs = Array.from(allDivs).filter(d => 
      String(d.className).includes('caption') && d.textContent?.includes('文案')
    );
    return {
      count: captionDivs.length,
      firstClass: captionDivs[0]?.className || 'none',
      text: captionDivs[0]?.textContent?.substring(0, 100) || 'none'
    };
  });
  console.log('Caption panel:', JSON.stringify(captionPanel));
  
  // Also check body text
  const bodyText = await page.locator('body').innerText();
  const hasCaptionHistory = bodyText.includes('暂无文案') || bodyText.includes('文案记录');
  console.log('Has caption history UI:', hasCaptionHistory);
  console.log('Body text (first 300):', bodyText.substring(0, 300));

  // Check if both panels use the same pattern
  console.log('\n=== Summary ===');
  console.log('After clicking 文案记录:');
  console.log('- Caption panel found:', captionPanel.count > 0);
  console.log('- Body shows 文案 history:', bodyText.includes('暂无文案') || bodyText.includes('文案记录'));

} catch (err) {
  console.error('Error:', err.message);
}

await browser.close();
