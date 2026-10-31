// Titik masuk: merakit semua modul (ARCHITECTURE §2, lapisan main.js).
import { key } from "./engine/index.js";
import { createController } from "./app/controller.js";
import { AGENT_SPEEDS, createAgentRunner } from "./app/agent-runner.js";
import { createRecords } from "./app/records.js";
import { createSettings } from "./app/settings.js";
import { decodeShare, encodeShare } from "./app/share.js";
import { createStorage, STORAGE_KEYS } from "./app/storage.js";
import { createAudio } from "./ui/audio.js";
import { createDialogs } from "./ui/dialogs.js";
import { createHud } from "./ui/hud.js";
import { createI18n } from "./ui/i18n.js";
import { createInput } from "./ui/input.js";
import { createRenderer } from "./ui/renderer.js";
import { buildSprites } from "./ui/sprites.js";

const $ = (sel) => document.querySelector(`[data-js="${sel}"]`);
const NOTE_MARKERS = { safe: "safe", pit: "pit-maybe", wumpus: "wumpus-maybe" };

function applySettingsToDom(s) {
    const root = document.documentElement;
    root.dataset.theme = s.theme;
    root.dataset.colorblind = String(s.colorblind);
    root.dataset.reduceMotion = String(s.reduceMotion);
    $("mute").setAttribute("aria-pressed", String(s.muted));
    $("mute-on").hidden = s.muted;
    $("mute-off").hidden = !s.muted;
}

/** Penanda overlay agen dari basis pengetahuan (AI_AGENT §3). */
function agentMarkers(info) {
    const markers = new Map();
    if (!info?.knowledge) return markers;
    info.knowledge.forEach((row, y) =>
        row.forEach((c, x) => {
            let m = null;
            if (c.visited) m = "visited";
            else if (c.pit === "yes") m = "pit-yes";
            else if (c.wumpus === "yes") m = "wumpus-yes";
            else if (c.safe) m = "safe";
            else if (c.pit === "maybe") m = "pit-maybe";
            else if (c.wumpus === "maybe") m = "wumpus-maybe";
            if (m) markers.set(key(x, y), m);
        }),
    );
    const target = info.intent?.target;
    if (target && !info.knowledge[target[1]][target[0]].visited) markers.set(key(target[0], target[1]), "target");
    return markers;
}

