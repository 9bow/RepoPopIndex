#!/usr/bin/env node
// Re-run scoring locally against the raw metric values present in deployed
// reports. Used to validate normalization tuning offline.
//
// Usage: node scripts/bench/recompute.mjs <results-file>
//   results-file format: each line "<id> <jsonReport>"

import fs from "node:fs";

// Hand-port of src/lib/scoring/*.ts logic. Kept in sync manually so this
// script can run with no dependencies and still mirror production scoring.

const RECENCY_FACTOR = 0.75;
const MIN_AVAILABLE_RATIO = 0.3;

const GITHUB_METRICS = [
  { key: "stars", maxI: 200000, weight: 3, cumulative: true },
  { key: "forks", maxI: 50000, weight: 1, cumulative: true },
  { key: "watchers", maxI: 10000, weight: 1, cumulative: true },
  { key: "G2.4", maxI: 500, weight: 3, cumulative: false },
  { key: "G2.5", maxI: 2000, weight: 2, cumulative: false },
  { key: "G2.2", maxI: 1.0, weight: 2, cumulative: false, linear: true },
  { key: "G2.3_additions", maxI: 50000, weight: 1, cumulative: false },
  { key: "G2.6", maxI: 3.0, weight: 2, cumulative: false, linear: true },
  { key: "G3.1", maxI: 200, weight: 1, cumulative: false },
  { key: "G3.2", maxI: 200, weight: 1, cumulative: false },
  { key: "G3.3", maxI: 1.0, weight: 2, cumulative: false, linear: true },
  { key: "G4.1", maxI: 100, weight: 1, cumulative: false },
  { key: "G4.2", maxI: 100, weight: 2, cumulative: false },
  { key: "G4.3", maxI: 1.0, weight: 1, cumulative: false, linear: true },
  { key: "G4.4", maxI: 100, weight: 3, cumulative: false },
  { key: "G4.5", maxI: 14, weight: 1, cumulative: false, inverse: true },
  { key: "G5.1", maxI: 50, weight: 1, cumulative: false },
  { key: "G5.2", maxI: 90, weight: 1, cumulative: false, linear: true, inverse: true },
  { key: "G5.3", maxI: 1000000, weight: 2, cumulative: false },
  { key: "G5.4", maxI: 200, weight: 0, cumulative: false },
  { key: "G6.1", maxI: 5000000, weight: 3, cumulative: true },
  { key: "G7.1", maxI: 100, weight: 1, cumulative: true, linear: true },
  { key: "G8.1", maxI: 200000, weight: 3, cumulative: true },
  { key: "G8.2", maxI: 100, weight: 2, cumulative: false },
  { key: "story_count", maxI: 50, weight: 1, cumulative: false },
  { key: "total_points", maxI: 2000, weight: 1, cumulative: false },
  { key: "engagement", maxI: 5000, weight: 1, cumulative: false },
];

const GITHUB_CATEGORIES = [
  { id: "G-Activity", weight: 20, metricKeys: ["G2.4", "G2.5", "G2.2", "G2.3_additions", "G2.6"] },
  { id: "G-Community", weight: 20, metricKeys: ["G3.1", "G3.2", "G3.3", "G4.1", "G4.2", "G4.3", "G4.4", "G4.5"] },
  { id: "G-Adoption", weight: 25, metricKeys: ["G6.1", "G5.1", "G5.2", "G5.3", "G5.4"] },
  { id: "G-Popularity", weight: 15, metricKeys: ["stars", "forks", "watchers", "G8.1", "G8.2"] },
  { id: "G-Health", weight: 5, metricKeys: ["G7.1"] },
  { id: "G-Social", weight: 15, metricKeys: ["story_count", "total_points", "engagement"] },
];

function normalizeMetric(rawValue, cfg) {
  if (rawValue === null || rawValue === undefined) return null;
  let value = rawValue;
  if (cfg.inverse) value = Math.max(0, cfg.maxI - rawValue);
  let n;
  if (cfg.linear) n = Math.min(1, value / cfg.maxI);
  else n = Math.min(1, Math.log(1 + value) / Math.log(1 + cfg.maxI));
  return Math.max(0, Math.min(1, n));
}

