const {proto,generateWAMessageFromContent,isJidGroup}=require("@whiskeysockets/baileys");
let giftedButtons=null;
try{giftedButtons=require("gifted-btns");}catch{}
const cfg=require("../config");\nconst catalog=require("./commandCatalog");\nconst translatedHelpCache=new Map();

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
  // Prefer gifted-btns for WhatsApp's required interactive/native-flow wrappers.
  // Keep the local relay implementation as a compatibility fallback.
  if(giftedButtons?.sendInteractiveMessage){
    return giftedButtons.sendInteractiveMessage(sock,jid,{
      title:String(header||""),
      text:String(body||""),
      footer:String(footer||""),
      interactiveButtons:buttons,
      aimode:true
    });
  }
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
async function translateHelp(english,targetLanguage){
  const lang=String(targetLanguage||"").trim();
  if(!lang||/^english$/i.test(lang))return english;
  const key=lang.toLowerCase();
  if(translatedHelpCache.has(key))return translatedHelpCache.get(key);
  const system="Translate the supplied TOHID-AGENT help text into the requested language. Preserve commands, URLs, product names, developer name, version, emojis, markdown structure and CONFIRM exactly. Do not add commentary. Return only the translated help.";
  const body=system+"\\n\\nTarget language: "+lang+"\\n\\nHelp:\\n"+english;
  let out="";
  const call=async(url,key,model)=>{
    const r=await fetch(url,{method:"POST",headers:{"content-type":"application/json","authorization":"Bearer "+key},body:JSON.stringify({model,messages:[{role:"system",content:system},{role:"user",content:"Target language: "+lang+"\\n\\n"+english}],temperature:0.1})});
    if(!r.ok)throw new Error("translation provider HTTP "+r.status);
    const j=await r.json();
    return j?.choices?.[0]?.message?.content||"";
  };
  if(cfg.openaiKey){
    try{out=await call("https://api.openai.com/v1/chat/completions",cfg.openaiKey,cfg.openaiModel);}catch{}
  }
  if(!out&&cfg.geminiKey){
    try{out=await call("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",cfg.geminiKey,cfg.geminiModel);}catch{}
  }
  if(!out)throw new Error("No AI provider is available for help translation.");
  translatedHelpCache.set(key,out);
  return out;
}

async function sendLanguageMenu(sock,jid){
  const language=await i18n.getLanguage(jid);
  const languages=[
    ["tohid_help_hi","🇮🇳 Hindi","हिन्दी"],
    ["tohid_help_bn","🇧🇩 Bengali","বাংলা"],
    ["tohid_help_pa","🇮🇳 Punjabi","ਪੰਜਾਬੀ"],
    ["tohid_help_ur","🇵🇰 Urdu","اردو"],
    ["tohid_help_ta","🇮🇳 Tamil","தமிழ்"],
    ["tohid_help_te","🇮🇳 Telugu","తెలుగు"],
    ["tohid_help_mr","🇮🇳 Marathi","मराठी"],
    ["tohid_help_gu","🇮🇳 Gujarati","ગુજરાતી"],
    ["tohid_help_kn","🇮🇳 Kannada","ಕನ್ನಡ"],
    ["tohid_help_ml","🇮🇳 Malayalam","മലയാളം"],
    ["tohid_help_ar","🌍 Arabic","العربية"],
    ["tohid_help_es","🌍 Spanish","Español"],
    ["tohid_help_fr","🌍 French","Français"],
    ["tohid_help_de","🌍 German","Deutsch"],
    ["tohid_help_tr","🌍 Turkish","Türkçe"],
    ["tohid_help_other","🌐 Other","Type any language name"]
  ];
  const rows=await Promise.all(languages.map(async([id,title,description])=>({
    id,
    title,
    description:await i18n.translate(description,language)
  })));
  return relayInteractive(sock,jid,{
    header:await i18n.translate("🌐 TOHID-AGENT • HELP LANGUAGE",language),
    body:await i18n.translate("English is the default. Select a language to read the complete help in that language. You can also request any other language with: .help <language>",language),
    footer:await i18n.translate("Languages are translated on demand using the configured AI provider.",language),
    buttons:[makeListButton(await i18n.translate("Select Language",language),[{title:await i18n.translate("Available Languages",language),rows}])]
  });
}

