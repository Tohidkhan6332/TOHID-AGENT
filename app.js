#!/usr/bin/env node

// Portable web/worker launcher for Heroku, Render, Railway, Replit and Docker.
// MrTohid.js remains the actual WhatsApp agent runtime.
const DEFAULT_PORT=3000;
const rawPort=process.env.PORT||String(DEFAULT_PORT);
const port=Number(rawPort);

if(!Number.isInteger(port)||port<1||port>65535){
  console.error("❌ Invalid PORT: "+rawPort);
  process.exit(1);
}

process.env.PORT=String(port);
process.env.NODE_ENV=process.env.NODE_ENV||"production";

require("./MrTohid.js");
