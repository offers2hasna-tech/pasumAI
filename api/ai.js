import { runAI } from "../lib/gemini.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  try {
    res.status(200).json(await runAI(req.body || {}));
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || "Server error", code: e.code || "upstream_error" });
  }
}

