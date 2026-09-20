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
const preflight=require("./lib/preflight");
const log=require("./lib/logger");
const mission=require("./lib/mission");
const scheduler=require("./lib/scheduler");
const baileysExtras=require("./lib/baileysExtras");

const AUTH=path.join(process.cwd(),"auth_info_baileys");
const TMP=path.join(process.cwd(),"tmp");
if(!fs.existsSync(TMP))fs.mkdirSync(TMP,{recursive:true});
const rate=new Map();
let maintenance=false;
let activeSocket=null;
let activeCloseAuth=async()=>{};
let shuttingDown=false;

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
    await activeSocket.sendMessage(job.jid,{text:withPromo(msg)});
  }
});

function isOwner(jid){return !!cfg.ownerNumber&&jid.split("@")[0].replace(/\D/g,"")===cfg.ownerNumber;}
function allowed(jid){const now=Date.now(),bucket=rate.get(jid)||{at:now,count:0};if(now-bucket.at>60000){bucket.at=now;bucket.count=0;}bucket.count++;rate.set(jid,bucket);return bucket.count<=cfg.rateLimitPerMinute;}
function normalizeJid(jid){return String(jid||"").split(":")[0];}
async function downloadMedia(message,type){const stream=await downloadContentFromMessage(message,type);const chunks=[];for await(const c of stream)chunks.push(c);return Buffer.concat(chunks);}
async function send(sock,jid,text,ctx={}){
 const category=ctx.category||null;
 // Keep normal AI replies fast. Use a visual only for richer/system responses.
 const visualCategories=new Set(["github","memory","vision","admin","stats","security","status","error","code","utility"]);
 const image=category&&visualCategories.has(category)?replyImages.getImage(category):null;
 if(image){
  return sock.sendMessage(jid,{image:{url:image},caption:withPromo(text)});
 }
 return sock.sendMessage(jid,{text:withPromo(text)});
}

async function mongoAuth(){
 const client=new MongoClient(cfg.mongoUri);await client.connect();
 const database=client.db(cfg.mongoDb),col=database.collection("baileys_auth"),doc=await col.findOne({_id:"state"});
 const creds=doc?.creds?JSON.parse(doc.creds,BufferJSON.reviver):initAuthCreds();
 const keys=database.collection("baileys_keys");
 const keyStore={async get(type,ids){const out={};for(const id of ids){const d=await keys.findOne({_id:type+"-"+id});if(d)out[id]=JSON.parse(d.value,BufferJSON.reviver);}return out;},async set(data){const ops=[];for(const[type,entries]of Object.entries(data))for(const[id,value]of Object.entries(entries)){const _id=type+"-"+id;if(value===null)ops.push({deleteOne:{filter:{_id}}});else ops.push({replaceOne:{filter:{_id},replacement:{_id,type,id,value:JSON.stringify(value,BufferJSON.replacer)},upsert:true}});}if(ops.length)await keys.bulkWrite(ops,{ordered:false});}};
 const saveCreds=async()=>col.replaceOne({_id:"state"},{_id:"state",creds:JSON.stringify(creds,BufferJSON.replacer)},{upsert:true});
 return{state:{creds,keys:makeCacheableSignalKeyStore(keyStore,pino({level:"silent"}))},saveCreds,close:()=>client.close()};
}

