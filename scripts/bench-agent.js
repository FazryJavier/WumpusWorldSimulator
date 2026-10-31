// Benchmark Agen AI (AI_AGENT §8): seed 1…N per mode.
import { MODES } from "../js/engine/index.js";
import { runEpisode } from "../js/app/simulate.js";

const count = Number(process.argv[2] ?? 1000);

for (const config of Object.values(MODES)) {
    const tally = { won: 0, lost: 0, escaped: 0, playing: 0 };
    let score = 0;
    let steps = 0;
    let diedWithoutRisk = 0;
    const stops = {};
    for (let seed = 1; seed <= count; seed++) {
        const r = runEpisode(config, seed);
        tally[r.status]++;
        score += r.score;
        steps += r.steps;
        if (r.diedWithoutRisk) diedWithoutRisk++;
        if (r.stopReason) stops[r.stopReason] = (stops[r.stopReason] ?? 0) + 1;
    }
    const pct = (n) => `${((n / count) * 100).toFixed(1)}%`;
    console.log(
        [
            `${config.mode.padEnd(6)} n=${count}`,
            `menang ${pct(tally.won)}`,
            `kalah ${pct(tally.lost)}`,
            `keluar ${pct(tally.escaped)}`,
            `berhenti ${pct(tally.playing)}`,
            `skor rata2 ${(score / count).toFixed(1)}`,
            `langkah rata2 ${(steps / count).toFixed(1)}`,
            `mati tanpa risk ${diedWithoutRisk}`,
            Object.keys(stops).length ? `stop ${JSON.stringify(stops)}` : "",
        ].join(" | "),
    );
}
