const fs=require("fs");
const path=require("path");
const http=require("http");
const qrcode=require("qrcode-terminal");
const pino=require("pino");
const {MongoClient}=require("mongodb");
const {default:makeWASocket,useMultiFileAuthState,initAuthCreds,BufferJSON,DisconnectReason,downloadContentFromMessage,fetchLatestBaileysVersion,makeCacheableSignalKeyStore,Browsers}=require("@whiskeysockets/baileys");
const cfg=require("./config");
const planner=require("./lib/agentPlanner");
const ai=require("./lib/openai");
const db=require("./lib/database");
const router=require("./lib/router");
const replyImages=require("./lib/replyImages");
const menu=require("./lib/menu");

const AUTH=path.join(process.cwd(),"auth_info_baileys");
const TMP=path.join(process.cwd(),"tmp");
if(!fs.existsSync(TMP))fs.mkdirSync(TMP,{recursive:true});
const rate=new Map();
let maintenance=false;

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

function promo(){return "📢 *TOHID TECH*\n"+cfg.channelLink;}\nfunction withPromo(text){const s=String(text||"");return s.includes(cfg.channelLink)?s:s+"\\n\\n"+promo();}\nfunction help(){
return "🤖 *TOHID-AGENT V7.3*\n\n"+
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
 console.log("📦 Baileys version: "+version.join("."));
 const sock=makeWASocket({version,auth:state,logger:pino({level:"silent"}),printQRInTerminal:false,browser:Browsers.ubuntu("Chrome"),markOnlineOnConnect:false,syncFullHistory:false,connectTimeoutMs:60000});
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
    console.log("✅ TOHID-AGENT V7.3 connected. Developer: Tohid");
    console.log("📡 WhatsApp message listener is active.");
  }
  if(connection==="close"){
    const code=lastDisconnect?.error?.output?.statusCode;
    const message=lastDisconnect?.error?.message||"";
    console.error("❌ WhatsApp connection closed. code="+code+" message="+message);
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
      setTimeout(()=>main().catch(console.error),3000);
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
    console.log("📨 Incoming WhatsApp message from "+sender+" in "+jid+": "+String(text||"[media]").slice(0,120));
    if(text.trim().toLowerCase()===cfg.prefix+"ping"){
      try{
        await sock.sendMessage(jid,{text:withPromo("🏓 TOHID-AGENT V7.3: online\\n👨‍💻 Developer: Tohid")});
        console.log("📤 .ping reply sent to "+jid);
      }catch(pingError){
        console.error("❌ .ping send failed:",pingError?.stack||pingError?.message||pingError);
      }
      continue;
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
    if(mode==="help"){await send(sock,jid,help(),{category:"ai"});continue;}
    if(mode==="ping"){await send(sock,jid,"🏓 TOHID-AGENT V7.3: online\n👨‍💻 Developer: Tohid");continue;}
    if(mode==="status"){const s=await db.stats();await send(sock,jid,"⚡ *TOHID-AGENT V7.3*\nStatus: Online\nDeveloper: Tohid\nAI: "+(cfg.openaiKey&&cfg.geminiKey?"OpenAI → Gemini fallback":cfg.openaiKey?"OpenAI":cfg.geminiKey?"Gemini":"Not configured")+"\nMemory DB: "+(s.database?"Connected":"Not configured")+"\nGitHub: "+(cfg.githubToken?"Configured":"Not configured")+"\nBlocked users: "+(s.blocked??0));continue;}
    if(mode==="doctor"){const checks=[["OpenAI",!!cfg.openaiKey],["Gemini",!!cfg.geminiKey],["MongoDB",!!cfg.mongoUri],["GitHub",!!cfg.githubToken],["Pairing",!!cfg.pairingNumber]];await send(sock,jid,"🩺 *TOHID-AGENT V7.3 DOCTOR*\n\n"+checks.map(x=>(x[1]?"✅ ":"❌ ")+x[0]).join("\n")+"\n\nNode: "+process.version+"\nTool loop: "+cfg.toolLoopLimit+"\nMemory limit: "+cfg.maxMemoryMessages);continue;}\n    if(mode==="tools"){await send(sock,jid,"🧰 *V7 TOOLS*\n• GitHub agent\n• Calculator\n• System diagnostics\n• Current time\n• Web search (when enabled)\n• Vision\n• Voice STT/TTS\n• Image generation\n• Video generation\n• Memory + profiles\n• Autonomous planner + verified tool execution");continue;}\n    if(mode==="plan"){const request=text.slice((cfg.prefix+"plan").length).trim();const p=planner.plan(request);await send(sock,jid,"🧭 *TOHID-AGENT V7.3 PLAN*\n\n"+JSON.stringify(p,null,2),{category:"utility"});continue;}
    if(mode==="provider"){await send(sock,jid,"🔌 *AI PROVIDERS*\nMode: "+cfg.aiProvider+"\nOpenAI: "+(cfg.openaiKey?"ready":"not configured")+"\nGemini: "+(cfg.geminiKey?"ready":"not configured")+"\nHeroku: "+(cfg.herokuToken?"configured":"not configured")+"\nFallback: "+(cfg.openaiKey&&cfg.geminiKey?"enabled":"single provider"));continue;}\n    if(mode==="stats"){if(!isOwner(sender)){await send(sock,jid,"⛔ Owner only.");continue;}const s=await db.stats();await send(sock,jid,"📊 *TOHID-AGENT V7.3 STATS*\nUsers: "+(s.users??"N/A")+"\nBlocked: "+(s.blocked??0)+"\nChat: "+(s.usage?.chat??0)+"\nVoice: "+(s.usage?.voice??0)+"\nImages: "+(s.usage?.image??0)+"\nVideos: "+(s.usage?.video??0));continue;}
    if(mode==="memory"){const h=await db.getMemory(sender);await send(sock,jid,"🧠 Stored conversation messages: "+h.length+"\nUse "+cfg.prefix+"newchat to clear your AI memory.");continue;}
    if(mode==="profile"){
      const parts=text.trim().split(/\s+/);
      if(parts.length===1){const p=await db.getProfile(sender);await send(sock,jid,"👤 *TOHID-AGENT V7.3 PROFILE*\\nName: "+(p.name||"Not set")+"\\nBio: "+(p.bio||"Not set")+"\\nLanguage: "+(p.language||"Auto")+"\\n\\nSet: .profile name <name>\\n.profile bio <text>\\n.profile language <language>");continue;}
      const key=parts[1]?.toLowerCase();const value=parts.slice(2).join(" ").trim();
      if(!["name","bio","language"].includes(key)||!value){await send(sock,jid,"Usage: .profile name <name> | .profile bio <text> | .profile language <language>",{category:"utility"});continue;}
      await db.setProfile(sender,{[key]:value});await send(sock,jid,"✅ Profile "+key+" updated.");continue;
    }
    if(mode==="reset"){await ai.clearMemory(sender);await send(sock,jid,"🧹 Your TOHID-AGENT conversation memory has been cleared.",{category:"memory"});continue;}
    if(mode==="menu"){await menu.sendMenu(sock,jid,"main");continue;}
    if(mode==="settings"){const parts=text.trim().split(/\s+/);const key=parts[0].replace(cfg.prefix,"").toLowerCase();const value=parts[1]?.toLowerCase();if(!value){await send(sock,jid,"⚙️ *TOHID-AGENT V7.3 SETTINGS*\n\n🎙️ Voice: use .voice on/off\n🧠 Memory: use .memory on/off\n📊 Status: .status\n\nUse .menu to view the text menu.");continue;}if((key==="voice"||key==="memory")&&["on","off"].includes(value)){await db.setSettings(sender,{[key]:value==="on"});if(key==="memory"&&value==="off")await db.clearMemory(sender);await send(sock,jid,(key==="voice"?"🎙️ Voice reply ":"🧠 Memory ")+(value==="on"?"enabled":"disabled")+".",{category:key==="voice"?"voice":"memory"});continue;}await send(sock,jid,"Use .voice on/off or .memory on/off",{category:"admin"});continue;}
    if(mode==="video"){const prompt=text.slice((cfg.prefix+"video ").length).trim();if(!prompt){await send(sock,jid,"Usage: .video <prompt>");continue;}await send(sock,jid,"🎬 Generating video...",{category:"video"});const vid=await ai.video(prompt);await db.track(sender,"video");await sock.sendMessage(jid,{video:{url:vid},caption:withPromo("🎬 TOHID-AGENT V7.3 • Tohid")});if(fs.existsSync(vid))fs.unlinkSync(vid);continue;}
    if(mode==="image"){const prompt=text.slice((cfg.prefix+"imagine ").length).trim();if(!prompt){await send(sock,jid,"Usage: .imagine <prompt>");continue;}await send(sock,jid,"🎨 Generating image...",{category:"image"});const img=await ai.image(prompt);await db.track(sender,"image");await sock.sendMessage(jid,{image:{url:img},caption:withPromo("🎨 TOHID-AGENT V7.3 • Created by Tohid")});if(fs.existsSync(img))fs.unlinkSync(img);continue;}

    await sock.sendPresenceUpdate("composing",jid);
    const answer=await ai.ask(sender,text,{isOwner:isOwner(sender),imageData});
    const userSettings=await db.getSettings(sender);const voiceReply=userSettings.voice===true||(userSettings.voice===undefined&&cfg.voiceReply);if((voiceReply||inputWasVoice)&&answer){const out=path.join(TMP,"reply-"+Date.now()+".mp3");await ai.tts(answer,out);await sock.sendMessage(jid,{audio:{url:out},mimetype:"audio/mpeg",ptt:true});await send(sock,jid,promo(),{category:"utility"});if(fs.existsSync(out))fs.unlinkSync(out);}
    else await send(sock,jid,answer,{mode:"ai",sourceText:text,imageData});
    if(audioPath&&fs.existsSync(audioPath))fs.unlinkSync(audioPath);
   }catch(e){console.error(e);try{await send(sock,m.key.remoteJid,"❌ TOHID-AGENT: "+(e.response?.data?.error?.message||e.message),{category:"error"});}catch{}}
  }
 });
}
if(process.env.PORT)http.createServer(async(req,res)=>{if(req.url==="/admin-ui"){res.writeHead(200,{"content-type":"text/html; charset=utf-8"});return res.end(fs.readFileSync(path.join(process.cwd(),"public/admin.html"),"utf8"));}
  if(req.url==="/admin"&&cfg.adminPanelEnabled){
    const token=req.headers["x-admin-token"]||"";
    if(!cfg.adminPanelToken||token!==cfg.adminPanelToken){res.writeHead(401,{"content-type":"application/json"});return res.end(JSON.stringify({error:"Unauthorized"}));}
    const s=await db.stats();res.writeHead(200,{"content-type":"application/json"});return res.end(JSON.stringify({name:"TOHID-AGENT",version:"7.2.0",developer:"Tohid",status:"online",database:s.database,stats:s},null,2));
  }
  res.writeHead(200,{"content-type":"application/json"});res.end(JSON.stringify({name:"TOHID-AGENT",version:"7.2.0",developer:"Tohid",status:"online"}));
}).listen(process.env.PORT,"0.0.0.0",()=>console.log("🌐 TOHID-AGENT V7.3 health server on "+process.env.PORT));
main().catch(console.error);
