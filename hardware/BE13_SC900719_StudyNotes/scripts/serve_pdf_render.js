const fs = require("fs");
const path = require("path");
const http = require("http");

const root = path.resolve(__dirname);
const pdfPath = "C:/Users/nvtc140/Zotero/storage/JYG22VSP/BE13-SC900719 2022Q1.pdf";
const pdfjsRoot = "E:/github/.codex_tools/siul2_notes/node_modules/pdfjs-dist/legacy/build";

function send(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  if (url.pathname === "/" || url.pathname === "/render_pdf_page.html") {
    send(res, 200, { "content-type": "text/html; charset=utf-8" }, fs.readFileSync(path.join(root, "render_pdf_page_http.html")));
    return;
  }
  if (url.pathname === "/pdf") {
    send(res, 200, { "content-type": "application/pdf" }, fs.readFileSync(pdfPath));
    return;
  }
  if (url.pathname === "/pdfjs/pdf.mjs") {
    send(res, 200, { "content-type": "text/javascript; charset=utf-8" }, fs.readFileSync(path.join(pdfjsRoot, "pdf.mjs")));
    return;
  }
  if (url.pathname === "/pdfjs/pdf.worker.mjs") {
    send(res, 200, { "content-type": "text/javascript; charset=utf-8" }, fs.readFileSync(path.join(pdfjsRoot, "pdf.worker.mjs")));
    return;
  }
  send(res, 404, { "content-type": "text/plain" }, "not found");
});

const port = Number(process.argv[2] || "8493");
server.listen(port, "127.0.0.1", () => {
  console.log(`http://127.0.0.1:${port}/render_pdf_page.html`);
});
