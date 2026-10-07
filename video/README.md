# DAY 01 – reel

`day01.mp4` – 1080×1920, 48,6 s, 30 fps, 6 scén podľa scenára (hook → AI → práce → ty → finálny vizuál → CTA).

Re-render: `python3 render.py` (potrebuje ffmpeg + Pillow).
Vlastné AI práce daj do `works/` (jpg/png) – scéna 3 ich prestrihá, posledná ide do scény 5.

Voiceover: daj `scene1.mp3` … `scene6.mp3` (hlas Bella z Higgsfieldu, jedna nahrávka na scénu) do `vo/` a spusti `python3 render.py` – hlas sa vloží na začiatok každej scény.

Aktuálne video používa `vo/bella_full.mp3` (celý voiceover, ElevenLabs Bella); strihy scén sú v `T` v render.py podľa páuz v nahrávke. Titulky voiceoveru pridaj cez automatické titulky v Instagrame/CapCute.
