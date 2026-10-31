import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createGame, MODES, perceive, step } from "../../js/engine/index.js";
import { makeState } from "../fixtures/index.js";

const classic = { winCondition: "collect-all", scoring: "classic" };

describe("step / forward & face", () => {
    it("R-01 menabrak batas atas menghasilkan bump tanpa berpindah", () => {
        const state = makeState({ config: classic, world: { gold: [[3, 3]] }, agent: { dir: "up" } });
        const { state: next, percepts, events } = step(state, { type: "forward" });
        assert.deepEqual([next.agent.x, next.agent.y], [0, 0]);
        assert.equal(percepts.bump, true);
        assert.equal(next.score, -1);
        assert.deepEqual(events, [{ type: "bump" }]);
    });

    it("forward yang sah memindahkan agen dan menandai visited", () => {
        const state = makeState({ config: classic, world: { gold: [[3, 3]] }, agent: { dir: "right" } });
        const { state: next, events } = step(state, { type: "forward" });
        assert.deepEqual([next.agent.x, next.agent.y], [1, 0]);
        assert.deepEqual(next.visited, ["0,0", "1,0"]);
        assert.deepEqual(events[0], { type: "moved", from: [0, 0], to: [1, 0] });
    });

    it("R-13 face ke arah yang sama sah, skor −1, tidak pindah", () => {
        const state = makeState({ config: classic, world: { gold: [[3, 3]] } });
        const { state: next, events } = step(state, { type: "face", dir: "down" });
        assert.equal(next.score, -1);
        assert.equal(next.steps, 1);
        assert.deepEqual([next.agent.x, next.agent.y], [0, 0]);
        assert.equal(events[0].type, "turned");
    });

    it("face dengan arah tidak dikenal tidak sah", () => {
        const state = makeState({ config: classic, world: { gold: [[3, 3]] } });
        const { state: next, events } = step(state, { type: "face", dir: "north" });
        assert.equal(next, state);
        assert.equal(events[0].type, "invalid");
    });
});

describe("step / kematian", () => {
    it("R-02 masuk lubang: lost, cause pit, skor −1 −1000", () => {
        const state = makeState({ config: classic, world: { pits: [[1, 0]], gold: [[3, 3]] }, agent: { dir: "right" } });
        const { state: next, events } = step(state, { type: "forward" });
        assert.equal(next.status, "lost");
        assert.deepEqual(next.cause, { type: "pit", x: 1, y: 0 });
        assert.equal(next.score, -1001);
        assert.deepEqual(events.at(-1), { type: "died", cause: "pit", at: [1, 0] });
    });

    it("masuk petak Wumpus hidup: lost, cause wumpus", () => {
        const state = makeState({
            config: classic,
            world: { wumpus: [{ x: 0, y: 1, alive: true }], gold: [[3, 3]] },
        });
        const { state: next } = step(state, { type: "forward" });
        assert.equal(next.status, "lost");
        assert.equal(next.cause.type, "wumpus");
    });

    it("masuk petak bangkai Wumpus aman", () => {
        const state = makeState({
            config: classic,
            world: { wumpus: [{ x: 0, y: 1, alive: false }], gold: [[3, 3]] },
        });
        const { state: next } = step(state, { type: "forward" });
        assert.equal(next.status, "playing");
    });
});

describe("step / tembak", () => {
    it("R-03 tembak lurus, Wumpus 3 petak di depan mati", () => {
        const state = makeState({
            config: classic,
            world: { wumpus: [{ x: 0, y: 3, alive: true }], gold: [[3, 3]] },
        });
        const { state: next, percepts, events } = step(state, { type: "shoot" });
        assert.equal(next.world.wumpus[0].alive, false);
        assert.equal(percepts.scream, true);
        assert.equal(next.agent.arrows, state.agent.arrows - 1);
        assert.equal(next.score, -1 - 10 + 500);
        assert.deepEqual(events[0], { type: "shot", hit: true, target: [0, 3] });
    });

    it("tembak meleset: tanpa scream, −11", () => {
        const state = makeState({ config: classic, world: { gold: [[3, 3]] } });
        const { state: next, percepts, events } = step(state, { type: "shoot" });
        assert.equal(percepts.scream, false);
        assert.equal(next.score, -11);
        assert.deepEqual(events[0], { type: "shot", hit: false });
    });

    it("R-04 tembak tanpa panah tidak sah dan state tidak berubah", () => {
        const state = makeState({ config: classic, world: { gold: [[3, 3]] }, agent: { arrows: 0 } });
        const result = step(state, { type: "shoot" });
        assert.equal(result.state, state);
        assert.deepEqual(result.events, [{ type: "invalid", reason: "no-arrows" }]);
    });

    it("R-05 dua Wumpus satu garis: hanya yang terdekat mati", () => {
        const state = makeState({
            config: classic,
            world: {
                wumpus: [
                    { x: 0, y: 4, alive: true },
                    { x: 0, y: 2, alive: true },
                ],
                gold: [[3, 3]],
            },
        });
        const { state: next } = step(state, { type: "shoot" });
        assert.equal(next.world.wumpus[0].alive, true);
        assert.equal(next.world.wumpus[1].alive, false);
    });

    it("R-06 di sebelah Wumpus mati tidak berbau", () => {
        const state = makeState({
            config: classic,
            world: { wumpus: [{ x: 0, y: 1, alive: false }], gold: [[3, 3]] },
        });
        assert.equal(perceive(state).stench, false);
    });
});

