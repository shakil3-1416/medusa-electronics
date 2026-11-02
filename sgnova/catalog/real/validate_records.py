#!/usr/bin/env python3
"""Verify real-product records before they may be imported into Medusa.

Input : sgnova/catalog/real/records/*.json   (hand-curated candidate records)
Output: sgnova/catalog/real/verified/<handle>.json   (records that passed)
        sgnova/catalog/real/validation-report.json  (every record, pass/fail)
        apps/storefront/public/catalog-real/<handle>/<n>.<ext> (licensed photos)

Rules (a record fails on any violation):
1. Schema: required fields present, category exists, >= MIN_SPECS specs.
2. Authorized spec source: the spec URL's host must belong to the brand's
   official manufacturer domains (BRAND_DOMAINS). Distributor feeds would be
   added here once a supplier grants access.
3. Exact model match: every `model_match` string must appear in the fetched
   official page, and must not be immediately followed by a sibling-model
   suffix (Pro, Plus, Max, Ultra, mini, ...) unless the suffix is part of it.
4. Verified specifications: every spec's `evidence` (defaults to `value`)
   must appear verbatim as whole tokens (after whitespace/case/dash
   normalisation) in the same official page. Evidence shorter than
   MIN_EVIDENCE_LEN must also follow its `context` phrase nearby. The page's SHA-256 and retrieval time are recorded.
5. Genuine, licensed photos: each image is a Wikimedia Commons file whose
   licence, read from the Commons API, is on LICENSE_ALLOWLIST and is not
   under review or deletion (DISPUTED_CATEGORY_MARKERS); the file
   title, description or categories must exactly reference the model
   (same suffix rule); minimum 600 px on the long side. Author, licence,
   licence URL and source page are recorded for attribution.
6. Price: optional. Without a sourced BDT price the record is imported as an
   unpriced draft and flagged `price_status=pending_merchant_input`.

Fetched pages are cached in .cache/ (git-ignored) and never committed.
Python standard library only; run with `python3 -I`.
"""
import datetime as dt
import gzip
import hashlib
import html
import json
import os
import re
import ssl
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "../../.."))
RECORDS = os.path.join(HERE, "records")
VERIFIED = os.path.join(HERE, "verified")
CACHE = os.path.join(HERE, ".cache")
REPORT = os.path.join(HERE, "validation-report.json")
IMG_OUT = os.path.join(ROOT, "apps/storefront/public/catalog-real")
CATEGORIES = os.path.join(ROOT, "sgnova/catalog/categories.json")

UA = "MedusaBDCatalogVerifier/1.0 (catalog provenance check; non-commercial test)"
MIN_SPECS = 5
IMAGE_WIDTH = 1200
MIN_IMAGE_SIDE = 600
MIN_EVIDENCE_LEN = 12
CONTEXT_WINDOW = 300
COMMONS_DELAY = 2.0
# Commons maintenance categories meaning the licence is not settled.
DISPUTED_CATEGORY_MARKERS = (
    "license review needed", "license review", "copyright violation",
    "deletion requests", "possibly unfree", "no permission", "no source",
    "unknown license",
)

