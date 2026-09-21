const URL_RE=/(https?:\/\/|www\.)[^\s]+/i;
const COMMANDS=new Set(["antilink","antistatus","antibot","antitag","antitagall"]);

function normalize(jid){return String(jid||"").split(":")[0].replace(/\?.*$/,"");}
function participant(meta,jid){const n=normalize(jid);return (meta?.participants||[]).find(p=>normalize(p.id)===n||normalize(p.jid)===n||normalize(p.lid)===n||normalize(p.pn)===n);}
function isAdmin(meta,jid){const p=participant(meta,jid);return !!p&&(p.admin==="admin"||p.admin==="superadmin");}
function botJid(sock){return normalize(sock?.user?.id);}
function isBotAdmin(meta,sock){return isAdmin(meta,botJid(sock));}

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
function actionFrom(value,defaultAction="delete"){
  const v=String(value||defaultAction).toLowerCase();
  return ["delete","warn","kick","off"].includes(v)?v:defaultAction;
}
function defaults(){
  return {
    antilink:{enabled:false,action:"delete"},
    antistatus:{enabled:false,action:"delete"},
    antibot:{enabled:false,action:"kick",numbers:[]},
    antitag:{enabled:false,action:"delete"},
    antitagall:{enabled:false,action:"kick"},
    antipdm:{enabled:false},
    warnings:{}
  };
}
async function settings(db,jid){
  const current=await db.getSettings(jid);
  return {...defaults(),...current,
    antilink:{...defaults().antilink,...(current.antilink||{})},
    antistatus:{...defaults().antistatus,...(current.antistatus||{})},
    antibot:{...defaults().antibot,...(current.antibot||{})},
    antitag:{...defaults().antitag,...(current.antitag||{})},
    antitagall:{...defaults().antitagall,...(current.antitagall||{})},
    antipdm:{...defaults().antipdm,...(current.antipdm||{})},
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
  if(name==="antibot"&&["add","remove"].includes(sub)){
    const number=String(parts[2]||"").replace(/\D/g,"");
    if(number.length<10||number.length>15){await send(sock,jid,"Usage: .antibot add/remove <number>",{category:"utility"});return true;}
    const numbers=new Set((s.antibot.numbers||[]).map(String));
    if(sub==="add")numbers.add(number);else numbers.delete(number);
    s.antibot={...s.antibot,numbers:[...numbers]};
    await save(db,jid,s);await send(sock,jid,"✅ AntiBot numbers updated.\nConfigured: "+s.antibot.numbers.length,{category:"security"});return true;
  }
  if(name==="antibot"&&sub==="list"){await send(sock,jid,"🤖 AntiBot numbers:\n"+((s.antibot.numbers||[]).map(n=>"• "+n).join("\n")||"• None"),{category:"security"});return true;}
  if(name==="antibot"&&sub==="clear"){s.antibot.numbers=[];await save(db,jid,s);await send(sock,jid,"✅ AntiBot number list cleared.",{category:"security"});return true;}
  if(!sub){
    const x=s[name];
    await send(sock,jid,"🛡️ *"+name.toUpperCase()+"*\\nStatus: "+(x.enabled?"✅ ON":"❌ OFF")+"\\nMode: "+String(x.action||"delete").toUpperCase(),{category:"security"});
    return true;
  }
  if(sub==="on"||sub==="off"||action){
    const enabled=sub==="on"?true:sub==="off"?false:true;
    const mode=action||"delete";
    s[name]={...s[name],enabled,action:mode};
    await save(db,jid,s);
    await send(sock,jid,"✅ "+name+" mode: *"+(enabled?mode.toUpperCase():"OFF")+"*",{category:"security"});return true;
  }
  await send(sock,jid,"🛡️ *"+name.toUpperCase()+"*\n\nUse:\n• ."+name+" on\n• ."+name+" off\n• ."+name+" delete\n• ."+name+" warn\n• ."+name+" kick"+(name==="antibot"?"\n• .antibot add <number>\n• .antibot remove <number>\n• .antibot list":""),
    {category:"security"});
  return true;
}

async function handleParticipantUpdate({sock,id,participants,action,db,send,author,authorPn}){\n  if(!id?.endsWith("@g.us"))return false;\n  const s=await settings(db,id);\n  let meta;try{meta=await sock.groupMetadata(id);}catch{return false;}\n  let handled=false;\n  if(s.antipdm.enabled&&(action==="promote"||action==="demote")){\n    const actor=author||authorPn;\n    const bot=botJid(sock);\n    if(actor&&normalize(actor)!==normalize(bot)&&isAdmin(meta,actor)&&isBotAdmin(meta,sock)){\n      const targets=(participants||[]).filter(Boolean);\n      if(action==="promote"){\n        const demoteTargets=targets.filter(target=>normalize(target)!==normalize(bot)&&isAdmin(meta,target));\n        if(demoteTargets.length){try{await sock.groupParticipantsUpdate(id,demoteTargets,"demote");handled=true;}catch(e){await send(sock,id,"❌ AntiPDM could not demote the promoted member: "+e.message,{category:"error"});}}\n        if(isAdmin(meta,actor)){try{await sock.groupParticipantsUpdate(id,[actor],"demote");handled=true;await send(sock,id,"🛡️ AntiPDM: admin promotion blocked. Both the promoting admin and promoted member were removed from admin role.",{category:"security"});}catch(e){await send(sock,id,"❌ AntiPDM could not demote the promoting admin: "+e.message,{category:"error"});}}\n      }else{\n        try{await sock.groupParticipantsUpdate(id,[actor],"demote");handled=true;await send(sock,id,"🛡️ AntiPDM: admin-to-admin demotion blocked. The acting admin was demoted; the target remains admin.",{category:"security"});}catch(e){await send(sock,id,"❌ AntiPDM could not demote the acting admin: "+e.message,{category:"error"});}\n      }\n    }\n  }\n  if(action!=="add"||!s.antibot.enabled||(s.antibot.numbers||[]).length===0)return handled;\n  if(!isBotAdmin(meta,sock))return handled;\n  for(const target of participants||[]){\n    const raw=String(target);\n    const number=raw.split("@")[0].replace(/\\D/g,"");\n    const alt=String(meta.participants?.find(p=>normalize(p.id)===normalize(raw)||normalize(p.jid)===normalize(raw)||normalize(p.lid)===normalize(raw)||normalize(p.pn)===normalize(raw))?.phoneNumber||"").replace(/\\D/g,"");\n    if(!(s.antibot.numbers||[]).some(n=>String(n)===number||String(n)===alt))continue;\n    try{await sock.groupParticipantsUpdate(id,[target],"remove");await send(sock,id,"🚫 AntiBot: configured bot removed ("+(number||alt)+").",{category:"security"});handled=true;}catch(e){await send(sock,id,"❌ AntiBot could not remove "+(number||alt)+": "+e.message,{category:"error"});}\n  }\n  return handled;\n}\n\nasync function inspect({sock,msg,jid,sender,text,db,send}){
  if(!jid.endsWith("@g.us"))return false;
  const s=await settings(db,jid);
  const enabled=Object.values(s).some(v=>v&&typeof v==="object"&&v.enabled);
  if(!enabled)return false;
  let meta;try{meta=await sock.groupMetadata(jid);}catch{return false;}
  if(isAdmin(meta,sender))return false;
  if(s.antilink.enabled&&URL_RE.test(String(text||""))){
    return enforce({sock,msg,jid,sender,reason:"AntiLink: link detected",action:s.antilink.action,meta,db,send});
  }
  if(s.antistatus.enabled&&hasStatusMention(msg.message)){
    return enforce({sock,msg,jid,sender,reason:"AntiStatus: status mention detected",action:s.antistatus.action,meta,db,send});
  }
  if(s.antitagall.enabled&&hasMentionAll(msg.message,text,meta)){
    return enforce({sock,msg,jid,sender,reason:"AntiTagAll: mass mention detected",action:s.antitagall.action,meta,db,send});
  }
  if(s.antitag.enabled&&mentions(msg.message).length){
    return enforce({sock,msg,jid,sender,reason:"AntiTag: mention detected",action:s.antitag.action,meta,db,send});
  }
  if(s.antibot.enabled){
    const number=String(sender).split("@")[0].replace(/\D/g,"");
    if((s.antibot.numbers||[]).includes(number)){
      return enforce({sock,msg,jid,sender,reason:"AntiBot: configured bot detected",action:s.antibot.action,meta,db,send});
    }
  }
  return false;
}

module.exports={handleCommand,inspect,handleParticipantUpdate,settings,isAdmin,isBotAdmin};
