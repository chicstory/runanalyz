# -*- coding: utf-8 -*-
"""
RunAnalyz Instagram Carousel Card Generator (1080x1350, 4:5 Portrait)
Reads an article from articles/*.html and outputs:
- 01_cover.png
- 02_point1.png ~ 04_point3.png
- 05_cta.png
- caption.txt (Instagram copy + hashtags)
"""

import os
import re
import sys
import glob
import json
import random
import argparse
from datetime import datetime
from html.parser import HTMLParser
from PIL import Image, ImageDraw, ImageFont

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ARTICLES_DIR = os.path.join(BASE_DIR, "articles")
OUT_ROOT = os.path.join(BASE_DIR, "insta_cards")
HISTORY_FILE = os.path.join(OUT_ROOT, "generated_history.json")

W, H = 1080, 1350
BG_COLOR = (248, 250, 252)      # #F8FAFC
CARD_COLOR = (255, 255, 255)    # #FFFFFF
BORDER_COLOR = (226, 232, 240)  # #E2E8F0
TITLE_COLOR = (15, 23, 42)      # #0F172A
BODY_COLOR = (51, 65, 85)       # #334155
MUTED_COLOR = (100, 116, 139)   # #64748B
ACCENT = (49, 130, 246)         # #3182F6
ACCENT_SOFT = (239, 246, 255)   # #EFF6FF


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


def draw_base_card(page_num, total_pages):
    img = Image.new("RGB", (W, H), BG_COLOR)
    draw = ImageDraw.Draw(img)
    # Outer white card
    draw.rounded_rectangle([48, 48, W - 48, H - 48], radius=36, fill=CARD_COLOR, outline=BORDER_COLOR, width=3)
    # Top accent bar
    draw.rounded_rectangle([96, 96, 360, 146], radius=25, fill=ACCENT_SOFT)
    font_badge = load_font(bold=True, size=24)
    draw.text((120, 108), "RunAnalyz 러닝 노트", font=font_badge, fill=ACCENT)
    # Page indicator
    font_page = load_font(bold=True, size=24)
    page_str = f"{page_num} / {total_pages}"
    pb = draw.textbbox((0, 0), page_str, font=font_page)
    draw.text((W - 96 - (pb[2] - pb[0]), 108), page_str, font=font_page, fill=MUTED_COLOR)
    # Footer
    font_foot = load_font(bold=False, size=24)
    draw.line([96, H - 140, W - 96, H - 140], fill=BORDER_COLOR, width=2)
    draw.text((96, H - 112), "runanalyz.com", font=load_font(bold=True, size=24), fill=ACCENT)
    foot_r = "프로필 링크에서 계산기 · 러닝화 비교"
    frb = draw.textbbox((0, 0), foot_r, font=font_foot)
    draw.text((W - 96 - (frb[2] - frb[0]), H - 112), foot_r, font=font_foot, fill=MUTED_COLOR)
    return img, draw


