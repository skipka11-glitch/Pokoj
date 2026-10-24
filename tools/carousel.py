"""Carousel „Ako vznikla Mary“ (1080×1350) v štýle referenčného reelu:
vínové pozadie, Playfair Display, kombinácia rovného rezu a kurzívy, biele štítky."""
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

FONT_DIR = "/home/user/Pokoj/fonts/"
ROMAN = FONT_DIR + "PlayfairDisplay_400Regular.ttf"
ITALIC = FONT_DIR + "PlayfairDisplay_400Regular_Italic.ttf"
W, H = 1080, 1350
WINE = (42, 10, 12)
CREAM = (246, 238, 230)
MARGIN = 70


def font(style, px):
    return ImageFont.truetype(ITALIC if style == "i" else ROMAN, px)


def tracked(draw, xy, text, fnt, tracking, fill):
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += fnt.getlength(ch) + tracking
    return x


def headline(draw, xy, lines, px, fill=(255, 255, 255)):
    """lines: zoznam riadkov, riadok = zoznam (text, 'r'|'i')."""
    x0, y = xy
    for line in lines:
        x = x0
        for text, style in line:
            f = font(style, px)
            x = tracked(draw, (x, y), text, f, -px * 0.045, fill)
            x += f.getlength(" ") * 1.1
        y += int(px * 0.95)
    return y


def body(draw, xy, text, px=34, width=W - 2 * MARGIN, fill=CREAM, spacing=1.38):
    f = font("r", px)
    x, y = xy
    line = ""
    for word in text.split():
        trial = (line + " " + word).strip()
        if f.getlength(trial) > width and line:
            draw.text((x, y), line, font=f, fill=fill)
            y += int(px * spacing)
            line = word
        else:
            line = trial
    if line:
        draw.text((x, y), line, font=f, fill=fill)
        y += int(px * spacing)
    return y


def pill(draw, xy, text, px=30):
    f = font("i", px)
    tw = f.getlength(text)
    x, y = xy
    draw.rounded_rectangle((x, y, x + tw + 44, y + px + 26), radius=(px + 26) // 2, fill=(255, 255, 255))
    draw.text((x + 22, y + 8), text, font=f, fill=WINE)


def photo(canvas, path, box, focus=(0.5, 0.5), radius=26):
    x0, y0, x1, y1 = box
    img = Image.open(path).convert("RGB")
    img = ImageOps.fit(img, (x1 - x0, y1 - y0), method=Image.LANCZOS, centering=focus)
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, *img.size), radius=radius, fill=255)
    canvas.paste(img, (x0, y0), mask)


def page_no(draw, n, total):
    f = font("i", 28)
    t = f"{n} / {total}"
    draw.text((W - MARGIN - f.getlength(t), H - 70), t, font=f, fill=(200, 170, 165))


def shade(canvas, top):
    """Tmavý prechod v spodnej časti fotky, aby bol text čitateľný."""
    grad = Image.new("L", (1, H))
    for y in range(H):
        grad.putpixel((0, y), 0 if y < top else min(235, int((y - top) / (H - top) * 330)))
    alpha = grad.resize((W, H))
    layer = Image.new("RGB", (W, H), WINE)
    canvas.paste(layer, (0, 0), alpha)


def slide_photo_text(src, out, n, total, step, title, text, focus=(0.5, 0.5), label=None):
    c = Image.new("RGB", (W, H), WINE)
    photo(c, src, (MARGIN, MARGIN, W - MARGIN, 820), focus)
    d = ImageDraw.Draw(c)
    if label:
        pill(d, (MARGIN + 24, 820 - 80), label)
    d.text((MARGIN, 862), step, font=font("i", 32), fill=(200, 170, 165))
    y = headline(d, (MARGIN, 905), title, 72)
    body(d, (MARGIN, y + 34), text)
    page_no(d, n, total)
    c.save(out, quality=94)


