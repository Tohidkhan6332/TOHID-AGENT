const baileys=require("@whiskeysockets/baileys");

function suppressLogs(){
  try{
    if(typeof baileys.suppressBaileysLogs==="function"){
      baileys.suppressBaileysLogs();
      return true;
    }
  }catch{}
  return false;
}

function capabilities(sock){
  const b=baileys;
  const methods=[
    "newsletterCreate","newsletterFollow","newsletterUnfollow","newsletterMute","newsletterUnmute",
    "newsletterMetadata","newsletterSubscribers","newsletterReactMessage","newsletterFetchMessages",
    "subscribeNewsletterUpdates","newsletterUpdate","newsletterUpdateName","newsletterUpdateDescription",
    "newsletterUpdatePicture","newsletterRemovePicture","newsletterAdminCount","newsletterChangeOwner",
    "newsletterDemote","newsletterDelete"
  ];
  const out={};
  for(const name of methods)out[name]=typeof sock?.[name]==="function";
  out.newsletter=methods.some(name=>out[name]);
  out.groupStatus=typeof sock?.giftedStatus?.sendGroupStatus==="function"||typeof sock?.sendMessage==="function";
  out.groupStatusBroadcast=typeof sock?.giftedStatus?.sendStatusToGroups==="function";
  out.carousel=typeof b.generateWAMessageContent==="function"&&typeof b.generateWAMessageFromContent==="function";
  out.logSuppression=typeof b.suppressBaileysLogs==="function";
  out.cjsEntry=true;
  return out;
}
async function sendGroupStatus(sock,jid,payload){
  if(typeof sock?.giftedStatus?.sendGroupStatus==="function")return sock.giftedStatus.sendGroupStatus(jid,payload);
  if(payload&&typeof payload==="object"&&typeof sock?.sendMessage==="function")return sock.sendMessage(jid,{groupStatusMessage:payload});
  throw new Error("Group status is not supported by the active gifted-baileys build.");
}
async function sendStatusToGroups(sock,payload,jids){
  if(typeof sock?.giftedStatus?.sendStatusToGroups==="function")return sock.giftedStatus.sendStatusToGroups(payload,jids);
  if(!Array.isArray(jids)||!jids.length)throw new Error("At least one group JID is required.");
  const results=[];
  for(const jid of jids)results.push(await sendGroupStatus(sock,jid,payload));
  return results;
}

async function newsletter(sock,action,...args){
  const fn=sock&&sock[action];
  if(typeof fn!=="function")throw new Error("Newsletter feature '"+action+"' is not supported by the active Baileys build.");
  return fn.apply(sock,args);
}

async function sendCarousel(sock,jid,items,bodyText="Results",footerText="TOHID-AGENT"){
  if(typeof baileys.generateWAMessageContent!=="function"||typeof baileys.generateWAMessageFromContent!=="function"){
    throw new Error("Carousel helpers are not exported by the active Baileys build.");
  }
  const cards=await Promise.all((items||[]).map(async item=>({
    header:item.imageUrl?{
      title:String(item.title||""),
      hasMediaAttachment:true,
      imageMessage:(await baileys.generateWAMessageContent({image:{url:item.imageUrl}},{upload:sock.waUploadToServer})).imageMessage
    }:{title:String(item.title||"")},
    body:{text:String(item.description||"")},
    footer:{text:footerText},
    nativeFlowMessage:{buttons:item.url?[{name:"cta_url",buttonParamsJson:JSON.stringify({display_text:String(item.buttonText||"Open"),url:item.url})}]:[]}
  })));
  const message=baileys.generateWAMessageFromContent(jid,{
    viewOnceMessage:{message:{
      messageContextInfo:{deviceListMetadata:{},deviceListMetadataVersion:2},
      interactiveMessage:{
        body:{text:bodyText},
        footer:{text:footerText},
        carouselMessage:{cards}
      }
    }}
  },{userJid:sock.user?.id});
  return sock.relayMessage(jid,message.message,{messageId:message.key.id});
}

module.exports={suppressLogs,capabilities,sendGroupStatus,sendStatusToGroups,newsletter,sendCarousel};
