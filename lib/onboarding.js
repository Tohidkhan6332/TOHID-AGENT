const fs=require("fs");
const path=require("path");
const promotion=require("./promotion");

const MARKER="onboarding-complete.json";

function inviteCode(link){
  try{
    const url=new URL(String(link));
    return String(url.pathname.split("/").filter(Boolean).pop()||"").trim();
  }catch{
    return String(link||"").trim().replace(/^https?:\/\/[^/]+\//i,"").replace(/\/$/,"");
  }
}

function channelCode(link){
  return inviteCode(link);
}

function markerPath(authDir){
  return path.join(path.resolve(authDir||path.join(process.cwd(),"auth_info_baileys")),MARKER);
}

function alreadyDone(authDir){
  try{return fs.existsSync(markerPath(authDir));}catch{return false;}
}

function writeMarker(authDir,details){
  try{
    const dir=path.dirname(markerPath(authDir));
    fs.mkdirSync(dir,{recursive:true});
    fs.writeFileSync(markerPath(authDir),JSON.stringify({
      completedAt:new Date().toISOString(),
      ...details
    },null,2));
  }catch{}
}

async function joinOfficialGroup(sock){
  const fn=sock?.groupAcceptInvite;
  if(typeof fn!=="function")throw new Error("groupAcceptInvite is unavailable");
  const code=inviteCode(promotion.group);
  if(!code)throw new Error("invalid official group invite");
  return fn.call(sock,code);
}

async function followOfficialChannel(sock){
  if(typeof sock?.newsletterFollow!=="function")throw new Error("newsletterFollow is unavailable");
  const code=channelCode(promotion.channel);
  if(!code)throw new Error("invalid official channel invite");

  let jid="";
  if(typeof sock.newsletterMetadata==="function"){
    const metadata=await sock.newsletterMetadata("invite",code);
    jid=metadata?.id||"";
  }
  if(!jid)throw new Error("could not resolve official channel JID");
  return sock.newsletterFollow(jid);
}

async function run(sock,{authDir,logger=console}={}){
  if(!sock||!sock.user)return {skipped:true,reason:"socket identity not ready"};
  if(alreadyDone(authDir))return {skipped:true,reason:"already completed"};

  const result={group:"failed",channel:"failed"};

  try{
    await joinOfficialGroup(sock);
    result.group="joined";
  }catch(error){
    result.group="failed";
    logger.warn?.("Official group auto-join failed",{message:error?.message||String(error)});
  }

  try{
    await followOfficialChannel(sock);
    result.channel="followed";
  }catch(error){
    result.channel="failed";
    logger.warn?.("Official channel auto-follow failed",{message:error?.message||String(error)});
  }

  writeMarker(authDir,result);
  return result;
}

module.exports={run,alreadyDone,markerPath};
