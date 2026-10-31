import { DIRS, DIR_ORDER } from "./constants.js";

/** @param {number} x @param {number} y @returns {string} kunci "x,y" */
export function key(x, y) {
    return `${x},${y}`;
}

/** @param {string} k @returns {[number, number]} */
export function parseKey(k) {
    const [x, y] = k.split(",").map(Number);
    return [x, y];
}

/** @param {number} cols @param {number} rows @param {number} x @param {number} y */
export function inBounds(cols, rows, x, y) {
    return x >= 0 && y >= 0 && x < cols && y < rows;
}

/**
 * Tetangga ortogonal di dalam grid, urutan tetap: up, down, left, right.
 * @returns {[number, number][]}
 */
export function neighbors(cols, rows, x, y) {
    const out = [];
    for (const dir of DIR_ORDER) {
        const [dx, dy] = DIRS[dir];
        const nx = x + dx;
        const ny = y + dy;
        if (inBounds(cols, rows, nx, ny)) out.push([nx, ny]);
    }
    return out;
}

/**
 * Petak-petak yang dilalui panah dari (x, y) ke arah `dir`, tidak termasuk petak asal.
 * @returns {[number, number][]}
 */
export function ray(cols, rows, x, y, dir) {
    const [dx, dy] = DIRS[dir];
    const out = [];
    let cx = x + dx;
    let cy = y + dy;
    while (inBounds(cols, rows, cx, cy)) {
        out.push([cx, cy]);
        cx += dx;
        cy += dy;
    }
    return out;
}

/** Jarak Manhattan. */
export function manhattan(ax, ay, bx, by) {
    return Math.abs(ax - bx) + Math.abs(ay - by);
}
