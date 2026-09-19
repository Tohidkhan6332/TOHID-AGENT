const FOOTER="TOHID-AGENT V6 • By Tohid";
const {proto,generateWAMessageFromContent}=require("@whiskeysockets/baileys");
const MENUS={
 main:[["menu_ai","🤖 AI Chat"],["menu_image","🖼️ Generate Image"],["menu_video","🎬 Generate Video"],["menu_voice","🎤 Voice"],["menu_memory","🧠 Memory"],["menu_github","💻 GitHub"],["menu_stats","📊 Stats"],["menu_admin","🛡️ Admin"],["menu_settings","⚙️ Settings"]],
 settings:[["settings_voice_on","🎙️ Voice ON"],["settings_voice_off","🔇 Voice OFF"],["settings_memory_on","🧠 Memory ON"],["settings_memory_off","🧹 Memory OFF"],["settings_buttons","🔘 Use Buttons"],["settings_text","📝 Use Text"],["settings_status","📱 UI Status"],["menu_back","⬅️ Back"]],
 github:[["github_repos","📁 Repositories"],["github_search","🔎 Search"],["github_read","📄 Read File"],["github_branch","🌿 Create Branch"],["github_issue","🐛 Create Issue"],["github_pr","🔀 Create PR"],["menu_back","⬅️ Back"]]
};
async function sendMenu(sock,jid,kind="main",options={}){
 const rows=MENUS[kind]||MENUS.main;
 const text=options.text||"🤖 *TOHID-AGENT V6*\nSelect an option:";
 try{
  const buttons=rows.map(([id,label])=>({name:"quick_reply",buttonParamsJson:JSON.stringify({display_text:label,id})}));
  const interactive=proto.Message.InteractiveMessage.create({
   body:proto.Message.InteractiveMessage.Body.create({text}),
   footer:proto.Message.InteractiveMessage.Footer.create({text:FOOTER}),
   nativeFlowMessage:proto.Message.InteractiveMessage.NativeFlowMessage.create({buttons,messageParamsJson:""})
  });
  const content=proto.Message.create({
   messageContextInfo:proto.Message.MessageContextInfo.create({deviceListMetadata:{},deviceListMetadataVersion:2}),
   interactiveMessage:interactive
  });
  const generated=generateWAMessageFromContent(jid,content,{userJid:sock.user?.id||jid});
  await sock.relayMessage(jid,generated.message,{messageId:generated.key.id});
  return true;
 }catch(e){
  console.error("❌ Interactive menu send failed:",e?.stack||e?.message||e);
  const fallback=text+"\n\n"+rows.map(([,label],i)=>(i+1)+". "+label).join("\n")+"\n\nReply with the option number or use .menu.";
  await sock.sendMessage(jid,{text:fallback});
  return false;
 }
}
function buttonId(message){
 const im=message?.interactiveResponseMessage;
 if(im){
  try{
   const params=JSON.parse(im.nativeFlowResponseMessage?.paramsJson||"{}");
   if(params.id)return params.id;
  }catch{}
 }
 return message?.buttonsResponseMessage?.selectedButtonId||message?.templateButtonReplyMessage?.selectedId||message?.listResponseMessage?.singleSelectReply?.selectedRowId||null;
}
module.exports={sendMenu,buttonId,MENUS};