const axios=require("axios");
const cfg=require("../config");

const APIs=Object.fromEntries(Object.entries(cfg.apiProviders||{}).map(([name,value])=>[name,value.baseUrl]));
const APIKeys=Object.fromEntries(Object.entries(cfg.apiProviders||{}).map(([name,value])=>[value.baseUrl,value.apiKey||""]));
global.APIs=APIs;
global.APIKeys=APIKeys;

const PROVIDERS={
  discard:{base:APIs.discard,key:APIKeys[APIs.discard]},
  lol:{base:APIs.lol,key:APIKeys[APIs.lol]},
  xteam:{base:APIs.xteam,key:APIKeys[APIs.xteam]},
  neoxr:{base:APIs.neoxr,key:APIKeys[APIs.neoxr]},
  violetics:{base:APIs.violetics,key:APIKeys[APIs.violetics]},
  zenzapis:{base:APIs.zenzapis,key:APIKeys[APIs.zenzapis]},
  fgmods:{base:APIs.fgmods,key:APIKeys[APIs.fgmods]},
  qasimdev:{base:APIs.qasimdev,key:APIKeys[APIs.qasimdev]}
};

const ROUTES={
  discard:{
    play:"/api/dl/vidsplay",song:"/api/dl/vidsplay",video:"/api/dl/vidsplay",
    ytmp3:"/api/dl/vidsplay",ytmp4:"/api/dl/vidsplay",facebook:"/api/dl/vidsplay",
    instagram:"/api/dl/vidsplay",tiktok:"/api/dl/vidsplay",twitter:"/api/dl/vidsplay",
    pinterest:"/api/dl/vidsplay",spotify:"/api/dl/vidsplay",mediafire:"/api/dl/vidsplay"
  },
  lol:{ytmp3:"/api/ytaudio",ytmp4:"/api/ytvideo",facebook:"/api/facebook"},
  qasimdev:{apk:"/api/androidapk/search"}
};

const FALLBACKS={
  play:["discard","lol"],song:["discard","lol"],video:["discard","lol"],
  ytmp3:["discard","lol"],ytmp4:["discard","lol"],facebook:["discard","lol"],
  instagram:["discard"],tiktok:["discard"],twitter:["discard"],pinterest:["discard"],
  spotify:["discard"],mediafire:["discard"],apk:["qasimdev"]
};

function endpoint(provider,command){
  const route=ROUTES[provider]&&ROUTES[provider][command];
  return route?PROVIDERS[provider].base+route:null;
}
function addParams(url,provider,command,input){
  const params=new URLSearchParams();
  const key=PROVIDERS[provider].key;
  if(key)params.set(provider==="qasimdev"?"apiKey":"apikey",key);
  params.set(provider==="qasimdev"&&command==="apk"?"query":"url",input);
  return url+"?"+params.toString();
}
function findMediaUrl(value){
  if(!value)return null;
  if(typeof value==="string"&&/^https?:\/\//i.test(value))return value;
  if(Array.isArray(value)){for(const x of value){const u=findMediaUrl(x);if(u)return u;}return null;}
  if(typeof value==="object"){
    for(const k of ["url","download","downloadUrl","download_url","video","audio","media","mediaUrl","media_url","link","result","data"]){
      const u=findMediaUrl(value[k]);if(u)return u;
    }
  }
  return null;
}
async function callProvider(provider,command,input){
  const url=endpoint(provider,command);
  if(!url)throw new Error("No route configured");
  const requestUrl=addParams(url,provider,command,input);
  const response=await axios.get(requestUrl,{timeout:60000,responseType:"arraybuffer",validateStatus:s=>s>=200&&s<500});
  const type=String(response.headers["content-type"]||"").toLowerCase();
  const body=Buffer.from(response.data);
  if(response.status>=400)throw new Error(provider+" HTTP "+response.status);
  if(type.includes("json")||type.includes("text/plain")||command==="apk"){
    let data;try{data=JSON.parse(body.toString("utf8"));}catch(_){data=null;}
    if(!data)throw new Error("Invalid JSON response from "+provider);
    if(command==="apk")return {type:"json",provider,data};
    const media=findMediaUrl(data);
    if(!media)throw new Error("No media URL in "+provider+" response");
    return {type:"url",url:media,provider,data};
  }
  return {type:"buffer",buffer:body,mime:type||"application/octet-stream",provider};
}
async function downloadMedia(command,input){
  const providers=FALLBACKS[command]||["discard"];
  const errors=[];
  for(const provider of providers){
    try{return await callProvider(provider,command,input);}
    catch(error){errors.push(provider+": "+String(error.message||error));}
  }
  throw new Error("All media providers failed. "+errors.join(" | "));
}
async function searchApk(query){
  return downloadMedia("apk",query);
}
module.exports={APIs,APIKeys,PROVIDERS,ROUTES,FALLBACKS,downloadMedia,searchApk,findMediaUrl};
