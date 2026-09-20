const baileys=require("@whiskeysockets/baileys");

/*
 * Fork-derived optional WhatsApp extras.
 * Source lineage: mauricegift/baileys-new — lib/Socket/gcstatus.js
 *
 * No fork makeWASocket call is made here. Official Baileys remains the
 * only live WhatsApp connection; this helper uses its socket primitives.
 */

function createForkStatus(sock){
  const b=baileys;
  const required=["generateWAMessageContent","generateWAMessage","generateWAMessageFromContent","generateMessageID","jidNormalizedUser","isJidGroup","isPnUser","STORIES_JID"];
  if(required.some(k=>typeof b[k]==="undefined"))return null;
  if(typeof sock?.waUploadToServer!=="function"||typeof sock?.relayMessage!=="function")return null;

  const generateContent=async content=>b.generateWAMessageContent(content,{
    upload:sock.waUploadToServer,
    logger:sock?.config?.logger,
    mediaCache:sock?.config?.mediaCache,
    options:sock?.config?.options
  });

  return {
    async sendGroupStatus(groupJid,content,options={}){
      let innerMsg;
      if(content?.message)innerMsg=content.message;
      else innerMsg=await generateContent(content);
      if(innerMsg?.messageContextInfo)delete innerMsg.messageContextInfo;
      return sock.relayMessage(groupJid,{groupStatusMessageV2:{message:innerMsg}},{
        messageId:options.messageId||b.generateMessageID(),...options
      });
    },

    async sendStatusToGroups(content,jids=[]){
      if(!Array.isArray(jids)||!jids.length)throw new Error("At least one group or user JID is required.");
      const userId=sock?.authState?.creds?.me?.id;
      if(!userId)throw new Error("WhatsApp identity is not ready.");
      const userJid=b.jidNormalizedUser(userId);
      const recipients=new Set([userJid]);

      for(const id of jids){
        if(b.isJidGroup(id)){
          try{
            const metadata=await sock.groupMetadata(id);
            for(const participant of metadata?.participants||[])if(participant?.id)recipients.add(b.jidNormalizedUser(participant.id));
          }catch(err){sock?.logger?.warn?.({err},"Unable to resolve group participants.");}
        }else if(b.isPnUser(id))recipients.add(b.jidNormalizedUser(id));
      }

      const isMedia=!!(content?.image||content?.video||content?.audio);
      const isAudio=!!content?.audio;
      const messageContent={...(content||{})};
      if(isMedia&&!isAudio){
        if(messageContent.text){messageContent.caption=messageContent.text;delete messageContent.text;}
        delete messageContent.ptt;delete messageContent.font;delete messageContent.backgroundColor;delete messageContent.textColor;
      }
      if(isAudio){
        delete messageContent.text;delete messageContent.caption;delete messageContent.font;delete messageContent.textColor;
      }

      const font=!isMedia?(content?.font||Math.floor(Math.random()*9)):undefined;
      const textColor=!isMedia?(content?.textColor||("#"+Math.floor(Math.random()*16777215).toString(16).padStart(6,"0"))):undefined;
      const backgroundColor=(!isMedia||isAudio)?(content?.backgroundColor||("#"+Math.floor(Math.random()*16777215).toString(16).padStart(6,"0"))):undefined;
      const ptt=isAudio?(typeof content?.ptt==="boolean"?content.ptt:true):undefined;

      const msg=await b.generateWAMessage(b.STORIES_JID,messageContent,{
        logger:sock?.config?.logger,userJid,upload:sock.waUploadToServer,
        mediaCache:sock?.config?.mediaCache,options:sock?.config?.options,
        font,textColor,backgroundColor,ptt
      });

      await sock.relayMessage(b.STORIES_JID,msg.message,{
        messageId:msg.key.id,
        statusJidList:Array.from(recipients),
        additionalNodes:[{tag:"meta",attrs:{},content:[{tag:"mentioned_users",attrs:{},content:jids.map(j=>({tag:"to",attrs:{jid:b.jidNormalizedUser(j)}}))}]}]
      });
      return msg;
    }
  };
}

function attachForkExtras(sock){
  if(!sock)return {attached:false,reason:"No active socket"};
  if(sock.giftedStatus?.sendGroupStatus)return {attached:true,source:"fork-existing"};
  const helper=createForkStatus(sock);
  if(!helper)return {attached:false,reason:"Official Baileys does not expose the primitives required by the fork-derived helper"};
  sock.giftedStatus=helper;
  return {attached:true,source:"baileys-new-derived"};
}

module.exports={createForkStatus,attachForkExtras};
