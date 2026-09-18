# TOHID AGENT — WhatsApp AI Bot

ChatGPT-style WhatsApp AI agent by Tohid with multilingual chat, voice input/output, image generation, web search, image understanding, and owner-only GitHub operations.

<p align="center">
  <a href="https://heroku.com/deploy?template=https://github.com/Tohidkhan6332/TOHID-AGENT">
    <img src="https://www.herokucdn.com/deploy/button.svg" alt="Deploy to Heroku">
  </a>
</p>

## Login
The bot supports **QR** and **pairing-code** login. Use one method per WhatsApp session:
- QR: `LOGIN_METHOD=qr`
- Pairing: `LOGIN_METHOD=pairing` and set `PAIRING_NUMBER=91XXXXXXXXXX`

If `MONGO_URI` is configured, Baileys credentials and Signal keys are stored in MongoDB so Heroku dyno restarts do not normally require a new pairing.

## Heroku — One-click Deploy

1. Click the **Deploy to Heroku** button above.
2. Choose/create your Heroku app.
3. Fill the required Config Vars:
   - `OPENAI_API_KEY`
   - `GITHUB_TOKEN`
   - `OWNER_NUMBER`
   - `MONGO_URI`
4. Choose:
   - QR: `LOGIN_METHOD=qr`
   - Pairing: `LOGIN_METHOD=pairing` + `PAIRING_NUMBER`
5. Click **Deploy app**.
6. Open **More → View logs** and complete the selected WhatsApp login.

The repository includes a Heroku `Procfile` using `worker: node index.js`.

## Local Setup

1. Node.js 20+
2. Copy `.env.example` to `.env`
3. Fill your API keys and configuration.
4. Run `npm install`
5. Run `npm start`
6. Complete QR or pairing-code login.

Never commit API keys, WhatsApp auth state, or generated secrets.