BRAND_DOMAINS = {
    "Apple": ["apple.com"],
    "Samsung": ["samsung.com", "semiconductor.samsung.com"],
    "Google": ["store.google.com", "support.google.com", "google.com"],
    "Lenovo": ["lenovo.com", "psref.lenovo.com"],
    "AMD": ["amd.com"],
    "Intel": ["intel.com"],
    "NVIDIA": ["nvidia.com"],
    "Raspberry Pi": ["raspberrypi.com"],
    "Logitech": ["logitech.com", "logitechg.com"],
    "Sony": ["sony.com", "electronics.sony.com", "sony.co.uk"],
    "TP-Link": ["tp-link.com"],
    "Fairphone": ["fairphone.com", "support.fairphone.com"],
    "Western Digital": ["westerndigital.com", "wd.com"],
    "Seagate": ["seagate.com"],
    "Crucial": ["crucial.com"],
    "Kingston": ["kingston.com"],
    "Corsair": ["corsair.com"],
    "ASUS": ["asus.com"],
    "Microsoft": ["microsoft.com"],
    "Valve": ["steamdeck.com", "steampowered.com"],
    "Framework": ["frame.work"],
    "Dell": ["dell.com"],
    "HP": ["hp.com"],
    "Keychron": ["keychron.com"],
    "Netgear": ["netgear.com"],
    "Ubiquiti": ["ui.com"],
    "MikroTik": ["mikrotik.com"],
    "Brother": ["brother.com", "brother-usa.com"],
    "Epson": ["epson.com"],
    "Canon": ["canon.com", "usa.canon.com"],
    "APC": ["apc.com", "se.com"],
    "Garmin": ["garmin.com"],
    "Xiaomi": ["mi.com"],
    "OnePlus": ["oneplus.com"],
    "Nothing": ["nothing.tech", "us.nothing.tech"],
}

LICENSE_ALLOWLIST = {
    "cc0", "public domain", "pd", "cc by 2.0", "cc by 3.0", "cc by 4.0",
    "cc by-sa 2.0", "cc by-sa 2.5", "cc by-sa 3.0", "cc by-sa 4.0",
}

SIBLING_SUFFIXES = {
    "pro", "plus", "max", "ultra", "mini", "lite", "se", "fe", "air", "+", "xl",
    "ti", "super", "x3d", "s", "e", "a", "neo", "edge",
}


def now():
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


def norm(text):
    text = unicodedata.normalize("NFKC", html.unescape(text))
    text = re.sub(r"[‐-―−]", "-", text)
    text = text.replace(" ", " ").replace(" ", " ")
    text = re.sub(r"[‘’]", "'", text)
    text = re.sub(r"[“”″]", '"', text)
    return re.sub(r"\s+", " ", text).strip().lower()


def page_text(raw):
    raw = re.sub(r"(?is)<(script|style|noscript|svg)[^>]*>.*?</\1>", " ", raw)
    raw = re.sub(r"(?s)<[^>]+>", " ", raw)
    return norm(raw)


# python.org builds on macOS ship without a CA bundle; use the system one.
_CAFILE = next((p for p in ("/etc/ssl/cert.pem", "/etc/ssl/certs/ca-certificates.crt")
                if os.path.exists(p)), None)
SSL_CTX = ssl.create_default_context(cafile=_CAFILE)


def http_get(url, binary=False, attempts=4):
    """GET with backoff on HTTP 429/503 (Commons rate-limits bursts)."""
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en"})
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(req, timeout=30, context=SSL_CTX) as resp:
                data = resp.read()
                if resp.headers.get("Content-Encoding") == "gzip":
                    data = gzip.decompress(data)
                return (data if binary else data.decode("utf-8", "replace")), resp.geturl()
        except urllib.error.HTTPError as e:
            if e.code not in (429, 503) or attempt == attempts - 1:
                raise
            time.sleep(int(e.headers.get("Retry-After") or 0) or 5 * (attempt + 1))


def fetch_source(url):
    os.makedirs(CACHE, exist_ok=True)
    key = hashlib.sha256(url.encode()).hexdigest()[:24]
    path = os.path.join(CACHE, key + ".html")
    meta_path = path + ".json"
    if os.path.exists(path) and os.path.exists(meta_path):
        meta = json.load(open(meta_path))
        return open(path, encoding="utf-8").read(), meta
    raw, final_url = http_get(url)
    meta = {
        "url": url,
        "final_url": final_url,
        "retrieved_at": now(),
        "sha256": hashlib.sha256(raw.encode("utf-8")).hexdigest(),
    }
    open(path, "w", encoding="utf-8").write(raw)
    json.dump(meta, open(meta_path, "w"))
    time.sleep(0.5)
    return raw, meta


