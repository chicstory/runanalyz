"""Fetch authentic The Hyundai (hi.thehyundai.com) prices and product links via headless Edge."""

import json
import re
import subprocess
import urllib.parse
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
JSON_PATH = BASE_DIR / "data" / "shoes.json"
JS_PATH = BASE_DIR / "data" / "shoes.js"
EDGE_EXE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

SEARCH_RULES = {
    "nike-pegasus-42": ("나이키 페가수스 42", ["페가수스", "42"]),
    "nike-pegasus-plus": ("나이키 페가수스 플러스", ["페가수스", "플러스"]),
    "nike-pegasus-premium": ("나이키 페가수스 프리미엄", ["페가수스", "프리미엄"]),
    "nike-vomero-18": ("나이키 보메로 18", ["보메로", "18"]),
    "nike-vomero-18-se": ("나이키 보메로 18 SE", ["보메로", "18"]),
    "nike-vomero-plus": ("나이키 보메로 플러스", ["보메로", "플러스"]),
    "nike-vomero-premium": ("나이키 보메로 프리미엄", ["보메로", "프리미엄"]),
    "nike-structure-26": ("나이키 스트럭처 26", ["스트럭처", "26"]),
    "nike-structure-plus": ("나이키 스트럭처 플러스", ["스트럭처", "플러스"]),
    "nike-zoomfly-6": ("나이키 줌 플라이 6", ["줌", "플라이", "6"]),
    "nike-vaporfly-4": ("나이키 베이퍼플라이 4", ["베이퍼플라이", "4"]),
    "nike-alphafly-4": ("나이키 알파플라이 4", ["알파플라이", "4"]),
    "nike-alphafly-3": ("나이키 알파플라이 3", ["알파플라이", "3"]),
    "nike-streakfly-2": ("나이키 스트릭플라이 2", ["스트릭플라이", "2"]),
    "nike-winflow-12": ("나이키 윈플로 12", ["윈플로", "12"]),
    "nike-quest-7": ("나이키 퀘스트 7", ["퀘스트", "7"]),
    "nike-journey-run": ("나이키 저니 런", ["저니", "런"]),
    "nike-rival-fly-4": ("나이키 라이벌 플라이 4", ["라이벌", "플라이", "4"]),
    "adidas-adistar-3": ("아디다스 아디스타 3", ["아디스타", "3"]),
    "adidas-adistar-5": ("아디다스 아디스타 5", ["아디스타", "5"]),
    "adidas-adizero-adios-9": ("아디다스 아디오스 9", ["아디오스", "9"]),
    "adidas-adizero-adios-pro-4": ("아디다스 아디오스 프로 4", ["아디오스", "프로", "4"]),
    "adidas-adizero-adios-pro-5": ("아디다스 아디오스 프로 5", ["아디오스", "프로", "5"]),
    "adidas-adizero-adios-pro-evo-2": ("아디다스 아디오스 프로 에보 2", ["에보", "2"]),
    "adidas-adizero-adios-satisfy": ("아디다스 아디오스 새티스파이", ["아디오스", "새티스파이"]),
    "adidas-adizero-boston-12": ("아디다스 보스턴 12", ["보스턴", "12"]),
    "adidas-adizero-boston-13": ("아디다스 보스턴 13", ["보스턴", "13"]),
    "adidas-adizero-evo-sl": ("아디다스 에보 SL", ["에보", "SL"]),
    "adidas-adizero-prime-x3-strung": ("아디다스 프라임 X3", ["프라임", "X3"]),
    "adidas-adizero-sl-2": ("아디다스 아디제로 SL2", ["아디제로", "SL"]),
    "adidas-duramo-sl-2": ("아디다스 듀라모 SL 2", ["듀라모", "SL"]),
    "adidas-duramo-speed-2": ("아디다스 듀라모 스피드 2", ["듀라모", "스피드"]),
    "adidas-galaxy-8": ("아디다스 갤럭시 8", ["갤럭시", "8"]),
    "adidas-hyperboost-edge": ("아디다스 하이퍼부스트 엣지", ["하이퍼부스트"]),
    "adidas-runpalcon-5": ("아디다스 런팔콘 5", ["런팔콘", "5"]),
    "adidas-supernova-ease-2": ("아디다스 슈퍼노바 이즈 2", ["슈퍼노바", "이즈"]),
    "adidas-supernova-prima-3": ("아디다스 슈퍼노바 프리마 3", ["슈퍼노바", "프리마"]),
    "adidas-supernova-rise-2": ("아디다스 슈퍼노바 라이즈 2", ["슈퍼노바", "라이즈", "2"]),
    "adidas-supernova-rise-3": ("아디다스 슈퍼노바 라이즈 3", ["슈퍼노바", "라이즈", "3"]),
    "adidas-ultraboost-5x": ("아디다스 울트라부스트 5X", ["울트라부스트", "5X"]),
}

