const {proto}=require("@whiskeysockets/baileys");

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
  const native=proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
    buttons,
    messageParamsJson:"",
    messageVersion:3
  });
  const interactive=proto.Message.InteractiveMessage.fromObject({
    header:proto.Message.InteractiveMessage.Header.fromObject({
      title:String(header||""),
      hasMediaAttachment:false
    }),
    body:proto.Message.InteractiveMessage.Body.fromObject({text:String(body||"")}),
    footer:proto.Message.InteractiveMessage.Footer.fromObject({text:String(footer||"")}),
    nativeFlowMessage:native
  });
  const message=proto.Message.create({
    messageContextInfo:proto.MessageContextInfo.fromObject({
      deviceListMetadata:{},
      deviceListMetadataVersion:2
    }),
    viewOnceMessage:proto.Message.FutureProofMessage.fromObject({
      message:proto.Message.create({interactiveMessage:interactive})
    })
  });
  const messageId="TOHIDBTN-"+Date.now()+"-"+Math.random().toString(36).slice(2,8);
  await sock.relayMessage(jid,message,{messageId});
  return messageId;
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

async function sendList(sock,jid){
  const rows=[
    {id:"tohid_ai",title:"🤖 AI Chat",description:"Chat with TOHID-AGENT"},
    {id:"tohid_image",title:"🎨 Image",description:"Generate an AI image"},
    {id:"tohid_video",title:"🎬 Video",description:"Generate an AI video"},
    {id:"tohid_github",title:"🐙 GitHub",description:"Manage GitHub with the agent"},
    {id:"tohid_heroku",title:"🚀 Heroku",description:"Inspect and manage Heroku apps"},
    {id:"tohid_status",title:"📊 Status",description:"Check agent status"},
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

async function sendDev(sock,jid){
  return relayInteractive(sock,jid,{
    header:"👨‍💻 Developer",
    body:"TOHID-AGENT is developed by Tohid.",
    footer:"TOHID TECH",
    buttons:makeReplyButtons([
      {text:"📢 Channel",id:"tohid_channel"},
      {text:"📜 List",id:"tohid_list"},
      {text:"⬅️ Menu",id:"tohid_menu"}
    ])
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
    tohid_tools:".tools",
    tohid_channel:"__TOHID_CHANNEL__",
    tohid_menu:".menu"
  };
  return map[id]||null;
}

module.exports={sendMain,sendList,sendDev,getInteractiveId,actionToText,makeReplyButtons,makeListButton,relayInteractive};
