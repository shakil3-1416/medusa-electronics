#!/usr/bin/env python3
"""Triage manual-review notes on verified records into blocking vs informational.

Informational notes document provenance or classification choices that were
checked against the official source; they stay visible but do not block
publication. Every other note is blocking until a person resolves it (photo
generation/revision, configuration, multi-column tables, inferred variants).
Rules live in INFO_RULES with the reason each one is safe. Writes
`review_blockers` / `review_info` on records/ and verified/ files and
prints a summary. Idempotent.
"""
import glob
import json
import re

INFO_RULES = [
    (r"official drivers & support page", "Spec source is AMD's own official support page."),
    (r"AMD's own reference \(MBA\) board", "Reference board sold by AMD; specs are AMD's own."),
    (r"^Category .* used for|Sold as a bare board without enclosure", "Category choice only; product identity verified."),
    (r"smallest memory option|uses the 256GB configuration", "Configuration chosen from options listed on the official page."),
    (r"CPU speed shown on the page without a unit", "Value copied exactly as published."),
    (r"Spanish-language regional overview", "Official ASUS regional page; values verified verbatim."),
    (r"Page describes the PMW3366 version", "Listing follows the official page's sensor version."),
    (r"original Blue Yeti Nano name", "Official page confirms 'Yeti Nano'; only the brand prefix changed."),
    (r"titled 'G PRO TKL', matching the tenkeyless", "Official page confirms the tenkeyless G PRO."),
    (r"Spec table on se\.com is script-rendered", "Specs from the official se.com page title and bullets; photo is the exact SMT1500I."),
    (r"^Verified from photo:", "Identity confirmed by evidence visible in the licensed photo itself."),
]


# Checked first: anything about a regional/other SKU in the photo stays blocking.
BLOCKING_OVERRIDES = [r"Taiwan SKU|-TW\b|regional configuration|different product"]


def classify(note):
    if any(re.search(p, note) for p in BLOCKING_OVERRIDES):
        return "blocking", None
    for pattern, reason in INFO_RULES:
        if re.search(pattern, note):
            return "info", reason
    return "blocking", None


def apply(path_glob, multi):
    changed = 0
    for path in glob.glob(path_glob):
        data = json.load(open(path))
        recs = data if multi else [data]
        for r in recs:
            notes = r.get("review_notes") or []
            if isinstance(notes, str):
                notes = [notes]
            blockers = [n for n in notes if classify(n)[0] == "blocking"]
            info = [n for n in notes if classify(n)[0] == "info"]
            if r.get("review_blockers") != blockers or r.get("review_info") != info:
                r["review_notes"], r["review_blockers"], r["review_info"] = notes, blockers, info
                changed += 1
        json.dump(data, open(path, "w"), indent=1, ensure_ascii=False)
    return changed


if __name__ == "__main__":
    apply("records/*.json", multi=True)
    apply("verified/*.json", multi=False)
    flagged = blocked = 0
    for p in glob.glob("verified/*.json"):
        r = json.load(open(p))
        flagged += bool(r.get("review_notes"))
        blocked += bool(r.get("review_blockers"))
    print(json.dumps({"flagged": flagged, "still_blocked": blocked, "resolved_to_info_only": flagged - blocked}))
