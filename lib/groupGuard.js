const URL_RE=/(https?:\/\/|www\.)[^\s]+/i;
const COMMANDS=new Set(["antilink","antistatus","antibot","antitag","antitagall","antipdm","antibad","welcome","goodbye"]);

function normalize(jid){return String(jid||"").split(":")[0].replace(/\?.*$/,"");}
function participant(meta,jid){const n=normalize(jid);return (meta?.participants||[]).find(p=>normalize(p.id)===n||normalize(p.jid)===n||normalize(p.lid)===n||normalize(p.pn)===n);}
function isAdmin(meta,jid){const p=participant(meta,jid);return !!p&&(p.admin==="admin"||p.admin==="superadmin");}
function botJid(sock){return normalize(sock?.user?.id);}
function isBotAdmin(meta,sock){return isAdmin(meta,botJid(sock));}

function memberKeys(meta,jid){
  const p=participant(meta,jid);
  const values=[jid,p?.id,p?.jid,p?.lid,p?.pn,p?.phoneNumber];
  const keys=new Set();
  for(const value of values){
    const raw=String(value||"");
    if(!raw)continue;
    keys.add(normalize(raw));
    const digits=raw.split("@")[0].replace(/\D/g,"");
    if(digits)keys.add(digits);
  }
  return [...keys];
}
function isAllowed(meta,s,jid){
  const allowed=Array.isArray(s?.allowed)?s.allowed:[];
  if(!allowed.length)return false;
  const keys=new Set(memberKeys(meta,jid));
  return allowed.some(value=>keys.has(String(value)));
}
function resolveAllowedTarget(meta,msg,parts){
  const m=unwrap(msg?.message||msg||{});
  const c=contextInfo(m);
  const mentioned=mentions(m);
  let target=mentioned[0]||c.participant||null;
  if(!target){
    const token=(parts||[]).slice(2).find(x=>/\d{7,15}/.test(String(x)));
    if(token)target=String(token).replace(/\D/g,"");
  }
  if(!target)return null;
  const p=participant(meta,target);
  if(p){
    return normalize(p.id||p.jid||p.lid||p.pn||target);
  }
  const digits=String(target).replace(/\D/g,"");
  return digits||normalize(target);
}

