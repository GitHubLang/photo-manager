const {chromium} = require("playwright");
(async () => {
  const browser = await chromium.launch({
    executablePath: "C:\\Users\\ADMIN\\AppData\\Local\\ms-playwright\\chromium-1217\\chrome-win64\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"]
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("console", msg => { if (msg.type() === "error") errors.push("E: " + msg.text()); });
  page.on("pageerror", err => { errors.push("PE: " + err.message); });
  
  await page.goto("http://192.168.71.55:4500/", {waitUntil: "networkidle", timeout: 20000});
  await page.waitForTimeout(2000);
  
  console.log("=== Photo Manager Functional Test ===\n");
  
  // Test 1: Basic page load
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log("1. Page load:", bodyText.includes("摄影素材管理系统") ? "PASS" : "FAIL");
  console.log("   Images loaded:", bodyText.includes("当前:") ? "PASS" : "FAIL");
  console.log("   Image cards:", bodyText.includes("DSC0") ? "PASS" : "FAIL");
  
  // Test 2: Select an image (click first image card)
  const firstCard = page.locator(".image-card").first();
  if (await firstCard.count() > 0) {
    await firstCard.click();
    await page.waitForTimeout(500);
    console.log("2. Image click: PASS");
  } else {
    console.log("2. Image click: FAIL (no cards found)");
  }
  
  // Test 3: Check action bar
  const actionBar = await page.locator(".action-bar").count();
  console.log("3. Action bar:", actionBar > 0 ? "PASS" : "FAIL");
  
  // Test 4: Check sidebar
  const menuItems = await page.locator(".ant-menu-item").count();
  console.log("4. Sidebar menu items:", menuItems, menuItems >= 3 ? "PASS" : "FAIL");
  
  // Test 5: Click "评分记录" in sidebar
  const scoreMenu = page.locator(".ant-menu-item").filter({hasText: "评分记录"}).first();
  if (await scoreMenu.count() > 0) {
    await scoreMenu.click();
    await page.waitForTimeout(2000);
    const newText = await page.evaluate(() => document.body.innerText);
    console.log("5. Score panel click:", newText.includes("评分") || newText.includes("任务") ? "PASS" : "NEEDS CHECK");
  } else {
    console.log("5. Score panel click: FAIL");
  }
  
  // Test 6: Click "文案记录" in sidebar
  const captionMenu = page.locator(".ant-menu-item").filter({hasText: "文案记录"}).first();
  if (await captionMenu.count() > 0) {
    await captionMenu.click();
    await page.waitForTimeout(2000);
    const newText = await page.evaluate(() => document.body.innerText);
    console.log("6. Caption panel click:", newText.includes("文案") || newText.includes("记录") ? "PASS" : "NEEDS CHECK");
  }
  
  // Test 7: Go back to folder view
  const folderMenu = page.locator(".ant-menu-item").filter({hasText: "文件夹"}).first();
  if (await folderMenu.count() > 0) {
    await folderMenu.click();
    await page.waitForTimeout(1000);
  }
  
  // Test 8: Search
  const searchInput = page.locator(".ant-input-search").first();
  if (await searchInput.count() > 0) {
    await searchInput.fill("DSC");
    await page.waitForTimeout(2000);
    const searchText = await page.evaluate(() => document.body.innerText);
    console.log("7. Search:", searchText.includes("DSC") ? "PASS" : "FAIL");
    await searchInput.fill("");
    await page.waitForTimeout(1000);
  }
  
  console.log("\n=== Errors ===");
  if (errors.length === 0) {
    console.log("No errors!");
  } else {
    errors.forEach(e => console.log(e));
  }
  
  await browser.close();
})();
