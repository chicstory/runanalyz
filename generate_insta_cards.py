# -*- coding: utf-8 -*-
"""
RunAnalyz Instagram Editorial Carousel Generator (1080x1350, 4:5 Portrait)
Uses real running background photos from ./insta_bg/ (5 RunLog categories)
and extracts rich, complete, actionable takeaways (plus optional Gemini API polishing).
"""

import os
import re
import glob
import json
import random
import ssl
import argparse
import urllib.request
import urllib.parse
from datetime import datetime
from html.parser import HTMLParser
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance, ImageOps

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ARTICLES_DIR = os.path.join(BASE_DIR, "articles")
BG_ROOT = os.path.join(BASE_DIR, "insta_bg")
OUT_ROOT = os.path.join(BASE_DIR, "insta_cards")
HISTORY_FILE = os.path.join(OUT_ROOT, "generated_history.json")
ENV_FILE = os.path.join(BASE_DIR, ".env")

W, H = 1080, 1350
DARK_BG = (12, 18, 32)
WHITE = (248, 250, 252)
MUTED = (148, 163, 184)
ACCENT = (56, 189, 248)


def load_env(path):
    env = {}
    if not os.path.exists(path):
        return env
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


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
        self._in_tr = False
        self._in_cell = False
        self._buf = []
        self._row_cells = []
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
        elif tag == "tr" and self._cur_section is not None:
            self._in_tr = True
            self._row_cells = []
        elif tag in ("td", "th") and self._in_tr:
            self._in_cell = True
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
            if txt and len(txt) > 15 and self._cur_section is not None:
                self._cur_section["points"].append(txt)
        elif tag == "li" and self._in_li:
            self._in_li = False
            txt = re.sub(r"\s+", " ", "".join(self._buf)).strip()
            if txt and len(txt) > 10 and self._cur_section is not None:
                self._cur_section["points"].append(txt)
        elif tag in ("td", "th") and self._in_cell:
            self._in_cell = False
            cell_txt = re.sub(r"\s+", " ", "".join(self._buf)).strip()
            if cell_txt:
                self._row_cells.append(cell_txt)
        elif tag == "tr" and self._in_tr:
            self._in_tr = False
            if len(self._row_cells) >= 2 and self._cur_section is not None:
                # Skip table header rows
                joined = "  |  ".join(self._row_cells[:3])
                if not any(h in self._row_cells[0] for h in ("구간", "기온", "구분", "항목")):
                    self._cur_section["points"].append(joined)

    def handle_data(self, data):
        if self._in_title or self._in_h2 or self._in_p or self._in_li or self._in_cell:
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


def clean_complete_point(text, max_chars=105):
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    out = ""
    for s in sentences:
        cand = f"{out} {s}".strip() if out else s
        if len(cand) <= max_chars:
            out = cand
        else:
            break
    if out:
        return out
    return text[: max_chars - 1].rstrip() + "…"


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
            candidates.extend(
                p for p in glob.glob(os.path.join(BG_ROOT, "**", ext), recursive=True)
                if "_unused" not in p and "_heic" not in p
            )
    return random.choice(candidates) if candidates else None


def prepare_bg_canvas(bg_path, blur_radius=0, brightness=0.55, gradient_bottom=True):
    if bg_path and os.path.exists(bg_path):
        im = ImageOps.exif_transpose(Image.open(bg_path)).convert("RGB")
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
            alpha = int(max(45, min(235, (ratio ** 1.55) * 240)))
            odraw.line([(0, y), (W, y)], fill=(8, 13, 25, alpha))
    else:
        odraw.rectangle([0, 0, W, H], fill=(8, 13, 25, 185))
    return Image.alpha_composite(im, overlay).convert("RGBA")


def draw_chrome(draw, page_num, total_pages):
    font_brand = load_font(bold=True, size=24)
    draw.text((80, 68), "RUNANALYZ  |  RUNNING NOTE", font=font_brand, fill=ACCENT)
    page_str = f"{page_num:02d} / {total_pages:02d}"
    pb = draw.textbbox((0, 0), page_str, font=font_brand)
    draw.text((W - 80 - (pb[2] - pb[0]), 68), page_str, font=font_brand, fill=MUTED)


def render_cover(title, desc, bg_path, out_path, total_pages):
    img = prepare_bg_canvas(bg_path, blur_radius=0, brightness=0.72, gradient_bottom=True).convert("RGB")
    draw = ImageDraw.Draw(img)
    draw_chrome(draw, 1, total_pages)

    font_title = load_font(bold=True, size=62)
    font_sub = load_font(bold=False, size=32)
    font_swipe = load_font(bold=True, size=24)

    short_title = title.split(":")[0].strip() if ":" in title else title
    title_lines = wrap_text(draw, short_title, font_title, W - 160)[:3]
    sub_lines = wrap_text(draw, clean_complete_point(desc, 85), font_sub, W - 160)[:3]

    bottom_y = H - 145
    sub_y = bottom_y - len(sub_lines) * 46 - 24
    title_y = sub_y - len(title_lines) * 84 - 28

    draw.rectangle([80, title_y - 26, 160, title_y - 18], fill=ACCENT)
    for line in title_lines:
        draw.text((80, title_y), line, font=font_title, fill=WHITE)
        title_y += 84

    for line in sub_lines:
        draw.text((80, sub_y), line, font=font_sub, fill=(203, 213, 225))
        sub_y += 46

    draw.text((80, H - 92), "SWIPE  >", font=font_swipe, fill=ACCENT)
    img.save(out_path, quality=95)


