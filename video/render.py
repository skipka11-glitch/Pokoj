"""Render the DAY 01 reel (1080x1920, 25 s) from stills in source/ (+ optional works/).

Usage: python3 render.py   ->  day01.mp4 + day01.srt
Put your strongest AI works (jpg/png) into works/ – scene 3 cuts through them
and the last one is used as the final campaign visual in scene 5. Without them,
crops of the laptop screen from source/2.jpg are used.
"""
import glob, os, subprocess
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageEnhance

HERE = os.path.dirname(os.path.abspath(__file__))
W, H, FPS = 1080, 1920, 30
FONT = "/usr/share/fonts/opentype/inter/Inter-SemiBold.otf"
FONT_B = "/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf"
FONT_L = "/usr/share/fonts/opentype/inter/Inter-Medium.otf"
UI_CROP = 210  # bottom video-player bar on the screenshots


def load(name, ui=True):
    im = Image.open(os.path.join(HERE, "source", name)).convert("RGB")
    if ui:
        im = im.crop((0, 0, im.width, im.height - UI_CROP))
    return im


def grade(im):
    im = ImageEnhance.Contrast(im).enhance(1.06)
    return ImageEnhance.Color(im).enhance(0.92)


def cover(im, t, z0=1.0, z1=1.08, cx0=0.5, cy0=0.5, cx1=0.5, cy1=0.5):
    """Ken Burns: slow zoom/pan, t in 0..1."""
    e = t * t * (3 - 2 * t)
    z = z0 + (z1 - z0) * e
    cx = cx0 + (cx1 - cx0) * e
    cy = cy0 + (cy1 - cy0) * e
    base = max(W / im.width, H / im.height) * z
    cw, ch = W / base, H / base
    x = min(max(cx * im.width - cw / 2, 0), im.width - cw)
    y = min(max(cy * im.height - ch / 2, 0), im.height - ch)
    return im.resize((W, H), Image.LANCZOS, box=(x, y, x + cw, y + ch))


