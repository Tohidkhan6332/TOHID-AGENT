const fs=require("fs");
const path=require("path");
const http=require("http");
const qrcode=require("qrcode-terminal");
const pino=require("pino");
const {MongoClient}=require("mongodb");
const {default:makeWASocket,useMultiFileAuthState,initAuthCreds,BufferJSON,DisconnectReason,downloadContentFromMessage,fetchLatestBaileysVersion,makeCacheableSignalKeyStore}=require("@whiskeysockets/baileys");
const cfg=require("./config");
const ai=require("./lib/openai");
const db=require("./lib/database");
const router=require("./lib/router");
const replyImages=require("./lib/replyImages");

const AUTH=path.join(process.cwd(),"auth_info_baileys");
const TMP=path.join(process.cwd(),"tmp");
if(!fs.existsSync(TMP))fs.mkdirSync(TMP,{recursive:true});
const rate=new Map();
let maintenance=false;

function isOwner(jid){return !!cfg.ownerNumber&&jid.split("@")[0].replace(/\D/g,"")===cfg.ownerNumber;}
function allowed(jid){const now=Date.now(),bucket=rate.get(jid)||{at:now,count:0};if(now-bucket.at>60000){bucket.at=now;bucket.count=0;}bucket.count++;rate.set(jid,bucket);return bucket.count<=cfg.rateLimitPerMinute;}
function normalizeJid(jid){return String(jid||"").split(":")[0];}
async function downloadMedia(message,type){const stream=await downloadContentFromMessage(message,type);const chunks=[];for await(const c of stream)chunks.push(c);return Buffer.concat(chunks);}
async function send(sock,jid,text,ctx={}){\n const category=replyImages.getCategory({mode:ctx.mode,text:ctx.sourceText||text,imageData:!!ctx.imageData});\n const image=replyImages.getImage(category);\n if(image){\n  const caption="🤖 TOHID-AGENT V3 • "+category.toUpperCase()+" • By Tohid";\n  await sock.sendMessage(jid,{image:{url:image},caption});\n }\n return sock.sendMessage(jid,{text});\n}

async function mongoAuth(){
 const client=new MongoClient(cfg.mongoUri);await client.connect();
 const database=client.db(cfg.mongoDb),col=database.collection("baileys_auth"),doc=await col.findOne({_id:"state"});
 const creds=doc?.creds?JSON.parse(doc.creds,BufferJSON.reviver):initAuthCreds();
 const keys=database.collection("baileys_keys");
 const keyStore={async get(type,ids){const out={};for(const id of ids){const d=await keys.findOne({_id:type+"-"+id});if(d)out[id]=JSON.parse(d.value,BufferJSON.reviver);}return out;},async set(data){const ops=[];for(const[type,entries]of Object.entries(data))for(const[id,value]of Object.entries(entries)){const _id=type+"-"+id;if(value===null)ops.push({deleteOne:{filter:{_id}}});else ops.push({replaceOne:{filter:{_id},replacement:{_id,type,id,value:JSON.stringify(value,BufferJSON.replacer)},upsert:true}});}if(ops.length)await keys.bulkWrite(ops,{ordered:false});}};
 const saveCreds=async()=>col.replaceOne({_id:"state"},{_id:"state",creds:JSON.stringify(creds,BufferJSON.replacer)},{upsert:true});
 return{state:{creds,keys:makeCacheableSignalKeyStore(keyStore,pino({level:"silent"}))},saveCreds,close:()=>client.close()};
}

function help(){
return "🤖 *TOHID-AGENT V3*\n\n"+
"👨‍💻 Developer: Tohid\n\n"+
"💬 Chat — send text\n🖼️ Vision — send an image + caption\n🎤 Voice — send a voice note\n"+
"🎨 .imagine <prompt>\n🎬 .video <prompt>\n🧠 .newchat / .reset\n"+
"📊 .stats (owner)\n🧠 .memory\n🛡️ .maintenance on/off (owner)\n"+
"🚫 .block <number> / .unblock <number> (owner)\n❤️ .ping\nℹ️ .status\n🛠️ .help\n\n"+
"GitHub: ask naturally to search repos, read code, inspect commits/issues, create branches, edit files and open PRs.\n"+
"🔐 GitHub writes are owner-only and require CONFIRM before execution.";
}

