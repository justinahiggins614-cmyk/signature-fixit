#!/usr/bin/env node
/* DOM smoke test for signature-fixit assets/app.js.
 * Builds a minimal DOM stub, evals the REAL shipped app.js verbatim,
 * then drives the tour + guide + tab wiring the way a user would.
 * fetch is stubbed to fail (offline) so the offline/degraded paths run.
 */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const SRC = fs.readFileSync(path.join(ROOT, "assets", "app.js"), "utf8");

const els = {};
function mkEl(id) {
  const cls = new Set(["hidden"].includes(id) ? [] : []);
  const el = {
    id, _cls: cls, _listeners: {},
    classList: {
      add: c => cls.add(c), remove: c => cls.delete(c),
      toggle: (c, f) => { const on = f === undefined ? !cls.has(c) : !!f; on ? cls.add(c) : cls.delete(c); return on; },
      contains: c => cls.has(c),
    },
    addEventListener: (t, fn) => { (el._listeners[t] = el._listeners[t] || []).push(fn); },
    innerHTML: "", textContent: "", value: "", style: {},
    disabled: false, dataset: {}, files: [], scrollTop: 0,
    appendChild() {}, click() { (el._listeners.click || []).forEach(f => f({ target: el })); },
    key(t) { (el._listeners.keydown || []).forEach(f => f({ key: t })); },
    focus() {}, scrollIntoView() {},
    querySelectorAll() { return []; },
  };
  // sections that start hidden in real HTML
  ["sec-archive", "sec-record", "sec-cam", "sec-ask", "sec-mine", "guidePanel", "tourCard", "storeWarn", "impFile"].forEach(h => { if (id === h) cls.add("hidden"); });
  return el;
}
const store = {};
global.document = {
  getElementById: id => els[id] || (els[id] = mkEl(id)),
  querySelectorAll: () => [],
  createElement: () => mkEl("dyn"),
  documentElement: { getAttribute: () => null, setAttribute() {} },
  body: mkEl("body"),
};
global.window = {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
};
Object.defineProperty(global, "navigator", { value: {}, configurable: true });
global.location = { search: "" };
global.history = { replaceState() {} };
global.fetch = () => Promise.reject(new Error("offline"));
global.alert = () => {};
global.confirm = () => true;
global.URL = { createObjectURL: () => "blob:x", revokeObjectURL() {} };

let passed = 0, failed = 0; const fails = [];
function t(name, cond, detail) { if (cond) passed++; else { failed++; fails.push(name + (detail ? " — " + detail : "")); } }

eval(SRC);

setTimeout(() => {
  const tourCard = document.getElementById("tourCard");
  t("tour: auto-starts on first visit", !tourCard.classList.contains("hidden"));
  t("tour: step 1 of 6 shown", document.getElementById("tourStep").textContent === "Step 1 of 6");
  t("tour: back disabled on step 1", document.getElementById("tourBack").disabled === true);
  // keyboard: test arrows BEFORE the full walk (tourI starts at 0)
  tourCard.key("ArrowRight");
  t("tour: ArrowRight advances", document.getElementById("tourStep").textContent === "Step 2 of 6");
  tourCard.key("ArrowLeft");
  t("tour: ArrowLeft goes back", document.getElementById("tourStep").textContent === "Step 1 of 6");
  tourCard.key("Escape");
  t("tour: Escape closes", tourCard.classList.contains("hidden"));
  // walk forward through all steps
  tourCard.classList.remove("hidden");
  document.getElementById("tourStep").textContent = "Step 1 of 6"; // reset marker only; drive via clicks
  const next = document.getElementById("tourNext");
  for (let i = 0; i < 5; i++) next.click();
  t("tour: reached step 6, button reads Finish",
    document.getElementById("tourStep").textContent === "Step 6 of 6" && next.textContent === "Finish");
  next.click();
  t("tour: Finish hides card + sets seen flag",
    tourCard.classList.contains("hidden") && store["jah-tour-seen-fixit"] === "1");
  document.getElementById("tourSkip").click();
  t("tour: Skip hides + sets seen flag", tourCard.classList.contains("hidden") && store["jah-tour-seen-fixit"] === "1");

  // guide panel
  const guide = document.getElementById("guidePanel");
  t("guide: starts hidden", guide.classList.contains("hidden"));
  document.getElementById("guideBtn").click();
  t("guide: ? Guide button opens panel", !guide.classList.contains("hidden"));
  document.getElementById("guideBtn").click();
  t("guide: second click closes panel", guide.classList.contains("hidden"));

  // camera degraded paths (no mediaDevices in stub)
  document.getElementById("camStart").click();
  t("camera: unsupported browser -> graceful message + finder fallback hint",
    /not supported/i.test(document.getElementById("camStatus").textContent) &&
    /fix finder/i.test(document.getElementById("camStatus").textContent));
  document.getElementById("camStop").click();
  t("camera: stop with no stream -> 'Camera off.'", document.getElementById("camStatus").textContent === "Camera off.");

  console.log("PASS " + passed + " / FAIL " + failed);
  if (fails.length) { console.log("FAILURES:"); fails.forEach(f => console.log("  - " + f)); process.exit(1); }
}, 50);
