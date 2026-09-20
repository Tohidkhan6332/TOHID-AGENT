const axios=require("axios");
const cfg=require("../config");

function need(name,value){if(!value)throw new Error(name+" is not configured.");}
function client(baseURL,token,extra={}){
  return axios.create({baseURL,headers:{Authorization:"Bearer "+token,"Content-Type":"application/json",...extra},timeout:cfg.requestTimeoutMs});
}
function vercel(){need("VERCEL_TOKEN",cfg.vercelToken);return client("https://api.vercel.com",cfg.vercelToken);}
function render(){need("RENDER_API_KEY",cfg.renderApiKey);need("RENDER_OWNER_ID",cfg.renderOwnerId);return client("https://api.render.com/v1",cfg.renderApiKey);}
function koyeb(){need("KOYEB_API_TOKEN",cfg.koyebToken);return client("https://app.koyeb.com/v1",cfg.koyebToken);}

function normalizeVercelProject(x){return {id:x.id,name:x.name,framework:x.framework,updated_at:x.updatedAt||x.updated_at,created_at:x.createdAt||x.created_at,link:x.link||null};}
function normalizeVercelDeployment(x){return {id:x.uid||x.id,name:x.name,state:x.readyState||x.state,url:x.url?("https://"+String(x.url).replace(/^https?:\\/\\//,"")):null,created_at:x.createdAt||x.created_at,ready_at:x.readyAt||null,branch:x.meta?.githubCommitRef||x.gitSource?.ref||null};}

async function vercelDeploy({name,repo,branch="main",framework}){
  const api=vercel();
  let project;
  try{const p=await api.post("/v10/projects",{name,framework:framework||undefined,gitRepository:{type:"github",repo}});project=p.data;}
  catch(e){if(e.response?.status!==409)throw e;const p=await api.get("/v9/projects/"+encodeURIComponent(name));project=p.data;}
  const d=await api.post("/v13/deployments",{name,project:project.id||project.name,gitSource:{type:"github",repo,ref:branch}});
  return {platform:"vercel",status:d.data.readyState||d.data.state||"queued",deployment_id:d.data.id||d.data.uid,url:d.data.url?("https://"+d.data.url):null,project:project.name||name};
}
async function vercelListProjects(){const r=await vercel().get("/v9/projects",{params:{limit:100}});return (r.data?.projects||[]).map(normalizeVercelProject);}
async function vercelProject(name){const r=await vercel().get("/v9/projects/"+encodeURIComponent(name));return normalizeVercelProject(r.data);}
async function vercelDeployments(name,limit=10){const r=await vercel().get("/v6/deployments",{params:{projectId:name,limit:Math.min(Math.max(Number(limit)||10,1),50)}});return (r.data?.deployments||[]).map(normalizeVercelDeployment);}
async function vercelDeployment(id){const r=await vercel().get("/v13/deployments/"+encodeURIComponent(id));return normalizeVercelDeployment(r.data);}
async function vercelDeleteProject(name){await vercel().delete("/v9/projects/"+encodeURIComponent(name));return {platform:"vercel",project:name,status:"deleted"};}
async function vercelDeleteDeployment(id){await vercel().delete("/v13/deployments/"+encodeURIComponent(id));return {platform:"vercel",deployment:id,status:"deleted"};}
async function vercelRedeploy({name,repo,branch="main",framework}){return vercelDeploy({name,repo,branch,framework});}

async function renderDeploy({name,repo,branch="main",type="web_service",buildCommand="npm install",startCommand="npm start",rootDir="",envVars=[]}){
  const api=render();
  const body={type,name,ownerId:cfg.renderOwnerId,repo,branch,autoDeploy:"yes",rootDir:rootDir||undefined,envVars:Array.isArray(envVars)?envVars.map(x=>typeof x==="string"?{key:x.split("=")[0],value:x.slice(x.indexOf("=")+1)}:x):[]};
  if(type==="static_site")body.serviceDetails={staticSiteDetails:{buildCommand,publishPath:"dist"}};
  else body.serviceDetails={env:"node",buildCommand,startCommand};
  const r=await api.post("/services",body);const x=r.data?.service||r.data;
  return {platform:"render",status:"created",id:x.id,name:x.name,url:x.serviceDetails?.url||null};
}
function normalizeRenderService(x){return {id:x.id,name:x.name,type:x.type,status:x.suspended?"suspended":x.status||x.state||null,url:x.serviceDetails?.url||x.url||null,repo:x.repo||null,branch:x.branch||null};}
async function renderList(){const r=await render().get("/services",{params:{ownerId:cfg.renderOwnerId,limit:100}});return (r.data?.services||r.data||[]).map(normalizeRenderService);}
async function renderService(id){const r=await render().get("/services/"+encodeURIComponent(id));return normalizeRenderService(r.data?.service||r.data);}
async function renderDeployExisting(id,clearCache=false){const r=await render().post("/services/"+encodeURIComponent(id)+"/deploys",{clearCache:clearCache?"clear":"do_not_clear"});const x=r.data?.deploy||r.data;return {platform:"render",service:id,status:x.status||"deploy_requested",deploy_id:x.id||null};}
async function renderDelete(id){await render().delete("/services/"+encodeURIComponent(id));return {platform:"render",service:id,status:"deleted"};}

async function koyebDeploy({name,repo,branch="main",port=3000,runCommand,envVars=[]}){
  const api=koyeb();const a=await api.post("/apps",{name});const app=a.data?.app||a.data;
  const body={name,app_id:app.id,git:{repository:repo.replace(/^https?:\\/\\//,"").replace(/^github.com\\//,""),branch},ports:[{port:Number(port),protocol:"http"}],routes:[{path:"/",port:Number(port)}]};
  if(runCommand)body.git.run_command=runCommand;
  if(Array.isArray(envVars)&&envVars.length)body.env=envVars.map(x=>typeof x==="string"?{key:x.split("=")[0],value:x.slice(x.indexOf("=")+1)}:x);
  const r=await api.post("/services",body);const service=r.data?.service||r.data;
  return {platform:"koyeb",status:"created",app_id:app.id,service_id:service.id,url:service.domains?.[0]?.name?("https://"+service.domains[0].name):null};
}
async function koyebApps(){const r=await koyeb().get("/apps");return (r.data?.apps||[]).map(x=>({id:x.id,name:x.name,domains:x.domains||[],updated_at:x.updated_at,created_at:x.created_at}));}
async function koyebApp(idOrName){const r=await koyeb().get("/apps/"+encodeURIComponent(idOrName));const x=r.data?.app||r.data;return {id:x.id,name:x.name,domains:x.domains||[],updated_at:x.updated_at,created_at:x.created_at};}
async function koyebServices(){const r=await koyeb().get("/services");return (r.data?.services||[]).map(x=>({id:x.id,name:x.name,app_id:x.app_id,state:x.state||x.status,domains:x.domains||[]}));}
async function koyebService(id){const r=await koyeb().get("/services/"+encodeURIComponent(id));const x=r.data?.service||r.data;return {id:x.id,name:x.name,app_id:x.app_id,state:x.state||x.status,domains:x.domains||[],updated_at:x.updated_at};}
async function koyebRedeploy(id){const r=await koyeb().post("/services/"+encodeURIComponent(id)+"/redeploy",{});return {platform:"koyeb",service:id,status:"redeploy_requested",deployment_id:r.data?.deployment?.id||r.data?.id||null};}
async function koyebPause(id){await koyeb().post("/services/"+encodeURIComponent(id)+"/pause",{});return {platform:"koyeb",service:id,status:"paused"};}
async function koyebResume(id){await koyeb().post("/services/"+encodeURIComponent(id)+"/resume",{});return {platform:"koyeb",service:id,status:"resume_requested"};}
async function koyebDeleteService(id){await koyeb().delete("/services/"+encodeURIComponent(id));return {platform:"koyeb",service:id,status:"deleted"};}
async function koyebDeleteApp(id){await koyeb().delete("/apps/"+encodeURIComponent(id));return {platform:"koyeb",app:id,status:"deleted"};}

async function deploy(platform,args){const p=String(platform||"").toLowerCase();if(p==="vercel")return vercelDeploy(args);if(p==="render")return renderDeploy(args);if(p==="koyeb")return koyebDeploy(args);throw new Error("Unsupported deployment platform: "+platform+". Supported API adapters: Vercel, Render, Koyeb. Heroku uses the dedicated Heroku agent.");}
async function manage(platform,action,args={}){
  const p=String(platform||"").toLowerCase(),a=String(action||"").toLowerCase();
  if(p==="vercel"){
    if(a==="list")return vercelListProjects();
    if(a==="project")return vercelProject(args.name);
    if(a==="deployments")return vercelDeployments(args.name,args.limit);
    if(a==="deployment")return vercelDeployment(args.id);
    if(a==="delete_project")return vercelDeleteProject(args.name);
    if(a==="delete_deployment")return vercelDeleteDeployment(args.id);
    if(a==="redeploy")return vercelRedeploy(args);
  }
  if(p==="render"){
    if(a==="list")return renderList();
    if(a==="service")return renderService(args.id);
    if(a==="redeploy")return renderDeployExisting(args.id,args.clearCache);
    if(a==="delete_service")return renderDelete(args.id);
  }
  if(p==="koyeb"){
    if(a==="apps")return koyebApps();
    if(a==="app")return koyebApp(args.id||args.name);
    if(a==="services")return koyebServices();
    if(a==="service")return koyebService(args.id);
    if(a==="redeploy")return koyebRedeploy(args.id);
    if(a==="pause")return koyebPause(args.id);
    if(a==="resume")return koyebResume(args.id);
    if(a==="delete_service")return koyebDeleteService(args.id);
    if(a==="delete_app")return koyebDeleteApp(args.id||args.name);
  }
  throw new Error("Unsupported hosting management action: "+platform+" / "+action);
}
module.exports={deploy,manage,vercelDeploy,renderDeploy,koyebDeploy,vercelListProjects,vercelProject,vercelDeployments,vercelDeployment,vercelDeleteProject,vercelDeleteDeployment,renderList,renderService,renderDeployExisting,renderDelete,koyebApps,koyebApp,koyebServices,koyebService,koyebRedeploy,koyebPause,koyebResume,koyebDeleteService,koyebDeleteApp};