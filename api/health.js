import { aiMode } from "../lib/gemini.js";
import { storeMode } from "../lib/store.js";

export default function handler(req, res) {
  res.setHeader("cache-control", "no-store");
  res.status(200).json({ ok: true, ai: aiMode(), store: storeMode() });
}
