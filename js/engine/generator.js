import { LIMITS } from "./constants.js";
import { safeZone, validateConfig } from "./config.js";
import { EngineError } from "./errors.js";
import { key, neighbors } from "./grid.js";
import { isUint32, mulberry32, shuffle } from "./rng.js";

/**
 * Menempatkan elemen dunia untuk satu seed tanpa validasi keterjangkauan (GAME_RULES §10 langkah 1–3).
 * @returns {{ pits: [number,number][], wumpus: {x:number,y:number,alive:boolean}[], gold: [number,number][] }}
 */
export function placeWorld(config, seed) {
    const rng = mulberry32(seed);
    const reserved = new Set(safeZone(config).map(([x, y]) => key(x, y)));
    const cells = [];
    for (let y = 0; y < config.rows; y++) {
        for (let x = 0; x < config.cols; x++) {
            if (!reserved.has(key(x, y))) cells.push([x, y]);
        }
    }
    const order = shuffle(cells, rng);
    const pits = order.slice(0, config.pits);
    const wumpusCells = order.slice(config.pits, config.pits + config.wumpus);
    const gold = order.slice(config.pits + config.wumpus, config.pits + config.wumpus + config.gold);
    return {
        pits,
        wumpus: wumpusCells.map(([x, y]) => ({ x, y, alive: true })),
        gold,
    };
}

/**
 * Validasi keterjangkauan (GAME_RULES §10.1): setiap emas harus terjangkau dari (0,0) tanpa
 * melewati lubang dan melewati paling banyak `arrows` Wumpus (0-1 BFS).
 * @returns {boolean}
 */
export function validateLevel(config, world) {
    const { cols, rows } = config;
    const pits = new Set(world.pits.map(([x, y]) => key(x, y)));
    const wumpus = new Set(world.wumpus.filter((w) => w.alive).map((w) => key(w.x, w.y)));
    const cost = new Map([[key(0, 0), 0]]);
    const deque = [[0, 0]];

    while (deque.length > 0) {
        const [x, y] = deque.shift();
        const base = cost.get(key(x, y));
        for (const [nx, ny] of neighbors(cols, rows, x, y)) {
            const k = key(nx, ny);
            if (pits.has(k)) continue;
            const weight = wumpus.has(k) ? 1 : 0;
            const next = base + weight;
            if (next > config.arrows) continue;
            if (!cost.has(k) || next < cost.get(k)) {
                cost.set(k, next);
                if (weight === 0) deque.unshift([nx, ny]);
                else deque.push([nx, ny]);
            }
        }
    }
    return world.gold.every(([x, y]) => cost.has(key(x, y)));
}

/**
 * Membuat level yang pasti bisa diselesaikan (GAME_RULES §10).
 * @param {object} config konfigurasi tervalidasi
 * @param {number} seed uint32
 * @returns {{ seed: number, world: ReturnType<typeof placeWorld> }} seed akhir yang benar-benar dipakai
 * @throws {EngineError} INVALID_CONFIG, INVALID_SEED, atau LEVEL_GENERATION_FAILED
 */
export function generateLevel(config, seed) {
    const check = validateConfig(config);
    if (!check.ok) throw new EngineError("INVALID_CONFIG", "Invalid game config", check.errors);
    if (!isUint32(seed)) throw new EngineError("INVALID_SEED", "Seed must be a uint32");

    let current = seed;
    for (let attempt = 0; attempt < LIMITS.maxGenerationAttempts; attempt++) {
        const world = placeWorld(config, current);
        if (validateLevel(config, world)) return { seed: current, world };
        current = (current + 1) >>> 0;
    }
    throw new EngineError("LEVEL_GENERATION_FAILED", "Could not generate a solvable level");
}
