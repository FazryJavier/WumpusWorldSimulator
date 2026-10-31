// Server statis lokal tanpa dependensi (pengganti app.js; lihat ADR-0006).
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 8080;
const TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".xml": "application/xml",
    ".wav": "audio/wav",
    ".mp3": "audio/mpeg",
    ".md": "text/markdown; charset=utf-8",
};

const server = http.createServer((req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405, { Allow: "GET, HEAD" }).end();
        return;
    }
    let pathname;
    try {
        pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    } catch {
        res.writeHead(400).end();
        return;
    }
    if (pathname.endsWith("/")) pathname += "index.html";
    // Cegah path traversal: hasil resolve harus tetap di dalam ROOT.
    const file = path.resolve(ROOT, `.${pathname}`);
    const relative = path.relative(ROOT, file);
    if (relative.startsWith("..") || path.isAbsolute(relative) || relative.split(path.sep).some((p) => p.startsWith("."))) {
        res.writeHead(404).end();
        return;
    }
    fs.stat(file, (err, stat) => {
        if (err || !stat.isFile()) {
            res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
            return;
        }
        res.writeHead(200, {
            "Content-Type": TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream",
            "Content-Length": stat.size,
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-cache",
        });
        if (req.method === "HEAD") res.end();
        else fs.createReadStream(file).pipe(res);
    });
});

server.listen(PORT, () => console.log(`Wumpus World Simulator: http://localhost:${PORT}`));
