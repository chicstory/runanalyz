# -*- coding: utf-8 -*-
"""
RunAnalyz Instagram Editorial Carousel Generator (1080x1350, 4:5 Portrait)
Uses real running background photos from ./insta_bg/ (winter, shoes, track, road)
with magazine-style dark gradient overlays, bold typography, and concise takeaways.
"""

import os
import re
import glob
import json
import random
import argparse
from datetime import datetime
from html.parser import HTMLParser
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ARTICLES_DIR = os.path.join(BASE_DIR, "articles")
BG_ROOT = os.path.join(BASE_DIR, "insta_bg")
OUT_ROOT = os.path.join(BASE_DIR, "insta_cards")
HISTORY_FILE = os.path.join(OUT_ROOT, "generated_history.json")

W, H = 1080, 1350
DARK_BG = (12, 18, 32)
WHITE = (248, 250, 252)
MUTED = (148, 163, 184)
ACCENT = (56, 189, 248)  # Crisp sky-cyan editorial accent


def load_font(bold=False, size=36):
    candidates = (
        ["C:/Windows/Fonts/malgunbd.ttf", "C:/Windows/Fonts/NanumGothicBold.ttf"]
        if bold
        else ["C:/Windows/Fonts/malgun.ttf", "C:/Windows/Fonts/NanumGothic.ttf"]
    )
    for path in candidates:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


class ArticleParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = ""
        self.description = ""
        self.sections = []
        self._in_title = False
        self._in_h2 = False
        self._in_p = False
        self._in_li = False
        self._buf = []
        self._cur_section = None

    def handle_starttag(self, tag, attrs):
        attr_map = dict(attrs)
        if tag == "title":
            self._in_title = True
            self._buf = []
        elif tag == "meta" and attr_map.get("name", "").lower() == "description":
            self.description = (attr_map.get("content") or "").strip()
        elif tag == "h2":
            self._in_h2 = True
            self._buf = []
        elif tag == "p" and self._cur_section is not None:
            self._in_p = True
            self._buf = []
        elif tag == "li" and self._cur_section is not None:
            self._in_li = True
            self._buf = []

    def handle_endtag(self, tag):
        if tag == "title" and self._in_title:
            self._in_title = False
            raw = "".join(self._buf).strip()
            self.title = re.sub(r"\s*\|\s*RunAnalyz.*$", "", raw).strip()
        elif tag == "h2" and self._in_h2:
            self._in_h2 = False
            heading = re.sub(r"\s+", " ", "".join(self._buf)).strip()
            if heading and not any(skip in heading for skip in ("참고", "메모", "함께 읽으면", "계산기")):
                self._cur_section = {"heading": heading, "points": []}
                self.sections.append(self._cur_section)
        elif tag == "p" and self._in_p:
            self._in_p = False
            txt = re.sub(r"\s+", " ", "".join(self._buf)).strip()
            if txt and len(txt) > 12 and self._cur_section is not None:
                self._cur_section["points"].append(txt)
        elif tag == "li" and self._in_li:
            self._in_li = False
            txt = re.sub(r"\s+", " ", "".join(self._buf)).strip()
            if txt and len(txt) > 8 and self._cur_section is not None:
                self._cur_section["points"].append(txt)

    def handle_data(self, data):
        if self._in_title or self._in_h2 or self._in_p or self._in_li:
            self._buf.append(data)


def wrap_text(draw, text, font, max_width):
    lines = []
    for paragraph in text.split("\n"):
        cur = ""
        for ch in paragraph:
            test = cur + ch
            bbox = draw.textbbox((0, 0), test, font=font)
            if bbox[2] - bbox[0] <= max_width:
                cur = test
            else:
                if cur:
                    lines.append(cur.rstrip())
                cur = ch.lstrip()
        if cur:
            lines.append(cur.rstrip())
    return lines


def shorten_sentence(text, max_chars=58):
    first = re.split(r"(?<=[.!?다요])\s+", text.strip())[0]
    if len(first) <= max_chars:
        return first
    return first[: max_chars - 1].rstrip() + "…"


def detect_category(slug, title=""):
    s = f"{slug} {title}".lower()
    if any(k in s for k in ("injury", "pain", "tendon", "knee", "shin", "ankle", "plantar", "it-band", "pfps", "achilles", "rehab", "doms", "hamstring", "calf", "soleus", "hip", "부상", "통증", "재활", "아킬레스", "무릎", "정강이", "발목")):
        return "부상재활"
    if any(k in s for k in ("nutrition", "sleep", "recovery", "hydration", "carbo", "caffeine", "anemia", "ferritin", "foam-roller", "massage", "rest", "cough", "airway", "수면", "영양", "회복", "수분", "카페인", "빈혈", "휴식", "기침", "감기")):
        return "영양회복"
    if any(k in s for k in ("marathon", "race", "chuncheon", "sub4", "sub3", "yasso", "마라톤", "대회", "춘천", "완주")):
        return "대회"
    if any(k in s for k in ("shoe", "gear", "watch", "garmin", "coros", "layering", "treadmill", "carbon", "foam", "ppg", "chest-strap", "러닝화", "기어", "스마트워치", "가민", "복장", "레이어링", "트레드밀")):
        return "기어랩"
    return "훈련심폐"


