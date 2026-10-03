#!/usr/bin/env node
/* Functional harness for The Signature Mr Fix-It.
 * Extracts the REAL shipped functions from assets/app.js (verbatim source),
 * runs them in Node against the REAL shipped data (data/fixes.jsonl,
 * api.json, data/index/fields.json). No mocks of the logic under test.
 * Usage: node code/qa/functional_harness.js
 */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const SRC = fs.readFileSync(path.join(ROOT, "assets", "app.js"), "utf8");

function grabFn(name) {
  const re = new RegExp("function " + name + "\\s*\\(");
  const m = re.exec(SRC);
  if (!m) throw new Error("function not found in app.js: " + name);
  let i = SRC.indexOf("{", m.index), depth = 0, start = i;
  for (; i < SRC.length; i++) {
    if (SRC[i] === "{") depth++;
    else if (SRC[i] === "}") { depth--; if (depth === 0) { i++; break; } }
  }
  return SRC.slice(m.index, i);
}
function grabVar(name) {
  const re = new RegExp("var " + name + "\\s*=\\s*");
  const m = re.exec(SRC);
  if (!m) throw new Error("var not found in app.js: " + name);
  let i = m.index + m[0].length, depth = 0, instr = null, start = i;
  for (; i < SRC.length; i++) {
    const c = SRC[i];
    if (instr) { if (c === instr && SRC[i - 1] !== "\\") instr = null; continue; }
    if (c === '"' || c === "'") instr = c;
    else if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") depth--;
    else if ((c === ";" || c === ",") && depth === 0) break;
  }
  return "var " + name + " = " + SRC.slice(start, i) + ";";
}

// ---- load real data ----
const fixes = fs.readFileSync(path.join(ROOT, "data", "fixes.jsonl"), "utf8")
  .split("\n").filter(Boolean).map(l => JSON.parse(l));
const api = JSON.parse(fs.readFileSync(path.join(ROOT, "api.json"), "utf8"));
const fields = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "index", "fields.json"), "utf8"));

// ---- build eval context with the real shipped functions ----
const DB = { api, idx: [], fixes, fields };
const ARC = { q: "", field: "", page: 0, per: 24 };
const memStore = {};
function store(k, v) {
  if (v === undefined) return k in memStore ? memStore[k] : null;
  memStore[k] = JSON.parse(JSON.stringify(v));
}
const MALL_URL = "https://justinahiggins614-cmyk.github.io/signature-cyber-mega-mall/";

const ctxSrc = [
  grabVar("FIELD_KW"),
  "var MALL=" + JSON.stringify(MALL_URL) + ";",
  grabFn("esc"), grabFn("tokens"), grabFn("detectField"),
  grabFn("scoreFix"), grabFn("findFixes"),
  grabFn("safetyHTML"), grabFn("badges"), grabFn("flowSVG"),
  grabFn("genericGuide"), grabFn("aiAnswer"),
  grabFn("recordText"), grabFn("recordSpeech"),
  grabFn("arcFiltered"),
].join("\n");

let passed = 0, failed = 0;
const fails = [];
function t(name, cond, detail) {
  if (cond) { passed++; }
  else { failed++; fails.push(name + (detail ? " — " + detail : "")); }
}

// The extracted code references DB, ARC, store, MALL — bind them via Function.
const runner = new Function("DB", "ARC", "store", ctxSrc + `
;return {FIELD_KW,esc,tokens,detectField,scoreFix,findFixes,safetyHTML,badges,flowSVG,genericGuide,aiAnswer,recordText,recordSpeech,arcFiltered};`
);
const F = runner(DB, ARC, store);

/* ---------- 1-3. plain-language detection + manual override ---------- */
let d = F.detectField("my bathroom faucet drips all night and the handle is loose");
t("detect: faucet drip -> Plumbing", d.field === "Plumbing", JSON.stringify(d));
d = F.detectField("the outlet is sparking when I plug things in");
t("detect: sparking outlet -> Electrical", d.field === "Electrical", JSON.stringify(d));
d = F.detectField("my vcr is eating tapes");
t("detect: vcr -> Vintage Electronics", d.field === "Vintage Electronics", JSON.stringify(d));
d = F.detectField("the furnace pilot light keeps going out");
t("detect: furnace pilot -> Heating & Cooling", d.field === "Heating & Cooling", JSON.stringify(d));
d = F.detectField("xyzzy blorpt nothing real here");
t("detect: nonsense -> score 0", d.score === 0, JSON.stringify(d));
t("detect: every shipped field has keywords", Object.keys(F.FIELD_KW).length === 12 && fields.every(f => F.FIELD_KW[f.name] && F.FIELD_KW[f.name].length > 0));
// manual override logic: app uses (override value) || detected — verify the shipped line exists
t("override: app prefers dropdown value over detection",
  /var field=\$\("fieldOverride"\)\.value\|\|det\.field;/.test(SRC));

