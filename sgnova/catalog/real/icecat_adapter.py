#!/usr/bin/env python3
"""Open Icecat adapter for the verified real-product pipeline.

Looks up products by brand + manufacturer part number (or GTIN) through the
Icecat Live JSON API, applies the same quality gates as validate_records.py
(exact manufacturer/model, specifications, accessible images, documented
usage rights) and writes products that pass everything to
`verified-icecat/<handle>.json`, which import-verified-catalog.ts imports as
unpriced drafts.

Access modes
  registered  ICECAT_USERNAME (+ ICECAT_APP_KEY or ICECAT_API_TOKEN /
              ICECAT_CONTENT_TOKEN for Full Icecat brands) and
              ICECAT_OCL_ACCEPTED=1, meaning the account holder accepted the
              Open Content License Agreement. Only this mode establishes image
              and content usage rights.
  demo        `--demo`: Icecat's public demo shop name `openicecat-live`.
              Used only to test the integration. Content is staged for
              inspection but never treated as licensed or imported.

Icecat content is licensed to the account holder, so staging, cache and
verified Icecat files are git-ignored; only this adapter and the target list
are committed. Requests are throttled (fair-use policy).

Usage:
  python3 -I icecat_adapter.py [--demo] [--expand] [--max-requests N]
"""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import validate_records as v  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
TARGETS = os.path.join(HERE, "icecat", "targets.json")
CACHE = os.path.join(HERE, "icecat", ".cache")
STAGING = os.path.join(HERE, "icecat", "staging")
VERIFIED = os.path.join(HERE, "verified-icecat")
REPORT = os.path.join(HERE, "icecat", "staging-report.json")

CONFIG = os.path.join(HERE, "icecat", "icecat.env")
INDEX_TARGETS = os.path.join(HERE, "icecat", "targets.index.json")
API = "https://live.icecat.biz/api"
DEMO_SHOP = "openicecat-live"
REQUEST_DELAY = 1.2
MIN_SPECS = 5
MAX_IMAGES = 4
OCL_URL = "https://icecat.biz/en/menu/partners/index.html"
AS_IS = ("Product data and images are provided by Open Icecat \"AS IS\", without "
         "warranty of any kind; Icecat and the manufacturer disclaim liability for errors.")

# Icecat category name -> storefront category handle(s) it may be filed under.
CATEGORY_MAP = {
    "Motherboards": {"motherboard"},
    "Memory Modules": {"desktop-ram", "laptop-ram"},
    "Internal Hard Drives": {"hard-drive"},
    "Internal Solid State Drives": {"internal-ssd"},
    "External Solid State Drives": {"external-storage"},
    "External Hard Drives": {"external-storage"},
    "Power Supply Units": {"power-supply"},
    "Computer Cooling Systems": {"cpu-cooler"},
    "Scanners": {"scanner"},
    "Uninterruptible Power Supplies (UPSs)": {"ups"},
    "Computer Monitors": {"office-monitor", "gaming-monitor"},
    "Webcams": {"webcam"},
    "Laptops": {"business-laptop", "gaming-laptop"},
    "PCs/Workstations": {"desktop-pc"},
    "Printers": {"printer"},
    "Multifunction Printers": {"printer"},
    "Graphics Cards": {"graphics-card"},
    "Processors": {"processor"},
    "Computer Cases": {"computer-case"},
    "Microphones": {"microphone"},
    "Headphones & Headsets": {"headphone"},
    "Keyboards": {"mechanical-keyboard"},
    "Mice": {"gaming-mouse"},
    "Network Switches": {"network-switch"},
    "Wireless Routers": {"router"},
}


def load_config():
    """Read KEY=VALUE lines from the git-ignored icecat/icecat.env into the
    environment (existing environment variables win). Values are never printed."""
    if not os.path.exists(CONFIG):
        return False
    for line in open(CONFIG):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
    return True


def credentials(demo):
    if demo:
        return {"shopname": DEMO_SHOP}, {}, "demo"
    user = os.environ.get("ICECAT_USERNAME")
    if not user:
        return None, None, "missing"
    params, headers = {"shopname": user}, {}
    if os.environ.get("ICECAT_APP_KEY"):
        params["app_key"] = os.environ["ICECAT_APP_KEY"]
    if os.environ.get("ICECAT_API_TOKEN"):
        headers["api-token"] = os.environ["ICECAT_API_TOKEN"]
    if os.environ.get("ICECAT_CONTENT_TOKEN"):
        headers["content-token"] = os.environ["ICECAT_CONTENT_TOKEN"]
    return params, headers, "registered"


