import { key } from "../engine/index.js";

const TILE_MIN = 32;
const TILE_MAX = 72;
// Batas bawah darurat agar papan 15 kolom tetap muat di layar 360 px tanpa scroll horizontal.
const TILE_FLOOR = 18;
const TOKEN_NAMES = ["breeze", "stench", "danger", "safe", "accent", "accent-text", "grid", "tile-badge", "scream"];

function hexToRgb(hex) {
    const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function withAlpha(color, alpha) {
    const rgb = hexToRgb(color);
    return rgb ? `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]} / ${alpha})` : color;
}

function readTokens() {
    const style = getComputedStyle(document.documentElement);
    const out = {};
    for (const name of TOKEN_NAMES) out[name] = style.getPropertyValue(`--color-${name}`).trim() || "#888888";
    out.fontSans = style.getPropertyValue("--font-sans").trim() || "sans-serif";
    return out;
}

/**
 * Renderer papan berbasis perubahan (ARCHITECTURE §6): menggambar ulang hanya saat `render` dipanggil
 * atau saat animasi pemain berjalan.
 * @param {HTMLCanvasElement} canvas
 * @param {Record<string, HTMLImageElement>} images
 */
export function createRenderer(canvas, images) {
    const ctx = canvas.getContext("2d");
    let tokens = readTokens();
    let tile = TILE_MIN;
    let view = null;
    let shown = null; // posisi pemain yang sedang digambar (untuk animasi)
    let anim = null;

    function computeTile(cols, rows) {
        const card = canvas.closest(".board-card") ?? canvas.parentElement;
        const styles = getComputedStyle(card);
        const padding = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
        const availWidth = Math.max(0, card.clientWidth - padding);
        // Lebar selalu dihormati (tanpa scroll horizontal); tinggi hanya dikecilkan sampai TILE_MIN.
        const fitWidth = Math.floor(availWidth / cols);
        const fitHeight = Math.max(TILE_MIN, Math.floor((window.innerHeight - 200) / rows));
        return Math.max(TILE_FLOOR, Math.min(TILE_MAX, fitWidth, fitHeight));
    }

    function resize() {
        if (!view) return;
        const { cols, rows } = view.state.config;
        tile = computeTile(cols, rows);
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(cols * tile * dpr);
        canvas.height = Math.round(rows * tile * dpr);
        canvas.style.width = `${cols * tile}px`;
        canvas.style.height = `${rows * tile}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.imageSmoothingEnabled = false;
        draw();
    }

    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    function hatch(x, y, w, h, color, angle) {
        ctx.save();
        roundRect(x, y, w, h, 6);
        ctx.clip();
        ctx.strokeStyle = withAlpha(color, 0.45);
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = -h; i < w + h; i += 7) {
            if (angle > 0) {
                ctx.moveTo(x + i, y + h);
                ctx.lineTo(x + i + h, y);
            } else {
                ctx.moveTo(x + i, y);
                ctx.lineTo(x + i + h, y + h);
            }
        }
        ctx.stroke();
        ctx.restore();
    }

    function drawMarker(cx, cy, type) {
        const px = cx * tile;
        const py = cy * tile;
        if (type === "visited") {
            const r = Math.min(7, tile / 6);
            ctx.beginPath();
            ctx.arc(px + tile - r - 3, py + tile - r - 3, r, 0, Math.PI * 2);
            ctx.fillStyle = tokens.safe;
            ctx.fill();
            ctx.fillStyle = "#0f1117";
            ctx.font = `700 ${Math.round(r * 1.5)}px ${tokens.fontSans}`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("✓", px + tile - r - 3, py + tile - r - 2);
            return;
        }
        const inset = tile >= 32 ? 4 : 2;
        const x = px + inset;
        const y = py + inset;
        const s = tile - inset * 2;
        const spec = {
            safe: { stroke: tokens.safe, fill: withAlpha(tokens.safe, 0.14), text: "✓", color: tokens.safe },
            target: { stroke: tokens.accent, fill: withAlpha(tokens.accent, 0.15), text: "→", color: tokens.accent },
            "pit-maybe": { stroke: tokens.breeze, fill: "rgb(0 0 0 / 0.55)", text: "P?", color: tokens.breeze, dashed: true },
            "wumpus-maybe": { stroke: tokens.stench, fill: "rgb(0 0 0 / 0.55)", text: "W?", color: tokens.stench, dashed: true },
            "pit-yes": { stroke: tokens.danger, fill: "rgb(0 0 0 / 0.45)", text: "P!", color: tokens.danger, hatch: [tokens.danger, 1] },
            "wumpus-yes": { stroke: tokens.danger, fill: "rgb(0 0 0 / 0.45)", text: "W!", color: tokens.stench, hatch: [tokens.stench, -1] },
        }[type];
        if (!spec) return;
        roundRect(x, y, s, s, 6);
        ctx.fillStyle = spec.fill;
        ctx.fill();
        if (spec.hatch) hatch(x, y, s, s, spec.hatch[0], spec.hatch[1]);
        roundRect(x, y, s, s, 6);
        ctx.setLineDash(spec.dashed ? [5, 4] : []);
        ctx.lineWidth = 2;
        ctx.strokeStyle = spec.stroke;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = spec.color;
        ctx.font = `700 ${Math.max(10, Math.round(tile * 0.24))}px ${tokens.fontSans}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(spec.text, px + tile / 2, py + tile / 2 + 1);
    }

    function drawPerceptBadges(cx, cy, percepts) {
        const list = [];
        if (percepts.breeze) list.push("breeze");
        if (percepts.stench) list.push("stench");
        const size = Math.min(14, Math.floor(tile / 3));
        list.forEach((kind, i) => {
            const x = cx * tile + 2 + i * (size + 2);
            const y = cy * tile + 2;
            ctx.fillStyle = tokens["tile-badge"];
            roundRect(x, y, size, size, 3);
            ctx.fill();
            ctx.strokeStyle = tokens[kind];
            ctx.lineWidth = 1.4;
            ctx.lineCap = "round";
            ctx.beginPath();
            if (kind === "breeze") {
                for (let l = 0; l < 3; l++) {
                    const ly = y + 3.5 + l * ((size - 7) / 2);
                    ctx.moveTo(x + 3, ly);
                    ctx.quadraticCurveTo(x + size / 2, ly - 2, x + size - 3, ly);
                }
            } else {
                for (let l = 0; l < 3; l++) {
                    const lx = x + 3.5 + l * ((size - 7) / 2);
                    ctx.moveTo(lx, y + size - 3);
                    ctx.quadraticCurveTo(lx + 2, y + size / 2, lx, y + 3);
                }
            }
            ctx.stroke();
        });
    }

    function perceptsAt(state, x, y) {
        const { cols, rows } = state.config;
        const near = [
            [x, y - 1],
            [x, y + 1],
            [x - 1, y],
            [x + 1, y],
        ].filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < cols && ny < rows);
        return {
            breeze: near.some(([nx, ny]) => state.world.pits.some(([px, py]) => px === nx && py === ny)),
            stench: near.some(([nx, ny]) => state.world.wumpus.some((w) => w.alive && w.x === nx && w.y === ny)),
        };
    }

    function draw() {
        if (!view) return;
        const { state, revealAll, markers, highlights, showCoords } = view;
        const { cols, rows } = state.config;
        const visited = new Set(state.visited);
        ctx.clearRect(0, 0, cols * tile, rows * tile);

        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const k = key(x, y);
                const px = x * tile;
                const py = y * tile;
                const seen = revealAll || visited.has(k);
                // 1. Lantai
                ctx.drawImage(images.floor, px, py, tile, tile);
                if (seen) {
                    // 2. Isi petak
                    if (state.world.pits.some(([a, b]) => a === x && b === y)) ctx.drawImage(images.pit, px, py, tile, tile);
                    if (state.world.gold.some(([a, b]) => a === x && b === y)) ctx.drawImage(images.gold, px, py, tile, tile);
                    const w = state.world.wumpus.find((it) => it.x === x && it.y === y);
                    if (w) {
                        ctx.globalAlpha = w.alive ? 1 : 0.4;
                        ctx.drawImage(images.wumpus, px, py, tile, tile);
                        ctx.globalAlpha = 1;
                        if (!w.alive) {
                            ctx.strokeStyle = tokens.danger;
                            ctx.lineWidth = 3;
                            ctx.beginPath();
                            ctx.moveTo(px + tile * 0.25, py + tile * 0.25);
                            ctx.lineTo(px + tile * 0.75, py + tile * 0.75);
                            ctx.moveTo(px + tile * 0.75, py + tile * 0.25);
                            ctx.lineTo(px + tile * 0.25, py + tile * 0.75);
                            ctx.stroke();
                        }
                    }
                }
                // 3. Ikon persepsi mini di petak yang sudah dikunjungi
                if (visited.has(k)) drawPerceptBadges(x, y, perceptsAt(state, x, y));
                // 4. Fog
                const marker = markers?.get(k);
                if (!seen) {
                    ctx.drawImage(images.wall, px, py, tile, tile);
                    if (marker && marker !== "visited") {
                        ctx.fillStyle = "rgb(0 0 0 / 0.45)";
                        ctx.fillRect(px, py, tile, tile);
                    }
                }
                // 5. Penanda pengetahuan
                if (marker) drawMarker(x, y, marker);
                if (showCoords && tile >= 28) {
                    ctx.fillStyle = "rgb(255 255 255 / 0.55)";
                    ctx.font = `400 10px ${tokens.fontSans}`;
                    ctx.textAlign = "right";
                    ctx.textBaseline = "alphabetic";
                    ctx.fillText(`${x},${y}`, px + tile - 3, py + tile - 3);
                }
            }
        }

        // 6. Agen
        const pos = shown ?? { x: state.agent.x, y: state.agent.y };
        ctx.drawImage(images[state.agent.dir], pos.x * tile, pos.y * tile, tile, tile);

        // 7. Sorotan
        for (const h of highlights ?? []) {
            const px = h.x * tile;
            const py = h.y * tile;
            const color = h.type === "cause" ? tokens.danger : tokens.accent;
            if (h.type === "cause") {
                ctx.fillStyle = withAlpha(tokens.danger, 0.28);
                ctx.fillRect(px, py, tile, tile);
            } else {
                ctx.strokeStyle = withAlpha(tokens.accent, 0.25);
                ctx.lineWidth = 8;
                ctx.strokeRect(px + 4, py + 4, tile - 8, tile - 8);
            }
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.strokeRect(px + 1.5, py + 1.5, tile - 3, tile - 3);
        }

        // 8. Garis grid (setiap path diawali beginPath — bug B2)
        ctx.strokeStyle = tokens.grid;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 1; x < cols; x++) {
            ctx.moveTo(x * tile + 0.5, 0);
            ctx.lineTo(x * tile + 0.5, rows * tile);
        }
        for (let y = 1; y < rows; y++) {
            ctx.moveTo(0, y * tile + 0.5);
            ctx.lineTo(cols * tile, y * tile + 0.5);
        }
        ctx.stroke();
    }

    function animateTo(from, to, duration) {
        if (anim) cancelAnimationFrame(anim.raf);
        const start = performance.now();
        const frame = (now) => {
            const t = Math.min(1, (now - start) / duration);
            shown = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
            draw();
            if (t < 1) anim = { raf: requestAnimationFrame(frame) };
            else {
                shown = null;
                anim = null;
                draw();
            }
        };
        anim = { raf: requestAnimationFrame(frame) };
    }

    return {
        /**
         * @param {{ state: object, revealAll: boolean, markers: Map<string,string>, highlights: object[],
         *           showCoords: boolean, motionMs: number }} next
         */
        render(next) {
            const prev = view;
            const sizeChanged =
                !prev || prev.state.config.cols !== next.state.config.cols || prev.state.config.rows !== next.state.config.rows;
            view = next;
            if (sizeChanged) {
                shown = null;
                resize();
                return;
            }
            const from = prev.state.agent;
            const to = next.state.agent;
            // Hanya langkah tunggal yang dianimasikan; restart/level baru langsung digambar.
            const moved =
                next.state.steps === prev.state.steps + 1 && Math.abs(from.x - to.x) + Math.abs(from.y - to.y) === 1;
            // Saat animasi sebelumnya belum selesai, lanjutkan dari posisi yang sedang tampil.
            if (moved && next.motionMs > 0) animateTo(shown ?? from, to, next.motionMs);
            else if (!anim) draw();
        },
        resize,
        refreshTheme() {
            tokens = readTokens();
            draw();
        },
        /** Petak di bawah koordinat klien, atau null. */
        cellAt(clientX, clientY) {
            if (!view) return null;
            const rect = canvas.getBoundingClientRect();
            const x = Math.floor(((clientX - rect.left) / rect.width) * view.state.config.cols);
            const y = Math.floor(((clientY - rect.top) / rect.height) * view.state.config.rows);
            if (x < 0 || y < 0 || x >= view.state.config.cols || y >= view.state.config.rows) return null;
            return [x, y];
        },
    };
}