function applyRecency(n, cfg) {
  return cfg.cumulative ? n * RECENCY_FACTOR : n;
}

function metricCeiling(cfg) {
  return cfg.cumulative ? RECENCY_FACTOR : 1;
}

function recompute(report) {
  // Pull raw values from the existing report payload.
  const cfgMap = new Map(GITHUB_METRICS.map((m) => [m.key, m]));
  const rawLookup = new Map();
  for (const cat of Object.values(report.categoryScores || {})) {
    for (const [key, m] of Object.entries(cat.metrics || {})) {
      rawLookup.set(key, m.raw);
    }
  }

  const catScores = {};
  for (const cat of GITHUB_CATEGORIES) {
    let weightedSum = 0;
    let availableCeiling = 0;
    let availableCount = 0;
    let countableTotal = 0;

    for (const key of cat.metricKeys) {
      const cfg = cfgMap.get(key);
      if (!cfg || cfg.weight === 0) continue;
      countableTotal++;
      const raw = rawLookup.get(key);
      if (raw === null || raw === undefined) continue;
      const n = normalizeMetric(raw, cfg);
      if (n === null) continue;
      const r = applyRecency(n, cfg);
      weightedSum += r * cfg.weight;
      availableCeiling += metricCeiling(cfg) * cfg.weight;
      availableCount++;
    }

    const insufficient = countableTotal > 0 && availableCount < countableTotal * MIN_AVAILABLE_RATIO;
    const score = !insufficient && availableCeiling > 0 ? 100 * (weightedSum / availableCeiling) : 0;
    catScores[cat.id] = { score, insufficient };
  }

  let weightedSum = 0;
  let totalWeight = 0;
  for (const cat of GITHUB_CATEGORIES) {
    const s = catScores[cat.id];
    if (s.insufficient) continue;
    weightedSum += cat.weight * s.score;
    totalWeight += cat.weight;
  }
  const composite = totalWeight > 0 ? weightedSum / totalWeight : 0;
  return { composite, catScores };
}

// --- main ---
const file = process.argv[2] ?? "/tmp/results.json";
const lines = fs.readFileSync(file, "utf8").split("\n").filter((l) => l.includes("compositeScore"));
const reports = lines
  .map((l) => {
    const m = l.match(/^([a-f0-9-]+)\s+(.*)$/);
    if (!m) return null;
    try { return JSON.parse(m[2]); } catch { return null; }
  })
  .filter(Boolean);

const rows = reports.map((r) => {
  const { composite, catScores } = recompute(r);
  return {
    repo: `${r.owner}/${r.repo}`,
    old: r.compositeScore,
    new: composite,
    cats: Object.fromEntries(
      Object.entries(catScores).map(([k, v]) => [k.replace("G-", ""), v.insufficient ? "—" : v.score.toFixed(0)])
    ),
  };
});

rows.sort((a, b) => b.new - a.new);
console.log(`${"repo".padEnd(35)}  old →  new   |  Activity Community Adoption Popularity Health Social`);
console.log("-".repeat(120));
for (const r of rows) {
  console.log(
    `${r.repo.padEnd(35)} ${r.old.toFixed(1).padStart(5)} → ${r.new.toFixed(1).padStart(5)}   |  ` +
    [r.cats.Activity, r.cats.Community, r.cats.Adoption, r.cats.Popularity, r.cats.Health, r.cats.Social]
      .map((s) => String(s).padStart(8))
      .join(" ")
  );
}

const newScores = rows.map((r) => r.new);
const sorted = [...newScores].sort((a, b) => a - b);
const pct = (p) => sorted[Math.floor((sorted.length - 1) * p)];
console.log("");
console.log(`n=${rows.length}  min=${Math.min(...newScores).toFixed(1)}  p25=${pct(0.25).toFixed(1)}  median=${pct(0.5).toFixed(1)}  p75=${pct(0.75).toFixed(1)}  max=${Math.max(...newScores).toFixed(1)}  avg=${(newScores.reduce((s, v) => s + v, 0) / newScores.length).toFixed(1)}`);
