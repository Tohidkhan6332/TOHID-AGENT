# TOHID-AGENT — Hosting Panel Deployment

## Recommended panel settings

Use a **persistent Node.js application/container**, not serverless hosting.

- Runtime: Node.js 22
- Install command: `npm install`
- Start command: `npm start`
- Working directory: repository root
- Port: use the panel-provided `PORT`
- Process mode: one worker/instance per WhatsApp session
- Health check: `GET /healthz`
- Database: MongoDB is the primary production database

## Environment

Copy `panel.env.example` into the panel Environment Variables section and fill the secrets.

Minimum normal deployment:

```env
NODE_ENV=production
OWNER_NUMBER=9198XXXXXXXX
MONGO_URI=mongodb+srv://...
MONGO_DB=tohid-agent
SESSION_STORE_SECRET=<32+ character random secret>
OPENAI_API_KEY=...
```

Gemini can be used instead:

```env
GEMINI_API_KEY=...
AI_PROVIDER=gemini
```

Never commit a real `.env` file or API keys.

## WhatsApp pairing

Recommended initial configuration:

```env
LOGIN_METHOD=pairing
PAIRING_NUMBER=
SESSION_ID=
```

After startup open:

```
https://YOUR-PANEL-DOMAIN/pair
```

Generate the pairing code or QR and connect the WhatsApp account.

For a separate pairing-only deployment:

```env
PAIRING_WEB_ONLY=true
```

The pairing and bot deployments must share `MONGO_URI` and `SESSION_STORE_SECRET` for database-backed session transfer.

## Start command

Use exactly:

```bash
npm install
npm start
```

The application reads the panel-provided `PORT`. Do not hard-code a public port.

For a VPS panel with PM2:

```bash
npm install
pm2 start ecosystem.config.js
pm2 save
```

## Health checks

- `/health`
- `/healthz`
- `/pair`

If `/healthz` returns 503, inspect logs and run:

```bash
npm run doctor
npm run validate
```

## Panel requirements

1. The process must stay alive; Baileys is a long-running WhatsApp connection.
2. Do not run the WhatsApp worker as a serverless/edge function.
3. Keep one active process per bot session unless deliberately using a supported multi-process architecture.
4. Use persistent storage if the panel provides a volume for local assets/backups.
5. Keep secrets in the panel environment manager.
6. Use HTTPS for a public pairing page.
7. Keep `SESSION_ID` and pairing access tokens private.
8. Use a random `SESSION_STORE_SECRET` of at least 32 characters.

## Docker panels

The repository includes a production Dockerfile:

```bash
docker build -t tohid-agent .
docker run --restart unless-stopped --env-file .env -p 3000:3000 tohid-agent
```

If the panel assigns a different public port, follow its port mapping while keeping the application's `PORT` aligned with the runtime.

## Verification checklist

- [ ] Node 22 selected
- [ ] `npm install` succeeds
- [ ] Start command is `npm start`
- [ ] `PORT` is supplied by the panel
- [ ] `OWNER_NUMBER` configured
- [ ] `MONGO_URI` configured
- [ ] `SESSION_STORE_SECRET` configured
- [ ] At least one AI provider configured
- [ ] `/healthz` responds
- [ ] Pairing completes
- [ ] Restart restores the WhatsApp session
