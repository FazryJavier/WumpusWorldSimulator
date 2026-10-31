// Menyalin file statis yang dibutuhkan browser ke dist/ untuk deploy (mis. Cloudflare Pages).
// Hanya aset runtime yang ikut; node_modules, tests, docs, dan server.cjs tidak dipublikasikan.
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const STATIC_ENTRIES = ["index.html", "css", "js", "img", "i18n"];

// Header keamanan dasar, setara dengan yang dikirim server.cjs.
export const HEADERS = `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY

/i18n/*
  Cache-Control: no-cache
`;

export function build(root, outDir = path.join(root, "dist")) {
    rmSync(outDir, { recursive: true, force: true });
    mkdirSync(outDir, { recursive: true });
    for (const entry of STATIC_ENTRIES) {
        cpSync(path.join(root, entry), path.join(outDir, entry), { recursive: true });
    }
    writeFileSync(path.join(outDir, "_headers"), HEADERS);
    return outDir;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const root = fileURLToPath(new URL("..", import.meta.url));
    console.log(`Built ${build(root)}`);
}
