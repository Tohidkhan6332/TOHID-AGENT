# TOHID AGENT — WhatsApp AI Bot

ChatGPT-style WhatsApp AI agent by Tohid with multilingual chat, voice input/output, image generation, web search, image understanding, and owner-only GitHub operations.

## Login
The bot supports **QR** and **pairing-code** login. Use one method per WhatsApp session:
- QR: `LOGIN_METHOD=qr`
- Pairing: `LOGIN_METHOD=pairing` and set `PAIRING_NUMBER=91XXXXXXXXXX`

If `MONGO_URI` is configured, Baileys credentials and Signal keys are stored in MongoDB so Heroku dyno restarts do not normally require a new pairing.

## Heroku
1. Create a Heroku app.
2. Connect GitHub repo `Tohidkhan6332/TOHID-AGENT`, branch `main`.
3. Add the Config Vars from `.env.example`.
4. For persistent WhatsApp auth, set `MONGO_URI` to a MongoDB Atlas connection string.
5. Set `LOGIN_METHOD=qr` for QR or `LOGIN_METHOD=pairing` + `PAIRING_NUMBER` for pairing.
6. Deploy the `main` branch.
7. Open **More → View logs** and complete the selected login method.

The repository includes a Heroku `Procfile` using `worker: node index.js`.

Never commit API keys, WhatsApp auth state, or generated secrets.
