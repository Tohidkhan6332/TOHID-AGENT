const os=require("os");
const cfg=require("../config");

function hasAiProvider(){
  return !!cfg.openaiKey || !!cfg.geminiKey;
}
function mask(value){
  if(!value)return "";
  return value.length<=6?"***":value.slice(0,3)+"***"+value.slice(-3);
}
function validate(){
  const errors=[],warnings=[];
  const pairingChild=process.env.TOHID_PAIRING_CHILD==="1";
  if(!pairingChild&&process.env.NODE_ENV==="production"&&!cfg.mongoUri&&!cfg.postgresUrl) errors.push("Configure MONGO_URI or POSTGRES_URL in production for persistent database-backed auth and memory.");
  if(!pairingChild&&!hasAiProvider()) errors.push("Configure OPENAI_API_KEY or GEMINI_API_KEY.");
  if(!pairingChild&&!cfg.ownerNumber) errors.push("OWNER_NUMBER is required.");
  if(cfg.sessionId){
    if(cfg.pairingNumber)warnings.push("SESSION_ID is configured; PAIRING_NUMBER will be ignored.");
    if(!cfg.sessionStoreSecret||cfg.sessionStoreSecret.length<32)errors.push("SESSION_STORE_SECRET must be at least 32 characters when SESSION_ID is configured.");
  }else if(cfg.loginMethod==="pairing"&&!cfg.pairingNumber) warnings.push("PAIRING_NUMBER is empty; the bot will use the normal QR login.");
  if(!cfg.sessionId&&process.env.NODE_ENV==="production"&&!cfg.sessionStoreSecret)warnings.push("SESSION_STORE_SECRET is not configured; the /pair session generator cannot create portable sessions.");
  if(cfg.aiProvider!=="auto"&&!["openai","gemini"].includes(cfg.aiProvider)) errors.push("AI_PROVIDER must be auto, openai or gemini.");
  if(cfg.mongoUri&& !/^mongodb(?:\+srv)?:\/\//i.test(cfg.mongoUri)) warnings.push("MONGO_URI does not look like a MongoDB URI.");
  const major=Number(process.versions.node.split(".")[0]);
  if(major<22) errors.push("Node.js 22+ is required by this release.");
  if(!Number.isFinite(cfg.rateLimitPerMinute)||cfg.rateLimitPerMinute<1) errors.push("AI_RATE_LIMIT_PER_MINUTE must be a positive number.");
  if(!Number.isFinite(cfg.maxMessageChars)||cfg.maxMessageChars<100) errors.push("AI_MAX_MESSAGE_CHARS must be at least 100.");
  return {ok:errors.length===0,errors,warnings,node:process.version,platform:process.platform,arch:process.arch,memoryMb:Math.round(os.totalmem()/1024/1024),providers:{openai:!!cfg.openaiKey,gemini:!!cfg.geminiKey},database:cfg.mongoUri?"mongodb":cfg.postgresUrl?"postgresql":"none",ownerConfigured:!!cfg.ownerNumber,pairingConfigured:!!cfg.pairingNumber,sessionConfigured:!!cfg.sessionId,aiProvider:cfg.aiProvider};
}
function safeSummary(){
  const v=validate();
  return {ok:v.ok,errors:v.errors,warnings:v.warnings,node:v.node,platform:v.platform,arch:v.arch,providers:v.providers,database:v.database,ownerConfigured:v.ownerConfigured,pairingConfigured:v.pairingConfigured,sessionConfigured:v.sessionConfigured,aiProvider:v.aiProvider};
}
module.exports={validate,safeSummary,mask};
