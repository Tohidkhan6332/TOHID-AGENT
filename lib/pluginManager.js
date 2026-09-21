const fs=require("fs");
const path=require("path");
const vm=require("vm");
const crypto=require("crypto");
const axios=require("axios");
const db=require("./database");

const ROOT=path.join(process.cwd(),"plugins");
const REGISTRY=path.join(ROOT,"registry.json");
if(!fs.existsSync(ROOT))fs.mkdirSync(ROOT,{recursive:true});
if(!fs.existsSync(REGISTRY))fs.writeFileSync(REGISTRY,"{}");

let registry={};
try{registry=JSON.parse(fs.readFileSync(REGISTRY,"utf8"));}catch{registry={};}
const loaded=new Map();
const hooks=[];
const commands=new Map();
const pluginLogs=new Map();
const capabilities=new Map();

function saveRegistry(){fs.writeFileSync(REGISTRY,JSON.stringify(registry,null,2));}
function safeName(name){
  const n=String(name||"").trim().toLowerCase().replace(/[^a-z0-9_-]/g,"-").replace(/-+/g,"-");
  if(!n||n==="."||n==="..")throw new Error("Invalid plugin name.");
  return n.slice(0,64);
}
function hash(content){return crypto.createHash("sha256").update(content).digest("hex");}
function isOwner(jid,cfg){return !!cfg.ownerNumber&&String(jid||"").split("@")[0].replace(/\D/g,"")===String(cfg.ownerNumber).replace(/\D/g,"");}
function manifest(plugin){
  return {
    name:String(plugin?.name||"").trim(),
    version:String(plugin?.version||"1.0.0"),
    description:String(plugin?.description||""),
    author:String(plugin?.author||""),
    commands:Object.keys(plugin?.commands||{}),
    hasHook:typeof plugin?.onMessage==="function"
  };
}
function logPlugin(name,...args){const n=safeName(name);const arr=pluginLogs.get(n)||[];arr.push({at:new Date().toISOString(),message:args.map(x=>typeof x==="string"?x:JSON.stringify(x)).join(" ")});pluginLogs.set(n,arr.slice(-100));console.log("[plugin:"+n+"]",...args);}
function createApi(meta){
  return {
    version:"11.0",
    plugin:meta.name,
    registerCommand(name,handler){if(typeof handler!=="function")throw new Error("Command handler must be a function.");commands.set(String(name).replace(/^\./,"").toLowerCase(),{plugin:meta.name,handler});},
    onMessage(handler){if(typeof handler==="function")hooks.push({plugin:meta.name,handler});},
    send:meta.send,
    db,
    log:(...a)=>logPlugin(meta.name,...a),
    capabilities(metaCapabilities=[]){const list=Array.isArray(metaCapabilities)?metaCapabilities.map(String):[];capabilities.set(meta.name,list);return list;}
  };
}
function testSource(source){validateSource(source);return {ok:true,warning:/process\.env|child_process|execSync|spawnSync|fork|eval\s*\(/.test(source)?"privileged API detected":null};}
function validateSource(source){
  if(typeof source!=="string"||!source.trim())throw new Error("Plugin source is empty.");
  if(source.length>512000)throw new Error("Plugin source exceeds 500 KB.");
  new vm.Script(source,{filename:"plugin-validation.js"});
  if(/process\.env|child_process|execSync|spawnSync|fork|eval\s*\(/.test(source)){
    return {warning:"Plugin contains privileged/runtime APIs. Install only code you trust."};
  }
  return {warning:null};
}
function unload(name){
  const n=safeName(name);
  const old=loaded.get(n);
  if(!old)return false;
  for(const [k,v] of commands)if(v.plugin===n)commands.delete(k);
  for(let i=hooks.length-1;i>=0;i--)if(hooks[i].plugin===n)hooks.splice(i,1);
  try{if(old.path)delete require.cache[require.resolve(old.path)];}catch{}
  loaded.delete(n);
  return true;
}
async function load(name,cfg,send){
  const n=safeName(name),file=path.join(ROOT,n,"index.js");
  if(!fs.existsSync(file))throw new Error("Plugin file not found: "+n);
  unload(n);
  let plugin;
  try{plugin=require(file);}catch(e){throw new Error("Plugin load failed: "+e.message);}
  const meta=manifest(plugin);
  if(!meta.name)throw new Error("Plugin must export name.");
  const normalized=safeName(meta.name);
  if(normalized!==n)throw new Error("Plugin name does not match folder name.");
  const api=createApi({name:n,send});
  for(const [command,handler] of Object.entries(plugin.commands||{}))api.registerCommand(command,handler);
  if(typeof plugin.onMessage==="function")api.onMessage(plugin.onMessage);
  if(typeof plugin.init==="function")await plugin.init(api);
  loaded.set(n,{plugin,path:file});
  registry[n]={...registry[n],...meta,name:n,enabled:true,sourceHash:hash(fs.readFileSync(file)),updatedAt:new Date().toISOString()};
  saveRegistry();
  return registry[n];
}
async function updateSource({name,source,cfg,send,enable=true}){return installSource({name,source,cfg,send,enable});}
async function installSource({name,source,cfg,send,enable=true}){
  const checked=validateSource(source);
  let pluginName=safeName(name);
  const dir=path.join(ROOT,pluginName);
  fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,"index.js"),source);
  registry[pluginName]={name:pluginName,enabled:false,installedAt:new Date().toISOString(),sourceHash:hash(source),warning:checked.warning};
  saveRegistry();
  if(enable)await load(pluginName,cfg,send);
  return {...registry[pluginName],warning:checked.warning};
}
async function installFromUrl(url,opts){
  const u=String(url||"").trim();
  let source;
  if(/gist\.github\.com\//i.test(u)){
    const apiUrl=u.replace(/\/$/,"")+".js";
    const r=await axios.get(apiUrl,{timeout:20000,responseType:"text",validateStatus:s=>s>=200&&s<400});
    source=String(r.data||"");
  }else{
    const r=await axios.get(u,{timeout:20000,responseType:"text",validateStatus:s=>s>=200&&s<400});
    source=String(r.data||"");
  }
  return installSource({...opts,source});
}
async function installFile(filePath,opts){
  const source=fs.readFileSync(filePath,"utf8");
  return installSource({...opts,source});
}
function list(){return Object.values(registry).map(x=>({...x,loaded:loaded.has(x.name)}));}
async function enable(name,cfg,send){return load(name,cfg,send);}
function disable(name){
  const n=safeName(name);unload(n);if(registry[n]){registry[n].enabled=false;registry[n].updatedAt=new Date().toISOString();saveRegistry();}return registry[n]||null;
}
function remove(name){
  const n=safeName(name);unload(n);fs.rmSync(path.join(ROOT,n),{recursive:true,force:true});delete registry[n];saveRegistry();return true;
}
function logs(name){return pluginLogs.get(safeName(name))||[];}
function getCapabilities(name){return capabilities.get(safeName(name))||[];}
function getCommand(name){return commands.get(String(name||"").replace(/^\./,"").toLowerCase());}
async function dispatchCommand(ctx){
  const key=String(ctx.command||"").replace(/^\./,"").toLowerCase();
  const entry=getCommand(key);if(!entry)return false;
  await entry.handler(ctx);return true;
}
async function dispatchMessage(ctx){
  for(const h of [...hooks]){
    try{await h.handler(ctx);}catch(e){console.error("[plugin:"+h.plugin+"] message hook:",e.message);}
  }
}
async function boot(cfg,send){
  for(const item of list().filter(x=>x.enabled)){
    try{await load(item.name,cfg,send);}catch(e){console.error("Plugin boot failed:",item.name,e.message);}
  }
}
module.exports={ROOT,REGISTRY,isOwner,validateSource,testSource,installSource,updateSource,installFromUrl,installFile,load,enable,disable,remove,list,logs,getCapabilities,getCommand,dispatchCommand,dispatchMessage,boot};