function promo(){return "📢 *TOHID TECH*\n"+cfg.channelLink;}
function withPromo(text){const s=String(text||"");return s.includes(cfg.channelLink)?s:s+"\\n\\n"+promo();}
function help(){
return "🤖 *TOHID-AGENT V9.0 — COMPLETE HELP*\\n\\n"+
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
"• .stats → owner statistics\\n\\n"+
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
    if(kind==="main")return await buttons.sendMain(sock,jid);
    if(kind==="list")return await buttons.sendList(sock,jid);
    if(kind==="dev")return await buttons.sendDev(sock,jid);
    if(kind==="settings")return await buttons.sendSettings(sock,jid);
  }catch(e){
    console.error("❌ Interactive UI send failed; using text fallback:",e?.stack||e?.message||e);
    if(kind==="dev")return menu.sendMenu(sock,jid,"main",{text:"👨‍💻 *Developer: Tohid*\\n\\nInteractive buttons are unavailable on this client, so text mode is active."});
    return menu.sendMenu(sock,jid,"main",{text:"🤖 *TOHID-AGENT V9.0*\\n\\nInteractive buttons could not be rendered on this client. Text mode remains active."});
  }
}
async function main(){
 baileysExtras.suppressLogs();
 if(!cfg.enabled)return console.log("TOHID-AGENT is disabled.");
 const check=preflight.validate();
 if(!check.ok){check.errors.forEach(x=>log.error(x));throw new Error("Production preflight failed: "+check.errors.join(" | "));}
 check.warnings.forEach(x=>log.warn(x));
 log.info("Starting TOHID-AGENT V9.0",preflight.safeSummary());
 let auth,closeAuth=async()=>{};
 if(cfg.mongoUri){auth=await mongoAuth();closeAuth=auth.close;await db.connect();console.log("☁️ MongoDB auth + memory enabled.");}
 else{auth=await useMultiFileAuthState(AUTH);console.log("⚠️ Local auth enabled; set MONGO_URI for persistent auth.");}
 const{state,saveCreds}=auth;
 const{version}=await fetchLatestBaileysVersion();
 console.log("📦 Baileys version: "+version.join("."));
 const sock=makeWASocket({version,auth:state,logger:pino({level:"silent"}),printQRInTerminal:false,browser:Browsers.ubuntu("Chrome"),markOnlineOnConnect:false,syncFullHistory:false,connectTimeoutMs:60000});
 activeSocket=sock;
 activeCloseAuth=closeAuth;
 sock.ev.on("creds.update",saveCreds);
 let pairingRequested=false;
 sock.ev.on("connection.update",async({connection,lastDisconnect,qr})=>{
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
          const code=await sock.requestPairingCode(number);
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
    log.info("TOHID-AGENT connected",{developer:"Tohid",version:cfg.version});
    console.log("📡 WhatsApp message listener is active.");
    if(cfg.missionSchedulerEnabled)scheduler.start(cfg.missionPollIntervalMs);
  }
  if(connection==="close"){
    const code=lastDisconnect?.error?.output?.statusCode;
    const message=lastDisconnect?.error?.message||"";
    log.warn("WhatsApp connection closed",{code,message});
    if(code===DisconnectReason.loggedOut){
      console.error("🧹 Clearing failed pairing session for a fresh login...");
      try{
        if(cfg.mongoUri){
          const c=new MongoClient(cfg.mongoUri);
          await c.connect();
          const d=c.db(cfg.mongoDb);
          await Promise.all([d.collection("baileys_auth").deleteMany({}),d.collection("baileys_keys").deleteMany({})]);
          await c.close();
        }else fs.rmSync(AUTH,{recursive:true,force:true});
      }catch(e){console.error("Auth reset error:",e?.message||e);}
      await closeAuth();
      console.log("🔄 Auth reset complete. Restart the bot for a fresh pairing code.");
    }else{
      await closeAuth();
      if(!shuttingDown)setTimeout(()=>main().catch(error=>log.error(error?.message||String(error))),3000);
    }
  }
 });

 sock.ev.on("messages.upsert",async({messages,type})=>{
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
        if(action==="__TOHID_HELP_LANGUAGES__"){await buttons.sendLanguageMenu(sock,jid);continue;}
        const helpLangs={__TOHID_HELP_HI__:"Hindi",__TOHID_HELP_BN__:"Bengali",__TOHID_HELP_PA__:"Punjabi",__TOHID_HELP_UR__:"Urdu",__TOHID_HELP_TA__:"Tamil",__TOHID_HELP_TE__:"Telugu",__TOHID_HELP_MR__:"Marathi",__TOHID_HELP_GU__:"Gujarati",__TOHID_HELP_KN__:"Kannada",__TOHID_HELP_ML__:"Malayalam",__TOHID_HELP_AR__:"Arabic",__TOHID_HELP_ES__:"Spanish",__TOHID_HELP_FR__:"French",__TOHID_HELP_DE__:"German",__TOHID_HELP_TR__:"Turkish"};
        if(helpLangs[action]){await buttons.sendHelp(sock,jid,helpLangs[action]);continue;}
        if(action==="__TOHID_HELP_OTHER__"){await send(sock,jid,"🌐 *Other language*\\n\\nUse: .help <language>\\nExample: .help Japanese");continue;}
        if(action==="__TOHID_HELP_HI__"){await buttons.sendHelp(sock,jid,"Hindi");continue;}
        if(action==="__TOHID_HELP_EN__"){await buttons.sendHelp(sock,jid,"en");continue;}
        if(action==="__TOHID_MENU__"){await sendInteractiveMenu(sock,jid,"main");continue;}
        if(action==="__TOHID_AI__"){await send(sock,jid,"🤖 *TOHID-AGENT AI*\n\nSend your question or command now. Text input remains fully supported.",{category:"ai"});continue;}
        if(action==="__TOHID_GITHUB__"){await send(sock,jid,"🐙 *GitHub Agent*\n\nTell me what you want to inspect or manage, for example: list my repositories or read a repository file.",{category:"github"});continue;}
        if(action==="__TOHID_HEROKU__"){await send(sock,jid,"🚀 *Heroku Agent*\n\nTell me which app you want to inspect or manage. Protected changes still require owner authorization + CONFIRM.",{category:"status"});continue;}
        if(action==="__TOHID_CHANNEL__"){await send(sock,jid,"📢 *TOHID TECH*\n"+cfg.channelLink,{category:"utility"});continue;}
        text=action;
      }
    }
    const group=jid.endsWith("@g.us");
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
        await sock.sendMessage(jid,{text:withPromo("🏓 TOHID-AGENT V9.0: online\\n👨‍💻 Developer: Tohid")});
        console.log("📤 .ping reply sent to "+jid);
      }catch(pingError){
        console.error("❌ .ping send failed:",pingError?.stack||pingError?.message||pingError);
      }
      continue;
    }
    const lower=text.trim().toLowerCase();
    if(lower===cfg.prefix+"agent"||lower===cfg.prefix+"agent status"||lower===cfg.prefix+"health"){
      await send(sock,jid,"🧠 *TOHID-AGENT V9.0 CORE*\\n\\n"+JSON.stringify(agentCore.health(),null,2),{category:"status"});continue;
    }
    if(lower===cfg.prefix+"baileys"){
      const caps=baileysExtras.capabilities(sock);
      await send(sock,jid,"🧩 *BAILEYS V9 COMPATIBILITY*\\n\\n"+Object.entries(caps).map(([k,v])=>(v?"✅ ":"❌ ")+k).join("\\n"),{category:"status"});continue;
    }
    if(lower.startsWith(cfg.prefix+"channel ")){
      const parts=text.trim().split(/\s+/);
      const action=(parts[1]||"").toLowerCase();
      const channelJid=parts[2]||"";
      if(!action||!channelJid){await send(sock,jid,"Usage: .channel <info|follow|unfollow|mute|unmute|subscribers> <channelJid>",{category:"utility"});continue;}
      const mutating=["follow","unfollow","mute","unmute"].includes(action);
      if(mutating&&!isOwner(sender)){await send(sock,jid,"⛔ Owner only.",{category:"security"});continue;}
      if(mutating&&!parts.some(x=>x.toUpperCase()==="CONFIRM")){await send(sock,jid,"🔐 Protected channel changes require explicit CONFIRM. Example: .channel follow <channelJid> CONFIRM",{category:"security"});continue;}
      try{
        let result;
        if(action==="info")result=await baileysExtras.newsletter(sock,"newsletterMetadata","jid",channelJid);
        else if(action==="subscribers")result=await baileysExtras.newsletter(sock,"newsletterSubscribers",channelJid);
        else result=await baileysExtras.newsletter(sock,"newsletter"+action.charAt(0).toUpperCase()+action.slice(1),channelJid);
        await send(sock,jid,"📢 *CHANNEL "+action.toUpperCase()+"*\\n\\n"+JSON.stringify(result,null,2),{category:"status"});
      }catch(e){await send(sock,jid,"❌ Channel feature unavailable: "+e.message,{category:"error"});}
      continue;
    }
    if(lower.startsWith(cfg.prefix+"groupstatus ")){\n      if(!isOwner(sender)){await send(sock,jid,"⛔ Owner only.",{category:"security"});continue;}\n      if(!group){await send(sock,jid,"⚠️ `.groupstatus` can only be used inside a WhatsApp group.");continue;}\n      const statusText=text.slice((cfg.prefix+"groupstatus ").length).trim();\n      if(!statusText){await send(sock,jid,"Usage: .groupstatus <text>");continue;}\n      try{await baileysExtras.sendGroupStatus(sock,jid,{text:statusText});await send(sock,jid,"✅ Group status sent.",{category:"status"});}catch(e){await send(sock,jid,"❌ Group status is unavailable in the active Baileys build: "+e.message,{category:"error"});}\n      continue;\n    }\n    if(lower===cfg.prefix+"skills"){
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
      if(cfg.interactiveButtonsEnabled){
        try{
          if(requestedLanguage) await buttons.sendHelp(sock,jid,requestedLanguage);
          else await buttons.sendHelp(sock,jid,"en");
        }catch(e){await send(sock,jid,help(),{category:"ai"});}
      }else await send(sock,jid,help(),{category:"ai"});
      continue;
    }
    if(mode==="ping"){await send(sock,jid,"🏓 TOHID-AGENT V9.0: online\n👨‍💻 Developer: Tohid");continue;}
    if(mode==="status"){const s=await db.stats();await send(sock,jid,"⚡ *TOHID-AGENT V9.0*\nStatus: Online\nDeveloper: Tohid\nAI: "+(cfg.openaiKey&&cfg.geminiKey?"OpenAI → Gemini fallback":cfg.openaiKey?"OpenAI":cfg.geminiKey?"Gemini":"Not configured")+"\nMemory DB: "+(s.database?"Connected":"Not configured")+"\nGitHub: "+(cfg.githubToken?"Configured":"Not configured")+"\nBlocked users: "+(s.blocked??0));continue;}
    if(mode==="doctor"){const checks=[["OpenAI",!!cfg.openaiKey],["Gemini",!!cfg.geminiKey],["MongoDB",!!cfg.mongoUri],["GitHub",!!cfg.githubToken],["Pairing",!!cfg.pairingNumber]];await send(sock,jid,"🩺 *TOHID-AGENT V9.0 DOCTOR*\n\n"+checks.map(x=>(x[1]?"✅ ":"❌ ")+x[0]).join("\n")+"\n\nNode: "+process.version+"\nTool loop: "+cfg.toolLoopLimit+"\nMemory limit: "+cfg.maxMemoryMessages);continue;}
    if(mode==="tools"){await send(sock,jid,"🧰 *V9 TOOLS*\n• GitHub agent\n• Calculator\n• System diagnostics\n• Current time\n• Web search (when enabled)\n• Vision\n• Voice STT/TTS\n• Image generation\n• Video generation\n• Memory + profiles\n• Autonomous planner + verified tool execution");continue;}
    if(mode==="plan"){const request=text.slice((cfg.prefix+"plan").length).trim();const p=planner.plan(request);await send(sock,jid,"🧭 *TOHID-AGENT V9.0 PLAN*\n\n"+JSON.stringify(p,null,2),{category:"utility"});continue;}
    if(mode==="provider"){await send(sock,jid,"🔌 *AI PROVIDERS*\nMode: "+cfg.aiProvider+"\nOpenAI: "+(cfg.openaiKey?"ready":"not configured")+"\nGemini: "+(cfg.geminiKey?"ready":"not configured")+"\nHeroku: "+(cfg.herokuToken?"configured":"not configured")+"\nFallback: "+(cfg.openaiKey&&cfg.geminiKey?"enabled":"single provider"));continue;}
    if(mode==="stats"){if(!isOwner(sender)){await send(sock,jid,"⛔ Owner only.");continue;}const s=await db.stats();await send(sock,jid,"📊 *TOHID-AGENT V9.0 STATS*\nUsers: "+(s.users??"N/A")+"\nBlocked: "+(s.blocked??0)+"\nChat: "+(s.usage?.chat??0)+"\nVoice: "+(s.usage?.voice??0)+"\nImages: "+(s.usage?.image??0)+"\nVideos: "+(s.usage?.video??0));continue;}
    if(mode==="memory"){const h=await db.getMemory(sender);await send(sock,jid,"🧠 Stored conversation messages: "+h.length+"\nUse "+cfg.prefix+"newchat to clear your AI memory.");continue;}
    if(mode==="profile"){
      const parts=text.trim().split(/\s+/);
      if(parts.length===1){const p=await db.getProfile(sender);await send(sock,jid,"👤 *TOHID-AGENT V9.0 PROFILE*\\nName: "+(p.name||"Not set")+"\\nBio: "+(p.bio||"Not set")+"\\nLanguage: "+(p.language||"Auto")+"\\n\\nSet: .profile name <name>\\n.profile bio <text>\\n.profile language <language>");continue;}
      const key=parts[1]?.toLowerCase();const value=parts.slice(2).join(" ").trim();
      if(!["name","bio","language"].includes(key)||!value){await send(sock,jid,"Usage: .profile name <name> | .profile bio <text> | .profile language <language>",{category:"utility"});continue;}
      await db.setProfile(sender,{[key]:value});await send(sock,jid,"✅ Profile "+key+" updated.");continue;
    }
    if(mode==="reset"){await ai.clearMemory(sender);await send(sock,jid,"🧹 Your TOHID-AGENT conversation memory has been cleared.",{category:"memory"});continue;}
    if(mode==="menu"){await sendInteractiveMenu(sock,jid,"main");continue;}
    if(mode==="settings"){const parts=text.trim().split(/\s+/);const key=parts[0].replace(cfg.prefix,"").toLowerCase();const value=parts[1]?.toLowerCase();if(!value){await send(sock,jid,"⚙️ *TOHID-AGENT V9.0 SETTINGS*\n\n🎙️ Voice: use .voice on/off\n🧠 Memory: use .memory on/off\n📊 Status: .status\n\nUse .menu to view the text menu.");continue;}if((key==="voice"||key==="memory")&&["on","off"].includes(value)){await db.setSettings(sender,{[key]:value==="on"});if(key==="memory"&&value==="off")await db.clearMemory(sender);await send(sock,jid,(key==="voice"?"🎙️ Voice reply ":"🧠 Memory ")+(value==="on"?"enabled":"disabled")+".",{category:key==="voice"?"voice":"memory"});continue;}await send(sock,jid,"Use .voice on/off or .memory on/off",{category:"admin"});continue;}
    if(mode==="video"){const prompt=text.slice((cfg.prefix+"video ").length).trim();if(!prompt){await send(sock,jid,"Usage: .video <prompt>");continue;}await send(sock,jid,"🎬 Generating video...",{category:"video"});const vid=await ai.video(prompt);await db.track(sender,"video");await sock.sendMessage(jid,{video:{url:vid},caption:withPromo("🎬 TOHID-AGENT V9.0 • Tohid")});if(fs.existsSync(vid))fs.unlinkSync(vid);continue;}
    if(mode==="image"){const prompt=text.slice((cfg.prefix+"imagine ").length).trim();if(!prompt){await send(sock,jid,"Usage: .imagine <prompt>");continue;}await send(sock,jid,"🎨 Generating image...",{category:"image"});const img=await ai.image(prompt);await db.track(sender,"image");await sock.sendMessage(jid,{image:{url:img},caption:withPromo("🎨 TOHID-AGENT V9.0 • Created by Tohid")});if(fs.existsSync(img))fs.unlinkSync(img);continue;}

    await sock.sendPresenceUpdate("composing",jid);
    const answer=await ai.ask(sender,text,{isOwner:isOwner(sender),imageData,baileysExtras,sock,jid});
    const userSettings=await db.getSettings(sender);const voiceReply=userSettings.voice===true||(userSettings.voice===undefined&&cfg.voiceReply);if((voiceReply||inputWasVoice)&&answer){const out=path.join(TMP,"reply-"+Date.now()+".mp3");await ai.tts(answer,out);await sock.sendMessage(jid,{audio:{url:out},mimetype:"audio/mpeg",ptt:true});await send(sock,jid,promo(),{category:"utility"});if(fs.existsSync(out))fs.unlinkSync(out);}
    else await send(sock,jid,answer,{mode:"ai",sourceText:text,imageData});
    if(audioPath&&fs.existsSync(audioPath))fs.unlinkSync(audioPath);
   }catch(e){console.error(e);try{await send(sock,m.key.remoteJid,"❌ TOHID-AGENT: "+(e.response?.data?.error?.message||e.message),{category:"error"});}catch{}}
  }
 });
}
if(process.env.PORT)http.createServer(async(req,res)=>{
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
  try{await db.close();}catch(e){log.warn("Database close failed",{message:e?.message});}
  process.exit(0);
};
process.once("SIGTERM",()=>shutdown("SIGTERM"));
process.once("SIGINT",()=>shutdown("SIGINT"));
process.on("unhandledRejection",error=>log.error("Unhandled promise rejection",{message:error?.message||String(error)}));
process.on("uncaughtException",error=>{log.error("Uncaught exception",{message:error?.message||String(error)});process.exit(1);});
main().catch((error)=>{console.error("❌ TOHID-AGENT startup failed:",error?.stack||error?.message||error);process.exit(1);});
