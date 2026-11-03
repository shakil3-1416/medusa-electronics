#!/usr/bin/env python3
"""Rebuild verified-icecat/ records from cached registered responses (no new
downloads), re-applying the current gate. Image URLs already present in the
previous verified record are trusted (they passed the live checks and the full
image audit); any new URL is checked live. Usage: python3 -I icecat_regate.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import icecat_adapter as a  # noqa: E402

a.load_config()
auth, headers, mode = a.credentials(False)
if mode != "registered":
    sys.exit("Registered Icecat configuration required (icecat/icecat.env).")
live_check = a.check_image
kept = dropped = missing = 0
for name in sorted(os.listdir(a.VERIFIED)):
    path = os.path.join(a.VERIFIED, name)
    old = json.load(open(path))
    trusted = {i["local_path"] for i in old["images"]}
    a.check_image = lambda url: url in trusted or live_check(url)
    target = {"brand": old["brand"], "product_code": old["mpn"], "category_handle": old["category_handle"]}
    data, _ = a.fetch({"Brand": target["brand"], "ProductCode": target["product_code"]}, auth, headers, mode,
                      allow_network=False)
    if data is None:
        missing += 1
        continue
    _, errors, new = a.gate(target, data, mode)
    if new and new["handle"] == old["handle"]:
        json.dump(new, open(path, "w"), indent=1, ensure_ascii=False)
        kept += 1
    else:
        os.remove(path)
        dropped += 1
        print("dropped", old["handle"], errors[:1])
with_hl = sum(bool(json.load(open(os.path.join(a.VERIFIED, f))).get("highlights")) for f in os.listdir(a.VERIFIED))
print(json.dumps({"kept": kept, "dropped": dropped, "no_cache": missing, "with_key_features": with_hl}))
