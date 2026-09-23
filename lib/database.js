const {MongoClient}=require("mongodb");
const {Pool}=require("pg");
const cfg=require("../config");

let mongoClient,mongoDb,pgPool,mongoUnavailable=false;

function mongoEnabled(){return Boolean(cfg.mongoUri);}
function postgresEnabled(){return Boolean(cfg.postgresUrl);}

async function connectMongo(){
  if(!mongoEnabled()||mongoUnavailable)return null;
  if(mongoDb)return mongoDb;
  try{
    mongoClient=new MongoClient(cfg.mongoUri);
    await mongoClient.connect();
    mongoDb=mongoClient.db(cfg.mongoDb);
  await Promise.all([
    mongoDb.collection("users").createIndex({jid:1},{unique:true}),
    mongoDb.collection("conversations").createIndex({jid:1},{unique:true}),
    mongoDb.collection("usage").createIndex({jid:1},{unique:true}),
    mongoDb.collection("blocked").createIndex({jid:1},{unique:true}),
    mongoDb.collection("settings").createIndex({jid:1},{unique:true}),
    mongoDb.collection("profiles").createIndex({jid:1},{unique:true}),
    mongoDb.collection("pending_writes").createIndex({jid:1},{unique:true}),
    mongoDb.collection("audit_logs").createIndex({jid:1,createdAt:-1}),
    mongoDb.collection("agent_tasks").createIndex({jid:1,createdAt:-1}),
    mongoDb.collection("missions").createIndex({jid:1,createdAt:-1}),
    mongoDb.collection("missions").createIndex({jid:1,status:1,updatedAt:-1}),
    mongoDb.collection("scheduled_jobs").createIndex({status:1,runAt:1}),
    mongoDb.collection("scheduled_jobs").createIndex({jid:1,runAt:1}),
    mongoDb.collection("delegated_owners").createIndex({number:1},{unique:true}),
    mongoDb.collection("whatsapp_sessions").createIndex({tokenHash:1},{unique:true}),
    mongoDb.collection("whatsapp_sessions").createIndex({updatedAt:-1})
  ]);
    return mongoDb;
  }catch(error){
    mongoUnavailable=true;
    try{if(mongoClient)await mongoClient.close();}catch{}
    mongoClient=null;
    mongoDb=null;
    if(postgresEnabled())return null;
    throw error;
  }
}

async function connectPostgres(){
  if(!postgresEnabled())return null;
  if(!pgPool)pgPool=new Pool({connectionString:cfg.postgresUrl,ssl:cfg.postgresSsl?{rejectUnauthorized:false}:undefined,max:cfg.postgresPoolMax});
  await pgPool.query(`CREATE TABLE IF NOT EXISTS tohid_agent_records (
    namespace TEXT NOT NULL,
    record_key TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(namespace,record_key)
  )`);
  return pgPool;
}

async function connect(){
  const mongo=await connectMongo();
  const pg=await connectPostgres();
  return mongo||pg||null;
}

async function close(){
  if(mongoClient){await mongoClient.close();mongoClient=null;mongoDb=null;}
  mongoUnavailable=false;
  if(pgPool){await pgPool.end();pgPool=null;}
}

async function pgGet(namespace,key){
  const pg=await connectPostgres(); if(!pg)return null;
  const r=await pg.query("SELECT data FROM tohid_agent_records WHERE namespace=$1 AND record_key=$2",[namespace,String(key)]);
  return r.rows[0]?.data??null;
}
async function pgPut(namespace,key,data){
  const pg=await connectPostgres(); if(!pg)return;
  await pg.query(`INSERT INTO tohid_agent_records(namespace,record_key,data)
    VALUES($1,$2,$3::jsonb)
    ON CONFLICT(namespace,record_key) DO UPDATE SET data=EXCLUDED.data,updated_at=NOW()`,[namespace,String(key),JSON.stringify(data)]);
}
async function pgDelete(namespace,key){
  const pg=await connectPostgres(); if(pg)await pg.query("DELETE FROM tohid_agent_records WHERE namespace=$1 AND record_key=$2",[namespace,String(key)]);
}
async function pgList(namespace){
  const pg=await connectPostgres(); if(!pg)return[];
  return (await pg.query("SELECT data FROM tohid_agent_records WHERE namespace=$1 ORDER BY created_at ASC",[namespace])).rows.map(r=>r.data);
}