async function boot() {
    const storage = createStorage();
    const settings = createSettings(storage, navigator.language);
    const records = createRecords(storage);
    const i18n = createI18n();
    const { t } = i18n;
    await i18n.setLocale(settings.get().locale);
    applySettingsToDom(settings.get());

    const hud = createHud(i18n);
    const dialogs = createDialogs();
    const audio = createAudio();
    audio.configure(settings.get());
    window.addEventListener("error", () => hud.toast(t("toast.error"), "error"));
    window.addEventListener("unhandledrejection", () => hud.toast(t("toast.error"), "error"));

    const canvas = $("board");
    let images;
    try {
        images = buildSprites();
    } catch (err) {
        console.error(err);
        $("board-error").hidden = false;
        $("reload").addEventListener("click", () => location.reload());
        return;
    }

    const renderer = createRenderer(canvas, images);
    const controller = createController();
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let uiMode = "play";
    let currentMode = settings.get().mode;
    let customConfig = null;
    let notes = new Map();
    let focusCells = [];
    let agentInfo = null;
    let startedAt = null;

    const runner = createAgentRunner({
        controller,
        onChange(info) {
            agentInfo = info;
            hud.renderAgent(info, controller.getState(), (cells) => {
                focusCells = cells;
                draw();
            });
            draw();
        },
    });

    function draw() {
        const state = controller.getState();
        if (!state) return;
        let markers;
        if (uiMode === "agent") markers = agentMarkers(agentInfo);
        else {
            const visited = new Set(state.visited);
            markers = new Map([...notes].filter(([k]) => !visited.has(k)).map(([k, v]) => [k, NOTE_MARKERS[v]]));
        }
        const highlights = focusCells.map(([x, y]) => ({ x, y, type: "focus" }));
        if (state.cause) highlights.push({ x: state.cause.x, y: state.cause.y, type: "cause" });
        const s = settings.get();
        renderer.render({
            state,
            revealAll: state.status !== "playing",
            markers,
            highlights,
            showCoords: s.showCoords,
            motionMs: s.reduceMotion || reducedMotionQuery.matches ? 0 : 120,
        });
        canvas.setAttribute(
            "aria-label",
            t("board.label", { cols: state.config.cols, rows: state.config.rows, visited: state.visited.length }),
        );
    }

    function flash(className, ms) {
        const wrap = $("board-wrap");
        wrap.classList.remove(className);
        void wrap.offsetWidth; // restart animasi CSS
        wrap.classList.add(className);
        setTimeout(() => wrap.classList.remove(className), ms);
    }

    controller.subscribe((snap) => {
        hud.renderStatus(snap.state);
        hud.renderPercepts(snap.percepts);
        hud.logEvents(snap.events);
        audio.playEvents(snap.events);
        if (snap.percepts.bump) flash("is-bumping", 500);
        if (snap.percepts.scream) flash("is-screaming", 600);
        if (snap.events.length && snap.events[0].type !== "invalid") hud.announce(snap.state);
        draw();
        const ended = snap.events.some((e) => ["won", "died", "climbed"].includes(e.type));
        if (ended && uiMode === "play") setTimeout(() => showEnd(snap.state), 450);
    });

    function startLevel({ mode, seed, config }) {
        try {
            controller.newGame({ mode, seed, config, scoring: settings.get().scoring });
        } catch (err) {
            if (err?.code === "LEVEL_GENERATION_FAILED") hud.toast(t("toast.generationFailed"), "error");
            else throw err;
            return;
        }
        currentMode = mode;
        customConfig = config ?? null;
        if (mode !== "custom") $("difficulty").value = mode;
        afterReset();
        const state = controller.getState();
        history.replaceState(null, "", encodeShare({ mode, seed: state.seed, config: customConfig }));
    }

    function afterReset() {
        notes = new Map();
        focusCells = [];
        startedAt = null;
        hud.clearLog();
        hud.logNewGame(controller.getState());
        hud.renderPercepts(controller.getPercepts(), true);
        hud.clearReasoning();
        if (uiMode === "agent") runner.reset();
        draw();
    }

    function restartLevel() {
        runner.pause();
        controller.restart();
        afterReset();
    }

    function shareUrl() {
        const state = controller.getState();
        const hash = encodeShare({ mode: currentMode, seed: state.seed, config: customConfig });
        return `${location.origin}${location.pathname}${hash}`;
    }

    async function copyShare() {
        const url = shareUrl();
        try {
            await navigator.clipboard.writeText(url);
            hud.toast(t("toast.copied"));
        } catch {
            hud.toast(t("toast.copyFailed", { url }), "error");
        }
    }

    function showEnd(state) {
        if (state !== controller.getState()) return;
        const dialog = $("end-dialog");
        const kind = state.status === "won" ? "win" : state.status === "lost" ? "lose" : "escaped";
        dialog.classList.toggle("modal--win", kind === "win");
        dialog.classList.toggle("modal--lose", kind === "lose");
        $("end-title").textContent = t(`end.${kind}.title`);
        $("end-message").textContent =
            kind === "lose"
                ? t(`end.lose.${state.cause.type}.message`, { x: state.cause.x, y: state.cause.y })
                : t(`end.${kind}.message`);
        const seconds = startedAt ? Math.round((performance.now() - startedAt) / 1000) : 0;
        const stats = [
            ["status.score", state.score],
            ["status.steps", state.steps],
            ["status.arrows", `${state.config.arrows - state.agent.arrows}/${state.config.arrows}`],
            ["status.gold", `${state.agent.goldCarried}/${state.config.gold}`],
        ];
        $("end-stats").replaceChildren(
            ...stats.map(([label, value]) => {
                const div = document.createElement("div");
                div.className = "stat";
                const l = document.createElement("span");
                l.className = "stat__label";
                l.textContent = t(label);
                const v = document.createElement("span");
                v.className = "stat__value";
                v.textContent = String(value);
                div.append(l, v);
                return div;
            }),
        );
        let recordText = "";
        if (currentMode !== "custom") {
            const r = records.submit(currentMode, state.status, state.score);
            recordText = r.newBest ? t("end.record.new") : r.best !== null ? t("end.record.best", r) : "";
        }
        $("end-record").textContent = `${recordText}${seconds ? ` · ${seconds}s` : ""}`.replace(/^ · /, "");
        dialogs.open(dialog);
    }

    function setUiMode(next) {
        if (next === uiMode) return;
        uiMode = next;
        for (const btn of $("mode-toggle").querySelectorAll("[data-mode]")) {
            const on = btn.dataset.mode === next;
            btn.classList.toggle("is-active", on);
            btn.setAttribute("aria-checked", String(on));
        }
        const agent = next === "agent";
        $("agent-card").hidden = !agent;
        $("reasoning-card").hidden = !agent;
        $("legend").hidden = !agent;
        $("controls-card").hidden = agent;
        $("board-hint").hidden = agent;
        $("touch-controls").hidden = agent;
        agentInfo = null;
        restartLevel();
    }

    // ---- Input pemain ----
    createInput({
        canvas,
        isEnabled: () => uiMode === "play" && !dialogs.anyOpen() && controller.getState()?.status === "playing",
        getFacing: () => controller.getState().agent.dir,
        onAction(action) {
            if (!startedAt) startedAt = performance.now();
            controller.dispatch(action);
        },
        onRestart() {
            if (dialogs.anyOpen()) return;
            const state = controller.getState();
            if (uiMode === "play" && state.status === "playing" && state.steps > 0 && !window.confirm(t("confirm.restart"))) return;
            restartLevel();
        },
        onEscape() {
            closeCellMenu();
            if (runner.isRunning()) runner.pause();
        },
        onCellMenu: openCellMenu,
        onFirstInteraction: () => audio.unlock(),
    });

    // ---- Catatan pemain (PRD F7) ----
    const menu = $("cell-menu");
    let menuCell = null;

    function openCellMenu(clientX, clientY) {
        const state = controller.getState();
        if (uiMode !== "play" || state.status !== "playing") return;
        const cell = renderer.cellAt(clientX, clientY);
        if (!cell || state.visited.includes(key(cell[0], cell[1]))) return;
        menuCell = cell;
        menu.hidden = false;
        const { width, height } = menu.getBoundingClientRect();
        menu.style.left = `${Math.min(clientX, window.innerWidth - width - 8)}px`;
        menu.style.top = `${Math.min(clientY, window.innerHeight - height - 8)}px`;
        menu.querySelector("button").focus();
    }

    function closeCellMenu() {
        menu.hidden = true;
        menuCell = null;
    }

    menu.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-note]");
        if (!btn || !menuCell) return;
        const k = key(menuCell[0], menuCell[1]);
        if (btn.dataset.note) notes.set(k, btn.dataset.note);
        else notes.delete(k);
        closeCellMenu();
        canvas.focus?.();
        draw();
    });
    document.addEventListener("pointerdown", (event) => {
        if (!menu.hidden && !menu.contains(event.target)) closeCellMenu();
    });

    // ---- App bar ----
    $("mode-toggle").addEventListener("click", (event) => {
        const btn = event.target.closest("[data-mode]");
        if (btn) setUiMode(btn.dataset.mode);
    });
    $("difficulty").addEventListener("change", (event) => {
        settings.update({ mode: event.target.value });
        startLevel({ mode: event.target.value });
    });
    $("new-level").addEventListener("click", () => startLevel({ mode: $("difficulty").value }));
    $("restart").addEventListener("click", restartLevel);
    $("share").addEventListener("click", copyShare);
    $("help").addEventListener("click", () => dialogs.open($("help-dialog")));
    $("settings").addEventListener("click", () => {
        fillSettingsForm();
        dialogs.open($("settings-dialog"), $("settings-form").elements.theme);
    });
    $("mute").addEventListener("click", () => {
        audio.unlock();
        settings.update({ muted: !settings.get().muted });
    });
    $("locale").value = i18n.locale;
    $("locale").addEventListener("change", async (event) => {
        settings.update({ locale: event.target.value });
        await i18n.setLocale(event.target.value);
        const state = controller.getState();
        hud.renderStatus(state);
        hud.renderPercepts(controller.getPercepts(), true);
        hud.clearReasoning();
        if (agentInfo) hud.renderAgent(agentInfo, state, (cells) => ((focusCells = cells), draw()));
        draw();
    });

    // ---- Dialog akhir & bantuan ----
    $("end-retry").addEventListener("click", () => {
        dialogs.close($("end-dialog"));
        restartLevel();
    });
    $("end-new").addEventListener("click", () => {
        dialogs.close($("end-dialog"));
        startLevel({ mode: currentMode === "custom" ? $("difficulty").value : currentMode });
    });
    $("end-share").addEventListener("click", copyShare);
    $("help-close").addEventListener("click", () => dialogs.close($("help-dialog")));
    $("help-dialog").addEventListener("close", () => storage.set(STORAGE_KEYS.tutorial, { done: true }));

    // ---- Pengaturan ----
    const form = $("settings-form");
    function fillSettingsForm() {
        const s = settings.get();
        form.elements.theme.value = s.theme;
        form.elements.scoring.value = s.scoring;
        form.elements.musicVolume.value = String(s.musicVolume);
        form.elements.sfxVolume.value = String(s.sfxVolume);
        form.elements.colorblind.checked = s.colorblind;
        form.elements.reduceMotion.checked = s.reduceMotion;
        form.elements.showCoords.checked = s.showCoords;
    }
    form.addEventListener("input", (event) => {
        const el = event.target;
        if (!el.name) return;
        const value = el.type === "checkbox" ? el.checked : el.type === "range" ? Number(el.value) : el.value;
        settings.update({ [el.name]: value });
    });
    settings.subscribe((s) => {
        applySettingsToDom(s);
        audio.configure(s);
        renderer.refreshTheme();
        draw();
    });
    window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => renderer.refreshTheme());

    // ---- Kontrol agen ----
    $("agent-play").addEventListener("click", () => (runner.isRunning() ? runner.pause() : runner.start()));
    $("agent-step").addEventListener("click", () => {
        runner.pause();
        runner.stepOnce();
    });
    $("agent-reset").addEventListener("click", restartLevel);
    $("agent-speed").addEventListener("input", (event) => {
        const speed = AGENT_SPEEDS[Number(event.target.value)];
        $("agent-speed-out").textContent = `${speed}×`;
        runner.setSpeed(speed);
    });

    let resizeFrame = 0;
    window.addEventListener("resize", () => {
        cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(() => renderer.resize());
    });

    // ---- Level awal: dari link share bila valid ----
    const shared = decodeShare(location.hash);
    if (shared.ok) startLevel(shared);
    else {
        if (shared.reason !== "empty") hud.toast(t("toast.invalidLink"), "error");
        startLevel({ mode: currentMode });
    }
    window.addEventListener("hashchange", () => {
        const next = decodeShare(location.hash);
        if (next.ok) startLevel(next);
    });

    if (!storage.get(STORAGE_KEYS.tutorial, { done: false })?.done) dialogs.open($("help-dialog"));
}

boot().catch((err) => {
    console.error(err);
    const box = document.querySelector('[data-js="board-error"]');
    if (box) box.hidden = false;
});
