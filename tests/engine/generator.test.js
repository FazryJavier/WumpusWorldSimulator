import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    generateLevel,
    key,
    MODES,
    mulberry32,
    neighbors,
    safeZone,
    shuffle,
    validateConfig,
    validateLevel,
} from "../../js/engine/index.js";

describe("rng", () => {
    it("mulberry32 deterministik dan berada di [0,1)", () => {
        const a = mulberry32(42);
        const b = mulberry32(42);
        for (let i = 0; i < 100; i++) {
            const v = a();
            assert.equal(v, b());
            assert.ok(v >= 0 && v < 1);
        }
    });

    it("shuffle tidak memodifikasi masukan dan mempertahankan elemen", () => {
        const input = Object.freeze([1, 2, 3, 4, 5]);
        const out = shuffle(input, mulberry32(7));
        assert.deepEqual([...out].sort(), [1, 2, 3, 4, 5]);
    });
});

describe("grid", () => {
    it("neighbors berurutan up, down, left, right dan dipangkas di tepi", () => {
        assert.deepEqual(neighbors(4, 4, 0, 0), [
            [0, 1],
            [1, 0],
        ]);
        assert.deepEqual(neighbors(4, 4, 1, 1), [
            [1, 0],
            [1, 2],
            [0, 1],
            [2, 1],
        ]);
    });
});

describe("validateConfig", () => {
    it("menerima semua preset", () => {
        for (const mode of Object.values(MODES)) assert.deepEqual(validateConfig(mode), { ok: true });
    });

    it("menolak ukuran, panah, dan kepadatan di luar batas", () => {
        const base = { ...MODES.easy, mode: "custom" };
        assert.deepEqual(validateConfig({ ...base, cols: 21 }).errors, ["config.cols"]);
        assert.deepEqual(validateConfig({ ...base, arrows: 21 }).errors, ["config.arrows"]);
        assert.deepEqual(validateConfig({ ...base, gold: 0 }).errors, ["config.gold"]);
        assert.deepEqual(validateConfig({ ...base, pits: 14, gold: 1, wumpus: 1 }).errors, ["config.tooDense"]);
        assert.deepEqual(validateConfig({ ...base, pits: 13, gold: 1, wumpus: 1 }), { ok: true });
        assert.equal(validateConfig(null).ok, false);
    });
});

describe("generateLevel", () => {
    it("R-11 generate(config, seed) dua kali menghasilkan level identik", () => {
        for (const mode of Object.values(MODES)) {
            assert.deepEqual(generateLevel(mode, 12345), generateLevel(mode, 12345));
        }
    });

    it("tidak menempatkan elemen di zona aman atau saling bertumpuk", () => {
        for (const mode of Object.values(MODES)) {
            for (let seed = 1; seed <= 200; seed++) {
                const { world } = generateLevel(mode, seed);
                const cells = [...world.pits, ...world.wumpus.map((w) => [w.x, w.y]), ...world.gold].map(([x, y]) =>
                    key(x, y),
                );
                assert.equal(new Set(cells).size, cells.length);
                for (const [x, y] of safeZone(mode)) assert.ok(!cells.includes(key(x, y)));
                assert.equal(world.pits.length, mode.pits);
                assert.equal(world.wumpus.length, mode.wumpus);
                assert.equal(world.gold.length, mode.gold);
            }
        }
    });

    it("R-12 1.000 seed per mode 100% lolos validasi keterjangkauan", () => {
        for (const mode of Object.values(MODES)) {
            for (let seed = 1; seed <= 1000; seed++) {
                const level = generateLevel(mode, seed);
                assert.ok(validateLevel(mode, level.world), `${mode.mode} seed ${seed}`);
            }
        }
    });

    it("menaikkan seed bila level tidak bisa diselesaikan dan menyimpan seed akhir", () => {
        // Mode padat agar sebagian seed pasti gagal validasi.
        const dense = { ...MODES.easy, mode: "custom", pits: 8, wumpus: 0, gold: 1, arrows: 0 };
        let bumped = null;
        for (let seed = 1; seed <= 200 && !bumped; seed++) {
            const level = generateLevel(dense, seed);
            if (level.seed !== seed) bumped = level;
        }
        assert.ok(bumped, "expected at least one seed to be advanced");
        assert.ok(validateLevel(dense, bumped.world));
    });

    it("validateLevel: emas terkurung lubang tidak valid; Wumpus bisa dilewati bila panah cukup", () => {
        const config = { ...MODES.easy, mode: "custom" };
        const blocked = { pits: [[1, 0], [0, 1]], wumpus: [], gold: [[3, 3]] };
        assert.equal(validateLevel(config, blocked), false);
        const wumpusGate = { pits: [[1, 0]], wumpus: [{ x: 0, y: 1, alive: true }], gold: [[3, 3]] };
        assert.equal(validateLevel({ ...config, arrows: 1 }, wumpusGate), true);
        assert.equal(validateLevel({ ...config, arrows: 0 }, wumpusGate), false);
    });

    it("melempar galat untuk seed tidak sah atau konfigurasi mustahil", () => {
        assert.throws(() => generateLevel(MODES.easy, -1), { code: "INVALID_SEED" });
        assert.throws(() => generateLevel(MODES.easy, 1.5), { code: "INVALID_SEED" });
        // 32 lubang di 6×6: emas hampir tidak mungkin terjangkau dalam 100 percobaan.
        const impossible = { ...MODES.easy, mode: "custom", cols: 6, rows: 6, pits: 32, wumpus: 0, gold: 3, arrows: 0 };
        assert.throws(() => generateLevel(impossible, 1), { code: "LEVEL_GENERATION_FAILED" });
    });
});
