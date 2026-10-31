const DIR_KEYS = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    w: "up",
    s: "down",
    a: "left",
    d: "right",
};
const ACTION_KEYS = { " ": "shoot", f: "shoot", Enter: "grab", g: "grab", c: "climb" };
const LONG_PRESS_MS = 500;

/**
 * Pemetaan tombol arah ke aksi engine (GAME_RULES §5.2).
 * @param {string} facing arah hadap agen saat ini
 * @param {string} dir arah yang ditekan
 */
export function directionToAction(facing, dir) {
    return facing === dir ? { type: "forward" } : { type: "face", dir };
}

/**
 * Keyboard, D-pad, tombol aksi, klik kanan / tekan lama (ARCHITECTURE §7).
 * @param {{
 *   canvas: HTMLCanvasElement,
 *   isEnabled: () => boolean,
 *   getFacing: () => string,
 *   onAction: (action: object) => void,
 *   onRestart: () => void,
 *   onEscape: () => void,
 *   onCellMenu: (clientX: number, clientY: number) => void,
 *   onFirstInteraction: () => void,
 * }} deps
 */
export function createInput(deps) {
    const isTyping = (target) => target instanceof HTMLElement && target.closest("input, select, textarea, dialog");

    function directional(dir) {
        deps.onAction(directionToAction(deps.getFacing(), dir));
    }

    document.addEventListener("keydown", (event) => {
        deps.onFirstInteraction();
        if (event.key === "Escape") {
            deps.onEscape();
            return;
        }
        if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
        const k = event.key.length === 1 ? event.key.toLowerCase() : event.key;
        const dir = DIR_KEYS[k];
        const action = ACTION_KEYS[k];
        if (k === "r") {
            event.preventDefault();
            deps.onRestart();
            return;
        }
        if (!dir && !action) return;
        // preventDefault hanya untuk tombol game, supaya scroll halaman tetap normal.
        if (event.target instanceof HTMLButtonElement && (k === " " || k === "Enter")) return;
        event.preventDefault();
        if (!deps.isEnabled()) return;
        if (dir) directional(dir);
        else deps.onAction({ type: action });
    });

    document.addEventListener("pointerdown", deps.onFirstInteraction, { once: true });

    for (const btn of document.querySelectorAll(".dpad__btn")) {
        btn.addEventListener("click", () => deps.isEnabled() && directional(btn.dataset.dir));
    }
    for (const btn of document.querySelectorAll(".touch-actions [data-action]")) {
        btn.addEventListener("click", () => deps.isEnabled() && deps.onAction({ type: btn.dataset.action }));
    }

    deps.canvas.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        deps.onCellMenu(event.clientX, event.clientY);
    });

    let pressTimer = null;
    deps.canvas.addEventListener("pointerdown", (event) => {
        if (event.pointerType !== "touch") return;
        const { clientX, clientY } = event;
        pressTimer = setTimeout(() => deps.onCellMenu(clientX, clientY), LONG_PRESS_MS);
    });
    for (const type of ["pointerup", "pointercancel", "pointermove"]) {
        deps.canvas.addEventListener(type, () => clearTimeout(pressTimer));
    }
}
