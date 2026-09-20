# 🤖 TOHID-AGENT V7

**TOHID-AGENT V7** is a production-oriented WhatsApp AI Agent engineered and branded by **Tohid**.

## 🚀 V7 Core

- 🧠 Persistent MongoDB memory and profiles
- 🔀 OpenAI primary + Gemini fallback
- 🛠️ Tool-calling agent architecture
- 🧮 Safe calculator tool
- 🩺 Runtime diagnostics with `.doctor`
- 🔌 Provider diagnostics with `.provider`
- 🧰 Tool inventory with `.tools`
- 👁️ Image understanding
- 🎤 Voice transcription + optional voice replies
- 🎨 Image generation
- 🎬 Video generation
- 🌐 Optional web search
- 💻 GitHub agent with read/write automation
- 🔐 Owner-only GitHub writes + explicit CONFIRM
- 🛡️ Maintenance, block/unblock and rate limiting
- 👥 Group mention mode
- 📊 MongoDB usage statistics + audit logs
- 📱 QR and pairing-code login
- ☁️ Persistent MongoDB-backed WhatsApp auth
- 🐳 Portable deployment for worker/container hosts

## 🧠 V7 Architecture

```
WhatsApp
   ↓
Message Router
   ↓
TOHID-AGENT Core
   ├── AI Router
   │    ├── OpenAI
   │    └── Gemini fallback
   ├── Memory
   ├── Profiles
   ├── Permissions
   └── Tool Runner
        ├── GitHub
        ├── Calculator
        ├── System Info
        └── Current Time
   ↓
Response / Voice / Media
```

The tool layer is intentionally separated so future tools can be added without rewriting the WhatsApp message pipeline.

## 💬 Commands

`.menu` — text menu  
`.help` — help  
`.ping` — health check  
`.status` — runtime status  
`.doctor` — configuration diagnostics  
`.provider` — AI provider status  
`.tools` — available tool categories  
`.memory` — memory count  
`.memory clear` / `.newchat` — clear personal memory  
`.profile` — user profile  
`.settings` — voice/memory settings  
`.imagine <prompt>` — image generation  
`.video <prompt>` — video generation  
`.stats` — owner statistics  
`.maintenance on/off` — owner maintenance mode  
`.block <number>` / `.unblock <number>` — owner controls

Normal text can be sent directly to the agent.

## 💻 GitHub Agent

The agent can work with:

- repositories
- repository search
- issues
- commits
- files
- branches
- pull requests

Write operations remain protected:

```
Agent prepares action
        ↓
CONFIRM
        ↓
Execute
```

The owner account is required for protected GitHub writes.

## 🔀 AI Provider Routing

With:

```env
AI_PROVIDER=auto
OPENAI_API_KEY=...
GEMINI_API_KEY=...
```

the intended routing is:

```
OpenAI
  ↓ error
Gemini
```

If only one provider is configured, that provider is used.

## 🎤 Voice

Voice input:

```
WhatsApp voice
     ↓
Transcription
     ↓
TOHID-AGENT
     ↓
Voice reply
```

Use:

```
.voice on
.voice off
```

When voice mode is enabled, normal AI responses are returned as voice.

## 🧠 Memory

MongoDB stores:

- conversation memory
- user profiles
- settings
- usage
- protected pending actions
- audit logs
- blocked users
- WhatsApp authentication state

Use `.memory clear` when you want to reset the current conversation memory.

## 🩺 Diagnostics

`.doctor` checks the presence of:

- OpenAI
- Gemini
- MongoDB
- GitHub
- pairing configuration

It never prints secret values.

## 🌍 Deployment

The WhatsApp worker needs a persistent process.

Supported deployment styles include:

- Heroku
- Railway
- Render
- Koyeb
- Bot-hosting platforms
- VPS/Linux
- Docker
- Replit

Vercel can host the lightweight API/health layer, but the long-running Baileys worker should run on a persistent worker/container host.

Start:

```bash
npm install
npm start
```

## 🔐 Environment Variables

Never commit real credentials.

Required production configuration:

```env
OPENAI_API_KEY=
GEMINI_API_KEY=
MONGO_URI=
OWNER_NUMBER=
GITHUB_TOKEN=
GITHUB_OWNER=Tohidkhan6332
LOGIN_METHOD=pairing
PAIRING_NUMBER=
AI_PROVIDER=auto
```

See `.env.example` for the complete configuration.

## 📁 Structure

```
TOHID-AGENT/
├── index.js
├── config.js
├── lib/
│   ├── agentTools.js
│   ├── database.js
│   ├── github.js
│   ├── menu.js
│   ├── openai.js
│   ├── replyImages.js
│   └── router.js
├── api/
├── assets/
├── Dockerfile
├── Procfile
├── render.yaml
├── railway.json
├── app.json
├── nixpacks.toml
└── .env.example
```

## 🏷️ Branding

**TOHID-AGENT V7**  
**Developer: Tohid**  
**GitHub: Tohidkhan6332**

> V7 is structured as an extensible agent core so future integrations can be added as tools instead of tightly coupling new features to the WhatsApp listener.
