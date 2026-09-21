const fs=require("fs");
const path=require("path");
const QRCode=require("qrcode");

const ipHits=new Map();
const WINDOW=10*60*1000;
const MAX_HITS=5;
function ip(req){return String(req.headers["x-forwarded-for"]||req.socket.remoteAddress||"").split(",")[0].trim();}
function allowed(req){const key=ip(req),now=Date.now(),a=ipHits.get(key)||[];const fresh=a.filter(x=>now-x<WINDOW);if(fresh.length>=MAX_HITS)return false;fresh.push(now);ipHits.set(key,fresh);return true;}
function send(res,status,body,type="application/json"){res.writeHead(status,{"content-type":type,"cache-control":"no-store","x-content-type-options":"nosniff"});res.end(type==="application/json"?JSON.stringify(body):body);}
function body(req,max=32768){return new Promise((resolve,reject)=>{let raw="";let size=0;req.on("data",c=>{size+=c.length;if(size>max){reject(new Error("Request body too large"));req.destroy();return;}raw+=c;});req.on("end",()=>{try{resolve(raw?JSON.parse(raw):{});}catch{reject(new Error("Invalid JSON"));}});req.on("error",reject);});}

async function handle(req,res,manager){
  const url=new URL(req.url,"http://localhost");
  if(url.pathname==="/pair"&&req.method==="POST"){
    if(!allowed(req))return send(res,429,{error:"Too many pairing requests. Try again later."});
    try{
      const data=await body(req);
      const session=manager.create({phone:data.mode==="qr"?"":data.phone,mode:data.mode,env:data.env||{}});
      return send(res,201,{id:session.id,status:session.status,mode:session.mode,phone:session.phone});
    }catch(e){return send(res,400,{error:e.message||"Pairing request failed"});}
  }
  if((url.pathname==="/pair"||url.pathname==="/pair.html")&&req.method==="GET"){
    try{return send(res,200,fs.readFileSync(path.join(process.cwd(),"public/pair.html"),"utf8"),"text/html; charset=utf-8");}catch(e){return send(res,404,{error:"Pairing page not found"});}
  }
  const m=url.pathname.match(/^\/pair\/status\/([a-f0-9]{16})$/i);
  if(m&&req.method==="GET"){
    const s=manager.get(m[1]);if(!s)return send(res,404,{error:"Pairing session not found"});
    let out={...s};delete out.env;
    if(out.qr){try{const data=await QRCode.toDataURL(out.qr,{errorCorrectionLevel:"M",margin:1});out.qr=data.split(",")[1]||"";}catch{out.qr=null;}}
    return send(res,200,out);
  }
  const stop=url.pathname.match(/^\/pair\/stop\/([a-f0-9]{16})$/i);
  if(stop&&req.method==="POST"){
    const ok=await manager.stop(stop[1]);return send(res,ok?200:404,{ok});
  }
  return false;
}
module.exports={handle};
