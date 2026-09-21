const fs=require("fs");
const path=require("path");
const http=require("http");
const qrcode=require("qrcode-terminal");
const pino=require("pino");
const {MongoClient}=require("mongodb");
const {default:makeWASocket,useMultiFileAuthState,initAuthCreds,BufferJSON,DisconnectReason,downloadContentFromMessage,fetchLatestBaileysVersion,makeCacheableSignalKeyStore,Browsers}=require("@whiskeysockets/baileys");
const cfg=require("./config");
const planner=require("./lib/agentPlanner");
const agentCore=require("./lib/agentCore");
const skills=require("./lib/skills");
const ai=require("./lib/openai");
const db=require("./lib/database");
const router=require("./lib/router");
const replyImages=require("./lib/replyImages");
const menu=require("./lib/menu");
const buttons=require("./lib/buttons");
const ui=require("./lib/uiEngine");
const plugins=require("./lib/pluginManager");
const control=require("./lib/controlCenter");
const i18n=require("./lib/i18n");
const preflight=require("./lib/preflight");
const log=require("./lib/logger");
const mission=require("./lib/mission");
const scheduler=require("./lib/scheduler");
const baileysExtras=require("./lib/baileysExtras");
const rbac=require("./lib/rbac");
const dashboard=require("./lib/dashboard");
const doctor=require("./lib/doctor");
const dmRelay=require("./lib/dmRelay");
const urlManager=require("./lib/urlManager");
const pairingManager=require("./lib/pairingManager");
const pairingWeb=require("./lib/pairingWeb");
const telegramPairing=require("./lib/telegramPairing");
const groupGuard=require("./lib/groupGuard");

const AUTH=path.resolve(process.env.AUTH_DIR||path.join(process.cwd(),"auth_info_baileys"));
const TMP=path.join(process.cwd(),"tmp");
if(!fs.existsSync(TMP))fs.mkdirSync(TMP,{recursive:true});
const rate=new Map();
let maintenance=false;
let activeSocket=null;
let activeCloseAuth=async()=>{};
let shuttingDown=false;
const delegatedOwners=new Set(cfg.delegatedOwnerNumbers||[]);

function parseDelay(value){
  const m=String(value||"").trim().match(/^(\d+)\s*(s|m|h|d)$/i);
  if(!m)return null;
  const n=Number(m[1]); const unit=m[2].toLowerCase();
  const ms=n*(unit==="s"?1000:unit==="m"?60000:unit==="h"?3600000:86400000);
  return ms>=60000?ms:null;
}

scheduler.register("mission",async(job)=>{
  const p=job.payload||{};
  const created=await mission.create(job.jid,p.request||"Scheduled mission",{scheduled:true});
  if(activeSocket){
    const msg="⏰ *Scheduled Mission Started*\\n\\n🆔 "+(created.id||"local")+"\\n🧭 "+(created.request||"")+"\\n📊 Status: "+created.status;
    await send(activeSocket,job.jid,msg,{category:"utility"});
  }
});

