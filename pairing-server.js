const http=require("http");
const fs=require("fs");
const path=require("path");
const cfg=require("./config");
const db=require("./lib/database");
const pairingManager=require("./lib/pairingManager");
const pairingWeb=require("./lib/pairingWeb");

async function main(){
  if(!cfg.sessionStoreSecret||cfg.sessionStoreSecret.length<32)throw new Error("SESSION_STORE_SECRET must be at least 32 characters.");
  if(!cfg.mongoUri&&!cfg.postgresUrl)throw new Error("MONGO_URI or POSTGRES_URL is required for pairing-web session storage.");
  await db.connect();
  const port=Number(process.env.PORT||3000);
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error("Invalid PORT: "+process.env.PORT);
  const server=http.createServer(async(req,res)=>{
    try{
      const handled=await pairingWeb.handle(req,res,pairingManager);
      if(handled)return;
      if(req.url==="/health"||req.url==="/healthz"){
        const s=await db.stats();
        res.writeHead(200,{"content-type":"application/json","cache-control":"no-store"});
        return res.end(JSON.stringify({name:"TOHID-AGENT Pairing Web",status:"online",database:s.database,activePairings:pairingManager.stats().active}));
      }
      if(req.url==="/"||req.url==="/index.html"){
        res.writeHead(302,{location:"/pair","cache-control":"no-store"});return res.end();
      }
      res.writeHead(404,{"content-type":"application/json"});res.end(JSON.stringify({error:"Not found"}));
    }catch(error){
      if(!res.headersSent){res.writeHead(503,{"content-type":"application/json"});res.end(JSON.stringify({error:"Pairing service unavailable"}));}
    }
  });
  server.listen(port,"0.0.0.0",()=>console.log("🔐 TOHID-AGENT Pairing Web listening on 0.0.0.0:"+port));
  const shutdown=async()=>{try{for(const s of pairingManager.list())await pairingManager.stop(s.id);}catch{}try{await db.close();}catch{}try{server.close();}catch{}process.exit(0);};
  process.once("SIGTERM",shutdown);
  process.once("SIGINT",shutdown);
}
main().catch(error=>{console.error("❌ Pairing Web startup failed:",error?.stack||error?.message||error);process.exit(1);});