def pick_bg_image(category):
    exts = ("*.jpg", "*.jpeg", "*.png", "*.webp")
    candidates = []
    cat_dir = os.path.join(BG_ROOT, category)
    if os.path.isdir(cat_dir):
        for ext in exts:
            candidates.extend(glob.glob(os.path.join(cat_dir, ext)))
    if not candidates and os.path.isdir(BG_ROOT):
        for ext in exts:
            candidates.extend(glob.glob(os.path.join(BG_ROOT, "**", ext), recursive=True))
    return random.choice(candidates) if candidates else None


def prepare_bg_canvas(bg_path, blur_radius=0, brightness=0.55, gradient_bottom=True):
    if bg_path and os.path.exists(bg_path):
        im = Image.open(bg_path).convert("RGB")
        # Center crop to 4:5 (1080x1350)
        target_ratio = W / H
        src_ratio = im.width / im.height
        if src_ratio > target_ratio:
            new_w = int(im.height * target_ratio)
            left = (im.width - new_w) // 2
            im = im.crop((left, 0, left + new_w, im.height))
        else:
            new_h = int(im.width / target_ratio)
            top = (im.height - new_h) // 2
            im = im.crop((0, top, im.width, top + new_h))
        im = im.resize((W, H), Image.Resampling.LANCZOS)
        if blur_radius > 0:
            im = im.filter(ImageFilter.GaussianBlur(blur_radius))
        im = ImageEnhance.Brightness(im).enhance(brightness)
    else:
        im = Image.new("RGB", (W, H), DARK_BG)

    im = im.convert("RGBA")
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    odraw = ImageDraw.Draw(overlay)
    if gradient_bottom:
        for y in range(H):
            ratio = y / H
            alpha = int(max(40, min(230, (ratio ** 1.6) * 235)))
            odraw.line([(0, y), (W, y)], fill=(8, 13, 25, alpha))
    else:
        odraw.rectangle([0, 0, W, H], fill=(8, 13, 25, 175))
    return Image.alpha_composite(im, overlay).convert("RGB")


def draw_chrome(draw, page_num, total_pages):
    font_brand = load_font(bold=True, size=24)
    draw.text((84, 72), "RUNANALYZ  |  RUNNING NOTE", font=font_brand, fill=ACCENT)
    page_str = f"{page_num:02d} / {total_pages:02d}"
    pb = draw.textbbox((0, 0), page_str, font=font_brand)
    draw.text((W - 84 - (pb[2] - pb[0]), 72), page_str, font=font_brand, fill=MUTED)


def render_cover(title, desc, bg_path, out_path, total_pages):
    img = prepare_bg_canvas(bg_path, blur_radius=0, brightness=0.72, gradient_bottom=True)
    draw = ImageDraw.Draw(img)
    draw_chrome(draw, 1, total_pages)

    font_title = load_font(bold=True, size=66)
    font_sub = load_font(bold=False, size=32)
    font_swipe = load_font(bold=True, size=24)

    short_title = title.split(":")[0].strip() if ":" in title else title
    title_lines = wrap_text(draw, short_title, font_title, W - 168)[:3]
    sub_lines = wrap_text(draw, shorten_sentence(desc, 68), font_sub, W - 168)[:2]

    bottom_y = H - 150
    sub_y = bottom_y - len(sub_lines) * 46 - 24
    title_y = sub_y - len(title_lines) * 86 - 28

    draw.rectangle([84, title_y - 28, 164, title_y - 20], fill=ACCENT)
    for line in title_lines:
        draw.text((84, title_y), line, font=font_title, fill=WHITE)
        title_y += 86

    for line in sub_lines:
        draw.text((84, sub_y), line, font=font_sub, fill=(203, 213, 225))
        sub_y += 46

    draw.text((84, H - 96), "SWIPE  >", font=font_swipe, fill=ACCENT)
    img.save(out_path, quality=95)


def render_section(idx, section, bg_path, out_path, total_pages):
    img = prepare_bg_canvas(bg_path, blur_radius=8, brightness=0.45, gradient_bottom=False)
    draw = ImageDraw.Draw(img)
    draw_chrome(draw, idx, total_pages)

    font_num = load_font(bold=True, size=92)
    font_h = load_font(bold=True, size=50)
    font_pt = load_font(bold=False, size=36)

    draw.text((84, 210), f"0{idx - 1}", font=font_num, fill=ACCENT)
    y = 330
    for line in wrap_text(draw, section["heading"], font_h, W - 168)[:2]:
        draw.text((84, y), line, font=font_h, fill=WHITE)
        y += 68

    y += 46
    for pt in section["points"][:2]:
        concise = shorten_sentence(pt, 62)
        lines = wrap_text(draw, concise, font_pt, W - 210)[:3]
        draw.rectangle([84, y + 8, 92, y + len(lines) * 52 - 4], fill=ACCENT)
        ty = y
        for l in lines:
            draw.text((118, ty), l, font=font_pt, fill=(226, 232, 240))
            ty += 52
        y = ty + 46

    draw.text((84, H - 96), "runanalyz.com", font=load_font(bold=True, size=24), fill=MUTED)
    img.save(out_path, quality=95)


