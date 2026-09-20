const {proto,generateWAMessageFromContent,isJidGroup}=require("gifted-baileys");
let giftedButtons=null;
try{giftedButtons=require("gifted-btns");}catch{}\nconst cfg=require("../config");\nconst translatedHelpCache=new Map();

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
  return relayInteractive(sock,jid,{
    header:"🌐 TOHID-AGENT • HELP LANGUAGE",
    body:"English is the default. Select a language to read the complete help in that language. You can also request any other language with: .help <language>",
    footer:"Languages are translated on demand using the configured AI provider.",
    buttons:[makeListButton("Select Language",[{title:"Available Languages",rows:languages.map(([id,title,description])=>({id,title,description}))}])]
  });
}

async function sendHelp(sock,jid,language="en"){
  const english =
    "🤖 *TOHID-AGENT V8.0 — COMPLETE HELP*\\n\\n"+
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
