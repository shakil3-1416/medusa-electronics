#!/usr/bin/env python3
"""List licence-eligible Wikimedia Commons photos for an exact model.

Usage: python3 -I find_images.py "<exact model>" ["<commons search query>"]

Searches files whose title mentions the model and the model's own Commons
category (Category:<model>), then keeps only raster photos (no SVG/video
stills/charts filtered by mime), on the licence allowlist, not under licence
review, >= 600 px, whose title/description/categories reference the model
exactly (same rule as validate_records.py). Prints JSON candidates with
licence and size so a record can reference several angles. Read-only; uses
the validator's throttled, retrying HTTP client.
"""
import json
import os
import sys
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import validate_records as v  # noqa: E402

API = "https://commons.wikimedia.org/w/api.php?"


def api(params):
    data, _ = v.http_get(API + urllib.parse.urlencode({**params, "format": "json"}))
    v.time.sleep(v.COMMONS_DELAY)
    return json.loads(data)


def candidates(model, query=None, limit=25):
    titles = []
    search = api({"action": "query", "list": "search", "srnamespace": "6",
                  "srlimit": str(limit), "srsearch": query or model})
    titles += [r["title"] for r in search.get("query", {}).get("search", [])]
    cat = api({"action": "query", "list": "categorymembers", "cmtype": "file",
               "cmlimit": str(limit), "cmtitle": "Category:" + model})
    titles += [m["title"] for m in cat.get("query", {}).get("categorymembers", [])]
    seen, out = set(), []
    for t in titles:
        if t in seen or not t.lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff")):
            continue
        seen.add(t)
        info = v.commons_info(t)
        if not info or not info["mime"].startswith("image/") or info["mime"] == "image/svg+xml":
            continue
        disputed = any(mk in c.lower() for c in info["categories"] for mk in v.DISPUTED_CATEGORY_MARKERS)
        blob = v.norm(" ".join([info["title"], info["description"], *info["categories"]]))
        ok = (v.license_ok(info["license"]) and not disputed
              and max(info["width"], info["height"]) >= v.MIN_IMAGE_SIDE
              and v.contains_exact(blob, model))
        if ok:
            out.append({"commons_file": info["title"], "license": info["license"],
                        "size": f'{info["width"]}x{info["height"]}',
                        "artist": info["artist"][:60], "model_evidence": model})
    return out


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    print(json.dumps(candidates(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None), indent=1))
