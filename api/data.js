import { readAll, addAction, addReport, fixReport, resetAll } from "../lib/store.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      res.setHeader("cache-control", "no-store");
      return res.status(200).json(await readAll());
    }
    if (req.method !== "POST") return res.status(405).json({ error: "Use GET or POST" });
    const b = req.body || {};
    if (b.op === "action") await addAction(b.action);
    else if (b.op === "report") await addReport(b.report);
    else if (b.op === "fix") await fixReport(b.id, b.house);
    else if (b.op === "reset") await resetAll(b.pin);
    else return res.status(400).json({ error: "Unknown operation" });
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || "Server error", code: e.code || "upstream_error" });
  }
}
