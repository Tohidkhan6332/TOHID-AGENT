const baileys=require("@whiskeysockets/baileys");
const forkExtras=require("./baileysForkExtras");

function suppressLogs(){
  try{if(typeof baileys.suppressBaileysLogs==="function"){baileys.suppressBaileysLogs();return true;}}catch{}
  return false;
}
function capabilities(sock){
  const out={};
  const newsletterMethods=["newsletterCreate","newsletterFollow","newsletterUnfollow","newsletterMute","newsletterUnmute","newsletterMetadata","newsletterSubscribers","newsletterReactMessage","newsletterFetchMessages","subscribeNewsletterUpdates","newsletterUpdate","newsletterUpdateName","newsletterUpdateDescription","newsletterUpdatePicture","newsletterRemovePicture","newsletterAdminCount","newsletterChangeOwner","newsletterDemote","newsletterDelete"];
  for(const name of newsletterMethods)out[name]={available:typeof sock?.[name]==="function",source:typeof sock?.[name]==="function"?"official":"unsupported"};
  out.newsletter={available:newsletterMethods.some(name=>typeof sock?.[name]==="function"),source:newsletterMethods.some(name=>typeof sock?.[name]==="function")?"official":"unsupported"};
  out.groupStatus={available:typeof sock?.giftedStatus?.sendGroupStatus==="function"||typeof sock?.sendMessage==="function",source:typeof sock?.giftedStatus?.sendGroupStatus==="function"?"baileys-new-derived":typeof sock?.sendMessage==="function"?"official-message-wrapper":"unsupported"};
  out.groupStatusBroadcast={available:typeof sock?.giftedStatus?.sendStatusToGroups==="function",source:typeof sock?.giftedStatus?.sendStatusToGroups==="function"?"baileys-new-derived":"unsupported"};
  out.carousel={available:typeof baileys.generateWAMessageContent==="function"&&typeof baileys.generateWAMessageFromContent==="function",source:typeof baileys.generateWAMessageContent==="function"&&typeof baileys.generateWAMessageFromContent==="function"?"official":"unsupported"};
  out.logSuppression={available:typeof baileys.suppressBaileysLogs==="function",source:typeof baileys.suppressBaileysLogs==="function"?"official":"unsupported"};
  out.cjsEntry={available:true,source:"official"};
  out.extrasLayer={enabled:true,primary:"official",fork:"mauricegift/baileys-new",secondSocket:false};
  return out;
}
async function sendGroupStatus(sock,jid,payload){
  if(typeof sock?.giftedStatus?.sendGroupStatus==="function")return sock.giftedStatus.sendGroupStatus(jid,payload);
  if(payload&&typeof payload==="object"&&typeof sock?.sendMessage==="function")return sock.sendMessage(jid,{groupStatusMessage:payload});
  throw new Error("Group status is not supported by the active Baileys build.");
}
async function sendStatusToGroups(sock,payload,jids){
  if(typeof sock?.giftedStatus?.sendStatusToGroups==="function")return sock.giftedStatus.sendStatusToGroups(payload,jids);
  throw new Error("Multi-group status extras are not available in the active Baileys build.");
}
async function newsletter(sock,action,...args){
  const fn=sock&&sock[action];
  if(typeof fn!=="function")throw new Error("Newsletter feature '"+action+"' is not supported by the active Baileys build.");
  return fn.apply(sock,args);
}
async function sendCarousel(sock,jid,items,bodyText="Results",footerText="TOHID-AGENT"){
  if(typeof baileys.generateWAMessageContent!=="function"||typeof baileys.generateWAMessageFromContent!=="function")throw new Error("Carousel helpers are not exported by the active Baileys build.");
  const cards=await Promise.all((items||[]).map(async item=>({header:item.imageUrl?{title:String(item.title||""),hasMediaAttachment:true,imageMessage:(await baileys.generateWAMessageContent({image:{url:item.imageUrl}},{upload:sock.waUploadToServer})).imageMessage}:{title:String(item.title||"")},body:{text:String(item.description||"")},footer:{text:footerText},nativeFlowMessage:{buttons:item.url?[{name:"cta_url",buttonParamsJson:JSON.stringify({display_text:String(item.buttonText||"Open"),url:item.url})}]:[]}})));
  const message=baileys.generateWAMessageFromContent(jid,{viewOnceMessage:{message:{messageContextInfo:{deviceListMetadata:{},deviceListMetadataVersion:2},interactiveMessage:{body:{text:bodyText},footer:{text:footerText},carouselMessage:{cards}}}}},{userJid:sock.user?.id});
  return sock.relayMessage(jid,message.message,{messageId:message.key.id});
}
function attachExtras(sock){return forkExtras.attachForkExtras(sock);}
module.exports={suppressLogs,capabilities,sendGroupStatus,sendStatusToGroups,newsletter,sendCarousel,attachExtras};