function unwrap(message){
  if(!message||typeof message!=="object")return message||{};
  for(const key of ["ephemeralMessage","viewOnceMessage","viewOnceMessageV2","documentWithCaptionMessage","editedMessage"]){
    if(message[key]?.message)return unwrap(message[key].message);
  }
  return message;
}
function contextInfo(message){
  const m=unwrap(message);
  return m.extendedTextMessage?.contextInfo||m.imageMessage?.contextInfo||m.videoMessage?.contextInfo||m.documentMessage?.contextInfo||m.audioMessage?.contextInfo||m.stickerMessage?.contextInfo||m.interactiveMessage?.contextInfo||m.listMessage?.contextInfo||m.templateMessage?.contextInfo||m.contextInfo||{};
}
function mentions(message){
  const m=unwrap(message),c=contextInfo(m);
  return Array.from(new Set([...(c.mentionedJid||[]),...(m.extendedTextMessage?.contextInfo?.mentionedJid||[])]));
}
function hasStatusMention(message){
  const m=unwrap(message);
  const keys=Object.keys(m);
  return keys.some(k=>/status.?mention|group.?status.?mention/i.test(k))
    || JSON.stringify(m).toLowerCase().includes("statusmentionmessage");
}
function hasMentionAll(message,text,meta){
  const m=unwrap(message),c=contextInfo(m);
  if(c.mentionAll===true||m.mentionAll===true)return true;
  const lower=String(text||"").toLowerCase();
  if(/(^|\s)@(all|everyone|everyonehere|allmembers)(\s|$)/i.test(lower))return true;
  const ms=mentions(m);
  return ms.length>=Math.max(5,Math.ceil((meta?.participants?.length||0)*0.5));
}
const DEFAULT_BAD_WORDS=["fuck","fucking","motherfucker","shit","bitch","asshole","bastard","dick","pussy","slut","whore","chutiya","chutiye","chuti","madarchod","madharchod","bhenchod","behenchod","bc","mc","bhosdike","bhosdi","gandu","gaand","randi","harami","kamina","kamine","kutte","kutiya","lavde","laude","loda","lund","chut","bsdk","bkl","mkc","mkl"];
function normalizeBadText(value){return String(value||"").toLowerCase().normalize("NFKD").replace(/[\\u0300-\\u036f]/g,"").replace(/[@4]/g,"a").replace(/[0]/g,"o").replace(/[1!|]/g,"i").replace(/[$5]/g,"s").replace(/[3]/g,"e").replace(/[^a-z0-9\\u0900-\\u097f]+/g," ");}
function badWordHit(text,custom=[]){const normalized=normalizeBadText(text);const words=[...new Set([...DEFAULT_BAD_WORDS,...(Array.isArray(custom)?custom:[])].map(x=>normalizeBadText(x).trim()).filter(x=>x.length>=3))];for(const word of words){if(normalized.split(/\s+/).includes(word))return word;}return null;}
function actionFrom(value,defaultAction="delete"){
  const v=String(value||defaultAction).toLowerCase();
  return ["delete","warn","kick","off"].includes(v)?v:defaultAction;
}
function defaults(){
  return {
    antilink:{enabled:false,action:"delete",allowed:[]},
    antistatus:{enabled:false,action:"delete",allowed:[]},
    antibot:{enabled:false,action:"kick",numbers:[],allowed:[]},
    antitag:{enabled:false,action:"delete",allowed:[]},
    antitagall:{enabled:false,action:"kick",allowed:[]},
    antipdm:{enabled:false,allowed:[]},
    antibad:{enabled:false,action:"delete",words:[],allowed:[]},
    welcome:{enabled:false,messages:[]},
    goodbye:{enabled:false,messages:[]},
    warnings:{}
  };
}
async function settings(db,jid){
  const current=await db.getSettings(jid);
  return {...defaults(),...current,
    antilink:{...defaults().antilink,...(current.antilink||{}),allowed:Array.isArray(current.antilink?.allowed)?current.antilink.allowed:[]},
    antistatus:{...defaults().antistatus,...(current.antistatus||{}),allowed:Array.isArray(current.antistatus?.allowed)?current.antistatus.allowed:[]},
    antibot:{...defaults().antibot,...(current.antibot||{}),allowed:Array.isArray(current.antibot?.allowed)?current.antibot.allowed:[]},
    antitag:{...defaults().antitag,...(current.antitag||{}),allowed:Array.isArray(current.antitag?.allowed)?current.antitag.allowed:[]},
    antitagall:{...defaults().antitagall,...(current.antitagall||{}),allowed:Array.isArray(current.antitagall?.allowed)?current.antitagall.allowed:[]},
    antipdm:{...defaults().antipdm,...(current.antipdm||{}),allowed:Array.isArray(current.antipdm?.allowed)?current.antipdm.allowed:[]},
    antibad:{...defaults().antibad,...(current.antibad||{}),allowed:Array.isArray(current.antibad?.allowed)?current.antibad.allowed:[]},
    goodbye:{...defaults().goodbye,...(current.goodbye||{}),messages:Array.isArray(current.goodbye?.messages)?current.goodbye.messages:[]},
    welcome:{...defaults().welcome,...(current.welcome||{}),messages:Array.isArray(current.welcome?.messages)?current.welcome.messages:[]},
    warnings:current.warnings||{}
  };
}
async function save(db,jid,s){return db.setSettings(jid,s);}

async function warn(db,jid,target,reason){
  const s=await settings(db,jid);
  const warnings={...s.warnings,[target]:(Number(s.warnings?.[target])||0)+1};
  const count=warnings[target];
  await save(db,jid,{...s,warnings});
  return count;
}
async function clearWarning(db,jid,target){
  const s=await settings(db,jid);
  const warnings={...s.warnings};delete warnings[target];
  await save(db,jid,{...s,warnings});
}

async function enforce({sock,msg,jid,sender,reason,action,meta,db,send}){
  if(isAdmin(meta,sender))return false;
  if(isAllowed(meta,s[reason.startsWith("AntiLink")?"antilink":reason.startsWith("AntiStatus")?"antistatus":reason.startsWith("AntiTagAll")?"antitagall":reason.startsWith("AntiTag")?"antitag":reason.startsWith("AntiBot")?"antibot":"antibad"],sender))return false;
  if(!isBotAdmin(meta,sock)){
    await send(sock,jid,"⚠️ TOHID-AGENT detected "+reason+", but I am not a group admin so I cannot enforce the rule.",{category:"security"});
    return true;
  }
  const act=actionFrom(action);
  try{
    if(act==="delete")await sock.sendMessage(jid,{delete:msg.key});
    else if(act==="kick")await sock.sendMessage(jid,{delete:msg.key});
    else if(act==="warn"){
      const count=await warn(db,jid,sender,reason);
      if(count>=3){await sock.sendMessage(jid,{delete:msg.key});await sock.groupParticipantsUpdate(jid,[sender],"remove");await clearWarning(db,jid,sender);await send(sock,jid,"🚫 @"+String(sender).split("@")[0]+" removed after 3 warnings ("+reason+").",{mentions:[sender],category:"security"});}
      else await send(sock,jid,"⚠️ @"+String(sender).split("@")[0]+" warning "+count+"/3 — "+reason,{mentions:[sender],category:"security"});
    }
    if(act==="kick")await sock.groupParticipantsUpdate(jid,[sender],"remove");
  }catch(e){await send(sock,jid,"❌ "+reason+" action failed: "+e.message,{category:"error"});}
  return true;
}

