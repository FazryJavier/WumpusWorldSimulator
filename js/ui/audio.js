import { AUDIO_SOURCES } from "./assets.js";

const EVENT_SOUNDS = { bump: "bump", grabbed: "coin", won: "win", invalid: "error" };

/**
 * Efek & musik dengan HTMLAudioElement native. Galat audio tidak pernah menghentikan game:
 * cukup `console.warn` dan lanjut tanpa suara (ARCHITECTURE §8).
 */
export function createAudio() {
    const sounds = {};
    let settings = { musicVolume: 0.2, sfxVolume: 0.6, muted: false };
    let unlocked = false;

    for (const [name, src] of Object.entries(AUDIO_SOURCES)) {
        const el = new Audio();
        el.preload = name === "music" ? "none" : "auto";
        el.src = src;
        el.addEventListener("error", () => console.warn(`audio: failed to load ${src}`), { once: true });
        sounds[name] = el;
    }
    sounds.music.loop = true;

    function safePlay(el) {
        const p = el.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
    }

    function syncMusic() {
        sounds.music.volume = settings.musicVolume;
        if (!unlocked || settings.muted || settings.musicVolume === 0) sounds.music.pause();
        else safePlay(sounds.music);
    }

    return {
        /** Musik baru boleh diputar setelah interaksi pertama (kebijakan autoplay). */
        unlock() {
            if (unlocked) return;
            unlocked = true;
            syncMusic();
        },

        configure(next) {
            settings = { ...settings, ...next };
            syncMusic();
        },

        play(name) {
            const el = sounds[name];
            if (!el || settings.muted || settings.sfxVolume === 0) return;
            el.volume = settings.sfxVolume;
            el.currentTime = 0;
            safePlay(el);
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
