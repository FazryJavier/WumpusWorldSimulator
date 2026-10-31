const PERCEPTS = ["breeze", "stench", "glitter", "bump", "scream"];
const LOG_LIMIT = 50;
const TOAST_MS = 4000;

const $ = (sel) => document.querySelector(`[data-js="${sel}"]`);

/** Sidebar: status, persepsi, log, panel agen, toast (DESIGN_SYSTEM §8). Teks dinamis selalu lewat textContent. */
export function createHud(i18n) {
    const { t } = i18n;
    const el = {
        score: $("stat-score"),
        arrows: $("stat-arrows"),
        gold: $("stat-gold"),
        steps: $("stat-steps"),
        statusLine: $("status-line"),
        percepts: $("percepts"),
        messages: $("percept-messages"),
        log: $("log"),
        reasoning: $("reasoning"),
        agentSummary: $("agent-summary"),
        agentPlay: $("agent-play"),
        toasts: $("toasts"),
        announcer: $("announcer"),
        climb: $("climb-btn"),
    };
    let lastPerceptKey = "";

    function logLine(text, tone) {
        const li = document.createElement("li");
        li.className = `log__item${tone ? ` log__item--${tone}` : ""}`;
        li.textContent = text;
        el.log.prepend(li);
        while (el.log.children.length > LOG_LIMIT) el.log.lastElementChild.remove();
    }

    return {
        renderStatus(state) {
            el.score.textContent = String(state.score);
            el.arrows.textContent = String(state.agent.arrows);
            el.gold.textContent = `${state.agent.goldCarried}/${state.config.gold}`;
            el.steps.textContent = String(state.steps);
            const goal =
                state.config.winCondition === "climb"
                    ? t("status.goal.climb")
                    : t("status.goal.collect", { count: state.config.gold });
            el.statusLine.textContent = `${t("status.line", {
                x: state.agent.x,
                y: state.agent.y,
                dir: t(`dir.${state.agent.dir}`),
                seed: state.seed,
            })} ${goal}`;
            el.climb.hidden = state.config.winCondition !== "climb";
        },

        renderPercepts(percepts, force = false) {
            const active = PERCEPTS.filter((p) => percepts[p]);
            for (const li of el.percepts.children) {
                const on = Boolean(percepts[li.dataset.percept]);
                li.classList.toggle("is-active", on);
                li.setAttribute("aria-current", on ? "true" : "false");
            }
            const k = active.join(",");
            if (k === lastPerceptKey && !force) return;
            lastPerceptKey = k;
            el.messages.replaceChildren(
                ...(active.length ? active : ["none"]).map((p) => {
                    const p1 = document.createElement("p");
                    p1.className = `percept-message percept-message--${p}`;
                    p1.textContent = t(`percept.${p}.message`);
                    return p1;
                }),
            );
        },

        announce(state) {
            el.announcer.textContent = t("announce.position", {
                x: state.agent.x,
                y: state.agent.y,
                dir: t(`dir.${state.agent.dir}`),
            });
        },

        clearLog() {
            el.log.replaceChildren();
        },

        logNewGame(state) {
            logLine(t("log.newGame", { seed: state.seed }));
        },

        logEvents(events) {
            for (const e of events) {
                switch (e.type) {
                    case "moved":
                        logLine(t("log.moved", { x: e.to[0], y: e.to[1] }));
                        break;
                    case "turned":
                        logLine(t("log.turned", { dir: t(`dir.${e.dir}`) }));
                        break;
                    case "bump":
                        logLine(t("log.bump"), "danger");
                        break;
                    case "shot":
                        if (e.hit) logLine(t("log.shotHit", { x: e.target[0], y: e.target[1] }), "good");
                        else logLine(t("log.shotMiss"));
                        break;
                    case "grabbed":
                        logLine(t("log.grabbed", { x: e.at[0], y: e.at[1] }), "good");
                        break;
                    case "climbed":
                        logLine(t(e.withGold ? "log.climbed.gold" : "log.climbed.empty"), e.withGold ? "good" : null);
                        break;
                    case "died":
                        logLine(t(`log.died.${e.cause}`, { x: e.at[0], y: e.at[1] }), "danger");
                        break;
                    case "won":
                        logLine(t("log.won"), "good");
                        break;
                    case "invalid":
                        logLine(t(`log.invalid.${e.reason}`), "danger");
                        break;
                }
            }
        },

        /**
         * Panel agen + log penalaran. `onSelect` dipanggil dengan petak entri yang diklik.
         * @param {object} info dari agent runner
         * @param {object} state GameState
         */
        renderAgent(info, state, onSelect) {
            el.agentPlay.textContent = t(info.running ? "agent.pause" : "agent.run");
            const risks = info.stats.riskDecisions;
            let summary;
            if (state.status !== "playing") {
                summary = t(`agent.result.${state.status}`, { score: state.score, steps: state.steps, risks });
            } else if (info.stopReason && info.stopReason !== "finished") {
                summary = t(`agent.stop.${info.stopReason}`);
            } else if (state.steps === 0 && !info.running) {
                summary = t("agent.idle");
            } else {
                summary = t("agent.running", { steps: state.steps, risks });
            }
            el.agentSummary.textContent = summary;

            const rendered = el.reasoning.children.length;
            if (info.log.length < rendered) el.reasoning.replaceChildren();
            const fresh = info.log.slice(el.reasoning.children.length);
            for (const entry of fresh) {
                const li = document.createElement("li");
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = `reasoning__item reasoning__item--${entry.kind}`;
                const code = document.createElement("span");
                code.textContent = entry.text;
                const explain = document.createElement("span");
                explain.className = "reasoning__explain";
                explain.textContent =
                    entry.rule === "→" ? t(`agent.intent.${entry.intent}`) : t(`agent.rule.${entry.rule}`);
                btn.append(code, explain);
                btn.addEventListener("click", () => {
                    for (const other of el.reasoning.querySelectorAll(".is-selected")) other.classList.remove("is-selected");
                    btn.classList.add("is-selected");
                    onSelect(entry.cells);
                });
                li.append(btn);
                el.reasoning.append(li);
            }
            if (fresh.length) el.reasoning.scrollTop = el.reasoning.scrollHeight;
        },

        clearReasoning() {
            el.reasoning.replaceChildren();
        },

        /** @param {string} message @param {"info"|"error"} [kind] */
        toast(message, kind = "info") {
            const div = document.createElement("div");
            div.className = `toast toast--${kind}`;
            div.setAttribute("role", "status");
            const text = document.createElement("span");
            text.textContent = message;
            const close = document.createElement("button");
            close.type = "button";
            close.className = "toast__close";
            close.setAttribute("aria-label", t("action.close"));
            close.textContent = "×";
            close.addEventListener("click", () => div.remove());
            div.append(text, close);
            el.toasts.append(div);
            setTimeout(() => div.remove(), TOAST_MS);
        },
    };
}
