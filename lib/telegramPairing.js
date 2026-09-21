const TelegramBot=require("node-telegram-bot-api");
const QRCode=require("qrcode");

let bot=null;
const hits=new Map();
const WINDOW=10*60*1000;
const MAX=5;
function allowed(chatId){
  const key=String(chatId),now=Date.now(),a=(hits.get(key)||[]).filter(x=>now-x<WINDOW);
  if(a.length>=MAX)return false;
  a.push(now);hits.set(key,a);return true;
}
function phone(v){return String(v||"").replace(/\D/g,"");}
async function waitForSession(id,manager,mode,chatId){
  const started=Date.now();let lastCode="",lastQr="";
  while(Date.now()-started<Number(process.env.PAIRING_TIMEOUT_MS||180000)){
    await new Promise(r=>setTimeout(r,800));
    const s=manager.get(id);if(!s)break;
    if(s.code&&s.code!==lastCode){
      lastCode=s.code;
      await bot.sendMessage(chatId,"🔐 TOHID-AGENT WhatsApp Pairing Code\n\n"+s.code+"\n\nWhatsApp → Settings → Linked Devices → Link with phone number → enter this code.");
    }
    if(mode==="qr"&&s.qr&&s.qr!==lastQr){
      lastQr=s.qr;
      try{
        const buf=await QRCode.toBuffer(s.qr,{errorCorrectionLevel:"M",margin:1,width:600});
        await bot.sendPhoto(chatId,buf,{caption:"📱 Scan this QR with WhatsApp → Linked Devices."});
      }catch(e){await bot.sendMessage(chatId,"❌ QR generation failed: "+e.message);}
    }
    if(s.connected){await bot.sendMessage(chatId,"✅ WhatsApp connected successfully.\nSession: "+s.id);return;}
    if(["stopped","stopping"].includes(s.status)){await bot.sendMessage(chatId,"❌ Pairing session stopped or expired.");return;}
  }
}
function start(manager,token){
  if(!token||process.env.TOHID_PAIRING_CHILD==="1")return null;
  if(bot)return bot;
  bot=new TelegramBot(token,{polling:true});
  bot.onText(/^\/(start|help)$/i,async msg=>{
    await bot.sendMessage(msg.chat.id,"🤖 TOHID-AGENT Pairing Bot\n\n/pair 919876543210 — WhatsApp 8-digit pairing code\n/qr 919876543210 — WhatsApp QR pairing\n/status — active pairing sessions\n/stop SESSION_ID — stop a session");
  });
  bot.onText(/^\/pair(?:\s+(.+))?$/i,async msg=>{
    const chatId=msg.chat.id;if(!allowed(chatId))return bot.sendMessage(chatId,"⏳ Too many pairing requests. Try again later.");
    const number=phone(msg.matches?.[1]);
    if(number.length<10||number.length>15)return bot.sendMessage(chatId,"Usage: /pair 919876543210");
    try{
      const s=manager.create({phone:number,mode:"pairing"});
      await bot.sendMessage(chatId,"⏳ Pairing session started. Waiting for WhatsApp code…\nSession: "+s.id);
      waitForSession(s.id,manager,"pairing",chatId).catch(e=>bot.sendMessage(chatId,"❌ Pairing error: "+e.message));
    }catch(e){await bot.sendMessage(chatId,"❌ "+e.message);}
  });
  bot.onText(/^\/qr(?:\s+(.+))?$/i,async msg=>{
    const chatId=msg.chat.id;if(!allowed(chatId))return bot.sendMessage(chatId,"⏳ Too many pairing requests. Try again later.");
    const number=phone(msg.matches?.[1]);
    if(number.length<10||number.length>15)return bot.sendMessage(chatId,"Usage: /qr 919876543210");
    try{
      const s=manager.create({phone:number,mode:"qr"});
      await bot.sendMessage(chatId,"⏳ QR session started. Waiting for QR…\nSession: "+s.id);
      waitForSession(s.id,manager,"qr",chatId).catch(e=>bot.sendMessage(chatId,"❌ QR error: "+e.message));
    }catch(e){await bot.sendMessage(chatId,"❌ "+e.message);}
  });
  bot.onText(/^\/status$/i,async msg=>{
    const s=manager.list();
    if(!s.length)return bot.sendMessage(msg.chat.id,"No pairing sessions.");
    await bot.sendMessage(msg.chat.id,s.map(x=>"• "+x.id+" | "+x.phone+" | "+x.mode+" | "+x.status).join("\n"));
  });
  bot.onText(/^\/stop(?:\s+(.+))?$/i,async msg=>{
    const id=String(msg.matches?.[1]||"").trim();
    if(!id)return bot.sendMessage(msg.chat.id,"Usage: /stop SESSION_ID");
    const ok=await manager.stop(id);
    await bot.sendMessage(msg.chat.id,ok?"✅ Session stopped.":"❌ Session not found.");
  });
  bot.on("polling_error",e=>console.error("Telegram polling error:",e?.message||e));
  console.log("🤖 Telegram pairing bot is active.");
  return bot;
}
async function stop(){if(!bot)return;try{await bot.stopPolling();}catch{}bot=null;}
module.exports={start,stop};