def contains_exact(haystack, needle):
    """Needle present in haystack, not continued by a sibling-model suffix."""
    n = norm(needle)
    for m in re.finditer(re.escape(n), haystack):
        before = haystack[m.start() - 1] if m.start() else " "
        if before.isalnum():
            continue
        rest = haystack[m.end():m.end() + 12]
        if rest[:1].isalnum():
            continue
        nxt = re.match(r"[\s\-]*([a-z0-9+]+)", rest)
        if nxt and nxt.group(1) in SIBLING_SUFFIXES and rest[:1] in " -":
            continue
        return True
    return False


def contains_value(haystack, needle):
    """Needle present as whole tokens: "12GB" must not match inside "512GB"."""
    n = norm(needle)
    pre = r"(?<![a-z0-9])" if n[:1].isalnum() else ""
    post = r"(?![a-z0-9])" if n[-1:].isalnum() else ""
    return re.search(pre + re.escape(n) + post, haystack) is not None


NUM = re.compile(r"\d+(?:[.,]\d+)*")


def value_consistent(value, evidence, context):
    """Every number shown to shoppers must come from the verified evidence."""
    allowed = {n.replace(",", "") for n in NUM.findall(norm(f"{evidence} {context or ''}"))}
    return all(n.replace(",", "") in allowed for n in NUM.findall(norm(value)))


def spec_verified(haystack, evidence, context):
    """Long evidence must appear verbatim. Short evidence (e.g. "128GB") is
    ambiguous on a full spec page, so it must also follow its `context`
    phrase (e.g. "Capacity") within CONTEXT_WINDOW characters."""
    if len(evidence) >= MIN_EVIDENCE_LEN:
        return contains_value(haystack, evidence)
    if not context:
        return False
    n = norm(evidence)
    pre = r"(?<![a-z0-9])" if n[:1].isalnum() else ""
    post = r"(?![a-z0-9])" if n[-1:].isalnum() else ""
    for m in re.finditer(pre + re.escape(n) + post, haystack):
        window = haystack[max(0, m.start() - CONTEXT_WINDOW):m.start()]
        if norm(context) in window:
            return True
    return False


def host_allowed(url, brand):
    host = urllib.parse.urlparse(url).hostname or ""
    return any(host == d or host.endswith("." + d) for d in BRAND_DOMAINS.get(brand, []))


