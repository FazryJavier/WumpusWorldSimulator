import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createGame, MODES, perceive, step } from "../../js/engine/index.js";
import { createAgent, formatEntry } from "../../js/agent/index.js";
import { createKnowledgeBase } from "../../js/agent/knowledge.js";
import { chooseAction, estimateRisk } from "../../js/agent/planner.js";
import { toObservation } from "../../js/app/observation.js";
import { runEpisode } from "../../js/app/simulate.js";
import { tutorialState } from "../fixtures/index.js";

const NONE = { breeze: false, stench: false, glitter: false, bump: false, scream: false };
const easy = { ...MODES.easy, mode: "custom" };

function obs(x, y, percepts = {}, extra = {}) {
    return {
        percepts: { ...NONE, ...percepts },
        position: { x, y, dir: extra.dir ?? "down" },
        arrows: extra.arrows ?? 1,
        goldCarried: extra.goldCarried ?? 0,
        lastAction: extra.lastAction ?? null,
    };
}

function playTutorial() {
    let state = tutorialState();
    const agent = createAgent(state.config);
    agent.observe(toObservation(state, perceive(state), null));
    for (let i = 0; i < 60 && state.status === "playing"; i++) {
        const { action } = agent.decide();
        if (!action) break;
        const result = step(state, action);
        state = result.state;
        agent.observe(toObservation(state, result.percepts, action));
    }
    return { state, agent };
}

describe("agent / basis pengetahuan", () => {
    it("A-01 level tutorial menghasilkan rantai inferensi AI_AGENT §6", () => {
        const { state, agent } = playTutorial();
        const lines = agent.getLog().map(formatEntry);
        const expected = [
            "[K4] Breeze(1,0) ⇒ Pit(2,0) ∨ Pit(1,1)",
            "[K2] ¬Breeze(0,1) ⇒ ¬Pit(1,1) ∧ ¬Pit(0,2)",
            "[K6] ∴ Pit(2,0)",
            "[K3] ¬Stench(1,0) ⇒ ¬W(2,0) ∧ ¬W(1,1)",
            "[K5] Stench(0,1) ⇒ W(0,2)",
            "[→] Safe(1,1) ⇒ Go(1,1)",
        ];
        let cursor = -1;
        for (const line of expected) {
            const idx = lines.indexOf(line);
            assert.ok(idx !== -1, `missing: ${line}\n${lines.join("\n")}`);
            if (line.startsWith("[K6]") || line.startsWith("[→] Safe(1,1)")) assert.ok(idx > cursor);
            cursor = Math.max(cursor, idx);
        }
        assert.equal(state.status, "won");
    });

    it("A-02 tidak ada Breeze di (0,0) → (1,0) dan (0,1) pit = no", () => {
        const kb = createKnowledgeBase(easy);
        kb.observe(obs(0, 0));
        assert.equal(kb.cell(1, 0).pit, "no");
        assert.equal(kb.cell(0, 1).pit, "no");
        assert.equal(kb.cell(1, 0).safe, true);
    });

    it("A-03 dua klausa Breeze beririsan satu petak → K6 pit = yes", () => {
        const kb = createKnowledgeBase({ ...easy, wumpus: 0 });
        kb.observe(obs(0, 0));
        kb.observe(obs(1, 0, { breeze: true })); // Pit(2,0) ∨ Pit(1,1)
        kb.observe(obs(0, 1)); // ¬Pit(1,1)
        assert.equal(kb.cell(2, 0).pit, "yes");
        assert.ok(kb.getLog().some((e) => e.rule === "K6" && e.conclusion === "Pit(2,0)"));
    });

    it("K7 anggota klausa yang belum pasti menjadi maybe", () => {
        const kb = createKnowledgeBase(easy);
        kb.observe(obs(0, 0, { breeze: true }));
        assert.equal(kb.cell(1, 0).pit, "maybe");
        assert.equal(kb.cell(0, 1).pit, "maybe");
    });

    it("A-04 tembak tanpa Scream → lintasan wumpus = no (K10)", () => {
        const kb = createKnowledgeBase({ ...easy, wumpus: 2 });
        kb.observe(obs(0, 0, { stench: true }));
        kb.observe(obs(0, 0, { stench: true }, { lastAction: { type: "shoot" } }));
        for (let y = 1; y < 4; y++) assert.equal(kb.cell(0, y).wumpus, "no");
        assert.equal(kb.cell(1, 0).wumpus, "yes");
    });

    it("A-05 Scream dengan config.wumpus = 1 → semua wumpus = no", () => {
        const kb = createKnowledgeBase(easy);
        kb.observe(obs(0, 0, { stench: true }));
        kb.observe(obs(0, 0, { scream: true }, { lastAction: { type: "shoot" } }));
        for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) assert.equal(kb.cell(x, y).wumpus, "no");
    });

    it("K11 Scream dengan banyak Wumpus dan satu kandidat menandai stench lama kedaluwarsa", () => {
        const kb = createKnowledgeBase({ ...easy, wumpus: 2 });
        kb.observe(obs(0, 0));
        kb.observe(obs(1, 0, { stench: true }, { dir: "right" })); // W(2,0) ∨ W(1,1)
        kb.observe(obs(1, 0, { scream: true }, { dir: "down", lastAction: { type: "shoot" } }));
        assert.equal(kb.cell(1, 1).wumpus, "no");
        assert.equal(kb.wumpusKilled, 1);
    });

    it("K8 satu Wumpus: petak di luar irisan klausa Stench = no", () => {
        const kb = createKnowledgeBase(easy);
        kb.observe(obs(0, 0, { stench: true })); // W(1,0) ∨ W(0,1)
        assert.equal(kb.cell(3, 3).wumpus, "no");
        assert.equal(kb.cell(1, 0).wumpus, "maybe");
    });
});

