const fs=require("fs");
const path=require("path");
const {spawn}=require("child_process");
const crypto=require("crypto");

const ROOT=path.join(process.cwd(),".tohid-free");
const deployments=new Map();

function normalizePhone(v){return String(v||"").replace(/\D/g,"");}
function parseDuration(v){
  const m=String(v||"24h").trim().match(/^(\d+)\s*(m|h|d)$/i);
  if(!m)throw new Error("Invalid duration. Use 30m, 6h, 24h or 7d.");
  const n=Number(m[1]); const unit=m[2].toLowerCase();
  const ms=n*(unit==="m"?60000:unit==="h"?3600000:86400000);
  if(ms<15*60000||ms>30*86400000)throw new Error("Duration must be between 15 minutes and 30 days.");
  return ms;
}
function safeEnv(env,cleanEnv){
  return cleanEnv(env||{});
}
function snapshot(d){
  return {id:d.id,phone:d.phone,mode:d.mode,status:d.status,code:d.code||null,qr:d.qr||null,createdAt:d.createdAt,expiresAt:d.expiresAt,exit:d.exit||null};
}
function create(options={},cleanEnv){
  const mode=String(options.mode||"pairing").toLowerCase()==="qr"?"qr":"pairing";
  const phone=normalizePhone(options.phone);
  if(mode==="pairing"&&(phone.length<10||phone.length>15))throw new Error("Phone number must contain country code and 10-15 digits.");
  if(mode==="qr"&&phone)throw new Error("QR mode does not require a phone number.");
  const active=[...deployments.values()].filter(x=>["starting","pairing","running"].includes(x.status)).length;
  if(active>=Number(process.env.MAX_FREE_DEPLOYMENTS||5))throw new Error("Free deployment limit reached. Try again later.");
  const id=crypto.randomBytes(8).toString("hex");
  const dir=path.join(ROOT,id),authDir=path.join(dir,"auth");
  fs.mkdirSync(authDir,{recursive:true});
  const duration=parseDuration(options.duration||"24h");
  const env=safeEnv(options.env,cleanEnv);
  const code=mode==="pairing"?String(crypto.randomInt(10000000,100000000)):"";
  const childEnv={...process.env,...env,OWNER_NUMBER:phone,PAIRING_NUMBER:mode==="pairing"?phone:"",PAIRING_CODE:code,LOGIN_METHOD:mode,AUTH_DIR:authDir,LOCAL_AUTH_ONLY:"1",TOHID_PAIRING_CHILD:"1",TOHID_FREE_DEPLOYMENT:"1",ADMIN_PANEL_ENABLED:"false"};
  delete childEnv.SESSION_ID; delete childEnv.PAIRING_WEB_TOKEN; delete childEnv.TELEGRAM_BOT_TOKEN;
  const child=spawn(process.execPath,[path.join(process.cwd(),"MrTohid.js")],{cwd:process.cwd(),env:childEnv,stdio:["ignore","pipe","pipe","ipc"]});
  const d={id,phone,mode,env,status:"starting",code:null,qr:null,child,createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+duration).toISOString()};
  deployments.set(id,d);
  child.stdout.on("data",buf=>{const t=String(buf);const m=t.match(/WHATSAPP PAIRING CODE:\s*([A-Z0-9-]{8,12})/i);if(m&&!d.code){d.code=m[1].replace(/-/g,"");d.status="pairing";}});
  child.stderr.on("data",buf=>{if(process.env.DEBUG==="true")process.stderr.write("[free:"+id+"] "+String(buf));});
  child.on("message",msg=>{
    if(!msg||typeof msg!=="object")return;
    if(msg.type==="pairing-code"){d.code=String(msg.code||"").replace(/-/g,"");d.status="pairing";}
    if(msg.type==="qr"){d.qr=String(msg.qr||"");d.status="pairing";}
    if(msg.type==="connected"){d.status="running";d.connectedAt=new Date().toISOString();}
  });
  child.on("exit",(code,signal)=>{d.exit={code,signal};if(d.status!=="expired")d.status="stopped";});
  d.timer=setTimeout(()=>expire(id),duration);
  return snapshot(d);
}
async function stop(id){
  const d=deployments.get(String(id));if(!d)return false;
  d.status="stopping";try{if(d.child.connected)d.child.send({type:"logout"});}catch{}
  try{d.child.kill("SIGTERM");}catch{}
  setTimeout(()=>{try{if(!d.child.killed)d.child.kill("SIGKILL");}catch{}},5000);
  d.status="stopped";try{fs.rmSync(path.join(ROOT,d.id),{recursive:true,force:true});}catch{}
  return true;
}
async function expire(id){
  const d=deployments.get(String(id));if(!d||["stopped","expired"].includes(d.status))return;
  d.status="expired";try{d.child.kill("SIGTERM");}catch{}setTimeout(()=>{try{if(!d.child.killed)d.child.kill("SIGKILL");}catch{}},5000);
  try{fs.rmSync(path.join(ROOT,d.id),{recursive:true,force:true});}catch{}
}
function get(id){const d=deployments.get(String(id));return d?snapshot(d):null;}
function list(){return [...deployments.values()].map(snapshot);}
function stats(){return {active:[...deployments.values()].filter(x=>["starting","pairing","running"].includes(x.status)).length,total:deployments.size};}
async function shutdown(){for(const id of deployments.keys())await stop(id);}
module.exports={create,get,list,stop,stats,shutdown,parseDuration};