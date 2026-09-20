const axios=require("axios");
const cfg=require("../config");

function need(name,value){if(!value)throw new Error(name+" is not configured.");}
function vercel(){
  need("VERCEL_TOKEN",cfg.vercelToken);
  return axios.create({baseURL:"https://api.vercel.com",headers:{Authorization:"Bearer "+cfg.vercelToken,"Content-Type":"application/json"},timeout:cfg.requestTimeoutMs});
}
function render(){
  need("RENDER_API_KEY",cfg.renderApiKey); need("RENDER_OWNER_ID",cfg.renderOwnerId);
  return axios.create({baseURL:"https://api.render.com/v1",headers:{Authorization:"Bearer "+cfg.renderApiKey,"Content-Type":"application/json"},timeout:cfg.requestTimeoutMs});
}
function koyeb(){
  need("KOYEB_API_TOKEN",cfg.koyebToken);
  return axios.create({baseURL:"https://app.koyeb.com/v1",headers:{Authorization:"Bearer "+cfg.koyebToken,"Content-Type":"application/json"},timeout:cfg.requestTimeoutMs});
}
async function vercelDeploy({name,repo,branch="main",framework}){
  const api=vercel();
  let project;
  try{
    const p=await api.post("/v10/projects",{name,framework:framework||undefined,gitRepository:{type:"github",repo}});
    project=p.data;
  }catch(e){
    if(e.response?.status!==409)throw e;
    const p=await api.get("/v9/projects/"+encodeURIComponent(name));project=p.data;
  }
  const d=await api.post("/v13/deployments",{name,project:project.id||project.name,gitSource:{type:"github",repo,ref:branch}});
  return {platform:"vercel",status:d.data.readyState||d.data.state||"queued",deployment_id:d.data.id,url:d.data.url?("https://"+d.data.url):null,project:project.name||name};
}
async function renderDeploy({name,repo,branch="main",type="web_service",buildCommand="npm install",startCommand="npm start",rootDir="",envVars=[]}){
  const api=render();
  const body={type,name,ownerId:cfg.renderOwnerId,repo,branch,autoDeploy:"yes",rootDir:rootDir||undefined,envVars:Array.isArray(envVars)?envVars.map(x=>typeof x==="string"?{key:x.split("=")[0],value:x.slice(x.indexOf("=")+1)}:x):[]};
  if(type==="static_site")body.serviceDetails={staticSiteDetails:{buildCommand,publishPath:"dist"}};
  else body.serviceDetails={env:"node",buildCommand,startCommand};
  const r=await api.post("/services",body);
  const x=r.data?.service||r.data;
  return {platform:"render",status:"created",id:x.id,name:x.name,url:x.serviceDetails?.url||null};
}
async function koyebDeploy({name,repo,branch="main",port=3000,runCommand,envVars=[]}){
  const api=koyeb();
  const a=await api.post("/apps",{name});
  const app=a.data?.app||a.data;
  const body={name,app_id:app.id,git:{repository:repo.replace(/^https?:\/\//,"").replace(/^github.com\//,""),branch},ports:[{port:Number(port),protocol:"http"}],routes:[{path:"/",port:Number(port)}]};
  if(runCommand)body.git.run_command=runCommand;
  if(Array.isArray(envVars)&&envVars.length)body.env=envVars.map(x=>typeof x==="string"?{key:x.split("=")[0],value:x.slice(x.indexOf("=")+1)}:x);
  const r=await api.post("/services",body);
  const service=r.data?.service||r.data;
  return {platform:"koyeb",status:"created",app_id:app.id,service_id:service.id,url:service.domains?.[0]?.name?("https://"+service.domains[0].name):null};
}
async function deploy(platform,args){
  const p=String(platform||"").toLowerCase();
  if(p==="vercel")return vercelDeploy(args);
  if(p==="render")return renderDeploy(args);
  if(p==="koyeb")return koyebDeploy(args);
  throw new Error("Unsupported deployment platform: "+platform+". Supported API adapters: Vercel, Render, Koyeb. Heroku uses the dedicated Heroku agent.");
}
module.exports={deploy,vercelDeploy,renderDeploy,koyebDeploy};
