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
  try {
    await page.goto("http://192.168.71.55:4500/", {waitUntil: "networkidle", timeout: 20000});
    await page.waitForTimeout(3000);
    const text = await page.evaluate(() => document.body.innerText);
    console.log("Body text:", text.slice(0,500));
  } catch(e) { console.log("Nav err:", e.message); }
  console.log("\nErrors:", JSON.stringify(errors.slice(0,5)));
  await browser.close();
})();
