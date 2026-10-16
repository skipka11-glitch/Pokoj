"""Synthesize the soundtrack (audio.wav) to match the timeline in scene.js."""
import numpy as np, wave

SR, DUR = 48000, 33.0
N = int(SR * DUR)
t = np.arange(N) / SR
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(4)

def env(a, b, fin=.5, fout=.5):
    e = np.clip((t - a) / fin, 0, 1) * np.clip((b - t) / fout, 0, 1)
    return e * e * (3 - 2 * e)

def lowpass(x, k):  # one-pole
    y = np.empty_like(x); acc = 0.0
    for i in range(len(x)):
        acc += k * (x[i] - acc); y[i] = acc
    return y

def put(sig, start, gain=1.0, pan=0.0):
    i = int(start * SR); j = min(N, i + len(sig))
    if j <= i: return
    L[i:j] += sig[:j - i] * gain * (1 - pan) / 2 * 2 ** .5
    R[i:j] += sig[:j - i] * gain * (1 + pan) / 2 * 2 ** .5

def tone(f, d, decay=4.0, harm=(1, .5, .25)):
    tt = np.arange(int(d * SR)) / SR
    s = sum(a * np.sin(2 * np.pi * f * (k + 1) * tt) for k, a in enumerate(harm))
    return s * np.exp(-decay * tt) * np.clip(tt / .004, 0, 1)

def mx(*xs):
    n = max(len(x) for x in xs); out = np.zeros(n)
    for x in xs: out[:len(x)] += x
    return out

def noise_burst(d, k, decay):
    tt = np.arange(int(d * SR)) / SR
    return lowpass(rng.standard_normal(len(tt)), k) * np.exp(-decay * tt) * np.clip(tt / .01, 0, 1)

# --- Scene 1: room tone, slow tired pad, clock ticks
brown = lowpass(rng.standard_normal(N), .02) * 3
room = brown * env(0, 10.1, 1, .4)
pad1 = sum(np.sin(2 * np.pi * f * t + ph) for f, ph in [(110, 0), (164.8, 1), (130.8, 2), (220.6, .5)]) * (0.6 + 0.4 * np.sin(2 * np.pi * .15 * t))
L += (room + pad1 * .05) * env(0, 10.0, 1.5, .5); R += (room * .9 + pad1 * .05) * env(0, 10.0, 1.5, .5)
for s in np.arange(.5, 9.5, 1.0):
    put(tone(2800, .05, 90, (1,)), s, .05, .4)
put(noise_burst(.9, .08, 4) * np.sin(np.linspace(0, np.pi, int(.9 * SR))), 3.1, .5)        # yawn breath
put(mx(tone(2350, .5, 12, (1, .3, .2)), tone(3170, .5, 15, (1,))), 4.55, .06, .3)              # mug lift clink
put(noise_burst(.7, .25, 5) * (1 + .5 * np.sin(np.arange(int(.7 * SR)) / SR * 2 * np.pi * 9)), 5.75, .35)  # sip
put(tone(2350, .5, 12, (1, .3, .2)), 7.8, .07, .3)                                           # mug down
# whoosh into the brain
d = 1.3; tt = np.arange(int(d * SR)) / SR
wh = noise_burst(d, .05, 0) * np.sin(np.pi * tt / d) ** 2
wh = wh * (1 + 2 * tt / d)
put(wh, 9.0, 1.0)
put(tone(55, 2.5, 1.5, (1, .4)), 9.95, .5)  # sub drop on arrival

# --- Scene 2: ethereal pad + events
s2 = env(10.0, 23.0, 1.0, .5)
for f, g in [(130.8, .05), (196, .04), (261.6, .03), (311.1, .025), (392, .02)]:
    L += np.sin(2 * np.pi * f * t + f) * g * s2 * (0.7 + 0.3 * np.sin(2 * np.pi * .23 * t + f))
    R += np.sin(2 * np.pi * f * 1.003 * t) * g * s2 * (0.7 + 0.3 * np.sin(2 * np.pi * .19 * t))
for k, s in enumerate(np.arange(10.6, 22.4, .5)):   # slow arpeggio sparkle
    f = [523.3, 622.3, 784, 932.3][k % 4]
    put(tone(f, .8, 6, (1, .2)), s, .025, -.5 + (k % 4) / 3)
put(mx(tone(98, 1.4, 3, (1, .5)), tone(196, 1.0, 5, (1,))), 10 + 3.5, .3, -.4)    # adenosine docks
for k in range(3):
    put(tone(110, .5, 5, (1,)), 10 + 3.6 + k * 1.1, .12, -.4)                   # sleepy pulses
for s, pan in [(5.6, 0), (6.0, .5), (6.8, -.5)]:                                 # caffeine locks in
    put(mx(tone(880, .6, 9, (1, .5, .3)), tone(1318.5, .5, 10, (1,))), 10 + s, .12, pan)
    put(noise_burst(.12, .5, 40), 10 + s, .25, pan)
for s, pan in [(7.0, 0), (7.6, .5), (9.3, -.5)]:                                 # adenosine bounces off
    tt = np.arange(int(.35 * SR)) / SR
    put(np.sin(2 * np.pi * (300 - 500 * tt) * tt) * np.exp(-9 * tt), 10 + s, .25, pan)
d = .8; tt = np.arange(int(d * SR)) / SR
put(noise_burst(d, .06, 0) * np.sin(np.pi * tt / d) ** 2 * (1 + 3 * tt / d), 22.3, 1.0)   # whoosh out

# --- Scene 3: energetic beat, bright pad, text hits
s3 = env(23.0, 33.0, .1, 1.6)
bpm = 118; beat = 60 / bpm
for k in range(int(10 / beat)):
    st = 23.0 + k * beat
    tt = np.arange(int(.35 * SR)) / SR
    kick = np.sin(2 * np.pi * (45 + 120 * np.exp(-30 * tt)) * tt) * np.exp(-8 * tt)
    put(kick, st, .5 * (1 if st < 31 else .5))
    put(noise_burst(.08, .9, 60), st + beat / 2, .08, .3)
for f, g in [(261.6, .035), (329.6, .03), (392, .03), (523.3, .02), (659.3, .012)]:
    L += np.sin(2 * np.pi * f * t) * g * s3; R += np.sin(2 * np.pi * f * 1.004 * t + 1) * g * s3
put(mx(tone(65.4, 2.0, 2, (1, .5, .3)), noise_burst(.6, .3, 6)), 23.0, .55)          # wake-up impact
for k, f in enumerate([523.3, 659.3, 784, 1046.5]):                               # rising sparkle
    put(tone(f, .7, 5, (1, .3)), 23.15 + k * .07, .08, -.4 + k * .25)
put(tone(784, 1.2, 3, (1, .4, .2)), 24.3, .09)   # line 1
put(mx(tone(1046.5, 1.4, 2.5, (1, .4, .2)), tone(1318.5, 1.4, 2.5, (1,))), 26.6, .09)  # "delays tiredness"

mix = np.stack([L, R], 1)
mix *= (1 - np.clip((t - 32.2) / .8, 0, 1))[:, None]
mix = np.tanh(mix / np.abs(mix).max() * 1.6) * .89
with wave.open('audio.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype('<i2').tobytes())
print('audio.wav', DUR, 's')
