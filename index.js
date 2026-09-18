const fs=require("fs");
const path=require("path");
const http=require("http");
const qrcode=require("qrcode-terminal");
const pino=require("pino");
const {MongoClient}=require("mongodb");
const {
  default:makeWASocket,
  useMultiFileAuthState,
  initAuthCreds,
  BufferJSON,
  DisconnectReason,
  downloadContentFromMessage,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore
}=require("@whiskeysockets/baileys");
const cfg=require("./config");
const ai=require("./lib/openai");

const AUTH=path.join(process.cwd(),"auth_info_baileys");
const TMP=path.join(process.cwd(),"tmp");
if(!fs.existsSync(TMP))fs.mkdirSync(TMP,{recursive:true});

function isOwner(jid){
  return cfg.ownerNumber&&jid.split("@")[0].replace(/\D/g,"")===cfg.ownerNumber;
}
async function downloadMedia(message,type){
  const stream=await downloadContentFromMessage(message,type);
  const chunks=[]; for await(const c of stream)chunks.push(c);
  return Buffer.concat(chunks);
}
async function send(sock,jid,text){return sock.sendMessage(jid,{text});}

async function mongoAuth(){
  const client=new MongoClient(cfg.mongoUri);
  await client.connect();
  const db=client.db(cfg.mongoDb);
  const col=db.collection("baileys_auth");
  const doc=await col.findOne({_id:"state"});
  const creds=doc?.creds?JSON.parse(doc.creds,BufferJSON.reviver):initAuthCreds();
  const keys=db.collection("baileys_keys");
  const keyStore={
    async get(type,ids){
      const out={};
      for(const id of ids){
        const d=await keys.findOne({_id:type+"-"+id});
        if(d) out[id]=JSON.parse(d.value,BufferJSON.reviver);
      }
      return out;
    },
    async set(data){
      const ops=[];
      for(const [type,entries] of Object.entries(data)){
        for(const [id,value] of Object.entries(entries)){
          const _id=type+"-"+id;
          if(value===null)ops.push({deleteOne:{filter:{_id}}});
          else ops.push({replaceOne:{filter:{_id},replacement:{_id,type,id,value:JSON.stringify(value,BufferJSON.replacer)},upsert:true}});
        }
      }
      if(ops.length)await keys.bulkWrite(ops,{ordered:false});
    }
  };
  const saveCreds=async()=>col.replaceOne({_id:"state"},{_id:"state",creds:JSON.stringify(creds,BufferJSON.replacer)},{upsert:true});
  return {state:{creds,keys:makeCacheableSignalKeyStore(keyStore,pino({level:"silent"}))},saveCreds,close:()=>client.close()};
}

async function main(){
  if(!cfg.enabled)return console.log("TOHID AGENT is disabled.");
  let auth,closeAuth=async()=>{};
  if(cfg.mongoUri){
    auth=await mongoAuth();
    closeAuth=auth.close;
    console.log("☁️ MongoDB auth storage enabled.");
  }else{
    const local=await useMultiFileAuthState(AUTH);
    auth=local;
    console.log("⚠️ Local auth storage enabled. Heroku restarts can lose the session.");
  }

  const {state,saveCreds}=auth;
  const {version}=await fetchLatestBaileysVersion();
  const sock=makeWASocket({
    version,auth,logger:pino({level:"silent"}),
    printQRInTerminal:false,
    browser:["TOHID AGENT","Chrome","1.0.0"]
  });
  sock.ev.on("creds.update",saveCreds);

  let pairingRequested=false;
  sock.ev.on("connection.update",async({connection,lastDisconnect,qr})=>{
    if(qr && cfg.loginMethod!=="pairing"){
      console.log("\n📱 Scan this QR with WhatsApp → Linked Devices:\n");
      qrcode.generate(qr,{small:true});
    }
    if(!state.creds.registered && cfg.loginMethod==="pairing" && cfg.pairingNumber && !pairingRequested){
      pairingRequested=true;
      try{
        await new Promise(r=>setTimeout(r,1200));
        const code=await sock.requestPairingCode(cfg.pairingNumber);
        console.log("\n🔐 WhatsApp pairing code: "+code+"\n");
        console.log("WhatsApp → Linked Devices → Link with phone number");
      }catch(e){console.error("Pairing code error:",e.message);}
    }
    if(connection==="open")console.log("✅ TOHID AGENT WhatsApp connected.");
    if(connection==="close"){
      const code=lastDisconnect?.error?.output?.statusCode;
      await closeAuth();
      if(code!==DisconnectReason.loggedOut)setTimeout(()=>main().catch(console.error),3000);
      else console.log("Logged out. Clear the MongoDB auth state or local auth folder and pair again.");
    }
  });

  sock.ev.on("messages.upsert",async({messages,type})=>{
    if(type!=="notify")return;
    for(const m of messages){
      try{
        if(!m.message||m.key.fromMe)continue;
        const jid=m.key.remoteJid;
        if(!jid||jid==="status@broadcast")continue;
        const sender=m.key.participant||jid;
        const msg=m.message;
        let text=msg.conversation||msg.extendedTextMessage?.text||"";
        let inputWasVoice=false,audioPath=null;
        if(msg.audioMessage){
          inputWasVoice=true;
          const buf=await downloadMedia(msg.audioMessage,"audio");
          audioPath=path.join(TMP,"voice-"+Date.now()+".ogg");
          fs.writeFileSync(audioPath,buf);
          text=await ai.transcribe(audioPath);
        }
        if(!text)continue;
        if(text.toLowerCase().startsWith(cfg.prefix+"imagine ")){
          const prompt=text.slice((cfg.prefix+"imagine ").length).trim();
          if(!prompt){await send(sock,jid,"Usage: .imagine <prompt>");continue;}
          await send(sock,jid,"🎨 Generating image...");
          const img=await ai.image(prompt);
          await sock.sendMessage(jid,{image:{url:img},caption:"TOHID AGENT"});
          if(fs.existsSync(img))fs.unlinkSync(img);
          continue;
        }
        await sock.sendPresenceUpdate("composing",jid);
        const answer=await ai.ask(sender,text,{isOwner:isOwner(sender)});
        if((cfg.voiceReply||inputWasVoice)&&answer){
          const out=path.join(TMP,"reply-"+Date.now()+".mp3");
          await ai.tts(answer,out);
          await sock.sendMessage(jid,{audio:{url:out},mimetype:"audio/mpeg",ptt:true});
          if(fs.existsSync(out))fs.unlinkSync(out);
        }else await send(sock,jid,answer);
        if(audioPath&&fs.existsSync(audioPath))fs.unlinkSync(audioPath);
      }catch(e){
        console.error(e);
        try{await send(sock,m.key.remoteJid,"❌ TOHID AGENT: "+e.message);}catch{}
      }
    }
  });
}
if(process.env.PORT){
  http.createServer((req,res)=>{res.writeHead(200,{"content-type":"text/plain"});res.end("TOHID AGENT is running.\n");}).listen(process.env.PORT,"0.0.0.0",()=>console.log("🌐 Health server on "+process.env.PORT));
}
main().catch(console.error);
