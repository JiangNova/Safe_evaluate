const puppeteer = require("puppeteer");
const path = require("path");

(async () => {
  const htmlPath = path.resolve(__dirname, "user-manual.html");
  const pdfPath = path.resolve(__dirname, "SafeEvaluate-用户手册.pdf");

  console.log("Launching browser...");
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  console.log("Loading HTML...");
  await page.goto(`file://${htmlPath}`, {
    waitUntil: "networkidle0",
    timeout: 30000,
  });

  console.log("Generating PDF...");
  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    margin: { top: "20mm", right: "18mm", bottom: "22mm", left: "18mm" },
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate:
      '<span style="font-size:9px;color:#999;font-family:Microsoft YaHei,sans-serif;width:100%;text-align:center;">— <span class="pageNumber"></span> —</span>',
  });

  await browser.close();
  console.log(`PDF generated: ${pdfPath}`);
})();
