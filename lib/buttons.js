const {proto,generateWAMessageFromContent,isJidGroup}=require("@whiskeysockets/baileys");

function makeReplyButtons(items){
  return items.slice(0,3).map(x=>({
    name:"quick_reply",
    buttonParamsJson:JSON.stringify({
      display_text:String(x.text).slice(0,20),
      id:String(x.id)
    })
  }));
}

function makeListButton(title,sections){
  return {
    name:"single_select",
    buttonParamsJson:JSON.stringify({
      title:String(title).slice(0,24),
      sections
    })
  };
}

async function relayInteractive(sock,jid,{header="",body,footer="",buttons}) {
  const native=proto.Message.InteractiveMessage.NativeFlowMessage.create({
    buttons:buttons.map(b=>proto.Message.InteractiveMessage.NativeFlowMessage.NativeFlowButton.create(b)),
    messageParamsJson:"{}",
    messageVersion:1
  });
  const interactiveMessage=proto.Message.InteractiveMessage.create({
    header:proto.Message.InteractiveMessage.Header.create({
      title:String(header||""),
      hasMediaAttachment:false
    }),
    body:proto.Message.InteractiveMessage.Body.create({text:String(body||"")}),
    footer:proto.Message.InteractiveMessage.Footer.create({text:String(footer||"")}),
    nativeFlowMessage:native
  });
  const waMessage=generateWAMessageFromContent(
    jid,
    {interactiveMessage},
    {userJid:sock.user?.id}
  );
  const bizNode={
    tag:"biz",
    attrs:{
      actual_actors:"2",
      host_storage:"2",
      privacy_mode_ts:String(Math.floor(Date.now()/1000)-77980457)
    },
    content:[
      {
        tag:"interactive",
        attrs:{type:"native_flow",v:"1"},
        content:[{tag:"native_flow",attrs:{v:"9",name:"mixed"}}]
      },
      {
        tag:"quality_control",
        attrs:{source_type:"third_party"}
      }
    ]
  };
  const botNode={tag:"bot",attrs:{biz_bot:"1"}};
  const additionalNodes=isJidGroup(jid)?[bizNode]:[botNode,bizNode];
  await sock.relayMessage(jid,waMessage.message,{messageId:waMessage.key.id,additionalNodes});
  return waMessage.key.id;
}
async function sendHelp(sock,jid,language="en"){
  const english =
    "🤖 *TOHID-AGENT V7.7 — COMPLETE HELP*\\n\\n"+
    "👨‍💻 Developer: Tohid\\n"+
    "📢 TOHID TECH: https://whatsapp.com/channel/0029VaGyP933bbVC7G0x0i2T\\n\\n"+
    "💬 *AI / CHAT*\\n"+
    "• Send any message → AI chat\\n"+
    "• Send an image + caption → image analysis\\n"+
    "• Send a voice note → speech-to-text + AI reply\\n"+
    "• .imagine <prompt> → generate an image\\n"+
    "• .video <prompt> → generate a video\\n"+
    "• .newchat / .reset → clear conversation memory\\n"+
    "• .memory → view memory count\\n"+
    "• .memory on/off → enable or disable memory\\n"+
    "• .voice on/off → enable or disable voice replies\\n\\n"+
    "🐙 *GITHUB AGENT*\\n"+
    "Ask naturally to list/search repositories, read files, inspect commits/issues, create branches/issues/PRs, create or edit files, and upload projects.\\n"+
    "Examples:\\n"+
    "• \\"Show my GitHub repositories\\"\\n"+
    "• \\"Read index.js from TOHID-AGENT\\"\\n"+
    "• \\"Create a GitHub portfolio repository\\"\\n"+
    "• \\"Upload this project to GitHub\\"\\n"+
    "🔐 GitHub write actions require owner authorization + CONFIRM.\\n\\n"+
    "🚀 *HOSTING / DEPLOYMENT*\\n"+
    "Supported: *Vercel • Render • Koyeb • Heroku*\\n"+
    "• Show my Vercel projects\\n"+
    "• Show Render services\\n"+
    "• Show Koyeb apps\\n"+
    "• Show Heroku apps\\n"+
    "• Deploy this GitHub project to Vercel\\n"+
    "• Redeploy the Render/Koyeb/Heroku project\\n"+
    "• Check deployment/service/build/release/log status\\n"+
    "• Manage supported lifecycle actions such as restart, start, stop, scale, pause, resume, rollback and maintenance\\n"+
    "• Delete a project/service/app when supported\\n"+
    "⚠️ Protected hosting changes require owner authorization + CONFIRM.\\n\\n"+
    "🧭 *PLANNER / TOOLS*\\n"+
    "• .plan <task> → preview an execution plan\\n"+
    "• .tools → available tools\\n"+
    "• .doctor → configuration diagnostics\\n"+
    "• .provider → AI provider status\\n"+
    "• .status → bot status\\n"+
    "• .ping → health check\\n"+
    "• .stats → owner statistics\\n\\n"+
    "⚙️ *MENU / SETTINGS*\\n"+
    "• .menu → interactive menu\\n"+
    "• .settings → voice and memory settings\\n"+
    "• .profile → profile settings\\n"+
    "• .help → show this help\\n\\n"+
    "🔐 *SECURITY*\\n"+
    "API keys, tokens and secret values are never revealed. Missing provider credentials are reported without exposing their values.\\n\\n"+
    "💡 You can use natural-language requests; exact command syntax is not required.";
  const hindi =
    "🤖 *TOHID-AGENT V7.7 — पूरी HELP*\\n\\n"+
    "👨‍💻 Developer: Tohid\\n"+
    "📢 TOHID TECH: https://whatsapp.com/channel/0029VaGyP933bbVC7G0x0i2T\\n\\n"+
    "💬 *AI / CHAT*\\n"+
    "• कोई भी message भेजें → AI से chat\\n"+
    "• Image + caption भेजें → image analysis\\n"+
    "• Voice note भेजें → speech-to-text + AI reply\\n"+
    "• .imagine <prompt> → AI image बनाएं\\n"+
    "• .video <prompt> → AI video बनाएं\\n"+
    "• .newchat / .reset → conversation memory clear करें\\n"+
    "• .memory → memory count देखें\\n"+
    "• .memory on/off → memory चालू या बंद करें\\n"+
    "• .voice on/off → voice replies चालू या बंद करें\\n\\n"+
    "🐙 *GITHUB AGENT*\\n"+
    "Normal language में repositories list/search, files read, commits/issues check, branch/issue/PR create, files create/edit और project upload करवा सकते हैं.\\n"+
    "Examples:\\n"+
    "• \\"मेरे GitHub repositories दिखाओ\\"\\n"+
    "• \\"TOHID-AGENT का index.js पढ़ो\\"\\n"+
    "• \\"GitHub पर portfolio repository बनाओ\\"\\n"+
    "• \\"इस project को GitHub पर upload करो\\"\\n"+
    "🔐 GitHub write actions के लिए owner authorization + CONFIRM जरूरी है.\\n\\n"+
    "🚀 *HOSTING / DEPLOYMENT*\\n"+
    "Supported: *Vercel • Render • Koyeb • Heroku*\\n"+
    "• Vercel projects दिखाओ\\n"+
    "• Render services दिखाओ\\n"+
    "• Koyeb apps दिखाओ\\n"+
    "• Heroku apps दिखाओ\\n"+
    "• GitHub project को Vercel पर deploy करो\\n"+
    "• Render/Koyeb/Heroku project redeploy करो\\n"+
    "• Deployment/service/build/release/log status check करो\\n"+
    "• Supported restart, start, stop, scale, pause, resume, rollback और maintenance actions manage करो\\n"+
    "• Supported project/service/app delete करो\\n"+
    "⚠️ Protected hosting changes के लिए owner authorization + CONFIRM जरूरी है.\\n\\n"+
    "🧭 *PLANNER / TOOLS*\\n"+
    "• .plan <task> → execution plan देखें\\n"+
    "• .tools → available tools देखें\\n"+
    "• .doctor → configuration diagnostics\\n"+
    "• .provider → AI provider status\\n"+
    "• .status → bot status\\n"+
    "• .ping → health check\\n"+
    "• .stats → owner statistics\\n\\n"+
    "⚙️ *MENU / SETTINGS*\\n"+
    "• .menu → interactive menu\\n"+
    "• .settings → voice और memory settings\\n"+
    "• .profile → profile settings\\n"+
    "• .help → यह help खोलें\\n\\n"+
    "🔐 *SECURITY*\\n"+
    "API keys, tokens और secret values कभी reveal नहीं किए जाते. Missing provider credentials बताए जाएंगे, लेकिन उनकी values नहीं दिखाई जाएंगी.";
  const text=language==="hi"?hindi:english;
  return relayInteractive(sock,jid,{
    header:language==="hi"?"📖 TOHID-AGENT HELP • HINDI":"📖 TOHID-AGENT HELP • ENGLISH",
    body:text,
    footer:"Choose a language / भाषा चुनें",
    buttons:makeReplyButtons([
      {text:language==="hi"?"🇬🇧 English":"🇮🇳 Hindi",id:language==="hi"?"tohid_help_en":"tohid_help_hi"},
      {text:"📜 Menu",id:"tohid_menu"}
    ])
  });
}

