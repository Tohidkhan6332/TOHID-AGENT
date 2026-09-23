const fs=require("fs");
const path=require("path");
const QRCode=require("qrcode");
const freeDeploy=require("./freeDeploymentManager");

const ipHits=new Map(),WINDOW=10*60*1000,MAX_HITS=5;
function ip(req){return String(req.headers["x-forwarded-for"]||req.socket.remoteAddress||"").split(",")[0].trim();}
function allowed(req){const key=ip(req),now=Date.now(),a=(ipHits.get(key)||[]).filter(x=>now-x<WINDOW);if(a.length>=MAX_HITS)return false;a.push(now);ipHits.set(key,a);return true;}
function send(res,status,body,type="application/json"){res.writeHead(status,{"content-type":type,"cache-control":"no-store","x-content-type-options":"nosniff"});res.end(type==="application/json"?JSON.stringify(body):body);}
function body(req,max=32768){return new Promise((resolve,reject)=>{let raw="",size=0;req.on("data",c=>{size+=c.length;if(size>max){reject(new Error("Request body too large"));req.destroy();return;}raw+=c;});req.on("end",()=>{try{resolve(raw?JSON.parse(raw):{});}catch{reject(new Error("Invalid JSON"));}});req.on("error",reject);});}
async function qrData(value){try{const data=await QRCode.toDataURL(value,{errorCorrectionLevel:"M",margin:1});return data.split(",")[1]||"";}catch{return null;}}
async function handle(req,res,manager){
 const url=new URL(req.url,"http://localhost");
 if(req.method==="GET"&&["/sessionpair","/sessionpair.html","/pair","/pair.html","/session","/session.html"].includes(url.pathname)){
   const file=url.pathname.startsWith("/freepair")?"freepair.html":"pair.html";
   try{return send(res,200,fs.readFileSync(path.join(process.cwd(),"public",file),"utf8"),"text/html; charset=utf-8");}catch(e){return send(res,404,{error:"Pairing page not found"});}
 }
 if(req.method==="GET"&&["/freepair","/freepair.html"].includes(url.pathname)){
   try{return send(res,200,fs.readFileSync(path.join(process.cwd(),"public/freepair.html"),"utf8"),"text/html; charset=utf-8");}catch(e){return send(res,404,{error:"Free deployment page not found"});}
 }
 if(url.pathname==="/pair"&&req.method==="POST"){
   if(!allowed(req))return send(res,429,{error:"Too many pairing requests. Try again later."});
   try{const data=await body(req);const s=manager.create({phone:data.mode==="qr"?"":data.phone,mode:data.mode,env:data.env||{}});return send(res,201,{id:s.id,status:s.status,mode:s.mode,phone:s.phone});}
   catch(e){return send(res,400,{error:e.message||"Pairing request failed"});}
 }
 if(url.pathname==="/freepair"&&req.method==="POST"){
   if(!allowed(req))return send(res,429,{error:"Too many free deployment requests. Try again later."});
   try{const data=await body(req);const s=freeDeploy.create({phone:data.mode==="qr"?"":data.phone,mode:data.mode,duration:data.duration,env:data.env||{}},manager.cleanEnv);return send(res,201,s);}
   catch(e){return send(res,400,{error:e.message||"Free deployment failed"});}
 }
 let m=url.pathname.match(/^\/(?:pair|sessionpair)\/status\/([a-f0-9]{16})$/i);
 if(m&&req.method==="GET"){const s=manager.get(m[1]);if(!s)return send(res,404,{error:"Pairing session not found"});const out={...s};delete out.env;if(out.qr)out.qr=await qrData(out.qr);return send(res,200,out);}
 m=url.pathname.match(/^\/freepair\/status\/([a-f0-9]{16})$/i);
 if(m&&req.method==="GET"){const s=freeDeploy.get(m[1]);if(!s)return send(res,404,{error:"Free deployment not found"});const out={...s};if(out.qr)out.qr=await qrData(out.qr);return send(res,200,out);}
 m=url.pathname.match(/^\/(?:pair|sessionpair)\/stop\/([a-f0-9]{16})$/i);
 if(m&&req.method==="POST"){const ok=await manager.stop(m[1]);return send(res,ok?200:404,{ok});}
 m=url.pathname.match(/^\/freepair\/stop\/([a-f0-9]{16})$/i);
 if(m&&req.method==="POST"){const ok=await freeDeploy.stop(m[1]);return send(res,ok?200:404,{ok});}
 return false;
}
module.exports={handle};