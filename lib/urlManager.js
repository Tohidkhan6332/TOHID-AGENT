const fs=require("fs");
const path=require("path");

const FILE=path.join(process.cwd(),".tohid-control","urls.json");

function ensure(){fs.mkdirSync(path.dirname(FILE),{recursive:true});}
function readLocal(){try{return JSON.parse(fs.readFileSync(FILE,"utf8"));}catch{return {active:"",items:{}};}}
function writeLocal(data){ensure();fs.writeFileSync(FILE,JSON.stringify(data,null,2)+"\n");}

async function load(db){
  try{
    if(db?.status?.().primary&&db.status().primary!=="none"){
      const values=await db.getGlobalConfig();
      if(values.urlRegistry)return values.urlRegistry;
    }
  }catch{}
  return readLocal();
}
async function save(db,data){
  try{
    if(db?.status?.().primary&&db.status().primary!=="none"){
      const values=await db.getGlobalConfig();
      values.urlRegistry=data;
      await db.setGlobalConfig(values);
      return {persistent:true};
    }
  }catch{}
  writeLocal(data);
  return {persistent:false};
}
function normalizeName(name){return String(name||"").trim().toLowerCase().replace(/[^a-z0-9_-]/g,"").slice(0,40);}
function validateUrl(value){try{const u=new URL(String(value));return /^https?:$/.test(u.protocol)?u.toString():null;}catch{return null;}}

async function add(db,name,url){
  const key=normalizeName(name);const value=validateUrl(url);
  if(!key)throw new Error("Invalid URL name.");
  if(!value)throw new Error("Only valid http/https URLs are allowed.");
  const data=await load(db);data.items=data.items||{};data.items[key]=value;if(!data.active)data.active=key;
  const result=await save(db,data);return {key,url:value,...result};
}
async function remove(db,name){
  const key=normalizeName(name);const data=await load(db);if(!data.items?.[key])return false;
  delete data.items[key];if(data.active===key)data.active=Object.keys(data.items)[0]||"";
  await save(db,data);return true;
}
async function switchUrl(db,name){
  const key=normalizeName(name);const data=await load(db);
  if(!data.items?.[key])throw new Error("URL not found: "+key);
  data.active=key;await save(db,data);return {key,url:data.items[key]};
}
async function list(db){const data=await load(db);return {active:data.active||"",items:data.items||{}};}
async function getActive(db){const data=await list(db);return data.active&&data.items[data.active]||"";}
module.exports={add,remove,switchUrl,list,getActive,normalizeName,validateUrl};
