## Baileys / WhatsApp UI

TOHID-AGENT keeps **official `@whiskeysockets/baileys` as the primary WhatsApp runtime and the only live socket**.

The project also contains an isolated **fork-derived extras layer** based on the optional features from `mauricegift/baileys-new`. It is adapted to the already-connected official socket rather than starting a second WhatsApp connection.

### Extras architecture

```
Official Baileys
      |
      +--> normal WhatsApp runtime
      |
      +--> Baileys Extras Adapter
              |
              +--> official capability first
              +--> fork-derived compatibility only when needed
              +--> unsupported -> safe error
```

Currently this layer provides:
- Group Status / multi-group status compatibility derived from `baileys-new`.
- Official-first carousel helpers.
- Official-first Channel/newsletter methods when exposed by the active Baileys build.
- Capability reporting with the source (`official`, `baileys-new-derived`, or `unsupported`).
- No second WhatsApp socket.

The fork-derived group-status implementation is based on the public `mauricegift/baileys-new` implementation and keeps its source lineage documented in `lib/baileysForkExtras.js`.

Set `BAILEYS_EXTRAS_ENABLED=false` to disable the extras layer while keeping official Baileys fully operational.


TOHID-AGENT uses **official `@whiskeysockets/baileys` as the primary WhatsApp runtime**. Fork-only capabilities are isolated behind the Baileys extras adapter so the core connection stays on official Baileys.

Enabled integrations include:
- WhatsApp Channel/newsletter capabilities are used from the official socket when available; fork-only channel capabilities are isolated behind the extras layer.
- Group Status, including single-group and multi-group status delivery, through the extras compatibility layer when supported.
- Carousel messages with media and native-flow CTAs.
- Native-flow buttons/lists through `gifted-btns`.
- Baileys log suppression and CommonJS compatibility.

Protected Channel and Group Status mutations require owner authorization and explicit `CONFIRM`.

# 🤖 TOHID-AGENT V11.0

**TOHID-AGENT V9.0** is the futuristic autonomous WhatsApp AI agent architecture by **Tohid**.

## 🧠 V8.1 Agent Core

V8.1 moves TOHID-AGENT toward a modular personal-agent platform instead of a command-only bot.

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


**TOHID-AGENT V9.0** is a production-oriented WhatsApp AI Agent engineered and branded by **Tohid**.


## 🎯 V9 Mission Control

V9 introduces a persistent mission layer above the existing planner and tools. Missions are stored in MongoDB and expose a lifecycle instead of treating every request as a one-shot message.

### Mission lifecycle

```
QUEUED → RUNNING → COMPLETED
           │
           ├→ WAITING_CONFIRMATION
           ├→ FAILED
           └→ CANCELLED
```

Commands:

- `.mission <request>` — create a persistent mission and generate its execution steps.
- `.missions` — show recent missions and progress.
- `.mission status <id>` — inspect one mission.
- `.mission confirm <id>` — release a confirmation-gated mission.
- `.mission cancel <id>` — cancel a queued/running mission.
- `.schedule <delay> <mission>` — schedule a mission, for example `.schedule 30m check my GitHub project`.
- `.schedules` — list scheduled missions.
- `.schedule cancel <id>` — cancel a scheduled mission.

The V9 scheduler is MongoDB-backed and uses bounded polling. Scheduled jobs do not bypass the existing permission model: protected GitHub, hosting, configuration and destructive actions still require the normal authorization and confirmation gates.

### V9 architecture

```
WhatsApp
   ↓
Mission Control
   ├── Persistent Missions
   ├── Progress / Step State
   ├── Confirmation Gate
   ├── Cancellation
   └── Verification metadata
        ↓
Autonomous Planner
   ↓
Skill Registry
   ├── GitHub
   ├── DevOps
   ├── Memory
   ├── Vision / Voice / Media
   └── Security
        ↓
MongoDB + WhatsApp
```

V9 is the foundation for the next Mission Mode layer: repository analysis → implementation → validation → commit → deploy → health verification → final report.

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

TOHID-AGENT is designed for long-running WhatsApp hosting.

Supported deployment styles:
- Heroku
- Railway
- Render
- Koyeb
- Bot-hosting platforms
- VPS/Linux
- Docker
- Replit

Vercel can host the lightweight API/health layer, but the long-running Baileys worker should run on a persistent worker/container host.

### 🛡️ V8.1 Production Hardening

V8.1 adds deployment-focused safeguards so a Heroku deployment fails early with a useful message instead of starting in a broken state.

- 🔎 **Startup preflight** — validates Node 22, AI provider, owner number and production MongoDB configuration.
- 🩺 **Real health endpoints** — `/health` and `/healthz` report WhatsApp, MongoDB, AI-provider and optional-integration readiness without exposing secrets.
- 🧹 **Graceful shutdown** — closes WhatsApp authentication and MongoDB connections during Heroku dyno termination.
- 📝 **Structured logs** — timestamped INFO/WARN/ERROR runtime logs.
- 🔐 **Secret-safe diagnostics** — no API keys, tokens or MongoDB credentials are returned by health checks.
- 🎛️ **Optional integration switches** — GitHub and hosting-management features can be disabled independently.
- 📌 **Node runtime pinning** — Node 22 is declared in `.nvmrc`, `package.json` and deployment configuration.

