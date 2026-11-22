import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import fs from "node:fs";

const require = createRequire("E:/github/.codex_tools/siul2_notes/package.json");
const pdfjs = await import(pathToFileURL(require.resolve("pdfjs-dist/legacy/build/pdf.mjs")).href);

const pdfPath = "C:/Users/nvtc140/Zotero/storage/GKPNECE2/S32K3xx Reference Manual.pdf";
const data = new Uint8Array(fs.readFileSync(pdfPath));
const pdf = await pdfjs.getDocument({ data, disableWorker: true }).promise;

const start = Number(process.argv[2] ?? 3043);
const end = Number(process.argv[3] ?? start);

for (let pageNum = start; pageNum <= end; pageNum++) {
  const page = await pdf.getPage(pageNum);
  const content = await page.getTextContent();
  const text = content.items.map((item) => item.str).join(" ").replace(/\s+/g, " ");
  console.log(`\n===== PDF page ${pageNum} =====`);
  console.log(text.slice(0, 5000));
}
