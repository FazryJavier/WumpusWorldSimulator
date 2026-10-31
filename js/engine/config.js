import { LIMITS, MODES, SCORING_PRESETS, WIN_CONDITIONS } from "./constants.js";

const ALL_MODES = ["easy", "normal", "hard", "custom"];

/**
 * Zona aman awal per mode (GAME_RULES §9): tidak pernah berisi elemen dunia.
 * @param {{ mode: string }} config
 * @returns {[number, number][]}
 */
export function safeZone(config) {
    if (config.mode === "normal" || config.mode === "hard") {
        return [
            [0, 0],
            [1, 0],
            [0, 1],
            [1, 1],
        ];
    }
    return [[0, 0]];
}

function isIntIn(value, min, max) {
    return Number.isInteger(value) && value >= min && value <= max;
}

/**
 * Validasi konfigurasi (preset maupun custom).
 * @param {object} config
 * @returns {{ ok: true } | { ok: false, errors: string[] }}
 */
export function validateConfig(config) {
    const errors = [];
    if (!config || typeof config !== "object") return { ok: false, errors: ["config.missing"] };

    if (!ALL_MODES.includes(config.mode)) errors.push("config.mode");
    if (!isIntIn(config.cols, LIMITS.minSize, LIMITS.maxSize)) errors.push("config.cols");
    if (!isIntIn(config.rows, LIMITS.minSize, LIMITS.maxSize)) errors.push("config.rows");
    if (!isIntIn(config.pits, 0, Number.MAX_SAFE_INTEGER)) errors.push("config.pits");
    if (!isIntIn(config.wumpus, 0, Number.MAX_SAFE_INTEGER)) errors.push("config.wumpus");
    if (!isIntIn(config.gold, 1, Number.MAX_SAFE_INTEGER)) errors.push("config.gold");
    if (!isIntIn(config.arrows, 0, LIMITS.maxArrows)) errors.push("config.arrows");
    if (!WIN_CONDITIONS.includes(config.winCondition)) errors.push("config.winCondition");
    if (!SCORING_PRESETS.includes(config.scoring)) errors.push("config.scoring");

    if (errors.length === 0) {
        const capacity = config.cols * config.rows - safeZone(config).length;
        if (config.pits + config.wumpus + config.gold > capacity) errors.push("config.tooDense");
    }
    return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

/**
 * Konfigurasi preset dengan preset skor yang bisa ditimpa.
 * @param {"easy"|"normal"|"hard"} mode
 * @param {{ scoring?: "classic"|"arcade" }} [overrides]
 */
export function presetConfig(mode, overrides = {}) {
    const base = MODES[mode];
    if (!base) throw new RangeError(`Unknown mode: ${mode}`);
    return { ...base, ...(overrides.scoring ? { scoring: overrides.scoring } : {}) };
}
