# Wumpus World Simulator

Game grid berbasis browser dari lingkungan klasik **Wumpus World** (AIMA Bab 7). Jelajahi gua gelap hanya dengan **persepsi** (Breeze, Stench, Glitter, Bump, Scream), kumpulkan emas, hindari lubang dan Wumpus — atau tonton **Agen AI** berbasis logika menalar langkah demi langkah.

![Tangkapan layar](img/screenshot.jpg)

## Fitur

- **Mode Bermain** — keyboard (panah/WASD, Spasi, Enter, C, R) dan D-pad sentuh.
- **Mode Agen AI** — agen berbasis pengetahuan (aturan K1–K11) dengan overlay `✓ / P? / W? / P! / W! / →` dan panel **Penalaran** berisi log inferensi, mis. `[K4] Breeze(1,0) ⇒ Pit(2,0) ∨ Pit(1,1)`.
- **Level ber-seed yang pasti bisa diselesaikan** (mulberry32 + validasi 0-1 BFS) dan link share `#mode=normal&seed=48213`.
- Tiga tingkat kesulitan (Mudah 4×4 gaya AIMA, Normal 8×8, Sulit 15×8), skor Klasik (AIMA) atau Arcade.
- Panel persepsi + pesan bahasa manusia, layar akhir yang menjelaskan penyebab kalah, catatan pemain (klik kanan / tekan lama), rekor pribadi.
- Semua grafis pixel art dan suara chiptune dibuat langsung di kode (canvas + Web Audio), tanpa file aset.
- Tema gelap/terang/sistem, mode buta warna, kurangi animasi, responsif sampai 360 px, Bahasa Indonesia & English.

## Menjalankan secara lokal

Butuh Node.js ≥ 20. Tidak ada build step dan tidak ada dependensi runtime.

```bash
npm install
```

```bash
npm start
```

Buka http://localhost:8080. ES Modules tidak berjalan lewat `file://`, jadi selalu pakai server lokal.

| Perintah | Fungsi |
|---|---|
| `npm start` | Server statis lokal (`server.cjs`), port `PORT` atau 8080 |
| `npm test` | Semua tes (`node --test`) |
| `npm run test:coverage` | Tes + laporan cakupan |
| `npm run lint` | ESLint (termasuk aturan batas lapisan) |
| `npm run bench:agent` | Benchmark Agen AI pada seed 1…1000 per mode |
| `node scripts/build-icons.js` | Membuat ulang `img/favicon.svg` dari sprite Wumpus |

## Arsitektur singkat

```
js/engine/  logika murni & deterministik: createGame(config, seed), step(state, action)
js/agent/   agen berbasis pengetahuan: hanya melihat observasi, tidak pernah state.world
js/app/     controller, agent runner, share link, storage, settings
js/ui/      canvas renderer, sprite pixel art, audio sintesis, HUD, input, dialog, i18n
js/main.js  merakit semuanya
```

## Hasil benchmark Agen AI

`npm run bench:agent` (seed 1…1000, skor klasik):

| Mode | Menang | Kalah | Keluar tanpa emas | Skor rata-rata | Mati tanpa keputusan berisiko |
|---|---|---|---|---|---|
| Mudah | 37.5% | 0.0% | 62.5% | 446 | 0 |
| Normal | 60.5% | 39.5% | — | 2302 | 0 |
| Sulit | 77.9% | 22.1% | — | 9423 | 0 |

Di mode Mudah, bila tidak ada petak yang bisa dibuktikan aman, agen memilih pulang dan keluar daripada mengambil risiko. Karena itu tingkat menangnya masih di bawah target 70%, tetapi agen tidak pernah mati di mode ini.
