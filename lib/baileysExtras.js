const baileys=require("gifted-baileys");

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
  return {
    newsletter:typeof sock?.newsletterMetadata==="function"||typeof sock?.newsletterCreate==="function",
    newsletterCreate:typeof sock?.newsletterCreate==="function",
    newsletterFollow:typeof sock?.newsletterFollow==="function",
    newsletterUnfollow:typeof sock?.newsletterUnfollow==="function",
    newsletterMute:typeof sock?.newsletterMute==="function",
    newsletterUnmute:typeof sock?.newsletterUnmute==="function",
    newsletterSubscribers:typeof sock?.newsletterSubscribers==="function",
    newsletterUpdate:typeof sock?.newsletterUpdate==="function",
    newsletterDelete:typeof sock?.newsletterDelete==="function",
    groupStatus:typeof sock?.giftedStatus?.sendGroupStatus==="function"||typeof sock?.sendMessage==="function",
    carousel:typeof b.generateWAMessageContent==="function"&&typeof b.generateWAMessageFromContent==="function",
    logSuppression:typeof b.suppressBaileysLogs==="function",
    cjsEntry:true
  };
}

async function sendGroupStatus(sock,jid,payload){
  if(typeof sock?.giftedStatus?.sendGroupStatus==="function"){
    return sock.giftedStatus.sendGroupStatus(jid,payload);
  }
  if(payload&&typeof payload==="object"){
    const body={groupStatusMessage:payload};
    if(typeof sock?.sendMessage==="function")return sock.sendMessage(jid,body);
  }
  throw new Error("Group status is not supported by the active Baileys build.");
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

module.exports={suppressLogs,capabilities,sendGroupStatus,newsletter,sendCarousel};
