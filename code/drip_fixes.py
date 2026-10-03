#!/usr/bin/env python3
"""Drip-friendly fix archive growth for The Signature Mr Fix-It.

Workflow: new fix records are authored as code/seed_data/fixdata_*.py files
(same PROBLEMS format as the seed). This script:
  1. Reads data/state.json for next_index (never re-IDs, never duplicates).
  2. Loads ONLY seed files newer than the last drip watermark
     (code/seed_data/.drip_watermark holds the last-processed mtime).
  3. Appends the new records to data/fixes.jsonl + rebuilds the search index,
     fields catalog, state.json, and api.json via seed_fixes.build_records.

Deterministic: same seed files -> same IDs/hashes. Safe to re-run (no-op when
no new seed files exist).

Usage: python3 code/drip_fixes.py [--n N]   (caps records per run; default all)
"""
import os, sys, json, gzip, glob, importlib.util

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "code"))
import seed_fixes as S

WATERMARK = os.path.join(ROOT, "code", "seed_data", ".drip_watermark")


def new_seed_files():
    wm = 0.0
    if os.path.exists(WATERMARK):
        wm = float(open(WATERMARK).read().strip() or 0)
    files = []
    for path in sorted(glob.glob(os.path.join(S.SEED_DIR, "fixdata_*.py"))):
        if os.path.getmtime(path) > wm:
            files.append(path)
    return files, wm


def load_from(files):
    problems = []
    for path in files:
        spec = importlib.util.spec_from_file_location("dripmod", path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        problems.extend(mod.PROBLEMS)
    return problems


def main():
    cap = int(sys.argv[sys.argv.index("--n") + 1]) if "--n" in sys.argv else None
    files, _ = new_seed_files()
    if not files:
        print("STATUS: no new seed files — archive unchanged")
        return
    problems = load_from(files)
    if cap:
        problems = problems[:cap]
    S.validate(problems)
    state_path = os.path.join(S.DATA, "state.json")
    start = json.load(open(state_path))["next_index"]

    # guard: never re-ID existing records — check title uniqueness vs archive
    existing_titles = set()
    fx = os.path.join(S.DATA, "fixes.jsonl")
    if os.path.exists(fx):
        for line in open(fx, encoding="utf-8"):
            if line.strip():
                existing_titles.add(json.loads(line)["title"].strip().lower())
    dupes = [p["title"] for p in problems if p["title"].strip().lower() in existing_titles]
    if dupes:
        print(f"STATUS: drip blocked — {len(dupes)} duplicate titles: {dupes[:3]}")
        sys.exit(1)

    records, fields = S.build_records(problems, start)
    with open(fx, "a", encoding="utf-8") as f:
        for r in records:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    # rebuild compact index + fields + state + api from the full archive
    all_recs = [json.loads(l) for l in open(fx, encoding="utf-8") if l.strip()]
    with gzip.open(os.path.join(S.IDX, "fixes.idx.json.gz"), "wt", encoding="utf-8") as f:
        for r in all_recs:
            f.write(json.dumps([r["id"], r["title"], r["field"], r["field_id"]], ensure_ascii=False) + "\n")
    fcounts, fmap = {}, {}
    for r in all_recs:
        fcounts[r["field"]] = fcounts.get(r["field"], 0) + 1
        fmap[r["field"]] = r["field_id"]
    field_list = [{"field_id": fmap[n], "name": n, "count": fcounts[n],
                   "pro": S.PRO_BY_FIELD.get(n, "qualified professional")} for n in fmap]
    json.dump(field_list, open(os.path.join(S.IDX, "fields.json"), "w"), indent=1)
    total = start + len(records) - 1
    json.dump({"next_index": total + 1, "total": total, "updated": S.TODAY},
              open(state_path, "w"), indent=1)
    api = json.load(open(os.path.join(ROOT, "api.json")))
    api.update({"total_fixes": total, "progress": f"{total} / 1,000,000",
                "fields": field_list, "updated": S.TODAY})
    json.dump(api, open(os.path.join(ROOT, "api.json"), "w"), indent=1)
    with open(WATERMARK, "w") as f:
        f.write(str(max(os.path.getmtime(p) for p in files)))
    print(f"STATUS: +{len(records)} fixes, {total} total")


if __name__ == "__main__":
    main()
