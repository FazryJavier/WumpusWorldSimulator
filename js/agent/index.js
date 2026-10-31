import { createKnowledgeBase } from "./knowledge.js";
import { chooseAction } from "./planner.js";
import { fmtPos, prop } from "./explain.js";

export { formatEntry } from "./explain.js";

const CYCLE_LIMIT = 3;

function describeIntent(intent, obs) {
    const here = [obs.position.x, obs.position.y];
    switch (intent.type) {
        case "grab":
            return { premises: [prop("Glitter", here)], conclusion: "Grab", kind: "decision" };
        case "explore":
            return { premises: [prop("Safe", intent.target)], conclusion: `Go${fmtPos(intent.target)}`, kind: "decision" };
        case "shoot":
            return { premises: [prop("W", intent.target)], conclusion: `Shoot${fmtPos(intent.target)}`, kind: "decision" };
        case "return":
            return { premises: [], conclusion: `Go(0,0)`, kind: "decision" };
        case "climb":
            return { premises: [], conclusion: "Climb", kind: "decision" };
        case "risk":
            return {
                premises: [`Risk${fmtPos(intent.target)}=${intent.risk.toFixed(2)}`],
                conclusion: `Go${fmtPos(intent.target)}`,
                kind: "danger",
            };
        default:
            return { premises: [], conclusion: "Stop", kind: "danger" };
    }
}

/**
 * Agen berbasis pengetahuan (AI_AGENT §2). Hanya menerima observasi, tidak pernah `state.world`.
 * @param {object} config konfigurasi game (diketahui di awal, seperti AIMA)
 * @param {{ strategy?: "rule-based" }} [options]
 */
export function createAgent(config, options = {}) {
    if ((options.strategy ?? "rule-based") !== "rule-based") {
        throw new RangeError(`Unknown agent strategy: ${options.strategy}`);
    }
    const kb = createKnowledgeBase(config);
    const log = [];
    const visits = new Map();
    let lastObs = null;
    let lastIntentKey = null;
    let currentIntent = null;
    let riskDecisions = 0;
    let kbLogSeen = 0;

    return {
        /** @param {object} observation lihat AI_AGENT §1 */
        observe(observation) {
            lastObs = observation;
            kb.observe(observation);
            const fresh = kb.getLog().slice(kbLogSeen);
            kbLogSeen += fresh.length;
            log.push(...fresh);
        },

        /** @returns {{ action: object|null, intent: object }} */
        decide() {
            if (!lastObs) throw new Error("observe() must be called before decide()");
            const { x, y, dir } = lastObs.position;
            // Pengaman siklus (AI_AGENT §5.3): state yang sama terulang → turunkan prioritas.
            const signature = `${x},${y},${dir}|${kb.version}`;
            const count = (visits.get(signature) ?? 0) + 1;
            visits.set(signature, count);
            const result = chooseAction(kb, config, lastObs, { skipSafeMoves: count >= CYCLE_LIMIT });

            currentIntent = result.intent;
            const intentKey = `${result.intent.type}|${result.intent.target ?? ""}`;
            if (intentKey !== lastIntentKey) {
                lastIntentKey = intentKey;
                if (result.intent.type === "risk") riskDecisions++;
                const d = describeIntent(result.intent, lastObs);
                log.push({
                    step: log.length ? log[log.length - 1].step : 0,
                    at: [x, y],
                    rule: "→",
                    premises: d.premises,
                    conclusion: d.conclusion,
                    kind: d.kind,
                    cells: result.intent.target ? [result.intent.target] : [],
                    intent: result.intent.type,
                });
            }
            return result;
        },

        getKnowledge: () => kb.snapshot(),
        getIntent: () => currentIntent,
        /** Gabungan inferensi & keputusan, berurutan sesuai waktu. */
        getLog: () => log.slice(),
        getStats: () => ({ riskDecisions }),
    };
}