describe("agent / perencanaan", () => {
    it("A-06 tanpa petak aman → intent risk dengan tie-break y lalu x", () => {
        const config = { ...MODES.normal, mode: "custom" };
        const kb = createKnowledgeBase(config);
        const o = obs(0, 0, { breeze: true }, { arrows: 0 });
        kb.observe(o);
        const { action, intent } = chooseAction(kb, config, o);
        assert.equal(intent.type, "risk");
        assert.deepEqual(intent.target, [1, 0]);
        assert.deepEqual(action, { type: "face", dir: "right" });
        assert.equal(estimateRisk(kb, config, 1, 0).pit, 0.5);
    });

    it("A-07 Glitter → aksi pertama grab", () => {
        const agent = createAgent(easy);
        agent.observe(obs(0, 0, { glitter: true }));
        assert.deepEqual(agent.decide().action, { type: "grab" });
    });

    it("mode climb dengan emas → pulang lalu climb", () => {
        const agent = createAgent(easy);
        agent.observe(obs(0, 0, {}, { goldCarried: 1 }));
        assert.deepEqual(agent.decide(), { action: { type: "climb" }, intent: { type: "climb", target: [0, 0] } });
    });

    it("mode climb tanpa petak aman → menyerah dan climb (prioritas 6)", () => {
        const agent = createAgent(easy);
        agent.observe(obs(0, 0, { breeze: true }, { arrows: 0 }));
        assert.equal(agent.decide().action.type, "climb");
    });

    it("prioritas 5: tembak kandidat Wumpus di sebelah", () => {
        const agent = createAgent({ ...MODES.normal, mode: "custom" });
        agent.observe(obs(0, 0, { stench: true }, { arrows: 1 }));
        const { action, intent } = agent.decide();
        // Peluang sama (0,5) → tie-break y terkecil memilih (1,0), jadi agen berbalik ke kanan dulu.
        assert.equal(intent.type, "shoot");
        assert.deepEqual(intent.target, [1, 0]);
        assert.deepEqual(action, { type: "face", dir: "right" });
    });

    it("decide sebelum observe melempar galat", () => {
        assert.throws(() => createAgent(easy).decide());
    });

    it("A-08 agen tidak pernah masuk petak yang diketahui berbahaya; mati hanya setelah keputusan risk", () => {
        for (const mode of [MODES.easy, MODES.normal]) {
            for (let seed = 1; seed <= 300; seed++) {
                const r = runEpisode(mode, seed);
                assert.equal(r.diedWithoutRisk, false, `${mode.mode} seed ${seed}`);
                assert.equal(r.stopReason?.startsWith("invalid") ?? false, false, `${mode.mode} seed ${seed}`);
            }
        }
    });

    it("A-09 agen bekerja hanya dari observasi (tanpa state.world)", () => {
        const state = createGame(MODES.easy, 7);
        const agent = createAgent(state.config);
        const observation = toObservation(state, perceive(state), null);
        assert.equal("world" in observation, false);
        agent.observe(Object.freeze(observation));
        assert.ok(agent.decide().action);
    });

    it("A-10 determinisme: dua kali jalan pada seed sama → urutan aksi identik", () => {
        for (const mode of Object.values(MODES)) {
            assert.deepEqual(runEpisode(mode, 99).actions, runEpisode(mode, 99).actions);
        }
    });
});
