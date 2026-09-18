# 🤖 TOHID-AGENT V5 — WhatsApp AI Agent

**TOHID-AGENT V5** is a ChatGPT-style WhatsApp AI agent engineered and branded by **Tohid** (`Tohidkhan6332`). It combines multilingual AI, memory, voice, vision, image generation, web search, protected GitHub automation, group controls and deployment-ready infrastructure.

> 👨‍💻 **Developer: Tohid**  
> 🚀 **Project: TOHID-AGENT V5**

## ✨ V5 Highlights

- 🌍 Multilingual AI + Hindi/Hinglish
- 🧠 MongoDB persistent per-user conversation memory
- 👁️ Image understanding — send an image with a question/caption
- 🎤 Voice note → transcription → AI → optional voice reply
- 🎨 AI image generation
- 🎬 Prompt-to-video generation where the configured provider/API supports it
- 🌐 Optional web search
- 💻 GitHub Agent: repos, repository search, files, commits, issues, branches and PRs
- 🔐 GitHub write protection: owner-only + explicit **CONFIRM** step
- 🛡️ Maintenance mode and owner controls
- 🚫 Owner block/unblock system
- ⚡ Per-user rate limiting and message-size protection
- 👥 Group mode that responds when TOHID-AGENT is mentioned
- 📊 Usage and runtime statistics
- 📱 QR + pairing-code login
- ☁️ MongoDB-backed WhatsApp auth for persistent deployments
- 🐳 Docker / Heroku / Render / Railway / Koyeb / Replit / Bot-Hosting deployment configs

## 🧠 Agent Mode

Talk naturally instead of memorizing commands:

`List my GitHub repositories`  
`Search GitHub for Node.js WhatsApp bots`  
`Read index.js from Tohidkhan6332/TOHID-AGENT`  
`Find recent commits for my repo`  
`Create a branch called feature/vision`  
`Update README.md with the V5 features`  
`Create an issue for the pairing bug`  
`Open a pull request from feature/vision`

For protected GitHub writes, the agent prepares the action first and asks for **CONFIRM**. The configured owner number is the only account allowed to execute writes.


## 🚀 V5 Improvements

- 🧩 Explicit reply-category routing so each response path can use the correct image
- 🎙️ Per-user voice reply setting: `.voice on/off`
- 🧠 Per-user memory setting: `.memory on/off`
- ⚙️ Per-user settings panel: `.settings`
- 🔐 Pending GitHub confirmations are persisted in MongoDB, so a restart does not silently lose a protected action
- 🛡️ Errors now explicitly use the error reply image
- 📊 GitHub write usage is included in owner statistics
- 🖼️ Voice, image and video flows now use category-specific reply visuals

### V5 Settings

`.settings` — show your current settings  
`.voice on/off` — enable or disable voice replies for your account  
`.memory on/off` — enable or disable persistent AI memory for your account  

Per-user settings require MongoDB. Without MongoDB, the bot continues to work with the global environment settings.

## 👁️ Vision

Send an image with a caption/question:

`Explain this error`  
`What is wrong in this screenshot?`  
`Read this code and suggest a fix`

The V3 agent passes the image to the configured OpenAI vision-capable model.

## 🖼️ Category-wise Reply Images

TOHID-AGENT can automatically send a different image with each type of reply. Add your own images to `assets/reply-images/` using these exact filenames:

- `ai.jpg` — normal AI chat
- `github.jpg` — GitHub/repository/code-management requests
- `image.jpg` — image generation
- `vision.jpg` — image/screenshot analysis
- `voice.jpg` — voice/audio requests
- `video.jpg` — video generation
- `web.jpg` — web search
- `code.jpg` — coding/debugging
- `group.jpg` — group features
- `admin.jpg` — admin/maintenance/block controls
- `memory.jpg` — memory requests
- `utility.jpg` — utility/download/convert requests
- `stats.jpg` — stats/analytics
- `security.jpg` — security-related replies
- `status.jpg` — status/health replies
- `error.jpg` — error replies

The images are optional: if an image is missing, the bot automatically sends the normal text reply. Set `REPLY_IMAGES_ENABLED=false` to disable the feature, or change `REPLY_IMAGE_DIR` to another folder.

## 🎙️ Voice

Send a WhatsApp voice note. TOHID-AGENT transcribes it, understands the request and can reply by voice when `AI_VOICE_REPLY=true`.

## 🎨 Image + Video

`.imagine futuristic TOHID-AGENT logo`

`.video a cinematic AI robot walking through a neon city`

Video availability depends on the configured provider/API and should be verified before production use.

## 🛡️ Security

- GitHub writes are owner-only.
- GitHub writes require an additional **CONFIRM** message.
- API keys and tokens are never intentionally returned to the user.
- Messages are limited by `AI_MAX_MESSAGE_CHARS`.
- Users are rate-limited by `AI_RATE_LIMIT_PER_MINUTE`.
- Owner can enable maintenance mode.
- Owner can block/unblock WhatsApp numbers.
- Never commit `.env`, WhatsApp auth state or secrets.

