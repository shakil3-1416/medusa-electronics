#!/usr/bin/env python3
"""Discover lookup targets from the registered account's Open Icecat index.

Downloads (HTTP Basic auth, user name + password from icecat/icecat.env) and
streams the Open Icecat ("freexml") index files, so nothing large is held in
memory:
  refs/CategoriesList.xml.gz   category id -> English name
  refs/SuppliersList.xml.gz    supplier id -> brand name
  EN/daily.index.xml           products changed today (default)
  EN/files.index.csv.gz        full index (--full; large, downloaded once)

Keeps rows that are on the market, have a manufacturer part number, a high
resolution image (>= 600 px) and Icecat/supplier-approved quality, in a
category mapped by icecat_adapter.CATEGORY_MAP, from brands not on the
restricted list. Missing storefront categories come first; each category is
capped. Writes icecat/targets.index.json (git-ignored: derived from Icecat
data), which icecat_adapter.py reads in registered mode.

Usage: python3 -I icecat_index.py [--full] [--cap N] [--total N]
"""
import base64
import csv
import gzip
import io
import json
import os
import shutil
import sys
import urllib.request
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import icecat_adapter as a  # noqa: E402
import validate_records as v  # noqa: E402

BASE = "https://data.icecat.biz/export/freexml"
INDEX_DIR = os.path.join(a.HERE, "icecat", "index")
PRIORITY = ["motherboard", "laptop-ram", "hard-drive", "power-supply", "cpu-cooler", "scanner"]
RESTRICTED_BRANDS = {"apple", "logitech"}  # returned "brand restrictions" on Open Icecat
GOOD_QUALITY = {"icecat", "supplier"}
MIN_SIDE = v.MIN_IMAGE_SIDE

ALIASES = {
    "product_id": ["product_id", "productid"],
    "prod_id": ["prod_id", "m_prod_id", "productcode"],
    "supplier_id": ["supplier_id", "supplierid"],
    "supplier_name": ["supplier_name", "m_supplier_name"],
    "catid": ["catid", "category_id"],
    "on_market": ["on_market", "onmarket"],
    "quality": ["quality"],
    "high_pic": ["high_pic", "highpic"],
    "high_pic_width": ["high_pic_width", "highpicwidth"],
    "high_pic_height": ["high_pic_height", "highpicheight"],
    "model_name": ["model_name", "modelname"],
    "ean": ["ean_upcs", "ean_upc", "ean"],
}


def auth_header():
    user, pw = os.environ.get("ICECAT_USERNAME"), os.environ.get("ICECAT_PASSWORD")
    if not (user and pw):
        sys.exit("ICECAT_USERNAME and ICECAT_PASSWORD are required for index feeds "
                 "(set them in sgnova/catalog/real/icecat/icecat.env).")
    return "Basic " + base64.b64encode(f"{user}:{pw}".encode()).decode()


def download(path, auth, refresh=False):
    """Stream a feed file to icecat/index/ (cached; credentials never stored)."""
    os.makedirs(INDEX_DIR, exist_ok=True)
    out = os.path.join(INDEX_DIR, path.replace("/", "_"))
    if os.path.exists(out) and not refresh:
        return out
    req = urllib.request.Request(f"{BASE}/{path}", headers={"Authorization": auth, "User-Agent": v.UA,
                                                            "Accept-Encoding": "gzip"})
    with urllib.request.urlopen(req, timeout=600, context=v.SSL_CTX) as resp, open(out + ".part", "wb") as f:
        shutil.copyfileobj(resp, f, length=1 << 20)
    os.replace(out + ".part", out)
    return out


def open_text(path):
    raw = open(path, "rb")
    head = raw.read(2)
    raw.seek(0)
    return io.TextIOWrapper(gzip.GzipFile(fileobj=raw) if head == b"\x1f\x8b" else raw, encoding="utf-8", errors="replace")


def categories(path):
    names = {}
    for _, el in ET.iterparse(open_text(path)):
        if el.tag == "Category" and el.get("ID"):
            for n in el.findall("Name"):
                if n.get("langid") == "1" and n.get("Value"):
                    names[el.get("ID")] = n.get("Value")
            el.clear()
    return names


def suppliers(path):
    out = {}
    for _, el in ET.iterparse(open_text(path)):
        if el.tag == "Supplier" and el.get("ID"):
            out[el.get("ID")] = el.get("Name") or ""
            el.clear()
    return out


