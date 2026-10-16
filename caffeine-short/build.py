"""Assemble the 25 s vertical (1080x1920) caffeine short from the source clips.

Steps: per-scene 9:16 segments -> concat -> timed text overlays -> voiceover + music bed.
Run:  python3 build.py   (needs ffmpeg, numpy; overlays/ from `node overlays.mjs`)
"""
import subprocess, wave, os
import numpy as np

ROOT = os.path.dirname(os.path.abspath(__file__))
SEG = os.path.join(ROOT, 'build'); os.makedirs(SEG, exist_ok=True)
FPS, W, H = 30, 1080, 1920
BAND_Y = 560  # top of the 16:9 band used for the molecular scenes

def ff(*args):
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *args], check=True)

def p(*parts):
    return os.path.join(ROOT, *parts)

ENC = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '12', '-pix_fmt', 'yuv420p', '-an']

def full_bleed(cx):
    """Scale 16:9 to 1920 px tall, crop a 1080 px window centred on source x = cx."""
    x = int(cx * H / 1080 - W / 2)
    return f'scale=-2:{H},crop={W}:{H}:{x}:0,setsar=1'

def band(src_chain, scale_w=W):
    """Blurred full-frame background + sharp 16:9 band; scale_w < W keeps receptor scale."""
    h = round(scale_w * 9 / 16 / 2) * 2
    x, y = (W - scale_w) // 2, BAND_Y + (608 - h) // 2
    return (f'{src_chain},split[a][b];'
            f'[a]scale=-2:{H},crop={W}:{H},boxblur=40:2,eq=brightness=-0.13:saturation=0.85[bg];'
            f'[b]scale={scale_w}:{h}[fg];[bg][fg]overlay={x}:{y},setsar=1')

def seg(name, src, chain, frames):
    out = os.path.join(SEG, f'{name}.mp4')
    ff('-i', src, '-filter_complex', f'[0:v]{chain},fps={FPS},tpad=stop_mode=clone:stop_duration=2[v]',
       '-map', '[v]', '-frames:v', str(frames), *ENC, out)
    return out

# ---- scene segments (frame counts sum to 750 = 25.000 s) ---------------------------------
segs = []
# 1 · 0.0–4.0  Nina fights sleepiness (generated from a still of the sip clip)
segs.append(seg('s1', p('gen', 's1_tired.mp4'), f'trim=1.0:5.0,setpts=PTS-STARTPTS,{full_bleed(1060)}', 120))
# 2 · 4.0–7.2  the sip (clean part before the baked-in caption), dissolving into the brain zoom
out = os.path.join(SEG, 's2.mp4')
ff('-i', p('src', 's2_sip.mp4'), '-filter_complex',
   f'[0:v]split[x][y];'
   f'[x]trim=0:1.95,setpts=(PTS-STARTPTS)/0.75,fps={FPS},{full_bleed(950)}[a];'
   f'[y]trim=3.35:4.0,setpts=(PTS-STARTPTS)/0.75,fps={FPS},{full_bleed(960)}[b];'
   f'[a][b]xfade=transition=fade:duration=0.27:offset=2.33,tpad=stop_mode=clone:stop_duration=1[v]',
   '-map', '[v]', '-frames:v', '96', *ENC, out)
segs.append(out)
# 3 · 7.2–11.2  adenosine binds
segs.append(seg('s3', p('src', 's3_adenosine.mp4'), band('trim=0:4.0,setpts=PTS-STARTPTS'), 120))
# 4 · 11.2–16.4  caffeine takes the same pocket; adenosine is turned away (regenerated)
segs.append(seg('s4', p('gen', 's4_caffeine_v2.mp4'), band('trim=0.4:5.6,setpts=PTS-STARTPTS'), 156))
# 5 · 16.4–20.6  bound vs. blocked; scaled to 0.81 so receptors match scenes 3–4
segs.append(seg('s5', p('src', 's5_compare.mp4'), band('setpts=PTS/0.945', scale_w=876), 126))
# 6 · 20.6–25.0  Nina is more alert (clean part before the baked-in caption)
segs.append(seg('s6', p('src', 's6_alert.mp4'), f'trim=0:3.75,setpts=(PTS-STARTPTS)/0.852,{full_bleed(900)}', 132))

with open(os.path.join(SEG, 'list.txt'), 'w') as f:
    f.writelines(f"file '{s}'\n" for s in segs)
ff('-f', 'concat', '-safe', '0', '-i', os.path.join(SEG, 'list.txt'), '-c', 'copy', os.path.join(SEG, 'picture.mp4'))

# ---- text overlays: (png, start, end) — fade 0.3 s, slide up 40 px on entry ---------------
OVERLAYS = [
    ('t1', 0.6, 3.9), ('t2', 4.4, 7.05),
    ('legend', 7.5, 20.45), ('t3', 7.5, 11.05),
    ('t4a', 11.4, 16.3), ('t4b', 13.0, 16.3),
    ('t5', 16.7, 20.45), ('t6', 21.3, 25.0),
]

# ---- audio: one continuous voiceover take + synthesized bed --------------------------------
SR, DUR = 48000, 25.0
N = int(SR * DUR); t = np.arange(N) / SR
rng = np.random.default_rng(3)
def env(a, b, fin, fout):
    e = np.clip((t - a) / fin, 0, 1) * np.clip((b - t) / fout, 0, 1); return e * e * (3 - 2 * e)
