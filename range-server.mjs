import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const HOST = "127.0.0.1";
const PORT = 8080;
const ROOT = process.cwd();

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".lcc": "application/json; charset=utf-8",
  ".bin": "application/octet-stream",
  ".lci": "application/octet-stream",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const normalized = path.normalize(decoded).replace(/^([/\\])+/, "");
  const abs = path.resolve(ROOT, normalized);
  if (!abs.startsWith(path.resolve(ROOT))) return null;
  return abs;
}

function send404(res) {
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not Found");
}

const server = http.createServer((req, res) => {
  if (!req.url) return send404(res);
  let filePath = safePath(req.url);
  if (!filePath) return send404(res);

  try {
    let stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, "index.html");
      stat = fs.statSync(filePath);
    }

    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || "application/octet-stream";
    const range = req.headers.range;
    const total = stat.size;

    if (range) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!m) {
        res.writeHead(416, { "Content-Range": `bytes */${total}` });
        return res.end();
      }
      const start = m[1] === "" ? 0 : Number(m[1]);
      const end = m[2] === "" ? total - 1 : Number(m[2]);
      if (
        Number.isNaN(start) ||
        Number.isNaN(end) ||
        start < 0 ||
        end < start ||
        end >= total
      ) {
        res.writeHead(416, { "Content-Range": `bytes */${total}` });
        return res.end();
      }

      res.writeHead(206, {
        "Content-Type": mime,
        "Content-Length": end - start + 1,
        "Content-Range": `bytes ${start}-${end}/${total}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-cache",
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
      return;
    }

    res.writeHead(200, {
      "Content-Type": mime,
      "Content-Length": total,
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-cache",
    });
    fs.createReadStream(filePath).pipe(res);
  } catch {
    send404(res);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Range server running at http://${HOST}:${PORT}/`);
});