def fetch(query, auth_params, headers, mode, allow_network=True):
    """Product JSON for a query (cached per mode). Credentials never hit disk.
    Returns (None, False) when uncached and the request budget is spent."""
    os.makedirs(CACHE, exist_ok=True)
    key = re.sub(r"[^a-z0-9]+", "_", f"{mode}_{json.dumps(query, sort_keys=True)}".lower())[:150]
    path = os.path.join(CACHE, key + ".json")
    if os.path.exists(path):
        return json.load(open(path)), False
    if not allow_network:
        return None, False
    url = API + "?" + urllib.parse.urlencode({"lang": "EN", **auth_params, **query})
    req = urllib.request.Request(url, headers={"User-Agent": v.UA, **headers})
    try:
        with urllib.request.urlopen(req, timeout=40, context=v.SSL_CTX) as resp:
            body = resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
    time.sleep(REQUEST_DELAY)
    try:
        data = json.loads(body, strict=False)
    except json.JSONDecodeError:
        data = {"StatusCode": -1, "Message": "unparseable response"}
    data["_retrieved_at"] = v.now()
    json.dump(data, open(path, "w"))
    return data, True


def brand_matches(target, icecat_brand):
    a, b = v.norm(target), v.norm(icecat_brand)
    return a == b or b.startswith(a + " ") or a.startswith(b + " ")


def slug(*parts):
    return re.sub(r"[^a-z0-9]+", "-", " ".join(parts).lower()).strip("-")


def specs_from(data):
    groups = []
    for fg in data.get("FeaturesGroups", []):
        items = []
        for f in fg.get("Features", []):
            name = (f.get("Feature", {}).get("Name", {}) or {}).get("Value")
            value = f.get("PresentationValue") or f.get("Value")
            if name and value not in (None, "", "N", "No"):
                items.append({"label": name, "value": str(value), "icecat_feature_id": f.get("Feature", {}).get("ID")})
        if items:
            groups.append({"group": fg["FeatureGroup"]["Name"]["Value"], "items": items[:12]})
    return groups


def check_image(url):
    try:
        req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": v.UA})
        with urllib.request.urlopen(req, timeout=30, context=v.SSL_CTX) as resp:
            return resp.status == 200 and resp.headers.get("Content-Type", "").startswith("image/")
    except Exception:
        return False


