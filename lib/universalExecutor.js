const registry=require("./universalCommandRegistry");
const groupGuard=require("./groupGuard");
const providers=require("./apiProviders");

function digits(v){return String(v||"").replace(/\D/g,"");}
function targetJid(v){const n=digits(v);return n?n+"@s.whatsapp.net":null;}
function textArg(args){return (args||[]).join(" ").trim();}
const MEDIA_COMMANDS=new Set(["play","song","video","ytmp3","ytmp4","facebook","instagram","tiktok","twitter","pinterest","spotify","mediafire"]);
function firstUrl(args){return (args||[]).find(x=>/^https?:\/\//i.test(String(x)))||null;}
function firstText(args){return textArg(args);}

function formatApkResults(data,query){
  const rows=[];
  const walk=(v)=>{
    if(!v)return;
    if(Array.isArray(v)){for(const x of v)walk(x);return;}
    if(typeof v!=="object")return;
    const name=v.name||v.title||v.appName||v.app_name;
    const version=v.version||v.ver;
    const url=v.download||v.downloadUrl||v.download_url||v.url||v.link;
    if(name||url){
      rows.push({name:name||"APK",version:version||"",url:url||""});
    }
    for(const key of ["results","apps","items","data"]){if(v[key]&&v[key]!==v)walk(v[key]);}
  };
  walk(data);
  const unique=[];const seen=new Set();
  for(const row of rows){
    const key=(row.name+"|"+row.version+"|"+row.url).toLowerCase();
    if(!seen.has(key)){seen.add(key);unique.push(row);}
  }
  if(!unique.length)return "📱 *APK SEARCH*\n\nQuery: "+query+"\n\n"+JSON.stringify(data,null,2).slice(0,7000);
  return "📱 *APK SEARCH: "+query+"*\n\n"+unique.slice(0,10).map((x,i)=>(i+1)+". *"+x.name+"*"+(x.version?" — "+x.version:"")+(x.url?"\n🔗 "+x.url:"")).join("\n\n");
}

async function execute({command,args=[],sock,jid,sender,isOwner,hasPermission}){
  const name=command.name;
  if(name==="apk"){
    const query=firstText(args);
    if(!query)return {handled:true,text:"📱 *APK SEARCH*\n\nUsage: .apk <app name>\nExample: .apk WhatsApp"};
    try{
      const result=await providers.searchApk(query);
      return {handled:true,text:formatApkResults(result.data,query)};
    }catch(error){
      return {handled:true,text:"❌ *APK search failed:* "+String(error.message||error)};
    }
  }
  if(MEDIA_COMMANDS.has(name)){
    const input=firstUrl(args);
    if(!input)return {handled:true,text:"📥 *"+name+"* ready.\n\nUsage: ."+name+" <media URL>\n\nProvider routing is configured in lib/apiProviders.js."};
    try{
      const result=await providers.downloadMedia(name,input);
      if(result.type==="url")return {handled:true,text:"✅ Download ready:\n"+result.url};
      const isAudio=/audio\//i.test(result.mime);
      const isVideo=/video\//i.test(result.mime);
      const isImage=/image\//i.test(result.mime);
      const documentName=name+"-"+Date.now()+(isAudio?".mp3":isVideo?".mp4":isImage?".jpg":".bin");
      const payload=isAudio?{audio:result.buffer,mimetype:result.mime}:{document:result.buffer,mimetype:result.mime,fileName:documentName};
      return {handled:true,sendMessage:payload};
    }catch(error){
      return {handled:true,text:"❌ *"+name+"* failed: "+String(error.message||error)};
    }
  }
  const missing=registry.missingEnv(command);
  if(missing.length)return {handled:true,text:"🧩 *"+name+"* is registered.\n\n🔑 Missing integration/API key:\n• "+missing.join("\n• ")+"\n\nAdd it to .env when ready."};

  if(["bold","italic","reverse","base64","font"].includes(name)){
    const input=textArg(args);if(!input)return {handled:true,text:"Usage: ."+name+" <text>"};
    if(name==="reverse")return {handled:true,text:[...input].reverse().join("")};
    if(name==="bold")return {handled:true,text:"*"+input+"*"};
    if(name==="italic")return {handled:true,text:"_"+input+"_"};
    if(name==="base64")return {handled:true,text:"Base64: "+Buffer.from(input).toString("base64")};
    return {handled:true,text:input};
  }
  if(["joke","quote","fact","truth","dare","8ball"].includes(name)){
    const answers={joke:"😂 Why did the developer go broke? Because he used up all his cache.",quote:"Build systems that are understandable before making them clever.",fact:"A WhatsApp group can have different moderation policy layers without needing a second socket.",truth:"Truth: What is one project you want to finish this week?",dare:"Dare: Refactor one messy function today.","8ball":"🎱 Ask a yes/no question."};
    return {handled:true,text:answers[name]};
  }
  if(["quiz","trivia"].includes(name))return {handled:true,text:"🎮 Quiz command is registered. The existing TOHID quiz engine can be connected to this universal route."};
  if(["kick","add","promote","demote","tagall","hidetag","groupinfo","admins","link","revoke","setname","setdesc"].includes(name)){
    if(!jid.endsWith("@g.us"))return {handled:true,text:"❌ This command only works in a group."};
    if(!await groupGuard.isAdmin({sock,jid,sender}))return {handled:true,text:"❌ Group admin permission required."};
    if(!await hasPermission(sender,"group.admin"))return {handled:true,text:"❌ You do not have group.admin permission."};
    if(name==="groupinfo"){const meta=await sock.groupMetadata(jid);return {handled:true,text:"👥 *GROUP INFO*\n\nName: "+meta.subject+"\nMembers: "+(meta.participants||[]).length+"\nAdmins: "+(meta.participants||[]).filter(x=>x.admin).length};}
    if(name==="admins"){const meta=await sock.groupMetadata(jid);const admins=(meta.participants||[]).filter(x=>x.admin).map(x=>"• "+x.id).join("\n");return {handled:true,text:"👑 *GROUP ADMINS*\n\n"+(admins||"None")};}
    if(name==="link"){const code=await sock.groupInviteCode(jid);return {handled:true,text:"🔗 https://chat.whatsapp.com/"+code};}
    if(name==="revoke"){const code=await sock.groupRevokeInvite(jid);return {handled:true,text:"♻️ Invite link revoked.\n\nNew link: https://chat.whatsapp.com/"+code};}
    if(name==="setname"){const value=textArg(args);if(!value)return {handled:true,text:"Usage: .setname <name>"};await sock.groupUpdateSubject(jid,value);return {handled:true,text:"✅ Group name updated."};}
    if(name==="setdesc"){const value=textArg(args);if(!value)return {handled:true,text:"Usage: .setdesc <description>"};await sock.groupUpdateDescription(jid,value);return {handled:true,text:"✅ Group description updated."};}
    if(name==="tagall"||name==="hidetag"){const meta=await sock.groupMetadata(jid);const mentions=(meta.participants||[]).map(x=>x.id);const body=name==="hidetag"?(textArg(args)||"📢 Attention everyone"):"📢 "+mentions.map(x=>"@"+x.split("@")[0]).join(" ");return {handled:true,sendMessage:{text:body,mentions}};}
    const target=String(args[0]||"").replace(/^@/,"");const targetJ=targetJid(target);if(!targetJ)return {handled:true,text:"Usage: ."+name+" @member"};const action=name==="kick"?"remove":name;await sock.groupParticipantsUpdate(jid,[targetJ],action);return {handled:true,text:"✅ "+name+" completed for "+targetJ.split("@")[0]+"."};
  }
  if(["restart","update","broadcast","listusers","listgroups","blockuser","unblockuser"].includes(name)){
    if(!isOwner(sender))return {handled:true,text:"❌ Owner permission required."};
    if(name==="restart")return {handled:true,text:"🔄 Restart requested. Use PM2/hosting to restart the bot safely."};
    if(name==="update")return {handled:true,text:"🔄 Update command is registered; use the existing GitHub/plugin update workflow with CONFIRM."};
    return {handled:true,text:"🛡️ "+name+" is registered and owner-protected; its provider-specific executor is ready to be connected."};
  }
  return {handled:true,text:"🧩 *"+name+"* is registered and awaiting its provider-specific executor."};
}
module.exports={execute};
