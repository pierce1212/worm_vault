import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '..', 'assets', 'text');
const pdfPath = 'C:/Users/nvtc140/Zotero/storage/GKPNECE2/S32K3xx Reference Manual.pdf';
const pdfjsPath = 'E:/github/.codex_tools/siul2_notes/node_modules/pdfjs-dist/legacy/build/pdf.mjs';

const pdfjs = await import(`file:///${pdfjsPath.replaceAll('\\', '/')}`);

await fs.mkdir(outDir, { recursive: true });

const doc = await pdfjs.getDocument({
  url: pdfPath,
  disableWorker: true,
  useSystemFonts: true,
}).promise;

const ranges = [
  { name: 'chapter64_bctu_pages_2680_2718', start: 2680, end: 2718 },
  { name: 'pcmc_adc_context_pages_2296_2330', start: 2296, end: 2330 },
  { name: 'trgmux_context_pages_2720_2736', start: 2720, end: 2736 },
];

for (const range of ranges) {
  const chunks = [];
  for (let pageNum = range.start; pageNum <= range.end; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => item.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    chunks.push(`\n\n===== PDF page ${pageNum} =====\n${text}`);
  }
  await fs.writeFile(path.join(outDir, `${range.name}.txt`), chunks.join('\n'), 'utf8');
}

console.log(`Extracted ${ranges.length} text files from ${doc.numPages} PDF pages.`);