def card(art, t, z0=1.0, z1=1.05):
    """Artwork centred on a blurred copy of itself."""
    bg = cover(art, 0, 1.2).filter(ImageFilter.GaussianBlur(40))
    bg = ImageEnhance.Brightness(bg).enhance(0.55)
    e = t * t * (3 - 2 * t)
    z = z0 + (z1 - z0) * e
    s = min(W * 0.82 / art.width, H * 0.68 / art.height) * z
    a = art.resize((int(art.width * s), int(art.height * s)), Image.LANCZOS)
    sh = Image.new("RGBA", (a.width + 80, a.height + 80), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rectangle((40, 40, a.width + 40, a.height + 40), fill=(0, 0, 0, 150))
    sh = sh.filter(ImageFilter.GaussianBlur(24))
    x, y = (W - a.width) // 2, int((H - a.height) * 0.42)
    bg.paste(sh, (x - 40, y - 20), sh)
    bg.paste(a, (x, y))
    return bg


# ---------- assets ----------
S1, S2, S3, S4, S5 = (load("1.jpg"), load("2.jpg", ui=False), load("3.jpg"),
                      load("4.jpg"), load("5.jpg"))
works = [Image.open(p).convert("RGB") for p in sorted(
    glob.glob(os.path.join(HERE, "works", "*.jpg")) +
    glob.glob(os.path.join(HERE, "works", "*.jpeg")) +
    glob.glob(os.path.join(HERE, "works", "*.png")))]
user_works = bool(works)
if not works:
    def scr(box):
        return ImageEnhance.Brightness(ImageEnhance.Sharpness(S2.crop(box)).enhance(1.3)).enhance(0.9)
    left, right = scr((215, 500, 300, 692)), scr((338, 465, 447, 690))
    works = [left, right, scr((215, 500, 300, 600)), scr((338, 465, 447, 580))]
    final_visual = right
else:
    final_visual = works[-1]

# ---------- your works on the laptop screen (scene 2) ----------
SCREEN = [(52, 512), (488, 415), (542, 652), (150, 783)]  # TL, TR, BR, BL in source/2.jpg


def persp_coeffs(src, dst):
    import numpy as np
    A, B = [], []
    for (x, y), (u, v) in zip(dst, src):
        A += [[x, y, 1, 0, 0, 0, -u * x, -u * y], [0, 0, 0, x, y, 1, -v * x, -v * y]]
        B += [u, v]
    return np.linalg.solve(np.array(A, float), np.array(B, float)).tolist()


def put_on_screen(photo, arts):
    sw, sh = 1600, 1000
    scr = Image.new("RGB", (sw, sh), (244, 242, 240))
    gap = 40
    cw = (sw - gap * (len(arts) + 1)) // len(arts)
    for i, a in enumerate(arts):
        s = min(cw / a.width, (sh - 140) / a.height)
        t = a.resize((int(a.width * s), int(a.height * s)), Image.LANCZOS)
        scr.paste(t, (gap + i * (cw + gap) + (cw - t.width) // 2, (sh - 60 - t.height) // 2))
    ImageDraw.Draw(scr).rectangle((0, sh - 46, sw, sh), fill=(226, 228, 233))  # taskbar
    scr = ImageEnhance.Brightness(scr).enhance(1.05).filter(ImageFilter.GaussianBlur(1.2))
    ss = 3  # supersample for clean edges
    big = photo.resize((photo.width * ss, photo.height * ss), Image.LANCZOS)
    quad = [(x * ss, y * ss) for x, y in SCREEN]
    warped = scr.transform(big.size, Image.PERSPECTIVE,
                           persp_coeffs([(0, 0), (sw, 0), (sw, sh), (0, sh)], quad), Image.BICUBIC)
    mask = Image.new("L", big.size, 0)
    ImageDraw.Draw(mask).polygon(quad, fill=255)
    big.paste(warped, (0, 0), mask.filter(ImageFilter.GaussianBlur(ss)))
    return big.resize(photo.size, Image.LANCZOS)


if user_works:
    S2 = put_on_screen(S2, works[:3])

# ---------- timeline (seconds) ----------
shots = [  # (start, end, frame_fn(t))
    (0, 2, lambda t: cover(S3, t, 1.02, 1.10, 0.52, 0.45, 0.55, 0.42)),
    (2, 6, lambda t: cover(S2, t, 1.0, 1.9, 0.45, 0.45, 0.30, 0.37)),
]
n = len(works[:4])
seg = 5 / n
for i, w in enumerate(works[:4]):
    shots.append((6 + i * seg, 6 + (i + 1) * seg, lambda t, w=w: card(w, t)))
shots += [
    (11, 13.5, lambda t: cover(S5, t, 1.05, 1.15, 0.55, 0.42, 0.52, 0.45)),
    (13.5, 16, lambda t: cover(S1, t, 1.10, 1.03, 0.50, 0.40, 0.50, 0.42)),
    (16, 21, lambda t: card(final_visual, t, 1.0, 1.08)),
    (21, 25, lambda t: cover(S4, t, 1.0, 1.06, 0.55, 0.45, 0.55, 0.43)),
]

# on-screen titles: (start, end, text, y, size, font)
titles = [
    (0.15, 2.0, "Začínam prakticky\nod nuly.", 330, 86, FONT_B),
    (2.6, 6.0, "AI → tvorba → niečo vlastné", 300, 62, FONT_B),
    (12.0, 16.0, "A práve preto\nzačínam teraz.", 330, 82, FONT_B),
    (21.4, 25.0, "DAY 01", 300, 150, FONT_B),
    (21.9, 25.0, "building something of my own with AI", 480, 46, FONT_L),
]
# voiceover captions
captions = [
    (0.0, 2.0, "Neviem, kam ma toto dostane. Ale chcem to skúsiť."),
    (2.0, 4.0, "Učím sa tvoriť s AI a posledné mesiace zisťujem,"),
    (4.0, 6.0, "že toto už pre mňa nie je len hranie sa s obrázkami."),
    (6.0, 8.5, "Chcem zistiť, či sa dá z jedného nápadu, notebooku a kreativity"),
    (8.5, 11.0, "postupne vybudovať skutočná práca."),
    (11.0, 13.5, "Nemám obrovské publikum. Nemám veľký tím."),
    (13.5, 16.0, "A úprimne, ešte veľa vecí neviem."),
    (16.0, 18.5, "Budem tu ukazovať celý proces."),
    (18.5, 21.0, "Aj to, čo funguje. Aj to, čo vôbec nefunguje."),
    (21.0, 23.0, "Takže toto je deň jeden. Uvidíme, kam sa dostanem."),
    (23.0, 25.0, "Ak chceš vidieť, kam sa to posunie, zostaň."),
]
DUR = 25


def wrap(draw, text, font, maxw):
    out = []
    for para in text.split("\n"):
        line = ""
        for word in para.split():
            test = (line + " " + word).strip()
            if draw.textlength(test, font=font) <= maxw:
                line = test
            else:
                out.append(line)
                line = word
        out.append(line)
    return out


def text_layer(frame, text, y, size, fontpath, alpha, box=False):
    font = ImageFont.truetype(fontpath, size)
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    lines = wrap(d, text, font, W - 160)
    lh = int(size * 1.18)
    if box:
        widths = [d.textlength(l, font=font) for l in lines]
        bw = max(widths) + 60
        d.rounded_rectangle(((W - bw) / 2, y - 22, (W + bw) / 2, y + lh * len(lines) + 10),
                            radius=22, fill=(0, 0, 0, int(140 * alpha)))
    else:
        sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        sd = ImageDraw.Draw(sh)
        for i, l in enumerate(lines):
            sd.text((W / 2, y + i * lh + 4), l, font=font, fill=(0, 0, 0, int(170 * alpha)), anchor="ma")
        layer = Image.alpha_composite(layer, sh.filter(ImageFilter.GaussianBlur(10)))
        d = ImageDraw.Draw(layer)
    for i, l in enumerate(lines):
        d.text((W / 2, y + i * lh), l, font=font, fill=(255, 255, 255, int(255 * alpha)), anchor="ma")
    return Image.alpha_composite(frame, layer)


def fade(t, a, b, f=0.35):
    if t < a or t > b:
        return 0
    return max(0, min(1, (t - a) / f, (b - t) / f))


def frame_at(t):
    for i, (a, b, fn) in enumerate(shots):
        if a <= t < b or (i == len(shots) - 1 and t >= a):
            img = grade(fn((t - a) / (b - a)))
            # soft cross-dissolve into next shot
            if i + 1 < len(shots) and t > b - 0.2:
                na, nb, nfn = shots[i + 1]
                img = Image.blend(img, grade(nfn(0)), (t - (b - 0.2)) / 0.2)
            break
    img = img.convert("RGBA")
    for a, b, txt, y, size, fp in titles:
        al = fade(t, a, b)
        if al:
            img = text_layer(img, txt, y, size, fp, al)
    for a, b, txt in captions:
        al = fade(t, a, b, 0.12)
        if al:
            img = text_layer(img, txt, 1480, 48, FONT, al, box=True)
    # gentle fade from/to black
    k = min(1, t / 0.3, (DUR - t) / 0.5)
    if k < 1:
        img = Image.blend(Image.new("RGBA", (W, H), (0, 0, 0, 255)), img, max(k, 0))
    return img.convert("RGB")


def srt():
    def ts(s):
        ms = int(round(s * 1000))
        return f"{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02},{ms % 1000:03}"
    with open(os.path.join(HERE, "day01.srt"), "w", encoding="utf-8") as f:
        for i, (a, b, txt) in enumerate(captions, 1):
            f.write(f"{i}\n{ts(a)} --> {ts(b)}\n{txt}\n\n")


if __name__ == "__main__":
    srt()
    out = os.path.join(HERE, "day01.mp4")
    p = subprocess.Popen([
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
        "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
        "-shortest", "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", out], stdin=subprocess.PIPE)
    for i in range(DUR * FPS):
        p.stdin.write(frame_at(i / FPS).tobytes())
    p.stdin.close()
    p.wait()
    print("wrote", out)
