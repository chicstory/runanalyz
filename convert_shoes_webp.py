"""Convert raw shoe screenshots in shoes_raw/ into 640x400 (16:10) WebP gallery assets.

Supports both:
  1. Subfolders per shoe: shoes_raw/<shoe-id>/1.png, 2.png, ...
  2. Flat files: shoes_raw/<shoe-id>.png (or <shoe-id>--2.png, <shoe-id>_img2.png for extra angles)

Two-pass product-centered auto-crop:
  1. Strips outer webpage/screenshot margin.
  2. Strips inner product-card background so the shoe itself is scaled & centered
     uniformly on a 640x400 canvas with zero visible box borders.

Outputs to: assets/shoes/<shoe-id>-1.webp, <shoe-id>-2.webp, ...
"""

import re
from pathlib import Path
from PIL import Image, ImageChops, ImageOps

BASE_DIR = Path(__file__).resolve().parent
RAW_DIR = BASE_DIR / "shoes_raw"
OUT_DIR = BASE_DIR / "assets" / "shoes"

TARGET_W = 640
TARGET_H = 400
PADDING_RATIO = 0.08  # 8% inner margin so toe/heel sit cleanly centered
WEBP_QUALITY = 85
DEFAULT_BG = (248, 250, 252)  # #F8FAFC Clean Light canvas
BG_DIFF_THRESHOLD = 18
SUPPORTED_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}


def sanitize_slug(stem: str) -> str:
    """Normalize filename or folder stem into a clean lowercase slug."""
    slug = stem.strip().lower()
    slug = re.sub(r"\s+", "-", slug)
    slug = re.sub(r"[^a-z0-9가-힣_-]+", "-", slug)
    slug = re.sub(r"-{2,}", "-", slug).strip("-")
    return slug or "shoe"


def parse_shoe_and_index(src: Path) -> tuple[str, int]:
    """Extract (shoe_slug, gallery_index) without stripping model version numbers (-42, -18, etc.)."""
    if src.parent != RAW_DIR:
        shoe_slug = sanitize_slug(src.parent.name)
        m = re.search(r"(\d+)$", src.stem.strip())
        idx = int(m.group(1)) if m else 1
        return shoe_slug, idx

    stem = src.stem.strip()
    m = re.match(r"^(.+?)(?:--(\d+)|[-_](?:img|shot|angle|v)(\d+)|\s*\((\d+)\))$", stem, re.IGNORECASE)
    if m:
        idx_str = next(g for g in m.groups()[1:] if g is not None)
        return sanitize_slug(m.group(1)), int(idx_str)
    return sanitize_slug(stem), 1


def has_transparent_corners(rgba: Image.Image) -> bool:
    """Return True only if the image actually uses alpha transparency at its corners."""
    w, h = rgba.size
    alpha = rgba.getchannel("A")
    corners = [
        alpha.getpixel((0, 0)),
        alpha.getpixel((max(0, w - 1), 0)),
        alpha.getpixel((0, max(0, h - 1))),
        alpha.getpixel((max(0, w - 1), max(0, h - 1))),
    ]
    return min(corners) < 250


