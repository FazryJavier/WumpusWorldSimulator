import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    floorPixels,
    GOLD,
    GOLD_PALETTE,
    mirror,
    PALETTE,
    PIT,
    PIT_PALETTE,
    PLAYER_DOWN,
    PLAYER_LEFT,
    PLAYER_UP,
    rockPixels,
    SPRITE_SIZE,
    toPixels,
    WUMPUS,
    WUMPUS_PALETTE,
} from "../../js/ui/sprites.js";

const MAPS = {
    PLAYER_DOWN: [PLAYER_DOWN, PALETTE],
    PLAYER_UP: [PLAYER_UP, PALETTE],
    PLAYER_LEFT: [PLAYER_LEFT, PALETTE],
    WUMPUS: [WUMPUS, WUMPUS_PALETTE],
    GOLD: [GOLD, GOLD_PALETTE],
    PIT: [PIT, PIT_PALETTE],
};

describe("sprites", () => {
    for (const [name, [map, palette]] of Object.entries(MAPS)) {
        it(`${name} berukuran 16×16 dan hanya memakai warna palet`, () => {
            assert.equal(map.length, SPRITE_SIZE);
            map.forEach((row, y) => assert.equal(row.length, SPRITE_SIZE, `${name} baris ${y}: "${row}"`));
            for (const ch of map.join("")) {
                if (ch !== ".") assert.ok(Object.hasOwn(palette, ch), `${name}: karakter "${ch}" tidak ada di palet`);
            }
        });
    }

    it("mirror membalik baris tanpa mengubah ukuran", () => {
        const flipped = mirror(PLAYER_LEFT);
        assert.equal(flipped[15], [...PLAYER_LEFT[15]].reverse().join(""));
        assert.deepEqual(mirror(flipped), [...PLAYER_LEFT]);
    });

    it("toPixels melewati piksel transparan", () => {
        assert.deepEqual(toPixels(["k.", ".k"], { k: "#000000" }), [
            { x: 0, y: 0, color: "#000000" },
            { x: 1, y: 1, color: "#000000" },
        ]);
    });

    it("tekstur lantai dan batu deterministik dan penuh", () => {
        for (const make of [floorPixels, rockPixels]) {
            const a = make();
            assert.deepEqual(a, make());
            assert.equal(a.length, SPRITE_SIZE);
            assert.ok(a.every((row) => row.length === SPRITE_SIZE && row.every((c) => /^#[0-9a-f]{6}$/.test(c))));
        }
    });
});
