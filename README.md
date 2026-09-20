# 🤖 TOHID-AGENT V8.0

**TOHID-AGENT V8.0** is the futuristic autonomous WhatsApp AI agent architecture by **Tohid**.

## 🧠 V8.0 Agent Core

V8.0 moves TOHID-AGENT toward a modular personal-agent platform instead of a command-only bot.

- 🧠 **Autonomous Agent Core** — structured task planning, risk classification and verification gates.
- 🧩 **Modular Skill Registry** — core, memory, GitHub, DevOps, vision, voice, media, planner and security skills.
- 📋 **Tracked Agent Tasks** — MongoDB-backed task history and audit events.
- 🛡️ **Safety Engine** — read/write/deploy/delete/config risk classification with confirmation for external side effects.
- 🩺 **Agent Health** — provider, integration, planner and safety capability status.
- 🌍 **AI Language Layer** — English master help with on-demand AI translation for other languages.
- 🤖 **Natural-language execution** — users can describe goals instead of memorizing commands.
- 🔍 **Verification-first execution** — external actions must be verified before the agent reports success.

### V8 commands

`.task <request>` — create a tracked autonomous task and generate its execution plan  
`.tasks` — show recent tracked tasks  
`.agent` / `.health` — show agent-core health and capabilities  
`.skills` — show active modular skills  
`.plan <task>` — preview an execution plan  
`.help` — English master help + AI language selector

### V8 architecture

```
WhatsApp
   ↓
Message Router
   ↓
TOHID-AGENT Core
   ├── AI Provider Router
   │    ├── OpenAI
   │    └── Gemini fallback
   ├── Agent Core
   │    ├── Planner
   │    ├── Risk Guard
   │    ├── Task Tracker
   │    └── Verification
   ├── Skill Registry
   │    ├── GitHub
   │    ├── DevOps
   │    ├── Memory
   │    ├── Vision
   │    ├── Voice
   │    └── Media
   ├── Persistent MongoDB
   └── WhatsApp Interface
```

V8 does **not** remove the existing permission model. External writes, deployments, configuration changes and destructive operations remain protected by owner authorization and explicit confirmation.

---


**TOHID-AGENT V8.0** is a production-oriented WhatsApp AI Agent engineered and branded by **Tohid**.

## 🚀 V7.6 Core

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

## 🧭 V7.6 Autonomous Planner

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

**TOHID-AGENT V8.0**  
**Developer: Tohid**  
**GitHub: Tohidkhan6332**

**Official WhatsApp Channel: TOHID TECH** — https://whatsapp.com/channel/0029VaGyP933bbVC7G0x0i2T

> V7 is structured as an extensible agent core so future integrations can be added as tools instead of tightly coupling new features to the WhatsApp listener.


## 📢 TOHID TECH Promotion

Bot responses include the official TOHID TECH WhatsApp Channel. Configure `CHANNEL_LINK` to change it.

`https://whatsapp.com/channel/0029VaGyP933bbVC7G0x0i2T`


## V7.6 Interactive Buttons

TOHID-AGENT V8.0 adds native WhatsApp interactive reply buttons and list selection while preserving all text commands. If a client cannot render the interactive message, the bot keeps its normal text-command flow available.


## V7.6 Contextual Interactive UI

V7.6 keeps the UI deliberately hybrid:

- 🔘 Buttons/lists are used for navigation, settings and link actions where they improve usability.
- 💬 Normal AI chat, status, diagnostics, help, planning prompts and command responses stay as text.
- ⚙️ Settings now has native controls for Voice ON/OFF and Memory ON/OFF.
- 🧭 Planner remains text-first because a task still needs a user-provided prompt.
- 🛡️ Interactive UI failures automatically fall back to the existing text menu.
- 🔧 Set `INTERACTIVE_BUTTONS_ENABLED=false` to disable interactive UI while keeping text commands.

The bot does not add buttons to every AI response, avoiding unnecessary UI noise.


## 🚀 V7.6 Build → GitHub → Deploy

The agent now has an end-to-end deployment workflow. A WhatsApp request such as:

`Build a portfolio website named Tohid Portfolio, create the GitHub repo, upload it, and deploy it to Vercel.`

can be planned and executed by the agent without requiring the user to open the hosting dashboard, provided the required provider credentials are configured in the bot environment.

Supported deployment adapters in the WhatsApp agent:
- GitHub repository creation and file writes
- Vercel
- Render
- Koyeb
- Heroku through the dedicated Heroku Agent

The deployment tools are owner-protected and require **CONFIRM** before creating/updating external resources. Provider credentials are never shown in chat.

Render's API supports programmatic service creation from a repository, and Koyeb supports API-driven application/service management and GitHub-based deployment. citeturn2view0turn0search7

### V7.7 — WhatsApp Hosting Management

TOHID-AGENT can manage the configured hosting platforms directly from WhatsApp:
- **Vercel:** projects, deployment status, inspect deployments, redeploy, delete project/deployment.
- **Render:** services, service status, redeploy, delete service.
- **Koyeb:** apps/services, status, redeploy, pause/resume, delete service/app.
- **Heroku:** existing app/release/build/log/config-var controls plus protected app deletion.

Read-only status queries can run immediately. Deployments, lifecycle changes, configuration changes, and deletions remain owner-only and require an explicit CONFIRM before execution.

Example messages: `Vercel projects dikhao`, `Render project redeploy karo`, `Koyeb service pause karo`, `Heroku app delete karo`.