def pick(row, field):
    for k in ALIASES[field]:
        for key in (k, k.capitalize(), k.upper()):
            if key in row and row[key] not in (None, ""):
                return row[key]
    lowered = {k.lower(): val for k, val in row.items()}
    for k in ALIASES[field]:
        if lowered.get(k) not in (None, ""):
            return lowered[k]
    return ""


def rows_from_csv(path):
    reader = csv.DictReader(open_text(path), delimiter="\t")
    if not reader.fieldnames or not any(f.lower() in ("product_id", "productid") for f in reader.fieldnames):
        sys.exit(f"Unexpected index header in {path}: {reader.fieldnames}")
    yield from reader


def rows_from_xml(path):
    for _, el in ET.iterparse(open_text(path)):
        if el.tag == "file":
            row = dict(el.attrib)
            eans = [e.get("EAN") for e in el.iter("EAN_UPC") if e.get("EAN")]
            if eans:
                row["ean_upcs"] = ";".join(eans)
            yield row
            el.clear()


def storefront_handle(cat_name, model):
    handles = a.CATEGORY_MAP.get(cat_name, set())
    if not handles:
        return None
    if len(handles) == 1:
        return next(iter(handles))
    text = model.lower()
    if cat_name == "Memory Modules":
        return "laptop-ram" if "so-dimm" in text or "sodimm" in text else "desktop-ram"
    if cat_name == "Computer Monitors":
        return "gaming-monitor" if "gaming" in text else "office-monitor"
    if cat_name == "Laptops":
        return "gaming-laptop" if "gaming" in text else "business-laptop"
    return sorted(handles)[0]


def select(rows, cats, sups, cap, total, existing):
    buckets = {}
    for r in rows:
        if str(pick(r, "on_market")) not in ("1", "true", "True"):
            continue
        if pick(r, "quality").lower() not in GOOD_QUALITY:
            continue
        code = pick(r, "prod_id").strip()
        if not code or not pick(r, "high_pic"):
            continue
        try:
            if max(int(pick(r, "high_pic_width") or 0), int(pick(r, "high_pic_height") or 0)) < MIN_SIDE:
                continue
        except ValueError:
            continue
        cat_name = cats.get(str(pick(r, "catid")), "")
        model = pick(r, "model_name")
        handle = storefront_handle(cat_name, model)
        if not handle:
            continue
        brand = (pick(r, "supplier_name") or sups.get(str(pick(r, "supplier_id")), "")).strip()
        if not brand or v.norm(brand) in RESTRICTED_BRANDS:
            continue
        key = "real-" + a.slug(brand, code)
        if key in existing:
            continue
        bucket = buckets.setdefault(handle, {})
        if len(bucket) < cap:
            bucket.setdefault(key, {"brand": brand, "product_code": code, "category_handle": handle,
                                    "icecat_id": pick(r, "product_id"), "origin": "icecat-index"})
    ordered = [h for h in PRIORITY if h in buckets] + sorted(h for h in buckets if h not in PRIORITY)
    out = []
    # Round-robin across categories so the request budget covers all of them.
    while len(out) < total and any(buckets.get(h) for h in ordered):
        for h in ordered:
            if buckets.get(h) and len(out) < total:
                out.append(buckets[h].pop(next(iter(buckets[h]))))
    return out


def main():
    a.load_config()
    cap = int(sys.argv[sys.argv.index("--cap") + 1]) if "--cap" in sys.argv else 40
    total = int(sys.argv[sys.argv.index("--total") + 1]) if "--total" in sys.argv else 500
    auth = auth_header()
    cats = categories(download("refs/CategoriesList.xml.gz", auth))
    sups = suppliers(download("refs/SuppliersList.xml.gz", auth))
    if "--full" in sys.argv:
        rows = rows_from_csv(download("EN/files.index.csv.gz", auth))
    else:
        rows = rows_from_xml(download("EN/daily.index.xml", auth, refresh=True))
    existing = {f[:-5] for d in (v.VERIFIED, a.VERIFIED) if os.path.isdir(d)
                for f in os.listdir(d) if f.endswith(".json")}
    targets = select(rows, cats, sups, cap, total, existing)
    json.dump(targets, open(a.INDEX_TARGETS, "w"), indent=1, ensure_ascii=False)
    by_cat = {}
    for t in targets:
        by_cat[t["category_handle"]] = by_cat.get(t["category_handle"], 0) + 1
    print(json.dumps({"targets": len(targets), "by_category": by_cat}))


if __name__ == "__main__":
    main()
