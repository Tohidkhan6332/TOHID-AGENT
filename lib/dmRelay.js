const axios=require("axios");
const cfg=require("../config");

const quotedSender=msg=>msg?.extendedTextMessage?.contextInfo?.participant||msg?.imageMessage?.contextInfo?.participant||msg?.videoMessage?.contextInfo?.participant||msg?.documentMessage?.contextInfo?.participant||msg?.audioMessage?.contextInfo?.participant||null;
const contextInfo=msg=>msg?.extendedTextMessage?.contextInfo||msg?.imageMessage?.contextInfo||msg?.videoMessage?.contextInfo||msg?.documentMessage?.contextInfo||msg?.audioMessage?.contextInfo||msg?.stickerMessage?.contextInfo||{};
const mentioned=msg=>contextInfo(msg).mentionedJid?.[0]||null;
const cleanJid=jid=>{const s=String(jid||"");if(!s||s.endsWith("@g.us")||s==="status@broadcast")return null;return s.includes("@")?s:s+"@s.whatsapp.net";};
function quoted(msg){return contextInfo(msg).quotedMessage||null;}
function targetFromMessage(msg,text){
  const t=String(text||"").toLowerCase();
  const wantsDm=/\b(dm|direct|private|personal)\b/.test(t)||/\b(dm|direct|private)\s*(me|him|her|them)\b/.test(t)||/\b(isko|iske|usko|uske)\s*(dm|private|personal)\b/.test(t);
  if(!wantsDm)return null;
  return cleanJid(quotedSender(msg)||mentioned(msg));
}
function extractText(q){return q?.conversation||q?.extendedTextMessage?.text||q?.imageMessage?.caption||q?.videoMessage?.caption||q?.documentMessage?.caption||"";}
function media(q){if(q?.imageMessage)return["image",q.imageMessage];if(q?.videoMessage)return["video",q.videoMessage];if(q?.documentMessage)return["document",q.documentMessage];if(q?.audioMessage)return["audio",q.audioMessage];if(q?.stickerMessage)return["sticker",q.stickerMessage];return null;}

