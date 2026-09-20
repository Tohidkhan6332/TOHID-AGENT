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
    body:"🤖 TOHID-AGENT V7.4\\n\\n🛠️ Production WhatsApp AI Agent\\n👨‍💻 Developer: Tohid\\n⚡ Version: V7.4\\n🧠 AI: OpenAI + Gemini fallback\\n🐙 GitHub Agent + 🚀 Heroku Agent\\n🔐 Protected actions with owner confirmation\\n\\nBuilt and maintained by Tohid.",
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
    tohid_menu:".menu"
  };
  return map[id]||null;
}

module.exports={sendMain,sendList,sendDev,sendSettings,getInteractiveId,actionToText,makeReplyButtons,makeListButton,relayInteractive};
