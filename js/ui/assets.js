const TIMEOUT_MS = 10_000;

export const IMAGE_SOURCES = Object.freeze({
    floor: "img/floor.png",
    wall: "img/wall.png",
    pit: "img/hole.png",
    gold: "img/gold.png",
    wumpus: "img/wumpus.png",
    up: "img/player_facing_to_up.png",
    down: "img/player_facing_to_down.png",
    left: "img/player_facing_to_left.png",
    right: "img/player_facing_to_right.png",
});

export const AUDIO_SOURCES = Object.freeze({
    music: "audio/background.mp3",
    arrow: "audio/arrow.wav",
    bump: "audio/bump.wav",
    coin: "audio/coin.wav",
    error: "audio/error.mp3",
    lose: "audio/game-over.wav",
    win: "audio/win.wav",
});

function withTimeout(promise, label) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timed out loading ${label}`)), TIMEOUT_MS);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function loadImage(src) {
    return withTimeout(
        new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Failed to load ${src}`));
            img.src = src;
        }),
        src,
    );
}

/**
 * Memuat semua sprite. Galat dilempar agar UI bisa menampilkan layar galat (ARCHITECTURE §8).
 * @returns {Promise<Record<string, HTMLImageElement>>}
 */
export async function loadImages() {
    const entries = await Promise.all(
        Object.entries(IMAGE_SOURCES).map(async ([name, src]) => [name, await loadImage(src)]),
    );
    return Object.fromEntries(entries);
}
