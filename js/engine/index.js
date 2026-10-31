// API publik engine (ARCHITECTURE §4.1). Lapisan lain hanya meng-import dari file ini.
export { ACTIONS, DIRS, DIR_ORDER, LIMITS, MODES, SCORING_PRESETS, STATUS, WIN_CONDITIONS } from "./constants.js";
export { presetConfig, safeZone, validateConfig } from "./config.js";
export { EngineError } from "./errors.js";
export { generateLevel, validateLevel } from "./generator.js";
export { inBounds, key, manhattan, neighbors, parseKey, ray } from "./grid.js";
export { isUint32, mulberry32, shuffle } from "./rng.js";
export { createGame, perceive, step } from "./rules.js";
