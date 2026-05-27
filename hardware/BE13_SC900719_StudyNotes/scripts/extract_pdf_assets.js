const fs = require("fs");
const path = require("path");
const { createCanvas } = require("E:/github/.codex_tools/siul2_notes/node_modules/@napi-rs/canvas");

const pdfPath = "C:/Users/nvtc140/Zotero/storage/JYG22VSP/BE13-SC900719 2022Q1.pdf";
const outDir = path.resolve(__dirname, "../assets/pdf");
const textDir = path.resolve(__dirname, "../assets/text");
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(textDir, { recursive: true });

async function loadPdfJs() {
  const pdfjs = await import("file:///E:/github/.codex_tools/siul2_notes/node_modules/pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc =
    "file:///E:/github/.codex_tools/siul2_notes/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs";
  return pdfjs;
}

async function renderPage(pdf, pageNumber, name, scale = 1.65) {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  const png = canvas.toBuffer("image/png");
  fs.writeFileSync(path.join(outDir, `${name}.png`), png);
}

async function extractText(pdf, pageNumbers) {
  const chunks = [];
  for (const pageNumber of pageNumbers) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map((item) => item.str).join(" ");
    chunks.push(`\n\n===== PDF page ${pageNumber} =====\n${text}\n`);
  }
  fs.writeFileSync(path.join(textDir, "key_pages.txt"), chunks.join(""), "utf8");
}

async function extractOutline(pdf) {
  const outline = await pdf.getOutline();
  function flatten(items, depth = 0, rows = []) {
    if (!items) return rows;
    for (const item of items) {
      rows.push(`${"  ".repeat(depth)}- ${item.title}`);
      flatten(item.items, depth + 1, rows);
    }
    return rows;
  }
  fs.writeFileSync(path.join(textDir, "outline.txt"), flatten(outline).join("\n"), "utf8");
}

async function main() {
  const pdfjs = await loadPdfJs();
  const bytes = new Uint8Array(fs.readFileSync(pdfPath));
  const pdf = await pdfjs.getDocument({
    data: bytes,
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: false,
  }).promise;

  await extractOutline(pdf);
  await extractText(pdf, [
    1, 4, 5, 6, 15, 16, 17, 18, 19, 30, 42, 45, 52, 54, 64, 74, 77, 82, 86, 87, 89,
    124, 126, 127,
  ]);

  const pages = [
    [4, "p04_internal_block_diagram"],
    [15, "p15_general_description"],
    [42, "p42_dual_can_interfaces"],
    [45, "p45_pump_motor_predriver"],
    [52, "p52_high_side_driver"],
    [54, "p54_low_side_valves"],
    [64, "p64_wheel_speed_sensor"],
    [82, "p82_spi_interface"],
    [87, "p87_register_table"],
    [126, "p126_bist"],
    [127, "p127_typical_application"],
  ];
  for (const [pageNumber, name] of pages) {
    await renderPage(pdf, pageNumber, name);
  }

  console.log(`Extracted ${pages.length} page screenshots and key page text.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
