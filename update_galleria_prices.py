"""Fetch authentic Galleria Mall (store_yn=Y department store only) prices and product links."""

import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

from shoe_search_rules import SEARCH_RULES, matches_rule

BASE_DIR = Path(__file__).resolve().parent
JSON_PATH = BASE_DIR / "data" / "shoes.json"
JS_PATH = BASE_DIR / "data" / "shoes.js"

CARD_RE = re.compile(
    r"goods_no\s*:\s*'(\d+)'.*?>([^<]+)</a></span></dt>.*?<dd class=\"gdCost\"><span class=\"prc\"><em class=\"ir\">판매가</em><b>([\d,]+)</b>원",
    re.S,
)


def fetch_galleria_lowest(rule: dict) -> tuple[int, str, str] | None:
    """Query Galleria Mall (department store only: store_yn=Y) with Korean & English queries."""
    matches = []
    seen_goods = set()
    for query in rule["queries"]:
        url = (
            "https://www.galleria.co.kr/search/totalSearch.action?searchTerm="
            + urllib.parse.quote(query)
            + "&store_yn=Y"
        )
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode("utf-8", "ignore")

        for goods_no, title, price_str in CARD_RE.findall(html):
            if goods_no in seen_goods:
                continue
            clean_title = " ".join(title.split())
            if not matches_rule(clean_title, rule):
                continue
            price = int(price_str.replace(",", ""))
            if price < 30000:
                continue
            seen_goods.add(goods_no)
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
        result = fetch_galleria_lowest(rule)
        for offer in shoe.get("offers", []):
            if offer["store"] == "갤러리아몰":
                if result:
                    price, url, title = result
                    offer["price_krw"] = price
                    offer["url"] = url
                    print(f"OK  {shoe['id']:30s} -> {price:,}원 | {title}")
                    updated += 1
                else:
                    offer["price_krw"] = None
                    offer["url"] = ""
                    print(f"--  {shoe['id']:30s} -> 성인용 백화점 매칭 상품 없음 (링크 미연결)")

    txt = json.dumps(data, ensure_ascii=False, indent=2)
    JSON_PATH.write_text(txt + "\n", encoding="utf-8")
    JS_PATH.write_text("window.SHOES_DATA = " + txt + ";\n", encoding="utf-8")
    print(f"\nDone: {updated} / {len(data['shoes'])} models updated with Galleria Mall (store_yn=Y) prices.")


if __name__ == "__main__":
    main()
