# 🤖 TOHID-AGENT V7.4

**TOHID-AGENT V7.4** is a production-oriented WhatsApp AI Agent engineered and branded by **Tohid**.

## 🚀 V7.4 Core

- 🧭 Autonomous planner for complex multi-step tasks
- ✅ Verified tool execution and result checks
- 🗺️ `.plan <task>` workflow preview without execution

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

## 🧭 V7.4 Autonomous Planner

For complex requests, the agent can create a structured plan, execute tools step-by-step, verify returned results, and adapt the next step from the tool output. Protected operations remain gated by owner authorization and explicit **CONFIRM**.

Preview a plan without execution:

```text
.plan Deploy my GitHub project to Heroku and verify it
```

The planner does not bypass permissions or confirmations; it is an orchestration layer around the existing tool security model.

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
`.plan <task>` — build a structured execution plan without executing it  
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


## ☁️ Heroku Agent 2.0

V7.1 adds a dedicated Heroku Platform API agent. Configure `HEROKU_API_KEY` in the hosting environment — never commit it.

From WhatsApp, the owner can naturally request:

- `List my Heroku apps`
- `Show info for myapp`
- `Restart myapp`
- `Stop myapp`
- `Start myapp`
- `Scale myapp web=1 worker=0`
- `Show releases/builds/logs for myapp`
- `Rollback myapp to v42`
- `Show config vars for myapp` (names only; values are never revealed)
- `Set/delete a config var` (owner + CONFIRM)
- `Enable/disable maintenance mode` (owner + CONFIRM)
- `Cancel a running build` (owner + CONFIRM)
- `Redeploy myapp from <source tarball URL>`

Heroku restart/stop/start/scale/redeploy actions are protected by the same owner + explicit **CONFIRM** workflow used for GitHub writes.

Heroku's Platform API uses bearer-token authentication. Heroku documents dyno restart through the dyno/formation API and scaling through formation updates. A true Platform API build/redeploy requires a downloadable source tarball URL; for apps connected to GitHub, Heroku's GitHub integration can perform manual deploys from the connected branch. citeturn0search0turn0search5turn1search0

### Heroku environment

```env
HEROKU_API_KEY=
```

The token must be configured directly in the hosting provider's Secrets/Environment Variables. Do not paste or commit the token into GitHub.


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
│   ├── agentPlanner.js
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

**TOHID-AGENT V7.4**  
**Developer: Tohid**  
**GitHub: Tohidkhan6332**

**Official WhatsApp Channel: TOHID TECH** — https://whatsapp.com/channel/0029VaGyP933bbVC7G0x0i2T

> V7 is structured as an extensible agent core so future integrations can be added as tools instead of tightly coupling new features to the WhatsApp listener.


## 📢 TOHID TECH Promotion

Bot responses include the official TOHID TECH WhatsApp Channel. Configure `CHANNEL_LINK` to change it.

`https://whatsapp.com/channel/0029VaGyP933bbVC7G0x0i2T`


## V7.4 Interactive Buttons

TOHID-AGENT V7.4 adds native WhatsApp interactive reply buttons and list selection while preserving all text commands. If a client cannot render the interactive message, the bot keeps its normal text-command flow available.
