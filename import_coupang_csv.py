"""Sync Coupang Rocket Delivery prices and affiliate URLs from data/shoes_list.csv into shoes.json / shoes.js."""

import csv
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
CSV_PATH = BASE_DIR / "data" / "shoes_list.csv"
JSON_PATH = BASE_DIR / "data" / "shoes.json"
JS_PATH = BASE_DIR / "data" / "shoes.js"


def main() -> None:
    if not CSV_PATH.exists():
        print("CSV not found:", CSV_PATH)
        return

    coupang_map: dict[str, tuple[int | None, str]] = {}
    with CSV_PATH.open("r", encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            sid = (row.get("id") or "").strip()
            price_raw = (row.get("coupang_price_krw") or "").replace(",", "").strip()
            url = (row.get("coupang_url") or "").strip()
            if not sid or (not price_raw and not url):
                continue
            price = int(price_raw) if price_raw.isdigit() else None
            coupang_map[sid] = (price, url)

    data = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    updated = 0
    for shoe in data["shoes"]:
        if shoe["id"] not in coupang_map:
            continue
        price, url = coupang_map[shoe["id"]]
        offers = shoe.setdefault("offers", [])
        target = next((o for o in offers if "쿠팡" in o.get("store", "")), None)
        if target is None:
            target = {"store": "쿠팡 (로켓배송)", "price_krw": None, "url": ""}
            offers.append(target)
        target["price_krw"] = price
        target["url"] = url
        # Ensure Coupang always stays at the bottom of offers
        offers[:] = [o for o in offers if o is not target] + [target]
        print(f"OK  {shoe['id']:28s} -> {price:,}원 | {url}")
        updated += 1

    txt = json.dumps(data, ensure_ascii=False, indent=2)
    JSON_PATH.write_text(txt + "\n", encoding="utf-8")
    JS_PATH.write_text("window.SHOES_DATA = " + txt + ";\n", encoding="utf-8")
    print(f"\nDone: {updated} Coupang offer(s) synced.")


if __name__ == "__main__":
    main()
