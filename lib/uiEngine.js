const db=require("./database");
const cfg=require("../config");

const MODES=["auto","buttons","text","hybrid","minimal"];

function normalize(mode){
  const m=String(mode||"").trim().toLowerCase();
  if(MODES.includes(m))return m;
  if(m==="both")return "hybrid";
  return MODES.includes(String(cfg.defaultUIMode||"").toLowerCase())?String(cfg.defaultUIMode).toLowerCase():"auto";
}

async function get(jid){
  try{
    const settings=await db.getSettings(jid);
    return normalize(settings.uiMode||cfg.defaultUIMode);
  }catch{
    return normalize(cfg.defaultUIMode);
  }
}

async function set(jid,mode){
  const value=normalize(mode);
  await db.setSettings(jid,{uiMode:value});
  return value;
}

function resolve(mode,context="navigation"){
  const m=normalize(mode);
  if(m!=="auto")return m;
  const c=String(context||"navigation").toLowerCase();
  if(["navigation","settings","help","selection"].includes(c))return "hybrid";
  if(["status","diagnostic","error","confirmation","result"].includes(c))return "text";
  if(["media","github","hosting","admin","actions"].includes(c))return "hybrid";
  return "text";
}

function description(mode){
  const m=normalize(mode);
  return {
    auto:"Auto — chooses the least noisy interface for each situation",
    buttons:"Buttons — interactive controls for navigation and actions",
    text:"Text — commands and normal text replies",
    hybrid:"Hybrid — text plus interactive controls",
    minimal:"Minimal — concise text with only essential controls"
  }[m];
}

function isInteractiveAllowed(mode,context){
  return resolve(mode,context)!=="text";
}

module.exports={MODES,normalize,get,set,resolve,description,isInteractiveAllowed};
