import { MODES } from "../../js/engine/index.js";

export function deepFreeze(value) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
        Object.freeze(value);
        for (const v of Object.values(value)) deepFreeze(v);
    }
    return value;
}

/**
 * Membuat GameState tetap untuk tes, dibekukan rekursif agar mutasi ketahuan.
 * @param {{ config?: object, world?: object, agent?: object, status?: string, visited?: string[] }} spec
 */
export function makeState(spec = {}) {
    const config = { ...MODES.normal, mode: "custom", ...(spec.config ?? {}) };
    return deepFreeze({
        version: 1,
        config,
        seed: 1,
        world: { pits: [], wumpus: [], gold: [], ...(spec.world ?? {}) },
        agent: { x: 0, y: 0, dir: "down", arrows: config.arrows, goldCarried: 0, ...(spec.agent ?? {}) },
        visited: spec.visited ?? ["0,0"],
        steps: 0,
        score: 0,
        status: spec.status ?? "playing",
        cause: null,
    });
}

/**
 * Level tutorial 4×4 (AI_AGENT §6): Pit(2,0), W(0,2), emas di (1,2).
 *  y\x  0   1   2   3
 *  0    A   .   P   .
 *  1    .   .   .   .
 *  2    W   G   .   .
 *  3    .   .   .   P
 */
export function tutorialState() {
    return makeState({
        config: { ...MODES.easy, mode: "custom", pits: 2 },
        world: {
            pits: [
                [2, 0],
                [3, 3],
            ],
            wumpus: [{ x: 0, y: 2, alive: true }],
            gold: [[1, 2]],
        },
    });
}
