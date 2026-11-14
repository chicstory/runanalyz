"""Fetch authentic The Hyundai (hi.thehyundai.com) prices and product links via headless Edge."""

import json
import re
import subprocess
import urllib.parse
from pathlib import Path

from shoe_search_rules import SEARCH_RULES, matches_rule

BASE_DIR = Path(__file__).resolve().parent
JSON_PATH = BASE_DIR / "data" / "shoes.json"
JS_PATH = BASE_DIR / "data" / "shoes.js"
EDGE_EXE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

CARD_RE = re.compile(r'href="/product/([^"?]+)[^"]*"(.*?)(?=ProdCard_root|$)', re.S)
PRICE_RE = re.compile(r"(\d{2,3},\d{3})\s*원")


def _search_once(query: str, brand: str, rule: dict) -> list[tuple[int, str, str]]:
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
    brand_kw = "나이키" if brand == "nike" else "아디다스"
    matches = []
    for pid, body in CARD_RE.findall(html):
        texts = [" ".join(t.split()) for t in re.findall(r">([^<]{2,80})<", body) if t.strip()]
        full_text = " ".join(texts)
        if brand_kw not in full_text:
            continue
        if not matches_rule(full_text, rule):
            continue
        prices = [int(p.replace(",", "")) for p in PRICE_RE.findall(full_text)]
        prices = [p for p in prices if p >= 30000]
        if not prices:
            continue
        best_price = min(prices)
        title = next(
            (t for t in texts if any(tok.upper() in t.upper() for grp in rule["token_groups"] for tok in grp)),
            full_text[:60],
        )
        matches.append((best_price, f"https://hi.thehyundai.com/product/{pid}", title))
    return matches


def fetch_thehyundai_lowest(brand: str, rule: dict) -> tuple[int, str, str] | None:
    """Query hi.thehyundai.com with Korean query first, falling back to English query if unmatched."""
    for query in rule["queries"]:
        matches = _search_once(query, brand, rule)
        if matches:
            matches.sort(key=lambda x: x[0])
            return matches[0]
    return None


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
        result = fetch_thehyundai_lowest(shoe["brand"], rule)
        for offer in shoe.get("offers", []):
            if offer["store"] == "더현대닷컴 (현대백화점)":
                if result:
                    price, url, title = result
                    offer["price_krw"] = price
                    offer["url"] = url
                    print(f"OK  {shoe['id']:30s} -> {price:,}원 | {title}")
                    updated += 1
                else:
                    offer["price_krw"] = None
                    offer["url"] = ""
                    print(f"--  {shoe['id']:30s} -> 성인용 매칭 상품 없음 (링크 미연결)")

    txt = json.dumps(data, ensure_ascii=False, indent=2)
    JSON_PATH.write_text(txt + "\n", encoding="utf-8")
    JS_PATH.write_text("window.SHOES_DATA = " + txt + ";\n", encoding="utf-8")
    print(f"\nDone: {updated} / {len(data['shoes'])} models updated with The Hyundai prices.")


if __name__ == "__main__":
    main()
