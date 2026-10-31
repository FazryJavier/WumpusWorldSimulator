// Membuat img/favicon.svg dari sprite Wumpus (js/ui/sprites.js) agar ikon selalu sama dengan game.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SPRITE_SIZE, toPixels, WUMPUS, WUMPUS_PALETTE } from "../js/ui/sprites.js";

const out = fileURLToPath(new URL("../img/favicon.svg", import.meta.url));
const rects = toPixels(WUMPUS, WUMPUS_PALETTE)
    .map(({ x, y, color }) => `<rect x="${x}" y="${y}" width="1" height="1" fill="${color}"/>`)
    .join("");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SPRITE_SIZE} ${SPRITE_SIZE}" shape-rendering="crispEdges">${rects}</svg>\n`;
writeFileSync(out, svg);
console.log(`Wrote ${out}`);