def render_cover(title, desc, out_path, total_pages):
    img, draw = draw_base_card(1, total_pages)
    font_title = load_font(bold=True, size=62)
    font_desc = load_font(bold=False, size=34)
    font_cta = load_font(bold=True, size=30)

    y = 280
    for line in wrap_text(draw, title, font_title, W - 192)[:5]:
        draw.text((96, y), line, font=font_title, fill=TITLE_COLOR)
        y += 86

    y += 40
    draw.rectangle([96, y, 196, y + 8], fill=ACCENT)
    y += 44

    for line in wrap_text(draw, desc, font_desc, W - 192)[:5]:
        draw.text((96, y), line, font=font_desc, fill=BODY_COLOR)
        y += 52

    # Bottom swipe pill
    draw.rounded_rectangle([96, H - 250, W - 96, H - 175], radius=18, fill=ACCENT)
    cta = "스와이프하여 핵심 포인트 보기  >"
    cb = draw.textbbox((0, 0), cta, font=font_cta)
    draw.text(((W - (cb[2] - cb[0])) // 2, H - 228), cta, font=font_cta, fill=(255, 255, 255))
    img.save(out_path, quality=95)


def render_section(idx, section, out_path, total_pages):
    img, draw = draw_base_card(idx, total_pages)
    font_num = load_font(bold=True, size=32)
    font_h = load_font(bold=True, size=48)
    font_body = load_font(bold=False, size=34)

    draw.text((96, 210), f"POINT 0{idx - 1}", font=font_num, fill=ACCENT)
    y = 268
    for line in wrap_text(draw, section["heading"], font_h, W - 192)[:3]:
        draw.text((96, y), line, font=font_h, fill=TITLE_COLOR)
        y += 66

    y += 32
    points = section["points"][:3]
    for pt in points:
        # Clean bullet card
        lines = wrap_text(draw, pt, font_body, W - 240)[:4]
        box_h = len(lines) * 48 + 44
        if y + box_h > H - 175:
            break
        draw.rounded_rectangle([96, y, W - 96, y + box_h], radius=20, fill=BG_COLOR, outline=BORDER_COLOR, width=2)
        ty = y + 22
        for l in lines:
            draw.text((124, ty), l, font=font_body, fill=BODY_COLOR)
            ty += 48
        y += box_h + 22

    img.save(out_path, quality=95)


def render_cta(title, out_path, total_pages):
    img, draw = draw_base_card(total_pages, total_pages)
    font_h = load_font(bold=True, size=56)
    font_sub = load_font(bold=False, size=34)
    font_btn = load_font(bold=True, size=34)

    y = 320
    for line in wrap_text(draw, "저장해두고 달리기 전에\n다시 확인해 보세요", font_h, W - 192):
        draw.text((96, y), line, font=font_h, fill=TITLE_COLOR)
        y += 78

    y += 36
    sub = f"원문 아티클: {title}\n내 페이스·심박존 계산기와 러닝화 스펙 비교는 프로필 링크에서 무료로 이용할 수 있습니다."
    for line in wrap_text(draw, sub, font_sub, W - 192):
        draw.text((96, y), line, font=font_sub, fill=BODY_COLOR)
        y += 52

    draw.rounded_rectangle([96, H - 280, W - 96, H - 185], radius=20, fill=ACCENT)
    btn_txt = "프로필 링크  runanalyz.com"
    bb = draw.textbbox((0, 0), btn_txt, font=font_btn)
    draw.text(((W - (bb[2] - bb[0])) // 2, H - 252), btn_txt, font=font_btn, fill=(255, 255, 255))
    img.save(out_path, quality=95)


def pick_article(target_arg=None):
    all_files = sorted(
        f for f in glob.glob(os.path.join(ARTICLES_DIR, "*.html"))
        if not os.path.basename(f).startswith("_")
    )
    if not all_files:
        raise FileNotFoundError("articles/ 폴더에 HTML 아티클이 없습니다.")

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

    candidates = [f for f in all_files if os.path.basename(f) not in used]
    if not candidates:
        candidates = all_files
    return random.choice(candidates)


def main():
    parser = argparse.ArgumentParser(description="RunAnalyz Instagram Carousel Generator")
    parser.add_argument("--article", help="Article filename or keyword slug", default=None)
    args = parser.parse_args()

    os.makedirs(OUT_ROOT, exist_ok=True)
    article_path = pick_article(args.article)
    slug = os.path.splitext(os.path.basename(article_path))[0]

    html_text = open(article_path, "r", encoding="utf-8").read()
    ap = ArticleParser()
    ap.feed(html_text)

    title = ap.title or slug
    desc = ap.description or "달리기 데이터와 운동생리학을 바탕으로 정리한 실전 러닝 가이드입니다."
    sections = [s for s in ap.sections if s["points"]][:3]
    total_pages = 2 + len(sections)

    today_str = datetime.now().strftime("%Y-%m-%d")
    out_dir = os.path.join(OUT_ROOT, f"{today_str}_{slug[:40]}")
    os.makedirs(out_dir, exist_ok=True)

    render_cover(title, desc, os.path.join(out_dir, "01_cover.png"), total_pages)
    for i, sec in enumerate(sections, start=2):
        render_section(i, sec, os.path.join(out_dir, f"0{i}_point{i-1}.png"), total_pages)
    render_cta(title, os.path.join(out_dir, f"0{total_pages}_cta.png"), total_pages)

    caption = (
        f"{title}\n\n"
        f"{desc}\n\n"
        f"더 자세한 내용과 내 기록 기반 4대 훈련 속도 계산기, 러닝화 스펙 비교는 프로필 링크(runanalyz.com)에서 무료로 확인하세요.\n\n"
        f"#러닝 #마라톤 #런애널라이즈 #러닝화 #달리기 #러닝기록 #부상예방 #운동생리학"
    )
    with open(os.path.join(out_dir, "caption.txt"), "w", encoding="utf-8") as f:
        f.write(caption + "\n")

    # Record history
    used = []
    if os.path.exists(HISTORY_FILE):
        try:
            used = json.load(open(HISTORY_FILE, "r", encoding="utf-8"))
        except Exception:
            used = []
    if os.path.basename(article_path) not in used:
        used.append(os.path.basename(article_path))
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(used, f, ensure_ascii=False, indent=2)

    print(f"[OK] Generated {total_pages} slides + caption.txt for: {os.path.basename(article_path)}")
    print(f"[OUT] {out_dir}")


if __name__ == "__main__":
    main()