function githubApi(){
  if(!cfg.githubToken)throw new Error("GitHub integration is not configured.");
  return axios.create({baseURL:"https://api.github.com",headers:{Authorization:"Bearer "+cfg.githubToken,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","User-Agent":"TOHID-AGENT-by-Tohid"}});
}
function githubRepo(text){
  const m=String(text||"").match(/\b(?:repo(?:sitory)?\s+)?([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\b/i);
  if(m)return m[1];
  const m2=String(text||"").match(/\b([A-Za-z0-9_.-]+)\s*(?:ki|ka|ke)?\s*(?:github|repo|repository)\b/i);
  return m2?cfg.githubOwner+"/"+m2[1]:cfg.githubOwner+"/TOHID-AGENT";
}
function githubPath(text){
  const t=String(text||"");
  const m=t.match(/\b(?:file|path)\s*[:=]?\s*([A-Za-z0-9_./-]+\.[A-Za-z0-9_-]+)\b/i);
  return m?m[1]:null;
}
function githubIntent(text){
  const t=String(text||"").toLowerCase();
  if(!/(github|repo|repository)/.test(t))return null;
  if(/download|file|document|zip|send.*file|file.*send/.test(t))return"file";
  if(/link|url|website|address/.test(t))return"link";
  return null;
}
async function githubDeliver({sock,target,text}){
  const intent=githubIntent(text);if(!intent)return false;
  const repo=githubRepo(text);
  const url="https://github.com/"+repo;
  if(intent==="link"){
    await sock.sendMessage(target,{text:"🐙 *GitHub Repository*\\n\\n"+url});
    return true;
  }
  const api=githubApi(),branch=(await api.get("/repos/"+repo)).data.default_branch||"main";
  const file=githubPath(text);
  if(file){
    const r=await api.get("/repos/"+repo+"/contents/"+file,{params:{ref:branch}});
    if(Array.isArray(r.data))throw new Error("That path is a folder, not a file.");
    const data=Buffer.from(r.data.content||"","base64");
    await sock.sendMessage(target,{document:data,fileName:r.data.name||file,mimetype:"application/octet-stream",caption:"📦 "+repo+"/"+r.data.path+"\\n🌿 "+branch+"\\n🔗 "+r.data.html_url});
    return true;
  }
  const r=await api.get("/repos/"+repo+"/zipball/"+encodeURIComponent(branch),{responseType:"arraybuffer",maxContentLength:25*1024*1024,maxBodyLength:25*1024*1024});
  await sock.sendMessage(target,{document:Buffer.from(r.data),fileName:repo.split("/")[1]+"-"+branch+".zip",mimetype:"application/zip",caption:"📦 GitHub repository: "+repo+"\\n🌿 Branch: "+branch+"\\n🔗 "+url});
  return true;
}

function hostIntent(text){
  const t=String(text||"").toLowerCase();
  const hosts=["heroku","vercel","render","koyeb"];
  const host=hosts.find(x=>t.includes(x));
  if(!host)return null;
  if(!/(details?|info|status|update|project|app|service|deployment|deployments|latest|last|link|url|website|address)/.test(t))return null;
  return host;
}
function hostAuth(host){
  const token=host==="heroku"?cfg.herokuToken:host==="vercel"?cfg.vercelToken:host==="render"?cfg.renderApiKey:cfg.koyebToken;
  if(!token)throw new Error(host+" integration is not configured.");
  return token;
}
async function hostDetails(host){
  const token=hostAuth(host);
  if(host==="heroku"){
    const r=await axios.get("https://api.heroku.com/apps",{headers:{Authorization:"Bearer "+token,Accept:"application/vnd.heroku+json; version=3"}});
    const apps=r.data||[],a=apps.slice().sort((x,y)=>new Date(y.updated_at||0)-new Date(x.updated_at||0))[0];
    return a?{host,kind:"app",name:a.name,status:a.maintenance?"maintenance":"active",stack:a.stack?.name,region:a.region?.name,updated:a.updated_at,url:"https://"+a.name+".herokuapp.com"}:{host,empty:true};
  }
  if(host==="vercel"){
    const r=await axios.get("https://api.vercel.com/v9/projects",{headers:{Authorization:"Bearer "+token},params:{limit:100}});
    const projects=r.data?.projects||[],p=projects.slice().sort((x,y)=>new Date(y.updatedAt||0)-new Date(x.updatedAt||0))[0];
    return p?{host,kind:"project",name:p.name,framework:p.framework,updated:p.updatedAt,projectId:p.id,url:p.targets?.production?.url?("https://"+p.targets.production.url):"https://vercel.com/"+p.name}:{host,empty:true};
  }
  if(host==="render"){
    const r=await axios.get("https://api.render.com/v1/services",{headers:{Authorization:"Bearer "+token,"Accept":"application/json"},params:{limit:100}});
    const rows=r.data||[],items=rows.map(x=>x.service||x).filter(Boolean),s=items.slice().sort((x,y)=>new Date(y.updatedAt||y.updated_at||0)-new Date(x.updatedAt||x.updated_at||0))[0];
    return s?{host,kind:"service",name:s.name,type:s.type,status:s.suspended?"suspended":s.suspendedAt?"suspended":s.state,updated:s.updatedAt||s.updated_at,url:s.serviceDetails?.url||s.url}:{host,empty:true};
  }
  const r=await axios.get("https://app.koyeb.com/v1/apps",{headers:{Authorization:"Bearer "+token}});
  const apps=r.data?.apps||r.data||[],a=apps.slice().sort((x,y)=>new Date(y.updated_at||y.updatedAt||0)-new Date(x.updated_at||x.updatedAt||0))[0];
  return a?{host,kind:"app",name:a.name,status:a.status,updated:a.updated_at||a.updatedAt,appId:a.id,url:a.domains?.[0]?.url||null}:{host,empty:true};
}
function formatHost(d){
  if(d.empty)return"ℹ️ No "+d.host+" projects/apps/services were found.";
  return"🚀 *"+d.host.toUpperCase()+" — Latest Resource*\\n\\n"+
    "📌 Name: "+(d.name||"N/A")+"\\n"+
    (d.kind?"🧩 Type: "+d.kind+"\\n":"")+
    (d.type?"🔧 Service Type: "+d.type+"\\n":"")+
    (d.framework?"🛠️ Framework: "+d.framework+"\\n":"")+
    (d.status?"📊 Status: "+d.status+"\\n":"")+
    (d.stack?"📦 Stack: "+d.stack+"\\n":"")+
    (d.region?"🌍 Region: "+d.region+"\\n":"")+
    (d.updated?"🕒 Updated: "+d.updated+"\\n":"")+
    (d.projectId?"🆔 Project ID: "+d.projectId+"\\n":"")+
    (d.appId?"🆔 App ID: "+d.appId+"\\n":"")+
    (d.url?"🔗 "+d.url:"");
}
async function hostingDeliver({sock,target,text}){
  const host=hostIntent(text);if(!host)return false;
  const details=await hostDetails(host);
  await sock.sendMessage(target,{text:formatHost(details)});
  return true;
}

function wantsCompleteStatus(text){
  const t=String(text||"").toLowerCase();
  const broad=/(complete|full|all|overall|project)\s*(status|details|report|summary)|status\s*(report|summary)/.test(t);
  const multi=["github","vercel","render","heroku","koyeb"].filter(x=>t.includes(x)).length>=2;
  return broad||multi;
}
async function githubSummary(text){
  if(!cfg.githubToken)return{configured:false};
  const api=githubApi(),repo=githubRepo(text);
  const r=await api.get("/repos/"+repo);
  const cmt=await api.get("/repos/"+repo+"/commits",{params:{per_page:1}});
  const latest=cmt.data?.[0];
  return{configured:true,repo,branch:r.data.default_branch||"main",private:!!r.data.private,updated:r.data.updated_at,stars:r.data.stargazers_count||0,latestCommit:latest?.sha?.slice(0,7)||"N/A",latestMessage:latest?.commit?.message?.split("\n")[0]||"N/A",latestCommitAt:latest?.commit?.author?.date||null,url:r.data.html_url};
}
function formatGithubSummary(d){
  if(!d.configured)return"🐙 GitHub: Not configured.";
  return"🐙 *GitHub*\n\n📦 Repository: "+d.repo+"\n🌿 Branch: "+d.branch+"\n🔒 Visibility: "+(d.private?"Private":"Public")+"\n⭐ Stars: "+d.stars+"\n🧾 Latest commit: "+d.latestCommit+" — "+d.latestMessage+"\n🕒 Commit time: "+(d.latestCommitAt||"N/A")+"\n🔗 "+d.url;
}
function hostAuthSafe(host){
  const token=host==="heroku"?cfg.herokuToken:host==="vercel"?cfg.vercelToken:host==="render"?cfg.renderApiKey:cfg.koyebToken;
  return!!token;
}
async function allHostingDetails(){
  const result=[];
  for(const host of ["heroku","vercel","render","koyeb"]){
    if(!hostAuthSafe(host))continue;
    try{result.push(await hostDetails(host));}catch(e){result.push({host,error:e.message});}
  }
  return result;
}
function formatDevOpsReport(github,hosts){
  const lines=["🧭 *TOHID-AGENT DEVOPS STATUS*","",formatGithubSummary(github),"","☁️ *Hosting*",""];
  if(!hosts.length)lines.push("No hosting integrations are configured.");
  for(const d of hosts){
    if(d.error){lines.push("❌ "+d.host.toUpperCase()+": "+d.error,"");continue;}
    if(d.empty){lines.push("ℹ️ "+d.host.toUpperCase()+": No resources found.","");continue;}
    lines.push("🚀 "+d.host.toUpperCase(),"📌 Name: "+(d.name||"N/A"),"📊 Status: "+(d.status||"N/A"),d.framework?"🛠️ Framework: "+d.framework:"",d.type?"🔧 Type: "+d.type:"",d.updated?"🕒 Updated: "+d.updated:"",d.url?"🔗 "+d.url:"","");
  }
  return lines.filter(Boolean).join("\n");
}
async function devopsDeliver({sock,target,text}){
  if(!wantsCompleteStatus(text))return false;
  const github=await githubSummary(text);
  const hosts=await allHostingDetails();
  await sock.sendMessage(target,{text:formatDevOpsReport(github,hosts)});
  return true;
}
async function smartShare({sock,target,text}){
  const host=hostIntent(text);
  if(!githubIntent(text)||!host)return false;
  await githubDeliver({sock,target,text});
  await sock.sendMessage(target,{text:formatHost(await hostDetails(host))});
  return true;
}

async function relay({sock,msg,text,downloadMedia,send}){
  const target=targetFromMessage(msg,text);if(!target)return false;
  const q=quoted(msg);
  try{
    const d=await devopsDeliver({sock,target,text});
    if(d){await send(sock,msg.key.remoteJid,"✅ Complete DevOps status was sent to the selected person.",{category:"utility"});return true;}
    const s=await smartShare({sock,target,text});
    if(s){await send(sock,msg.key.remoteJid,"✅ The requested GitHub resource and hosting details were sent by DM.",{category:"utility"});return true;}
    const h=await hostingDeliver({sock,target,text});
    if(h){await send(sock,msg.key.remoteJid,"✅ "+hostIntent(text).toUpperCase()+" details were sent by DM.",{category:"utility"});return true;}
    const g=await githubDeliver({sock,target,text});
    if(g){await send(sock,msg.key.remoteJid,"✅ The GitHub link/file was sent by DM.",{category:"utility"});return true;}
    if(!q){
      await send(sock,msg.key.remoteJid,"⚠️ Reply to a message or @mention the person and say: "send this to their DM". GitHub/hosting requests work the same way.");
      return true;
    }
    const m=media(q);
    if(m){
      const[type,node]=m,buf=await downloadMedia(node,type),payload={};
      payload[type]={url:buf};
      if(type==="document")payload.fileName=node.fileName||"file";
      if(type==="image"||type==="video")payload.caption="📩 Sent privately by TOHID-AGENT";
      if(type==="audio")payload.mimetype=node.mimetype||"audio/ogg; codecs=opus";
      await sock.sendMessage(target,payload);
    }else{
      const body=extractText(q);if(!body){await send(sock,msg.key.remoteJid,"⚠️ The replied message does not contain transferable text or media.");return true;}
      await sock.sendMessage(target,{text:body});
    }
    await send(sock,msg.key.remoteJid,"✅ Sent privately to the selected person.",{category:"utility"});
  }catch(e){await send(sock,msg.key.remoteJid,"❌ DM relay failed: "+e.message,{category:"error"});}
  return true;
}
module.exports={relay,targetFromMessage};