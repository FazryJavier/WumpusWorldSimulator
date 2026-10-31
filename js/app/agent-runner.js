import { createAgent, formatEntry } from "../agent/index.js";
import { maxAgentSteps, toObservation } from "./observation.js";

export const AGENT_SPEEDS = Object.freeze([0.25, 0.5, 1, 2, 4]);
const BASE_DELAY_MS = 600;

/**
 * Loop play/pause/step untuk Mode Agen AI (AI_AGENT §7).
 * @param {{
 *   controller: ReturnType<import("./controller.js").createController>,
 *   timers?: { setTimeout: Function, clearTimeout: Function },
 *   onChange?: (info: object) => void,
 * }} deps
 */
export function createAgentRunner({ controller, timers = globalThis, onChange = () => {} }) {
    let agent = null;
    let timer = null;
    let speed = 1;
    let stopReason = null;

    function info() {
        return {
            running: timer !== null,
            speed,
            stopReason,
            knowledge: agent?.getKnowledge() ?? null,
            intent: agent?.getIntent() ?? null,
            log: (agent?.getLog() ?? []).map((entry) => ({ ...entry, text: formatEntry(entry) })),
            stats: agent?.getStats() ?? { riskDecisions: 0 },
        };
    }

    function reset() {
        pause();
        stopReason = null;
        const state = controller.getState();
        agent = createAgent(state.config);
        agent.observe(toObservation(state, controller.getPercepts(), null));
        onChange(info());
    }

    function halt(reason) {
        stopReason = reason;
        pause();
    }

    /** Satu `decide` + `dispatch`. @returns {boolean} true bila agen masih bisa lanjut */
    function stepOnce() {
        if (!agent) reset();
        const state = controller.getState();
        if (state.status !== "playing") {
            halt("finished");
            onChange(info());
            return false;
        }
        if (controller.getHistory().length >= maxAgentSteps(state.config)) {
            halt("step-limit");
            onChange(info());
            return false;
        }
        const { action } = agent.decide();
        if (!action) {
            halt("stuck");
            onChange(info());
            return false;
        }
        const result = controller.dispatch(action);
        agent.observe(toObservation(result.state, result.percepts, action));
        if (result.state.status !== "playing") halt("finished");
        onChange(info());
        return result.state.status === "playing";
    }

    function tick() {
        timer = null;
        if (stepOnce()) schedule();
    }

    function schedule() {
        timer = timers.setTimeout(tick, BASE_DELAY_MS / speed);
    }

    function pause() {
        if (timer !== null) timers.clearTimeout(timer);
        timer = null;
    }

    return {
        reset,
        stepOnce,
        start() {
            if (!agent) reset();
            if (timer !== null || controller.getState().status !== "playing") return;
            stopReason = null;
            schedule();
            onChange(info());
        },
        pause() {
            pause();
            onChange(info());
        },
        /** @param {number} value salah satu AGENT_SPEEDS */
        setSpeed(value) {
            if (!AGENT_SPEEDS.includes(value)) throw new RangeError(`Unsupported speed: ${value}`);
            speed = value;
            if (timer !== null) {
                pause();
                schedule();
            }
            onChange(info());
        },
        isRunning: () => timer !== null,
        getInfo: info,
    };
}
