const fs=require("fs");
const path=require("path");
const zlib=require("zlib");

const MAX_PAYLOAD_BYTES=12*1024*1024;
const MAX_FILES=4096;

function safeRelative(file){
  const normalized=path.posix.normalize(String(file||"").replace(/\\/g,"/"));
  if(!normalized||normalized==="."||normalized.startsWith("../")||normalized.includes("/../")||path.posix.isAbsolute(normalized))throw new Error("Invalid session file path");
  return normalized;
}
function collect(dir,base=dir,out=[]){
  if(!fs.existsSync(dir))throw new Error("Auth directory not found");
  for(const name of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,name.name);
    if(name.isDirectory())collect(full,base,out);
    else if(name.isFile())out.push({path:safeRelative(path.relative(base,full)),data:fs.readFileSync(full).toString("base64")});
    if(out.length>MAX_FILES)throw new Error("Too many auth files");
  }
  return out;
}
function exportAuthDir(authDir){
  const files=collect(authDir);
  const raw=Buffer.from(JSON.stringify({v:2,files}),"utf8");
  const packed=zlib.deflateRawSync(raw,{level:9});
  if(packed.length>MAX_PAYLOAD_BYTES)throw new Error("WhatsApp auth bundle is too large to store safely.");
  return packed.toString("base64");
}
function decodeBundle(bundle){
  let payload;
  try{payload=zlib.inflateRawSync(Buffer.from(String(bundle||""),"base64"));}catch{throw new Error("Invalid or corrupted session bundle");}
  if(payload.length>MAX_PAYLOAD_BYTES)throw new Error("Session bundle is too large");
  let parsed;
  try{parsed=JSON.parse(payload.toString("utf8"));}catch{throw new Error("Invalid session bundle");}
  if(!parsed||parsed.v!==2||!Array.isArray(parsed.files)||parsed.files.length>MAX_FILES)throw new Error("Unsupported session bundle");
  return parsed;
}
function restoreBundle(bundle,authDir){
  const parsed=decodeBundle(bundle);
  fs.rmSync(authDir,{recursive:true,force:true});
  fs.mkdirSync(authDir,{recursive:true});
  let total=0;
  for(const file of parsed.files){
    const rel=safeRelative(file.path);
    if(typeof file.data!=="string")throw new Error("Invalid session file data");
    const data=Buffer.from(file.data,"base64");
    total+=data.length;
    if(total>MAX_PAYLOAD_BYTES)throw new Error("Session bundle is too large");
    const target=path.join(authDir,rel);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,data,{mode:0o600});
  }
  return {files:parsed.files.length,bytes:total};
}
function mask(value){
  const token=String(value||"");
  if(!token)return "";
  return token.length<=20?"••••••••":token.slice(0,10)+"…"+token.slice(-6);
}
module.exports={exportAuthDir,restoreBundle,decodeBundle,mask,MAX_PAYLOAD_BYTES};