async function getMemory(jid){
  const d=await connectMongo(); if(d)return(await d.collection("conversations").findOne({jid}))?.messages||[];
  return(await pgGet("conversations",jid))?.messages||[];
}
async function saveMemory(jid,messages){
  const data={jid,messages:messages.slice(-cfg.maxMemoryMessages),updatedAt:new Date().toISOString()};
  const d=await connectMongo(); if(d)await d.collection("conversations").updateOne({jid},{$set:data},{upsert:true});
  if(postgresEnabled())await pgPut("conversations",jid,data);
}
async function clearMemory(jid){
  const d=await connectMongo(); if(d)await d.collection("conversations").deleteOne({jid});
  await pgDelete("conversations",jid);
}
async function getProfile(jid){
  const d=await connectMongo(); if(d)return(await d.collection("profiles").findOne({jid}))||{};
  return(await pgGet("profiles",jid))||{};
}
async function setProfile(jid,patch){
  const current=await getProfile(jid);
  const data={...current,...patch,jid,updatedAt:new Date().toISOString()};
  const d=await connectMongo(); if(d)await d.collection("profiles").updateOne({jid},{$set:data},{upsert:true});
  if(postgresEnabled())await pgPut("profiles",jid,data);
  return data;
}
async function track(jid,type){
  const now=new Date().toISOString();
  const d=await connectMongo();
  if(d)await d.collection("users").updateOne({jid},{$set:{lastSeen:new Date()},$setOnInsert:{createdAt:new Date()}},{upsert:true});
  if(d)await d.collection("usage").updateOne({jid},{$inc:{[type]:1},$set:{updatedAt:new Date()}},{upsert:true});
  const u=(await pgGet("usage",jid))||{jid};
  u[type]=(Number(u[type])||0)+1;u.updatedAt=now;
  if(postgresEnabled())await pgPut("usage",jid,u);
  const p=(await pgGet("users",jid))||{jid,createdAt:now};p.lastSeen=now;
  if(postgresEnabled())await pgPut("users",jid,p);
}
async function setBlocked(jid,blocked=true){
  const d=await connectMongo();
  if(d){
    if(blocked)await d.collection("blocked").updateOne({jid},{$set:{jid,updatedAt:new Date()}},{upsert:true});
    else await d.collection("blocked").deleteOne({jid});
  }
  if(blocked)await pgPut("blocked",jid,{jid,updatedAt:new Date().toISOString()});else await pgDelete("blocked",jid);
  return true;
}
async function isBlocked(jid){
  const d=await connectMongo(); if(d)return!!(await d.collection("blocked").findOne({jid}));
  return Boolean(await pgGet("blocked",jid));
}
async function getSettings(jid){
  const d=await connectMongo(); if(d)return(await d.collection("settings").findOne({jid}))||{};
  return(await pgGet("settings",jid))||{};
}
async function setSettings(jid,patch){
  const current=await getSettings(jid);
  const data={...current,...patch,jid,updatedAt:new Date().toISOString()};
  const d=await connectMongo(); if(d)await d.collection("settings").updateOne({jid},{$set:data},{upsert:true});
  if(postgresEnabled())await pgPut("settings",jid,data);
  return data;
}
async function savePending(jid,pending){
  const d=await connectMongo();
  if(d){
    if(pending)await d.collection("pending_writes").updateOne({jid},{$set:{jid,pending,updatedAt:new Date()}},{upsert:true});
    else await d.collection("pending_writes").deleteOne({jid});
  }
  if(pending)await pgPut("pending_writes",jid,{jid,pending,updatedAt:new Date().toISOString()});else await pgDelete("pending_writes",jid);
}
async function getPending(jid){
  const d=await connectMongo(); if(d)return(await d.collection("pending_writes").findOne({jid}))?.pending||null;
  return(await pgGet("pending_writes",jid))?.pending||null;
}
async function audit(jid,action,meta={}){
  const d=await connectMongo(); if(d)await d.collection("audit_logs").insertOne({jid,action,meta,createdAt:new Date()});
  if(postgresEnabled())await pgPut("audit_logs",`${jid}:${Date.now()}:${Math.random()}`,{jid,action,meta,createdAt:new Date().toISOString()});
}
async function getGlobalConfig(){
  const d=await connectMongo(); if(d)return(await d.collection("global_config").findOne({_id:"runtime"}))?.values||{};
  return(await pgGet("global_config","runtime"))?.values||{};
}
async function setGlobalConfig(patch){
  const data={values:patch,updatedAt:new Date().toISOString()};
  const d=await connectMongo(); if(d)await d.collection("global_config").updateOne({_id:"runtime"},{$set:data},{upsert:true});
  if(postgresEnabled())await pgPut("global_config","runtime",data);
  return patch;
}
async function getDelegatedOwners(){
  const d=await connectMongo(); if(d)return(await d.collection("delegated_owners").find({}).sort({createdAt:1}).toArray()).map(x=>x.number);
  return(await pgList("delegated_owners")).map(x=>x.number);
}
async function addDelegatedOwner(number,addedBy){
  const n=String(number||"").replace(/\D/g,""); if(!n)return false;
  const d=await connectMongo();
  if(d)await d.collection("delegated_owners").updateOne({number:n},{$set:{number:n,updatedAt:new Date()},$setOnInsert:{createdAt:new Date(),addedBy}},{upsert:true});
  if(postgresEnabled())await pgPut("delegated_owners",n,{number:n,addedBy,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
  return true;
}
async function removeDelegatedOwner(number){
  const n=String(number||"").replace(/\D/g,""); if(!n)return false;
  const d=await connectMongo(); if(d)await d.collection("delegated_owners").deleteOne({number:n});
  await pgDelete("delegated_owners",n); return true;
}
async function clearDelegatedOwners(){
  const d=await connectMongo(); const mongoCount=d?(await d.collection("delegated_owners").deleteMany({})).deletedCount||0:0;
  const pg=await connectPostgres(); if(pg)await pg.query("DELETE FROM tohid_agent_records WHERE namespace='delegated_owners'");
  return mongoCount;
}
async function saveWhatsAppSession(tokenHash,payload,meta={}){
  const data={tokenHash,payload,phone:meta.phone||"",createdAt:new Date(meta.createdAt||Date.now()),updatedAt:new Date(meta.updatedAt||Date.now())};
  const d=await connectMongo();
  if(d){await d.collection("whatsapp_sessions").replaceOne({tokenHash},data,{upsert:true});return true;}
  if(postgresEnabled())await pgPut("whatsapp_sessions",tokenHash,{...data,createdAt:data.createdAt.toISOString(),updatedAt:data.updatedAt.toISOString()});
  else throw new Error("A database is required for portable SESSION_ID storage.");
  return true;
}
async function getWhatsAppSession(tokenHash){
  const d=await connectMongo();
  if(d)return await d.collection("whatsapp_sessions").findOne({tokenHash});
  return await pgGet("whatsapp_sessions",tokenHash);
}
async function touchWhatsAppSession(tokenHash){
  const now=new Date();
  const d=await connectMongo();
  if(d){await d.collection("whatsapp_sessions").updateOne({tokenHash},{$set:{updatedAt:now,lastUsedAt:now}});return;}
  const row=await pgGet("whatsapp_sessions",tokenHash);
  if(row)await pgPut("whatsapp_sessions",tokenHash,{...row,updatedAt:now.toISOString(),lastUsedAt:now.toISOString()});
}
async function deleteWhatsAppSession(tokenHash){
  const d=await connectMongo();
  if(d)return (await d.collection("whatsapp_sessions").deleteOne({tokenHash})).deletedCount>0;
  const existing=await pgGet("whatsapp_sessions",tokenHash);
  if(existing){await pgDelete("whatsapp_sessions",tokenHash);return true;}
  return false;
}
async function getBaileysAuth(){
  const d=await connectMongo();
  if(d){
    const doc=await d.collection("baileys_auth").findOne({_id:"state"});
    return {creds:doc?.creds||null,source:"mongodb"};
  }
  const data=await pgGet("baileys_auth","state");
  return {creds:data?.creds||null,source:"postgresql"};
}
async function setBaileysCreds(creds){
  const d=await connectMongo();
  if(d)await d.collection("baileys_auth").replaceOne({_id:"state"},{_id:"state",creds},{upsert:true});
  if(postgresEnabled())await pgPut("baileys_auth","state",{creds,updatedAt:new Date().toISOString()});
}
async function getBaileysKey(id){
  const d=await connectMongo();
  if(d){const x=await d.collection("baileys_keys").findOne({_id:id});return x?.value||null;}
  return (await pgGet("baileys_keys",id))?.value||null;
}
async function setBaileysKeys(entries){
  const d=await connectMongo();
  if(d){
    const ops=[];
    for(const [id,value] of Object.entries(entries)){
      if(value===null)ops.push({deleteOne:{filter:{_id:id}}});
      else ops.push({replaceOne:{filter:{_id:id},replacement:{_id:id,value},upsert:true}});
    }
    if(ops.length)await d.collection("baileys_keys").bulkWrite(ops,{ordered:false});
  }
  if(postgresEnabled())for(const [id,value] of Object.entries(entries)){
    if(value===null)await pgDelete("baileys_keys",id);else await pgPut("baileys_keys",id,{value});
  }
}
async function clearBaileysAuth(){
  const d=await connectMongo();
  if(d)await Promise.all([d.collection("baileys_auth").deleteMany({}),d.collection("baileys_keys").deleteMany({})]);
  const pg=await connectPostgres();if(pg)await pg.query("DELETE FROM tohid_agent_records WHERE namespace IN ('baileys_auth','baileys_keys')");
}
async function stats(){
  const d=await connectMongo();
  if(d){
    const[users,usage,blocked]=await Promise.all([
      d.collection("users").countDocuments(),
      d.collection("usage").aggregate([{$group:{_id:null,chat:{$sum:"$chat"},voice:{$sum:"$voice"},image:{$sum:"$image"},video:{$sum:"$video"},github_write:{$sum:"$github_write"},tool:{$sum:"$tool"}}}]).toArray(),
      d.collection("blocked").countDocuments()
    ]);
    return{database:true,databaseType:postgresEnabled()?"mongodb+postgresql":"mongodb",users,blocked,usage:usage[0]||{chat:0,voice:0,image:0,video:0,github_write:0,tool:0}};
  }
  const pg=await connectPostgres();
  if(!pg)return{database:false,databaseType:"none"};
  const rows=await pg.query("SELECT data FROM tohid_agent_records WHERE namespace='users'");
  const blocked=(await pg.query("SELECT COUNT(*)::int AS count FROM tohid_agent_records WHERE namespace='blocked'")).rows[0].count;
  const usage={chat:0,voice:0,image:0,video:0,github_write:0,tool:0};
  for(const r of (await pg.query("SELECT data FROM tohid_agent_records WHERE namespace='usage'")).rows)for(const k of Object.keys(usage))usage[k]+=Number(r.data?.[k])||0;
  return{database:true,databaseType:"postgresql",users:rows.length,blocked:Number(blocked),usage};
}
function status(){
  return{mongodb:mongoEnabled(),postgresql:postgresEnabled(),primary:mongoEnabled()?"mongodb":postgresEnabled()?"postgresql":"none"};
}
module.exports={connect,close,status,getBaileysAuth,setBaileysCreds,getBaileysKey,setBaileysKeys,clearBaileysAuth,getMemory,saveMemory,clearMemory,getProfile,setProfile,track,setBlocked,isBlocked,getSettings,setSettings,savePending,getPending,audit,getGlobalConfig,setGlobalConfig,getDelegatedOwners,addDelegatedOwner,removeDelegatedOwner,clearDelegatedOwners,stats};