### 🚀 One-click Heroku deployment

Use the button below to open Heroku's deployment flow directly from this repository:

[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/Tohidkhan6332/TOHID-AGENT)

The repository includes a production-ready `app.json`. Heroku reads that file automatically and pre-creates the application's Config Vars, so you **do not need to manually add the variable names one by one**.

**You only need to enter your own secret/account values when Heroku asks for them**, such as:
- `MONGO_URI` — required for persistent MongoDB auth, memory and task history.
- `OWNER_NUMBER` — your WhatsApp owner number.
- `OPENAI_API_KEY` **or** `GEMINI_API_KEY` — at least one AI provider key.
- `PAIRING_NUMBER` — if using pairing login.
- `GITHUB_TOKEN` — only if you want GitHub automation.
- `HEROKU_API_KEY`, `VERCEL_TOKEN`, `RENDER_API_KEY`, `KOYEB_API_TOKEN` — only for optional hosting-management integrations.

All non-secret defaults are already defined in `app.json`, including `AI_PROVIDER=auto`, MongoDB database name, autonomous mode, planner/verification settings, login method, rate limits and interactive UI.

> **Important:** API keys and MongoDB credentials must never be hard-coded into `app.json` or committed to GitHub. Heroku stores values entered during deployment as Config Vars.

After deployment:
1. Open the Heroku app logs.
2. Check `https://<your-app-name>.herokuapp.com/health` for a safe production health report.
3. Wait for the WhatsApp pairing/connection flow.
4. If pairing login is enabled, use the configured `PAIRING_NUMBER`.
5. Send `.help` to the connected WhatsApp account.

For local/VPS deployment:

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

For Heroku, **do not manually create Config Var names**. The included `app.json` declares the deployment configuration and Heroku will create those fields in the deploy form.

Never commit real credentials.

### Required values for a working production deployment

```env
MONGO_URI=
OWNER_NUMBER=
OPENAI_API_KEY=
# or:
GEMINI_API_KEY=
```

### Optional integrations

```env
GITHUB_TOKEN=
HEROKU_API_KEY=
VERCEL_TOKEN=
RENDER_API_KEY=
RENDER_OWNER_ID=
KOYEB_API_TOKEN=
```

Everything else has safe defaults in `app.json`. See `.env.example` for the full local configuration.


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

**TOHID-AGENT V9.0**  
**Developer: Tohid**  
**GitHub: Tohidkhan6332**

**Official WhatsApp Channel: TOHID TECH**

<a href="https://whatsapp.com/channel/0029VaGyP933bbVC7G0x0i2T"><img src="https://img.shields.io/badge/Join%20TOHID%20TECH%20WhatsApp%20Channel-25D366?style=for-the-badge&logo=whatsapp&logoColor=white" alt="Join TOHID TECH WhatsApp Channel"></a>

> V7 is structured as an extensible agent core so future integrations can be added as tools instead of tightly coupling new features to the WhatsApp listener.


## 📢 TOHID TECH Promotion

Bot responses include the official TOHID TECH WhatsApp Channel. Configure `CHANNEL_LINK` to change it.

<a href="https://whatsapp.com/channel/0029VaGyP933bbVC7G0x0i2T"><img src="https://img.shields.io/badge/Join%20TOHID%20TECH%20WhatsApp%20Channel-25D366?style=for-the-badge&logo=whatsapp&logoColor=white" alt="Join TOHID TECH WhatsApp Channel"></a>


## V7.6 Interactive Buttons

TOHID-AGENT V9.0 adds native WhatsApp interactive reply buttons and list selection while preserving all text commands. If a client cannot render the interactive message, the bot keeps its normal text-command flow available.


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


## 🩺 Production Health

Heroku and other hosts can use:

``
GET /health
GET /healthz
```

The endpoint intentionally exposes only safe operational state: version, uptime, Node version, database connectivity, provider readiness and integration availability. Secret values are never returned.

If the health endpoint returns HTTP 503, inspect the application logs for the startup preflight error or runtime failure.


## 🌐 Bot Language System

TOHID-AGENT uses **English as the default language**. Language preferences are persisted per WhatsApp chat in MongoDB when available.

Commands:
- `.language` — show the current language
- `.language Hindi` — switch the current chat to Hindi
- `.language English` — switch back to English
- `.language Japanese` — any language name can be requested
- `.help <language>` — view translated help and set that language for the chat

The selected language applies to system messages, confirmations, menus, help text and AI responses. Commands, URLs, code, IDs and technical identifiers remain unchanged.


## 🎛️ V11 Adaptive UI Engine

V11 replaces the fixed three-mode interface with an adaptive UI engine. The preference is stored per chat in MongoDB settings when available.

Modes:

- `.mode auto` — adaptive UI; chooses the least noisy interface from the current context (**default**).
- `.mode buttons` — interactive controls for navigation and actions.
- `.mode text` — text/commands only.
- `.mode hybrid` — text + interactive controls together.
- `.mode minimal` — concise text with only essential controls.
- `.mode` — show the current UI mode.

For backward compatibility, `.mode both` is treated as `hybrid`.

### V11 UI behavior

```text
User preference
      ↓
