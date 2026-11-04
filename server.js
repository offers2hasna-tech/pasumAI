// Runs PasumAI on your own laptop: `npm start`, then open http://localhost:3000
// Put your key in a file called .env (see .env.example). On Vercel this file is not used.
import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import ai from "./api/ai.js";
import data from "./api/data.js";
import health from "./api/health.js";

if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const routes = { "/api/ai": ai, "/api/data": data, "/api/health": health };
const PORT = Number(process.env.PORT) || 3000;

http.createServer(async (req, res) => {
  const path = new URL(req.url, "http://x").pathname;
  res.status = c => { res.statusCode = c; return res; };
  res.json = o => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify(o)); };
  const route = routes[path];
  if (route) {
    let raw = "";
    for await (const chunk of req) { raw += chunk; if (raw.length > 5e6) return res.status(413).json({ error: "Too large" }); }
    try { req.body = raw ? JSON.parse(raw) : {}; } catch { return res.status(400).json({ error: "Bad JSON" }); }
    return route(req, res);
  }
  if (path === "/" || path === "/index.html") {
    res.setHeader("content-type", "text/html; charset=utf-8");
    return res.end(readFileSync("index.html"));
  }
  res.statusCode = 404; res.end("Not found");
}).listen(PORT, () => {
  console.log(`PasumAI running at http://localhost:${PORT}`);
  console.log(`AI: ${process.env.GEMINI_API_KEY ? "Gemini" : "demo mode (no GEMINI_API_KEY)"}`);
});
