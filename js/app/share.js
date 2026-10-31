import { isUint32, LIMITS, validateConfig, WIN_CONDITIONS } from "../engine/index.js";

const PRESET_MODES = ["easy", "normal", "hard"];
const INT_PATTERN = /^\d{1,10}$/;

function parseInt32(value) {
    if (typeof value !== "string" || !INT_PATTERN.test(value)) return null;
    return Number(value);
}

/**
 * Link share (ARCHITECTURE §10): hanya mode + seed (+ parameter custom), tidak pernah state permainan.
 * @param {{ mode: string, seed: number, config?: object }} level
 * @returns {string} hash, mis. "#mode=normal&seed=48213"
 */
export function encodeShare({ mode, seed, config }) {
    const params = new URLSearchParams({ mode, seed: String(seed) });
    if (mode === "custom" && config) {
        for (const k of ["cols", "rows", "pits", "wumpus", "gold", "arrows"]) params.set(k, String(config[k]));
        params.set("win", config.winCondition);
    }
    return `#${params.toString()}`;
}

/**
 * Validasi ketat hash share. Nilai apa pun yang tidak sah → `{ ok: false }`.
 * @param {string} hash location.hash
 * @returns {{ ok: true, mode: string, seed: number, config?: object } | { ok: false, reason: string }}
 */
export function decodeShare(hash) {
    const raw = typeof hash === "string" ? hash.replace(/^#/, "") : "";
    if (!raw) return { ok: false, reason: "empty" };
    if (raw.length > 512) return { ok: false, reason: "too-long" };

    const params = new URLSearchParams(raw);
    const mode = params.get("mode");
    const seed = parseInt32(params.get("seed"));
    if (seed === null || !isUint32(seed)) return { ok: false, reason: "seed" };

    if (PRESET_MODES.includes(mode)) return { ok: true, mode, seed };
    if (mode !== "custom") return { ok: false, reason: "mode" };

    const config = { mode: "custom", scoring: "classic" };
    for (const k of ["cols", "rows", "pits", "wumpus", "gold", "arrows"]) {
        const v = parseInt32(params.get(k));
        if (v === null) return { ok: false, reason: k };
        config[k] = v;
    }
    const win = params.get("win");
    if (!WIN_CONDITIONS.includes(win)) return { ok: false, reason: "win" };
    config.winCondition = win;
    if (config.cols > LIMITS.maxSize || config.rows > LIMITS.maxSize) return { ok: false, reason: "size" };
    if (!validateConfig(config).ok) return { ok: false, reason: "config" };
    return { ok: true, mode, seed, config };
}
