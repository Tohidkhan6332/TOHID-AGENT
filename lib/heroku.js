const axios=require("axios");
const cfg=require("../config");

function api(){
  if(!cfg.herokuToken)throw new Error("HEROKU_API_KEY is not configured.");
  return axios.create({
    baseURL:"https://api.heroku.com",
    headers:{
      Authorization:"Bearer "+cfg.herokuToken,
      Accept:"application/vnd.heroku+json; version=3",
      "Content-Type":"application/json",
      "User-Agent":"TOHID-AGENT-by-Tohid"
    },
    timeout:cfg.requestTimeoutMs
  });
}
async function listApps(){
  const r=await api().get("/apps",{params:{max:100}});
  return r.data.map(x=>({name:x.name,id:x.id,region:x.region?.name,stack:x.stack?.name,web_url:x.web_url,updated_at:x.updated_at}));
}
async function info(app){
  const r=await api().get("/apps/"+encodeURIComponent(app));
  return {name:r.data.name,id:r.data.id,web_url:r.data.web_url,region:r.data.region?.name,stack:r.data.stack?.name,maintenance:r.data.maintenance,last_release:r.data.released_at};
}
async function formation(app){
  const r=await api().get("/apps/"+encodeURIComponent(app)+"/formation");
  return r.data.map(x=>({type:x.type,quantity:x.quantity,size:x.dyno_size?.name||x.size,command:x.command}));
}
async function restart(app,type){
  const url="/apps/"+encodeURIComponent(app)+(type?"/formations/"+encodeURIComponent(type):"/dynos");
  const r=await api().delete(url);
  return {app,type:type||"all",status:r.status===202?"restart_requested":"accepted"};
}
async function stop(app){
  const current=await formation(app);
  if(!current.length)return{app,status:"no_process_types"};
  const updates=current.map(x=>({type:x.type,quantity:0}));
  const r=await api().patch("/apps/"+encodeURIComponent(app)+"/formation",{updates});
  return {app,status:"stopped",formation:r.data.map(x=>({type:x.type,quantity:x.quantity}))};
}
async function start(app,processes){
  const current=await formation(app);
  if(!current.length)throw new Error("No process types found for this Heroku app.");
  const requested=String(processes||"").trim();
  const updates=current.map(x=>{
    const m=requested.match(new RegExp("(?:^|\\s)"+x.type+"=(\\d+)"));
    return {type:x.type,quantity:m?Number(m[1]):1};
  });
  const r=await api().patch("/apps/"+encodeURIComponent(app)+"/formation",{updates});
  return {app,status:"started",formation:r.data.map(x=>({type:x.type,quantity:x.quantity}))};
}
async function scale(app,updates){
  if(!Array.isArray(updates)||!updates.length)throw new Error("Provide process updates such as web=1 worker=0.");
  const parsed=updates.map(x=>{
    const m=String(x).match(/^([\w-]+)=(\d+)$/);
    if(!m)throw new Error("Invalid scale entry: "+x);
    return{type:m[1],quantity:Number(m[2])};
  });
  const r=await api().patch("/apps/"+encodeURIComponent(app)+"/formation",{updates:parsed});
  return r.data.map(x=>({type:x.type,quantity:x.quantity,size:x.dyno_size?.name||x.size}));
}
async function redeploy(app,sourceUrl,version="v7"){
  if(!sourceUrl)throw new Error("A public source tarball URL is required for Platform API redeploy. For a GitHub-linked Heroku app, use the Heroku GitHub integration/manual deploy or provide the source tarball URL.");
  const r=await api().post("/apps/"+encodeURIComponent(app)+"/builds",{source_blob:{url:sourceUrl,version}});
  return {app,build_id:r.data.id,status:r.data.status,source_url:r.data.source_blob?.url};
}
module.exports={listApps,info,formation,restart,stop,start,scale,redeploy};