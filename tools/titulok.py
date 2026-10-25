"""Vyrenderuje titulok v štýle referenčného reelu: úzky didonský serif,
malé písmená, tesné rozostupy, kombinácia rovného a kurzívneho rezu."""
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

FONT_DIR = "/home/user/Pokoj/fonts/"
ROMAN = FONT_DIR + "PlayfairDisplay_400Regular.ttf"
ITALIC = FONT_DIR + "PlayfairDisplay_400Regular_Italic.ttf"


def draw_word(draw, xy, text, font, tracking, fill):
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += font.getlength(ch) + tracking
    return x


def render(out, parts, size=(1280, 720), pos=(80, 520), px=76, tracking=-4, shadow=0.55, blur=6):
    """parts: zoznam riadkov, každý riadok je zoznam (text, 'r'|'i')."""
    text_layer = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(text_layer)
    fonts = {"r": ImageFont.truetype(ROMAN, px), "i": ImageFont.truetype(ITALIC, px)}
    x0, y = pos
    for line in parts:
        x = x0
        for text, style in line:
            x = draw_word(draw, (x, y), text, fonts[style], tracking, (255, 255, 255, 255))
            x += fonts[style].getlength(" ") * 0.55
        y += int(px * 0.92)
    # jemný tieň pod textom, aby bol čitateľný na svetlom pozadí
    alpha = text_layer.split()[3]
    shadow_layer = Image.new("RGBA", size, (0, 0, 0, 0))
    shadow_layer.putalpha(alpha.point(lambda a: int(min(255, a * shadow))))
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(blur))
    result = Image.new("RGBA", size, (0, 0, 0, 0))
    result.alpha_composite(shadow_layer, (2, 3))
    result.alpha_composite(text_layer)
    result.save(out)


if __name__ == "__main__":
    out_dir = sys.argv[1]
    # slovo po slove, ako v referencii: najprv rovný rez, potom kurzíva
    render(f"{out_dir}/t1.png", [[("10 minutes", "r")]])
    render(f"{out_dir}/t2.png", [[("10 minutes", "r")], [("earlier", "i")]], pos=(80, 520))