async function sendMain(sock,jid){
  return relayInteractive(sock,jid,{
    header:"🤖 TOHID-AGENT",
    body:"Online • Choose an option below. Text commands still work normally.",
    footer:"👨‍💻 Developer: Tohid",
    buttons:makeReplyButtons([
      {text:"🤖 AI",id:"tohid_ai"},
      {text:"📜 List",id:"tohid_list"},
      {text:"👨‍💻 Dev",id:"tohid_dev"}
    ])
  });
}

async function sendSettings(sock,jid){
  return relayInteractive(sock,jid,{
    header:"⚙️ TOHID-AGENT SETTINGS",
    body:"Choose a setting. These controls only change your own bot preferences.",
    footer:"Text commands remain available: .voice / .memory",
    buttons:[makeListButton("Settings",[{title:"Preferences",rows:[
      {id:"tohid_voice_on",title:"🎙️ Voice ON",description:"Enable voice replies"},
      {id:"tohid_voice_off",title:"🔇 Voice OFF",description:"Disable voice replies"},
      {id:"tohid_memory_on",title:"🧠 Memory ON",description:"Keep conversation memory"},
      {id:"tohid_memory_off",title:"🧹 Memory OFF",description:"Disable and clear memory"},
      {id:"tohid_menu",title:"⬅️ Back to Menu",description:"Return to main menu"}
    ]}])]
  });
}