async function sendHelp(sock,jid,language="en"){
  const english =
    "🤖 *TOHID-AGENT V10.0 — COMPLETE HELP*\\n\\n"+
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
  const text=await translateHelp(english,language);
  return relayInteractive(sock,jid,{
    header:language==="en"?"📖 TOHID-AGENT HELP • ENGLISH":"📖 TOHID-AGENT HELP • "+String(language).toUpperCase(),
    body:text,
    footer:"🌐 Change language / भाषा बदलें",
    buttons:makeReplyButtons([
      {text:"🌐 Language",id:"tohid_help_languages"},
      {text:"🇬🇧 English",id:"tohid_help_en"},
      {text:"📜 Menu",id:"tohid_menu"}
    ])
  });
}

const i18n=require("./i18n");

function getInteractiveId(message){
  try{
    const native=message?.interactiveResponseMessage?.nativeFlowResponseMessage;
    if(native?.paramsJson){
      const p=JSON.parse(native.paramsJson);
      return p.id||p.selectedId||p.selectedRowId||p.button_id||null;
    }
  }catch{}
  return message?.buttonsResponseMessage?.selectedButtonId||
    message?.listResponseMessage?.singleSelectReply?.selectedRowId||
    message?.templateButtonReplyMessage?.selectedId||null;
}

function actionToText(id){
  const map={
    tohid_menu:"__TOHID_MENU__",tohid_ai:"__TOHID_AI__",tohid_github:"__TOHID_GITHUB__",tohid_heroku:"__TOHID_HEROKU__",tohid_channel:"__TOHID_CHANNEL__",
    tohid_settings:"__TOHID_SETTINGS__",tohid_list:"__TOHID_LIST__",tohid_dev:"__TOHID_DEV__",tohid_plan:"__TOHID_PLAN__",
    tohid_help_languages:"__TOHID_HELP_LANGUAGES__",tohid_help_en:"__TOHID_HELP_EN__",tohid_help_hi:"__TOHID_HELP_HI__",tohid_help_bn:"__TOHID_HELP_BN__",tohid_help_pa:"__TOHID_HELP_PA__",tohid_help_ur:"__TOHID_HELP_UR__",tohid_help_ta:"__TOHID_HELP_TA__",tohid_help_te:"__TOHID_HELP_TE__",tohid_help_mr:"__TOHID_HELP_MR__",tohid_help_gu:"__TOHID_HELP_GU__",tohid_help_kn:"__TOHID_HELP_KN__",tohid_help_ml:"__TOHID_HELP_ML__",tohid_help_ar:"__TOHID_HELP_AR__",tohid_help_es:"__TOHID_HELP_ES__",tohid_help_fr:"__TOHID_HELP_FR__",tohid_help_de:"__TOHID_HELP_DE__",tohid_help_tr:"__TOHID_HELP_TR__",tohid_help_other:"__TOHID_HELP_OTHER__",
    tohid_voice_on:"__TOHID_VOICE_ON__",tohid_voice_off:"__TOHID_VOICE_OFF__",tohid_memory_on:"__TOHID_MEMORY_ON__",tohid_memory_off:"__TOHID_MEMORY_OFF__"
  };
  const raw=String(id||"");\n  if(raw.startsWith("tohid_cmd_"))return catalog.commandMap()[raw]||null;\n  return map[raw]||null;
}