def commons_info(file_title):
    params = {
        "action": "query", "titles": file_title, "prop": "imageinfo|categories",
        "iiprop": "url|size|mime|sha1|extmetadata", "iiurlwidth": str(IMAGE_WIDTH),
        "cllimit": "50", "format": "json",
    }
    data, _ = http_get("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params))
    time.sleep(COMMONS_DELAY)
    pages = json.loads(data)["query"]["pages"]
    page = next(iter(pages.values()))
    if "missing" in page or not page.get("imageinfo"):
        return None
    info = page["imageinfo"][0]
    meta = {k: re.sub(r"<[^>]+>", "", str(v.get("value", ""))).strip()
            for k, v in info.get("extmetadata", {}).items()}
    return {
        "title": page["title"],
        "categories": [c["title"] for c in page.get("categories", [])],
        "width": info["width"], "height": info["height"], "mime": info["mime"],
        "sha1": info["sha1"], "original_url": info["url"],
        "thumb_url": info.get("thumburl") or info["url"],
        "page_url": info["descriptionurl"],
        "license": meta.get("LicenseShortName", ""),
        "license_url": meta.get("LicenseUrl", ""),
        "artist": meta.get("Artist", ""),
        "credit": meta.get("Credit", ""),
        "description": meta.get("ImageDescription", ""),
        "attribution_required": meta.get("AttributionRequired", ""),
    }


def license_ok(name):
    n = norm(name).replace("-sa ", "-sa ")
    return n in LICENSE_ALLOWLIST or n.startswith("public domain") or n.startswith("pd-")


def validate(rec, categories):
    errors, warnings = [], []
    req = ["handle", "brand", "model", "category_handle", "title", "description",
           "spec_source", "model_match", "specs", "images"]
    for k in req:
        if not rec.get(k):
            errors.append(f"missing field: {k}")
    if errors:
        return errors, warnings, None
    if not re.fullmatch(r"real-[a-z0-9-]+", rec["handle"]):
        errors.append("handle must match real-[a-z0-9-]+")
    if rec["category_handle"] not in categories:
        errors.append(f"unknown category {rec['category_handle']}")
    if len(rec["specs"]) < MIN_SPECS:
        errors.append(f"only {len(rec['specs'])} specs (min {MIN_SPECS})")

    src = rec["spec_source"]
    if not host_allowed(src["url"], rec["brand"]):
        errors.append(f"spec source {src['url']} is not an official {rec['brand']} domain")
        return errors, warnings, None
    try:
        raw, meta = fetch_source(src["url"])
    except Exception as e:  # network or HTTP error
        errors.append(f"spec source fetch failed: {e}")
        return errors, warnings, None
    if not host_allowed(meta["final_url"], rec["brand"]):
        errors.append(f"spec source redirected off-domain to {meta['final_url']}")
    text = page_text(raw)
    # Multi-model pages (e.g. one page for every Pixel phone) must be scoped to
    # the product's own section so evidence cannot come from a sibling.
    if src.get("scope_start"):
        start = text.find(norm(src["scope_start"]))
        if start < 0:
            errors.append(f"scope_start '{src['scope_start']}' not found in spec source")
        else:
            after = start + len(norm(src["scope_start"]))
            end = text.find(norm(src["scope_end"]), after) if src.get("scope_end") else -1
            text = text[start:end if end > start else None]
    if len(text) < 500:
        errors.append("spec source has no readable text (likely client-rendered)")
    for m in rec["model_match"]:
        if not contains_exact(text, m):
            errors.append(f"model '{m}' not found as exact match in spec source")
    verified_specs = []
    for s in rec["specs"]:
        ev = s.get("evidence") or s["value"]
        if not value_consistent(s["value"], ev, s.get("context")):
            errors.append(f"spec '{s['label']}': value '{s['value']}' has numbers not in its evidence")
        elif spec_verified(text, ev, s.get("context")):
            verified_specs.append({"group": s["group"], "label": s["label"], "value": s["value"]})
        else:
            hint = "" if len(ev) >= MIN_EVIDENCE_LEN or s.get("context") else " (short evidence needs context)"
            errors.append(f"spec '{s['label']}': evidence '{ev}' not in spec source{hint}")

    images = []
    for i, img in enumerate(rec["images"]):
        try:
            info = commons_info(img["commons_file"])
        except Exception as e:
            errors.append(f"image {img['commons_file']}: Commons API failed: {e}")
            continue
        if not info:
            errors.append(f"image {img['commons_file']}: not found on Commons")
            continue
        disputed = [c for c in info["categories"]
                    if any(mk in c.lower() for mk in DISPUTED_CATEGORY_MARKERS)]
        if disputed:
            errors.append(f"image {info['title']}: licence not settled on Commons ({disputed[0]})")
            continue
        if not license_ok(info["license"]):
            errors.append(f"image {info['title']}: licence '{info['license']}' not allowed")
            continue
        blob = norm(" ".join([info["title"], info["description"], *info["categories"]]))
        ev = img.get("model_evidence") or rec["model"]
        if not contains_exact(blob, ev):
            errors.append(f"image {info['title']}: no exact model reference '{ev}'")
            continue
        if max(info["width"], info["height"]) < MIN_IMAGE_SIDE:
            errors.append(f"image {info['title']}: resolution too low")
            continue
        if not info["artist"]:
            warnings.append(f"image {info['title']}: no artist metadata; credit 'Wikimedia Commons contributor'")
        images.append({**info, "index": i + 1})

    if not images:
        errors.append("no verified licensed photograph")
    price = rec.get("price")
    if price and not (price.get("amount_bdt") and price.get("source_url")):
        errors.append("price given without amount_bdt and source_url")
    if not price:
        warnings.append("no sourced BDT price: import as unpriced draft")

    verified = None
    if not errors:
        verified = {
            "handle": rec["handle"], "brand": rec["brand"], "model": rec["model"],
            "mpn": rec.get("mpn"), "category_handle": rec["category_handle"],
            "title": rec["title"], "subtitle": rec.get("subtitle", ""),
            "description": rec["description"], "variant_title": rec.get("variant_title", "Default"),
            "specs": verified_specs,
            "highlights": rec.get("highlights", [])[:4],
            "review_notes": rec.get("review_notes", []),
            "price": price,
            "provenance": {
                "spec_source": {**src, **meta, "type": "manufacturer"},
                "verified_at": now(),
                "verifier": "sgnova/catalog/real/validate_records.py",
            },
            "images": images,
        }
    return errors, warnings, verified


def download_image(handle, img):
    ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}.get(img["mime"], "jpg")
    if img["thumb_url"].endswith(".png"):
        ext = "png"
    elif img["thumb_url"].lower().endswith((".jpg", ".jpeg")):
        ext = "jpg"
    d = os.path.join(IMG_OUT, handle)
    os.makedirs(d, exist_ok=True)
    path = os.path.join(d, f"{img['index']}.{ext}")
    if not os.path.exists(path):
        data, _ = http_get(img["thumb_url"], binary=True)
        open(path, "wb").write(data)
        time.sleep(0.3)
    data = open(path, "rb").read()
    img["local_path"] = f"/catalog-real/{handle}/{img['index']}.{ext}"
    img["local_sha256"] = hashlib.sha256(data).hexdigest()
    img["local_bytes"] = len(data)
    return img


