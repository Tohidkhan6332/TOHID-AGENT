const db=require("./database");
const cfg=require("../config");

const RISK={
  read:"low",
  write:"medium",
  deploy:"high",
  delete:"critical",
  config:"critical"
};

function classifyAction(action=""){
  const a=String(action).toLowerCase();
  if(/delete|destroy|remove|drop|erase/.test(a))return RISK.delete;
  if(/deploy|redeploy|publish|release|scale|pause|resume|restart|stop|start/.test(a))return RISK.deploy;
  if(/config|secret|credential|token|permission/.test(a))return RISK.config;
  if(/create|update|edit|write|commit|push/.test(a))return RISK.write;
  return RISK.read;
}

function createPlan(request){
  const text=String(request||"").trim();
  const steps=[];
  if(/build|create|make|develop|website|app|project/i.test(text)){
    steps.push("Understand requirements and identify the required project files.");
    steps.push("Generate or update the complete project structure.");
    steps.push("Run safe validation checks before external changes.");
  }
  if(/github|repo|repository|upload|push/i.test(text)){
    steps.push("Create/select the GitHub repository and prepare the required commit.");
  }
  if(/vercel|render|koyeb|heroku|deploy|hosting/i.test(text)){
    steps.push("Deploy through the configured hosting adapter.");
    steps.push("Verify the returned deployment/service status and URL.");
  }
  if(!steps.length)steps.push("Understand the request, select the required skills, execute read-only work first, then verify the result.");
  return {
    mode:"autonomous",
    request:text,
    risk:classifyAction(text),
    steps:steps.map((description,i)=>({id:i+1,description,status:"planned"})),
    confirmationRequired:/delete|destroy|deploy|redeploy|publish|config|secret|credential|token|write|commit|push|scale|pause|resume|restart|stop|start/i.test(text),
    verification:"Required after every external side effect"
  };
}

function detectLanguage(text=""){
  const t=String(text);
  if(/[\u0900-\u097F]/.test(t))return"hi";
  if(/[\u0980-\u09FF]/.test(t))return"bn";
  if(/[\u0A00-\u0A7F]/.test(t))return"pa";
  if(/[\u0600-\u06FF]/.test(t))return"ur-ar";
  if(/[\u0B80-\u0BFF]/.test(t))return"ta";
  if(/[\u0C00-\u0C7F]/.test(t))return"te";
  if(/[\u0900-\u097F]/.test(t))return"hi";
  return"en";
}

async function startTask(jid,request){
  const d=await db.connect();
  if(!d)return{enabled:false,plan:createPlan(request)};
  const plan=createPlan(request);
  const task={jid,request,plan,status:"planned",createdAt:new Date(),updatedAt:new Date()};
  const r=await d.collection("agent_tasks").insertOne(task);
  await db.audit(jid,"agent_task_created",{taskId:String(r.insertedId),risk:plan.risk});
  return{enabled:true,taskId:String(r.insertedId),plan};
}

async function completeTask(jid,taskId,status="completed",meta={}){
  const d=await db.connect();
  if(!d)return false;
  const {ObjectId}=require("mongodb");
  if(!ObjectId.isValid(taskId))return false;
  await d.collection("agent_tasks").updateOne({_id:new ObjectId(taskId),jid},{$set:{status,meta,updatedAt:new Date()}});
  await db.audit(jid,"agent_task_"+status,{taskId,meta});
  return true;
}

async function recentTasks(jid,limit=5){
  const d=await db.connect();
  if(!d)return[];
  return d.collection("agent_tasks").find({jid}).sort({createdAt:-1}).limit(Math.min(Number(limit)||5,20)).project({request:1,status:1,createdAt:1,updatedAt:1,plan:1,meta:1}).toArray();
}

function health(){
  return{
    name:cfg.brand,
    version:cfg.version,
    mode:cfg.agentMode,
    planner:cfg.plannerEnabled,
    providers:{openai:!!cfg.openaiKey,gemini:!!cfg.geminiKey},
    integrations:{github:!!cfg.githubToken,heroku:!!cfg.herokuToken,vercel:!!cfg.vercelToken,render:!!cfg.renderApiKey,koyeb:!!cfg.koyebToken},
    safety:{confirmation:true,secretMasking:true,verification:true}
  };
}

module.exports={RISK,classifyAction,createPlan,detectLanguage,startTask,completeTask,recentTasks,health};
