import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build, STATIC_ENTRIES } from "../../scripts/build.js";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

describe("scripts/build.js", () => {
    it("copies only runtime assets into the output directory", () => {
        const out = mkdtempSync(path.join(tmpdir(), "wumpus-dist-"));
        try {
            build(ROOT, out);
            for (const entry of STATIC_ENTRIES) assert.ok(existsSync(path.join(out, entry)), entry);
            assert.ok(existsSync(path.join(out, "js/main.js")));
            assert.ok(existsSync(path.join(out, "i18n/en_us.json")));
            for (const excluded of ["node_modules", "tests", "docs", "server.cjs", "package.json", ".git"]) {
                assert.ok(!existsSync(path.join(out, excluded)), `${excluded} must not be published`);
            }
            assert.match(readFileSync(path.join(out, "_headers"), "utf8"), /X-Content-Type-Options: nosniff/);
        } finally {
            rmSync(out, { recursive: true, force: true });
        }
    });

    it("removes stale files from a previous build", () => {
        const out = mkdtempSync(path.join(tmpdir(), "wumpus-dist-"));
        try {
            build(ROOT, out);
            const stale = path.join(out, "stale.txt");
            writeFileSync(stale, "old");
            build(ROOT, out);
            assert.ok(!existsSync(stale));
        } finally {
            rmSync(out, { recursive: true, force: true });
        }
    });
});
