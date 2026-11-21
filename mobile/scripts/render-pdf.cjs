// Set PLAYWRIGHT_MODULE to the absolute path of an installed playwright package if needed.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fs = require("node:fs");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : {}),
  });
  try {
    const page = await browser.newPage();
    await page.setContent(fs.readFileSync("artifacts/multipage.html", "utf8"), {
      waitUntil: "load",
    });
    const bytes = await page.pdf({
      format: "A4",
      preferCSSPageSize: true,
      printBackground: true,
    });
    const pdf = await PDFDocument.load(bytes);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const pages = pdf.getPages();
    pages.forEach((p, i) => {
      const text = `Page ${i + 1} of ${pages.length}`;
      p.drawText(text, {
        x: p.getWidth() - font.widthOfTextAtSize(text, 8) - 37,
        y: 20,
        size: 8,
        font,
        color: rgb(0.35, 0.43, 0.47),
      });
    });
    fs.writeFileSync("artifacts/multipage.pdf", await pdf.save());
    console.log(JSON.stringify({ pages: pages.length, bytes: bytes.length }));
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
