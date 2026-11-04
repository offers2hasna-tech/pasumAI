# PasumAI · The Indian High School

**பசுமை (pasumai) means greenness.** PasumAI is an AI eco helper that helps students save electricity, cut paper waste and keep the campus clean, with house points for Ruby, Emerald, Topaz and Sapphire.

## What's in this folder

| File | What it does |
|---|---|
| `index.html` | The whole website: what students see and click. **Part 1** at the top of the script is the easy-to-edit part (houses, levels, problem types, chatbot personalities). |
| `api/ai.js` | Server code that sends questions and photos to Google Gemini. |
| `api/data.js` | Server code that saves and reads the house scoreboard. |
| `api/health.js` | Tells the website whether the AI and the database are switched on. |
| `lib/gemini.js` | Talks to Gemini. Has a **demo mode** with practice answers when no key is set. |
| `lib/store.js` | Saves scores. It also blocks cheating: points are capped, and only the first "Mark fixed" counts. |
| `server.js` | Runs everything on your own laptop (not used on Vercel). |
| `.env.example` | A list of the secret settings the server needs. |

## How it works (for the judges)

```
 Student's phone or laptop            Our server (Vercel)                 Google Gemini
 ─────────────────────────            ───────────────────                 ─────────────
 index.html  ── question/photo ──▶   api/ai.js  ── + secret key ──▶       AI model
             ◀── answer / JSON ───              ◀── answer ─────────
             ── points ──────────▶   api/data.js ──▶ Upstash Redis (scoreboard)
```

- **Age-based personalities (prompt engineering):** each mode sends the AI a different set of rules first.
- **Snap & Sort (computer vision):** the AI looks at a photo and answers in a fixed JSON format: item, bin, reason, tip, points.
- **AI scoring:** the AI judges how much effort an eco action or a problem report took, and rejects jokes.
- **Level celebrations:** when a house passes 25, 50, 100, 200 or 400 points, everyone sees a celebration.
- **Why there's a server:** the AI key is like a password. If it were inside `index.html`, anyone could copy it. The server keeps it hidden.

---

## Put it on the internet (about 20 minutes)

You need: a free **GitHub** account, a free **Vercel** account, and a **Gemini API key** (a parent creates this).

### 1. Get the Gemini key (parent)
1. Go to **https://aistudio.google.com/apikey** and sign in with a Google account.
2. Click **Create API key** and copy it. Keep it secret: don't paste it in chats, emails or `index.html`.

### 2. Put the code on GitHub
1. Sign in at **github.com** and click **New repository**. Name it `pasumai` and click **Create repository**.
2. Click **uploading an existing file**, drag in **everything in this folder** (including the `api` and `lib` folders), and click **Commit changes**.

### 3. Deploy on Vercel
1. Go to **vercel.com** and choose **Continue with GitHub**.
2. Click **Add New → Project**, find `pasumai`, then click **Import**.
3. Leave Framework Preset as **Other**. Open **Environment Variables** and add:
   - `GEMINI_API_KEY` = the key from step 1
   - `ADMIN_PIN` = a secret number for teachers (e.g. `4821`)
4. Click **Deploy**. You get a link like `pasumai.vercel.app`.

### 4. Switch on the shared scoreboard
Without this step, scores disappear whenever Vercel restarts the server.
1. In your Vercel project, open the **Storage** tab, then **Create Database**, then choose **Upstash for Redis** (free plan).
2. Connect it to the `pasumai` project. Vercel adds the database settings for you.
3. Go to **Deployments**, click **⋯** on the latest one, then **Redeploy**.

### 5. Check it works
Open your link. At the top, it should say **AI: Gemini**, and the scoreboard should say **Live**.
If it says **Demo mode**, the key is missing. Check step 3, then redeploy.

---

## Run it on a laptop instead (backup for demo day)
1. Install **Node.js** (version 18 or newer) from nodejs.org.
2. In this folder, copy `.env.example` to a new file called `.env` and fill in `GEMINI_API_KEY` and `ADMIN_PIN`.
3. Open a terminal in this folder and run `npm start`.
4. Open **http://localhost:3000**. Scores are kept until you stop the server.

No internet or no key? It still runs in **demo mode** with practice answers, so you always have something to show.

## Changing things
Open `index.html` and find **PART 1 — THINGS YOU CAN EDIT EASILY**:
- `LEVELS`: level names and the points needed for each
- `ISSUES`: the problems students can report
- `MODES`: what PasumAI says and how it behaves for each age group

After editing, upload the changed file to GitHub. Vercel updates the website automatically.

## Safety and privacy
- On Gemini's free tier, Google may use what people type to improve its products. **Students should never type names, phone numbers or other personal details.**
- Points are added right away in this demo. In a real school rollout, a teacher would approve them first.
- After the techfest, you can delete the key at aistudio.google.com/apikey to switch the AI off.
