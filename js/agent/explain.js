// Notasi log penalaran (AI_AGENT §6). Bebas bahasa: sama di semua locale.

/** @param {[number, number]} pos */
export function fmtPos([x, y]) {
    return `(${x},${y})`;
}

/** @param {"Pit"|"W"|"Breeze"|"Stench"|"Glitter"|"Safe"} name @param {[number, number]} pos */
export function prop(name, pos) {
    return `${name}${fmtPos(pos)}`;
}

export function not(text) {
    return `¬${text}`;
}

/** @param {string[]} parts */
export function or(parts) {
    return parts.join(" ∨ ");
}

/** @param {string[]} parts */
export function and(parts) {
    return parts.join(" ∧ ");
}

/** Urutan tampilan petak: y lalu x (sama dengan tie-break agen). */
export function sortCells(cells) {
    return cells.slice().sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

/**
 * Satu baris log, mis. `[K4] Breeze(1,0) ⇒ Pit(2,0) ∨ Pit(1,1)` atau `[K6] ∴ Pit(2,0)`.
 * @param {{ rule: string, premises: string[], conclusion: string }} entry
 */
export function formatEntry(entry) {
    const tag = `[${entry.rule}]`;
    if (entry.premises.length === 0) return entry.rule === "→" ? `${tag} ${entry.conclusion}` : `${tag} ∴ ${entry.conclusion}`;
    return `${tag} ${and(entry.premises)} ⇒ ${entry.conclusion}`;
}