def gate(target, data, mode):
    """Return (stages, errors, verified_record_or_None)."""
    stages = dict(found=False, exact_model=False, category=False, specs=False,
                  images=False, rights=False)
    errors = []
    if data.get("msg") != "OK":
        errors.append(f"lookup: {data.get('StatusCode')} {data.get('Message', '')}".strip())
        return stages, errors, None
    stages["found"] = True
    d = data["data"]
    g = d["GeneralInfo"]
    code = target.get("product_code")
    gtins = g.get("GTIN") or []
    if not brand_matches(target["brand"], g.get("Brand", "")):
        errors.append(f"brand mismatch: {g.get('Brand')}")
    elif code and v.norm(g.get("BrandPartCode", "")) != v.norm(code):
        errors.append(f"part code mismatch: {g.get('BrandPartCode')}")
    elif target.get("gtin") and target["gtin"].lstrip("0") not in [x.lstrip("0") for x in gtins]:
        errors.append("GTIN mismatch")
    else:
        stages["exact_model"] = True
    icecat_cat = g.get("Category", {}).get("Name", {}).get("Value", "")
    if icecat_cat == "Memory Modules":
        # Laptop vs desktop RAM comes from the module form factor in Icecat's
        # own generated title, never from the product it was linked from.
        gen = ((g.get("TitleInfo") or {}).get("GeneratedLocalTitle") or {}).get("Value", "")
        target = {**target, "category_handle":
                  "laptop-ram" if re.search(r"so-?dimm", f"{gen} {g.get('Title', '')}", re.I) else "desktop-ram"}
    if re.search(r"(-RFB|refurbished|renewed)", f"{g.get('BrandPartCode', '')} {g.get('Title', '')}", re.I):
        errors.append("refurbished SKU excluded")
    stages["filed_as"] = target["category_handle"]
    if target["category_handle"] in CATEGORY_MAP.get(icecat_cat, set()):
        stages["category"] = True
    else:
        errors.append(f"category mismatch: Icecat '{icecat_cat}' vs {target['category_handle']}")
    specs = specs_from(d)
    if sum(len(x["items"]) for x in specs) >= MIN_SPECS:
        stages["specs"] = True
    else:
        errors.append("fewer than 5 Icecat specifications")
    gallery = [x for x in d.get("Gallery", [])
               if x.get("IsPrivate") == "0" and x.get("Type", "ProductImage") == "ProductImage"
               and urllib.parse.urlparse(x.get("Pic", "")).hostname == "images.icecat.biz"
               and max(int(x.get("PicWidth") or 0), int(x.get("PicHeight") or 0)) >= v.MIN_IMAGE_SIDE]
    gallery.sort(key=lambda x: (x.get("IsMain") != "Y", int(x.get("No") or 0)))
    images = []
    for x in gallery[:MAX_IMAGES]:
        if check_image(x["Pic"]):
            images.append(x)
    if images:
        stages["images"] = True
    else:
        errors.append("no public, accessible product image >= 600 px")
    if mode == "registered" and os.environ.get("ICECAT_OCL_ACCEPTED") == "1":
        stages["rights"] = True
    else:
        errors.append("usage rights not established: needs a registered Open Icecat account "
                      "with the Open Content License accepted (ICECAT_OCL_ACCEPTED=1)")
    if errors:
        return stages, errors, None

    brand = g.get("BrandInfo", {}).get("BrandName") or g["Brand"]
    desc = (g.get("Description") or {})
    summary = (g.get("SummaryDescription") or {})
    handle = "real-" + slug(target["brand"], g["BrandPartCode"])
    icecat_page = (desc.get("URL") or f"https://icecat.biz/p/{g['IcecatId']}")
    record = {
        "handle": handle,
        "brand": target["brand"],
        "model": g.get("ProductName") or g["BrandPartCode"],
        "mpn": g["BrandPartCode"],
        "gtin": gtins[:3],
        "category_handle": target["category_handle"],
        "title": g.get("Title") or f"{brand} {g.get('ProductName')}",
        "subtitle": (summary.get("ShortSummaryDescription") or "")[:180],
        "description": re.sub(r"<[^>]+>", " ", desc.get("LongDesc") or summary.get("LongSummaryDescription") or "").strip()[:2000],
        "variant_title": "Default",
        "specs": [{"group": s["group"], "label": i["label"], "value": i["value"]} for s in specs for i in s["items"]],
        "highlights": [],
        "price": None,
        "review_notes": [],
        "content_source": "open-icecat",
        "disclaimer": AS_IS,
        "provenance": {
            "spec_source": {
                "type": "open-icecat",
                "publisher": f"{brand} via Open Icecat",
                "url": icecat_page,
                "final_url": icecat_page,
                "icecat_id": g["IcecatId"],
                "retrieved_at": data.get("_retrieved_at"),
            },
            "verified_at": v.now(),
            "verifier": "sgnova/catalog/real/icecat_adapter.py",
        },
        "images": [{
            "title": f"Icecat image {x.get('ID')}",
            "artist": f"{brand} via Open Icecat",
            "credit": "Open Icecat",
            "license": "Open Icecat Open Content License",
            "license_url": OCL_URL,
            "page_url": icecat_page,
            "local_path": x["Pic"],
            "card_path": x.get("Pic500x500") or x["Pic"],
            "width": int(x.get("PicWidth") or 0),
            "height": int(x.get("PicHeight") or 0),
            "index": n + 1,
        } for n, x in enumerate(images)],
    }
    return stages, errors, record


def related_targets(data, parent, open_brands):
    """Icecat's own "alternative" products in the parent's Icecat category.

    Only same-category alternatives from open brands are followed; each one is
    looked up and gated independently, so nothing is assumed from the link.
    """
    d = data.get("data") or {}
    cat_id = str((d.get("GeneralInfo", {}).get("Category") or {}).get("CategoryID", ""))
    out = []
    for r in d.get("ProductRelated") or []:
        if r.get("RelationTypeCode") != "alternative" or str(r.get("CategoryID")) != cat_id:
            continue
        brand = next((b for b in open_brands if brand_matches(b, r.get("Brand") or "")), None)
        if brand and r.get("ProductCode"):
            out.append({"brand": brand, "product_code": r["ProductCode"],
                        "category_handle": parent["category_handle"], "origin": "icecat-alternative"})
    return out


