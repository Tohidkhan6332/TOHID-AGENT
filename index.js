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
 const category=replyImages.getCategory({category:ctx.category,mode:ctx.mode,text:ctx.sourceText||text,imageData:!!ctx.imageData});
 const image=replyImages.getImage(category);
 if(image){
  const caption="🤖 TOHID-AGENT V5 • "+category.toUpperCase()+" • By Tohid";
  await sock.sendMessage(jid,{image:{url:image},caption});
 }
 return sock.sendMessage(jid,{text});
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

function help(){
return "🤖 *TOHID-AGENT V5*\n\n"+
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
 const sock=makeWASocket({version,auth:state,logger:pino({level:"silent"}),printQRInTerminal:false,browser:["TOHID-AGENT","Chrome","4.0.0"]});
 sock.ev.on("creds.update",saveCreds);
 let pairingRequested=false;
 sock.ev.on("connection.update",async({connection,lastDisconnect,qr})=>{
  if(qr&&cfg.loginMethod!=="pairing"){console.log("\n📱 Scan QR with WhatsApp → Linked Devices:\n");qrcode.generate(qr,{small:true});}
  if(!state.creds.registered&&cfg.loginMethod==="pairing"&&cfg.pairingNumber&&!pairingRequested){pairingRequested=true;try{await new Promise(r=>setTimeout(r,1200));console.log("\n🔐 Pairing code: "+await sock.requestPairingCode(cfg.pairingNumber));}catch(e){console.error("Pairing error:",e.message);}}
  if(connection==="open")console.log("✅ TOHID-AGENT V5 connected. Developer: Tohid");
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
    if(!allowed(sender)){await send(sock,jid,"⏳ TOHID-AGENT rate limit reached. Please try again in a minute.",{category:"security"});continue;}
    const msg=m.message;
    let text=msg.conversation||msg.extendedTextMessage?.text||msg.imageMessage?.caption||"";
    const selectedButton=menu.buttonId(msg);
    if(selectedButton)text=selectedButton;
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
      if(!isOwner(sender)){await send(sock,jid,"⛔ Owner only.",{category:"admin"});continue;}
      maintenance=mode==="maintenance_on";await send(sock,jid,maintenance?"🛡️ Maintenance mode enabled.":"✅ Maintenance mode disabled.",{category:"admin"});continue;
    }
    if(maintenance&&!isOwner(sender)){await send(sock,jid,"🛡️ TOHID-AGENT is currently in maintenance mode.",{category:"admin"});continue;}
    if(selectedButton){
      const s=await db.getSettings(sender);
      const useButtons=s.uiMode!=="text";
      if(selectedButton==="menu_back"){await menu.sendMenu(sock,jid,"main");continue;}
      if(selectedButton==="menu_ai"){await send(sock,jid,"🤖 AI Chat is ready. Send your message and TOHID-AGENT will reply.",{category:"ai"});continue;}
      if(selectedButton==="menu_image"){await send(sock,jid,"🖼️ Image generation ready. Use .imagine <prompt>",{category:"image"});continue;}
      if(selectedButton==="menu_video"){await send(sock,jid,"🎬 Video generation ready. Use .video <prompt>",{category:"video"});continue;}
      if(selectedButton==="menu_voice"){await menu.sendMenu(sock,jid,"settings",{text:"🎤 *Voice Settings*\\nChoose voice reply preference:"});continue;}
      if(selectedButton==="menu_memory"){await send(sock,jid,"🧠 Memory is controlled from Settings. Choose ON/OFF there.",{category:"memory"});await menu.sendMenu(sock,jid,"settings",{text:"🧠 *Memory Settings*"});continue;}
      if(selectedButton==="menu_github"){await menu.sendMenu(sock,jid,"github",{text:"💻 *GitHub Agent*\\nChoose an action. Write actions still require CONFIRM."});continue;}
      if(selectedButton==="menu_admin"){if(!isOwner(sender)){await send(sock,jid,"⛔ Owner only.",{category:"admin"});continue;}await menu.sendMenu(sock,jid,"settings",{text:"🛡️ *Admin / Settings*\nOwner controls are protected."});continue;}
      if(selectedButton==="settings_status"){const s=await db.getSettings(sender);await send(sock,jid,"📱 UI mode: "+(s.uiMode==="text"?"TEXT":"BUTTONS")+"\n🎙️ Voice: "+(s.voice===false?"OFF":s.voice===true?"ON":cfg.voiceReply?"ON (global)":"OFF")+"\n🧠 Memory: "+(s.memory===false?"OFF":"ON"));continue;}
      if(selectedButton==="menu_stats"){if(!isOwner(sender)){await send(sock,jid,"⛔ Owner only.",{category:"admin"});continue;}const st=await db.stats();await send(sock,jid,"📊 *TOHID-AGENT V5 STATS*\\nUsers: "+(st.users??"N/A")+"\\nBlocked: "+(st.blocked??0)+"\\nChat: "+(st.usage?.chat??0)+"\\nVoice: "+(st.usage?.voice??0)+"\\nImages: "+(st.usage?.image??0)+"\\nVideos: "+(st.usage?.video??0),{category:"stats"});continue;}
      if(selectedButton==="menu_settings"){await menu.sendMenu(sock,jid,"settings",{text:"⚙️ *TOHID-AGENT V5 SETTINGS*\\nUI: "+(useButtons?"BUTTONS":"TEXT")+"\\nVoice: "+(s.voice===true?"ON":s.voice===false?"OFF":cfg.voiceReply?"ON (global)":"OFF")+"\\nMemory: "+(s.memory===false?"OFF":"ON")});continue;}
      if(selectedButton==="settings_voice_on"||selectedButton==="settings_voice_off"){const on=selectedButton.endsWith("_on");await db.setSettings(sender,{voice:on});await send(sock,jid,"🎙️ Voice reply "+(on?"enabled":"disabled")+".",{category:"voice"});await menu.sendMenu(sock,jid,"settings");continue;}
      if(selectedButton==="settings_memory_on"||selectedButton==="settings_memory_off"){const on=selectedButton.endsWith("_on");await db.setSettings(sender,{memory:on});if(!on)await db.clearMemory(sender);await send(sock,jid,"🧠 Memory "+(on?"enabled":"disabled")+".",{category:"memory"});await menu.sendMenu(sock,jid,"settings");continue;}
      if(selectedButton==="settings_buttons"||selectedButton==="settings_text"){const buttons=selectedButton.endsWith("_buttons");await db.setSettings(sender,{uiMode:buttons?"buttons":"text"});await db.audit(sender,"ui_mode_changed",{uiMode:buttons?"buttons":"text"});if(buttons)await menu.sendMenu(sock,jid,"main",{text:"🔘 Button mode enabled. All menus will use buttons when supported."});else await send(sock,jid,"📝 Text mode enabled. Use .menu and text commands instead of buttons.");continue;}
      if(selectedButton.startsWith("github_")){const map={github_repos:".github list repos",github_search:".github search <query>",github_read:".github read <repo> <path>",github_branch:".github branch <repo> <branch>",github_issue:".github issue <repo> <title>",github_pr:".github pr <repo> <branch> <title>"};await send(sock,jid,"💻 GitHub action selected. "+(map[selectedButton]||"Use natural-language GitHub commands.")+"\\n\\n🔐 Any write action requires CONFIRM.",{category:"github"});continue;}
    }
    if(mode==="block"||mode==="unblock"){
      if(!isOwner(sender)){await send(sock,jid,"⛔ Owner only.");continue;}
      const target=text.split(/\s+/)[1]?.replace(/\D/g,"");
      if(!target){await send(sock,jid,"Usage: "+cfg.prefix+mode+" <number>",{category:"admin"});continue;}
      await db.setBlocked(target+"@s.whatsapp.net",mode==="block");await send(sock,jid,(mode==="block"?"🚫 Blocked ":"✅ Unblocked ")+target,{category:"security"});continue;
    }
    if(mode==="help"){await send(sock,jid,help(),{category:"ai"});continue;}
    if(mode==="ping"){await send(sock,jid,"🏓 TOHID-AGENT V5: online\n👨‍💻 Developer: Tohid");continue;}
    if(mode==="status"){const s=await db.stats();await send(sock,jid,"⚡ *TOHID-AGENT V5*\nStatus: Online\nDeveloper: Tohid\nMemory DB: "+(s.database?"Connected":"Not configured")+"\nGitHub: "+(cfg.githubToken?"Configured":"Not configured")+"\nAI: "+(cfg.openaiKey?"Configured":"Not configured")+"\nBlocked users: "+(s.blocked??0));continue;}
    if(mode==="stats"){if(!isOwner(sender)){await send(sock,jid,"⛔ Owner only.");continue;}const s=await db.stats();await send(sock,jid,"📊 *TOHID-AGENT V5 STATS*\nUsers: "+(s.users??"N/A")+"\nBlocked: "+(s.blocked??0)+"\nChat: "+(s.usage?.chat??0)+"\nVoice: "+(s.usage?.voice??0)+"\nImages: "+(s.usage?.image??0)+"\nVideos: "+(s.usage?.video??0));continue;}
    if(mode==="memory"){const h=await db.getMemory(sender);await send(sock,jid,"🧠 Stored conversation messages: "+h.length+"\nUse "+cfg.prefix+"newchat to clear your AI memory.");continue;}
    if(mode==="reset"){await ai.clearMemory(sender);await send(sock,jid,"🧹 Your TOHID-AGENT conversation memory has been cleared.",{category:"memory"});continue;}
    if(mode==="menu"){const s=await db.getSettings(sender);if(s.uiMode==="text")await send(sock,jid,"🤖 *TOHID-AGENT V5 TEXT MENU*\\n\\n1. 🤖 AI Chat\\n2. 🖼️ Generate Image\\n3. 🎬 Generate Video\\n4. 🎤 Voice\\n5. 🧠 Memory\\n6. 💻 GitHub\\n7. 📊 Stats\\n8. ⚙️ Settings\\n\\nUse commands: .imagine, .video, .voice on/off, .memory on/off, .settings");else await menu.sendMenu(sock,jid,"main");continue;}
    if(mode==="settings"){const parts=text.trim().split(/\\s+/);const key=parts[0].replace(cfg.prefix,"").toLowerCase();const value=parts[1]?.toLowerCase();if(!value){const s=await db.getSettings(sender);if(s.uiMode==="text"){await send(sock,jid,"⚙️ *SETTINGS*\\nUI mode: TEXT\\nVoice: "+(s.voice===true?"ON":s.voice===false?"OFF":cfg.voiceReply?"ON (global)":"OFF")+"\\nMemory: "+(s.memory===false?"OFF":"ON")+"\\n\\nUse: .mode buttons | .mode text\\n.voice on/off\\n.memory on/off");}else await menu.sendMenu(sock,jid,"settings",{text:"⚙️ *TOHID-AGENT V5 SETTINGS*"});continue;}if((key==="voice"||key==="memory")&&["on","off"].includes(value)){await db.setSettings(sender,{[key]:value==="on"});if(key==="memory"&&value==="off")await db.clearMemory(sender);await send(sock,jid,(key==="voice"?"🎙️ Voice reply ":"🧠 Memory ")+(value==="on"?"enabled":"disabled")+".",{category:key==="voice"?"voice":"memory"});continue;}if(key==="mode"||key==="ui"){if(["buttons","button"].includes(value)){await db.setSettings(sender,{uiMode:"buttons"});await menu.sendMenu(sock,jid,"main",{text:"🔘 Button mode enabled."});}else if(value==="text"){await db.setSettings(sender,{uiMode:"text"});await send(sock,jid,"📝 Text mode enabled. Use .menu for the text menu.");}else await send(sock,jid,"Use .mode buttons or .mode text");continue;}await send(sock,jid,"Use .mode buttons/.mode text, .voice on/off, or .memory on/off",{category:"admin"});continue;}
    if(mode==="video"){const prompt=text.slice((cfg.prefix+"video ").length).trim();if(!prompt){await send(sock,jid,"Usage: .video <prompt>");continue;}await send(sock,jid,"🎬 Generating video...",{category:"video"});const vid=await ai.video(prompt);await db.track(sender,"video");await sock.sendMessage(jid,{video:{url:vid},caption:"🎬 TOHID-AGENT V5 • Tohid"});if(fs.existsSync(vid))fs.unlinkSync(vid);continue;}
    if(mode==="image"){const prompt=text.slice((cfg.prefix+"imagine ").length).trim();if(!prompt){await send(sock,jid,"Usage: .imagine <prompt>");continue;}await send(sock,jid,"🎨 Generating image...",{category:"image"});const img=await ai.image(prompt);await db.track(sender,"image");await sock.sendMessage(jid,{image:{url:img},caption:"🎨 TOHID-AGENT V5 • Created by Tohid"});if(fs.existsSync(img))fs.unlinkSync(img);continue;}

    await sock.sendPresenceUpdate("composing",jid);
    const answer=await ai.ask(sender,text,{isOwner:isOwner(sender),imageData});
    const userSettings=await db.getSettings(sender);const voiceReply=userSettings.voice===true||(userSettings.voice===undefined&&cfg.voiceReply);if((voiceReply||inputWasVoice)&&answer){const out=path.join(TMP,"reply-"+Date.now()+".mp3");await ai.tts(answer,out);await send(sock,jid,"🎙️ TOHID-AGENT voice reply",{category:"voice"});await sock.sendMessage(jid,{audio:{url:out},mimetype:"audio/mpeg",ptt:true});if(fs.existsSync(out))fs.unlinkSync(out);}
    else await send(sock,jid,answer,{mode:"ai",sourceText:text,imageData});
    if(audioPath&&fs.existsSync(audioPath))fs.unlinkSync(audioPath);
   }catch(e){console.error(e);try{await send(sock,m.key.remoteJid,"❌ TOHID-AGENT: "+(e.response?.data?.error?.message||e.message),{category:"error"});}catch{}}
  }
 });
}
if(process.env.PORT)http.createServer(async(req,res)=>{if(req.url==="/admin"&&cfg.adminPanelEnabled){const s=await db.stats();res.writeHead(200,{"content-type":"application/json"});return res.end(JSON.stringify({name:"TOHID-AGENT",version:"5.0.0",developer:"Tohid",status:"online",database:s.database,stats:s},null,2));}res.writeHead(200,{"content-type":"application/json"});res.end(JSON.stringify({name:"TOHID-AGENT",version:"5.0.0",developer:"Tohid",status:"online"}));}).listen(process.env.PORT,"0.0.0.0",()=>console.log("🌐 TOHID-AGENT V5 health server on "+process.env.PORT));
main().catch(console.error);