Adaptive UI Engine
      ↓
Current context
 ┌────┼────────┐
help navigation actions result
 ↓       ↓       ↓      ↓
UI      UI      UI     text
```

The engine avoids adding buttons to ordinary AI/status replies when they are not useful, while keeping interactive controls for navigation, settings and actionable workflows. If interactive rendering is unavailable, the text path remains available.

The UI engine also supports per-chat language preferences and preserves the existing owner/confirmation security model.

## 🧩 V11 WhatsApp-Only Control Center

TOHID-AGENT V11 can be administered directly from WhatsApp by the owner. The bot can manage runtime configuration, install/reload/disable/remove trusted plugins, accept plugin JavaScript files, load raw URLs/GitHub Gists, and run a small protected remote-shell allowlist.

### Runtime configuration

- `.config list` — show available configuration keys with secret masking
- `.config get <key>` — inspect one setting
- `.config set <key> <value> CONFIRM` — persist a global runtime override
- `.config reset <key> CONFIRM` — remove one override

### Plugins

- `.plugin list`
- `.plugin install <raw-url-or-gist> <name> CONFIRM`
- Send a JavaScript plugin file with caption: `.plugin install <name> CONFIRM`
- `.plugin enable <name>`
- `.plugin disable <name>`
- `.plugin reload <name>`
- `.plugin remove <name> CONFIRM`

Plugins use a small API: `registerCommand`, `onMessage`, `send`, `db`, and `log`. They are loaded from the local `plugins/` directory. **Only install plugin code you trust**: a JavaScript plugin executes inside the bot's Node.js process and is therefore privileged code. The installer validates syntax, records a SHA-256 hash and warns when privileged runtime APIs are present.

### Remote environment control

- `.shell <command> CONFIRM` is owner-only and disabled by default.
- When enabled, it is restricted to a small allowlist (`git status`, Node/npm version, disk/memory/uptime, and controlled PM2 status/restart/reload commands).
- Secrets are masked in configuration output.

The control center is designed so routine bot administration can be performed from WhatsApp without opening the hosting dashboard or editing files manually. External destructive operations still retain owner/confirmation gates.
\n\n## 🛠️ V11 WhatsApp AI Command Center\n\nThe bot can now act as its own WhatsApp-only control center for the owner.\n\n- `.admin` — live control-center status\n- `.feature list` / `.feature on <name> CONFIRM` / `.feature off <name> CONFIRM` — persistent runtime feature flags\n- `.file list [dir]` — workspace file browser\n- `.file read <path>` — read source files over WhatsApp\n- `.file backup <path>` / `.file backups [path]` — versioned local backups\n- `.file restore <backup-id> CONFIRM` — rollback with a pre-restore backup\n- `.file write <path> CONFIRM` + code block — owner-only file editing with automatic backup\n- `.plugin test <name>` / `.plugin logs <name>` / `.plugin update <name> <URL> CONFIRM` — plugin lifecycle controls\n- AI planner can continue to handle supported GitHub and hosting operations using natural-language requests.\n\n### Security model\nAll control-center operations are owner-only. File writes/restores and runtime-changing plugin/feature operations require explicit `CONFIRM`. File paths are sandboxed to the bot workspace and exclude `.git`, `node_modules`, and the control-data directory. Plugin code is trusted Node.js code and should only be installed from sources you trust.\n

## 🚀 V11.1 Control Center Upgrade

V11.1 adds a more complete WhatsApp-native administration layer.

### 📊 Dashboard
- `.dashboard` — live runtime, MongoDB, users, plugin, owner and integration summary.

### 🛡️ RBAC
Roles:
- `primary_owner` — full control.
- `delegated_owner` — full bot control except ownership transfer/revocation.
- `developer` — development-oriented GitHub/hosting/plugin/file/mission permissions.
- `admin` — bot/user/plugin/mission administration.
- `user` — normal AI, memory and bot access.

Primary owner can manage roles:
- `.role list`
- `.role get <number>`
- `.role set <number> developer CONFIRM`
- `.role set <number> admin CONFIRM`
- `.role set <number> user CONFIRM`

### 🧩 Plugin Marketplace
- `.plugin search <query>` searches public GitHub repositories using the `tohid-agent-plugin` keyword.
- Review a repository before installing it.
- Existing URL/file/code installation remains protected by owner access and explicit `CONFIRM`.

### 🩺 Doctor 2.0
`.doctor` now checks Node.js, MongoDB, AI provider configuration, GitHub configuration, plugin storage and network/DNS reachability.

### 🧭 Workflow Mode
`.workflow <multi-step task>` starts an autonomous agent workflow using the existing planner/task engine. Existing confirmation gates remain active for protected external actions.

### 💾 Backup & Rollback
The existing control center automatically creates backups before file edits and restores. Use:
- `.file backup <path>`
- `.file backups [path]`
- `.file restore <backup-id> CONFIRM`

V11.1 keeps secrets out of source control and does not expose API keys through dashboard/doctor output.