function normalizeOwnerNumber(value){return String(value||"").split("@")[0].replace(/\D/g,"");}
function isPrimaryOwner(jid){return !!cfg.ownerNumber&&normalizeOwnerNumber(jid)===cfg.ownerNumber;}
function isOwner(jid){const n=normalizeOwnerNumber(jid);return !!n&&(n===cfg.ownerNumber||delegatedOwners.has(n));}
async function hasPermission(jid,permission){return isOwner(jid)||await rbac.can(jid,permission,cfg,delegatedOwners);}
async function loadDelegatedOwners(){try{const list=await db.getDelegatedOwners();for(const n of list)delegatedOwners.add(n);log.info("Delegated owners loaded",{count:delegatedOwners.size});}catch(e){log.warn("Delegated owners could not be loaded",{message:e?.message});}}
function allowed(jid){const now=Date.now(),bucket=rate.get(jid)||{at:now,count:0};if(now-bucket.at>60000){bucket.at=now;bucket.count=0;}bucket.count++;rate.set(jid,bucket);return bucket.count<=cfg.rateLimitPerMinute;}
function normalizeUIMode(value){return ui.normalize(value);}
async function getUIMode(jid){return ui.get(jid);}
function normalizeJid(jid){return String(jid||"").split(":")[0];}
function applyGlobalConfig(values={}){for(const [key,value] of Object.entries(values)){if(!Object.prototype.hasOwnProperty.call(cfg,key))continue;const current=cfg[key];if(typeof current==="boolean")cfg[key]=String(value).toLowerCase()==="true";else if(typeof current==="number")cfg[key]=Number(value);else cfg[key]=value;}}
function applyFeatureState(){const f=control.featureList();for(const key of ["githubEnabled","hostingEnabled","pluginSystemEnabled","videoEnabled","webSearch","baileysExtrasEnabled"]){if(Object.prototype.hasOwnProperty.call(f,key))cfg[key]=!!f[key];}}
function maskConfigValue(key,value){const secret=/(key|token|secret|password|uri)/i.test(String(key));if(secret&&value)return String(value).length>8?String(value).slice(0,4)+"••••"+String(value).slice(-4):"••••";return String(value??"");}
async function pluginSend(jid,text,ctx={}){return send(activeSocket,jid,text,ctx);}
async function installPluginFromMessage(jid,sender,msg,text){
 if(!cfg.pluginSystemEnabled||!isOwner(sender)||!/^\\.plugin\\s+install(?:\\s|$)/i.test(text))return false;
 const parts=text.trim().split(/\\s+/);const confirm=parts.some(x=>x.toUpperCase()==="CONFIRM");
 if(!confirm){await send(activeSocket,jid,"🔐 Plugin installation changes the bot runtime. Owner + CONFIRM required.",{category:"security"});return true;}
 try{
  if(msg.documentMessage){const filename=msg.documentMessage.fileName||"plugin.js";const safe=filename.replace(/[^a-zA-Z0-9._-]/g,"_");const buf=await downloadMedia(msg.documentMessage,"document");if(buf.length>cfg.pluginInstallLimitKb*1024)throw new Error("Plugin file exceeds the configured size limit.");const tmp=path.join(TMP,"plugin-"+Date.now()+"-"+safe);fs.writeFileSync(tmp,buf);const name=parts[3]&&parts[3].toUpperCase()!=="CONFIRM"?parts[3]:path.basename(safe,".js");const result=await plugins.installFile(tmp,{name,cfg,send:pluginSend});fs.unlinkSync(tmp);await send(activeSocket,jid,"✅ Plugin installed: *"+result.name+"*\\nVersion: "+result.version+"\\nCommands: "+(result.commands||[]).join(", "),{category:"utility"});return true;}
  const source=parts[2]||"";
  if(/^https?:\\/\\//i.test(source)){const name=parts[3]&&parts[3].toUpperCase()!=="CONFIRM"?parts[3]:"remote-plugin";const result=await plugins.installFromUrl(source,{name,cfg,send:pluginSend});await send(activeSocket,jid,"✅ Plugin installed: *"+result.name+"*\\nVersion: "+result.version,{category:"utility"});return true;}
  const match=text.match(/```(?:javascript|js)?\\s*([\\s\\S]*?)```/i);
  if(match){const name=parts[2]&&parts[2].toUpperCase()!=="CONFIRM"?parts[2]:"custom-plugin";const result=await plugins.installSource({name,source:match[1],cfg,send:pluginSend});await send(activeSocket,jid,"✅ Code plugin installed: *"+result.name+"*\\nVersion: "+result.version,{category:"utility"});return true;}
  await send(activeSocket,jid,"Usage: .plugin install <URL> <name> CONFIRM OR send a .js file with caption .plugin install <name> CONFIRM OR send JavaScript in a code block.",{category:"utility"});
 }catch(e){await send(activeSocket,jid,"❌ Plugin install failed: "+e.message,{category:"error"});} return true;
}
async function downloadMedia(message,type){const stream=await downloadContentFromMessage(message,type);const chunks=[];for await(const c of stream)chunks.push(c);return Buffer.concat(chunks);}
async function send(sock,jid,text,ctx={}){
 const category=ctx.category||null;
 const language=ctx.language||await i18n.getLanguage(jid);
 const localized=(ctx.translate===false||ctx.mode==="ai")?String(text||""):await i18n.translate(text,language);
 const visualCategories=new Set(["github","memory","vision","admin","stats","security","status","error","code","utility"]);
 const image=category&&visualCategories.has(category)?replyImages.getImage(category):null;
 if(image){
  return sock.sendMessage(jid,{image:{url:image},caption:withPromo(localized)});
 }
 return sock.sendMessage(jid,{text:withPromo(localized)});
}

async function databaseAuth(){
 const stored=await db.getBaileysAuth();
 const creds=stored?.creds?JSON.parse(stored.creds,BufferJSON.reviver):initAuthCreds();
 const keyStore={async get(type,ids){
   const out={};
   for(const id of ids){const value=await db.getBaileysKey(type+"-"+id);if(value)out[id]=JSON.parse(value,BufferJSON.reviver);}
   return out;
 },async set(data){
   const entries={};
   for(const[type,values]of Object.entries(data))for(const[id,value]of Object.entries(values))entries[type+"-"+id]=value===null?null:JSON.stringify(value,BufferJSON.replacer);
   await db.setBaileysKeys(entries);
 }};
 const saveCreds=async()=>db.setBaileysCreds(JSON.stringify(creds,BufferJSON.replacer));
 return{state:{creds,keys:makeCacheableSignalKeyStore(keyStore,pino({level:"silent"}))},saveCreds,close:async()=>{}};
}

function promo(){return "📢 *TOHID TECH*\n"+cfg.channelLink;}
function withPromo(text){const s=String(text||"");return s.includes(cfg.channelLink)?s:s+"\\n\\n"+promo();}
function adminHelp(){return "🛠️ *TOHID AI CONTROL CENTER V11*\n\n👑 .owner list/add/remove/revokeall\n🧩 .plugin list/install/enable/disable/reload/remove/test/logs\n⚙️ .feature list/on/off <name>\n📁 .file list/read/backup/backups/restore/write\n📊 .admin status\n🤖 Send natural-language tasks for the AI planner\n\n🔐 Delegated owners get full owner-level bot control. Only the primary OWNER_NUMBER can add/remove delegated owners.";}
function help(){
return "🤖 *TOHID-AGENT V11.0 — COMPLETE HELP*\\n\\n"+
"👨‍💻 Developer: Tohid\\n"+
"📢 Channel: "+cfg.channelLink+"\\n\\n"+
"━━━━━━━━━━━━━━━━━━\\n"+
"💬 *AI / CHAT*\\n"+
"• Send any message → AI chat\\n"+
"• Send an image + caption → image analysis\\n"+
"• Send a voice note → speech-to-text + AI reply\\n"+
"• .imagine <prompt> → generate an image\\n"+
"• .video <prompt> → generate a video\\n"+
"• .newchat / .reset → clear conversation memory\\n"+
"• .memory → view memory count\\n"+
"• .memory on/off → enable or disable memory\\n"+
"• .voice on/off → enable or disable voice replies\\n\\n"+
"━━━━━━━━━━━━━━━━━━\\n"+
"🐙 *GITHUB AGENT*\\n"+
"Ask naturally to list/search repositories, read files, inspect commits/issues, create branches/issues/PRs, create or edit files, and upload projects.\\n"+
"Examples:\\n"+
"• \\"Show my GitHub repositories\\"\\n"+
"• \\"Read index.js from TOHID-AGENT\\"\\n"+
"• \\"Create a GitHub portfolio repository\\"\\n"+
"• \\"Upload this project to GitHub\\"\\n"+
"🔐 GitHub write actions require owner authorization + CONFIRM.\\n\\n"+
"━━━━━━━━━━━━━━━━━━\\n"+
"🚀 *HOSTING / DEPLOYMENT*\\n"+
"Supported: *Vercel • Render • Koyeb • Heroku*\\n"+
"• Show my Vercel projects\\n"+
"• Show Render services\\n"+
"• Show Koyeb apps\\n"+
"• Show Heroku apps\\n"+
"• Deploy a GitHub project to Vercel\\n"+
"• Redeploy Render, Koyeb or Heroku projects\\n"+
"• Check deployment, service, build and release status\\n"+
"• Manage supported lifecycle actions such as restart, start, stop, scale, pause, resume, rollback and maintenance\\n"+
"• Delete supported projects, services or apps\\n"+
"⚠️ Protected hosting changes require owner authorization + CONFIRM.\\n\\n"+
"━━━━━━━━━━━━━━━━━━\\n"+
"🧭 *PLANNER / TOOLS*\\n"+
"• .plan <task> → preview an execution plan\\n"+
"• .tools → available tools\\n"+
"• .doctor → configuration diagnostics\\n"+
"• .provider → AI provider status\\n"+
"• .status → bot status\\n"+
"• .ping → health check\\n"+
"• .stats → owner statistics\\n"+
"• .pair <number> → start an 8-digit pairing session\\n"+
"• .qr → start a QR pairing session (no phone number)\\n"+
"• .url list/add/switch/remove → manage URLs from WhatsApp\\n\\n"+
"━━━━━━━━━━━━━━━━━━\\n"+
"⚙️ *MENU / SETTINGS*\\n"+
"• .menu → interactive menu\\n"+
"• .settings → voice and memory settings\\n"+
"• .profile → profile settings\\n"+
"• .help → show this complete help\\n\\n"+
"🔐 *SECURITY*\\n"+
"API keys, tokens and secret values are never revealed. Missing provider credentials are reported without exposing their values.\\n\\n"+
"💡 Use natural-language requests; exact command syntax is not required.";
}

async function sendInteractiveMenu(sock,jid,kind="main"){
  if(!cfg.interactiveButtonsEnabled)return menu.sendMenu(sock,jid,"main");
  try{
    const mode=await getUIMode(jid);\n    const resolved=ui.resolve(mode,kind==="settings"?"settings":kind==="main"?"navigation":"actions");\n    if(kind==="main")return await buttons.sendMenuByMode(sock,jid,"main",resolved);\n    if(kind==="list")return await buttons.sendMenuByMode(sock,jid,"list",resolved);\n    if(kind==="dev")return await buttons.sendMenuByMode(sock,jid,"dev",resolved);\n    if(kind==="settings")return await buttons.sendMenuByMode(sock,jid,"settings",resolved);
  }catch(e){
    console.error("❌ Interactive UI send failed; using text fallback:",e?.stack||e?.message||e);
    if(kind==="dev")return menu.sendMenu(sock,jid,"main",{text:"👨‍💻 *Developer: Tohid*\\n\\nInteractive buttons are unavailable on this client, so text mode is active."});
    return menu.sendMenu(sock,jid,"main",{text:"🤖 *TOHID-AGENT V11.0*\\n\\nInteractive buttons could not be rendered on this client. Text mode remains active."});
  }
}
async function main(){
 baileysExtras.suppressLogs();
 if(!cfg.enabled)return console.log("TOHID-AGENT is disabled.");
 const check=preflight.validate();
 if(!check.ok){check.errors.forEach(x=>log.error(x));throw new Error("Production preflight failed: "+check.errors.join(" | "));}
 check.warnings.forEach(x=>log.warn(x));
 if(cfg.telegramPairingEnabled&&cfg.telegramBotToken&&process.env.TOHID_PAIRING_CHILD!=="1")telegramPairing.start(pairingManager,cfg.telegramBotToken);
 log.info("Starting TOHID-AGENT V11.0",preflight.safeSummary());
 let auth,closeAuth=async()=>{};
 if((cfg.mongoUri||cfg.postgresUrl)&&process.env.LOCAL_AUTH_ONLY!=="1"){auth=await databaseAuth();closeAuth=auth.close;await db.connect();if(process.env.TOHID_PAIRING_CHILD!=="1"){const globalConfig=await db.getGlobalConfig();applyGlobalConfig(globalConfig);applyFeatureState();await loadDelegatedOwners();}console.log("☁️ Database-backed auth + memory enabled ("+(cfg.mongoUri?"MongoDB primary":"PostgreSQL primary")+").");}
 else{auth=await useMultiFileAuthState(AUTH);if(cfg.mongoUri||cfg.postgresUrl)await db.connect();console.log("⚠️ Local auth enabled; configure MONGO_URI or POSTGRES_URL for persistent auth.");}
 const{state,saveCreds}=auth;
 const{version}=await fetchLatestBaileysVersion();
 console.log("📦 Baileys version: "+version.join("."));
 const sock=makeWASocket({version,auth:state,logger:pino({level:"silent"}),printQRInTerminal:false,browser:Browsers.ubuntu("Chrome"),markOnlineOnConnect:false,syncFullHistory:false,connectTimeoutMs:60000});
 if(cfg.baileysExtrasEnabled){
  const extraState=baileysExtras.attachExtras(sock);
  log.info("Baileys extras layer",extraState);
 }
 activeSocket=sock;
 activeCloseAuth=closeAuth;
 sock.ev.on("creds.update",saveCreds);
 let pairingRequested=false;
 sock.ev.on("connection.update",async({connection,lastDisconnect,qr})=>{
  if(qr&&process.send){try{process.send({type:"qr",qr:String(qr)});}catch{}}
  if(qr&&cfg.loginMethod!=="pairing"){
    console.log("\n📱 Scan QR with WhatsApp → Linked Devices:\n");
    qrcode.generate(qr,{small:true});
  }
  if(qr&&cfg.loginMethod==="pairing"&&cfg.pairingNumber&&!state.creds.registered&&!pairingRequested){
    pairingRequested=true;
    const number=String(cfg.pairingNumber).replace(/\\D/g,"");
    if(number.length<10||number.length>15){
      console.error("❌ Invalid PAIRING_NUMBER. Use country code + number without + or spaces, e.g. 919876543210.");
    }else{
      for(let attempt=1;attempt<=3&&!state.creds.registered;attempt++){
        try{
          await new Promise(r=>setTimeout(r,1000));
          const code=await sock.requestPairingCode(number,process.env.PAIRING_CODE||undefined);
          try{if(process.send)process.send({type:"pairing-code",code:String(code)});}catch{}
          console.log("\n🔐 WHATSAPP PAIRING CODE: "+code);
          console.log("📱 WhatsApp → Settings → Linked Devices → Link a Device → Link with phone number");
          console.log("⚠️ Enter this code immediately.");
          break;
        }catch(e){
          console.error("Pairing attempt "+attempt+" failed:",e?.message||e);
          if(attempt<3)await new Promise(r=>setTimeout(r,2000));
        }
      }
    }
  }
  if(connection==="open"){
    const connectedNumber=normalizeOwnerNumber(state.creds.me?.id||"");
    if(process.env.TOHID_PAIRING_CHILD==="1"&&!cfg.ownerNumber&&connectedNumber){
      cfg.ownerNumber=connectedNumber;
      log.info("Pairing child owner identity established",{number:connectedNumber});
    }
    try{if(process.send)process.send({type:"connected",number:connectedNumber});}catch{}
    log.info("TOHID-AGENT connected",{developer:"Tohid",version:cfg.version});
    console.log("📡 WhatsApp message listener is active.");
    if(cfg.missionSchedulerEnabled)scheduler.start(cfg.missionPollIntervalMs);
  }
  if(connection==="close"){
    try{if(process.send)process.send({type:"status",status:"closed",code:lastDisconnect?.error?.output?.statusCode||null});}catch{}
    const code=lastDisconnect?.error?.output?.statusCode;
    const message=lastDisconnect?.error?.message||"";
    log.warn("WhatsApp connection closed",{code,message});
    if(code===DisconnectReason.loggedOut){
      console.error("🧹 Clearing failed pairing session for a fresh login...");
      try{
        if((cfg.mongoUri||cfg.postgresUrl)&&process.env.LOCAL_AUTH_ONLY!=="1")await db.clearBaileysAuth();else fs.rmSync(AUTH,{recursive:true,force:true});
      }catch(e){console.error("Auth reset error:",e?.message||e);}
      await closeAuth();
      console.log("🔄 Auth reset complete. Restart the bot for a fresh pairing code.");
    }else{
      await closeAuth();
      if(!shuttingDown)setTimeout(()=>main().catch(error=>log.error(error?.message||String(error))),3000);
    }
  }
 });

 sock.ev.on("group-participants.update",async(update)=>{\n  try{await groupGuard.handleParticipantUpdate({sock,id:update.id,participants:update.participants,action:update.action,db,send});}\n  catch(e){log.warn("Group protection participant handler failed",{message:e?.message});}\n });\n\n sock.ev.on("messages.upsert",async({messages,type})=>{
  if(type!=="notify"&&type!=="append")return;
  console.log("📩 WhatsApp messages.upsert: type="+type+" count="+messages.length);
  for(const m of messages){
   try{
    if(!m.message||m.key.fromMe)continue;
    const jid=m.key.remoteJid;if(!jid||jid==="status@broadcast")continue;
    const sender=m.key.participant||jid;
    if(await db.isBlocked(sender)&&!isOwner(sender))continue;
    if(!allowed(sender)){await send(sock,jid,"⏳ TOHID-AGENT rate limit reached. Please try again in a minute.",{category:"security"});continue;}
    const msg=m.message;
    const buttonId=buttons.getInteractiveId(msg);
    let text=msg.conversation||msg.extendedTextMessage?.text||msg.imageMessage?.caption||"";
    if(buttonId){
      const action=buttons.actionToText(buttonId);
      if(action){
        console.log("🔘 Interactive button selected: "+buttonId+" from "+sender);
        if(action==="__TOHID_LIST__"){await sendInteractiveMenu(sock,jid,"list");continue;}
        if(action==="__TOHID_DEV__"){await sendInteractiveMenu(sock,jid,"dev");continue;}
        if(action==="__TOHID_SETTINGS__"){await sendInteractiveMenu(sock,jid,"settings");continue;}
        if(action==="__TOHID_VOICE_ON__"){await db.setSettings(sender,{voice:true});await send(sock,jid,"🎙️ Voice replies enabled.");continue;}
        if(action==="__TOHID_VOICE_OFF__"){await db.setSettings(sender,{voice:false});await send(sock,jid,"🔇 Voice replies disabled.");continue;}
        if(action==="__TOHID_MEMORY_ON__"){await db.setSettings(sender,{memory:true});await send(sock,jid,"🧠 Memory enabled.");continue;}
        if(action==="__TOHID_MEMORY_OFF__"){await db.setSettings(sender,{memory:false});await db.clearMemory(sender);await send(sock,jid,"🧹 Memory disabled and current conversation memory cleared.",{category:"memory"});continue;}
        if(action==="__TOHID_PLAN__"){await send(sock,jid,"🧭 *Agent Planner*\n\nSend a task after `.plan`, for example:\n`.plan deploy my GitHub project to Heroku and verify it`");continue;}
        if(action==="__TOHID_HELP_LANGUAGES__"){await buttons.sendLanguageMenuByMode(sock,jid,ui.resolve(await getUIMode(jid),"selection"));continue;}
        const helpLangs={__TOHID_HELP_HI__:"Hindi",__TOHID_HELP_BN__:"Bengali",__TOHID_HELP_PA__:"Punjabi",__TOHID_HELP_UR__:"Urdu",__TOHID_HELP_TA__:"Tamil",__TOHID_HELP_TE__:"Telugu",__TOHID_HELP_MR__:"Marathi",__TOHID_HELP_GU__:"Gujarati",__TOHID_HELP_KN__:"Kannada",__TOHID_HELP_ML__:"Malayalam",__TOHID_HELP_AR__:"Arabic",__TOHID_HELP_ES__:"Spanish",__TOHID_HELP_FR__:"French",__TOHID_HELP_DE__:"German",__TOHID_HELP_TR__:"Turkish"};
        if(helpLangs[action]){await i18n.setLanguage(jid,helpLangs[action]);await buttons.sendHelpByMode(sock,jid,helpLangs[action],await getUIMode(jid));continue;}
        if(action==="__TOHID_HELP_OTHER__"){await send(sock,jid,"🌐 *Other language*\\n\\nUse: .language <language>\\nExample: .language Japanese");continue;}
        if(action==="__TOHID_HELP_HI__"){await buttons.sendHelp(sock,jid,"Hindi");continue;}
        if(action==="__TOHID_HELP_EN__"){await i18n.setLanguage(jid,"English");await buttons.sendHelpByMode(sock,jid,"en",await getUIMode(jid));continue;}
        if(action==="__TOHID_MENU__"){await sendInteractiveMenu(sock,jid,"main");continue;}
        if(action==="__TOHID_AI__"){await send(sock,jid,"🤖 *TOHID-AGENT AI*\n\nSend your question or command now. Text input remains fully supported.",{category:"ai"});continue;}
        if(action==="__TOHID_GITHUB__"){await send(sock,jid,"🐙 *GitHub Agent*\n\nTell me what you want to inspect or manage, for example: list my repositories or read a repository file.",{category:"github"});continue;}
        if(action==="__TOHID_HEROKU__"){await send(sock,jid,"🚀 *Heroku Agent*\n\nTell me which app you want to inspect or manage. Protected changes still require owner authorization + CONFIRM.",{category:"status"});continue;}
        if(action==="__TOHID_CHANNEL__"){await send(sock,jid,"📢 *TOHID TECH*\n"+cfg.channelLink,{category:"utility"});continue;}
        text=action;
      }
    }
    const group=jid.endsWith("@g.us");
    if(group){
      if(await groupGuard.handleCommand({sock,msg:m,jid,sender,text,db,send}))continue;
      if(await groupGuard.inspect({sock,msg:m,jid,sender,text,db,send}))continue;
    }
    if(group&&cfg.groupMode==="mention"){
      const mentioned=msg.extendedTextMessage?.contextInfo?.mentionedJid||msg.imageMessage?.contextInfo?.mentionedJid||[];
      const botId=normalizeJid(sock.user?.id);
      if(!mentioned.some(x=>normalizeJid(x)===botId))continue;
      text=text.replace(/@\d{5,}/g,"").trim();
    }
    let inputWasVoice=false,audioPath=null,imageData=null;
    if(msg.audioMessage){
      inputWasVoice=true;
      const buf=await downloadMedia(msg.audioMessage,"audio");
      audioPath=path.join(TMP,"voice-"+Date.now()+".ogg");fs.writeFileSync(audioPath,buf);
      text=await ai.transcribe(audioPath);await db.track(sender,"voice");
    }
    if(msg.imageMessage){
      const buf=await downloadMedia(msg.imageMessage,"image");
      const mime=msg.imageMessage.mimetype||"image/jpeg";
      imageData="data:"+mime+";base64,"+buf.toString("base64");
      if(!text)text="Analyze this image.";
    }
    if(!text&&!imageData)continue;
    console.log("📨 Incoming WhatsApp message from "+sender+" in "+jid+": "+String(text||"[media]").slice(0,120));
    if(text.trim().toLowerCase()===cfg.prefix+"ping"){
      try{
        await send(sock,jid,"🏓 TOHID-AGENT V11.0: online\\n👨‍💻 Developer: Tohid");
        console.log("📤 .ping reply sent to "+jid);
      }catch(pingError){
        console.error("❌ .ping send failed:",pingError?.stack||pingError?.message||pingError);
      }
      continue;
    }
    if(await installPluginFromMessage(jid,sender,msg,text))continue;
    if(group&&await dmRelay.relay({sock,msg,text,downloadMedia,send})){continue;}
    const pluginRoute=router.route(text,cfg.prefix);
    if(pluginRoute==="ai"&&text.trim().startsWith(cfg.prefix)){const command=text.trim().split(/\\s+/)[0].slice(cfg.prefix.length).toLowerCase();if(await plugins.dispatchCommand({sock,jid,sender,message:m,text,command,args:text.trim().split(/\\s+/).slice(1),send:pluginSend,cfg,db})){continue;}}
    await plugins.dispatchMessage({sock,jid,sender,message:m,text,send:pluginSend,cfg,db});
    const lower=text.trim().toLowerCase();
    if(lower===cfg.prefix+"dashboard"){
      if(!isOwner(sender)&&!(await hasPermission(sender,"bot.read"))){await send(sock,jid,"⛔ Dashboard access denied.",{category:"security"});continue;}
      const d=await dashboard.snapshot({cfg,db,plugins,control,delegatedOwners});
      await send(sock,jid,dashboard.format(d),{category:"stats"});continue;
    }
    if(lower===cfg.prefix+"roles"||lower===cfg.prefix+"role list"){
      await send(sock,jid,"🛡️ *RBAC ROLES*\n\n"+rbac.listRoles().map(x=>"• *"+x.id+"* — "+x.label+"\n  "+x.permissions.join(", ")).join("\n"),{category:"security"});continue;
    }
    if(lower.startsWith(cfg.prefix+"role ")){
      if(!isPrimaryOwner(sender)){await send(sock,jid,"⛔ Primary owner only.",{category:"security"});continue;}
      const parts=text.trim().split(/\s+/),sub=(parts[1]||"").toLowerCase(),target=normalizeOwnerNumber(parts[2]||""),role=String(parts[3]||"").toLowerCase();
      try{
        if(sub==="get"&&target){const r=await rbac.getRole(target+"@s.whatsapp.net",cfg,delegatedOwners);await send(sock,jid,"🛡️ "+target+" → *"+r+"*",{category:"security"});continue;}
        if(sub==="set"&&target&&role){if(!parts.some(x=>x.toUpperCase()==="CONFIRM")){await send(sock,jid,"🔐 Role changes require CONFIRM.",{category:"security"});continue;}await rbac.setRole(target+"@s.whatsapp.net",role);await db.audit(sender,"role:set",{target,role});await send(sock,jid,"✅ Role set: *"+target+"* → *"+role+"*",{category:"admin"});continue;}
        await send(sock,jid,"Usage: .role list | .role get <number> | .role set <number> <developer|admin|user> CONFIRM",{category:"utility"});
      }catch(e){await send(sock,jid,"❌ Role action failed: "+e.message,{category:"error"});}continue;
    }
    if(lower.startsWith(cfg.prefix+"workflow ")){
      const request=text.trim().slice((cfg.prefix+"workflow").length).trim();
      if(!request){await send(sock,jid,"Usage: .workflow <multi-step task>");continue;}
      const task=await agentCore.startTask(sender,request);
      await send(sock,jid,"🧭 *WORKFLOW CREATED*\n\n"+JSON.stringify(task.plan,null,2)+"\n\nThe agent will execute supported steps, respect confirmation gates, and verify results.",{category:"utility"});continue;
    }
    if(lower===cfg.prefix+"agent"||lower===cfg.prefix+"agent status"||lower===cfg.prefix+"health"){
      await send(sock,jid,"🧠 *TOHID-AGENT V11.0 CORE*\\n\\n"+JSON.stringify(agentCore.health(),null,2),{category:"status"});continue;
    }
    if(lower===cfg.prefix+"baileys"){
      const caps=baileysExtras.capabilities(sock);
      await send(sock,jid,"🧩 *BAILEYS V9 COMPATIBILITY*\\n\\n"+Object.entries(caps).map(([k,v])=>(v?"✅ ":"❌ ")+k).join("\\n"),{category:"status"});continue;
    }
    if(lower.startsWith(cfg.prefix+"channel ")){
      const raw=text.trim().slice((cfg.prefix+"channel").length).trim();
      const parts=raw.split(/\\s+/);
      const action=(parts[0]||"").toLowerCase();
      const mutating=["create","follow","unfollow","mute","unmute","update","updatename","updatedescription","updatepicture","removepicture","changeowner","demote","delete","react","subscribeupdates"].includes(action);
      if(!action){await send(sock,jid,"Usage: .channel <action> ...\\n\\nActions: info, create, follow, unfollow, mute, unmute, subscribers, react, fetch, subscribeupdates, update, updatename, updatedescription, updatepicture, removepicture, admincount, changeowner, demote, delete",{category:"utility"});continue;}
      if(mutating&&!isOwner(sender)){await send(sock,jid,"⛔ Owner only.",{category:"security"});continue;}
      if(mutating&&!parts.some(x=>x.toUpperCase()==="CONFIRM")){await send(sock,jid,"🔐 Protected Channel changes require explicit CONFIRM.",{category:"security"});continue;}
      try{
        let result;
        const clean=parts.filter(x=>x.toUpperCase()!=="CONFIRM");
        const arg1=clean[1]||"";
        const arg2=clean[2]||"";
        if(action==="create"){
          const name=raw.replace(/^create\\s+/i,"").replace(/\\s+CONFIRM$/i,"").split("|")[0].trim();
          const description=raw.includes("|")?raw.split("|").slice(1).join("|").replace(/\\s+CONFIRM$/i,"").trim():"";
          if(!name)throw new Error("Usage: .channel create <name> | <description> CONFIRM");
          result=await baileysExtras.newsletter(sock,"newsletterCreate",name,description);
        }else if(action==="info")result=await baileysExtras.newsletter(sock,"newsletterMetadata","jid",arg1);
        else if(action==="subscribers")result=await baileysExtras.newsletter(sock,"newsletterSubscribers",arg1);
        else if(action==="admincount")result=await baileysExtras.newsletter(sock,"newsletterAdminCount",arg1);
        else if(action==="fetch")result=await baileysExtras.newsletter(sock,"newsletterFetchMessages",arg1,Number(arg2||10));
        else if(action==="subscribeupdates")result=await baileysExtras.newsletter(sock,"subscribeNewsletterUpdates",arg1);
        else if(action==="react")result=await baileysExtras.newsletter(sock,"newsletterReactMessage",arg1,arg2,clean[3]||"👍");
        else if(action==="update"){
          const updates=JSON.parse(clean.slice(2).join(" ").replace(/\\s+CONFIRM$/i,""));
          result=await baileysExtras.newsletter(sock,"newsletterUpdate",arg1,updates);
        }else if(action==="updatename")result=await baileysExtras.newsletter(sock,"newsletterUpdateName",arg1,clean[2]);
        else if(action==="updatedescription")result=await baileysExtras.newsletter(sock,"newsletterUpdateDescription",arg1,clean.slice(2).filter(x=>x.toUpperCase()!=="CONFIRM").join(" "));
        else if(action==="updatepicture")result=await baileysExtras.newsletter(sock,"newsletterUpdatePicture",arg1,{url:clean[2]});
        else if(action==="removepicture")result=await baileysExtras.newsletter(sock,"newsletterRemovePicture",arg1);
        else if(action==="changeowner")result=await baileysExtras.newsletter(sock,"newsletterChangeOwner",arg1,clean[2]);
        else if(action==="demote")result=await baileysExtras.newsletter(sock,"newsletterDemote",arg1,clean[2]);
        else if(action==="delete")result=await baileysExtras.newsletter(sock,"newsletterDelete",arg1);
        else {
          const map={follow:"newsletterFollow",unfollow:"newsletterUnfollow",mute:"newsletterMute",unmute:"newsletterUnmute"};
          result=await baileysExtras.newsletter(sock,map[action],arg1);
        }
        await send(sock,jid,"📢 *CHANNEL "+action.toUpperCase()+"*\\n\\n"+JSON.stringify(result,null,2),{category:"status"});
      }catch(e){await send(sock,jid,"❌ Channel feature unavailable: "+e.message,{category:"error"});}
      continue;
    }
    if(lower.startsWith(cfg.prefix+"groupstatus ")){
      if(!isOwner(sender)){await send(sock,jid,"⛔ Owner only.",{category:"security"});continue;}
      if(!group){await send(sock,jid,"⚠️ `.groupstatus` can only be used inside a WhatsApp group.");continue;}
      const statusText=text.slice((cfg.prefix+"groupstatus ").length).trim();
      if(!statusText){await send(sock,jid,"Usage: .groupstatus <text>");continue;}
      try{await baileysExtras.sendGroupStatus(sock,jid,{text:statusText});await send(sock,jid,"✅ Group status sent.",{category:"status"});}catch(e){await send(sock,jid,"❌ Group status is unavailable in the active Baileys build: "+e.message,{category:"error"});}
      continue;
    }
    if(lower===cfg.prefix+"skills"){
      await send(sock,jid,"🧩 *ACTIVE AGENT SKILLS*\\n\\n"+skills.list().map(x=>"• *"+x.name+"* — "+x.description).join("\\n"),{category:"utility"});continue;
    }
    if(lower===cfg.prefix+"missions"){
      const list=await mission.list(sender,cfg.taskHistoryLimit);
      await send(sock,jid,list.length?"🎯 *RECENT MISSIONS*\\n\\n"+list.map((x,i)=>(i+1)+". "+x.status+" • "+x.progress+"% • "+x.request).join("\\n"):"🎯 No missions recorded yet.",{category:"utility"});continue;
    }
    if(lower.startsWith(cfg.prefix+"mission ")){
      const args=text.trim().slice((cfg.prefix+"mission").length).trim();
      const parts=args.split(/\\s+/);
      const sub=(parts[0]||"").toLowerCase();
      if(sub==="status"&&parts[1]){const m=await mission.get(sender,parts[1]);await send(sock,jid,m?"🎯 *MISSION*\\n\\n"+JSON.stringify(m,null,2):"❌ Mission not found.",{category:"status"});continue;}
      if(sub==="cancel"&&parts[1]){const m=await mission.cancel(sender,parts[1]);await send(sock,jid,m?"🛑 Mission cancelled.":"❌ Mission not found.",{category:"admin"});continue;}
      if(sub==="confirm"&&parts[1]){const m=await mission.confirm(sender,parts[1]);await send(sock,jid,m?"✅ Mission confirmed and moved to running state.":"❌ Mission not found.",{category:"security"});continue;}
      const request=args;
      if(!request){await send(sock,jid,"Usage: .mission <request> | .mission status <id> | .mission confirm <id> | .mission cancel <id>");continue;}
      const m=await mission.create(sender,request,{source:"whatsapp"});
      const started=await mission.start(sender,m.id);
      await send(sock,jid,"🎯 *MISSION CREATED*\\n\\n🆔 "+(m.id||"local")+"\\n⚠️ Risk: "+m.risk+"\\n📊 Status: "+(started?.status||m.status)+"\\n🧭 Steps: "+(m.steps?.length||0)+"\\n\\nUse .mission status "+(m.id||"id")+" to inspect progress.",{category:"utility"});continue;
    }
    if(lower.startsWith(cfg.prefix+"schedule ")&&!lower.startsWith(cfg.prefix+"schedule cancel ")){
      const args=text.trim().slice((cfg.prefix+"schedule").length).trim();
      const parts=args.split(/\\s+/);const delay=parseDelay(parts[0]);const request=parts.slice(1).join(" ").trim();
      if(!delay||!request){await send(sock,jid,"Usage: .schedule <delay> <mission>\\nExample: .schedule 30m check my GitHub project");continue;}
      const job=await scheduler.add(sender,new Date(Date.now()+delay),{type:"mission",request});
      await send(sock,jid,"⏰ *MISSION SCHEDULED*\\n\\n🆔 "+(job.id||"local")+"\\n⏱️ Runs in "+parts[0]+"\\n🧭 "+request);continue;
    }
    if(lower===cfg.prefix+"schedules"){
      const jobs=await scheduler.list(sender,20);
      await send(sock,jid,jobs.length?"⏰ *SCHEDULED MISSIONS*\\n\\n"+jobs.map((x,i)=>(i+1)+". "+String(x._id)+" • "+new Date(x.runAt).toLocaleString()+" • "+x.payload?.request).join("\\n"):"⏰ No scheduled missions.",{category:"utility"});continue;
    }
    if(lower.startsWith(cfg.prefix+"schedule cancel ")){
      const id=text.trim().slice((cfg.prefix+"schedule cancel").length).trim();
      const ok=await scheduler.cancel(sender,id);await send(sock,jid,ok?"🛑 Scheduled mission cancelled.":"❌ Scheduled job not found.");continue;
    }
    if(lower===cfg.prefix+"tasks"){
      const tasks=await agentCore.recentTasks(sender,cfg.taskHistoryLimit);
      await send(sock,jid,tasks.length?"📋 *RECENT AGENT TASKS*\\n\\n"+tasks.map((x,i)=>(i+1)+". "+x.status+" — "+x.request).join("\\n"):"📋 No agent tasks recorded yet.",{category:"utility"});continue;
    }
    if(lower.startsWith(cfg.prefix+"task ")){
      const request=text.trim().slice((cfg.prefix+"task").length).trim();
      if(!request){await send(sock,jid,"Usage: .task <what you want TOHID-AGENT to do>");continue;}
      if(!cfg.autonomousTasks){await send(sock,jid,"🧠 Autonomous tasks are disabled by configuration.");continue;}
      const task=await agentCore.startTask(sender,request);
      await send(sock,jid,"🧭 *TASK CREATED*\\n\\n"+JSON.stringify(task.plan,null,2)+"\\n\\nThe AI agent will use the required tools, respect confirmation gates, and verify external results.",{category:"utility"});continue;
    }
    const mode=router.route(text,cfg.prefix);

    if(mode==="pair"||mode==="qr"){
      if(!isOwner(sender)){await send(sock,jid,"⛔ Owner only. Use the pairing website for your own account.",{category:"security"});continue;}
      const parts=text.trim().split(/\s+/);const number=parts[1]||"";const method=mode==="qr"?"qr":"pairing";
      if(!number){await send(sock,jid,"Usage: "+cfg.prefix+mode+" <country-code-number>\\nExample: "+cfg.prefix+mode+" 919876543210",{category:"utility"});continue;}
      try{
        const session=pairingManager.create({phone:number,mode,env:{}});
        await send(sock,jid,"🔗 *TOHID-AGENT "+method.toUpperCase()+" SESSION*\\n\\n📱 Number: "+session.phone+"\\n🆔 Session: "+session.id+"\\n⏳ Waiting for WhatsApp…\\n\\nThe pairing code/QR will appear here when ready.",{category:"utility"});
        const waitUntil=Date.now()+120000;
        while(Date.now()<waitUntil){
          await new Promise(r=>setTimeout(r,1000));const current=pairingManager.get(session.id);if(!current)break;
          if(current.code){await send(sock,jid,"🔐 *PAIRING CODE*\\n\\n"+current.code+"\\n\\nWhatsApp → Linked Devices → Link with phone number → enter the 8-character code.",{category:"security"});break;}
          if(current.qr&&method==="qr"){await send(sock,jid,"📱 *QR READY*\\n\\nOpen WhatsApp → Linked Devices → Link a device and scan the QR shown at the web pairing page.\\n\\nWeb: /pair",{category:"utility"});break;}
          if(current.connected){await send(sock,jid,"✅ *Bot connected successfully*\\n\\nNumber: "+current.phone,{category:"utility"});break;}
          if(["stopped","error"].includes(current.status))break;
        }
      }catch(e){await send(sock,jid,"❌ Pairing failed: "+e.message,{category:"error"});}
      continue;
    }

    if(mode==="url"){
      if(!isOwner(sender)){await send(sock,jid,"⛔ Owner only.",{category:"security"});continue;}
      const parts=text.trim().split(/\s+/);const sub=(parts[1]||"list").toLowerCase();
      try{
        if(sub==="list"){
          const data=await urlManager.list(db);const rows=Object.entries(data.items||{}).map(([k,v])=>(k===data.active?"• ":"  ")+k+" → "+v);
          await send(sock,jid,"🔗 *URL MANAGER*\\n\\n"+(rows.join("\\n")||"No URLs configured.")+"\\n\\nActive: "+(data.active||"none")+"\\n\\nUse .url add <name> <url>\\n.url switch <name>\\n.url remove <name>",{category:"admin"});continue;
        }
        if(sub==="add"||sub==="set"||sub==="switch"){
          if(sub==="switch"){const result=await urlManager.switchUrl(db,parts[2]);await send(sock,jid,"✅ Active URL switched to *"+result.key+"*\\n"+result.url,{category:"admin"});continue;}
          const key=parts[2],value=parts[3];if(!key||!value){await send(sock,jid,"Usage: .url "+sub+" <name> <https-url>",{category:"utility"});continue;}
          const result=await urlManager.add(db,key,value);await send(sock,jid,"✅ URL saved: *"+result.key+"*\\n"+result.url+"\\nStorage: "+(result.persistent?"persistent":"runtime/local"),{category:"admin"});continue;
        }
        if(sub==="remove"||sub==="delete"){
          const ok=await urlManager.remove(db,parts[2]);await send(sock,jid,ok?"🗑️ URL removed.":"❌ URL not found.",{category:"admin"});continue;
        }
        await send(sock,jid,"Usage: .url list | .url add <name> <url> | .url switch <name> | .url remove <name>",{category:"utility"});
      }catch(e){await send(sock,jid,"❌ URL action failed: "+e.message,{category:"error"});}
      continue;
    }
    const databaseRequiredModes=new Set(["reset","memory","profile","language","mode","ui","stats","owner","role","dashboard","workflow","env","settings","block","unblock"]);
    if(databaseRequiredModes.has(mode)&&db.status().primary==="none"){
      await send(sock,jid,"🗄️ *Database required for this command*\\n\\nTOHID-AGENT can still run and connect without MongoDB or PostgreSQL, but this command needs persistent storage.\\n\\nAdd either MONGO_URI or POSTGRES_URL and restart the bot.",{category:"database"});
      continue;
    }

    if(mode==="ui"||mode==="mode"){
      const requested=text.trim().replace(new RegExp("^"+cfg.prefix+"(?:ui|mode)\\s*","i"),"").trim().toLowerCase();
      if(!requested){
        const current=await getUIMode(jid);
        await send(sock,jid,"🎛️ *TOHID-AGENT V10 UI*\\n\\nCurrent: "+current+"\\n\\n"+ui.description(current)+"\\n\\nModes:\\n• auto — adaptive UI (recommended)\\n• buttons — interactive controls\\n• text — text/commands only\\n• hybrid — text + buttons\\n• minimal — concise text\\n\\nUse: "+cfg.prefix+"mode <auto|buttons|text|hybrid|minimal>",{category:"utility"});
      }else if(!ui.MODES.includes(requested) && requested!=="both"){
        await send(sock,jid,"❌ Invalid UI mode. Use: auto, buttons, text, hybrid or minimal.",{category:"error"});
      }else{
        const selected=await ui.set(jid,requested==="both"?"hybrid":requested);
        await send(sock,jid,"✅ UI mode changed to *"+selected+"*.\\n"+ui.description(selected),{category:"utility"});
      }
      continue;
    }
    if(mode==="language"){
      const requested=text.trim().replace(new RegExp("^"+cfg.prefix+"(?:language|lang)\\s*","i"),"").trim();
      if(!requested){
        await send(sock,jid,"🌐 *Bot Language*\n\nCurrent language: "+await i18n.getLanguage(jid)+"\nDefault language: "+cfg.defaultLanguage+"\n\nUse: "+cfg.prefix+"language <language>\nExample: "+cfg.prefix+"language Hindi",{category:"utility"});
      }else{
        const selected=await i18n.setLanguage(jid,requested);
        await send(sock,jid,"✅ *Language changed*\n\nTOHID-AGENT will now use *"+selected+"* for system messages, menus, confirmations and AI replies in this chat.",{category:"utility"});
      }
      continue;
    }
    if(mode==="env"){
      if(!isOwner(sender)){await send(sock,jid,"⛔ Owner only.",{category:"security"});continue;}
      const parts=text.trim().split(/\\s+/);const sub=(parts[1]||"list").toLowerCase();
      if(sub==="list"){const values=await db.getGlobalConfig();const keys=Object.keys(cfg).sort();await send(sock,jid,"⚙️ *GLOBAL CONFIG*\\n\\n"+keys.map(k=>k+" = "+maskConfigValue(k,Object.prototype.hasOwnProperty.call(values,k)?values[k]:cfg[k])).join("\\n")+"\\n\\nUse .config set <key> <value> CONFIRM",{category:"admin"});continue;}
      if(sub==="get"){const key=parts[2];if(!key){await send(sock,jid,"Usage: .config get <key>");continue;}const values=await db.getGlobalConfig();const value=Object.prototype.hasOwnProperty.call(values,key)?values[key]:cfg[key];await send(sock,jid,"⚙️ "+key+" = "+maskConfigValue(key,value),{category:"admin"});continue;}
      if(sub==="set"){if(!parts.some(x=>x.toUpperCase()==="CONFIRM")){await send(sock,jid,"🔐 Config changes require CONFIRM.",{category:"security"});continue;}const key=parts[2],value=parts.slice(3).filter(x=>x.toUpperCase()!=="CONFIRM").join(" ");if(!key||!value){await send(sock,jid,"Usage: .config set <key> <value> CONFIRM");continue;}if(!Object.prototype.hasOwnProperty.call(cfg,key)){await send(sock,jid,"❌ Unknown config key: "+key);continue;}const values=await db.getGlobalConfig();values[key]=value;await db.setGlobalConfig(values);applyGlobalConfig({[key]:value});await send(sock,jid,"✅ Config updated: "+key+" = "+maskConfigValue(key,value),{category:"admin"});continue;}
      if(sub==="reset"){if(!parts.some(x=>x.toUpperCase()==="CONFIRM")){await send(sock,jid,"🔐 Config reset requires CONFIRM.",{category:"security"});continue;}const values=await db.getGlobalConfig();const key=parts[2];if(key){delete values[key];await db.setGlobalConfig(values);await send(sock,jid,"♻️ Runtime override removed for "+key,{category:"admin"});}else{await db.setGlobalConfig({});await send(sock,jid,"♻️ All runtime config overrides removed. Restart to restore base environment values.",{category:"admin"});}continue;}
      await send(sock,jid,"Usage: .config list | .config get <key> | .config set <key> <value> CONFIRM | .config reset <key> CONFIRM",{category:"utility"});continue;
    }
    if(mode==="shell"){
      if(!isOwner(sender)){await send(sock,jid,"⛔ Owner only.",{category:"security"});continue;}
      if(!cfg.remoteShellEnabled){await send(sock,jid,"🛡️ Remote shell is disabled. Enable it with .config set remoteShellEnabled true CONFIRM",{category:"security"});continue;}
      if(!text.toUpperCase().includes("CONFIRM")){await send(sock,jid,"🔐 Remote shell requires explicit CONFIRM for every command.",{category:"security"});continue;}
      const command=text.trim().replace(new RegExp("^"+cfg.prefix+"shell\\s*","i"),"").replace(/\\s+CONFIRM\\s*$/i,"").trim();
      const {execFile}=require("child_process");const allowedShell=/^(pwd|ls|cat|node --version|npm --version|git status|git log --oneline -10|df -h|free -h|uptime|pm2 (status|list|restart|reload) [a-zA-Z0-9_.-]+)$/;
      if(!allowedShell.test(command)){await send(sock,jid,"❌ Command not allowed by the V10 safety allowlist.",{category:"security"});continue;}
      await new Promise(resolve=>execFile("/bin/sh",["-lc",command],{timeout:30000,maxBuffer:200000},async(err,stdout,stderr)=>{const out=(err?stderr:stdout)||err?.message||"OK";await send(sock,jid,"🖥️ *SHELL RESULT*\\n\\n"+out.slice(0,12000),{category:"status"});resolve();}));continue;
    }
    if(mode==="owner"){
      if(!isPrimaryOwner(sender)){await send(sock,jid,"⛔ Primary owner only. Delegated owners cannot transfer or revoke ownership.",{category:"security"});continue;}
      const parts=text.trim().split(/\\s+/);const sub=(parts[1]||"list").toLowerCase();const target=normalizeOwnerNumber(parts[2]||"");
      try{
        if(sub==="list"){const all=Array.from(delegatedOwners);await send(sock,jid,"👑 *OWNER ACCESS*\\n\\nPrimary: "+cfg.ownerNumber+"\\nDelegated: "+(all.length?all.map((n,i)=>(i+1)+". "+n).join("\\n"):"None"),{category:"admin"});continue;}
        if(sub==="add"){if(!target||target.length<10||target.length>15){await send(sock,jid,"Usage: .owner add <country-code+number> CONFIRM",{category:"utility"});continue;}if(target===cfg.ownerNumber){await send(sock,jid,"ℹ️ That number is already the primary owner.",{category:"admin"});continue;}if(!parts.some(x=>x.toUpperCase()==="CONFIRM")){await send(sock,jid,"🔐 Adding a delegated owner requires CONFIRM.",{category:"security"});continue;}if(!cfg.mongoUri){await send(sock,jid,"❌ Delegated owners require MongoDB persistence. Set MONGO_URI first.",{category:"error"});continue;}await db.addDelegatedOwner(target,sender);delegatedOwners.add(target);await db.audit(sender,"owner:add",{target});await send(sock,jid,"✅ Delegated owner added: *"+target+"*\\nThey now have full owner-level bot control except owner transfer/revocation.",{category:"admin"});continue;}
        if(sub==="remove"){if(!target){await send(sock,jid,"Usage: .owner remove <number> CONFIRM",{category:"utility"});continue;}if(!parts.some(x=>x.toUpperCase()==="CONFIRM")){await send(sock,jid,"🔐 Removing a delegated owner requires CONFIRM.",{category:"security"});continue;}await db.removeDelegatedOwner(target);delegatedOwners.delete(target);await db.audit(sender,"owner:remove",{target});await send(sock,jid,"✅ Delegated owner removed: *"+target+"*",{category:"admin"});continue;}
        if(sub==="revokeall"){if(!parts.some(x=>x.toUpperCase()==="CONFIRM")){await send(sock,jid,"🔐 Revoking all delegated owners requires CONFIRM.",{category:"security"});continue;}const count=await db.clearDelegatedOwners();delegatedOwners.clear();await db.audit(sender,"owner:revokeall",{count});await send(sock,jid,"🧹 Revoked "+count+" delegated owner(s).",{category:"admin"});continue;}
        await send(sock,jid,"Usage: .owner list | .owner add <number> CONFIRM | .owner remove <number> CONFIRM | .owner revokeall CONFIRM",{category:"utility"});
      }catch(e){await send(sock,jid,"❌ Owner access action failed: "+e.message,{category:"error"});}continue;
    }
    if(mode==="admin"){
      if(!isOwner(sender)){await send(sock,jid,"⛔ Owner only.",{category:"security"});continue;}
      const st=control.status();
      await send(sock,jid,"🛠️ *TOHID AI CONTROL CENTER V11*\n\nWorkspace: "+st.workspace+"\nFeatures: "+st.enabledFeatures+"/"+st.features+" enabled\nBackups: "+st.backups+"\nPlugins: "+plugins.list().length+"\n\n"+adminHelp(),{category:"admin"});continue;
    }
    if(mode==="feature"){
      if(!(await hasPermission(sender,"bot.write"))){await send(sock,jid,"⛔ Owner only.",{category:"security"});continue;}
      const parts=text.trim().split(/\s+/),sub=(parts[1]||"list").toLowerCase(),name=parts[2];
      if(sub==="list"){const f=control.featureList();await send(sock,jid,"⚙️ *FEATURES*\n\n"+(Object.keys(f).length?Object.entries(f).map(([k,v])=>(v?"🟢 ":"⚪ ")+k).join("\n"):"No runtime feature overrides."),{category:"admin"});continue;}
      if(!name||!["on","off"].includes(sub)){await send(sock,jid,"Usage: .feature list | .feature on <name> CONFIRM | .feature off <name> CONFIRM",{category:"utility"});continue;}
      if(!text.toUpperCase().includes("CONFIRM")){await send(sock,jid,"🔐 Feature changes require CONFIRM.",{category:"security"});continue;}
      const value=control.featureSet(name,sub==="on");applyFeatureState();control.audit(sender,"feature:"+sub,{name});await send(sock,jid,"✅ Feature *"+name+"* is now "+(value?"ON":"OFF")+".",{category:"admin"});continue;
    }
    if(mode==="file"){
      if(!(await hasPermission(sender,"files.read"))){await send(sock,jid,"⛔ Owner only.",{category:"security"});continue;}
      const parts=text.trim().split(/\s+/),sub=(parts[1]||"list").toLowerCase(),file=parts[2];
      try{
        if(sub==="list"){const files=control.listFiles(file||"",120);await send(sock,jid,"📁 *WORKSPACE FILES*\n\n"+(files.join("\n")||"No files found."),{category:"admin"});continue;}
        if(sub==="read"){if(!file){await send(sock,jid,"Usage: .file read <path>");continue;}const q=control.readFile(file,1,220);await send(sock,jid,"📄 *"+q.file+"*\n\n```\n"+q.text.slice(0,10000)+"\n```",{category:"code"});continue;}
        if(sub==="backup"){if(!file){await send(sock,jid,"Usage: .file backup <path>");continue;}const b=control.backupFile(file,"manual");control.audit(sender,"file:backup",{file});await send(sock,jid,"💾 Backup created: *"+b.id+"*",{category:"admin"});continue;}
        if(sub==="backups"){const list=control.listBackups(file);await send(sock,jid,"💾 *BACKUPS*\n\n"+(list.map(x=>x.id+" — "+x.file+" — "+x.createdAt).join("\n")||"No backups."),{category:"admin"});continue;}
        if(sub==="restore"){if(!(await hasPermission(sender,"files.write"))){await send(sock,jid,"⛔ File restore access denied.",{category:"security"});continue;}const id=parts[2];if(!id||!text.toUpperCase().includes("CONFIRM")){await send(sock,jid,"🔐 Usage: .file restore <backup-id> CONFIRM",{category:"security"});continue;}const restored=control.restoreBackup(id,true);control.audit(sender,"file:restore",{id,restored});await send(sock,jid,"♻️ Restored: *"+restored+"*",{category:"admin"});continue;}
        if(sub==="write"){if(!(await hasPermission(sender,"files.write"))){await send(sock,jid,"⛔ File write access denied.",{category:"security"});continue;}if(!file||!text.toUpperCase().includes("CONFIRM")){await send(sock,jid,"🔐 Usage: .file write <path> CONFIRM followed by a code block.",{category:"security"});continue;}const m=text.match(/```(?:javascript|js|json|text)?\s*([\s\S]*?)```/i);if(!m){await send(sock,jid,"❌ Put the new file content inside a code block.");continue;}const written=control.writeFile(file,m[1],true);control.audit(sender,"file:write",{file:written});await send(sock,jid,"✅ File updated: *"+written+"*\n💾 Previous version was backed up automatically.",{category:"admin"});continue;}
        await send(sock,jid,"Usage: .file list [dir] | .file read <path> | .file backup <path> | .file backups [path] | .file restore <id> CONFIRM | .file write <path> CONFIRM",{category:"utility"});
      }catch(e){await send(sock,jid,"❌ File action failed: "+e.message,{category:"error"});}continue;
    }
    if(mode==="plugin"){
      if(!(await hasPermission(sender,"plugins.read"))){await send(sock,jid,"⛔ Owner only.",{category:"security"});continue;}
      const parts=text.trim().split(/\\s+/);const sub=(parts[1]||"list").toLowerCase();const name=parts[2];
      try{if(sub==="search"){const q=parts.slice(2).filter(x=>x.toUpperCase()!=="CONFIRM").join(" ");if(!q){await send(sock,jid,"Usage: .plugin search <query>");continue;}const results=await plugins.searchMarketplace(q);await send(sock,jid,"🔎 *PLUGIN MARKETPLACE*\n\n"+(results.length?results.map((x,i)=>(i+1)+". *"+x.name+"* ⭐ "+x.stars+"\n"+x.description+"\n"+x.url).join("\n\n"):"No matching public plugins found."),{category:"utility"});continue;}if(sub==="list"){await send(sock,jid,"🧩 *PLUGINS*\\n\\n"+(plugins.list().map(x=>(x.enabled?"🟢 ":"⚪ ")+x.name+" v"+x.version+" — "+(x.commands||[]).join(", ")).join("\\n")||"No plugins installed."),{category:"utility"});continue;}
      if(["enable","disable","reload","update","remove"].includes(sub)&&!(await hasPermission(sender,"plugins.write"))){await send(sock,jid,"⛔ Plugin write access denied.",{category:"security"});continue;}\n      if(sub==="enable"){const p=await plugins.enable(name,cfg,pluginSend);await send(sock,jid,"🟢 Plugin enabled: "+p.name,{category:"utility"});continue;}
      if(sub==="disable"){const p=plugins.disable(name);await send(sock,jid,"⚪ Plugin disabled: "+(p?.name||name),{category:"utility"});continue;}
      if(sub==="reload"){const p=await plugins.enable(name,cfg,pluginSend);await send(sock,jid,"🔄 Plugin reloaded: "+p.name,{category:"utility"});continue;}\n      if(sub==="test"){const dir=String(name||"").replace(/[^a-z0-9_-]/gi,"-");const source=fs.readFileSync(path.join(plugins.ROOT,dir,"index.js"),"utf8");const t=plugins.testSource(source);await send(sock,jid,"🧪 Plugin test: "+(t.ok?"PASS":"FAIL")+"\n"+(t.warning?"⚠️ "+t.warning:"No privileged API pattern detected."),{category:"utility"});continue;}\n      if(sub==="logs"){await send(sock,jid,"📜 *PLUGIN LOGS*\n\n"+(plugins.logs(name).map(x=>x.at+" — "+x.message).join("\n")||"No logs."),{category:"utility"});continue;}\n      if(sub==="update"){if(!parts.some(x=>x.toUpperCase()==="CONFIRM")){await send(sock,jid,"🔐 Plugin update requires CONFIRM.",{category:"security"});continue;}const url=parts[3];if(!name||!url){await send(sock,jid,"Usage: .plugin update <name> <URL> CONFIRM");continue;}const p=await plugins.installFromUrl(url,{name,cfg,send:pluginSend});await send(sock,jid,"⬆️ Plugin updated: *"+p.name+"* v"+p.version,{category:"admin"});continue;}
      if(sub==="remove"){if(!parts.some(x=>x.toUpperCase()==="CONFIRM")){await send(sock,jid,"🔐 Plugin removal requires CONFIRM.",{category:"security"});continue;}plugins.remove(name);await send(sock,jid,"🗑️ Plugin removed: "+name,{category:"admin"});continue;}
      await send(sock,jid,"Usage: .plugin list | .plugin install <URL> <name> CONFIRM | send .js file with caption .plugin install <name> CONFIRM | .plugin enable/disable/reload/remove/test/logs/update <name>",{category:"utility"});
      }catch(e){await send(sock,jid,"❌ Plugin action failed: "+e.message,{category:"error"});}continue;
    }
    if(mode==="maintenance_on"||mode==="maintenance_off"){
      if(!isOwner(sender)){await send(sock,jid,"⛔ Owner only.",{category:"admin"});continue;}
      maintenance=mode==="maintenance_on";await send(sock,jid,maintenance?"🛡️ Maintenance mode enabled.":"✅ Maintenance mode disabled.",{category:"admin"});continue;
    }
    if(maintenance&&!isOwner(sender)){await send(sock,jid,"🛡️ TOHID-AGENT is currently in maintenance mode.",{category:"admin"});continue;}
    if(mode==="block"||mode==="unblock"){
      if(!isOwner(sender)){await send(sock,jid,"⛔ Owner only.");continue;}
      const target=text.split(/\s+/)[1]?.replace(/\D/g,"");
      if(!target){await send(sock,jid,"Usage: "+cfg.prefix+mode+" <number>",{category:"admin"});continue;}
      await db.setBlocked(target+"@s.whatsapp.net",mode==="block");await send(sock,jid,(mode==="block"?"🚫 Blocked ":"✅ Unblocked ")+target,{category:"security"});continue;
    }
    if(mode==="help"){
      const requestedLanguage=text.trim().slice((cfg.prefix+"help").length).trim();
      const language=requestedLanguage||await i18n.getLanguage(jid);
      if(requestedLanguage)await i18n.setLanguage(jid,requestedLanguage);
      if(cfg.interactiveButtonsEnabled){
        try{await buttons.sendHelpByMode(sock,jid,language,ui.resolve(await getUIMode(jid),"help"));}
        catch(e){await send(sock,jid,help(),{category:"ai"});}
      }else await send(sock,jid,help(),{category:"ai"});
      continue;
    }
    if(mode==="ping"){await send(sock,jid,"🏓 TOHID-AGENT V11.0: online\n👨‍💻 Developer: Tohid");continue;}
    if(mode==="status"){const s=await db.stats();await send(sock,jid,"⚡ *TOHID-AGENT V11.0*\nStatus: Online\nDeveloper: Tohid\nAI: "+(cfg.openaiKey&&cfg.geminiKey?"OpenAI → Gemini fallback":cfg.openaiKey?"OpenAI":cfg.geminiKey?"Gemini":"Not configured")+"\nMemory DB: "+(s.database?"Connected":"Not configured")+"\nGitHub: "+(cfg.githubToken?"Configured":"Not configured")+"\nBlocked users: "+(s.blocked??0));continue;}
    if(mode==="doctor"){const result=await doctor.run({cfg,db,plugins});await send(sock,jid,doctor.format(result),{category:"status"});continue;}
    if(mode==="tools"){await send(sock,jid,"🧰 *V10 TOOLS*\n• GitHub agent\n• Calculator\n• System diagnostics\n• Current time\n• Web search (when enabled)\n• Vision\n• Voice STT/TTS\n• Image generation\n• Video generation\n• Memory + profiles\n• Autonomous planner + verified tool execution");continue;}
    if(mode==="plan"){const request=text.slice((cfg.prefix+"plan").length).trim();const p=planner.plan(request);await send(sock,jid,"🧭 *TOHID-AGENT V11.0 PLAN*\n\n"+JSON.stringify(p,null,2),{category:"utility"});continue;}
    if(mode==="provider"){await send(sock,jid,"🔌 *AI PROVIDERS*\nMode: "+cfg.aiProvider+"\nOpenAI: "+(cfg.openaiKey?"ready":"not configured")+"\nGemini: "+(cfg.geminiKey?"ready":"not configured")+"\nHeroku: "+(cfg.herokuToken?"configured":"not configured")+"\nFallback: "+(cfg.openaiKey&&cfg.geminiKey?"enabled":"single provider"));continue;}
    if(mode==="stats"){if(!isOwner(sender)){await send(sock,jid,"⛔ Owner only.");continue;}const s=await db.stats();await send(sock,jid,"📊 *TOHID-AGENT V11.0 STATS*\nUsers: "+(s.users??"N/A")+"\nBlocked: "+(s.blocked??0)+"\nChat: "+(s.usage?.chat??0)+"\nVoice: "+(s.usage?.voice??0)+"\nImages: "+(s.usage?.image??0)+"\nVideos: "+(s.usage?.video??0));continue;}
    if(mode==="memory"){const h=await db.getMemory(sender);await send(sock,jid,"🧠 Stored conversation messages: "+h.length+"\nUse "+cfg.prefix+"newchat to clear your AI memory.");continue;}
    if(mode==="profile"){
      const parts=text.trim().split(/\s+/);
      if(parts.length===1){const p=await db.getProfile(sender);await send(sock,jid,"👤 *TOHID-AGENT V11.0 PROFILE*\\nName: "+(p.name||"Not set")+"\\nBio: "+(p.bio||"Not set")+"\\nLanguage: "+(p.language||"Auto")+"\\n\\nSet: .profile name <name>\\n.profile bio <text>\\n.profile language <language>");continue;}
      const key=parts[1]?.toLowerCase();const value=parts.slice(2).join(" ").trim();
      if(!["name","bio","language"].includes(key)||!value){await send(sock,jid,"Usage: .profile name <name> | .profile bio <text> | .profile language <language>",{category:"utility"});continue;}
      await db.setProfile(sender,{[key]:value});if(key==="language")await i18n.setLanguage(jid,value);await send(sock,jid,"✅ Profile "+key+" updated.");continue;
    }
    if(mode==="reset"){await ai.clearMemory(sender);await send(sock,jid,"🧹 Your TOHID-AGENT conversation memory has been cleared.",{category:"memory"});continue;}
    if(mode==="menu"){await sendInteractiveMenu(sock,jid,"main");continue;}
    if(mode==="settings"){const parts=text.trim().split(/\s+/);const key=parts[0].replace(cfg.prefix,"").toLowerCase();const value=parts[1]?.toLowerCase();if(!value){await send(sock,jid,"⚙️ *TOHID-AGENT V11.0 SETTINGS*\n\n🎙️ Voice: use .voice on/off\n🧠 Memory: use .memory on/off\n📊 Status: .status\n\nUse .menu to view the text menu.");continue;}if((key==="voice"||key==="memory")&&["on","off"].includes(value)){await db.setSettings(sender,{[key]:value==="on"});if(key==="memory"&&value==="off")await db.clearMemory(sender);await send(sock,jid,(key==="voice"?"🎙️ Voice reply ":"🧠 Memory ")+(value==="on"?"enabled":"disabled")+".",{category:key==="voice"?"voice":"memory"});continue;}await send(sock,jid,"Use .voice on/off or .memory on/off",{category:"admin"});continue;}
    if(mode==="video"){const prompt=text.slice((cfg.prefix+"video ").length).trim();if(!prompt){await send(sock,jid,"Usage: .video <prompt>");continue;}await send(sock,jid,"🎬 Generating video...",{category:"video"});const vid=await ai.video(prompt);await db.track(sender,"video");const caption=await i18n.translate("🎬 TOHID-AGENT V11.0 • Tohid",await i18n.getLanguage(jid));await sock.sendMessage(jid,{video:{url:vid},caption:withPromo(caption)});if(fs.existsSync(vid))fs.unlinkSync(vid);continue;}
    if(mode==="image"){const prompt=text.slice((cfg.prefix+"imagine ").length).trim();if(!prompt){await send(sock,jid,"Usage: .imagine <prompt>");continue;}await send(sock,jid,"🎨 Generating image...",{category:"image"});const img=await ai.image(prompt);await db.track(sender,"image");const caption=await i18n.translate("🎨 TOHID-AGENT V11.0 • Created by Tohid",await i18n.getLanguage(jid));await sock.sendMessage(jid,{image:{url:img},caption:withPromo(caption)});if(fs.existsSync(img))fs.unlinkSync(img);continue;}

    await sock.sendPresenceUpdate("composing",jid);
    const language=await i18n.getLanguage(jid);
    const answer=await ai.ask(sender,text,{isOwner:isOwner(sender),imageData,baileysExtras,sock,jid,language});
    const userSettings=await db.getSettings(sender);const voiceReply=userSettings.voice===true||(userSettings.voice===undefined&&cfg.voiceReply);if((voiceReply||inputWasVoice)&&answer){const out=path.join(TMP,"reply-"+Date.now()+".mp3");await ai.tts(answer,out);await sock.sendMessage(jid,{audio:{url:out},mimetype:"audio/mpeg",ptt:true});await send(sock,jid,promo(),{category:"utility"});if(fs.existsSync(out))fs.unlinkSync(out);}
    else await send(sock,jid,answer,{mode:"ai",sourceText:text,imageData});
    if(audioPath&&fs.existsSync(audioPath))fs.unlinkSync(audioPath);
   }catch(e){console.error(e);try{await send(sock,m.key.remoteJid,"❌ TOHID-AGENT: "+(e.response?.data?.error?.message||e.message),{category:"error"});}catch{}}
  }
 });
}
if(process.env.PORT)http.createServer(async(req,res)=>{
  const handled=await pairingWeb.handle(req,res,pairingManager);if(handled)return;
  try{
    if(req.url==="/admin-ui"){res.writeHead(200,{"content-type":"text/html; charset=utf-8"});return res.end(fs.readFileSync(path.join(process.cwd(),"public/admin.html"),"utf8"));}
    if(req.url==="/health"||req.url==="/healthz"){
      const s=await db.stats();const p=preflight.safeSummary();
      const body={name:"TOHID-AGENT",version:cfg.version,developer:"Tohid",status:activeSocket?"online":"starting",uptime:log.uptime(),node:process.version,database:s.database,providers:p.providers,integrations:{github:!!cfg.githubToken,heroku:!!cfg.herokuToken,vercel:!!cfg.vercelToken,render:!!cfg.renderApiKey,koyeb:!!cfg.koyebToken},whatsapp:!!activeSocket};
      res.writeHead(body.status==="online"?200:503,{"content-type":"application/json"});return res.end(JSON.stringify(body,null,2));
    }
    if(req.url==="/admin"&&cfg.adminPanelEnabled){
      const token=req.headers["x-admin-token"]||"";
      if(!cfg.adminPanelToken||token!==cfg.adminPanelToken){res.writeHead(401,{"content-type":"application/json"});return res.end(JSON.stringify({error:"Unauthorized"}));}
      const s=await db.stats();res.writeHead(200,{"content-type":"application/json"});return res.end(JSON.stringify({name:"TOHID-AGENT",version:cfg.version,developer:"Tohid",status:"online",database:s.database,stats:s},null,2));
    }
    res.writeHead(200,{"content-type":"application/json"});res.end(JSON.stringify({name:"TOHID-AGENT",version:cfg.version,developer:"Tohid",status:"online"}));
  }catch(error){res.writeHead(503,{"content-type":"application/json"});res.end(JSON.stringify({name:"TOHID-AGENT",status:"degraded",error:"Health check unavailable"}));}
}).listen(process.env.PORT,"0.0.0.0",()=>log.info("Health server listening",{port:process.env.PORT}));
const shutdown=async(signal)=>{
  if(shuttingDown)return;
  shuttingDown=true;
  log.info("Graceful shutdown requested",{signal});
  try{if(activeSocket)activeSocket.end(undefined);}catch{}
  try{await activeCloseAuth();}catch(e){log.warn("Auth close failed",{message:e?.message});}
  try{await telegramPairing.stop();}catch(e){log.warn("Telegram bot stop failed",{message:e?.message});}
  try{await db.close();}catch(e){log.warn("Database close failed",{message:e?.message});}
  process.exit(0);
};
process.once("SIGTERM",()=>shutdown("SIGTERM"));
process.once("SIGINT",()=>shutdown("SIGINT"));
process.on("unhandledRejection",error=>log.error("Unhandled promise rejection",{message:error?.message||String(error)}));
process.on("uncaughtException",error=>{log.error("Uncaught exception",{message:error?.message||String(error)});process.exit(1);});
main().catch((error)=>{console.error("❌ TOHID-AGENT startup failed:",error?.stack||error?.message||error);process.exit(1);});