def lp(x, k):
    y = np.empty_like(x); acc = 0.0
    for i in range(len(x)): acc += k * (x[i] - acc); y[i] = acc
    return y
L = np.zeros(N); R = np.zeros(N)
def chord(freqs, a, b, gain, fin=1.0, fout=1.0, det=1.003):
    e = env(a, b, fin, fout)
    for k, f in enumerate(freqs):
        L[:] += np.sin(2 * np.pi * f * t + k) * gain * e * (0.75 + 0.25 * np.sin(2 * np.pi * .21 * t + k))
        R[:] += np.sin(2 * np.pi * f * det * t + 2 * k) * gain * e * (0.75 + 0.25 * np.sin(2 * np.pi * .17 * t + k))
def put(sig, st, g, pan=0.0):
    i = int(st * SR); j = min(N, i + len(sig)); L[i:j] += sig[:j - i] * g * (1 - pan); R[i:j] += sig[:j - i] * g * (1 + pan)
def tone(f, d, dec, h=(1, .4, .2)):
    tt = np.arange(int(d * SR)) / SR
    return sum(a * np.sin(2 * np.pi * f * (n + 1) * tt) for n, a in enumerate(h)) * np.exp(-dec * tt) * np.clip(tt / .005, 0, 1)
room = lp(rng.standard_normal(N), .015) * 2.0
L += room * env(0, 7.3, .6, .4); R += room * env(0, 7.3, .6, .4)
chord([110, 130.8, 164.8], 0, 7.4, .045, 1.2, .5)                      # tired, minor
chord([196, 246.9, 293.7, 392], 7.0, 20.8, .03, .6, .6)                  # molecular shimmer
chord([261.6, 329.6, 392, 523.3], 20.4, 25.0, .04, .5, .6)             # alert, major
for k, s in enumerate(np.arange(7.4, 20.4, .5)):
    put(tone([784, 987.8, 1174.7, 1568][k % 4], .7, 7, (1, .2)), s, .012, -.4 + (k % 4) * .27)
d = 0.9; tt = np.arange(int(d * SR)) / SR                                  # whoosh into the brain
put(lp(rng.standard_normal(len(tt)), .07) * np.sin(np.pi * tt / d) ** 2 * (1 + 2 * tt / d), 6.5, .5)
put(tone(98, 1.2, 3, (1, .5)), 8.6, .12, -.2)                              # adenosine docks
put(tone(880, .6, 9) + 0, 12.8, .06)                                        # caffeine settles
put(np.sin(2 * np.pi * (320 - 520 * tt[:int(.35 * SR)]) * tt[:int(.35 * SR)]) * np.exp(-9 * tt[:int(.35 * SR)]), 14.8, .09)  # adenosine bounces off
put(tone(1046.5, 1.6, 2.2) , 21.3, .05)                                     # takeaway chime
bed = np.stack([L, R], 1); bed *= (1 - np.clip((t - 24.4) / .6, 0, 1))[:, None]
bed = bed / np.abs(bed).max() * .5
with wave.open(os.path.join(SEG, 'bed.wav'), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((bed * 32767).astype('<i2').tobytes())

# ---- final composite -------------------------------------------------------------------------
inputs = ['-i', os.path.join(SEG, 'picture.mp4')]
for name, a, b in OVERLAYS:
    inputs += ['-loop', '1', '-framerate', str(FPS), '-t', str(DUR), '-i', p('overlays', f'{name}.png')]
inputs += ['-i', p('gen', 'vo.mp3'), '-i', os.path.join(SEG, 'bed.wav')]
fc, last = [], '[0:v]'
for i, (name, a, b) in enumerate(OVERLAYS, start=1):
    fc.append(f'[{i}:v]format=rgba,fade=t=in:st={a}:d=0.3:alpha=1,fade=t=out:st={b - 0.3}:d=0.3:alpha=1[o{i}]')
    y = f"if(lt(t\\,{a}+0.45)\\,40*pow(1-max(0\\,t-{a})/0.45\\,2)\\,0)"
    fc.append(f"{last}[o{i}]overlay=x=0:y='{y}':enable='between(t,{a},{b})'[v{i}]")
    last = f'[v{i}]'
fc.append(f'{last}fade=t=out:st={DUR - 0.35}:d=0.35,format=yuv420p[vout]')
na = len(OVERLAYS) + 1
fc.append(f'[{na}:a]aresample=48000,adelay=300|300,apad,volume=1.0[vo];'
          f'[{na + 1}:a]volume=0.55[bd];'
          f'[bd][vo]sidechaincompress=threshold=0.04:ratio=4:attack=20:release=300[duck];'
          f'[duck][vo]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11,atrim=0:{DUR},afade=t=out:st={DUR - 0.4}:d=0.4[aout]')
# sidechaincompress consumes [vo]; split it first
fc[-1] = fc[-1].replace('apad,volume=1.0[vo];', 'apad,volume=1.0,asplit[vo][vosc];').replace('[bd][vo]sidechain', '[bd][vosc]sidechain')
ff(*inputs, '-filter_complex', ';'.join(fc), '-map', '[vout]', '-map', '[aout]',
   '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-r', str(FPS), '-frames:v', str(int(DUR * FPS)),
   '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', str(DUR), '-movflags', '+faststart',
   p('kofein-nenahradza-spanok_1080x1920.mp4'))
print('done')