async function sendList(sock,jid){
  const rows=[
    {id:"tohid_ai",title:"🤖 AI Chat",description:"Chat with TOHID-AGENT"},
    {id:"tohid_image",title:"🎨 Image",description:"Generate an AI image"},
    {id:"tohid_video",title:"🎬 Video",description:"Generate an AI video"},
    {id:"tohid_github",title:"🐙 GitHub",description:"Manage GitHub with the agent"},
    {id:"tohid_heroku",title:"🚀 Heroku",description:"Inspect and manage Heroku apps"},
    {id:"tohid_status",title:"📊 Status",description:"Check agent status"},
    {id:"tohid_settings",title:"⚙️ Settings",description:"Voice and memory preferences"},
    {id:"tohid_plan",title:"🧭 Planner",description:"Plan a complex task with text"},
    {id:"tohid_tools",title:"🧰 Tools",description:"View available tools"},
    {id:"tohid_channel",title:"📢 TOHID TECH",description:"Open the official channel"}
  ];
  return relayInteractive(sock,jid,{
    header:"📜 TOHID-AGENT MENU",
    body:"Select an action. You can also keep using .commands as before.",
    footer:"Tap an option to continue",
    buttons:[makeListButton("Select Option",[{title:"TOHID-AGENT",rows}])]
  });
}

function makeUrlButton(text,url){
  return {
    name:"cta_url",
    buttonParamsJson:JSON.stringify({
      display_text:String(text).slice(0,20),
      url:String(url)
    })
  };
}

async function sendDev(sock,jid){
  const channel="https://whatsapp.com/channel/0029VaGyP933bbVC7G0x0i2T";
  const repoUrl="https://github.com/Tohidkhan6332/TOHID-AGENT";
  const contactUrl="https://wa.me/message/O6KWTGOGTVTYO1";
  return relayInteractive(sock,jid,{
    header:"👨‍💻 Developer • Tohid",
    body:"🤖 TOHID-AGENT V7.5\\n\\n🛠️ Production WhatsApp AI Agent\\n👨‍💻 Developer: Tohid\\n⚡ Version: V7.5\\n🧠 AI: OpenAI + Gemini fallback\\n🐙 GitHub Agent + 🚀 Heroku Agent\\n🔐 Protected actions with owner confirmation\\n\\nBuilt and maintained by Tohid.",
    footer:"📢 TOHID TECH • Open a link or return to the menu",
    buttons:[
      makeUrlButton("📢 Channel",channel),
      makeUrlButton("💻 Source Code",repoUrl),
      makeUrlButton("💬 Contact Tohid",contactUrl),
      {name:"quick_reply",buttonParamsJson:JSON.stringify({display_text:"⬅️ Menu",id:"tohid_menu"})}
    ]
  });
}

function getInteractiveId(message){
  const native=message?.interactiveResponseMessage?.nativeFlowResponseMessage;
  if(native){
    try{
      const p=JSON.parse(native.paramsJson||"{}");
      return p.id||p.selected_id||p.selected_row_id||p.row_id||null;
    }catch{
      return null;
    }
  }
  const b=message?.buttonsResponseMessage;
  if(b?.selectedButtonId)return b.selectedButtonId;
  const l=message?.listResponseMessage?.singleSelectReply;
  if(l?.selectedRowId)return l.selectedRowId;
  const t=message?.templateButtonReplyMessage;
  if(t?.selectedId)return t.selectedId;
  return null;
}

function actionToText(id){
  const map={
    tohid_ai:"__TOHID_AI__",
    tohid_list:"__TOHID_LIST__",
    tohid_dev:"__TOHID_DEV__",
    tohid_image:".imagine",
    tohid_video:".video",
    tohid_github:"__TOHID_GITHUB__",
    tohid_heroku:"__TOHID_HEROKU__",
    tohid_status:".status",
    tohid_settings:"__TOHID_SETTINGS__",
    tohid_plan:"__TOHID_PLAN__",
    tohid_voice_on:"__TOHID_VOICE_ON__",
    tohid_voice_off:"__TOHID_VOICE_OFF__",
    tohid_memory_on:"__TOHID_MEMORY_ON__",
    tohid_memory_off:"__TOHID_MEMORY_OFF__",
    tohid_tools:".tools",
    tohid_channel:"__TOHID_CHANNEL__",
    tohid_menu:".menu",
    tohid_help_hi:"__TOHID_HELP_HI__",
    tohid_help_en:"__TOHID_HELP_EN__"
  };
  return map[id]||null;
}

module.exports={sendMain,sendList,sendDev,sendSettings,sendHelp,getInteractiveId,actionToText,makeReplyButtons,makeListButton,relayInteractive};
