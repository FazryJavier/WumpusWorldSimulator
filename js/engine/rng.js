/**
 * PRNG mulberry32 (ADR-0003). Deterministik untuk seed uint32 yang sama.
 * @param {number} seed uint32
 * @returns {() => number} fungsi yang menghasilkan bilangan di [0, 1)
 */
export function mulberry32(seed) {
    let a = seed >>> 0;
    return function next() {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Fisher–Yates. Tidak memodifikasi masukan.
 * @template T
 * @param {T[]} items
 * @param {() => number} rng
 * @returns {T[]}
 */
export function shuffle(items, rng) {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

/** @param {unknown} value */
export function isUint32(value) {
    return Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
}
