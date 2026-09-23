const fs=require("fs");
const path=require("path");
const zlib=require("zlib");

const PREFIX="TOHID-AGENT~";
const MAX_BUNDLE_BYTES=6*1024*1024;
const MAX_FILES=2048;

function safeRelative(file){
  const normalized=path.posix.normalize(String(file||"").replace(/\\/g,"/"));
  if(!normalized||normalized==="."||normalized.startsWith("../")||normalized.includes("/../")||path.posix.isAbsolute(normalized))throw new Error("Invalid session file path");
  return normalized;
}
function collect(dir,base=dir,out=[]){
  for(const name of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,name.name);
    if(name.isDirectory())collect(full,base,out);
    else if(name.isFile())out.push({path:safeRelative(path.relative(base,full)),data:fs.readFileSync(full).toString("base64")});
    if(out.length>MAX_FILES)throw new Error("Too many auth files");
  }
  return out;
}
function encodeAuthDir(authDir){
  if(!fs.existsSync(authDir))throw new Error("Auth directory not found");
  const files=collect(authDir);
  const raw=Buffer.from(JSON.stringify({v:1,files}),"utf8");
  const packed=zlib.deflateRawSync(raw,{level:9});
  if(packed.length>MAX_BUNDLE_BYTES)throw new Error("Session is too large to store in SESSION_ID");
  return PREFIX+packed.toString("base64url");
}
function decodeSessionId(value){
  const token=String(value||"").trim();
  if(!token.startsWith(PREFIX))throw new Error("Invalid SESSION_ID prefix");
  const encoded=token.slice(PREFIX.length);
  if(!encoded||encoded.length>MAX_BUNDLE_BYTES*2)throw new Error("Invalid SESSION_ID size");
  let payload;
  try{payload=zlib.inflateRawSync(Buffer.from(encoded,"base64url"));}catch{throw new Error("Invalid or corrupted SESSION_ID");}
  if(payload.length>MAX_BUNDLE_BYTES)throw new Error("SESSION_ID payload is too large");
  let parsed;
  try{parsed=JSON.parse(payload.toString("utf8"));}catch{throw new Error("Invalid SESSION_ID payload");}
  if(parsed?.v!==1||!Array.isArray(parsed.files)||parsed.files.length>MAX_FILES)throw new Error("Unsupported SESSION_ID format");
  return parsed;
}
function restoreSessionId(value,authDir){
  const parsed=decodeSessionId(value);
  fs.mkdirSync(authDir,{recursive:true});
  let total=0;
  for(const file of parsed.files){
    const rel=safeRelative(file.path);
    if(typeof file.data!=="string")throw new Error("Invalid session file data");
    const data=Buffer.from(file.data,"base64");
    total+=data.length;
    if(total>MAX_BUNDLE_BYTES)throw new Error("SESSION_ID payload is too large");
    const target=path.join(authDir,rel);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,data,{mode:0o600});
  }
  return {files:parsed.files.length,bytes:total};
}
function mask(value){
  const token=String(value||"");
  if(!token)return "";
  return token.length<=24?"••••••••":" "+token.slice(0,16)+"…"+token.slice(-8);
}
module.exports={PREFIX,encodeAuthDir,decodeSessionId,restoreSessionId,mask};
