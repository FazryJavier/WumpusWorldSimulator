import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MODES } from "../../js/engine/index.js";
import { createController } from "../../js/app/controller.js";
import { createStorage, STORAGE_KEYS } from "../../js/app/storage.js";
import { createSettings, detectLocale, sanitizeSettings } from "../../js/app/settings.js";
import { decodeShare, encodeShare } from "../../js/app/share.js";
import { createAgentRunner } from "../../js/app/agent-runner.js";
import { createRecords } from "../../js/app/records.js";

function memoryBackend(initial = {}) {
    const data = new Map(Object.entries(initial));
    return {
        data,
        getItem: (k) => (data.has(k) ? data.get(k) : null),
        setItem: (k, v) => data.set(k, String(v)),
        removeItem: (k) => data.delete(k),
    };
}

const throwingBackend = {
    getItem() {
        throw new Error("blocked");
    },
    setItem() {
        throw new Error("blocked");
    },
    removeItem() {
        throw new Error("blocked");
    },
};

function fakeTimers() {
    const queue = [];
    return {
        queue,
        setTimeout(fn, ms) {
            queue.push({ fn, ms });
            return queue.length;
        },
        clearTimeout(id) {
            if (queue[id - 1]) queue[id - 1].fn = null;
        },
        flush() {
            while (queue.length) {
                const { fn } = queue.shift();
                if (fn) fn();
            }
        },
    };
}

describe("controller", () => {
    it("newGame dengan seed tetap reproduksibel; restart kembali ke state awal", () => {
        const game = createController();
        const first = game.newGame({ mode: "normal", seed: 42 });
        game.dispatch({ type: "face", dir: "right" });
        assert.equal(game.getHistory().length, 1);
        const restarted = game.restart();
        assert.deepEqual(restarted, first);
        assert.equal(game.getHistory().length, 0);
    });

    it("dispatch tidak sah tidak mengubah state atau riwayat, tetapi tetap memberi tahu subscriber", () => {
        const game = createController({ seedSource: () => 1 });
        game.newGame({ mode: "easy" });
        const seen = [];
        const off = game.subscribe((snap) => seen.push(snap.events));
        game.dispatch({ type: "climb" });
        game.dispatch({ type: "climb" });
        off();
        game.dispatch({ type: "face", dir: "up" });
        assert.equal(seen.length, 2);
        assert.equal(seen[1][0].type, "invalid");
        assert.equal(game.getHistory().length, 1);
    });

    it("scoring dan seed acak dari seedSource", () => {
        const game = createController({ seedSource: () => 777 });
        const state = game.newGame({ mode: "hard", scoring: "arcade" });
        assert.equal(state.config.scoring, "arcade");
        assert.ok(state.seed >= 777);
    });

    it("melempar galat untuk mode tidak dikenal atau restart sebelum mulai", () => {
        const game = createController();
        assert.throws(() => game.restart());
        assert.throws(() => game.dispatch({ type: "grab" }));
        assert.throws(() => game.newGame({ mode: "impossible" }), RangeError);
    });
});

describe("storage", () => {
    it("membaca, menulis, dan mengembalikan default bila JSON rusak", () => {
        const backend = memoryBackend({ broken: "{not json" });
        const storage = createStorage(backend);
        assert.equal(storage.get("broken", "fallback"), "fallback");
        assert.equal(storage.set("k", { a: 1 }), true);
        assert.deepEqual(storage.get("k", null), { a: 1 });
    });

    it("tidak melempar galat saat penyimpanan diblokir", () => {
        const storage = createStorage(throwingBackend);
        assert.equal(storage.get("x", 5), 5);
        assert.equal(storage.set("x", 1), false);
        assert.doesNotThrow(() => storage.remove("x"));
        assert.deepEqual(storage.migrateLegacy(), {});
        assert.equal(createStorage(null).set("x", 1), false);
    });

    it("migrasi kunci lama lalu menghapusnya", () => {
        const backend = memoryBackend({ "wws-volume": "0.5", "wws-locale": "id" });
        const storage = createStorage(backend);
        assert.deepEqual(storage.migrateLegacy(), { musicVolume: 0.5, locale: "id" });
        assert.equal(backend.data.has("wws-volume"), false);
    });
});