describe("step / emas & keluar", () => {
    it("R-07 ambil emas terakhir pada collect-all → won", () => {
        const state = makeState({ config: classic, world: { gold: [[0, 0]] } });
        const { state: next, events } = step(state, { type: "grab" });
        assert.equal(next.status, "won");
        assert.equal(next.agent.goldCarried, 1);
        assert.equal(next.score, 999);
        assert.deepEqual(events.map((e) => e.type), ["grabbed", "won"]);
    });

    it("grab tanpa emas sah tetapi tanpa efek", () => {
        const state = makeState({ config: classic, world: { gold: [[3, 3]] } });
        const { state: next, events } = step(state, { type: "grab" });
        assert.equal(next.score, -1);
        assert.deepEqual(events, []);
    });

    it("R-08 climb di (0,0) tanpa emas → escaped", () => {
        const state = makeState({ config: { ...MODES.easy, mode: "custom" }, world: { gold: [[3, 3]] } });
        const { state: next } = step(state, { type: "climb" });
        assert.equal(next.status, "escaped");
        assert.equal(next.score, -1);
    });

    it("climb dengan emas → won, +1000 per emas (classic)", () => {
        const state = makeState({
            config: { ...MODES.easy, mode: "custom" },
            world: { gold: [] },
            agent: { goldCarried: 1 },
        });
        const { state: next } = step(state, { type: "climb" });
        assert.equal(next.status, "won");
        assert.equal(next.score, 999);
    });

    it("grab pada mode climb tidak memberi poin sebelum keluar", () => {
        const state = makeState({ config: { ...MODES.easy, mode: "custom" }, world: { gold: [[0, 0]] } });
        const { state: next } = step(state, { type: "grab" });
        assert.equal(next.status, "playing");
        assert.equal(next.score, -1);
    });

    it("R-09 climb di luar (0,0) tidak sah", () => {
        const state = makeState({
            config: { ...MODES.easy, mode: "custom" },
            world: { gold: [[3, 3]] },
            agent: { x: 1, y: 0 },
        });
        assert.equal(step(state, { type: "climb" }).events[0].reason, "not-at-exit");
    });

    it("climb pada mode collect-all tidak sah", () => {
        const state = makeState({ config: classic, world: { gold: [[3, 3]] } });
        assert.equal(step(state, { type: "climb" }).events[0].reason, "climb-not-allowed");
    });

    it("R-10 aksi apa pun setelah won/lost tidak sah", () => {
        for (const status of ["won", "lost", "escaped"]) {
            const state = makeState({ config: classic, world: { gold: [[3, 3]] }, status });
            const result = step(state, { type: "forward" });
            assert.equal(result.state, state);
            assert.equal(result.events[0].reason, "game-over");
        }
    });
});

describe("scoring arcade", () => {
    const arcade = { winCondition: "collect-all", scoring: "arcade" };

    it("forward berhasil −10, aksi lain 0", () => {
        const state = makeState({ config: arcade, world: { gold: [[3, 3]] } });
        const moved = step(state, { type: "forward" }).state;
        assert.equal(moved.score, -10);
        assert.equal(step(moved, { type: "face", dir: "up" }).state.score, -10);
    });

    it("bump tidak mengurangi skor dan mati bernilai 0", () => {
        const state = makeState({ config: arcade, world: { pits: [[0, 1]], gold: [[3, 3]] }, agent: { dir: "up" } });
        assert.equal(step(state, { type: "forward" }).state.score, 0);
        const died = step(step(state, { type: "face", dir: "down" }).state, { type: "forward" }).state;
        assert.equal(died.status, "lost");
        assert.equal(died.score, -10);
    });
});

describe("createGame & perceive", () => {
    it("state awal sesuai GAME_RULES §11", () => {
        const state = createGame(MODES.normal, 48213);
        assert.equal(state.version, 1);
        assert.deepEqual(state.agent, { x: 0, y: 0, dir: "down", arrows: 3, goldCarried: 0 });
        assert.deepEqual(state.visited, ["0,0"]);
        assert.equal(state.status, "playing");
        assert.doesNotThrow(() => JSON.parse(JSON.stringify(state)));
    });

    it("melempar INVALID_CONFIG untuk konfigurasi tidak sah", () => {
        assert.throws(() => createGame({ ...MODES.normal, cols: 2 }, 1), { code: "INVALID_CONFIG" });
    });

    it("breeze, stench, dan glitter dihitung dari tetangga ortogonal", () => {
        const state = makeState({
            config: classic,
            agent: { x: 1, y: 1 },
            world: { pits: [[1, 0]], wumpus: [{ x: 2, y: 1, alive: true }], gold: [[1, 1]] },
        });
        assert.deepEqual(perceive(state), { breeze: true, stench: true, glitter: true, bump: false, scream: false });
    });

    it("diagonal tidak dihitung sebagai tetangga", () => {
        const state = makeState({ config: classic, world: { pits: [[1, 1]], gold: [[3, 3]] } });
        assert.equal(perceive(state).breeze, false);
    });
});
