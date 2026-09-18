const fs=require("fs");
const path=require("path");
const qrcode=require("qrcode-terminal");
const pino=require("pino");
const {default:makeWASocket,useMultiFileAuthState,DisconnectReason,downloadContentFromMessage,fetchLatestBaileysVersion}=require("@whiskeysockets/baileys");
const cfg=require("./config");
const ai=require("./lib/openai");

const AUTH=path.join(process.cwd(),"auth_info_baileys");
const TMP=path.join(process.cwd(),"tmp");
if(!fs.existsSync(TMP))fs.mkdirSync(TMP,{recursive:true});

function isOwner(jid){
  return cfg.ownerNumber&&jid.split("@")[0].replace(/\\D/g,"")===cfg.ownerNumber;
}
async function downloadMedia(message,type){
  const stream=await downloadContentFromMessage(message,type);
  const chunks=[];
  for await(const c of stream)chunks.push(c);
  return Buffer.concat(chunks);
}
async function send(sock,jid,text){return sock.sendMessage(jid,{text});}

async function main(){
  if(!cfg.enabled)return console.log("TOHID AGENT is disabled.");
  const {state,saveCreds}=await useMultiFileAuthState(AUTH);
  const {version}=await fetchLatestBaileysVersion();
  const sock=makeWASocket({version,auth:state,logger:pino({level:"silent"}),printQRInTerminal:false,browser:["TOHID AGENT","Chrome","1.0.0"]});
  sock.ev.on("creds.update",saveCreds);
  sock.ev.on("connection.update",({connection,lastDisconnect,qr})=>{
    if(qr){console.log("\nScan the QR with WhatsApp:\n");qrcode.generate(qr,{small:true});}
    if(connection==="open")console.log("✅ TOHID AGENT WhatsApp connected.");
    if(connection==="close"){
      const code=lastDisconnect?.error?.output?.statusCode;
      if(code!==DisconnectReason.loggedOut)setTimeout(main,3000);
      else console.log("Logged out. Remove auth_info_baileys and pair again.");
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
        let inputWasVoice=false;
        let audioPath=null;

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
          fs.unlinkSync(img);
          continue;
        }

        await sock.sendPresenceUpdate("composing",jid);
        const answer=await ai.ask(sender,text,{isOwner:isOwner(sender)});

        if((cfg.voiceReply||inputWasVoice)&&answer){
          const out=path.join(TMP,"reply-"+Date.now()+".mp3");
          await ai.tts(answer,out);
          await sock.sendMessage(jid,{audio:{url:out},mimetype:"audio/mpeg",ptt:true});
          fs.unlinkSync(out);
        }else{
          await send(sock,jid,answer);
        }

        if(audioPath&&fs.existsSync(audioPath))fs.unlinkSync(audioPath);
      }catch(e){
        console.error(e);
        try{await send(sock,m.key.remoteJid,"❌ TOHID AGENT: "+e.message);}catch{}
      }
    }
  });
}
main().catch(console.error);
