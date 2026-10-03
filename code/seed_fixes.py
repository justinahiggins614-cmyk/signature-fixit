#!/usr/bin/env python3
"""Seed the Mr Fix-It archive: assemble JAH-FIX-###### records from code/seed_data/fixdata_*.py.

Deterministic: same input files -> same IDs, same hashes. New seed files appended
later continue IDs from data/state.json (never duplicates, never re-IDs).

Outputs:
  data/fixes.jsonl                 full records, one JSON per line
  data/index/fixes.idx.json.gz    compact search index [id, title, field, field_id]
  data/index/fields.json          field catalog with counts
  data/state.json                 {next_index, total, updated}
  api.json                        authoritative counts manifest (repo root)
"""
import json, hashlib, gzip, os, sys, glob, importlib.util
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEED_DIR = os.path.join(ROOT, "code", "seed_data")
DATA = os.path.join(ROOT, "data")
IDX = os.path.join(DATA, "index")
BASE_URL = "https://justinahiggins614-cmyk.github.io/signature-fixit/"
MALL_URL = "https://justinahiggins614-cmyk.github.io/signature-cyber-mega-mall/"
TODAY = date.today().isoformat()

PRO_BY_FIELD = {
    "Plumbing": "licensed plumber",
    "Electrical": "licensed electrician",
    "Appliances": "appliance repair technician",
    "Heating & Cooling": "HVAC technician",
    "Automotive": "certified mechanic",
    "Computers & Cyber": "computer repair shop",
    "Phones & Tablets": "phone repair shop",
    "Home Repair": "handyman or contractor",
    "Vintage Electronics": "vintage electronics specialist",
    "Chips & Circuit Boards": "electronics repair specialist",
    "Small Engines & Tools": "small engine repair shop",
    "Lawn & Outdoor": "outdoor equipment dealer",
}

REQUIRED = ["field", "title", "symptoms", "diagnosis", "diy_title", "diy_steps",
            "time", "cost", "difficulty", "tools", "parts", "safety", "warnings", "mall"]


def load_problems():
    problems = []
    for path in sorted(glob.glob(os.path.join(SEED_DIR, "fixdata_*.py"))):
        try:
            spec = importlib.util.spec_from_file_location("seedmod", path)
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
        except SyntaxError as e:
            print(f"  WARN: skipping unparseable {os.path.basename(path)} ({e})")
            continue
        for p in mod.PROBLEMS:
            p["_src"] = os.path.basename(path)
            problems.append(p)
    return problems


def validate(problems):
    seen_titles = set()
    for i, p in enumerate(problems):
        for k in REQUIRED:
            if k not in p:
                raise ValueError(f"record {i} ({p.get('title', '?')}) missing key: {k}")
        if not p["symptoms"] or not p["diagnosis"] or not p["diy_steps"]:
            raise ValueError(f"record {i} ({p['title']}) has empty content list")
        if p["safety"] in ("MEDIUM", "HIGH") and not p["warnings"]:
            raise ValueError(f"record {i} ({p['title']}) safety={p['safety']} needs warnings")
        if p["difficulty"] not in ("Easy", "Moderate", "Hard"):
            raise ValueError(f"record {i} ({p['title']}) bad difficulty")
        if p["safety"] not in ("LOW", "MEDIUM", "HIGH"):
            raise ValueError(f"record {i} ({p['title']}) bad safety")
        t = p["title"].strip().lower()
        if t in seen_titles:
            raise ValueError(f"duplicate title: {p['title']}")
        seen_titles.add(t)
    return True


