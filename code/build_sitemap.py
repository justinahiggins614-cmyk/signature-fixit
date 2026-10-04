#!/usr/bin/env python3
"""Build sitemap.xml for The Signature Mr Fix-It from the seeded archive."""
import json, os
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "https://justinahiggins614-cmyk.github.io/signature-fixit/"
TODAY = date.today().isoformat()

urls = [(BASE, TODAY, 1.0), (BASE + "api.json", TODAY, 0.8), (BASE + "llms.txt", TODAY, 0.5),
        (BASE + "browse.html", TODAY, 0.9)]
fx = os.path.join(ROOT, "data", "fixes.jsonl")
if os.path.exists(fx):
    for line in open(fx, encoding="utf-8"):
        if line.strip():
            r = json.loads(line)
            urls.append((f"{BASE}?fix={r['id']}", r["created"], 0.7))

xml = ['<?xml version="1.0" encoding="UTF-8"?>',
       '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
for u, lastmod, pr in urls:
    xml.append(f"  <url><loc>{u}</loc><lastmod>{lastmod}</lastmod><priority>{pr}</priority></url>")
xml.append("</urlset>")
open(os.path.join(ROOT, "sitemap.xml"), "w").write("\n".join(xml))
print(f"sitemap.xml: {len(urls)} URLs")
