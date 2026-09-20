## 7.5.0 — Contextual Hybrid UI

- Added native Settings panel with Voice ON/OFF and Memory ON/OFF controls.
- Added Settings and Planner entries to the interactive menu list.
- Added direct interactive routing for personal voice/memory preferences.
- Added an explicit interactive UI feature flag with text-only fallback.
- Kept normal AI responses, diagnostics, status, help and planner prompts text-first.
- Updated V7.5 branding and documentation.

## 7.4.0 — Interactive WhatsApp UI

- Added native-flow reply buttons and single-select menu.
- Added button response routing with legacy response compatibility.
- Preserved text commands and added safe interactive sending through Baileys relay.
- Added V7.4 branding.

# TOHID-AGENT V7

## V7.3.0

- Added Heroku Agent 2.0 deployment monitoring for releases, builds and runtime logs.
- Added protected Heroku rollback and build cancellation.
- Added safe config-var name inspection plus protected set/delete actions without exposing values.
- Added protected Heroku maintenance-mode control.
- Added configurable TOHID TECH WhatsApp Channel promotion to bot responses.
- Added `CHANNEL_LINK` environment setting.
- Preserved owner-only + CONFIRM protection for destructive Heroku operations.


## V7.2.0

- Added autonomous agent planner with structured multi-step execution plans.
- Added `agent_plan` tool for complex workflows.
- Added verified tool execution with explicit result validation.
- Added protected-action planning metadata before confirmation.
- Added `.plan <task>` for previewing an execution plan without executing it.
- Added configurable `AGENT_PLANNER_ENABLED` setting.
- Extended V7.2 tool-loop handling to use the configured loop limit.
- Added V7.2 planner syntax validation to GitHub Actions CI.
- Preserved owner-only + CONFIRM protection for GitHub and Heroku writes.


## V7.1.0

- Added dedicated Heroku Platform API agent.
- Added Heroku app listing and app/formation inspection.
- Added protected Heroku restart, stop, start and scale actions.
- Added protected Heroku Platform API redeploy from a downloadable source tarball URL.
- Added Heroku provider diagnostics and menu documentation.
- Added `HEROKU_API_KEY` to the environment template.
- Added official TOHID TECH WhatsApp channel to project documentation.
- Preserved owner-only + CONFIRM protection for destructive deployment actions.

## V7.0.0

- Added extensible local agent tool layer.
- Added safe calculator, runtime diagnostics and current-time tools.
- Added `.doctor`, `.tools` and `.provider` commands.
- Added configurable agent tool-loop limit and AI request timeout.
- Added provider diagnostics for OpenAI/Gemini routing.
- Added V7 environment template and hardened secret ignore rules.
- Added GitHub Actions Node 20 syntax CI.
- Reworked README around the V7 architecture.
- Preserved owner-only GitHub writes and CONFIRM protection.
- Preserved OpenAI-first/Gemini-fallback behavior.
