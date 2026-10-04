"""Renders the portfolio PDF into the responsive WebP images used by portfolio.html.

Put the source PDF (77个人作品集*.pdf) back into the project root, then run:

    pip install pymupdf pillow
    python tools/render-portfolio.py

Output per page:
    NN-s.webp   900px  手机端页内滚动（srcset 选它）
    NN-w.webp  2160px  桌面端页内滚动（匹配 1080 CSS px @2x）
    NN-xl.webp 3840px  灯箱专用：视网膜桌面 1:1，并留出放大余量

分辨率是清晰度的硬上限：1600px 在 2x 屏桌面上连 1:1 都达不到，放大后必然发虚。
PDF 里的文字与形状是真矢量，提高渲染 DPI 能实打实增加细节，不是拉伸。
"""

import glob
import os
import sys

import pymupdf
from PIL import Image

# 素材文件名里带 emoji，Windows 控制台默认 GBK 会直接抛异常
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, "assets", "portfolio")

# 三档尺寸：页内两档走 srcset，xl 档只给灯箱用（不进 srcset，否则滚动时会大量下载）
VARIANTS = (
    ("s", 900, 78),
    ("w", 2160, 85),
    ("xl", 3840, 88),
)


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
