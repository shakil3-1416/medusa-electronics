#!/usr/bin/env python3
"""Gate for replacing the synthetic catalog with the verified real one.

The synthetic catalog may only be unpublished once every criterion passes.
This script only reports; it never changes the database.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
VERIFIED = os.path.join(HERE, "verified")
REPORT = os.path.join(HERE, "validation-report.json")

MIN_PRODUCTS = 500
MIN_CATEGORIES = 20


def main():
    records = [json.load(open(os.path.join(VERIFIED, f)))
               for f in sorted(os.listdir(VERIFIED)) if f.endswith(".json")]
    report = json.load(open(REPORT))["records"] if os.path.exists(REPORT) else []
    cats = {}
    for r in records:
        cats[r["category_handle"]] = cats.get(r["category_handle"], 0) + 1
    with_photo = sum(bool(r["images"]) for r in records)
    priced = sum(bool(r.get("price")) for r in records)
    licences = {}
    for r in records:
        for i in r["images"]:
            licences[i["license"]] = licences.get(i["license"], 0) + 1
    checks = [
        (f"verified products >= {MIN_PRODUCTS}", len(records) >= MIN_PRODUCTS, len(records)),
        (f"categories >= {MIN_CATEGORIES}", len(cats) >= MIN_CATEGORIES, len(cats)),
        ("every product has a licensed photo", with_photo == len(records) and records, with_photo),
        ("every product has a sourced BDT price", priced == len(records) and records, priced),
    ]
    summary = {
        "verified": len(records),
        "attempted": len(report),
        "failed": sum(r["status"] == "fail" for r in report),
        "categories": dict(sorted(cats.items())),
        "photo_licences": licences,
        "checks": [{"check": c, "pass": bool(ok), "actual": a} for c, ok, a in checks],
        "ready_to_replace_synthetic": all(ok for _, ok, _ in checks),
    }
    print(json.dumps(summary, indent=1))
    return 0 if summary["ready_to_replace_synthetic"] else 1


if __name__ == "__main__":
    sys.exit(main())