def main():
    demo = "--demo" in sys.argv
    expand = "--expand" in sys.argv
    max_requests = int(sys.argv[sys.argv.index("--max-requests") + 1]) if "--max-requests" in sys.argv else 150
    load_config()
    auth, headers, mode = credentials(demo)
    if mode == "missing":
        sys.exit("ICECAT_USERNAME is not set (environment or sgnova/catalog/real/icecat/icecat.env). Register a free Open Icecat account, accept the "
                 "Open Content License, then set ICECAT_USERNAME (and ICECAT_APP_KEY for Full "
                 "Icecat brands) and ICECAT_OCL_ACCEPTED=1. Use --demo to test the integration.")
    cfg = json.load(open(TARGETS))
    targets = list(cfg["targets"])
    if os.path.exists(INDEX_TARGETS) and not demo:
        # Discovered from the registered account's Open Icecat index (git-ignored).
        targets += json.load(open(INDEX_TARGETS))
    wanted = set(cfg.get("expand_categories", []))
    per_category_cap = cfg.get("per_category_cap", 25)
    per_category = {}
    for t in targets:
        per_category[t["category_handle"]] = per_category.get(t["category_handle"], 0) + 1
    existing = {f[:-5] for d in (v.VERIFIED, VERIFIED) if os.path.isdir(d)
                for f in os.listdir(d) if f.endswith(".json")}
    os.makedirs(STAGING, exist_ok=True)
    os.makedirs(VERIFIED, exist_ok=True)
    seen, rows, requests = set(), [], 0
    queue = list(targets)
    while queue:
        t = queue.pop(0)
        key = (v.norm(t["brand"]), v.norm(t.get("product_code") or t.get("gtin", "")))
        if key in seen:
            continue
        seen.add(key)
        query = {"Brand": t["brand"], "ProductCode": t["product_code"]} if t.get("product_code") else {"GTIN": t["gtin"]}
        data, fresh = fetch(query, auth, headers, mode, allow_network=requests < max_requests)
        if data is None:
            rows.append({**t, "status": "skipped", "errors": ["request budget reached"]})
            continue
        requests += fresh
        stages, errors, record = gate(t, data, mode)
        handle = record["handle"] if record else "real-" + slug(t["brand"], t.get("product_code") or t.get("gtin", ""))
        if handle in existing and not record and os.path.exists(os.path.join(v.VERIFIED, handle + ".json")):
            errors.append("already verified through the Commons pipeline")
        row = {**t, "category_handle": stages.get("filed_as", t["category_handle"]),
               "handle": handle, "stages": stages, "errors": errors,
               "status": "verified" if record else "staged" if stages["found"] else "not_found"}
        if stages["found"]:
            g = data["data"]["GeneralInfo"]
            row["icecat"] = {"id": g["IcecatId"], "title": g.get("Title", "")[:120],
                             "category": g.get("Category", {}).get("Name", {}).get("Value")}
        rows.append(row)
        if record:
            json.dump(record, open(os.path.join(VERIFIED, handle + ".json"), "w"), indent=1, ensure_ascii=False)
        if expand and stages["found"] and t["category_handle"] in wanted:
            for x in related_targets(data, t, cfg["open_brands"]):
                if per_category.get(x["category_handle"], 0) < per_category_cap:
                    per_category[x["category_handle"]] = per_category.get(x["category_handle"], 0) + 1
                    queue.append(x)
        if len(rows) % 25 == 0:  # checkpoint: partial report survives interruption
            json.dump({"generated_at": v.now(), "mode": mode, "partial": True, "rows": rows},
                      open(REPORT, "w"), ensure_ascii=False)
        mark = {"verified": "PASS", "staged": "STAGED", "not_found": "MISS"}[row["status"]]
        print(f"{mark:6} {t['brand']:12} {str(t.get('product_code') or t.get('gtin')):22} "
              f"{'' if record else '; '.join(errors)[:110]}")
    stage_names = ["found", "exact_model", "category", "specs", "images", "rights"]
    summary = {
        "generated_at": v.now(), "mode": mode, "requests": requests, "targets": len(rows),
        "stage_counts": {s: sum(bool(r.get("stages", {}).get(s)) for r in rows) for s in stage_names},
        "verified": sum(r["status"] == "verified" for r in rows),
        "rows": rows,
    }
    json.dump(summary, open(REPORT, "w"), indent=1, ensure_ascii=False)
    print(json.dumps({k: summary[k] for k in ("mode", "requests", "targets", "stage_counts", "verified")}))


if __name__ == "__main__":
    main()
