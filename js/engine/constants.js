/** @typedef {"up"|"down"|"left"|"right"} Dir */

/** Vektor perpindahan per arah (GAME_RULES §2). */
export const DIRS = Object.freeze({
    up: Object.freeze([0, -1]),
    down: Object.freeze([0, 1]),
    left: Object.freeze([-1, 0]),
    right: Object.freeze([1, 0]),
});

/** Urutan tetap arah, dipakai di mana pun urutan harus deterministik. */
export const DIR_ORDER = Object.freeze(["up", "down", "left", "right"]);

export const ACTIONS = Object.freeze({
    FACE: "face",
    FORWARD: "forward",
    SHOOT: "shoot",
    GRAB: "grab",
    CLIMB: "climb",
});

export const STATUS = Object.freeze({
    PLAYING: "playing",
    WON: "won",
    LOST: "lost",
    ESCAPED: "escaped",
});

export const WIN_CONDITIONS = Object.freeze(["collect-all", "climb"]);
export const SCORING_PRESETS = Object.freeze(["classic", "arcade"]);

/** Batas konfigurasi custom (GAME_RULES §9). */
export const LIMITS = Object.freeze({
    minSize: 4,
    maxSize: 20,
    maxArrows: 20,
    maxGenerationAttempts: 100,
});

/** Preset tingkat kesulitan (GAME_RULES §9). */
export const MODES = Object.freeze({
    easy: Object.freeze({
        mode: "easy",
        cols: 4,
        rows: 4,
        pits: 3,
        wumpus: 1,
        gold: 1,
        arrows: 1,
        winCondition: "climb",
        scoring: "classic",
    }),
    normal: Object.freeze({
        mode: "normal",
        cols: 8,
        rows: 8,
        pits: 8,
        wumpus: 2,
        gold: 3,
        arrows: 3,
        winCondition: "collect-all",
        scoring: "classic",
    }),
    hard: Object.freeze({
        mode: "hard",
        cols: 15,
        rows: 8,
        pits: 10,
        wumpus: 8,
        gold: 8,
        arrows: 10,
        winCondition: "collect-all",
        scoring: "classic",
    }),
});

export const STATE_VERSION = 1;
