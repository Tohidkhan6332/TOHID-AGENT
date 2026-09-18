# TOHID AGENT — WhatsApp AI Bot

A ChatGPT-style WhatsApp AI agent by Tohid. It supports multilingual chat, voice input/output, image generation, web search, image understanding, and GitHub operations.

## Features
- Natural multilingual conversation
- WhatsApp text and voice messages
- AI voice replies
- Image generation with GPT-Image-2
- Image understanding through the AI model
- Optional live web search
- GitHub: list repos, read files, create/update files, branches, issues and pull requests
- Owner-only GitHub write actions
- Conversation memory per WhatsApp user
- Baileys pairing-code login

## Setup
1. Node.js 20+
2. Copy `.env.example` to `.env`
3. Fill `OPENAI_API_KEY`, `GITHUB_TOKEN`, and `OWNER_NUMBER`.
4. Run `npm install`
5. Run `npm start`
6. Pair the WhatsApp account.

Never commit API keys, WhatsApp auth state, or generated secrets.
