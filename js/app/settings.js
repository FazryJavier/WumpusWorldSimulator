import { STORAGE_KEYS } from "./storage.js";

export const SUPPORTED_LOCALES = Object.freeze(["id", "en_us"]);

export const DEFAULT_SETTINGS = Object.freeze({
    theme: "system",
    locale: "en_us",
    mode: "easy",
    musicVolume: 0.2,
    sfxVolume: 0.6,
    muted: false,
    scoring: "classic",
    reduceMotion: false,
    showCoords: false,
    colorblind: false,
});

const VALIDATORS = {
    theme: (v) => ["dark", "light", "system"].includes(v),
    locale: (v) => SUPPORTED_LOCALES.includes(v),
    mode: (v) => ["easy", "normal", "hard"].includes(v),
    musicVolume: (v) => typeof v === "number" && v >= 0 && v <= 1,
    sfxVolume: (v) => typeof v === "number" && v >= 0 && v <= 1,
    muted: (v) => typeof v === "boolean",
    scoring: (v) => ["classic", "arcade"].includes(v),
    reduceMotion: (v) => typeof v === "boolean",
    showCoords: (v) => typeof v === "boolean",
    colorblind: (v) => typeof v === "boolean",
};

/** Hanya kunci yang dikenal dengan nilai sah yang dipertahankan; sisanya kembali ke default. */
export function sanitizeSettings(raw, defaults = DEFAULT_SETTINGS) {
    const out = { ...defaults };
    if (raw && typeof raw === "object") {
        for (const [k, valid] of Object.entries(VALIDATORS)) {
            if (Object.hasOwn(raw, k) && valid(raw[k])) out[k] = raw[k];
        }
    }
    return out;
}

/** Locale bawaan: `id` bila bahasa browser Indonesia (PRD F9). */
export function detectLocale(language) {
    return typeof language === "string" && language.toLowerCase().startsWith("id") ? "id" : "en_us";
}

/**
 * @param {ReturnType<import("./storage.js").createStorage>} storage
 * @param {string} [language] navigator.language
 */
export function createSettings(storage, language) {
    const defaults = { ...DEFAULT_SETTINGS, locale: detectLocale(language) };
    let current = sanitizeSettings({ ...storage.migrateLegacy(), ...storage.get(STORAGE_KEYS.settings, {}) }, defaults);
    const listeners = new Set();

    return {
        get: () => ({ ...current }),
        update(patch) {
            current = sanitizeSettings({ ...current, ...patch }, defaults);
            storage.set(STORAGE_KEYS.settings, current);
            for (const fn of listeners) fn({ ...current });
            return { ...current };
        },
        subscribe(fn) {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
    };
}