def sample_corner_bg(rgb: Image.Image) -> tuple[int, int, int]:
    """Sample four corner pixels to match solid screenshot background seamlessly."""
    w, h = rgb.size
    corners = [
        rgb.getpixel((0, 0)),
        rgb.getpixel((max(0, w - 1), 0)),
        rgb.getpixel((0, max(0, h - 1))),
        rgb.getpixel((max(0, w - 1), max(0, h - 1))),
    ]
    avg = tuple(sum(c[i] for c in corners) // 4 for i in range(3))
    spread = max(max(c[i] for c in corners) - min(c[i] for c in corners) for i in range(3))
    return avg if spread <= 35 else DEFAULT_BG


def find_product_bbox(rgba: Image.Image, bg_color: tuple[int, int, int], transparent: bool) -> tuple[int, int, int, int] | None:
    """Find tight bounding box of the shoe against its background."""
    if transparent:
        alpha_mask = rgba.getchannel("A").point(lambda a: 255 if a > 20 else 0)
        return alpha_mask.getbbox()

    rgb = rgba.convert("RGB")
    bg_img = Image.new("RGB", rgb.size, bg_color)
    diff = ImageChops.difference(rgb, bg_img)
    gray = diff.convert("L")
    mask = gray.point(lambda p: 255 if p > BG_DIFF_THRESHOLD else 0)
    return mask.getbbox()


def fit_scale(rgba: Image.Image, max_w: int, max_h: int) -> Image.Image:
    """Scale image up or down preserving aspect ratio to fill target box cleanly."""
    w, h = rgba.size
    if w == 0 or h == 0:
        return rgba
    scale = min(max_w / w, max_h / h)
    new_w = max(1, round(w * scale))
    new_h = max(1, round(h * scale))
    return rgba.resize((new_w, new_h), Image.Resampling.LANCZOS)


def convert_image(src_path: Path, dst_path: Path) -> None:
    """Two-pass auto-crop around the shoe, scale uniformly, and center onto a 640x400 WebP canvas."""
    with Image.open(src_path) as raw:
        img = ImageOps.exif_transpose(raw)
        rgba = img.convert("RGBA")
        transparent = has_transparent_corners(rgba)
        bg_color = DEFAULT_BG if transparent else sample_corner_bg(rgba.convert("RGB"))

        # Pass 1: strip outer screenshot margin
        bbox1 = find_product_bbox(rgba, bg_color, transparent)
        if bbox1:
            rgba = rgba.crop(bbox1)

        # Pass 2: if inner product card has its own solid background (e.g. white card inside gray page), strip it too
        if not transparent:
            inner_bg = sample_corner_bg(rgba.convert("RGB"))
            if inner_bg != bg_color:
                bg_color = inner_bg
                bbox2 = find_product_bbox(rgba, bg_color, False)
                if bbox2:
                    rgba = rgba.crop(bbox2)

        max_w = int(TARGET_W * (1 - PADDING_RATIO * 2))
        max_h = int(TARGET_H * (1 - PADDING_RATIO * 2))
        rgba = fit_scale(rgba, max_w, max_h)

        canvas = Image.new("RGB", (TARGET_W, TARGET_H), bg_color)
        paste_x = (TARGET_W - rgba.width) // 2
        paste_y = (TARGET_H - rgba.height) // 2
        canvas.paste(rgba, (paste_x, paste_y), rgba)
        canvas.save(dst_path, "WEBP", quality=WEBP_QUALITY, method=6)


def main() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    candidates = [
        p for p in RAW_DIR.rglob("*")
        if p.is_file() and p.suffix.lower() in SUPPORTED_EXTS
    ]
    if not candidates:
        print(f"No images found in: {RAW_DIR}")
        return

    grouped: dict[str, list[tuple[int, Path]]] = {}
    for src in sorted(candidates):
        shoe_slug, idx = parse_shoe_and_index(src)
        grouped.setdefault(shoe_slug, []).append((idx, src))

    converted = 0
    for shoe_slug, items in sorted(grouped.items()):
        items.sort(key=lambda x: (x[0], x[1].name))
        for seq, (_, src) in enumerate(items, start=1):
            dst = OUT_DIR / f"{shoe_slug}-{seq}.webp"
            convert_image(src, dst)
            size_kb = dst.stat().st_size / 1024
            print(f"OK: {src.relative_to(RAW_DIR)} -> {dst.relative_to(BASE_DIR)} ({size_kb:.1f} KB)")
            converted += 1

    print(f"\nDone: {converted} file(s) across {len(grouped)} shoe(s) -> {OUT_DIR}")


if __name__ == "__main__":
    main()
