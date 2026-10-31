import { createGame, MODES, perceive, step } from "../engine/index.js";

/** Seed uint32 acak dari CSPRNG (seed acak dibuat di app/, bukan engine). */
export function randomSeed() {
    const buf = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buf);
    return buf[0];
}

/**
 * Pemegang state game satu-satunya (ARCHITECTURE §5.1).
 * @param {{ seedSource?: () => number }} [deps]
 */
export function createController(deps = {}) {
    const seedSource = deps.seedSource ?? randomSeed;
    const listeners = new Set();
    let initial = null;
    let state = null;
    let percepts = null;
    let events = [];
    let history = [];

    function snapshot() {
        return { state, percepts, events, history };
    }

    function emit() {
        const snap = snapshot();
        for (const fn of listeners) fn(snap);
    }

    function load(next) {
        initial = next;
        state = next;
        percepts = perceive(next);
        events = [];
        history = [];
        emit();
        return state;
    }

    return {
        /**
         * Memulai level baru. `config` menimpa preset `mode` (untuk custom).
         * @param {{ mode?: string, seed?: number, config?: object }} options
         * @throws {import("../engine/index.js").EngineError}
         */
        newGame({ mode = "normal", seed, config, scoring } = {}) {
            const base = config ?? MODES[mode];
            if (!base) throw new RangeError(`Unknown mode: ${mode}`);
            const finalConfig = scoring ? { ...base, scoring } : base;
            return load(createGame(finalConfig, seed ?? seedSource()));
        },

        /** Level yang sama, state awal. */
        restart() {
            if (!initial) throw new Error("No game to restart");
            return load(initial);
        },

        /** @returns {{ state: object, percepts: object, events: object[] }} */
        dispatch(action) {
            if (!state) throw new Error("No game in progress");
            const result = step(state, action);
            events = result.events;
            if (result.events[0]?.type !== "invalid") {
                state = result.state;
                percepts = result.percepts;
                history = [...history, { action, percepts, events }];
            }
            emit();
            return result;
        },

        getState: () => state,
        getPercepts: () => percepts,
        getHistory: () => history,

        /** @param {(snapshot: object) => void} fn @returns {() => void} unsubscribe */
        subscribe(fn) {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
    };
}