def render_section(idx, section, bg_path, out_path, total_pages):
    base = prepare_bg_canvas(bg_path, blur_radius=10, brightness=0.42, gradient_bottom=False)
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    odraw = ImageDraw.Draw(overlay)

    font_num = load_font(bold=True, size=56)
    font_h = load_font(bold=True, size=44)
    font_pt = load_font(bold=False, size=31)

    odraw.text((80, 150), f"0{idx - 1}", font=font_num, fill=ACCENT)
    y = 224
    for line in wrap_text(odraw, section["heading"], font_h, W - 160)[:2]:
        odraw.text((80, y), line, font=font_h, fill=WHITE)
        y += 60

    y += 28
    for pt in section["points"][:4]:
        concise = clean_complete_point(pt, 105)
        lines = wrap_text(odraw, concise, font_pt, W - 216)[:3]
        box_h = len(lines) * 44 + 40
        if y + box_h > H - 120:
            break
        odraw.rounded_rectangle(
            [80, y, W - 80, y + box_h],
            radius=20,
            fill=(15, 23, 42, 195),
            outline=(56, 189, 248, 80),
            width=2,
        )
        ty = y + 20
        for l in lines:
            odraw.text((108, ty), l, font=font_pt, fill=(226, 232, 240))
            ty += 44
        y += box_h + 20

    draw_chrome(odraw, idx, total_pages)
    odraw.text((80, H - 92), "runanalyz.com", font=load_font(bold=True, size=24), fill=MUTED)
    combined = Image.alpha_composite(base, overlay).convert("RGB")
    combined.save(out_path, quality=95)


def render_cta(title, bg_path, out_path, total_pages):
    img = prepare_bg_canvas(bg_path, blur_radius=6, brightness=0.50, gradient_bottom=True).convert("RGB")
    draw = ImageDraw.Draw(img)
    draw_chrome(draw, total_pages, total_pages)

    font_h = load_font(bold=True, size=56)
    font_sub = load_font(bold=False, size=32)
    font_btn = load_font(bold=True, size=30)

    y = 420
    for line in wrap_text(draw, "저장해두고\n달리기 전에 확인하세요", font_h, W - 160):
        draw.text((80, y), line, font=font_h, fill=WHITE)
        y += 78

    y += 30
    for line in wrap_text(draw, "내 페이스·심박존 계산기와 러닝화 스펙 비교는\n프로필 링크에서 무료로 확인할 수 있습니다.", font_sub, W - 160):
        draw.text((80, y), line, font=font_sub, fill=(203, 213, 225))
        y += 48

    draw.rounded_rectangle([80, H - 235, W - 80, H - 145], radius=16, fill=ACCENT)
    btn_txt = "프로필 링크  runanalyz.com"
    bb = draw.textbbox((0, 0), btn_txt, font=font_btn)
    draw.text(((W - (bb[2] - bb[0])) // 2, H - 208), btn_txt, font=font_btn, fill=(8, 13, 25))
    img.save(out_path, quality=95)


def summarize_with_gemini(title, sections, api_key):
    ssl_ctx = ssl.create_default_context()
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl.CERT_NONE
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={urllib.parse.quote(api_key)}"
    prompt = (
        "다음 러닝 과학 아티클을 인스타그램 카드뉴스 본문 슬라이드 3장으로 재구성하세요.\n"
        "JSON 배열만 출력하세요: [{\"heading\": \"짧은 소제목\", \"points\": [\"완전한 문장 1(구체적 수치/기준 포함)\", \"문장 2\", \"문장 3\"]}]\n"
        "규칙: 이모지 금지, 문장이 중간에 잘리지 않게 완결, 각 포인트는 50~90자 내외의 알찬 실전 팁으로 작성.\n\n"
        f"제목: {title}\n원본 섹션: {json.dumps(sections[:5], ensure_ascii=False)}"
    )
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.3, "responseMimeType": "application/json"},
    }
    req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, context=ssl_ctx, timeout=30) as resp:
        res_data = json.loads(resp.read().decode("utf-8"))
    txt = res_data["candidates"][0]["content"]["parts"][0]["text"]
    parsed = json.loads(txt)
    if isinstance(parsed, list) and len(parsed) >= 1:
        return parsed[:3]
    return None


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

    local_env = load_env(ENV_FILE)
    gemini_key = os.environ.get("GEMINI_API_KEY") or local_env.get("GEMINI_API_KEY", "")
    if gemini_key and sections:
        try:
            ai_sections = summarize_with_gemini(title, sections, gemini_key)
            if ai_sections:
                sections = ai_sections
        except Exception as e:
            print(f"[WARN] Gemini polish failed, using parsed HTML sections: {e}")

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
