const fs=require("fs");
const path=require("path");
const crypto=require("crypto");

const ROOT=process.cwd();
const DATA=path.join(ROOT,".tohid-control");
const BACKUP=path.join(DATA,"backups");
const FEATURE_FILE=path.join(DATA,"features.json");
const AUDIT_FILE=path.join(DATA,"audit.jsonl");
for(const d of [DATA,BACKUP])if(!fs.existsSync(d))fs.mkdirSync(d,{recursive:true});
if(!fs.existsSync(FEATURE_FILE))fs.writeFileSync(FEATURE_FILE,"{}");

function owner(jid,cfg){return !!cfg.ownerNumber&&String(jid||"").split("@")[0].replace(/\D/g,"")===String(cfg.ownerNumber).replace(/\D/g,"");}
function safePath(input){
  const raw=String(input||"").trim().replace(/\\/g,"/");
  if(!raw||raw.includes("\0")||raw.startsWith("/")||raw.split("/").includes(".."))throw new Error("Unsafe file path.");
  const abs=path.resolve(ROOT,raw);
  if(!abs.startsWith(ROOT+path.sep)||abs.includes(path.sep+".git"+path.sep))throw new Error("Path is outside the bot workspace.");
  return abs;
}
function readFeatures(){try{return JSON.parse(fs.readFileSync(FEATURE_FILE,"utf8"));}catch{return {};}}
function writeFeatures(v){fs.writeFileSync(FEATURE_FILE,JSON.stringify(v,null,2));}
function featureList(){return readFeatures();}
function featureSet(name,enabled){const f=readFeatures();const n=String(name||"").trim().toLowerCase().replace(/[^a-z0-9_-]/g,"-");if(!n)throw new Error("Feature name required.");f[n]=!!enabled;writeFeatures(f);return f[n];}
function featureEnabled(name,defaultValue=true){const f=readFeatures();const n=String(name||"").trim().toLowerCase();return Object.prototype.hasOwnProperty.call(f,n)?f[n]:defaultValue;}
function audit(jid,action,meta={}){fs.appendFileSync(AUDIT_FILE,JSON.stringify({at:new Date().toISOString(),jid,action,meta})+"\n");}
function backupFile(filePath,label="manual"){
  const abs=safePath(filePath);if(!fs.existsSync(abs)||!fs.statSync(abs).isFile())throw new Error("File not found.");
  const rel=path.relative(ROOT,abs);const stamp=new Date().toISOString().replace(/[:.]/g,"-");const id=crypto.createHash("sha1").update(rel+"|"+Date.now()).digest("hex").slice(0,10);
  const dir=path.join(BACKUP,stamp+"-"+id);fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,"meta.json"),JSON.stringify({file:rel,label,createdAt:new Date().toISOString(),sha256:crypto.createHash("sha256").update(fs.readFileSync(abs)).digest("hex")},null,2));
  fs.copyFileSync(abs,path.join(dir,path.basename(abs)));
  return {id,dir,rel};
}
function listBackups(filePath){
  const wanted=filePath?path.relative(ROOT,safePath(filePath)):null;
  if(!fs.existsSync(BACKUP))return [];
  return fs.readdirSync(BACKUP).map(id=>{try{const meta=JSON.parse(fs.readFileSync(path.join(BACKUP,id,"meta.json")));return{id,...meta};}catch{return null;}}).filter(Boolean).filter(x=>!wanted||x.file===wanted).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
}
function restoreBackup(id,confirm=false){
  if(!confirm)throw new Error("Restore requires CONFIRM.");
  const safeId=String(id||"").replace(/[^a-zA-Z0-9_-]/g,"");if(!safeId)throw new Error("Backup id required.");
  const dir=path.join(BACKUP,safeId);const meta=JSON.parse(fs.readFileSync(path.join(dir,"meta.json")));
  const target=safePath(meta.file);const source=path.join(dir,path.basename(meta.file));
  if(!fs.existsSync(source))throw new Error("Backup payload missing.");
  if(fs.existsSync(target))backupFile(meta.file,"pre-restore");
  fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target);return meta.file;
}
function listFiles(dir="",limit=100){
  const root=safePath(dir||".");const out=[];
  function walk(cur,depth){
    if(out.length>=limit||depth>4)return;
    for(const item of fs.readdirSync(cur,{withFileTypes:true})){
      if([".git",".tohid-control","node_modules"].includes(item.name))continue;
      const p=path.join(cur,item.name);
      if(item.isDirectory())walk(p,depth+1);else out.push(path.relative(ROOT,p));
      if(out.length>=limit)break;
    }
  }
  walk(root,0);return out;
}
function readFile(file,start=1,end=220){
  const abs=safePath(file);const lines=fs.readFileSync(abs,"utf8").split(/\r?\n/);return {file:path.relative(ROOT,abs),start,end:Math.min(end,lines.length),text:lines.slice(Math.max(0,start-1),Math.min(end,lines.length)).join("\n")};
}
function writeFile(file,content,confirm=false){
  if(!confirm)throw new Error("File write requires CONFIRM.");
  const abs=safePath(file);if(fs.existsSync(abs))backupFile(file,"pre-edit");
  fs.mkdirSync(path.dirname(abs),{recursive:true});fs.writeFileSync(abs,String(content));return path.relative(ROOT,abs);
}
function status(){
  const st=fs.statSync(ROOT);const f=readFeatures();
  return {workspace:ROOT,features:Object.keys(f).length,enabledFeatures:Object.values(f).filter(Boolean).length,backups:listBackups().length,controlVersion:"11.0"};
}
module.exports={ROOT,owner,safePath,featureList,featureSet,featureEnabled,audit,backupFile,listBackups,restoreBackup,listFiles,readFile,writeFile,status};