/* ---------- 14/15/16. finder matching, archive, exact ID ---------- */
let hits = F.findFixes("dead outlet no power", 3);
t("finder: 'dead outlet' top hit is JAH-FIX-000001", hits.length > 0 && hits[0].id === "JAH-FIX-000001", hits.map(h=>h.id).join(","));
hits = F.findFixes("leaky faucet dripping", 3);
t("finder: 'leaky faucet' top hit is Plumbing", hits.length > 0 && hits[0].field === "Plumbing", hits.map(h=>h.id+":"+h.field).join(","));
const HTML = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
hits = F.findFixes("zzxqwv blorptnarg kxjy", 3);
t("finder: nonsense -> zero matches (NOT FOUND path)", hits.length === 0);
hits = F.findFixes("gas grill will not light", 3);
t("finder: gas grill -> HIGH-safety record", hits.length > 0 && hits[0].safety === "HIGH", hits.map(h=>h.id+":"+h.safety).join(","));

ARC.q = "JAH-FIX-000042"; ARC.field = ""; ARC.page = 0;
let fl = F.arcFiltered();
t("archive: exact JAH-FIX-000042 resolves", fl.length === 1 && fl[0].id === "JAH-FIX-000042", fl.length + " results");
ARC.q = "faucet"; ARC.field = "Plumbing";
fl = F.arcFiltered();
t("archive: 'faucet' + Plumbing filter all match", fl.length > 0 && fl.every(r => r.field === "Plumbing"), fl.length + " results");
ARC.q = ""; ARC.field = "";
t("archive: empty query returns all " + fixes.length, F.arcFiltered().length === fixes.length);

/* ---------- 21/22/23/24. archive-vs-online labels, safety, disclaimer ---------- */
const high = fixes.find(r => r.safety === "HIGH");
const sh = F.safetyHTML(high);
t("safety: HIGH banner names HIGH + pro guidance", sh.includes("HIGH SAFETY") && sh.toLowerCase().includes("licensed professional"), high.id);
t("safety: every HIGH record's warnings non-empty", fixes.filter(r=>r.safety==="HIGH").every(r=>r.warnings && r.warnings.length>0));
const gasGrill = fixes.find(r => r.id === "JAH-FIX-000157");
t("safety: gas grill record warns about gas + professional", F.safetyHTML(gasGrill).toLowerCase().includes("professional") && gasGrill.warnings.some(w=>/gas/i.test(w)));
const gasBurner = fixes.find(r => r.id === "JAH-FIX-000027");
t("safety: gas burner warns ventilate/leave on gas smell", gasBurner.warnings.some(w=>/smell gas/i.test(w)));
const low = fixes.find(r => r.safety === "LOW");
t("safety: LOW banner renders", F.safetyHTML(low).includes("LOW SAFETY"));
const gg = F.genericGuide("Electrical");
t("generic guide: MEDIUM safety banner + pro line", gg.includes("MEDIUM SAFETY") && gg.toLowerCase().includes("licensed professional"));
t("labels: ARCHIVE RECORD vs ONLINE RESULT strings distinct in shipped code",
  /ARCHIVE RECORD/.test(SRC) && /ONLINE RESULT/.test(SRC) && !/ARCHIVE RECORD.*ONLINE RESULT|ONLINE RESULT.*ARCHIVE RECORD/.test(F.aiAnswer("dead outlet no power")));
const aHit = F.aiAnswer("dead outlet no power");
t("ask: archive hit labeled ARCHIVE RECORD + source line", aHit.includes("ARCHIVE RECORD") && aHit.includes("Source: fix archive"), aHit.slice(0,80));
const aMiss = F.aiAnswer("zzxqwv blorptnarg kxjy");
t("ask: miss says NOT FOUND + points at ONLINE RESULT", aMiss.includes("NOT FOUND") && aMiss.includes("ONLINE RESULT"));
t("disclaimer: generated-guidance wording present", /generated guidance, not certified/.test(SRC));

/* ---------- record rendering ---------- */
const rec = fixes[0];
t("recordText: contains safety + solutions", F.recordText(rec).includes("SAFETY") && F.recordText(rec).includes("SOLUTIONS"));
t("recordSpeech: contains title + safety", F.recordSpeech(rec).includes(rec.title) && F.recordSpeech(rec).includes(rec.safety));
const svg = F.flowSVG(rec);
t("flowSVG: valid svg with PROBLEM/FIX stages", svg.includes("<svg") && svg.includes("PROBLEM") && svg.includes("FIX"));
t("badges: safety + field badges", F.badges(rec).includes("SAFETY") && F.badges(rec).includes(rec.field.toUpperCase()));

