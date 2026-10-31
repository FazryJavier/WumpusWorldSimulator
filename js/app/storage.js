export const STORAGE_KEYS = Object.freeze({
    settings: "wws:v1:settings",
    tutorial: "wws:v1:tutorial",
    records: "wws:v1:records",
});

const LEGACY_KEYS = Object.freeze({ volume: "wws-volume", locale: "wws-locale" });

function defaultBackend() {
    try {
        return globalThis.localStorage ?? null;
    } catch {
        // Akses localStorage bisa melempar galat (mode privat, situs diblokir).
        return null;
    }
}

/**
 * Akses penyimpanan yang aman (ARCHITECTURE §9): setiap baca/tulis dibungkus try/catch.
 * @param {Storage | null} [backend]
 */
export function createStorage(backend = defaultBackend()) {
    return {
        /** @template T @param {string} k @param {T} fallback @returns {T} */
        get(k, fallback) {
            try {
                const raw = backend?.getItem(k);
                if (raw === null || raw === undefined) return fallback;
                return JSON.parse(raw);
            } catch {
                return fallback;
            }
        },

        /** @returns {boolean} true bila tersimpan */
        set(k, value) {
            try {
                backend?.setItem(k, JSON.stringify(value));
                return Boolean(backend);
            } catch {
                return false;
            }
        },

        remove(k) {
            try {
                backend?.removeItem(k);
            } catch {
                // Diabaikan: penghapusan bersifat best-effort.
            }
        },

        /**
         * Migrasi kunci lama (`wws-volume`, `wws-locale`) ke pengaturan v1, lalu dihapus.
         * @returns {object} potongan pengaturan hasil migrasi
         */
        migrateLegacy() {
            const migrated = {};
            try {
                const volume = backend?.getItem(LEGACY_KEYS.volume);
                const locale = backend?.getItem(LEGACY_KEYS.locale);
                if (volume !== null && volume !== undefined && Number.isFinite(Number(volume))) {
                    migrated.musicVolume = Math.min(1, Math.max(0, Number(volume)));
                }
                if (typeof locale === "string" && locale) migrated.locale = locale;
            } catch {
                return migrated;
            }
            this.remove(LEGACY_KEYS.volume);
            this.remove(LEGACY_KEYS.locale);
            return migrated;
        },
    };
}
