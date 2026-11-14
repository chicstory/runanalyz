"""Fetch authentic Galleria Mall prices and product links for Nike shoes in data/shoes.json."""

import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
JSON_PATH = BASE_DIR / "data" / "shoes.json"
JS_PATH = BASE_DIR / "data" / "shoes.js"

# Strict search queries and required title tokens to prevent false matches (kids/other generations)
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

EXCLUDE_TOKENS = ("키즈", "주니어", "아동", "유아", "GS", "PS", "TD", "양말", "가방", "모자", "의류", "재킷", "티셔츠", "팬츠")

CARD_RE = re.compile(
    r"goods_no\s*:\s*'(\d+)'.*?>([^<]+)</a></span></dt>.*?<dd class=\"gdCost\"><span class=\"prc\"><em class=\"ir\">판매가</em><b>([\d,]+)</b>원",
    re.S,
)


def fetch_galleria_lowest(query: str, required_tokens: list[str]) -> tuple[int, str, str] | None:
    """Return (lowest_price_krw, product_url, matched_title) from Galleria Mall search."""
    url = "https://www.galleria.co.kr/search/totalSearch.action?searchTerm=" + urllib.parse.quote(query)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        html = resp.read().decode("utf-8", "ignore")

    matches = []
    for goods_no, title, price_str in CARD_RE.findall(html):
        clean_title = " ".join(title.split())
        if any(bad in clean_title for bad in EXCLUDE_TOKENS):
            continue
        if not all(tok in clean_title for tok in required_tokens):
            continue
        price = int(price_str.replace(",", ""))
        if price < 30000:
            continue
        detail_url = f"https://www.galleria.co.kr/goods/initDetailGoods.action?goods_no={goods_no}"
        matches.append((price, detail_url, clean_title))

    if not matches:
        return None
    matches.sort(key=lambda x: x[0])
    return matches[0]


def main() -> None:
    data = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    updated = 0
    for shoe in data["shoes"]:
        rule = SEARCH_RULES.get(shoe["id"])
        if not rule:
            continue
        query, tokens = rule
        result = fetch_galleria_lowest(query, tokens)
        for offer in shoe.get("offers", []):
            if offer["store"] == "갤러리아몰":
                if result:
                    price, url, title = result
                    offer["price_krw"] = price
                    offer["url"] = url
                    print(f"OK  {shoe['id']:22s} -> {price:,}원 | {title}")
                    updated += 1
                else:
                    # Fallback to clean Galleria Mall search URL if no exact item found
                    offer["price_krw"] = None
                    offer["url"] = "https://www.galleria.co.kr/search/totalSearch.action?searchTerm=" + urllib.parse.quote(query)
                    print(f"--  {shoe['id']:22s} -> 매칭 상품 없음 (검색 링크 유지)")

    txt = json.dumps(data, ensure_ascii=False, indent=2)
    JSON_PATH.write_text(txt + "\n", encoding="utf-8")
    JS_PATH.write_text("window.SHOES_DATA = " + txt + ";\n", encoding="utf-8")
    print(f"\nDone: {updated} / {len(data['shoes'])} models updated with Galleria Mall prices.")


if __name__ == "__main__":
    main()
