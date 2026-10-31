// Semua suara disintesis dengan Web Audio API: tidak ada file audio.

/** Nada efek: [frekuensi Hz, mulai detik, durasi detik]. */
export const SFX = Object.freeze({
    coin: { wave: "square", notes: [[988, 0, 0.08], [1319, 0.08, 0.22]], gain: 0.25 },
    win: { wave: "square", notes: [[523, 0, 0.12], [659, 0.12, 0.12], [784, 0.24, 0.12], [1047, 0.36, 0.4]], gain: 0.25 },
    lose: { wave: "triangle", notes: [[392, 0, 0.2], [330, 0.2, 0.2], [262, 0.4, 0.2], [196, 0.6, 0.6]], gain: 0.4 },
    error: { wave: "square", notes: [[140, 0, 0.15]], gain: 0.2 },
    bump: { wave: "sine", notes: [[90, 0, 0.18]], gain: 0.7, slideTo: 50 },
    arrow: { wave: "sawtooth", notes: [[880, 0, 0.22]], gain: 0.18, slideTo: 220 },
});

// Musik latar: bas pelan + melodi pentatonik minor A (gua yang tenang), diulang tiap 16 ketukan.
const BEAT = 0.42;
const BASS = [110, 110, 98, 98, 87.31, 87.31, 98, 98];
const MELODY = [440, 0, 523.25, 0, 587.33, 523.25, 0, 440, 392, 0, 440, 0, 329.63, 0, 392, 0];
const LOOKAHEAD_S = 0.6;
const TICK_MS = 150;

const EVENT_SOUNDS = { bump: "bump", grabbed: "coin", won: "win", invalid: "error" };

/**
 * Efek & musik. Galat audio tidak pernah menghentikan game (ARCHITECTURE §8).
 * AudioContext baru dibuat setelah interaksi pertama (kebijakan autoplay browser).
 */
export function createAudio() {
    let settings = { musicVolume: 0.2, sfxVolume: 0.6, muted: false };
    let ctx = null;
    let sfxBus = null;
    let musicBus = null;
    let musicTimer = null;
    let nextBeatTime = 0;
    let beat = 0;

    function tone(bus, wave, freq, start, duration, peak, slideTo) {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = wave;
        osc.frequency.setValueAtTime(freq, start);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
        env.gain.setValueAtTime(0.0001, start);
        env.gain.exponentialRampToValueAtTime(peak, start + 0.01);
        env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc.connect(env).connect(bus);
        osc.start(start);
        osc.stop(start + duration + 0.02);
    }

    function scheduleMusic() {
        while (nextBeatTime < ctx.currentTime + LOOKAHEAD_S) {
            const step = beat % MELODY.length;
            if (step % 2 === 0) tone(musicBus, "triangle", BASS[(step / 2) % BASS.length], nextBeatTime, BEAT * 1.9, 0.5);
            if (MELODY[step]) tone(musicBus, "sine", MELODY[step], nextBeatTime, BEAT * 0.9, 0.18);
            nextBeatTime += BEAT;
            beat++;
        }
    }

    function syncVolumes() {
        if (!ctx) return;
        const now = ctx.currentTime;
        sfxBus.gain.setTargetAtTime(settings.muted ? 0 : settings.sfxVolume, now, 0.02);
        musicBus.gain.setTargetAtTime(settings.muted ? 0 : settings.musicVolume * 0.5, now, 0.1);
        const wantMusic = !settings.muted && settings.musicVolume > 0;
        if (wantMusic && musicTimer === null) {
            nextBeatTime = ctx.currentTime + 0.1;
            scheduleMusic();
            musicTimer = setInterval(scheduleMusic, TICK_MS);
        } else if (!wantMusic && musicTimer !== null) {
            clearInterval(musicTimer);
            musicTimer = null;
        }
    }

    return {
        unlock() {
            if (ctx) return;
            const AudioCtx = window.AudioContext ?? window.webkitAudioContext;
            if (!AudioCtx) {
                console.warn("audio: Web Audio API not supported");
                return;
            }
            try {
                ctx = new AudioCtx();
                sfxBus = ctx.createGain();
                musicBus = ctx.createGain();
                sfxBus.connect(ctx.destination);
                musicBus.connect(ctx.destination);
                syncVolumes();
            } catch (err) {
                console.warn("audio: failed to start", err);
                ctx = null;
            }
        },

        configure(next) {
            settings = { ...settings, ...next };
            syncVolumes();
        },

        play(name) {
            const sfx = SFX[name];
            if (!ctx || !sfx || settings.muted || settings.sfxVolume === 0) return;
            const t0 = ctx.currentTime;
            for (const [freq, at, dur] of sfx.notes) tone(sfxBus, sfx.wave, freq, t0 + at, dur, sfx.gain, sfx.slideTo);
        },

        /** Memutar efek yang sesuai untuk event engine. */
        playEvents(events) {
            for (const event of events) {
                if (event.type === "shot") this.play("arrow");
                else if (event.type === "died") this.play("lose");
                else if (EVENT_SOUNDS[event.type]) this.play(EVENT_SOUNDS[event.type]);
            }
        },
    };
}
