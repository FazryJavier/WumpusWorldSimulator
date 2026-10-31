import { STORAGE_KEYS } from "./storage.js";

/**
 * Rekor pribadi per mode (PRD F11), disimpan lokal.
 * @param {ReturnType<import("./storage.js").createStorage>} storage
 */
export function createRecords(storage) {
    const read = () => {
        const raw = storage.get(STORAGE_KEYS.records, {});
        return raw && typeof raw === "object" ? raw : {};
    };

    return {
        /** @returns {{ best: number|null, wins: number }} */
        get(mode) {
            const entry = read()[mode];
            return {
                best: Number.isFinite(entry?.best) ? entry.best : null,
                wins: Number.isInteger(entry?.wins) ? entry.wins : 0,
            };
        },
        /** Mencatat hasil episode yang dimainkan pemain. @returns {{ best:number|null, wins:number, newBest:boolean }} */
        submit(mode, status, score) {
            const all = read();
            const current = this.get(mode);
            const won = status === "won";
            const newBest = won && (current.best === null || score > current.best);
            const next = { best: newBest ? score : current.best, wins: current.wins + (won ? 1 : 0) };
            storage.set(STORAGE_KEYS.records, { ...all, [mode]: next });
            return { ...next, newBest };
        },
    };
}
