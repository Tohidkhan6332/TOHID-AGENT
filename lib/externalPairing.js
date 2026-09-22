const axios=require("axios");

const BASE_URL=process.env.MEGA_PAIRING_URL||"https://mega-pairing.onrender.com";
const PAIR_PATH=process.env.MEGA_PAIRING_PATH||"/pair";
const TIMEOUT=Number(process.env.MEGA_PAIRING_TIMEOUT_MS||30000);

function cleanPhone(value){return String(value||"").replace(/\D/g,"");}
function extractCode(value){
  if(!value)return null;
  if(typeof value==="string"){
    const m=value.match(/\b([A-Z0-9]{4}[- ]?[A-Z0-9]{4})\b/i)||value.match(/\b(\d{8})\b/);
    return m?m[1].replace(/[ -]/g,""):null;
  }
  if(Array.isArray(value)){for(const x of value){const c=extractCode(x);if(c)return c;}return null;}
  if(typeof value==="object"){
    for(const k of ["pairCode","pairingCode","code","pair","data","result"]){const c=extractCode(value[k]);if(c)return c;}
  }
  return null;
}
function extractSession(value){
  if(!value)return null;
  if(typeof value==="string"&&/session/i.test(value))return value;
  if(Array.isArray(value)){for(const x of value){const s=extractSession(x);if(s)return s;}return null;}
  if(typeof value==="object"){
    for(const k of ["sessionId","sessionID","session","session_id","data","result"]){const s=extractSession(value[k]);if(s)return s;}
  }
  return null;
}
async function request(pathname,params={}){
  const url=new URL(pathname,BASE_URL.endsWith("/")?BASE_URL:BASE_URL+"/");
  for(const [k,v] of Object.entries(params)){if(v!==undefined&&v!==null&&String(v)!=="")url.searchParams.set(k,String(v));}
  const response=await axios.get(url.toString(),{timeout:TIMEOUT,validateStatus:s=>s>=200&&s<500});
  if(response.status>=400)throw new Error("MEGA pairing HTTP "+response.status);
  return response.data;
}
async function pair(number){
  const phone=cleanPhone(number);
  if(phone.length<10||phone.length>15)throw new Error("Invalid phone number.");
  const data=await request(PAIR_PATH,{number:phone,phoneNumber:phone,code:phone});
  const pairCode=extractCode(data);
  const sessionId=extractSession(data);
  return {ok:true,provider:"mega-pairing",pairCode,sessionId,data};
}
async function qr(){
  const data=await request(PAIR_PATH,{mode:"qr"});
  return {ok:true,provider:"mega-pairing",qr:data};
}
module.exports={BASE_URL,PAIR_PATH,pair,qr,extractCode,extractSession};
