"""Renders the portfolio PDF into the responsive WebP images used by portfolio.html.

Put the source PDF (77个人作品集*.pdf) back into the project root, then run:

    pip install pymupdf pillow
    python tools/render-portfolio.py

Output: assets/portfolio/NN-w.webp (1600px) and NN-s.webp (900px)
"""

import glob
import os

import pymupdf
from PIL import Image

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, "assets", "portfolio")

# Two responsive widths; phones pick the small one through srcset.
VARIANTS = (("w", 1600, 80), ("s", 900, 78))


def find_source():
    matches = sorted(glob.glob(os.path.join(BASE, "*作品集*.pdf")))
    if not matches:
        raise SystemExit("no portfolio PDF found in the project root")
    return matches[-1]


def main():
    source = find_source()
    os.makedirs(OUT, exist_ok=True)
    # Clear stale renders so a shorter portfolio cannot leave orphan pages behind.
    for name in os.listdir(OUT):
        if name.endswith(".webp"):
            os.remove(os.path.join(OUT, name))

    document = pymupdf.open(source)
    print(f"source: {os.path.basename(source)}  pages: {document.page_count}")
    totals = {suffix: 0 for suffix, _, _ in VARIANTS}

    for index, page in enumerate(document):
        for suffix, width, quality in VARIANTS:
            scale = width / page.rect.width
            pixmap = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), alpha=False)
            image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
            target = os.path.join(OUT, f"{index + 1:02d}-{suffix}.webp")
            image.save(target, format="WEBP", quality=quality, method=6)
            totals[suffix] += os.path.getsize(target)
            del image, pixmap
        print(f"  page {index + 1:>2} rendered")

    document.close()
    for suffix, total in totals.items():
        print(f"variant {suffix}: {total / 1024 / 1024:.2f} MB")
    print("output:", OUT)


main()
