# DAY 01 – reel

`day01.mp4` – 1080×1920, 25 s, 30 fps, 6 scén podľa scenára (hook → AI → práce → ty → finálny vizuál → CTA).
`day01.srt` – titulky voiceoveru (sú aj vypálené vo videu).

Re-render: `python3 render.py` (potrebuje ffmpeg + Pillow).
Vlastné AI práce daj do `works/` (jpg/png) – scéna 3 ich prestrihá, posledná ide do scény 5.

Voiceover: daj `scene1.mp3` … `scene6.mp3` (hlas Bella z Higgsfieldu, jedna nahrávka na scénu) do `vo/` a spusti `python3 render.py` – hlas sa vloží na začiatok každej scény.
