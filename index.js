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

const AUTH=path.join(process.cwd(),"auth_info_baileys");
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

function normalizeOwnerNumber(value){return String(value||"").split("@")[0].replace(/\D/g,"");}\nfunction isPrimaryOwner(jid){return !!cfg.ownerNumber&&normalizeOwnerNumber(jid)===cfg.ownerNumber;}\nfunction isOwner(jid){const n=normalizeOwnerNumber(jid);return !!n&&(n===cfg.ownerNumber||delegatedOwners.has(n));}
async function hasPermission(jid,permission){return isOwner(jid)||await rbac.can(jid,permission,cfg,delegatedOwners);}\nasync function loadDelegatedOwners(){try{const list=await db.getDelegatedOwners();for(const n of list)delegatedOwners.add(n);log.info("Delegated owners loaded",{count:delegatedOwners.size});}catch(e){log.warn("Delegated owners could not be loaded",{message:e?.message});}}
function allowed(jid){const now=Date.now(),bucket=rate.get(jid)||{at:now,count:0};if(now-bucket.at>60000){bucket.at=now;bucket.count=0;}bucket.count++;rate.set(jid,bucket);return bucket.count<=cfg.rateLimitPerMinute;}
function normalizeUIMode(value){return ui.normalize(value);}
async function getUIMode(jid){return ui.get(jid);}
function normalizeJid(jid){return String(jid||"").split(":")[0];}
function applyGlobalConfig(values={}){for(const [key,value] of Object.entries(values)){if(!Object.prototype.hasOwnProperty.call(cfg,key))continue;const current=cfg[key];if(typeof current==="boolean")cfg[key]=String(value).toLowerCase()==="true";else if(typeof current==="number")cfg[key]=Number(value);else cfg[key]=value;}}\nfunction applyFeatureState(){const f=control.featureList();for(const key of ["githubEnabled","hostingEnabled","pluginSystemEnabled","videoEnabled","webSearch","baileysExtrasEnabled"]){if(Object.prototype.hasOwnProperty.call(f,key))cfg[key]=!!f[key];}}
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
   for(const id of ids){
     const value=await db.getBaileysKey(type+"-"+id);
     if(value)out[id]=JSON.parse(value,BufferJSON.reviver);
   }
   return out;
 },async set(data){
   const entries={};
   for(const[type,values]of Object.entries(data))for(const[id,value]of Object.entries(values)){
     const key=type+"-"+id;
     entries[key]=value===null?null:JSON.stringify(value,BufferJSON.replacer);
   }
   await db.setBaileysKeys(entries);
 }};
 const saveCreds=async()=>db.setBaileysCreds(JSON.stringify(creds,BufferJSON.replacer));
 return{state:{creds,keys:makeCacheableSignalKeyStore(keyStore,pino({level:"silent"}))},saveCreds,close:async()=>{}};
}

