const cfg=require("../config");

const PROTECTED=new Set([
  "github_write_file","github_create_branch","github_create_issue","github_create_pull_request",
  "heroku_restart_app","heroku_stop_app","heroku_start_app","heroku_scale_app","heroku_redeploy","heroku_rollback","heroku_cancel_build","heroku_set_config_var","heroku_delete_config_var","heroku_maintenance"
]);

const READ_ONLY=new Set([
  "calculator","system_info","current_time","agent_plan",
  "github_list_repositories","github_search_repositories","github_search_issues",
  "github_search_commits","github_read_file","heroku_list_apps","heroku_app_info","heroku_releases","heroku_release_info","heroku_builds","heroku_build_info","heroku_build_result","heroku_logs","heroku_config_vars"
]);

function risk(name){
  if(PROTECTED.has(name))return"high";
  if(READ_ONLY.has(name))return"low";
  return"medium";
}

function label(name){
  return String(name||"").replace(/^github_/,"GitHub ").replace(/^heroku_/,"Heroku ").replace(/_/g," ");
}

function planForTool(name,args={}){
  return {
    mode:"tool",
    version:cfg.version,
    action:label(name),
    risk:risk(name),
    requires_confirmation:PROTECTED.has(name),
    steps:[
      {step:1,action:"prepare",tool:name},
      ...(PROTECTED.has(name)?[{step:2,action:"confirm",tool:name}]:[]),
      {step:PROTECTED.has(name)?3:2,action:"execute",tool:name},
      {step:PROTECTED.has(name)?4:3,action:"verify",tool:name}
    ],
    target:args.app||args.repo||args.path||null
  };
}

function plan(request){
  if(cfg.plannerEnabled===false)return{version:cfg.version,mode:"plan",status:"disabled",message:"Agent planner is disabled by configuration."};
  const q=String(request||"").trim();
  if(!q)return{version:cfg.version,mode:"plan",status:"missing_request",message:"Provide the task you want TOHID-AGENT to plan."};
  const s=q.toLowerCase();
  const steps=[];
  const add=(action,tool,r="low")=>steps.push({step:steps.length+1,action,tool,risk:r,requires_confirmation:PROTECTED.has(tool)});
  if(/github|repo|repository|commit|branch|pull request|issue/.test(s))add("Inspect GitHub target","github_read_file");
  if(/heroku|deploy|redeploy|dyno|scale|restart|start|stop/.test(s))add("Inspect deployment target","heroku_app_info");
  if(/write|update|edit|create|commit|push|deploy|redeploy|restart|stop|start|scale/.test(s))add("Prepare protected change","protected_action","high");
  if(/deploy|redeploy/.test(s))add("Deploy or trigger release","deployment","high");
  add("Verify result","verification","low");
  return {
    version:cfg.version,
    mode:"plan",
    status:"ready",
    request:q,
    agentMode:cfg.agentMode,
    steps:steps.length?steps:[{step:1,action:"Analyze request and select the required tools","tool":"agent_plan",risk:"low",requires_confirmation:false}],
    safety:"Protected writes/deployments require owner authorization and explicit CONFIRM.",
    execution:"The agent may adapt the plan after tool results; it must not claim success without verification."
  };
}

function verify(name,result){
  if(result===undefined||result===null)return{ok:false,reason:"Tool returned no result."};
  if(result&&typeof result==="object"&&result.error)return{ok:false,reason:String(result.error)};
  if(result&&typeof result==="object"&&result.status==="failed")return{ok:false,reason:"Tool reported failed status."};
  return{ok:true,tool:name,checked_at:new Date().toISOString()};
}

async function execute(name,args,runner){
  const started=Date.now();
  const meta=planForTool(name,args);
  const result=await runner();
  const verification=verify(name,result);
  return {
    tool:name,
    result,
    verification,
    execution_ms:Date.now()-started,
    plan:meta
  };
}

module.exports={PROTECTED,READ_ONLY,risk,planForTool,plan,verify,execute};