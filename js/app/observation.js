/**
 * Satu-satunya jembatan dari state game ke agen (AI_AGENT §1): hanya persepsi & data diri agen,
 * tidak pernah `state.world`.
 * @param {object} state GameState
 * @param {object} percepts
 * @param {object|null} lastAction
 */
export function toObservation(state, percepts, lastAction) {
    return {
        percepts: { ...percepts },
        position: { x: state.agent.x, y: state.agent.y, dir: state.agent.dir },
        arrows: state.agent.arrows,
        goldCarried: state.agent.goldCarried,
        lastAction: lastAction ? { ...lastAction } : null,
    };
}

/** Batas langkah agen (AI_AGENT §5.3). */
export function maxAgentSteps(config) {
    return config.cols * config.rows * 8;
}