EXCLUDE_TOKENS = ("키즈", "주니어", "아동", "유아", "인펀트", "토들러", "베이비", "어린이", "초등", "양말", "가방", "모자", "의류", "재킷", "티셔츠", "팬츠")
EXCLUDE_EN_RE = re.compile(r"\b(?:KIDS?|JUNIOR|JR|INFANT|TODDLER|BABY|YOUTH|GS|PS|TD|EL\s+[IC])\b", re.I)
CARD_RE = re.compile(r'href="/product/([^"?]+)[^"]*"(.*?)(?=ProdCard_root|$)', re.S)
PRICE_RE = re.compile(r"(\d{2,3},\d{3})\s*원")


def is_excluded_title(title: str) -> bool:
    return any(bad in title for bad in EXCLUDE_TOKENS) or bool(EXCLUDE_EN_RE.search(title))


def fetch_thehyundai_lowest(query: str, required_tokens: list[str]) -> tuple[int, str, str] | None:
    """Render hi.thehyundai.com search page with headless Edge and extract lowest matching price."""
    url = f"https://hi.thehyundai.com/search?tab=product&q={urllib.parse.quote(query)}&disPlaySize=36"
    proc = subprocess.run(
        [EDGE_EXE, "--headless", "--disable-gpu", "--virtual-time-budget=5500", "--dump-dom", url],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="ignore",
        timeout=25,
    )
    html = proc.stdout or ""
    matches = []
    for pid, body in CARD_RE.findall(html):
        texts = [" ".join(t.split()) for t in re.findall(r">([^<]{2,80})<", body) if t.strip()]
        full_text = " ".join(texts)
        if is_excluded_title(full_text):
            continue
        if not all(tok in full_text for tok in required_tokens):
            continue
        prices = [int(p.replace(",", "")) for p in PRICE_RE.findall(full_text)]
        prices = [p for p in prices if p >= 30000]
        if not prices:
            continue
        # Lowest price shown on card is final discounted price
        best_price = min(prices)
        title = next((t for t in texts if any(tok in t for tok in required_tokens)), full_text[:60])
        matches.append((best_price, f"https://hi.thehyundai.com/product/{pid}", title))

    if not matches:
        return None
    matches.sort(key=lambda x: x[0])
    return matches[0]


def main() -> None:
    if not Path(EDGE_EXE).exists():
        print("Edge not found:", EDGE_EXE)
        return

    data = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    updated = 0
    for shoe in data["shoes"]:
        rule = SEARCH_RULES.get(shoe["id"])
        if not rule:
            continue
        query, tokens = rule
        result = fetch_thehyundai_lowest(query, tokens)
        for offer in shoe.get("offers", []):
            if offer["store"] == "더현대닷컴 (현대백화점)":
                if result:
                    price, url, title = result
                    offer["price_krw"] = price
                    offer["url"] = url
                    print(f"OK  {shoe['id']:22s} -> {price:,}원 | {title}")
                    updated += 1
                else:
                    offer["price_krw"] = None
                    offer["url"] = ""
                    print(f"--  {shoe['id']:22s} -> 성인용 매칭 상품 없음 (링크 미연결)")

    txt = json.dumps(data, ensure_ascii=False, indent=2)
    JSON_PATH.write_text(txt + "\n", encoding="utf-8")
    JS_PATH.write_text("window.SHOES_DATA = " + txt + ";\n", encoding="utf-8")
    print(f"\nDone: {updated} / {len(data['shoes'])} models updated with The Hyundai prices.")


if __name__ == "__main__":
    main()
