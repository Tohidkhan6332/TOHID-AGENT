# TOHID AGENT — WhatsApp AI Bot

ChatGPT-style WhatsApp AI agent by Tohid with multilingual chat, voice input/output, image and video generation, web search, image understanding, and owner-only GitHub operations.

## 🚀 One-Click / Quick Deploy

<p align="center">
  <a href="https://www.heroku.com/deploy?template=https://github.com/Tohidkhan6332/TOHID-AGENT">
    <img src="https://www.herokucdn.com/deploy/button.svg" alt="Deploy to Heroku">
  </a>
  <a href="https://render.com/deploy?repo=https://github.com/Tohidkhan6332/TOHID-AGENT">
    <img src="https://render.com/images/deploy-to-render-button.svg" alt="Deploy to Render">
  </a>
  <a href="https://app.koyeb.com/deploy?type=git&builder=buildpack&repository=github.com/Tohidkhan6332/TOHID-AGENT&branch=main&name=tohid-agent">
    <img src="https://www.koyeb.com/static/images/deploy/button.svg" alt="Deploy to Koyeb">
  </a>
</p>

<p align="center">
  <a href="https://replit.com/github.com/Tohidkhan6332/TOHID-AGENT">▶️ Deploy / Import on Replit</a>
  &nbsp; • &nbsp;
  <a href="https://railway.com/new">🚂 Deploy on Railway</a>
  &nbsp; • &nbsp;
  <a href="https://bot-hosting.net/login">🤖 Bot-Hosting.net</a>
</p>

> **Railway:** connect this GitHub repository from Railway's **Deploy from GitHub repo** flow. The repository includes `railway.json` and a Node start command.
>
> **Bot-Hosting.net:** create an Application deployment, select **GitHub** as the source, choose `Tohidkhan6332/TOHID-AGENT`, and use Node.js 20. The current Bot-Hosting.net panel supports GitHub cloning directly.

## ☁️ Required Environment Variables

Set these on whichever platform you use:

```env
OPENAI_API_KEY=
GITHUB_TOKEN=
GITHUB_OWNER=Tohidkhan6332
OWNER_NUMBER=91XXXXXXXXXX
MONGO_URI=
MONGO_DB=tohid-agent

LOGIN_METHOD=qr
PAIRING_NUMBER=

AI_AGENT_ENABLED=true
AI_VOICE_REPLY=true
AI_WEB_SEARCH=true
PREFIX=.
```

For persistent WhatsApp authentication, **MONGO_URI is strongly recommended**, especially on platforms with ephemeral filesystems.

## 🎬 AI Video Generation\n\nUse:\n\n` .video <your prompt>`\n\nExample: ` .video A cinematic sunset over mountains, realistic camera movement`\n\nThe bot submits a text prompt to the configured video provider and sends the generated MP4 back to WhatsApp. Video generation is asynchronous and can take several minutes.\n\n**Current API note:** OpenAI's current Sora Videos API documentation marks the Videos API as deprecated and says it is scheduled to shut down on **September 24, 2026**. Configure another video provider before that date if uninterrupted video generation is required.\n\n## 🔐 Login

The bot supports **QR** and **pairing-code** login. Use one method per WhatsApp session:

- QR: `LOGIN_METHOD=qr`
- Pairing: `LOGIN_METHOD=pairing` and `PAIRING_NUMBER=91XXXXXXXXXX`

After deployment, open the platform's logs/console and complete the selected login method.

## 🧩 Supported Hosting

| Platform | Deployment |
|---|---|
| Heroku | One-click button + `app.json` + `Procfile` |
| Render | One-click button + `render.yaml` |
| Koyeb | One-click GitHub button |
| Replit | GitHub import + `.replit` |
| Railway | GitHub deployment + `railway.json` |
| Bot-Hosting.net | GitHub source deployment |
| Docker / VPS | `Dockerfile` + `npm start` |

## 🛠 Local Setup

1. Node.js 20+
2. Copy `.env.example` to `.env`
3. Fill API keys and configuration.
4. Run `npm install`
5. Run `npm start`
6. Complete QR or pairing-code login.

Never commit API keys, WhatsApp auth state, or generated secrets.
