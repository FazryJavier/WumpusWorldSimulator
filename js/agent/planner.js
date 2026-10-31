import { DIRS, DIR_ORDER, inBounds, key, neighbors, ray } from "../engine/index.js";

/** @typedef {{ x:number, y:number, dir:string }} Pose */

const stateKey = (x, y, dir) => `${x},${y},${dir}`;

/**
 * BFS atas state (x, y, dir) dengan biaya seragam per aksi (`face` = 1, `forward` = 1), AI_AGENT §5.1.
 * Hanya melewati petak `passable`; petak `target` (opsional) boleh dimasuki walau tidak passable.
 * @returns {Map<string, { cost:number, prev:string|null, action:object|null }>}
 */
export function searchPoses(config, start, passable, target = null) {
    const seen = new Map([[stateKey(start.x, start.y, start.dir), { cost: 0, prev: null, action: null }]]);
    const queue = [[start.x, start.y, start.dir]];
    for (let head = 0; head < queue.length; head++) {
        const [x, y, dir] = queue[head];
        const here = stateKey(x, y, dir);
        const { cost } = seen.get(here);
        // Petak target yang berbahaya adalah tujuan akhir, bukan tempat transit.
        if (target && x === target[0] && y === target[1] && !passable(x, y)) continue;
        const moves = [];
        const [dx, dy] = DIRS[dir];
        const nx = x + dx;
        const ny = y + dy;
        const isTarget = target && nx === target[0] && ny === target[1];
        if (inBounds(config.cols, config.rows, nx, ny) && (passable(nx, ny) || isTarget)) {
            moves.push([nx, ny, dir, { type: "forward" }]);
        }
        for (const d of DIR_ORDER) if (d !== dir) moves.push([x, y, d, { type: "face", dir: d }]);
        for (const [mx, my, md, action] of moves) {
            const k = stateKey(mx, my, md);
            if (seen.has(k)) continue;
            seen.set(k, { cost: cost + 1, prev: here, action });
            queue.push([mx, my, md]);
        }
    }
    return seen;
}

/** Merekonstruksi urutan aksi dari hasil `searchPoses` ke state `goalKey`. */
export function actionsTo(seen, goalKey) {
    const actions = [];
    let k = goalKey;
    while (k && seen.get(k).prev) {
        actions.unshift(seen.get(k).action);
        k = seen.get(k).prev;
    }
    return actions;
}

/** Aksi tercepat untuk berdiri di petak `cell` (arah bebas). */
export function planToCell(config, start, cell, passable) {
    const seen = searchPoses(config, start, passable, cell);
    let best = null;
    for (const dir of DIR_ORDER) {
        const k = stateKey(cell[0], cell[1], dir);
        if (seen.has(k) && (!best || seen.get(k).cost < seen.get(best).cost)) best = k;
    }
    return best ? actionsTo(seen, best) : null;
}

/**
 * Jarak (jumlah langkah maju) dari `start` ke setiap petak melalui petak `passable` (BFS petak).
 * @returns {Map<string, number>}
 */
export function cellDistances(config, start, passable) {
    const dist = new Map([[key(start[0], start[1]), 0]]);
    const queue = [start];
    for (let head = 0; head < queue.length; head++) {
        const [x, y] = queue[head];
        for (const [nx, ny] of neighbors(config.cols, config.rows, x, y)) {
            const k = key(nx, ny);
            if (dist.has(k) || !passable(nx, ny)) continue;
            dist.set(k, dist.get(key(x, y)) + 1);
            queue.push([nx, ny]);
        }
    }
    return dist;
}

/** Tie-break deterministik: nilai utama, lalu y, lalu x (AI_AGENT §2). */
export function compareCandidates(a, b) {
    for (let i = 0; i < a.rank.length; i++) {
        if (a.rank[i] !== b.rank[i]) return a.rank[i] - b.rank[i];
    }
    return a.cell[1] - b.cell[1] || a.cell[0] - b.cell[0];
}

/**
 * Estimasi risiko petak perbatasan (AI_AGENT §5.2). Heuristik, bukan probabilitas eksak.
 * @returns {{ pit:number, wumpus:number, risk:number }}
 */
export function estimateRisk(kb, config, x, y) {
    const all = [];
    for (let cy = 0; cy < config.rows; cy++) for (let cx = 0; cx < config.cols; cx++) all.push(kb.cell(cx, cy));

    const p = (field, clauses, total) => {
        const value = kb.cell(x, y)[field];
        if (value === "no") return 0;
        if (value === "yes") return 1;
        if (value === "maybe") {
            let best = 0;
            for (const clause of clauses) {
                if (clause.cells.some(([cx, cy]) => cx === x && cy === y)) best = Math.max(best, 1 / clause.cells.length);
            }
            return best;
        }
        const knownYes = all.filter((c) => c[field] === "yes").length;
        const unknown = all.filter((c) => c[field] === "unknown").length;
        return unknown === 0 ? 0 : Math.min(1, Math.max(0, total - knownYes) / unknown);
    };

    const pit = p("pit", kb.pitClauses, config.pits);
    const wumpus = p("wumpus", kb.wumpusClauses, config.wumpus - kb.wumpusKilled);
    return { pit, wumpus, risk: 1 - (1 - pit) * (1 - wumpus) };
}

