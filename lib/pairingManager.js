const fs=require("fs");
const path=require("path");
const {spawn}=require("child_process");
const crypto=require("crypto");

const ROOT=path.join(process.cwd(),".tohid-sessions");
const sessions=new Map();
const allowedEnv=new Set([
  "OPENAI_API_KEY","OPENAI_MODEL","OPENAI_IMAGE_MODEL","OPENAI_VIDEO_MODEL","OPENAI_TRANSCRIBE_MODEL","OPENAI_TTS_MODEL","OPENAI_TTS_VOICE",
  "GEMINI_API_KEY","GEMINI_MODEL","GEMINI_IMAGE_MODEL","GEMINI_VIDEO_MODEL","GEMINI_TTS_MODEL","GEMINI_TTS_VOICE","GEMINI_TRANSCRIBE_MODEL",
  "AI_PROVIDER","GITHUB_TOKEN","GITHUB_OWNER","HEROKU_API_KEY","HEROKU_TOKEN","VERCEL_TOKEN","RENDER_API_KEY","RENDER_OWNER_ID","KOYEB_API_TOKEN",
  "MONGO_URI","MONGO_DB","POSTGRES_URL","POSTGRES_SSL","POSTGRES_POOL_MAX","BOT_LANGUAGE","BOT_UI_MODE","PREFIX","CHANNEL_LINK",
  "AI_AGENT_ENABLED","GITHUB_AGENT_ENABLED","HOSTING_AGENT_ENABLED","AI_VIDEO_ENABLED","AI_WEB_SEARCH","VOICE_REPLY","AI_VOICE_REPLY",
  "INTERACTIVE_BUTTONS_ENABLED","BAILEYS_EXTRAS_ENABLED","PLUGIN_SYSTEM_ENABLED","REMOTE_SHELL_ENABLED"
]);

function normalizePhone(value){return String(value||"").replace(/\D/g,"");}
function validPhone(value){const n=normalizePhone(value);return n.length>=10&&n.length<=15;}
function cleanEnv(input={}){
  const out={};
  for(const [key,value] of Object.entries(input||{})){
    if(!allowedEnv.has(key)||typeof value!=="string")continue;
    if(value.length>4096)throw new Error("Environment value too large: "+key);
    out[key]=value;
  }
  return out;
}
function sessionDir(id){return path.join(ROOT,id);}
function snapshot(s){return {id:s.id,phone:s.phone,mode:s.mode,status:s.status,code:s.code||null,qr:s.qr||null,connected:!!s.connected,createdAt:s.createdAt,updatedAt:s.updatedAt};}

function create(options={}){
  const mode=String(options.mode||"pairing").toLowerCase()==="qr"?"qr":"pairing";
  const phone=normalizePhone(options.phone);
  const activeCount=[...sessions.values()].filter(s=>["starting","pairing","connected"].includes(s.status)).length;
  if(activeCount>=Number(process.env.MAX_PAIRING_SESSIONS||10))throw new Error("Pairing service is at its session limit. Try again later.");
  if(mode==="pairing"&&!validPhone(phone))throw new Error("Phone number must contain country code and 10-15 digits.");
  if(mode==="qr"&&phone)throw new Error("QR pairing does not require a phone number.");
  if(phone&&[...sessions.values()].some(s=>s.phone===phone&&["starting","pairing","connected"].includes(s.status)))throw new Error("A session for this number is already active.");
  fs.mkdirSync(ROOT,{recursive:true});
  const id=crypto.randomBytes(8).toString("hex");
  const dir=sessionDir(id);fs.mkdirSync(dir,{recursive:true});
  const authDir=path.join(dir,"auth");fs.mkdirSync(authDir,{recursive:true});
  const env=cleanEnv(options.env);
  const pairingCode=String(crypto.randomInt(10000000,100000000));
  const childEnv={
    ...process.env,
    ...env,
    OWNER_NUMBER:phone,
    PAIRING_NUMBER:mode==="pairing"?phone:"",
    PAIRING_CODE:mode==="pairing"?pairingCode:"",
    LOGIN_METHOD:mode,
    AUTH_DIR:authDir,
    LOCAL_AUTH_ONLY:"1",
    TOHID_PAIRING_CHILD:"1",
    PORT:"",
    ADMIN_PANEL_ENABLED:"false"
  };
  delete childEnv.PAIRING_WEB_TOKEN;
  delete childEnv.TELEGRAM_BOT_TOKEN;
  const child=spawn(process.execPath,[path.join(process.cwd(),"index.js")],{
    cwd:process.cwd(),env:childEnv,stdio:["ignore","pipe","pipe","ipc"]
  });
  const session={id,phone,mode,env,status:"starting",code:null,qr:null,connected:false,child,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  sessions.set(id,session);
  const touch=()=>{session.updatedAt=new Date().toISOString();};
  child.stdout.on("data",buf=>{const text=String(buf);if(process.env.DEBUG==="true")process.stdout.write("[pair:"+id+"] "+text);const m=text.match(/WHATSAPP PAIRING CODE:\s*([A-Z0-9-]{8,12})/i);if(m&&!session.code){session.code=m[1].replace(/-/g,"");session.status="pairing";touch();}});
  child.stderr.on("data",buf=>{if(process.env.DEBUG==="true")process.stderr.write("[pair:"+id+"] "+String(buf));});
  child.on("message",msg=>{
    if(!msg||typeof msg!=="object")return;
    if(msg.type==="pairing-code"){session.code=String(msg.code||"").replace(/-/g,"");session.status="pairing";touch();}
    if(msg.type==="qr"){session.qr=String(msg.qr||"");session.status="pairing";touch();}
    if(msg.type==="connected"){session.connected=true;session.status="connected";touch();}
    if(msg.type==="status"){session.status=String(msg.status||session.status);touch();}
  });
  child.on("exit",(code,signal)=>{if(!session.connected&&session.status!=="stopped")session.status="stopped";session.exit={code,signal};touch();});
  setTimeout(()=>{if(!session.connected&&["starting","pairing"].includes(session.status))stop(id).catch(()=>{});},Number(process.env.PAIRING_TIMEOUT_MS||180000));
  return snapshot(session);
}
function get(id){const s=sessions.get(String(id));return s?snapshot(s):null;}
function getSession(id){return sessions.get(String(id))||null;}
async function stop(id){
  const s=sessions.get(String(id));if(!s)return false;
  s.status="stopping";s.updatedAt=new Date().toISOString();
  try{if(s.child.connected)s.child.send({type:"logout"});}catch{}
  try{s.child.kill("SIGTERM");}catch{}
  setTimeout(()=>{try{if(!s.child.killed)s.child.kill("SIGKILL");}catch{}},5000);
  s.status="stopped";s.updatedAt=new Date().toISOString();return true;
}
function list(){return [...sessions.values()].map(snapshot);}
function stats(){return {active:[...sessions.values()].filter(s=>["starting","pairing","connected"].includes(s.status)).length,total:sessions.size};}
module.exports={create,get,getSession,stop,list,stats,cleanEnv,allowedEnv};
