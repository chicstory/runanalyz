"""Fetch official brand-store prices for ASICS, Saucony, and Puma into offers ('공식 홈페이지')."""

import html as html_lib
import json
import re
import subprocess
import urllib.parse
import urllib.request
from pathlib import Path

from shoe_search_rules import SEARCH_RULES, matches_rule

BASE_DIR = Path(__file__).resolve().parent
JSON_PATH = BASE_DIR / "data" / "shoes.json"
JS_PATH = BASE_DIR / "data" / "shoes.js"
EDGE_EXE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

PRICE_WON_RE = re.compile(r"(\d{2,3},\d{3})\s*원")
PRICE_NUM_RE = re.compile(r"\b(\d{2,3},\d{3})\b")


def fetch_asics_official(shoe: dict, rule: dict) -> tuple[int, str, str] | None:
    """Fetch lowest adult price from asics.co.kr search via headless Edge."""
    matches = []
    for query in rule["queries"]:
        q_clean = re.sub(r"^(?:아식스|ASICS)\s+", "", query, flags=re.I)
        url = "https://www.asics.co.kr/goods/search?keyword_log_flag=Y&search_text=" + urllib.parse.quote(q_clean)
        proc = subprocess.run(
            [EDGE_EXE, "--headless", "--disable-gpu", "--virtual-time-budget=5500", "--dump-dom", url],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="ignore",
            timeout=25,
        )
        dom = proc.stdout or ""
        prev_end = 0
        for m in PRICE_WON_RE.finditer(dom):
            price = int(m.group(1).replace(",", ""))
            if price < 30000:
                prev_end = m.end()
                continue
            start = max(prev_end, m.start() - 900)
            blk = dom[start:m.start()]
            prev_end = m.end()
            texts = [" ".join(t.split()) for t in re.findall(r">([^<]{2,80})<", blk) if t.strip()]
            full_text = " ".join(texts[-6:])
            if matches_rule(full_text, rule):
                matches.append((price, shoe["links"]["official"], full_text))
        if matches:
            break
    if not matches:
        return None
    matches.sort(key=lambda x: x[0])
    return matches[0]


def fetch_saucony_official(rule: dict) -> tuple[int, str, str] | None:
    """Fetch lowest adult price from saucony.co.kr search HTML."""
    matches = []
    prod_re = re.compile(r'product_no=(\d+)')
    for query in rule["queries"]:
        q_clean = re.sub(r"^(?:써코니|SAUCONY)\s+", "", query, flags=re.I)
        url = "https://www.saucony.co.kr/search?q=" + urllib.parse.quote(q_clean)
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        html = urllib.request.urlopen(req, timeout=10).read().decode("utf-8", "ignore")
        seen = set()
        for m in prod_re.finditer(html):
            pid = m.group(1)
            if pid in seen:
                continue
            seen.add(pid)
            blk = html[m.start():m.start() + 5000]
            # Stop at next product_no if present
            nxt = prod_re.search(blk[50:])
            if nxt:
                blk = blk[:50 + nxt.start()]
            texts = [" ".join(t.split()) for t in re.findall(r">([^<]{2,80})<", blk) if t.strip()]
            title_text = " ".join(t for t in texts if not PRICE_NUM_RE.fullmatch(t))
            if not matches_rule(title_text, rule):
                continue
            prices = [int(p.replace(",", "")) for p in PRICE_NUM_RE.findall(blk)]
            prices = [p for p in prices if p >= 30000]
            if not prices:
                continue
            sale_price = min(prices)
            detail_url = f"https://www.saucony.co.kr/product/detail.html?product_no={pid}"
            matches.append((sale_price, detail_url, title_text[:60]))
        if matches:
            break
    if not matches:
        return None
    matches.sort(key=lambda x: x[0])
    return matches[0]


def fetch_puma_official(rule: dict) -> tuple[int, str, str] | None:
    """Fetch lowest adult price from kr.puma.com search HTML."""
    matches = []
    pd_re = re.compile(r'(/kr/ko/pd/[^"\'\s<]+)')
    for query in rule["queries"]:
        url = "https://kr.puma.com/kr/ko/search?q=" + urllib.parse.quote(query)
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        html = urllib.request.urlopen(req, timeout=12).read().decode("utf-8", "ignore")
        prev_end = 0
        for m in PRICE_WON_RE.finditer(html):
            price = int(m.group(1).replace(",", ""))
            if price < 30000:
                prev_end = m.end()
                continue
            start = max(prev_end, m.start() - 1800)
            blk = html[start:m.end()]
            prev_end = m.end()
            texts = [" ".join(t.split()) for t in re.findall(r">([^<]{2,80})<", blk) if t.strip()]
            title_text = " ".join(t for t in texts[-8:] if not PRICE_WON_RE.search(t))
            if not matches_rule(title_text, rule):
                continue
            pd_links = pd_re.findall(blk)
            if not pd_links:
                continue
            rel = html_lib.unescape(pd_links[-1])
            detail_url = "https://kr.puma.com" + rel
            matches.append((price, detail_url, title_text[:60]))
        if matches:
            break
    if not matches:
        return None
    matches.sort(key=lambda x: x[0])
    return matches[0]


def main() -> None:
    data = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    updated = 0
    for shoe in data["shoes"]:
        brand = shoe["brand"]
        if brand not in ("asics", "saucony", "puma"):
            continue
        rule = SEARCH_RULES.get(shoe["id"])
        if not rule:
            continue

        result = None
        if brand == "asics":
            result = fetch_asics_official(shoe, rule)
        elif brand == "saucony":
            result = fetch_saucony_official(rule)
        elif brand == "puma":
            result = fetch_puma_official(rule)

        offers = shoe.setdefault("offers", [])
        target = next((o for o in offers if "공식 홈페이지" in o.get("store", "")), None)
        if target is None:
            target = {"store": "공식 홈페이지 (브랜드 직영)", "price_krw": None, "url": ""}
            offers.insert(0, target)

        if result:
            price, url, title = result
            target["price_krw"] = price
            target["url"] = url
            print(f"OK  {shoe['id']:30s} -> {price:,}원 | {title}")
            updated += 1
        else:
            target["price_krw"] = None
            target["url"] = ""
            print(f"--  {shoe['id']:30s} -> 공식몰 성인용 매칭 없음")

    txt = json.dumps(data, ensure_ascii=False, indent=2)
    JSON_PATH.write_text(txt + "\n", encoding="utf-8")
    JS_PATH.write_text("window.SHOES_DATA = " + txt + ";\n", encoding="utf-8")
    print(f"\nDone: {updated} official brand-store offers updated (ASICS/Saucony/Puma).")


if __name__ == "__main__":
    main()
