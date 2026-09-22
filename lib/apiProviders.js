const axios=require("axios");

const APIs={
  xteam:process.env.XTEAM_API_URL||"https://api.xteam.xyz",
  dzx:process.env.DZX_API_URL||"https://api.dhamzxploit.my.id",
  lol:process.env.LOL_API_URL||"https://api.lolhuman.xyz",
  violetics:process.env.VIOLETICS_API_URL||"https://violetics.pw",
  neoxr:process.env.NEOXR_API_URL||"https://api.neoxr.my.id",
  zenzapis:process.env.ZENZAPIS_API_URL||"https://zenzapis.xyz",
  akuari:process.env.AKUARI_API_URL||"https://api.akuari.my.id",
  akuari2:process.env.AKUARI2_API_URL||"https://apimu.my.id",
  nrtm:process.env.NRTM_API_URL||"https://fg-nrtm.ddns.net",
  bg:process.env.BG_API_URL||"http://bochil.ddns.net",
  fgmods:process.env.FGMODS_API_URL||"https://api-fgmods.ddns.net",
  discard:process.env.DISCARD_API_URL||"https://discardapi.dpdns.org"
};

const APIKeys={
  [APIs.xteam]:process.env.XTEAM_API_KEY||"",
  [APIs.lol]:process.env.LOL_API_KEY||"",
  [APIs.neoxr]:process.env.NEOXR_API_KEY||"",
  [APIs.violetics]:process.env.VIOLETICS_API_KEY||"",
  [APIs.zenzapis]:process.env.ZENZAPIS_API_KEY||"",
  [APIs.fgmods]:process.env.FGMODS_API_KEY||"",
  [APIs.discard]:process.env.DISCARD_API_KEY||"guru"
};

const MEDIA_ENDPOINT=process.env.MEDIA_API_URL||APIs.discard+"/api/dl/vidsplay";
const MEDIA_KEY=process.env.MEDIA_API_KEY||APIKeys[APIs.discard];

function buildMediaUrl(input){
  const url=String(input||"").trim();
  if(!url)return null;
  const sep=MEDIA_ENDPOINT.includes("?")?"&":"?";
  return MEDIA_ENDPOINT+sep+"apikey="+encodeURIComponent(MEDIA_KEY)+"&url="+encodeURIComponent(url);
}

function findMediaUrl(value){
  if(!value)return null;
  if(typeof value==="string"&&/^https?:\/\//i.test(value))return value;
  if(Array.isArray(value)){for(const x of value){const u=findMediaUrl(x);if(u)return u;}return null;}
  if(typeof value==="object"){
    for(const k of ["url","download","downloadUrl","download_url","media","mediaUrl","media_url","result","data","link"]){
      const u=findMediaUrl(value[k]);if(u)return u;
    }
  }
  return null;
}

async function downloadMedia(input,{timeout=60000}={}){
  const endpoint=buildMediaUrl(input);
  if(!endpoint)throw new Error("A media URL is required.");
  const response=await axios.get(endpoint,{timeout,responseType:"arraybuffer",validateStatus:s=>s>=200&&s<500});
  const type=String(response.headers["content-type"]||"").toLowerCase();
  if(type.includes("application/json")||type.includes("text/json")){
    let data;
    try{data=JSON.parse(Buffer.from(response.data).toString("utf8"));}catch(_){data=null;}
    const media=findMediaUrl(data);
    if(!media)throw new Error("Provider returned no downloadable media URL.");
    return {type:"url",url:media,data};
  }
  if(response.status>=400)throw new Error("Media provider returned HTTP "+response.status+".");
  return {type:"buffer",buffer:Buffer.from(response.data),mime:type||"application/octet-stream"};
}

module.exports={APIs,APIKeys,MEDIA_ENDPOINT,MEDIA_KEY,buildMediaUrl,downloadMedia,findMediaUrl};
