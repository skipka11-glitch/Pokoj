# Kofeín nenahrádza spánok — vertikálne video (1080 × 1920, 25 s)

Finálny výstup: `kofein-nenahradza-spanok_1080x1920.mp4` (30 fps, presne 25,000 s / 750 snímok, AAC, −14 LUFS).

| # | Čas | Záber | Text v obraze | Zdroj |
|---|---|---|---|---|
| 1 | 0,0–4,0 | Nina bojuje s ospalosťou | „Čo robí kofeín v mozgu?“ | `gen/s1_tired.mp4` – image-to-video zo snímky Niny (`refs/s1_input.png`) |
| 2 | 4,0–7,2 | Dúšok kávy → prelet do mozgu | „O niečo neskôr…“ | `src/s2_sip.mp4` (čistá časť pred zapečeným titulkom) |
| 3 | 7,2–11,2 | Adenozín pri receptoroch | „Adenozín“ | `src/s3_adenosine.mp4` |
| 4 | 11,2–16,4 | Kofeín obsadí voľný receptor | „Kofeín“ / „Obsadený receptor“ | `gen/s4_caffeine_v2.mp4` – pregenerované z prvej snímky pôvodného klipu |
| 5 | 16,4–20,6 | Porovnanie väzby a blokovania | „Tlmený signál ospalosti“ | `src/s5_compare.mp4` (zmenšené na 0,81 → rovnaká mierka receptorov ako 3–4) |
| 6 | 20,6–25,0 | Nina je pozornejšia | „Kofeín nenahrádza spánok.“ | `src/s6_alert.mp4` (čistá časť pred zapečeným titulkom) |

Scény 3–5: rovnaký 16:9 pás, rovnaká mierka receptorov a legenda farieb (adenozín fialový, kofeín oranžový).

**Voiceover** (`gen/vo.mp3`, jeden súvislý záznam, ElevenLabs v4, 24,2 s, začína v 0,3 s):
„Je polnoc a Nina bojuje s ospalosťou. Čo robí kofeín v mozgu? Cez deň sa v mozgu hromadí adenozín. Viaže sa na receptory a hlási únavu. Kofeín má podobný tvar a obsadí rovnaké miesto, no receptor nezapne. Adenozín sa nenaviaže a signál ospalosti je tlmený. Nina je bdelejšia, no kofeín nenahrádza spánok.“
Strihy sú posunuté o ≤ 0,4 s oproti cieľovým časom, aby sedeli na časové značky nahrávky.

## Build
```bash
node overlays.mjs   # texty -> overlays/*.png (Playwright)
python3 build.py    # strih, texty, audio -> finálne MP4 (ffmpeg, numpy)
```
