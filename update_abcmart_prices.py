"""Fetch authentic ABC-Mart & Grand Stage (a-rt.com) running shoe prices via category pages."""

import json
import re
import subprocess
from pathlib import Path

from shoe_search_rules import SEARCH_RULES, matches_rule

BASE_DIR = Path(__file__).resolve().parent
JSON_PATH = BASE_DIR / "data" / "shoes.json"
JS_PATH = BASE_DIR / "data" / "shoes.js"
EDGE_EXE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

CHANNELS = [
    (
        "abcmart",
        "https://abcmart.a-rt.com/display/category/main?ntab&genderGbnCode=10000&page={page}&channel=10001&chnnlNo=10001&ctgrNo=1000000250",
        "https://abcmart.a-rt.com/product/new?prdtNo=",
    ),
    (
        "grandstage",
        "https://grandstage.a-rt.com/display/category/main?genderGbnCode=10000&ctgrNo=1000000288&page={page}",
        "https://grandstage.a-rt.com/product/new?prdtNo=",
    ),
]

BRAND_TOKENS = {
    "nike": ("나이키", "NIKE"),
    "adidas": ("아디다스", "ADIDAS"),
    "asics": ("아식스", "ASICS"),
    "mizuno": ("미즈노", "MIZUNO"),
    "newbalance": ("뉴발란스", "NEW BALANCE"),
    "saucony": ("써코니", "SAUCONY"),
    "puma": ("푸마", "PUMA"),
    "hoka": ("호카", "HOKA"),
    "brooks": ("브룩스", "BROOKS"),
}

LINK_RE = re.compile(r'prdtNo=(\d+)"[^>]*class="prod-link"')
PRICE_RE = re.compile(r"(\d{2,3},\d{3})")
CLEAN_PRICE_RE = re.compile(r"\b\d{1,3},\d{3}\b|\[\d+%\]|퀵뷰 레이어 팝업 보기|즐겨찾기|장바구니 담기|바로구매|입고알림|매장재고확인")


def fetch_page_items(url: str, base_product_url: str) -> list[tuple[str, str, str, int, str]]:
    """Return list of (prdt_no, title_only, full_text, lowest_price, product_url) from a rendered category page."""
    proc = subprocess.run(
        [EDGE_EXE, "--headless", "--disable-gpu", "--virtual-time-budget=5500", "--dump-dom", url],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="ignore",
        timeout=25,
    )
    html = proc.stdout or ""
    matches = list(LINK_RE.finditer(html))
    items = []
    for i, m in enumerate(matches):
        pid = m.group(1)
        end = matches[i + 1].start() if i + 1 < len(matches) else min(len(html), m.end() + 12000)
        blk = html[m.end():end]
        # Cut off at pagination or footer if last item
        for stop_tok in ("pagination", "footer", "prod-list-wrap"):
            idx = blk.find(stop_tok)
            if idx != -1:
                blk = blk[:idx]
        texts = [" ".join(t.split()) for t in re.findall(r">([^<]{1,80})<", blk) if t.strip()]
        # Drop shoe-size numbers (200..330)
        texts = [t for t in texts if not (t.isdigit() and 200 <= int(t) <= 330)]
        full_text = " ".join(texts)
        prices = [int(p.replace(",", "")) for p in PRICE_RE.findall(full_text)]
        prices = [p for p in prices if p >= 30000]
        if not prices:
            continue
        title_only = " ".join(CLEAN_PRICE_RE.sub(" ", full_text).split())
        sale_price = min(prices)
        items.append((pid, title_only, full_text, sale_price, f"{base_product_url}{pid}"))
    return items


def collect_catalog(max_pages: int = 12) -> list[tuple[str, str, int, str]]:
    catalog = []
    seen_pids = set()
    for name, tpl, base_prod in CHANNELS:
        for page in range(1, max_pages + 1):
            url = tpl.format(page=page)
            items = fetch_page_items(url, base_prod)
            new_items = [it for it in items if it[0] not in seen_pids]
            print(f"[{name}] page {page}: {len(items)} items ({len(new_items)} new)")
            if not new_items:
                break
            for it in new_items:
                seen_pids.add(it[0])
                catalog.append(it)
    return catalog


def main() -> None:
    if not Path(EDGE_EXE).exists():
        print("Edge not found:", EDGE_EXE)
        return

    catalog = collect_catalog(max_pages=12)
    print(f"\nTotal unique A-RT running items collected: {len(catalog)}\n")

    data = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    updated = 0
    for shoe in data["shoes"]:
        rule = SEARCH_RULES.get(shoe["id"])
        if not rule:
            continue
        b_tokens = BRAND_TOKENS.get(shoe["brand"], (shoe["brand"],))
        matches = []
        for pid, title_only, full_text, price, url in catalog:
            upper_title = title_only.upper()
            if not any(bt in upper_title for bt in b_tokens):
                continue
            if matches_rule(title_only, rule):
                matches.append((price, url, title_only))
        matches.sort(key=lambda x: x[0])
        best = matches[0] if matches else None

        offers = shoe.setdefault("offers", [])
        target = next((o for o in offers if "ABC마트" in o.get("store", "")), None)
        if target is None:
            target = {"store": "ABC마트 · 그랜드스테이지", "price_krw": None, "url": ""}
            # Insert before Coupang (keep Coupang at bottom)
            coupang_idx = next((i for i, o in enumerate(offers) if "쿠팡" in o.get("store", "")), len(offers))
            offers.insert(coupang_idx, target)

        if best:
            price, url, title = best
            target["price_krw"] = price
            target["url"] = url
            print(f"OK  {shoe['id']:30s} -> {price:,}원 | {title[:70]}")
            updated += 1
        else:
            target["price_krw"] = None
            target["url"] = ""

    txt = json.dumps(data, ensure_ascii=False, indent=2)
    JSON_PATH.write_text(txt + "\n", encoding="utf-8")
    JS_PATH.write_text("window.SHOES_DATA = " + txt + ";\n", encoding="utf-8")
    print(f"\nDone: {updated} / {len(data['shoes'])} models updated with ABC-Mart / Grand Stage prices.")


if __name__ == "__main__":
    main()
