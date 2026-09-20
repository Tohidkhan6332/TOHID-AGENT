const {ObjectId}=require("mongodb");
const db=require("./database");

let timer=null;
let running=false;
const handlers=new Map();

function normalizeDate(value){
  const d=new Date(value);
  if(Number.isNaN(d.getTime()))throw new Error("Invalid schedule time.");
  return d;
}

async function add(jid,runAt,payload={},repeatMs=0){
  const d=await db.connect();
  const doc={jid,runAt:normalizeDate(runAt),payload,repeatMs:Number(repeatMs)||0,status:"scheduled",createdAt:new Date(),updatedAt:new Date()};
  if(!d)return{...doc,id:null};
  const r=await d.collection("scheduled_jobs").insertOne(doc);
  await db.audit(jid,"schedule_created",{jobId:String(r.insertedId),runAt:doc.runAt.toISOString()});
  return{...doc,id:String(r.insertedId)};
}

async function cancel(jid,id){
  const d=await db.connect();
  if(!d||!ObjectId.isValid(id))return false;
  const r=await d.collection("scheduled_jobs").updateOne({_id:new ObjectId(id),jid,status:"scheduled"},{$set:{status:"cancelled",updatedAt:new Date()}});
  if(r.modifiedCount)await db.audit(jid,"schedule_cancelled",{jobId:id});
  return !!r.modifiedCount;
}

async function list(jid,limit=10){
  const d=await db.connect();if(!d)return[];
  return d.collection("scheduled_jobs").find({jid,status:"scheduled"}).sort({runAt:1}).limit(Math.min(Math.max(Number(limit)||10,1),30)).project({payload:1,runAt:1,repeatMs:1,status:1,createdAt:1}).toArray();
}

function register(type,handler){handlers.set(type,handler);}

async function tick(){
  if(running)return;
  running=true;
  try{
    const d=await db.connect();if(!d)return;
    const now=new Date();
    const jobs=await d.collection("scheduled_jobs").find({status:"scheduled",runAt:{$lte:now}}).limit(20).toArray();
    for(const job of jobs){
      const handler=handlers.get(job.payload?.type);
      try{
        if(handler)await handler(job);
        else await db.audit(job.jid,"schedule_skipped",{jobId:String(job._id),reason:"No handler registered"});
        if(job.repeatMs>0)await d.collection("scheduled_jobs").updateOne({_id:job._id},{$set:{runAt:new Date(Date.now()+job.repeatMs),updatedAt:new Date()}});
        else await d.collection("scheduled_jobs").updateOne({_id:job._id},{$set:{status:"completed",updatedAt:new Date()}});
      }catch(e){
        await d.collection("scheduled_jobs").updateOne({_id:job._id},{$set:{status:"failed",error:String(e?.message||e),updatedAt:new Date()}});
        await db.audit(job.jid,"schedule_failed",{jobId:String(job._id),error:String(e?.message||e)});
      }
    }
  }finally{running=false;}
}

function start(intervalMs=60000){
  if(timer)return;
  timer=setInterval(()=>tick().catch(()=>{}),Math.max(10000,Number(intervalMs)||60000));
  tick().catch(()=>{});
}
function stop(){if(timer){clearInterval(timer);timer=null;}}

module.exports={add,cancel,list,register,tick,start,stop};
