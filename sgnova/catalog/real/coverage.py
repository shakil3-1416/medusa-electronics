#!/usr/bin/env python3
"""Stage-by-stage coverage of the real catalog, per category.

Stages are counted separately so downloaded images are never confused with
finished products:
  attempted   records submitted to the gate
  verified    passed the gate (official specs + exact model + licensed photo)
  photos      licensed photographs stored for verified products
  drafts      verified products present in Medusa as drafts (`--db`)
  ready       verified, no manual-review notes, and a sourced BDT price

Usage: python3 -I coverage.py [--db]   (--db reads draft counts via docker psql)
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "../../.."))
VERIFIED = os.path.join(HERE, "verified")
REPORT = os.path.join(HERE, "validation-report.json")
CATEGORIES = os.path.join(ROOT, "sgnova/catalog/categories.json")


def db_drafts():
    sql = ("select handle from product where deleted_at is null and status='draft' "
           "and handle like 'real-%'")
    out = subprocess.run(["docker", "exec", "lab-medusa-db-1", "psql", "-U", "postgres",
                          "-d", "medusa_dtc", "-tAc", sql], capture_output=True, text=True)
    return {line.strip() for line in out.stdout.splitlines() if line.strip()}


def main():
    cats = [c["handle"] for c in json.load(open(CATEGORIES))]
    report = json.load(open(REPORT))["records"] if os.path.exists(REPORT) else []
    verified = {f[:-5]: json.load(open(os.path.join(VERIFIED, f)))
                for f in os.listdir(VERIFIED) if f.endswith(".json")}
    drafts = db_drafts() if "--db" in sys.argv else set()
    rows = {c: dict(attempted=0, verified=0, photos=0, multi_photo=0, drafts=0, review=0, ready=0)
            for c in cats}
    for r in report:
        if r.get("category") in rows:
            rows[r["category"]]["attempted"] += 1
    licences, failures = {}, {}
    for r in report:
        if r["status"] == "fail":
            key = r["errors"][0].split(":")[0] if r["errors"] else "unknown"
            failures[key] = failures.get(key, 0) + 1
    for h, v in verified.items():
        row = rows[v["category_handle"]]
        row["verified"] += 1
        row["photos"] += len(v["images"])
        row["multi_photo"] += len(v["images"]) > 1
        row["drafts"] += h in drafts
        row["review"] += bool(v.get("review_notes"))
        row["ready"] += bool(v.get("price")) and not v.get("review_notes")
        for i in v["images"]:
            licences[i["license"]] = licences.get(i["license"], 0) + 1
    totals = {k: sum(r[k] for r in rows.values()) for k in next(iter(rows.values()))}
    print(json.dumps({
        "totals": totals,
        "categories_with_verified": sum(r["verified"] > 0 for r in rows.values()),
        "by_category": rows,
        "photo_licences": dict(sorted(licences.items(), key=lambda x: -x[1])),
        "failure_types": failures,
    }, indent=1))


if __name__ == "__main__":
    main()
