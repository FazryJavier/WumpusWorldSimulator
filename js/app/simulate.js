import { createGame, perceive, step } from "../engine/index.js";
import { createAgent } from "../agent/index.js";
import { maxAgentSteps, toObservation } from "./observation.js";

/**
 * Menjalankan satu episode agen tanpa UI (dipakai benchmark dan tes).
 * @returns {{ status:string, score:number, steps:number, riskDecisions:number, actions:object[], diedWithoutRisk:boolean, stopReason:string|null }}
 */
export function runEpisode(config, seed) {
    let state = createGame(config, seed);
    const agent = createAgent(config);
    agent.observe(toObservation(state, perceive(state), null));
    const actions = [];
    let stopReason = null;
    const limit = maxAgentSteps(config);

    while (state.status === "playing") {
        if (actions.length >= limit) {
            stopReason = "step-limit";
            break;
        }
        const { action } = agent.decide();
        if (!action) {
            stopReason = "stuck";
            break;
        }
        const result = step(state, action);
        if (result.events[0]?.type === "invalid") {
            stopReason = `invalid:${result.events[0].reason}`;
            break;
        }
        actions.push(action);
        state = result.state;
        agent.observe(toObservation(state, result.percepts, action));
    }

    const { riskDecisions } = agent.getStats();
    return {
        status: state.status,
        score: state.score,
        steps: state.steps,
        riskDecisions,
        actions,
        diedWithoutRisk: state.status === "lost" && riskDecisions === 0,
        stopReason,
    };
}