## 🤖 Commands

`.help` / `.menu` — command list  
`.ping` — health check  
`.status` — runtime/config status  
`.memory` — memory message count  
`.newchat` / `.reset` — clear personal memory  
`.stats` — owner statistics  
`.imagine <prompt>` — image generation  
`.video <prompt>` — video generation  
`.maintenance on/off` — owner maintenance mode  
`.block <number>` — owner block  
`.unblock <number>` — owner unblock

Normal text and voice messages are handled by the AI agent.

## 🚀 Deploy

<p align="center">

<a href="https://www.heroku.com/deploy?template=https://github.com/Tohidkhan6332/TOHID-AGENT"><img src="https://www.herokucdn.com/deploy/button.svg" alt="Deploy to Heroku"></a>

<a href="https://render.com/deploy?repo=https://github.com/Tohidkhan6332/TOHID-AGENT"><img src="https://render.com/images/deploy-to-render-button.svg" alt="Deploy to Render"></a>

<a href="https://app.koyeb.com/deploy?type=git&builder=buildpack&repository=github.com/Tohidkhan6332/TOHID-AGENT&branch=main&name=tohid-agent"><img src="https://www.koyeb.com/static/images/deploy/button.svg" alt="Deploy to Koyeb"></a>

<a href="https://vercel.com/new/clone?repository-url=https://github.com/Tohidkhan6332/TOHID-AGENT"><img src="https://vercel.com/button" alt="Deploy with Vercel"></a>

</p>

<p align="center">

<a href="https://railway.com/new"><img src="https://railway.com/button.svg" alt="Deploy on Railway"></a>

<a href="https://replit.com/github.com/Tohidkhan6332/TOHID-AGENT">▶️ Deploy / Import on Replit</a>

<a href="https://bot-hosting.net/login">🤖 Deploy on Bot-Hosting.net</a>

</p>

> **Vercel note:** Vercel is suitable for the HTTP/API layer. The long-running Baileys WhatsApp worker needs a persistent worker host.

## ⚙️ Environment

Copy `.env.example` to `.env`.

Important variables:

- `OPENAI_API_KEY`
- `GITHUB_TOKEN` for GitHub features
- `GITHUB_OWNER=Tohidkhan6332`
- `OWNER_NUMBER` for owner controls
- `MONGO_URI` for persistent memory + WhatsApp auth
- `GROUP_AI_MODE=mention`
- `AI_RATE_LIMIT_PER_MINUTE=20`
- `AI_MAX_MESSAGE_CHARS=12000`

### Login

QR:

`LOGIN_METHOD=qr`

Pairing code:

`LOGIN_METHOD=pairing`  
`PAIRING_NUMBER=91XXXXXXXXXX`

Use one login method per WhatsApp session.

## 🛠️ Local Setup

Node.js 20+:

    npm install
    cp .env.example .env
    npm start

## 📁 Core Structure

TOHID-AGENT/
├── index.js
├── config.js
├── lib/
│   ├── database.js
│   ├── github.js
│   ├── openai.js
│   └── router.js
├── api/
├── README.md
├── Dockerfile
├── Procfile
├── render.yaml
├── railway.json
└── app.json

## 🏷️ Branding

This project is intentionally branded throughout the runtime, configuration, README and GitHub integration as:

**TOHID-AGENT V5**  
**Developer: Tohid**  
**GitHub: Tohidkhan6332**

---

**TOHID-AGENT V5 • Built by Tohid • AI + WhatsApp + GitHub**

## 🧩 V5 Menu & UI Modes

TOHID-AGENT V5 includes a WhatsApp button menu with a text-mode fallback.

- `.menu` — opens the main menu
- `.mode buttons` — enable button menus
- `.mode text` — switch to text menus
- `.settings` — voice, memory and UI settings
- Button menus include AI, image, video, voice, memory, GitHub, stats and settings.
- If the WhatsApp/Baileys client does not accept interactive buttons, the agent automatically falls back to a numbered text menu.
- GitHub write actions remain protected by owner-only checks and `CONFIRM`.


## 🚀 V5 Improvements

- 🧩 Smart button menus with automatic text fallback
- 🔘 Per-user Button/Text UI preference
- 🛡️ Dedicated owner Admin menu
- 📱 UI status inside Settings
- 🔐 Protected GitHub confirmations expire after a configurable TTL (PENDING_ACTION_TTL_MS, default 5 minutes)
- 📝 MongoDB audit logs for protected GitHub actions and UI-mode changes
- 🌐 Optional JSON admin/monitor endpoint at /admin when ADMIN_PANEL_ENABLED=true
- ⚙️ V5 configuration version aligned to 5.0.0
