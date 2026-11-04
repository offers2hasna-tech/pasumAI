// Talks to Google Gemini. The secret key stays here on the server and is never sent to the browser.
// If no key is set, PasumAI runs in "demo mode" with practice answers so the website still works.

const KEY = () => process.env.GEMINI_API_KEY || "";
const MODEL = () => process.env.GEMINI_MODEL || "gemini-flash-latest";

export const aiMode = () => (KEY() ? "gemini" : "demo");

const clip = (v, n) => String(v ?? "").slice(0, n);

export async function runAI(body) {
  const task = body.task;
  if (!["chat", "sort", "rate", "report"].includes(task)) throw httpError(400, "Unknown task");
  if (!KEY()) return demo(body);

  let payload;
  if (task === "chat") {
    const turns = Array.isArray(body.turns) ? body.turns.slice(-12) : [];
    if (!turns.length) throw httpError(400, "No message");
    payload = {
      systemInstruction: { parts: [{ text: clip(body.system, 3000) }] },
      contents: turns.map(t => ({
        role: t.role === "assistant" ? "model" : "user",
        parts: [{ text: clip(t.content, 2000) }],
      })),
    };
  } else {
    const parts = [{ text: clip(body.prompt, 4000) }];
    const img = body.image;
    if (img && typeof img.data === "string") {
      if (!/^image\/(jpeg|png|webp)$/.test(img.mime)) throw httpError(400, "Unsupported image");
      if (img.data.length > 3_000_000) throw httpError(413, "Image too large");
      parts.push({ inline_data: { mime_type: img.mime, data: img.data } });
    }
    payload = {
      contents: [{ role: "user", parts }],
      generationConfig: { responseMimeType: "application/json" },
    };
  }

  // Gemini is sometimes "busy" (503). Try again, then fall back to other models.
  const models = [...new Set([MODEL(), "gemini-flash-lite-latest", "gemini-flash-latest", "gemini-2.5-flash-lite", "gemini-2.5-flash"])];
  let r, lastStatus = 0, lastDetail = "";
  outer:
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": KEY() }, body: JSON.stringify(payload) }
      );
      if (r.ok) break outer;
      lastStatus = r.status;
      lastDetail = await r.text().catch(() => "");
      console.error("Gemini error", model, r.status, lastDetail.slice(0, 300));
      if (r.status === 503 || r.status === 500) { await new Promise(res => setTimeout(res, 800 * (attempt + 1))); continue; }
      break; // 404 (model not found) or 429: move on to the next model
    }
  }
  if (!r.ok) {
    if (lastStatus === 429) throw httpError(429, "Too many requests", "rate_limited");
    throw httpError(502, "The AI service returned an error", lastStatus === 503 ? "busy" : undefined);
  }
  const j = await r.json();
  const text = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("").trim();
  if (!text) throw httpError(502, "The AI gave an empty answer");

  if (task === "chat") return { text };
  return { data: parseJSON(text) };
}

function parseJSON(text) {
  try { return JSON.parse(text); } catch {}
  const m = text.match(/[\[{][\s\S]*[\]}]/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  throw httpError(502, "The AI answer wasn't in the right format");
}

export function httpError(status, message, code) {
  const e = new Error(message); e.status = status; e.code = code || (status === 429 ? "rate_limited" : "upstream_error");
  return e;
}

// ---------- Demo mode: practice answers when no AI key is set ----------
const TIPS = [
  "(Demo mode) Great question! Switching off one fan for an hour saves about 0.07 kWh. Do that in 30 classrooms and it adds up fast.",
  "(Demo mode) Try printing double-sided, or ask your teacher if the worksheet can be shared on screen instead.",
  "(Demo mode) Here's a challenge: be the last one out and check every light, fan and AC is off. That's worth points for your house!",
  "(Demo mode) A clean campus starts with the right bin. Rinse bottles before recycling so they don't spoil the paper.",
];
let tipIndex = 0;
function demo(body) {
  switch (body.task) {
    case "chat": return { text: TIPS[tipIndex++ % TIPS.length] };
    case "sort": return { data: { item: "plastic bottle (demo)", bin: "recycle", why: "Clean plastic bottles can be made into new things.", tip: "Rinse it and squash it to save bin space.", points: 3 } };
    case "rate": return { data: { valid: true, points: 3, category: "energy", title: "Eco action (demo score)", reason: "Demo mode gives every action 3 points. Add an AI key for real scoring." } };
    case "report": return { data: { valid: true, summary: "Problem reported (demo)", urgency: "medium", points: 2, advice: "Tell a teacher or the caretaker so they can sort it out." } };
  }
}