async function handleCommand({sock,msg,jid,sender,text,db,send}){
  if(!jid.endsWith("@g.us"))return false;
  const parts=String(text||"").trim().split(/\s+/),raw=parts[0]||"";
  if(!raw.startsWith("."))return false;
  const name=raw.slice(1).toLowerCase();
  if(!COMMANDS.has(name))return false;
  let meta;try{meta=await sock.groupMetadata(jid);}catch(e){await send(sock,jid,"❌ Cannot read group metadata: "+e.message,{category:"error"});return true;}
  if(!isAdmin(meta,sender)){await send(sock,jid,"⛔ Only group admins can change anti settings.",{category:"security"});return true;}
  const sub=(parts[1]||"").toLowerCase();
  const action=["delete","warn","kick"].includes(sub)?sub:null;
  const s=await settings(db,jid);
  if((name==="welcome"||name==="goodbye")&&(sub==="on"||sub==="off")){
    s[name]={...s[name],enabled:sub==="on"};
    await save(db,jid,s);
    await send(sock,jid,"👋 "+name.toUpperCase()+": *"+(s[name].enabled?"ON":"OFF")+"*",{category:"utility"});
    return true;
  }
  if((name==="welcome"||name==="goodbye")&&["add","remove","list","clear"].includes(sub)){
    const rule=s[name];
    if(sub==="add"){
      const raw=parts.slice(2).join(" ").trim();
      const pieces=raw.split("|");
      const customText=String(pieces[0]||"").trim();
      const imageUrl=String(pieces.slice(1).join("|")||"").trim();
      if(!customText&&!imageUrl){
        await send(sock,jid,"Usage: ."+name+" add <custom text> | <image URL>",{category:"utility"});return true;
      }
      if(imageUrl&&!/^https?:\/\/\S+$/i.test(imageUrl)){
        await send(sock,jid,"❌ Image URL must start with http:// or https://.",{category:"utility"});return true;
      }
      rule.messages=[...(rule.messages||[]),{text:customText,image:imageUrl||null}];
      s[name]=rule;await save(db,jid,s);
      await send(sock,jid,"✅ Custom "+name+" message added. Total: "+rule.messages.length,{category:"utility"});return true;
    }
    if(sub==="remove"){
      const value=String(parts.slice(2).join(" ")||"").trim();
      const index=Number(value);
      if(!value){await send(sock,jid,"Usage: ."+name+" remove <number>",{category:"utility"});return true;}
      if(!Number.isInteger(index)||index<1||index>rule.messages.length){
        await send(sock,jid,"❌ Invalid message number. Use ."+name+" list first.",{category:"utility"});return true;
      }
      rule.messages=rule.messages.filter((_,i)=>i!==index-1);
      s[name]=rule;await save(db,jid,s);
      await send(sock,jid,"🗑️ Custom "+name+" message #"+index+" removed.",{category:"utility"});return true;
    }
    if(sub==="list"){
      const list=rule.messages||[];
      const body=list.length?list.map((x,i)=>((i+1)+". "+(x.text||"[image only]")+(x.image?"\n   🖼️ "+x.image:""))).join("\n\n"):"• No custom messages configured.";
      await send(sock,jid,"👋 *"+name.toUpperCase()+" CUSTOM MESSAGES*\n\n"+body+"\n\nUse: ."+name+" add <text> | <image URL>\nRemove: ."+name+" remove <number>",{category:"utility"});return true;
    }
    if(sub==="clear"){
      s[name]={...rule,messages:[]};await save(db,jid,s);
      await send(sock,jid,"🧹 All custom "+name+" messages cleared. The default message remains available.",{category:"utility"});return true;
    }
  }
  if((name==="welcome"||name==="goodbye")&&!sub){
    await send(sock,jid,"👋 *"+name.toUpperCase()+"*\nStatus: "+(s[name].enabled?"✅ ON":"❌ OFF")+"\n\nUse: ."+name+" on | ."+name+" off",{category:"utility"});
    return true;
  }