/**
 * Memilih aksi berikutnya berdasarkan prioritas AI_AGENT §5.
 * @param {object} kb basis pengetahuan
 * @param {object} config
 * @param {{ percepts:object, position:Pose, arrows:number, goldCarried:number }} obs
 * @param {{ skipSafeMoves?: boolean }} [options]
 * @returns {{ action: object|null, intent: { type:string, target?: [number,number], risk?: number } }}
 */
export function chooseAction(kb, config, obs, options = {}) {
    const pose = obs.position;
    const here = [pose.x, pose.y];
    const safe = (x, y) => kb.isSafe(x, y);
    const climbMode = config.winCondition === "climb";

    // 1. Glitter → ambil.
    if (obs.percepts.glitter) return { action: { type: "grab" }, intent: { type: "grab", target: here } };

    const goHome = (type) => {
        if (pose.x === 0 && pose.y === 0) return { action: { type: "climb" }, intent: { type: "climb", target: [0, 0] } };
        const plan = planToCell(config, pose, [0, 0], safe);
        return plan ? { action: plan[0], intent: { type, target: [0, 0] } } : null;
    };

    // 2. Mode climb dan membawa emas → pulang.
    if (climbMode && obs.goldCarried > 0) {
        const home = goHome("return");
        if (home) return home;
    }

    if (!options.skipSafeMoves) {
        // 3. Petak aman belum dikunjungi terdekat.
        const dist = cellDistances(config, here, safe);
        const targets = [];
        for (const [k, d] of dist) {
            const [x, y] = k.split(",").map(Number);
            if (!kb.cell(x, y).visited) targets.push({ cell: [x, y], rank: [d] });
        }
        if (targets.length > 0) {
            const target = targets.sort(compareCandidates)[0].cell;
            const plan = planToCell(config, pose, target, safe);
            if (plan && plan.length > 0) return { action: plan[0], intent: { type: "explore", target } };
        }

        // 4. Wumpus pasti yang bisa dibidik dari petak aman.
        if (obs.arrows > 0) {
            const shot = planShot(kb, config, pose, safe);
            if (shot) return shot;
        }

        // 5. Kandidat Wumpus di sebelah → tembak yang paling mungkin.
        if (obs.arrows > 0) {
            const candidates = [];
            for (const dir of DIR_ORDER) {
                const [dx, dy] = DIRS[dir];
                const nx = pose.x + dx;
                const ny = pose.y + dy;
                if (!inBounds(config.cols, config.rows, nx, ny) || kb.cell(nx, ny).wumpus !== "maybe") continue;
                candidates.push({ cell: [nx, ny], dir, rank: [-estimateRisk(kb, config, nx, ny).wumpus] });
            }
            if (candidates.length > 0) {
                const best = candidates.sort(compareCandidates)[0];
                const action = pose.dir === best.dir ? { type: "shoot" } : { type: "face", dir: best.dir };
                return { action, intent: { type: "shoot", target: best.cell } };
            }
        }
    }

    // 6. Mode climb: pulang tanpa emas (menyerah aman).
    if (climbMode) {
        const home = goHome("return");
        if (home) return home;
    }

    // 7. Ambil risiko terendah di perbatasan.
    return planRisk(kb, config, pose, safe);
}

function planShot(kb, config, pose, safe) {
    const seen = searchPoses(config, pose, safe);
    let best = null;
    for (let y = 0; y < config.rows; y++) {
        for (let x = 0; x < config.cols; x++) {
            if (kb.cell(x, y).wumpus !== "yes") continue;
            for (const dir of DIR_ORDER) {
                // Posisi bidik: petak aman yang lintasan panahnya ke `dir` melewati (x, y).
                const opposite = { up: "down", down: "up", left: "right", right: "left" }[dir];
                for (const [sx, sy] of ray(config.cols, config.rows, x, y, opposite)) {
                    if (!safe(sx, sy)) continue;
                    const k = stateKey(sx, sy, dir);
                    if (!seen.has(k)) continue;
                    const candidate = { cell: [sx, sy], key: k, target: [x, y], rank: [seen.get(k).cost] };
                    if (!best || compareCandidates(candidate, best) < 0) best = candidate;
                }
            }
        }
    }
    if (!best) return null;
    const plan = actionsTo(seen, best.key);
    const action = plan.length === 0 ? { type: "shoot" } : plan[0];
    return { action, intent: { type: "shoot", target: best.target } };
}

function planRisk(kb, config, pose, safe) {
    const dist = cellDistances(config, [pose.x, pose.y], safe);
    const frontier = [];
    for (let y = 0; y < config.rows; y++) {
        for (let x = 0; x < config.cols; x++) {
            const c = kb.cell(x, y);
            if (c.visited) continue;
            const reach = neighbors(config.cols, config.rows, x, y)
                .filter(([nx, ny]) => kb.cell(nx, ny).visited && dist.has(key(nx, ny)))
                .map(([nx, ny]) => dist.get(key(nx, ny)) + 1);
            if (reach.length === 0) continue;
            const { risk } = estimateRisk(kb, config, x, y);
            if (risk >= 1) continue;
            frontier.push({ cell: [x, y], risk, rank: [risk, Math.min(...reach)] });
        }
    }
    if (frontier.length === 0) return { action: null, intent: { type: "stuck" } };
    const best = frontier.sort(compareCandidates)[0];
    const plan = planToCell(config, pose, best.cell, safe);
    if (!plan || plan.length === 0) return { action: null, intent: { type: "stuck" } };
    return { action: plan[0], intent: { type: "risk", target: best.cell, risk: best.risk } };
}
