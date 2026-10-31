import { ACTIONS, DIRS, STATE_VERSION, STATUS } from "./constants.js";
import { validateConfig } from "./config.js";
import { EngineError } from "./errors.js";
import { generateLevel } from "./generator.js";
import { inBounds, key, neighbors, ray } from "./grid.js";

/** @typedef {{ breeze:boolean, stench:boolean, glitter:boolean, bump:boolean, scream:boolean }} Percepts */

const POINTS = {
    classic: { step: -1, shoot: -10, kill: 500, gold: 1000, death: -1000, move: 0 },
    arcade: { step: 0, shoot: 0, kill: 1000, gold: 1000, death: 0, move: -10 },
};

/**
 * Membuat state awal untuk sebuah level.
 * @param {object} config
 * @param {number} seed uint32
 * @returns {object} GameState
 * @throws {EngineError}
 */
export function createGame(config, seed) {
    const check = validateConfig(config);
    if (!check.ok) throw new EngineError("INVALID_CONFIG", "Invalid game config", check.errors);
    const level = generateLevel(config, seed);
    return {
        version: STATE_VERSION,
        config: { ...config },
        seed: level.seed,
        world: level.world,
        agent: { x: 0, y: 0, dir: "down", arrows: config.arrows, goldCarried: 0 },
        visited: [key(0, 0)],
        steps: 0,
        score: 0,
        status: STATUS.PLAYING,
        cause: null,
    };
}

function hasPit(world, x, y) {
    return world.pits.some(([px, py]) => px === x && py === y);
}

function liveWumpusAt(world, x, y) {
    return world.wumpus.findIndex((w) => w.alive && w.x === x && w.y === y);
}

function goldIndexAt(world, x, y) {
    return world.gold.findIndex(([gx, gy]) => gx === x && gy === y);
}

/**
 * Persepsi di posisi agen saat ini (bump & scream selalu false di luar `step`).
 * @returns {Percepts}
 */
export function perceive(state, momentary = { bump: false, scream: false }) {
    const { cols, rows } = state.config;
    const { x, y } = state.agent;
    const around = neighbors(cols, rows, x, y);
    return {
        breeze: around.some(([nx, ny]) => hasPit(state.world, nx, ny)),
        stench: around.some(([nx, ny]) => liveWumpusAt(state.world, nx, ny) !== -1),
        glitter: goldIndexAt(state.world, x, y) !== -1,
        bump: Boolean(momentary.bump),
        scream: Boolean(momentary.scream),
    };
}

/** @returns {string | null} alasan tidak sah, atau null bila sah */
function invalidReason(state, action) {
    if (state.status !== STATUS.PLAYING) return "game-over";
    if (!action || typeof action !== "object") return "unknown-action";
    switch (action.type) {
        case ACTIONS.FACE:
            return Object.hasOwn(DIRS, action.dir) ? null : "bad-direction";
        case ACTIONS.FORWARD:
        case ACTIONS.GRAB:
            return null;
        case ACTIONS.SHOOT:
            return state.agent.arrows > 0 ? null : "no-arrows";
        case ACTIONS.CLIMB:
            if (state.config.winCondition !== "climb") return "climb-not-allowed";
            return state.agent.x === 0 && state.agent.y === 0 ? null : "not-at-exit";
        default:
            return "unknown-action";
    }
}

/**
 * Menerapkan satu aksi (GAME_RULES §6). Tidak memodifikasi `state` masukan.
 * @returns {{ state: object, percepts: Percepts, events: object[] }}
 */
export function step(state, action) {
    const reason = invalidReason(state, action);
    if (reason) {
        return { state, percepts: perceive(state), events: [{ type: "invalid", reason }] };
    }

    const pts = POINTS[state.config.scoring];
    const { cols, rows } = state.config;
    const events = [];
    let agent = { ...state.agent };
    let world = state.world;
    let score = state.score + pts.step;
    let status = state.status;
    let cause = null;
    let bump = false;
    let scream = false;

    switch (action.type) {
        case ACTIONS.FACE:
            agent.dir = action.dir;
            events.push({ type: "turned", dir: action.dir });
            break;

        case ACTIONS.FORWARD: {
            const [dx, dy] = DIRS[agent.dir];
            const nx = agent.x + dx;
            const ny = agent.y + dy;
            if (inBounds(cols, rows, nx, ny)) {
                events.push({ type: "moved", from: [agent.x, agent.y], to: [nx, ny] });
                agent = { ...agent, x: nx, y: ny };
                score += pts.move;
            } else {
                bump = true;
                events.push({ type: "bump" });
            }
            break;
        }

        case ACTIONS.SHOOT: {
            agent.arrows -= 1;
            score += pts.shoot;
            let hit = null;
            for (const [cx, cy] of ray(cols, rows, agent.x, agent.y, agent.dir)) {
                const idx = liveWumpusAt(world, cx, cy);
                if (idx !== -1) {
                    hit = { idx, at: [cx, cy] };
                    break;
                }
            }
            if (hit) {
                world = {
                    ...world,
                    wumpus: world.wumpus.map((w, i) => (i === hit.idx ? { ...w, alive: false } : w)),
                };
                scream = true;
                score += pts.kill;
                events.push({ type: "shot", hit: true, target: hit.at });
            } else {
                events.push({ type: "shot", hit: false });
            }
            break;
        }

        case ACTIONS.GRAB: {
            const idx = goldIndexAt(world, agent.x, agent.y);
            if (idx !== -1) {
                world = { ...world, gold: world.gold.filter((_, i) => i !== idx) };
                agent.goldCarried += 1;
                // Mode climb memberi poin emas saat keluar, bukan saat diambil (GAME_RULES §8.1).
                if (state.config.scoring === "arcade" || state.config.winCondition === "collect-all") {
                    score += pts.gold;
                }
                events.push({ type: "grabbed", at: [agent.x, agent.y] });
            }
            break;
        }

        case ACTIONS.CLIMB: {
            const withGold = agent.goldCarried > 0;
            if (withGold && state.config.scoring === "classic") score += pts.gold * agent.goldCarried;
            status = withGold ? STATUS.WON : STATUS.ESCAPED;
            events.push({ type: "climbed", withGold });
            break;
        }
    }

    const here = key(agent.x, agent.y);
    const visited = state.visited.includes(here) ? state.visited : [...state.visited, here];

    if (status === STATUS.PLAYING) {
        if (hasPit(world, agent.x, agent.y)) cause = { type: "pit", x: agent.x, y: agent.y };
        else if (liveWumpusAt(world, agent.x, agent.y) !== -1) cause = { type: "wumpus", x: agent.x, y: agent.y };
        if (cause) {
            status = STATUS.LOST;
            score += pts.death;
            events.push({ type: "died", cause: cause.type, at: [cause.x, cause.y] });
        }
    }

    if (status === STATUS.PLAYING && state.config.winCondition === "collect-all" && world.gold.length === 0) {
        status = STATUS.WON;
    }
    if (status === STATUS.WON) events.push({ type: "won" });

    const next = { ...state, world, agent, visited, steps: state.steps + 1, score, status, cause };
    return { state: next, percepts: perceive(next, { bump, scream }), events };
}