async function main(){
 if(!cfg.enabled)return console.log("TOHID-AGENT is disabled.");
 let auth,closeAuth=async()=>{};
 if(cfg.mongoUri){auth=await mongoAuth();closeAuth=auth.close;await db.connect();console.log("☁️ MongoDB auth + memory enabled.");}
 else{auth=await useMultiFileAuthState(AUTH);console.log("⚠️ Local auth enabled; set MONGO_URI for persistent auth.");}
 const{state,saveCreds}=auth;
 const{version}=await fetchLatestBaileysVersion();
 const sock=makeWASocket({version,auth:state,logger:pino({level:"silent"}),printQRInTerminal:false,browser:["TOHID-AGENT","Chrome","3.0.0"]});
 sock.ev.on("creds.update",saveCreds);
 let pairingRequested=false;
 sock.ev.on("connection.update",async({connection,lastDisconnect,qr})=>{
  if(qr&&cfg.loginMethod!=="pairing"){console.log("\n📱 Scan QR with WhatsApp → Linked Devices:\n");qrcode.generate(qr,{small:true});}
  if(!state.creds.registered&&cfg.loginMethod==="pairing"&&cfg.pairingNumber&&!pairingRequested){pairingRequested=true;try{await new Promise(r=>setTimeout(r,1200));console.log("\n🔐 Pairing code: "+await sock.requestPairingCode(cfg.pairingNumber));}catch(e){console.error("Pairing error:",e.message);}}
  if(connection==="open")console.log("✅ TOHID-AGENT V3 connected. Developer: Tohid");
  if(connection==="close"){const code=lastDisconnect?.error?.output?.statusCode;await closeAuth();if(code!==DisconnectReason.loggedOut)setTimeout(()=>main().catch(console.error),3000);else console.log("Logged out. Clear auth state and pair again.");}
 });

 sock.ev.on("messages.upsert",async({messages,type})=>{
  if(type!=="notify")return;
  for(const m of messages){
   try{
    if(!m.message||m.key.fromMe)continue;
    const jid=m.key.remoteJid;if(!jid||jid==="status@broadcast")continue;
    const sender=m.key.participant||jid;
    if(await db.isBlocked(sender)&&!isOwner(sender))continue;
    if(!allowed(sender)){await send(sock,jid,"⏳ TOHID-AGENT rate limit reached. Please try again in a minute.");continue;}
    const msg=m.message;
    let text=msg.conversation||msg.extendedTextMessage?.text||msg.imageMessage?.caption||"";
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
    const mode=router.route(text,cfg.prefix);

    if(mode==="maintenance_on"||mode==="maintenance_off"){
      if(!isOwner(sender)){await send(sock,jid,"⛔ Owner only.");continue;}
      maintenance=mode==="maintenance_on";await send(sock,jid,maintenance?"🛡️ Maintenance mode enabled.":"✅ Maintenance mode disabled.");continue;
    }
    if(maintenance&&!isOwner(sender)){await send(sock,jid,"🛡️ TOHID-AGENT is currently in maintenance mode.");continue;}
    if(mode==="block"||mode==="unblock"){
      if(!isOwner(sender)){await send(sock,jid,"⛔ Owner only.");continue;}
      const target=text.split(/\s+/)[1]?.replace(/\D/g,"");
      if(!target){await send(sock,jid,"Usage: "+cfg.prefix+mode+" <number>");continue;}
      await db.setBlocked(target+"@s.whatsapp.net",mode==="block");await send(sock,jid,(mode==="block"?"🚫 Blocked ":"✅ Unblocked ")+target);continue;
    }
    if(mode==="help"){await send(sock,jid,help());continue;}
    if(mode==="ping"){await send(sock,jid,"🏓 TOHID-AGENT V3: online\n👨‍💻 Developer: Tohid");continue;}
    if(mode==="status"){const s=await db.stats();await send(sock,jid,"⚡ *TOHID-AGENT V3*\nStatus: Online\nDeveloper: Tohid\nMemory DB: "+(s.database?"Connected":"Not configured")+"\nGitHub: "+(cfg.githubToken?"Configured":"Not configured")+"\nAI: "+(cfg.openaiKey?"Configured":"Not configured")+"\nBlocked users: "+(s.blocked??0));continue;}
    if(mode==="stats"){if(!isOwner(sender)){await send(sock,jid,"⛔ Owner only.");continue;}const s=await db.stats();await send(sock,jid,"📊 *TOHID-AGENT V3 STATS*\nUsers: "+(s.users??"N/A")+"\nBlocked: "+(s.blocked??0)+"\nChat: "+(s.usage?.chat??0)+"\nVoice: "+(s.usage?.voice??0)+"\nImages: "+(s.usage?.image??0)+"\nVideos: "+(s.usage?.video??0));continue;}
    if(mode==="memory"){const h=await db.getMemory(sender);await send(sock,jid,"🧠 Stored conversation messages: "+h.length+"\nUse "+cfg.prefix+"newchat to clear your AI memory.");continue;}
    if(mode==="reset"){await ai.clearMemory(sender);await send(sock,jid,"🧹 Your TOHID-AGENT conversation memory has been cleared.");continue;}
    if(mode==="video"){const prompt=text.slice((cfg.prefix+"video ").length).trim();if(!prompt){await send(sock,jid,"Usage: .video <prompt>");continue;}await send(sock,jid,"🎬 Generating video...");const vid=await ai.video(prompt);await db.track(sender,"video");await sock.sendMessage(jid,{video:{url:vid},caption:"🎬 TOHID-AGENT V3 • Tohid"});if(fs.existsSync(vid))fs.unlinkSync(vid);continue;}
    if(mode==="image"){const prompt=text.slice((cfg.prefix+"imagine ").length).trim();if(!prompt){await send(sock,jid,"Usage: .imagine <prompt>");continue;}await send(sock,jid,"🎨 Generating image...");const img=await ai.image(prompt);await db.track(sender,"image");await sock.sendMessage(jid,{image:{url:img},caption:"🎨 TOHID-AGENT V3 • Created by Tohid"});if(fs.existsSync(img))fs.unlinkSync(img);continue;}

    await sock.sendPresenceUpdate("composing",jid);
    const answer=await ai.ask(sender,text,{isOwner:isOwner(sender),imageData});
    if((cfg.voiceReply||inputWasVoice)&&answer){const out=path.join(TMP,"reply-"+Date.now()+".mp3");await ai.tts(answer,out);await sock.sendMessage(jid,{audio:{url:out},mimetype:"audio/mpeg",ptt:true});if(fs.existsSync(out))fs.unlinkSync(out);}
    else await send(sock,jid,answer,{mode:"ai",sourceText:text,imageData});
    if(audioPath&&fs.existsSync(audioPath))fs.unlinkSync(audioPath);
   }catch(e){console.error(e);try{await send(sock,m.key.remoteJid,"❌ TOHID-AGENT: "+(e.response?.data?.error?.message||e.message));}catch{}}
  }
 });
}
if(process.env.PORT)http.createServer((req,res)=>{res.writeHead(200,{"content-type":"application/json"});res.end(JSON.stringify({name:"TOHID-AGENT",version:"3.0.0",developer:"Tohid",status:"online"}));}).listen(process.env.PORT,"0.0.0.0",()=>console.log("🌐 TOHID-AGENT V3 health server on "+process.env.PORT));
main().catch(console.error);