describe("settings", () => {
    it("membuang nilai tidak sah dan kunci asing", () => {
        const out = sanitizeSettings({ theme: "neon", musicVolume: 0.4, evil: "<script>" });
        assert.equal(out.theme, "system");
        assert.equal(out.musicVolume, 0.4);
        assert.equal("evil" in out, false);
    });

    it("locale bawaan id untuk browser berbahasa Indonesia", () => {
        assert.equal(detectLocale("id-ID"), "id");
        assert.equal(detectLocale("en-US"), "en_us");
        assert.equal(detectLocale(undefined), "en_us");
    });

    it("update menyimpan ke storage dan memberi tahu subscriber", () => {
        const backend = memoryBackend();
        const settings = createSettings(createStorage(backend), "id");
        let notified = null;
        settings.subscribe((s) => (notified = s));
        settings.update({ theme: "light" });
        assert.equal(notified.theme, "light");
        assert.equal(JSON.parse(backend.data.get(STORAGE_KEYS.settings)).theme, "light");
        assert.equal(settings.get().locale, "id");
    });
});

describe("share", () => {
    it("encode/decode bolak-balik untuk preset dan custom", () => {
        assert.equal(encodeShare({ mode: "normal", seed: 48213 }), "#mode=normal&seed=48213");
        assert.deepEqual(decodeShare("#mode=normal&seed=48213"), { ok: true, mode: "normal", seed: 48213 });
        const config = { ...MODES.easy, mode: "custom", cols: 10, rows: 6, pits: 5, wumpus: 2, gold: 2, arrows: 2, winCondition: "collect-all" };
        const decoded = decodeShare(encodeShare({ mode: "custom", seed: 1, config }));
        assert.equal(decoded.ok, true);
        assert.equal(decoded.config.cols, 10);
        assert.equal(decoded.config.winCondition, "collect-all");
    });

    it("menolak hash tidak sah", () => {
        const bad = [
            "",
            "#",
            "#mode=normal",
            "#mode=normal&seed=-1",
            "#mode=normal&seed=1.5",
            "#mode=normal&seed=4294967296",
            "#mode=normal&seed=1e3",
            "#mode=godmode&seed=1",
            "#mode=custom&seed=1&cols=99&rows=4&pits=1&wumpus=1&gold=1&arrows=1&win=climb",
            "#mode=custom&seed=1&cols=4&rows=4&pits=20&wumpus=1&gold=1&arrows=1&win=climb",
            "#mode=custom&seed=1&cols=4&rows=4&pits=1&wumpus=1&gold=1&arrows=1&win=fly",
            "#eyJjb2xzIjo0fQ==",
            `#mode=normal&seed=1&pad=${"x".repeat(600)}`,
        ];
        for (const hash of bad) assert.equal(decodeShare(hash).ok, false, hash);
    });
});

describe("agent runner", () => {
    it("A-09 / stepOnce menjalankan agen lewat controller sampai episode selesai", () => {
        const controller = createController();
        controller.newGame({ mode: "easy", seed: 3 });
        const runner = createAgentRunner({ controller, timers: fakeTimers() });
        runner.reset();
        let guard = 0;
        while (runner.stepOnce() && guard++ < 500);
        assert.notEqual(controller.getState().status, "playing");
        assert.equal(runner.getInfo().stopReason, "finished");
        assert.ok(runner.getInfo().log.length > 0);
    });

    it("start/pause/setSpeed memakai timer dengan jeda 600 ms / kecepatan", () => {
        const controller = createController();
        controller.newGame({ mode: "normal", seed: 5 });
        const timers = fakeTimers();
        const runner = createAgentRunner({ controller, timers });
        runner.start();
        assert.equal(runner.isRunning(), true);
        assert.equal(timers.queue[0].ms, 600);
        runner.setSpeed(2);
        assert.equal(timers.queue.at(-1).ms, 300);
        runner.pause();
        assert.equal(runner.isRunning(), false);
        assert.throws(() => runner.setSpeed(3), RangeError);
        runner.start();
        timers.flush();
        assert.notEqual(controller.getState().status, "playing");
    });
});

describe("records", () => {
    it("mencatat menang dan skor terbaik per mode", () => {
        const records = createRecords(createStorage(memoryBackend()));
        assert.deepEqual(records.get("easy"), { best: null, wins: 0 });
        assert.equal(records.submit("easy", "won", 900).newBest, true);
        assert.equal(records.submit("easy", "won", 500).newBest, false);
        records.submit("easy", "lost", -1000);
        assert.deepEqual(records.get("easy"), { best: 900, wins: 2 });
    });
});
