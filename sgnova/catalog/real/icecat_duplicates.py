#!/usr/bin/env python3
"""Flag regional/duplicate Icecat SKUs before publication.

Two verified Icecat records are treated as the same customer-facing product
when brand + model match AND every specification value is identical apart
from colour/packaging/identifier fields. Capacity, colour and configuration
variants differ in specs, so they are kept as separate products. For each
duplicate group the record with the most images (then lowest part code) stays
publishable; the others get a review blocker naming it. Nothing is deleted.
"""
import collections
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import validate_records as v  # noqa: E402

D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "verified-icecat")
IGNORE = re.compile(r"ean|upc|gtin|sku|part|package|packaging|quantity|country of origin|harmonized|weight|width|depth|height|dimensions|pallet|layer|case|carton", re.I)
NOTE = "Possible duplicate of {keep} (same model and specifications, different regional part code); publish only one."


def spec_signature(r):
    # Colour stays in: a white and a black model are separate products.
    return tuple(sorted((s["label"], s["value"]) for s in r["specs"] if not IGNORE.search(s["label"])))


def main():
    recs = {f[:-5]: json.load(open(os.path.join(D, f))) for f in os.listdir(D) if f.endswith(".json")}
    groups = collections.defaultdict(list)
    for h, r in recs.items():
        model = re.sub(r"[^a-z0-9]+", "", v.norm(r["model"]))
        groups[(v.norm(r["brand"]), model, spec_signature(r))].append(h)
    flagged = 0
    for h, r in recs.items():  # clear previous duplicate notes (idempotent)
        r["review_notes"] = [n for n in r.get("review_notes", []) if not n.startswith("Possible duplicate of")]
    for hs in groups.values():
        if len(hs) < 2:
            continue
        hs.sort(key=lambda h: (-len(recs[h]["images"]), recs[h]["mpn"]))
        for h in hs[1:]:
            recs[h]["review_notes"].append(NOTE.format(keep=hs[0]))
            flagged += 1
    for h, r in recs.items():
        r["review_blockers"] = list(r["review_notes"])
        json.dump(r, open(os.path.join(D, h + ".json"), "w"), indent=1, ensure_ascii=False)
    print(json.dumps({"records": len(recs), "duplicate_groups": sum(len(g) > 1 for g in groups.values()), "flagged_duplicates": flagged}))


if __name__ == "__main__":
    main()