def canon_hash(obj):
    s = json.dumps(obj, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def build_records(problems, start_index=1):
    fields = {}
    records = []
    idx = start_index
    for p in problems:
        fid = f"JAH-FIX-{idx:06d}"
        if p["field"] not in fields:
            fields[p["field"]] = f"JAH-FIXFIELD-{len(fields)+1:03d}"
        field_id = fields[p["field"]]
        pro = PRO_BY_FIELD.get(p["field"], "qualified professional")
        mall_q = p["mall"].replace(" ", "+")
        rec = {
            "id": fid,
            "field": p["field"],
            "field_id": field_id,
            "title": p["title"],
            "symptoms": p["symptoms"],
            "diagnosis": p["diagnosis"],
            "solutions": [
                {"rank": 1, "kind": "DIY_FIX", "title": p["diy_title"],
                 "steps": p["diy_steps"], "difficulty": p["difficulty"],
                 "time": p["time"], "cost": p["cost"],
                 "tools": p["tools"], "parts": p["parts"]},
                {"rank": 2, "kind": "PRO_REPAIR",
                 "title": f"Have a {pro} repair it",
                 "steps": [f"If the diagnosis points past basic DIY, or the safety level is HIGH, call a {pro}.",
                           "Describe the symptoms and what you already checked — it saves diagnostic time.",
                           "Get the quote in writing before authorizing work."],
                 "note": "Best when safety is HIGH, special tools are needed, or the DIY fix did not hold."},
                {"rank": 3, "kind": "REPLACE",
                 "title": "Replace the unit or component",
                 "steps": ["If the item is old, badly worn, or repair costs approach replacement cost, replace it.",
                           "Match specifications (size, voltage, fittings) before buying.",
                           "Recycle the old unit responsibly."],
                 "note": "Best when the item is at end of life or parts are unavailable."},
                {"rank": 4, "kind": "MALL",
                 "title": "Get it free from the Signature Cyber Mega-Mall",
                 "steps": [f"Open the mall search for '{p['mall']}' and pick the free listing.",
                           "Confirm it matches your model and specifications.",
                           "The mall catalog is free — no checkout, no account."],
                 "url": f"{MALL_URL}?q={mall_q}",
                 "note": "Manon's best-option pick: when a replacement is needed, check the mall's free catalog first."},
            ],
            "safety": p["safety"],
            "warnings": p["warnings"],
            "difficulty": p["difficulty"],
            "created": TODAY,
            "version": 1,
            "status": "PUBLISHED",
            "canonical_url": f"{BASE_URL}?fix={fid}",
        }
        rec["content_hash"] = canon_hash({k: v for k, v in rec.items() if k != "content_hash"})
        records.append(rec)
        idx += 1
    return records, fields


def main():
    os.makedirs(IDX, exist_ok=True)
    problems = load_problems()
    print(f"loaded {len(problems)} problems from {SEED_DIR}")
    validate(problems)
    print("validation PASS")

    state_path = os.path.join(DATA, "state.json")
    start = 1
    if os.path.exists(state_path):
        start = json.load(open(state_path))["next_index"]

    records, fields = build_records(problems, start)
    print(f"built {len(records)} records ({start}..{start+len(records)-1})")

    # full records
    with open(os.path.join(DATA, "fixes.jsonl"), "w", encoding="utf-8") as f:
        for r in records:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    # compact search index: [id, title, field, field_id]
    with gzip.open(os.path.join(IDX, "fixes.idx.json.gz"), "wt", encoding="utf-8") as f:
        for r in records:
            f.write(json.dumps([r["id"], r["title"], r["field"], r["field_id"]], ensure_ascii=False) + "\n")

    # field catalog
    field_counts = {}
    for r in records:
        field_counts[r["field"]] = field_counts.get(r["field"], 0) + 1
    field_list = [{"field_id": fields[name], "name": name, "count": field_counts[name],
                   "pro": PRO_BY_FIELD.get(name, "qualified professional")}
                  for name in fields]
    json.dump(field_list, open(os.path.join(IDX, "fields.json"), "w"), indent=1)

    total = start + len(records) - 1
    json.dump({"next_index": total + 1, "total": total, "updated": TODAY},
              open(state_path, "w"), indent=1)

    api = {
        "site": "The Signature Mr Fix-It",
        "site_id": "SIGNATURE-FIXIT",
        "repo": "signature-fixit",
        "canonical_url": BASE_URL,
        "total_fixes": total,
        "goal": 1000000,
        "progress": f"{total} / 1,000,000",
        "fields": field_list,
        "schema_version": "JAH-FIX-RECORD/1.0",
        "index": "data/index/fixes.idx.json.gz",
        "records": "data/fixes.jsonl",
        "id_format": "JAH-FIX-######",
        "deep_link": "?fix=JAH-FIX-######",
        "updated": TODAY,
    }
    json.dump(api, open(os.path.join(ROOT, "api.json"), "w"), indent=1)
    print(f"OK: {total} total fixes, api.json written")


if __name__ == "__main__":
    main()
