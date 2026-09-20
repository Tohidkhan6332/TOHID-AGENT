const {ObjectId}=require("mongodb");
const db=require("./database");
const core=require("./agentCore");

const STATUS={
  QUEUED:"queued",
  RUNNING:"running",
  WAITING:"waiting_confirmation",
  COMPLETED:"completed",
  FAILED:"failed",
  CANCELLED:"cancelled"
};

function normalizeSteps(plan){
  return (plan?.steps||[]).map((s,i)=>({
    id:s.id||s.step||i+1,
    description:s.description||s.action||String(s),
    status:"pending",
    startedAt:null,
    completedAt:null,
    result:null
  }));
}

async function create(jid,request,meta={}){
  const d=await db.connect();
  const plan=core.createPlan(request);
  const mission={
    jid,request:String(request).trim(),mode:plan.mode||"autonomous",
    risk:plan.risk,confirmationRequired:!!plan.confirmationRequired,
    status:STATUS.QUEUED,progress:0,steps:normalizeSteps(plan),
    meta,createdAt:new Date(),updatedAt:new Date()
  };
  if(!d)return{...mission,id:null};
  const r=await d.collection("missions").insertOne(mission);
  const id=String(r.insertedId);
  await db.audit(jid,"mission_created",{missionId:id,risk:mission.risk,steps:mission.steps.length});
  return{...mission,id};
}

async function get(jid,id){
  const d=await db.connect(); if(!d||!ObjectId.isValid(id))return null;
  return d.collection("missions").findOne({_id:new ObjectId(id),jid});
}

async function update(jid,id,patch={}){
  const d=await db.connect(); if(!d||!ObjectId.isValid(id))return null;
  const safe={...patch,updatedAt:new Date()};
  delete safe._id; delete safe.jid;
  await d.collection("missions").updateOne({_id:new ObjectId(id),jid},{$set:safe});
  await db.audit(jid,"mission_updated",{missionId:id,status:safe.status,progress:safe.progress});
  return get(jid,id);
}

async function start(jid,id){
  const m=await get(jid,id); if(!m)return null;
  if([STATUS.COMPLETED,STATUS.FAILED,STATUS.CANCELLED].includes(m.status))return m;
  const status=m.confirmationRequired?STATUS.WAITING:STATUS.RUNNING;
  return update(jid,id,{status});
}

async function confirm(jid,id){
  const m=await get(jid,id); if(!m)return null;
  if(m.status!==STATUS.WAITING)return m;
  return update(jid,id,{status:STATUS.RUNNING});
}

async function cancel(jid,id,reason="Cancelled by user"){
  const m=await get(jid,id); if(!m)return null;
  if([STATUS.COMPLETED,STATUS.FAILED,STATUS.CANCELLED].includes(m.status))return m;
  return update(jid,id,{status:STATUS.CANCELLED,cancelReason:reason,completedAt:new Date()});
}

async function step(jid,id,stepId,status,result=null){
  const m=await get(jid,id); if(!m)return null;
  const steps=m.steps||[];
  const idx=steps.findIndex(s=>String(s.id)===String(stepId));
  if(idx<0)return m;
  const now=new Date();
  const next=steps.map((s,i)=>i===idx?{...s,status,result,...(status==="running"?{startedAt:now}:{}),...(status==="completed"||status==="failed"?{completedAt:now}:{})}:s);
  const done=next.filter(s=>s.status==="completed").length;
  const progress=next.length?Math.round(done/next.length*100):100;
  const finalStatus=status==="failed"?STATUS.FAILED:(progress===100?STATUS.COMPLETED:STATUS.RUNNING);
  return update(jid,id,{steps:next,progress,status:finalStatus,...(finalStatus===STATUS.COMPLETED||finalStatus===STATUS.FAILED?{completedAt:now}:{})});
}

async function list(jid,limit=10){
  const d=await db.connect(); if(!d)return[];
  return d.collection("missions").find({jid}).sort({createdAt:-1}).limit(Math.min(Math.max(Number(limit)||10,1),30)).project({request:1,status:1,risk:1,progress:1,steps:1,createdAt:1,updatedAt:1,confirmationRequired:1}).toArray();
}

module.exports={STATUS,create,get,update,start,confirm,cancel,step,list};
