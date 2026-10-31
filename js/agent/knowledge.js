import { key, neighbors, ray } from "../engine/index.js";
import { and, fmtPos, not, or, prop, sortCells } from "./explain.js";

/**
 * @typedef CellKnowledge
 * @property {boolean} visited
 * @property {boolean|null} breeze    null = belum diamati (atau kedaluwarsa, untuk stench)
 * @property {boolean|null} stench
 * @property {"unknown"|"no"|"maybe"|"yes"} pit
 * @property {"unknown"|"no"|"maybe"|"yes"} wumpus
 * @property {boolean} safe
 */

/**
 * Basis pengetahuan per petak + inferensi K1–K11 (AI_AGENT §3–§4).
 * Hanya menerima observasi; tidak pernah melihat isi dunia.
 * @param {{ cols:number, rows:number, pits:number, wumpus:number }} config
 */
export function createKnowledgeBase(config) {
    const { cols, rows } = config;
    /** @type {CellKnowledge[][]} */
    const cells = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => ({
            visited: false,
            breeze: null,
            stench: null,
            pit: "unknown",
            wumpus: "unknown",
            safe: false,
        })),
    );
    /** @type {object[]} */
    const log = [];
    // Ukuran klausa terakhir per sumber, agar K4/K5 hanya dicatat sekali dan penyusutan dicatat sebagai K6.
    const clauseSize = new Map();
    let wumpusKilled = 0;
    let version = 0;
    let stepNo = 0;
    let at = [0, 0];
    let pitClauses = [];
    let wumpusClauses = [];

    const cell = (x, y) => cells[y][x];
    const around = (x, y) => neighbors(cols, rows, x, y);
    const allCells = () => {
        const out = [];
        for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) out.push([x, y]);
        return out;
    };
    const wumpusAllDead = () => wumpusKilled >= config.wumpus;

    function record(rule, premises, conclusion, kind, highlighted) {
        log.push({ step: stepNo, at: [...at], rule, premises, conclusion, kind, cells: highlighted });
    }

    /** Menetapkan fakta final. Nilai "no"/"yes" tidak pernah ditimpa kecuali `force` (K11). */
    function setFact(x, y, field, value, force = false) {
        const c = cell(x, y);
        if (c[field] === value) return false;
        if (!force && (c[field] === "no" || c[field] === "yes")) return false;
        c[field] = value;
        version++;
        return true;
    }

    function applyNegative(sourceField, field, rule, perceptName, propName) {
        let changed = false;
        for (const [x, y] of allCells()) {
            const c = cell(x, y);
            if (!c.visited || c[sourceField] !== false) continue;
            const updated = around(x, y).filter(([nx, ny]) => setFact(nx, ny, field, "no"));
            if (updated.length > 0) {
                changed = true;
                const conclusion = and(sortCells(updated).map((p) => not(prop(propName, p))));
                record(rule, [not(prop(perceptName, [x, y]))], conclusion, "safe", updated);
            }
        }
        return changed;
    }

    /** K4/K5 + K6: bangun klausa dari persepsi positif dan lakukan unit propagation. */
    function buildClauses(sourceField, field, rule, perceptName, propName) {
        const clauses = [];
        let changed = false;
        for (const [x, y] of allCells()) {
            const c = cell(x, y);
            if (!c.visited || c[sourceField] !== true) continue;
            const members = sortCells(around(x, y).filter(([nx, ny]) => cell(nx, ny)[field] !== "no"));
            const sourceKey = `${field}|${key(x, y)}`;
            const premise = prop(perceptName, [x, y]);
            if (members.length === 0) continue;
            if (members.some(([nx, ny]) => cell(nx, ny)[field] === "yes")) {
                clauses.push({ source: [x, y], cells: members, satisfied: true });
                continue;
            }
            const previous = clauseSize.get(sourceKey);
            if (members.length === 1) {
                const [only] = members;
                if (setFact(only[0], only[1], field, "yes")) {
                    changed = true;
                    if (previous && previous > 1) record("K6", [], prop(propName, only), "danger", [only]);
                    else record(rule, [premise], prop(propName, only), "danger", [only]);
                }
            } else if (previous !== members.length) {
                record(rule, [premise], or(members.map((p) => prop(propName, p))), "info", members);
            }
            clauseSize.set(sourceKey, members.length);
            clauses.push({ source: [x, y], cells: members, satisfied: false });
        }
        return { clauses, changed };
    }

    /** K8 & K9: hanya berlaku saat jumlah Wumpus = 1. */
    function singleWumpusRules() {
        if (config.wumpus !== 1 || wumpusAllDead()) return false;
        let changed = false;
        const known = allCells().find(([x, y]) => cell(x, y).wumpus === "yes");
        if (known) {
            const updated = allCells().filter(([x, y]) => (x !== known[0] || y !== known[1]) && setFact(x, y, "wumpus", "no"));
            if (updated.length > 0) {
                changed = true;
                record("K9", [prop("W", known)], `∀c ≠ ${fmtPos(known)}: ¬W(c)`, "safe", updated);
            }
            return changed;
        }
        if (wumpusClauses.length === 0) return false;
        let intersection = wumpusClauses[0].cells.map(([x, y]) => key(x, y));
        for (const clause of wumpusClauses.slice(1)) {
            const keys = new Set(clause.cells.map(([x, y]) => key(x, y)));
            intersection = intersection.filter((k) => keys.has(k));
        }
        const inside = new Set(intersection);
        const updated = allCells().filter(([x, y]) => !inside.has(key(x, y)) && setFact(x, y, "wumpus", "no"));
        const premises = wumpusClauses.map((c) => prop("Stench", c.source));
        if (updated.length > 0) {
            changed = true;
            const set = intersection.map((k) => fmtPos(k.split(",").map(Number))).join(",");
            record("K8", premises, `∀c ∉ {${set}}: ¬W(c)`, "safe", updated);
        }
        if (intersection.length === 1) {
            const [x, y] = intersection[0].split(",").map(Number);
            if (setFact(x, y, "wumpus", "yes")) {
                changed = true;
                record("K8", premises, prop("W", [x, y]), "danger", [[x, y]]);
            }
        }
        return changed;
    }

    function killAllWumpus() {
        return allCells().filter(([x, y]) => setFact(x, y, "wumpus", "no", true));
    }

    /** Menjalankan aturan sampai fixed point. */
    function infer() {
        for (const [x, y] of allCells()) {
            const c = cell(x, y);
            if (c.pit === "maybe") c.pit = "unknown";
            if (c.wumpus === "maybe") c.wumpus = "unknown";
        }
        let changed = true;
        while (changed) {
            changed = false;
            if (applyNegative("breeze", "pit", "K2", "Breeze", "Pit")) changed = true;
            if (wumpusAllDead()) {
                if (killAllWumpus().length > 0) changed = true;
                wumpusClauses = [];
            } else if (applyNegative("stench", "wumpus", "K3", "Stench", "W")) {
                changed = true;
            }
            const pitResult = buildClauses("breeze", "pit", "K4", "Breeze", "Pit");
            pitClauses = pitResult.clauses.filter((c) => !c.satisfied);
            if (pitResult.changed) changed = true;
            if (!wumpusAllDead()) {
                const wResult = buildClauses("stench", "wumpus", "K5", "Stench", "W");
                wumpusClauses = wResult.clauses.filter((c) => !c.satisfied);
                if (wResult.changed) changed = true;
                if (singleWumpusRules()) changed = true;
            }
        }
        // K7: anggota klausa yang belum pasti menjadi "maybe".
        for (const [list, field] of [
            [pitClauses, "pit"],
            [wumpusClauses, "wumpus"],
        ]) {
            for (const clause of list) {
                for (const [x, y] of clause.cells) if (cell(x, y)[field] === "unknown") cell(x, y)[field] = "maybe";
            }
        }
        for (const [x, y] of allCells()) {
            const c = cell(x, y);
            c.safe = c.pit === "no" && c.wumpus === "no";
        }
    }

    /** Menandai pengamatan stench di sekitar petak-petak ini sebagai kedaluwarsa. */
    function expireStench(targets) {
        for (const [tx, ty] of targets) {
            for (const [nx, ny] of around(tx, ty)) {
                if (cell(nx, ny).stench === true) cell(nx, ny).stench = null;
            }
        }
    }

    /** K10 & K11: dipanggil sebelum persepsi petak saat ini dicatat. */
    function processShot(position, scream) {
        const path = ray(cols, rows, position.x, position.y, position.dir);
        if (!scream) {
            const updated = path.filter(([x, y]) => setFact(x, y, "wumpus", "no"));
            const premise = `Shoot${fmtPos([position.x, position.y])}→${position.dir} ∧ ¬Scream`;
            record("K10", [premise], updated.length ? and(updated.map((p) => not(prop("W", p)))) : "—", "safe", updated);
            return;
        }
        wumpusKilled++;
        const premise = `Shoot${fmtPos([position.x, position.y])}→${position.dir} ∧ Scream`;
        if (wumpusAllDead()) {
            const updated = killAllWumpus();
            record("K11", [premise], "∀c: ¬W(c)", "safe", updated);
            return;
        }
        const candidates = path.filter(([x, y]) => cell(x, y).wumpus !== "no");
        if (candidates.length === 1) {
            const [x, y] = candidates[0];
            setFact(x, y, "wumpus", "no", true);
            expireStench(candidates);
            record("K11", [premise], not(prop("W", [x, y])), "safe", candidates);
            return;
        }
        for (const [x, y] of candidates) setFact(x, y, "wumpus", "unknown", true);
        for (const [k] of clauseSize) if (k.startsWith("wumpus|")) clauseSize.delete(k);
        expireStench(path);
        record("K11", [premise], `? ${candidates.map(fmtPos).join(" ")}`, "info", candidates);
    }

    return {
        /**
         * Memperbarui basis pengetahuan dari satu observasi (AI_AGENT §1) lalu menjalankan inferensi.
         * @param {{ percepts: object, position: {x:number,y:number,dir:string}, lastAction: object|null }} obs
         */
        observe(obs) {
            const { percepts, position } = obs;
            at = [position.x, position.y];
            if (obs.lastAction?.type === "shoot") processShot(position, percepts.scream);
            const c = cell(position.x, position.y);
            // K1: agen hidup di petak ini.
            setFact(position.x, position.y, "pit", "no", true);
            setFact(position.x, position.y, "wumpus", "no", true);
            if (!c.visited) version++;
            c.visited = true;
            c.breeze = percepts.breeze;
            c.stench = percepts.stench;
            infer();
            stepNo++;
        },

        cell: (x, y) => cell(x, y),
        isSafe: (x, y) => cell(x, y).safe,

        /** Salinan grid pengetahuan (untuk overlay UI). */
        snapshot: () => cells.map((row) => row.map((c) => ({ ...c }))),
        getLog: () => log.slice(),
        get version() {
            return version;
        },
        get wumpusKilled() {
            return wumpusKilled;
        },
        get pitClauses() {
            return pitClauses;
        },
        get wumpusClauses() {
            return wumpusClauses;
        },
    };
}
