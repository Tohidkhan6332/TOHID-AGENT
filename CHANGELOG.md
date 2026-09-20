# TOHID-AGENT V7

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