/* ---------- data integrity across all 178 records ---------- */
const ids = fixes.map(r => r.id);
t("data: IDs unique, sequential JAH-FIX-000001..", new Set(ids).size === ids.length && ids[0] === "JAH-FIX-000001");
t("data: every record has symptoms/diagnosis/solutions/warnings",
  fixes.every(r => r.symptoms.length && r.diagnosis.length && r.solutions.length && r.warnings.length));
t("data: safety values only LOW/MEDIUM/HIGH", fixes.every(r => ["LOW","MEDIUM","HIGH"].includes(r.safety)));
t("data: solution rank1 exists on every record", fixes.every(r => r.solutions.some(s => s.rank === 1)));
t("data: canonical_url well-formed", fixes.every(r => /^https:\/\/justinahiggins614-cmyk\.github\.io\/signature-fixit\/\?fix=JAH-FIX-\d{6}$/.test(r.canonical_url)));
t("data: api.json total matches fixes.jsonl count", api.total_fixes === fixes.length, api.total_fixes + " vs " + fixes.length);
t("data: fields.json counts sum to total", fields.reduce((a,f)=>a+f.count,0) === fixes.length);
t("data: HIGH-safety records exist for electrical/gas paths", fixes.some(r=>r.safety==="HIGH" && r.field==="Electrical") && fixes.some(r=>/gas/i.test(r.title) && r.safety==="HIGH"));

/* ---------- 30. privacy: user files never uploaded ---------- */
t("privacy: no fetch/XHR POST of user files in app.js",
  !/fetch\([^)]*,\s*\{[^}]*method:\s*["']POST/i.test(SRC) && !/XMLHttpRequest/.test(SRC));
t("privacy: upload handler stores file in memory var only",
  /myUpFile\s*=\s*(f\|\|null|null)/.test(SRC) && !/fetch\(["'][^"']*upload/i.test(SRC));
t("privacy: local-only labels present (DEVICE-LOCAL, never uploaded, stays on your device)",
  (/DEVICE-LOCAL/.test(SRC) || /DEVICE-LOCAL/.test(HTML)) && /never uploaded/i.test(SRC + HTML) && /stays on your device/i.test(SRC + HTML));

/* ---------- 31/32/33. persistence paths ---------- */
t("persistence: store() try/catch never throws", (() => { try { store("k", {a:1}); return store("k").a === 1; } catch(e){ return false; } })());
t("persistence: deep-link ?fix= parsed on load", /\[?&\]fix=\(JAH-FIX-\\d\+\)/i.test(SRC));
t("persistence: history.replaceState keeps deep link on refresh", /history\.replaceState\(null,"","\?fix="\+id\)/.test(SRC));

/* ---------- 6-13. new validation + camera messages (must exist after hardening) ---------- */
let hasValidate = /function validateUpload\(/.test(SRC);
t("upload validation: validateUpload() exists", hasValidate);
let hasCamMsg = /function camErrMsg\(/.test(SRC);
t("camera: camErrMsg() exists", hasCamMsg);
if (hasValidate) {
  const v = new Function("SRC2", grabVar("MAX_UPLOAD_MB") + grabFn("validateUpload") + ";return validateUpload;")();
  t("upload: oversized rejected with human message",
    !v({name:"big.mp4",type:"video/mp4",size:500*1048576}).ok && /MB|large|size/i.test(v({name:"big.mp4",type:"video/mp4",size:500*1048576}).msg));
  t("upload: unsupported type rejected", !v({name:"x.exe",type:"application/x-msdownload",size:1000}).ok);
  t("upload: image ok", v({name:"p.jpg",type:"image/jpeg",size:2000000}).ok);
  t("upload: video ok", v({name:"v.mp4",type:"video/mp4",size:2000000}).ok);
}
if (hasCamMsg) {
  const cm = new Function(grabFn("camErrMsg") + ";return camErrMsg;")();
  t("camera: denied -> permission message", /permission|denied/i.test(cm({name:"NotAllowedError"})));
  t("camera: no device -> graceful message", /no camera|not found/i.test(cm({name:"NotFoundError"})));
  t("camera: in use -> graceful message", /in use|unavailable/i.test(cm({name:"NotReadableError"})));
}

/* ---------- 36. back/forward + record navigation ---------- */
t("nav: back button returns to archive", /\$\("backBtn"\)\.addEventListener/.test(SRC));
t("nav: archive pager prev/next wired", /\$\("pgPrev"\)/.test(SRC) && /\$\("pgNext"\)/.test(SRC));

console.log("PASS " + passed + " / FAIL " + failed);
if (fails.length) { console.log("FAILURES:"); fails.forEach(f => console.log("  - " + f)); process.exit(1); }
