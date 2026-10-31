import { mulberry32 } from "../engine/index.js";

// Pixel art orisinal proyek ini, 16×16. Setiap karakter = satu piksel; "." = transparan.
export const SPRITE_SIZE = 16;

export const PALETTE = Object.freeze({
    // Penjelajah
    k: "#1b1510",
    h: "#9a6a35",
    H: "#6b4520",
    n: "#4a2f1a",
    s: "#f2c79a",
    S: "#d9a273",
    e: "#1b1510",
    j: "#3c74b8",
    J: "#2a5690",
    w: "#e0b23a",
    p: "#5a4632",
    b: "#2e2219",
    r: "#b5522f",
    R: "#8a3c22",
});

export const WUMPUS_PALETTE = Object.freeze({
    k: "#1a0f1f",
    f: "#6b3fa0",
    F: "#4b2a75",
    l: "#8d5fc4",
    e: "#f4f1e0",
    p: "#c0242a",
    t: "#f4f1e0",
    m: "#2a0a10",
    h: "#d8cfb0",
});

export const GOLD_PALETTE = Object.freeze({ k: "#3b2a08", g: "#e8b83a", G: "#b8861f", y: "#fff2a8" });
export const PIT_PALETTE = Object.freeze({ r: "#5a5048", R: "#3a332d", D: "#16120f", d: "#0b0908" });

export const PLAYER_DOWN = Object.freeze([
    "................",
    ".....kkkkkk.....",
    "....khhhhhhk....",
    "...kHHHHHHHHk...",
    "..khhhhhhhhhhk..",
    "...kssssssssk...",
    "...ksesssseSk...",
    "...kSssssssSk...",
    "....kSSSSSSk....",
    "...kjjjjjjjjk...",
    "..kjJjjjjjjJjk..",
    "..ksJjjjjjjJsk..",
    "...kwwwwwwwwk...",
    "...kppppppppk...",
    "...kppk..kppk...",
    "...kbbk..kbbk...",
]);

export const PLAYER_UP = Object.freeze([
    "................",
    ".....kkkkkk.....",
    "....khhhhhhk....",
    "...kHHHHHHHHk...",
    "..khhhhhhhhhhk..",
    "...knnnnnnnnk...",
    "...knnnnnnnnk...",
    "...kSnnnnnnSk...",
    "....kSSSSSSk....",
    "...kjrrrrrrjk...",
    "..kjJrrrrrrJjk..",
    "..ksJrRRRRrJsk..",
    "...kwwwwwwwwk...",
    "...kppppppppk...",
    "...kppk..kppk...",
    "...kbbk..kbbk...",
]);

export const PLAYER_LEFT = Object.freeze([
    "................",
    "......kkkkkk....",
    ".....khhhhhhk...",
    "....kHHHHHHHHk..",
    "..khhhhhhhhhhhk.",
    "....kssssnnnk...",
    "...ksessnnnnk...",
    "...kssssSnnk....",
    ".....kSSSSk.....",
    "....kjjjjjrrk...",
    "...kjjjjjjrrk...",
    "...ksjjJjjrRk...",
    "....kwwwwwwk....",
    "....kppppppk....",
    "...kppk.kppk....",
    "..kbbbk.kbbbk...",
]);

export const WUMPUS = Object.freeze([
    "..h..........h..",
    "..hh........hh..",
    "...hkkkkkkkkh...",
    "..kffffffffffk..",
    ".kfllffffffllfk.",
    ".kfeepffffpeefk.",
    ".kfeeeffffeeefk.",
    "kffffffffffffffk",
    "kfFmmmmmmmmmmFfk",
    "kfFmtmtmtmtmtFfk",
    "kfFmmmmmmmmmmFfk",
    ".kfFtmtmtmtmFfk.",
    ".kffFFFFFFFFffk.",
    "..kffffffffffk..",
    "..kfFk....kFfk..",
    "..kkkk....kkkk..",
]);

export const GOLD = Object.freeze([
    "................",
    "................",
    "...........y....",
    "..........yyy...",
    "...........y....",
    "................",
    "................",
    "......kkkk......",
    ".....kgyggk.....",
    "...kkkggggGkkk..",
    "..kgyggkGkgyggk.",
    ".kggggGGkggggGGk",
    ".kgGGGGkggGGGGGk",
    "..kkkkkkkkkkkkk.",
    "................",
    "................",
]);

