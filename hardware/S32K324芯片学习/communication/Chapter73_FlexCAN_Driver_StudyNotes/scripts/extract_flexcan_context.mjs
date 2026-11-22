import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import fs from "node:fs";

const require = createRequire("E:/github/.codex_tools/siul2_notes/package.json");
const pdfjs = await import(pathToFileURL(require.resolve("pdfjs-dist/legacy/build/pdf.mjs")).href);

const pdfPath = "C:/Users/nvtc140/Zotero/storage/GKPNECE2/S32K3xx Reference Manual.pdf";
const data = new Uint8Array(fs.readFileSync(pdfPath));
const pdf = await pdfjs.getDocument({ data, disableWorker: true }).promise;

const needles = [
  "73 CAN (FlexCAN)",
  "73.1 Introduction",
  "73.2 Features",
  "73.3 Modes of operation",
  "73.4 External signals",
  "73.5 Memory map and registers",
  "Module Configuration Register",
  "Control 1 Register",
  "Error and Status 1 Register",
  "CAN Bit Timing Register",
  "CAN FD Control Register",
  "Enhanced Nominal CAN Bit Timing",
  "Message buffer structure",
  "Interrupts",
];

const hits = [];
for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
  const page = await pdf.getPage(pageNum);
  const content = await page.getTextContent();
  const text = content.items.map((item) => item.str).join(" ").replace(/\s+/g, " ");
  for (const needle of needles) {
    if (text.includes(needle)) {
      hits.push({ pageNum, needle, text: text.slice(0, 600) });
    }
  }
}

console.log(JSON.stringify({ pages: pdf.numPages, hits }, null, 2));
