const crypto=require("crypto");
const db=require("./database");
const cfg=require("../config");
const sessionManager=require("./sessionManager");

const PREFIX="TOHID-SESSION-v1.";
function secret(){
  const value=String(cfg.sessionStoreSecret||"").trim();
  if(value.length<32)throw new Error("SESSION_STORE_SECRET must be at least 32 characters.");
  return crypto.createHash("sha256").update(value).digest();
}
function tokenHash(token){return crypto.createHash("sha256").update(String(token)).digest("hex");}
function encrypt(text){
  const iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv("aes-256-gcm",secret(),iv);
  const data=Buffer.concat([cipher.update(String(text),"utf8"),cipher.final()]);
  return {v:1,iv:iv.toString("base64url"),tag:cipher.getAuthTag().toString("base64url"),data:data.toString("base64url")};
}
function decrypt(record){
  try{
    const decipher=crypto.createDecipheriv("aes-256-gcm",secret(),Buffer.from(record.iv,"base64url"));
    decipher.setAuthTag(Buffer.from(record.tag,"base64url"));
    return Buffer.concat([decipher.update(Buffer.from(record.data,"base64url")),decipher.final()]).toString("utf8");
  }catch{throw new Error("Session could not be decrypted. Check SESSION_STORE_SECRET.");}
}
function newId(){return PREFIX+crypto.randomBytes(32).toString("base64url");}
function validateId(id){
  const value=String(id||"").trim();
  if(!/^TOHID-SESSION-v1\.[A-Za-z0-9_-]{40,64}$/.test(value))throw new Error("Invalid SESSION_ID format.");
  return value;
}
async function createFromAuthDir(authDir,meta={}){
  if(!cfg.sessionStoreSecret)throw new Error("SESSION_STORE_SECRET is required to generate a SESSION_ID.");
  const bundle=sessionManager.exportAuthDir(authDir);
  const id=newId();
  await db.saveWhatsAppSession(tokenHash(id),encrypt(bundle),{
    phone:String(meta.phone||"").replace(/\D/g,""),
    createdAt:new Date().toISOString(),
    updatedAt:new Date().toISOString()
  });
  return id;
}
async function restoreToAuthDir(id,authDir){
  const value=validateId(id);
  if(!cfg.sessionStoreSecret)throw new Error("SESSION_STORE_SECRET is required when SESSION_ID is configured.");
  const record=await db.getWhatsAppSession(tokenHash(value));
  if(!record)throw new Error("SESSION_ID was not found or has been revoked.");
  const bundle=decrypt(record.payload);
  const result=sessionManager.restoreBundle(bundle,authDir);
  await db.touchWhatsAppSession(tokenHash(value));
  return result;
}
async function revoke(id){
  const value=validateId(id);
  return db.deleteWhatsAppSession(tokenHash(value));
}
module.exports={PREFIX,createFromAuthDir,restoreToAuthDir,revoke,validateId,mask:sessionManager.mask};