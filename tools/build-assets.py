"""Builds the site's self-hosted font subset and the portrait asset.

Chinese webfonts are ~11 MB per weight, so the site ships a subset that covers
every character actually used by the pages, plus every character in the source
PDFs (a natural superset for later copy edits).

Regenerate after changing page copy:
    python tools/build-assets.py
"""

import os

import pymupdf
from fontTools import subset
from PIL import Image

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(BASE, "assets")
FONT_OUT = os.path.join(ASSETS, "fonts")
os.makedirs(FONT_OUT, exist_ok=True)

FONT_SOURCES = {
    "NotoSerifSC-Regular.woff2": "NotoSerifSC-Regular.otf",
    "NotoSerifSC-SemiBold.woff2": "NotoSerifSC-SemiBold.otf",
}
FONT_SOURCE_DIR = os.environ.get("SMIND_FONT_SRC", os.path.join(os.environ.get("TEMP", "/tmp"), "hanserif"))

PAGES = ("index.html", "portfolio.html", "css/style.css", "js/main.js")
PDFS = ("王琪  个人简历.pdf", "77个人作品集🆕(1).pdf")

EXTRA = (
    "0123456789"
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "abcdefghijklmnopqrstuvwxyz"
    " .,:;!?()[]{}<>/\\|-–—_+=*&%$#@~`'\""
    "·、。，；：？！（）【】《》“”‘’…—～×÷°※"
    # 空格族：页面用 &nbsp; 控制间距，缺了它会回退到系统字体、字宽不一致
    "\u00a0\u2002\u2003\u2009\u202f\ufeff"
)


def collect_characters():
    characters = set(EXTRA)
    for relative in PAGES:
        path = os.path.join(BASE, relative)
        if os.path.exists(path):
            with open(path, encoding="utf-8") as handle:
                characters.update(handle.read())
    for name in PDFS:
        path = os.path.join(BASE, name)
        if not os.path.exists(path):
            continue
        document = pymupdf.open(path)
        for page in document:
            characters.update(page.get_text())
        document.close()
    return {character for character in characters if character.isprintable() and character.strip() != "" or character == " "}


# fontTools 的子集器会丢掉 U+00A0（不换行空格）和 U+3000（全角空格）这类
# “非标准”空白字符的 cmap 映射。页面用 &nbsp; 控制间距时，缺了映射这些字符
# 会回退到系统字体、字宽与正文不一致，所以这里把源字体的映射补回来。
PRESERVE_CODEPOINTS = (0x00A0, 0x3000)


def restore_whitespace(font, source_cmap):
    """Re-add cmap entries the subsetter normalises away."""
    available = set(font.getGlyphOrder())
    restored = []
    for codepoint in PRESERVE_CODEPOINTS:
        glyph = source_cmap.get(codepoint)
        if not glyph or glyph not in available:
            continue
        for table in font["cmap"].tables:
            if table.isUnicode() and codepoint not in table.cmap:
                table.cmap[codepoint] = glyph
                restored.append(codepoint)
    return restored


def build_fonts(characters):
    text = "".join(sorted(characters))
    print(f"subset covers {len(text)} unique characters")
    for output_name, source_name in FONT_SOURCES.items():
        source = os.path.join(FONT_SOURCE_DIR, source_name)
        if not os.path.exists(source):
            print(f"  SKIP {output_name}: source font not found at {source}")
            continue
        options = subset.Options()
        options.flavor = "woff2"
        options.layout_features = ["*"]
        options.drop_tables += ["DSIG"]
        options.notdef_outline = True
        options.recalc_bounds = True

        font = subset.load_font(source, options)
        source_cmap = font.getBestCmap()
        subsetter = subset.Subsetter(options=options)
        subsetter.populate(text=text)
        subsetter.subset(font)
        restored = restore_whitespace(font, source_cmap)
        target = os.path.join(FONT_OUT, output_name)
        subset.save_font(font, target, options)
        font.close()
        note = "，补回空白映射 " + " ".join(f"U+{cp:04X}" for cp in restored) if restored else ""
        print(f"  {output_name}: {os.path.getsize(target) / 1024:.1f} KB  (from {os.path.getsize(source) / 1024 / 1024:.1f} MB){note}")


def build_portrait():
    source = os.path.join(ASSETS, "candidate-portfolio-50.png")
    if not os.path.exists(source):
        print("portrait source missing, skipping")
        return
    image = Image.open(source).convert("RGB")
    target = os.path.join(ASSETS, "portrait.jpg")
    image.save(target, format="JPEG", quality=90, optimize=True, progressive=True)
    print(f"portrait: {image.width}x{image.height} -> {os.path.getsize(target) / 1024:.1f} KB")
    image.close()


def clean_candidates():
    removed = 0
    for name in os.listdir(ASSETS):
        if name.startswith("candidate-"):
            os.remove(os.path.join(ASSETS, name))
            removed += 1
    print(f"removed {removed} candidate files")


build_fonts(collect_characters())
build_portrait()
clean_candidates()
print("done ->", ASSETS)