export const PIT = Object.freeze([
    "................",
    "................",
    "....rrrrrrrr....",
    "..rrRRRRRRRRrr..",
    ".rRRDDDDDDDDRRr.",
    ".rRDDddddddDDRr.",
    "rRDddddddddddDRr",
    "rRDddddddddddDRr",
    "rRDddddddddddDRr",
    "rRDddddddddddDRr",
    ".rRDDddddddDDRr.",
    ".rRRDDDDDDDDRRr.",
    "..rrRRRRRRRRrr..",
    "....rrrrrrrr....",
    "................",
    "................",
]);

/** Cermin horizontal sebuah peta piksel. */
export function mirror(map) {
    return map.map((row) => [...row].reverse().join(""));
}

/** Peta piksel → daftar { x, y, color } (untuk canvas maupun SVG). */
export function toPixels(map, palette) {
    const out = [];
    map.forEach((row, y) => {
        [...row].forEach((ch, x) => {
            if (ch !== ".") out.push({ x, y, color: palette[ch] });
        });
    });
    return out;
}

/**
 * Lantai batu bata gua: pola tetap + bintik dari RNG ber-seed agar selalu sama.
 * @returns {string[][]} warna per piksel
 */
export function floorPixels(seed = 7) {
    const rng = mulberry32(seed);
    const grid = [];
    for (let y = 0; y < SPRITE_SIZE; y++) {
        const row = [];
        for (let x = 0; x < SPRITE_SIZE; x++) {
            const offset = y < 8 ? 0 : 4;
            const mortar = y % 8 === 0 || (x + offset) % 8 === 0;
            const roll = rng();
            if (mortar) row.push("#2a2622");
            else if (roll < 0.12) row.push("#47413a");
            else if (roll < 0.22) row.push("#332e2a");
            else row.push("#3b3631");
        }
        grid.push(row);
    }
    return grid;
}

/** Batu gelap kasar untuk fog of war (petak belum dikunjungi). */
export function rockPixels(seed = 11) {
    const rng = mulberry32(seed);
    const grid = [];
    for (let y = 0; y < SPRITE_SIZE; y++) {
        const row = [];
        for (let x = 0; x < SPRITE_SIZE; x++) {
            const roll = rng();
            if (roll < 0.08) row.push("#3a342f");
            else if (roll < 0.3) row.push("#28241f");
            else if (roll < 0.45) row.push("#141210");
            else row.push("#1e1b18");
        }
        grid.push(row);
    }
    return grid;
}

function canvasFrom(paint) {
    const canvas = document.createElement("canvas");
    canvas.width = SPRITE_SIZE;
    canvas.height = SPRITE_SIZE;
    const ctx = canvas.getContext("2d");
    paint(ctx);
    return canvas;
}

function paintMap(map, palette) {
    return canvasFrom((ctx) => {
        for (const { x, y, color } of toPixels(map, palette)) {
            ctx.fillStyle = color;
            ctx.fillRect(x, y, 1, 1);
        }
    });
}

function paintGrid(grid) {
    return canvasFrom((ctx) => {
        grid.forEach((row, y) =>
            row.forEach((color, x) => {
                ctx.fillStyle = color;
                ctx.fillRect(x, y, 1, 1);
            }),
        );
    });
}

/**
 * Membuat semua sprite sebagai canvas 16×16 (dipakai `drawImage` di renderer, tanpa file gambar).
 * @returns {Record<string, HTMLCanvasElement>}
 */
export function buildSprites() {
    return {
        floor: paintGrid(floorPixels()),
        wall: paintGrid(rockPixels()),
        pit: paintMap(PIT, PIT_PALETTE),
        gold: paintMap(GOLD, GOLD_PALETTE),
        wumpus: paintMap(WUMPUS, WUMPUS_PALETTE),
        up: paintMap(PLAYER_UP, PALETTE),
        down: paintMap(PLAYER_DOWN, PALETTE),
        left: paintMap(PLAYER_LEFT, PALETTE),
        right: paintMap(mirror(PLAYER_LEFT), PALETTE),
    };
}
