// The scoreboard's memory. On Vercel it uses a free Upstash Redis database.
// Without one (e.g. on your laptop) it keeps scores in memory until the server restarts.
import { randomUUID } from "node:crypto";
import { httpError } from "./gemini.js";

const HOUSES = ["ruby", "emerald", "topaz", "sapphire"];
const CATS = ["energy", "paper", "clean"];
const CAPS = { snap: 5, action: 10, report: 5, fix: 3 }; // most points each kind of action can give
const URGENCY = ["low", "medium", "high"];
const FIX_POINTS = 3;

const KA = "pasumai:actions", KR = "pasumai:reports", KF = "pasumai:fixed";
const URL_ = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const TOKEN = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
export const storeMode = () => (URL_() && TOKEN() ? "redis" : "memory");

const mem = globalThis.__pasumaiMem || (globalThis.__pasumaiMem = { actions: [], reports: new Map(), fixed: new Set() });

async function redis(cmds) {
  const r = await fetch(URL_().replace(/\/$/, "") + "/pipeline", {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN()}`, "content-type": "application/json" },
    body: JSON.stringify(cmds),
  });
  if (!r.ok) throw httpError(502, "Scoreboard database error");
  const out = await r.json();
  return out.map(x => { if (x.error) throw httpError(502, "Scoreboard database error"); return x.result; });
}

const str = (v, n) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
const safeParse = s => { try { return JSON.parse(s); } catch { return null; } };

function cleanAction(a = {}) {
  const source = Object.hasOwn(CAPS, a.source) ? a.source : null;
  if (!HOUSES.includes(a.house) || !source || source === "fix") throw httpError(400, "Invalid action");
  const points = Math.max(0, Math.min(CAPS[source], Math.round(Number(a.points) || 0)));
  return {
    house: a.house, points, source,
    category: CATS.includes(a.category) ? a.category : "clean",
    what: str(a.what, 140), at: Date.now(),
  };
}

async function pushAction(a) {
  if (storeMode() === "redis") await redis([["LPUSH", KA, JSON.stringify(a)], ["LTRIM", KA, "0", "1999"]]);
  else { mem.actions.unshift(a); mem.actions.length = Math.min(mem.actions.length, 2000); }
}

export async function readAll() {
  let actions, reports;
  if (storeMode() === "redis") {
    const [a, r] = await redis([["LRANGE", KA, "0", "999"], ["HGETALL", KR]]);
    actions = (a || []).map(safeParse).filter(Boolean);
    reports = [];
    for (let i = 1; i < (r || []).length; i += 2) { const x = safeParse(r[i]); if (x) reports.push(x); }
  } else {
    actions = mem.actions.slice(0, 1000);
    reports = [...mem.reports.values()];
  }
  reports.sort((x, y) => y.at - x.at);
  return { actions, reports: reports.slice(0, 100) };
}

export async function addAction(a) { await pushAction(cleanAction(a)); }

export async function addReport(r = {}) {
  const action = cleanAction({ ...r, source: "report" });
  const report = {
    id: randomUUID(), house: action.house, category: action.category,
    type: str(r.type, 20), location: str(r.location, 60), summary: str(r.summary, 100),
    urgency: URGENCY.includes(r.urgency) ? r.urgency : "low", status: "open", at: Date.now(),
  };
  action.what = "Reported: " + report.summary;
  if (storeMode() === "redis") await redis([["HSET", KR, report.id, JSON.stringify(report)]]);
  else mem.reports.set(report.id, report);
  await pushAction(action);
}

export async function fixReport(id, house) {
  id = str(id, 64);
  if (!HOUSES.includes(house)) throw httpError(400, "Invalid house");
  let report;
  if (storeMode() === "redis") {
    const [raw] = await redis([["HGET", KR, id]]);
    report = raw && safeParse(raw);
    if (!report) throw httpError(404, "Report not found");
    const [first] = await redis([["HSETNX", KF, id, house]]); // only the first fix counts
    if (!first) throw httpError(409, "Already fixed");
    report = { ...report, status: "fixed", fixedBy: house, fixedAt: Date.now() };
    await redis([["HSET", KR, id, JSON.stringify(report)]]);
  } else {
    report = mem.reports.get(id);
    if (!report) throw httpError(404, "Report not found");
    if (mem.fixed.has(id)) throw httpError(409, "Already fixed");
    mem.fixed.add(id);
    Object.assign(report, { status: "fixed", fixedBy: house, fixedAt: Date.now() });
  }
  await pushAction({ house, points: FIX_POINTS, source: "fix", category: report.category, what: "Fixed: " + report.summary, at: Date.now() });
}

export async function resetAll(pin) {
  const real = process.env.ADMIN_PIN || "";
  if (!real) throw httpError(403, "Set ADMIN_PIN on the server to use reset");
  if (String(pin || "") !== real) throw httpError(403, "Wrong PIN");
  if (storeMode() === "redis") await redis([["DEL", KA, KR, KF]]);
  else { mem.actions = []; mem.reports.clear(); mem.fixed.clear(); }
}