def render_cta(title, bg_path, out_path, total_pages):
    img = prepare_bg_canvas(bg_path, blur_radius=6, brightness=0.50, gradient_bottom=True)
    draw = ImageDraw.Draw(img)
    draw_chrome(draw, total_pages, total_pages)

    font_h = load_font(bold=True, size=58)
    font_sub = load_font(bold=False, size=32)
    font_btn = load_font(bold=True, size=30)

    y = 430
    for line in wrap_text(draw, "저장해두고\n달리기 전에 확인하세요", font_h, W - 168):
        draw.text((84, y), line, font=font_h, fill=WHITE)
        y += 80

    y += 30
    for line in wrap_text(draw, "내 페이스·심박존 계산기와 러닝화 스펙 비교는\n프로필 링크에서 무료로 확인할 수 있습니다.", font_sub, W - 168):
        draw.text((84, y), line, font=font_sub, fill=(203, 213, 225))
        y += 48

    draw.rounded_rectangle([84, H - 240, W - 84, H - 150], radius=16, fill=ACCENT)
    btn_txt = "프로필 링크  runanalyz.com"
    bb = draw.textbbox((0, 0), btn_txt, font=font_btn)
    draw.text(((W - (bb[2] - bb[0])) // 2, H - 212), btn_txt, font=font_btn, fill=(8, 13, 25))
    img.save(out_path, quality=95)


def pick_article(target_arg=None):
    all_files = sorted(
        f for f in glob.glob(os.path.join(ARTICLES_DIR, "*.html"))
        if not os.path.basename(f).startswith("_")
    )
    if target_arg:
        for f in all_files:
            if target_arg in os.path.basename(f):
                return f
        raise FileNotFoundError(f"'{target_arg}'와 일치하는 아티클을 찾지 못했습니다.")

    used = set()
    if os.path.exists(HISTORY_FILE):
        try:
            used = set(json.load(open(HISTORY_FILE, "r", encoding="utf-8")))
        except Exception:
            used = set()
    candidates = [f for f in all_files if os.path.basename(f) not in used] or all_files
    return random.choice(candidates)


def main():
    parser = argparse.ArgumentParser(description="RunAnalyz Editorial Instagram Generator")
    parser.add_argument("--article", help="Article filename or keyword slug", default=None)
    args = parser.parse_args()

    for sub in ("부상재활", "훈련심폐", "영양회복", "대회", "기어랩"):
        os.makedirs(os.path.join(BG_ROOT, sub), exist_ok=True)
    os.makedirs(OUT_ROOT, exist_ok=True)

    article_path = pick_article(args.article)
    slug = os.path.splitext(os.path.basename(article_path))[0]

    ap = ArticleParser()
    ap.feed(open(article_path, "r", encoding="utf-8").read())

    title = ap.title or slug
    category = detect_category(slug, title)
    bg_path = pick_bg_image(category)
    desc = ap.description or "달리기 데이터와 운동생리학을 바탕으로 정리한 실전 러닝 가이드입니다."
    sections = [s for s in ap.sections if s["points"]][:3]
    total_pages = 2 + len(sections)

    today_str = datetime.now().strftime("%Y-%m-%d")
    out_dir = os.path.join(OUT_ROOT, f"{today_str}_{slug[:40]}")
    os.makedirs(out_dir, exist_ok=True)

    render_cover(title, desc, bg_path, os.path.join(out_dir, "01_cover.png"), total_pages)
    for i, sec in enumerate(sections, start=2):
        render_section(i, sec, bg_path, os.path.join(out_dir, f"0{i}_point{i-1}.png"), total_pages)
    render_cta(title, bg_path, os.path.join(out_dir, f"0{total_pages}_cta.png"), total_pages)

    caption = (
        f"{title}\n\n"
        f"{desc}\n\n"
        f"내 기록 기반 4대 훈련 속도 계산기와 러닝화 스펙 비교는 프로필 링크(runanalyz.com)에서 무료로 확인하세요.\n\n"
        f"#러닝 #마라톤 #런애널라이즈 #러닝화 #달리기 #러닝기록 #부상예방"
    )
    with open(os.path.join(out_dir, "caption.txt"), "w", encoding="utf-8") as f:
        f.write(caption + "\n")

    print(f"[OK] Editorial {total_pages} slides generated | category={category} | bg={os.path.basename(bg_path) if bg_path else 'dark-gradient-fallback'}")
    print(f"[OUT] {out_dir}")


if __name__ == "__main__":
    main()