def build(src, out_dir):
    total = 8

    # 1 · obálka
    c = Image.new("RGB", (W, H), WINE)
    photo(c, f"{src}/cover.jpg", (0, 0, W, H), focus=(0.62, 0.3), radius=0)
    shade(c, 640)
    d = ImageDraw.Draw(c)
    pill(d, (MARGIN, 860), "AI casting")
    headline(d, (MARGIN, 940), [[("ako vznikla", "r")], [("AI herečka", "i")]], 112)
    d.text((MARGIN, 1190), "z projektu NOS · epizóda 1", font=font("r", 32), fill=CREAM)
    page_no(d, 1, total)
    c.save(f"{out_dir}/01.jpg", quality=94)

    slide_photo_text(f"{src}/face.jpg", f"{out_dir}/02.jpg", 2, total, "krok 1",
                     [[("tvár", "r"), ("z castingu", "i")]],
                     "Jeden prompt, šesť rôznych fiktívnych žien. Štýl módnych magazínov "
                     "z rokov 2000–2005: filmové zrno, mäkké svetlo, viditeľné póry. Vybrala som Mary.",
                     focus=(0.5, 0.35), label="prompt → 6 tvárí")
    slide_photo_text(f"{src}/outfit.jpg", f"{out_dir}/03.jpg", 3, total, "krok 2",
                     [[("oblečenie", "r"), ("zvlášť", "i")]],
                     "Uniforma vznikla ako samostatná fotka, bez tváre. Tak sa tvár a "
                     "oblečenie nemiešajú a každé sa dá meniť samostatne.",
                     focus=(0.5, 0.15))

    # 4 · character sheet (široký obrázok, iná kompozícia)
    c = Image.new("RGB", (W, H), WINE)
    photo(c, f"{src}/sheet.webp", (MARGIN, 150, W - MARGIN, 150 + int((W - 2 * MARGIN) * 0.75)), focus=(0.5, 0.5))
    d = ImageDraw.Draw(c)
    d.text((MARGIN, 80), "krok 3", font=font("i", 32), fill=(200, 170, 165))
    y = headline(d, (MARGIN, 860), [[("character", "r"), ("sheet", "i")]], 72)
    body(d, (MARGIN, y + 34),
         "Spredu, zozadu a detail tváre. Tvár na celej postave je zámerne prázdna: "
         "AI potom berie tvár iba z detailu a Mary vyzerá v každom zábere rovnako.")
    page_no(d, 4, total)
    c.save(f"{out_dir}/04.jpg", quality=94)

    slide_photo_text(f"{src}/lab.jpg", f"{out_dir}/05.jpg", 5, total, "krok 4",
                     [[("svet", "r"), ("okolo nej", "i")]],
                     "Sterilné biele laboratórium parížskeho parfumérskeho domu. "
                     "Jantárové fľaštičky sú jediná teplá farba v miestnosti.",
                     focus=(0.5, 0.5))
    slide_photo_text(f"{src}/scene.jpg", f"{out_dir}/06.jpg", 6, total, "krok 5",
                     [[("a potom", "r"), ("hrá", "i")]],
                     "Sheet + laboratórium + presný prompt so strihmi, uhlami kamery a "
                     "replikami. Z toho vznikne scéna s hlasom a hereckým výkonom.",
                     focus=(0.62, 0.4), label="Seedance")
    slide_photo_text(f"{src}/fail.jpg", f"{out_dir}/07.jpg", 7, total, "keď AI zlyhá",
                     [[("Mary s tvárou", "r")], [("asistenta", "i")]],
                     "Zlé poradie obrázkov a AI dala Mary tvár Théa. Oprava: vždy iba tie "
                     "postavy, ktoré sú v scéne, a v správnom poradí.",
                     focus=(0.5, 0.3), label="chyba")

    # 8 · výzva
    c = Image.new("RGB", (W, H), WINE)
    d = ImageDraw.Draw(c)
    headline(d, (MARGIN, 330), [[("celá epizóda", "r")], [("NOS", "i"), ("je na profile", "r")]], 96)
    body(d, (MARGIN, 640), "Ulož si tento postup na neskôr a napíš do komentára NOS. "
                           "Keď vyjde epizóda 2, pošlem ti ju medzi prvými.", px=38)
    pill(d, (MARGIN, 860), "ulož si to")
    d.text((MARGIN, H - 140), "@gabi.visualna", font=font("i", 40), fill=(255, 255, 255))
    page_no(d, 8, total)
    c.save(f"{out_dir}/08.jpg", quality=94)


if __name__ == "__main__":
    build(sys.argv[1], sys.argv[2])