async function localizedMenu(sock,jid,title,body,items){
  const language=await i18n.getLanguage(jid);
  const translatedBody=await i18n.translate(body,language);
  const translatedItems=await Promise.all(items.map(async x=>({text:await i18n.translate(x.text,language),id:x.id})));
  return relayInteractive(sock,jid,{header:await i18n.translate(title,language),body:translatedBody,footer:await i18n.translate("Use the buttons below.",language),buttons:makeReplyButtons(translatedItems)});
}

async function sendCommandMenu(sock,jid,style="buttons"){
  const language=await i18n.getLanguage(jid);
  const sections=catalog.commandRows().map(s=>({
    title:s.title,
    rows:s.rows.map(r=>({id:r.id,title:r.title,description:r.description}))
  }));
  if(style==="reply"){
    const flat=[];
    for(const s of sections)for(const row of s.rows)flat.push({text:row.title,id:row.id});
    const chunks=[];
    for(let i=0;i<flat.length;i+=3)chunks.push(flat.slice(i,i+3));
    for(const chunk of chunks){
      await relayInteractive(sock,jid,{header:"📖 TOHID-AGENT COMMANDS",body:await i18n.translate("Tap a command to run its example.",language),footer:"TOHID-AGENT",buttons:chunk.map(x=>({name:"quick_reply",buttonParamsJson:JSON.stringify({display_text:x.text.slice(0,20),id:x.id})}))});
    }
    return;
  }
  return relayInteractive(sock,jid,{
    header:await i18n.translate("📖 TOHID-AGENT • ALL COMMANDS",language),
    body:await i18n.translate("Choose a command category. Every command includes an example.",language),
    footer:await i18n.translate("Tap a command to run its example.",language),
    buttons:[makeListButton("📋 Commands",sections)]
  });
}
async function sendMain(sock,jid){return sendCommandMenu(sock,jid,"buttons");}
async function sendList(sock,jid){return sendCommandMenu(sock,jid,"buttons");}
async function sendDev(sock,jid){return sendCommandMenu(sock,jid,"buttons");}
async function sendSettings(sock,jid){return sendCommandMenu(sock,jid,"buttons");}

async function sendTextMenu(sock,jid,kind="main"){
  const language=await i18n.getLanguage(jid);
  return sock.sendMessage(jid,{text:await i18n.translate(catalog.menuText(),language)});
}

async function sendMenuByMode(sock,jid,kind="main",mode="hybrid"){
  const m=String(mode||"hybrid").toLowerCase();
  if(m==="text"||m==="minimal"){
    const language=await i18n.getLanguage(jid);
    const body=m==="minimal"?"🤖 TOHID-AGENT\\nUse .help for all commands.":catalog.menuText();
    return sock.sendMessage(jid,{text:await i18n.translate(body,language)});
  }
  if(m==="reply")return sendCommandMenu(sock,jid,"reply");
  if(m==="buttons")return sendCommandMenu(sock,jid,"buttons");
  await sendTextMenu(sock,jid,kind);
  return sendCommandMenu(sock,jid,"reply");
}

async function sendLanguageMenuByMode(sock,jid,mode="hybrid"){
  const m=String(mode||"hybrid").toLowerCase();
  if(m==="text"||m==="minimal"){
    const language=await i18n.getLanguage(jid);
    return sock.sendMessage(jid,{text:await i18n.translate("🌐 Languages\\nUse .language <language> to change the bot language.\\nExample: .language Hindi",language)});
  }
  if(m==="buttons")return sendLanguageMenu(sock,jid);
  const language=await i18n.getLanguage(jid);
  await sock.sendMessage(jid,{text:await i18n.translate("🌐 Select a language below, or type .language <language>.",language)});
  return sendLanguageMenu(sock,jid);
}

module.exports={relayInteractive,sendLanguageMenu,sendHelp,sendHelpByMode,sendLanguageMenuByMode,getInteractiveId,actionToText,sendMain,sendList,sendDev,sendSettings,sendTextMenu,sendMenuByMode};
