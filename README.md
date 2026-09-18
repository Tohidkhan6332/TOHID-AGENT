# TOHID AGENT V2 — WhatsApp AI Agent

ChatGPT-style WhatsApp AI Agent by Tohid with persistent memory, multilingual chat, voice, image/video generation, web search and GitHub tools.

## ✨ V2 Features
- 🌍 Multilingual AI + Hinglish
- 🧠 MongoDB persistent conversation memory
- 🎤 Voice note transcription + optional voice reply
- 🎨 AI image generation
- 🎬 Prompt-to-video generation
- 🌐 Optional web search
- 💻 GitHub agent for repositories, files, branches, issues and pull requests
- 🔐 GitHub write actions are owner-only
- 📊 Usage statistics
- ❤️ Health/status endpoint
- 📱 QR + pairing-code login
- 🐳 Docker / Heroku / Render / Railway / Koyeb / Replit / Bot-Hosting deployment configs

## 🚀 Deploy

Heroku: https://www.heroku.com/deploy?template=https://github.com/Tohidkhan6332/TOHID-AGENT
Render: https://render.com/deploy?repo=https://github.com/Tohidkhan6332/TOHID-AGENT

Railway: deploy this GitHub repo as a worker.
Koyeb: deploy the GitHub repo as a worker.
Replit: import the GitHub repo.
Bot-Hosting.net: create a Node.js 20 application from GitHub.
Vercel: use only for the HTTP/API layer; the persistent Baileys worker needs a long-running worker host.

## ⚙️ Environment

See .env.example.

Required:
- OPENAI_API_KEY
- GITHUB_TOKEN if GitHub features are wanted
- OWNER_NUMBER for owner-only writes
- MONGO_URI strongly recommended for persistent auth + memory

## 🤖 Commands

.help — show commands
.ping — health check
.status — runtime status
.newchat / .reset — clear personal AI memory
.stats — owner-only usage statistics
.imagine <prompt> — generate image
.video <prompt> — generate video
Normal text — ChatGPT-style AI
Voice note — speech-to-text + AI; voice reply when enabled

### GitHub natural-language examples

"List my repositories"
"Read README.md from Tohidkhan6332/TOHID-AGENT"
"Create a branch called feature/test"
"Update index.js with ..."
"Create an issue titled ..."
"Open a pull request ..."

GitHub write actions are restricted to the configured owner number.

## 🔐 Login

QR mode: LOGIN_METHOD=qr
Pairing mode: LOGIN_METHOD=pairing and PAIRING_NUMBER=91XXXXXXXXXX

Use one login method per WhatsApp session.

## 🧠 Memory

When MongoDB is configured, V2 stores the latest conversation context per WhatsApp user and usage counters. .newchat clears that user's conversation memory.

## 🎬 Video

Video generation depends on the configured provider/API and may be asynchronous. Verify current provider availability before production use.

## 🛠 Local

Node.js 20+:

    npm install
    cp .env.example .env
    npm start

Never commit API keys, WhatsApp auth state or generated secrets.

---
**TOHID AGENT V2 • Developer: Tohid**
