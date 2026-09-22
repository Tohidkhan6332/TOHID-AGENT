const URL_RE=/(https?:\/\/|www\.)[^\s]+|\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|dev|app|xyz|in|co|me|ly)(?:\/[^\s]*)?/i;
const policy=require("./groupPolicyEngine");
const COMMANDS=new Set(["antilink","antistatus","antigroupstatus","antibot","antitag","antitagall","antipdm","antibad","welcome","goodbye","security","warn","warnings","resetwarn","warnlimit","modlog","group","lock","unlock","groupstats","member"]);
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
    warnings:current.warnings||{},
    security:policy.state(current).security
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
      if(count>=(Number(s.security?.warningLimit)||3)){await sock.sendMessage(jid,{delete:msg.key});await sock.groupParticipantsUpdate(jid,[sender],"remove");await clearWarning(db,jid,sender);await send(sock,jid,"🚫 @"+String(sender).split("@")[0]+" removed after "+(Number(s.security?.warningLimit)||3)+" warnings ("+reason+").",{mentions:[sender],category:"security"});}
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
  let name=raw.slice(1).toLowerCase();
  if(!COMMANDS.has(name))return false;
  let meta;try{meta=await sock.groupMetadata(jid);}catch(e){await send(sock,jid,"❌ Cannot read group metadata: "+e.message,{category:"error"});return true;}
  if(!isAdmin(meta,sender)){await send(sock,jid,"⛔ Only group admins can change anti settings.",{category:"security"});return true;}
  const sub=(parts[1]||"").toLowerCase();
  const action=["delete","warn","kick"].includes(sub)?sub:null;
  const s=await settings(db,jid);
  const ruleName=name;
  name=ruleName;
  if(name==="security"){
    if(sub==="status"){
      const st=policy.state(s);
      await send(sock,jid,"🛡️ *GROUP SECURITY STATUS*\n\nPreset: "+st.security.preset+"\nWarning limit: "+st.security.warningLimit+"\nLocks: "+(st.security.locks.map(x=>x.name).join(", ")||"none")+"\nModlog: "+st.security.modlog.length+" events\nReputation: "+Object.keys(st.security.reputation||{}).length+" members",{category:"security"}); return true;
    }
    if(["strict","normal","relaxed","off"].includes(sub)){const next=policy.applyPreset(s,sub);await save(db,jid,next);await send(sock,jid,"🛡️ Group security preset: *"+sub.toUpperCase()+"*",{category:"security"});return true;}
    await send(sock,jid,"Usage: .security status | strict | normal | relaxed | off",{category:"security"}); return true;
  }
  if(name==="warnlimit"){
    const n=Number(parts[1]); if(!Number.isInteger(n)||n<1||n>20){await send(sock,jid,"Usage: .warnlimit <1-20>",{category:"security"});return true;}
    s.security=policy.state(s).security; s.security.warningLimit=n; await save(db,jid,s);
    await send(sock,jid,"✅ Warning limit set to *"+n+"*. ",{category:"security"}); return true;
  }
  if(["warn","warnings","resetwarn"].includes(name)){
    const target=resolveAllowedTarget(meta,msg,parts); if(!target){await send(sock,jid,"Usage: ."+name+" <number/@mention/reply>",{category:"security"});return true;}
    if(name==="warn"){const count=await warn(db,jid,target,"Manual warning");s.warnings=(await settings(db,jid)).warnings;s=policy.addReputation(s,target,-1,"warning");s=policy.addModLog(s,{type:"warning",actor:sender,target,reason:"manual warning",count});await save(db,jid,s);await send(sock,jid,"⚠️ @"+String(target).split("@")[0]+" warning: *"+count+"/"+(Number(s.security?.warningLimit)||3)+"*",{mentions:[target],category:"security"});return true;}
    if(name==="warnings"){const count=Number(s.warnings?.[target])||0;const rep=s.security?.reputation?.[target]?.score||0;await send(sock,jid,"⚠️ Warnings: *"+count+"/"+(Number(s.security?.warningLimit)||3)+"*\n⭐ Reputation: *"+rep+"*",{category:"security"});return true;}
    delete s.warnings[target];s=policy.addModLog(s,{type:"warning_reset",actor:sender,target});await save(db,jid,s);await send(sock,jid,"✅ Warnings reset for @"+String(target).split("@")[0],{mentions:[target],category:"security"});return true;
  }
  if(name==="modlog"){
    const log=(s.security?.modlog||[]).slice(-15);
    await send(sock,jid,"📜 *GROUP MODLOG*\n\n"+(log.map((x,i)=>(i+1)+". "+x.type+" • "+(x.target||"-")+" • "+x.time).join("\n")||"• No moderation events yet."),{category:"security"});return true;
  }
  if(name==="groupstats"){
    const p=meta.participants||[],admins=p.filter(x=>x.admin==="admin"||x.admin==="superadmin").length,warns=Object.values(s.warnings||{}).reduce((a,b)=>a+Number(b||0),0);
    await send(sock,jid,"📊 *GROUP STATS*\n\nMembers: "+p.length+"\nAdmins: "+admins+"\nWarnings: "+warns+"\nModlog: "+(s.security?.modlog?.length||0)+"\nLocks: "+(s.security?.locks?.map(x=>x.name).join(", ")||"none"),{category:"security"});return true;
  }
  if(name==="member"){
    const target=resolveAllowedTarget(meta,msg,parts);if(!target){await send(sock,jid,"Usage: .member <number/@mention/reply>",{category:"security"});return true;}
    const rep=s.security?.reputation?.[target]||{score:0,actions:0},wc=Number(s.warnings?.[target])||0;
    await send(sock,jid,"👤 *MEMBER PROFILE*\n\nMember: @"+String(target).split("@")[0]+"\nWarnings: "+wc+"\nReputation: "+(rep.score||0)+"\nModeration actions: "+(rep.actions||0),{mentions:[target],category:"security"});return true;
  }
  if(name==="lock"||name==="unlock"){
    const lock=String(parts[1]||"").toLowerCase(),minutes=Number(parts[2])||0;
    if(!policy.LOCKS.includes(lock)){await send(sock,jid,"Usage: ."+name+" links|media|stickers|forwards|newmembers|all [minutes]",{category:"security"});return true;}
    s=policy.setLock(s,lock,name==="lock",minutes);await save(db,jid,s);await send(sock,jid,"🔒 "+lock+" lock: *"+(name==="lock"?"ON":"OFF")+(minutes?" for "+minutes+"m":"")+"*",{category:"security"});return true;
  }
  if(name==="group"){
    if(sub==="backup"){s=policy.backup(s,"manual");await save(db,jid,s);await send(sock,jid,"💾 Group policy backup created.",{category:"security"});return true;}
    if(sub==="backups"){const list=s.security?.backups||[];await send(sock,jid,"💾 *GROUP BACKUPS*\n\n"+(list.map(x=>x.id+" • "+x.label+" • "+x.time).join("\n")||"• None"),{category:"security"});return true;}
    if(sub==="restore"){const next=policy.restoreBackup(s,parts[2]);if(!next){await send(sock,jid,"❌ Backup not found. Use .group backups",{category:"security"});return true;}await save(db,jid,next);await send(sock,jid,"♻️ Group policy restored from backup.",{category:"security"});return true;}
    const st=policy.state(s);await send(sock,jid,"🛡️ *GROUP CONTROL CENTER*\n\nSecurity: "+st.security.preset+"\nLocks: "+(st.security.locks.map(x=>x.name).join(", ")||"none")+"\nWarnings: "+Object.keys(s.warnings||{}).length+" members\nBackups: "+st.security.backups.length+"\nModlog: "+st.security.modlog.length,{category:"security"});return true;
  }
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
      if(!customText&&!imageUrl){await send(sock,jid,"Usage: ."+name+" add <custom text> | <image URL>",{category:"utility"});return true;}
      if(imageUrl&&!/^https?:\/\/\S+$/i.test(imageUrl)){await send(sock,jid,"❌ Image URL must start with http:// or https://.",{category:"utility"});return true;}
      rule.messages=[...(rule.messages||[]),{text:customText,image:imageUrl||null}];
      s[name]=rule;await save(db,jid,s);
      await send(sock,jid,"✅ Custom "+name+" message added. Total: "+rule.messages.length,{category:"utility"});return true;
    }
    if(sub==="remove"){
      const rawRemove=String(parts.slice(2).join(" ")||"").trim();
      const index=Number(rawRemove);
      let removedIndex=-1;
      if(Number.isInteger(index)&&index>=1&&index<=rule.messages.length)removedIndex=index-1;
      else{
        const pieces=rawRemove.split("|");
        const removeText=String(pieces[0]||"").trim();
        const removeImage=String(pieces.slice(1).join("|")||"").trim();
        removedIndex=rule.messages.findIndex(x=>String(x?.text||"").trim()===removeText&&String(x?.image||"").trim()===removeImage);
      }
      if(removedIndex<0){await send(sock,jid,"❌ Custom message not found. Use ."+name+" list or ."+name+" remove <number>. You can also use: ."+name+" remove <text> | <image URL>",{category:"utility"});return true;}
      rule.messages=rule.messages.filter((_,i)=>i!==removedIndex);
      s[name]=rule;await save(db,jid,s);
      await send(sock,jid,"🗑️ Custom "+name+" message removed.",{category:"utility"});return true;
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
  // Every protection rule supports the same WhatsApp-native member allowlist.
  // Target may be supplied as a number, @mention, or by replying to that member's message.
  if(["allow","disallow","unallow","removeallow","allowed"].includes(sub)){
    const target=resolveAllowedTarget(meta,msg,parts);
    if(sub==="allowed"){
      const list=Array.isArray(s[name]?.allowed)?s[name].allowed:[];
      await send(sock,jid,"🛡️ *"+name.toUpperCase()+" ALLOWED MEMBERS*\\n\\n"+(list.map((x,i)=>"• "+x).join("\\n")||"• None"),{category:"security"});
      return true;
    }
    if(!target){
      await send(sock,jid,"Usage: ."+name+" allow <number/@mention>\\nOr reply to a member's message with: ."+name+" allow",{category:"utility"});
      return true;
    }
    const list=new Set((s[name]?.allowed||[]).map(String));
    if(sub==="allow")list.add(target);else list.delete(target);
    s[name]={...s[name],allowed:[...list]};
    await save(db,jid,s);
    await send(sock,jid,(sub==="allow"?"✅ Allowed":"✅ Removed from allowed list")+" for "+name.toUpperCase()+": "+target,{category:"security"});
    return true;
  }
  if(name==="antibad"&&["add","remove"].includes(sub)){
    const word=String(parts.slice(2).join(" ")||"").trim().toLowerCase();
    const normalized=normalizeBadText(word).trim();
    if(!normalized||normalized.length<3){await send(sock,jid,"Usage: .antibad add/remove <word>",{category:"utility"});return true;}
    const words=new Set((s.antibad.words||[]).map(x=>normalizeBadText(x).trim()).filter(Boolean));
    if(sub==="add")words.add(normalized);else words.delete(normalized);
    s.antibad={...s.antibad,words:[...words]};
    await save(db,jid,s);
    await send(sock,jid,(sub==="add"?"✅ Added to":"✅ Removed from")+" AntiBad custom word list: "+normalized,{category:"security"});return true;
  }
  if(name==="antibad"&&sub==="list"){
    const custom=(s.antibad.words||[]).map(x=>String(x)).filter(Boolean);
    const effective=[...new Set([...DEFAULT_BAD_WORDS,...custom].map(x=>normalizeBadText(x).trim()).filter(x=>x.length>=3))];
    await send(sock,jid,"🚫 *AntiBad word list*\n\n"+(effective.map((x,i)=>(i+1)+". "+x).join("\n")||"• None")+"\n\nCustom words: "+custom.length+" | Default words: "+DEFAULT_BAD_WORDS.length,{category:"security"});return true;
  }
  if(name==="antibad"&&sub==="clear"){
    s.antibad={...s.antibad,words:[]};
    await save(db,jid,s);
    await send(sock,jid,"✅ AntiBad custom word list cleared. Default AntiBad words are still active.",{category:"security"});return true;
  }
  if(name==="antibot"&&["add","remove"].includes(sub)){
    const number=String(parts[2]||"").replace(/\D/g,"");
    if(number.length<10||number.length>15){await send(sock,jid,"Usage: .antibot add/remove <number>",{category:"utility"});return true;}
    const numbers=new Set((s.antibot.numbers||[]).map(String));
    if(sub==="add")numbers.add(number);else numbers.delete(number);
    s.antibot={...s.antibot,numbers:[...numbers]};
    await save(db,jid,s);await send(sock,jid,"✅ AntiBot numbers updated.\nConfigured: "+s.antibot.numbers.length,{category:"security"});return true;
  }
  if(name==="antipdm"&&(sub==="on"||sub==="off")){
    s.antipdm={...s.antipdm,enabled:sub==="on"};
    await save(db,jid,s);
    await send(sock,jid,"🛡️ AntiPDM: *"+(s.antipdm.enabled?"ON":"OFF")+"*\n\nPromote rule: promoting admin + promoted member lose admin role.\nDemote rule: acting admin loses admin role; target admin stays admin.",{category:"security"});
    return true;
  }
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

async function handleParticipantUpdate({sock,id,participants,action,db,send,author,authorPn}){
  if(!id?.endsWith("@g.us"))return false;
  const s=await settings(db,id);
  let meta;try{meta=await sock.groupMetadata(id);}catch{return false;}
  let handled=false;

  if((action==="add"&&s.welcome.enabled)||(action==="remove"&&s.goodbye.enabled)){
    const targets=(participants||[]).filter(Boolean);
    if(targets.length){
      const mentions=targets.map(normalize);
      const rule=action==="add"?s.welcome:s.goodbye;
      const custom=(rule.messages||[]).filter(x=>x&&typeof x==="object");
      const selected=custom.length?custom[Math.floor(Math.random()*custom.length)]:null;
      const defaultBody=action==="add"?"🎉 *WELCOME TO THE GROUP!*\n\nWelcome "+mentions.map(x=>"@"+String(x).split("@")[0]).join(", ")+"! 🎊\nWe are happy to have you here.":"👋 *GOODBYE!*\n\n"+mentions.map(x=>"@"+String(x).split("@")[0]).join(", ")+" left the group. Take care!";
      try{
        const customText=selected?.text?String(selected.text).replace(/@member/gi,mentions.map(x=>"@"+String(x).split("@")[0]).join(", ")):null;
        if(selected?.image)await sock.sendMessage(id,{image:{url:selected.image},caption:customText||defaultBody,mentions});
        else await send(sock,id,customText||defaultBody,{mentions,category:"utility"});
        handled=true;
      }catch(e){await send(sock,id,"❌ Welcome/Goodbye message failed: "+e.message,{category:"error"});}
    }
  }

  // AntiPDM: protect admin promotion/demotion changes.
  if(s.antipdm.enabled&&(action==="promote"||action==="demote")){
    const actor=author||authorPn;
    const bot=botJid(sock);
    if(actor&&normalize(actor)!==normalize(bot)&&!isAllowed(meta,s.antipdm,actor)&&isAdmin(meta,actor)&&isBotAdmin(meta,sock)){
      const targets=(participants||[]).filter(Boolean);
      if(action==="promote"){
        const demoteTargets=targets.filter(target=>normalize(target)!==normalize(bot)&&isAdmin(meta,target));
        if(demoteTargets.length){
          try{await sock.groupParticipantsUpdate(id,demoteTargets,"demote");handled=true;}
          catch(e){await send(sock,id,"❌ AntiPDM could not demote the promoted member: "+e.message,{category:"error"});}
        }
        if(isAdmin(meta,actor)){
          try{
            await sock.groupParticipantsUpdate(id,[actor],"demote");
            handled=true;
            await send(sock,id,"🛡️ AntiPDM: admin promotion blocked. Both the promoting admin and promoted member were removed from admin role.",{category:"security"});
          }catch(e){await send(sock,id,"❌ AntiPDM could not demote the promoting admin: "+e.message,{category:"error"});}
        }
      }else{
        try{
          await sock.groupParticipantsUpdate(id,[actor],"demote");
          handled=true;
          await send(sock,id,"🛡️ AntiPDM: admin-to-admin demotion blocked. The acting admin was demoted; the target remains admin.",{category:"security"});
        }catch(e){await send(sock,id,"❌ AntiPDM could not demote the acting admin: "+e.message,{category:"error"});}
      }
    }
  }

  // Keep the existing configured-number AntiBot join protection.
  if(action!=="add"||!s.antibot.enabled||(s.antibot.numbers||[]).length===0)return handled;
  if(!isBotAdmin(meta,sock))return handled;
  for(const target of participants||[]){
    const raw=String(target);
    const number=raw.split("@")[0].replace(/\D/g,"");
    const alt=String(meta.participants?.find(p=>normalize(p.id)===normalize(raw)||normalize(p.jid)===normalize(raw)||normalize(p.lid)===normalize(raw)||normalize(p.pn)===normalize(raw))?.phoneNumber||"").replace(/\D/g,"");
    if(isAllowed(meta,s.antibot,target))continue;
    if(!(s.antibot.numbers||[]).some(n=>String(n)===number||String(n)===alt))continue;
    try{
      await sock.groupParticipantsUpdate(id,[target],"remove");
      await send(sock,id,"🚫 AntiBot: configured bot removed ("+(number||alt)+").",{category:"security"});
      handled=true;
    }catch(e){await send(sock,id,"❌ AntiBot could not remove "+(number||alt)+": "+e.message,{category:"error"});}
  }
  return handled;
}

async function inspect({sock,msg,jid,sender,text,db,send}){
  if(!jid.endsWith("@g.us"))return false;
  const s=await settings(db,jid);
  const enabled=Object.values(s).some(v=>v&&typeof v==="object"&&v.enabled);
  if(!enabled)return false;
  let meta;try{meta=await sock.groupMetadata(jid);}catch{return false;}
  if(isAdmin(meta,sender))return false;
  if(policy.isLocked(s,"links")&&!isAdmin(meta,sender)&&URL_RE.test(String(text||"")))return enforce({sock,msg,jid,sender,reason:"Lock: links are disabled",action:"delete",meta,db,send});\n  if(policy.isLocked(s,"media")&&!isAdmin(meta,sender)&&/imageMessage|videoMessage|documentMessage|audioMessage/i.test(JSON.stringify(unwrap(msg.message))))return enforce({sock,msg,jid,sender,reason:"Lock: media is disabled",action:"delete",meta,db,send});\n  if(policy.isLocked(s,"stickers")&&!isAdmin(meta,sender)&&/stickerMessage/i.test(JSON.stringify(unwrap(msg.message))))return enforce({sock,msg,jid,sender,reason:"Lock: stickers are disabled",action:"delete",meta,db,send});\n  if(policy.isLocked(s,"forwards")&&!isAdmin(meta,sender)&&contextInfo(msg.message).isForwarded)return enforce({sock,msg,jid,sender,reason:"Lock: forwards are disabled",action:"delete",meta,db,send});\n  if(policy.effectiveRule(s,"antibad").enabled&&!isAllowed(meta,s.antibad,sender)){const hit=badWordHit(text,s.antibad.words);if(hit)return enforce({sock,msg,jid,sender,reason:"AntiBad: inappropriate word detected",action:s.antibad.action,meta,db,send});}
  if(s.antilink.enabled&&!isAllowed(meta,s.antilink,sender)&&URL_RE.test(String(text||""))){
    return enforce({sock,msg,jid,sender,reason:"AntiLink: link detected",action:s.antilink.action,meta,db,send});
  }
  if(s.antistatus.enabled&&!isAllowed(meta,s.antistatus,sender)&&hasStatusMention(msg.message)){
    return enforce({sock,msg,jid,sender,reason:"AntiStatus: status mention detected",action:s.antistatus.action,meta,db,send});
  }
  if(s.antitagall.enabled&&!isAllowed(meta,s.antitagall,sender)&&hasMentionAll(msg.message,text,meta)){
    return enforce({sock,msg,jid,sender,reason:"AntiTagAll: mass mention detected",action:s.antitagall.action,meta,db,send});
  }
  if(s.antitag.enabled&&!isAllowed(meta,s.antitag,sender)&&mentions(msg.message).length){
    return enforce({sock,msg,jid,sender,reason:"AntiTag: mention detected",action:s.antitag.action,meta,db,send});
  }
  if(policy.effectiveRule(s,"antibot").enabled&&!isAllowed(meta,s.antibot,sender)){
    const number=String(sender).split("@")[0].replace(/\D/g,"");
    if((s.antibot.numbers||[]).includes(number)){
      return enforce({sock,msg,jid,sender,reason:"AntiBot: configured bot detected",action:s.antibot.action,meta,db,send});
    }
  }
  return false;
}

module.exports={handleCommand,inspect,handleParticipantUpdate,settings,isAdmin,isBotAdmin};