def main():
    only = set(sys.argv[1:])
    categories = {c["handle"] for c in json.load(open(CATEGORIES))}
    os.makedirs(VERIFIED, exist_ok=True)
    records = []
    for name in sorted(os.listdir(RECORDS)):
        if name.endswith(".json"):
            data = json.load(open(os.path.join(RECORDS, name)))
            records.extend(data if isinstance(data, list) else [data])
    report = []
    seen = set()
    for rec in records:
        h = rec.get("handle", "?")
        if only and h not in only:
            continue
        if h in seen:
            report.append({"handle": h, "status": "fail", "errors": ["duplicate handle"], "warnings": []})
            continue
        seen.add(h)
        errors, warnings, verified = validate(rec, categories)
        if verified:
            try:
                verified["images"] = [download_image(h, i) for i in verified["images"]]
            except Exception as e:
                errors.append(f"image download failed: {e}")
                verified = None
        out = os.path.join(VERIFIED, h + ".json")
        if verified:
            json.dump(verified, open(out, "w"), indent=1, ensure_ascii=False)
        elif os.path.exists(out):
            os.remove(out)
        report.append({
            "handle": h, "brand": rec.get("brand"), "model": rec.get("model"),
            "category": rec.get("category_handle"),
            "status": "pass" if verified else "fail",
            "errors": errors, "warnings": warnings,
            "image_licenses": [i["license"] for i in verified["images"]] if verified else [],
            "review_notes": rec.get("review_notes", []),
        })
        mark = "PASS" if verified else "FAIL"
        print(f"{mark} {h}" + ("" if verified else "  <- " + "; ".join(errors[:3])))
    if not only:
        json.dump({"generated_at": now(), "records": report}, open(REPORT, "w"), indent=1)
    passed = sum(r["status"] == "pass" for r in report)
    print(f"\n{passed}/{len(report)} records verified")


if __name__ == "__main__":
    main()
