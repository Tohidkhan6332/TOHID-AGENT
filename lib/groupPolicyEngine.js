const DEFAULT_WARNING_LIMIT=3;

const RULES=["antilink","antistatus","antigroupstatus","antitag","antitagall","antibot","antipdm","antibad"];
const LOCKS=["links","media","images","video","audio","voice","documents","stickers","forwards","polls","contacts","locations","newmembers","mentions","all"];

const PRESETS={
  strict:{antilink:{enabled:true,action:"delete"},antistatus:{enabled:true,action:"delete"},antigroupstatus:{enabled:true,action:"delete"},antitag:{enabled:true,action:"delete"},antitagall:{enabled:true,action:"kick"},antibot:{enabled:false,action:"kick"},antipdm:{enabled:true},antibad:{enabled:true,action:"warn"}},
  normal:{antilink:{enabled:true,action:"delete"},antistatus:{enabled:true,action:"delete"},antigroupstatus:{enabled:true,action:"delete"},antitag:{enabled:false,action:"delete"},antitagall:{enabled:true,action:"warn"},antibot:{enabled:false,action:"kick"},antipdm:{enabled:false},antibad:{enabled:false,action:"delete"}},
  relaxed:{antilink:{enabled:true,action:"warn"},antistatus:{enabled:false,action:"delete"},antigroupstatus:{enabled:false,action:"delete"},antitag:{enabled:false,action:"delete"},antitagall:{enabled:false,action:"delete"},antibot:{enabled:false,action:"kick"},antipdm:{enabled:false},antibad:{enabled:false,action:"delete"}},
  off:{antilink:{enabled:false},antistatus:{enabled:false},antigroupstatus:{enabled:false},antitag:{enabled:false},antitagall:{enabled:false},antibot:{enabled:false},antipdm:{enabled:false},antibad:{enabled:false}}
};

function state(s){
  const security=s.security&&typeof s.security==="object"?s.security:{};
  return {...s,security:{
    ...security,
    preset:security.preset||"custom",
    warningLimit:Number(security.warningLimit)||DEFAULT_WARNING_LIMIT,
    modlog:Array.isArray(security.modlog)?security.modlog:[],
    temporary:Array.isArray(security.temporary)?security.temporary:[],
    locks:Array.isArray(security.locks)?security.locks:[],
    reputation:security.reputation&&typeof security.reputation==="object"?security.reputation:{},
    backups:Array.isArray(security.backups)?security.backups:[]
  }};
}
function cleanup(s){
  const n=state(s),now=Date.now();
  n.security.temporary=n.security.temporary.filter(x=>Number(x?.expiresAt)>now);
  return n;
}
function applyPreset(s,name){
  const p=PRESETS[name]; if(!p)return null;
  const n=cleanup(s);
  n.security.preset=name;
  for(const [k,v] of Object.entries(p))n[k]={...(n[k]||{}),...v};
  return n;
}
function addModLog(s,entry){
  const n=state(s);
  n.security.modlog=[...n.security.modlog,{...entry,time:new Date().toISOString()}].slice(-100);
  return n;
}
function addReputation(s,jid,delta,reason){
  const n=state(s),r={...(n.security.reputation||{})};
  const cur=r[jid]||{score:0,actions:0,lastReason:null};
  r[jid]={score:Number(cur.score||0)+Number(delta||0),actions:Number(cur.actions||0)+1,lastReason:String(reason||"moderation"),updatedAt:new Date().toISOString()};
  n.security.reputation=r; return n;
}
function setLock(s,name,enabled,minutes){
  const n=cleanup(s); if(!LOCKS.includes(name))return null;
  const locks=new Map(n.security.locks.map(x=>[x.name,x]));
  if(!enabled)locks.delete(name);
  else locks.set(name,{name,enabled:true,expiresAt:minutes?Date.now()+minutes*60000:null});
  n.security.locks=[...locks.values()]; return n;
}
function isLocked(s,name){
  const n=cleanup(s),now=Date.now();
  return n.security.locks.some(x=>(x.name===name||x.name==="all")&&x.enabled&&(!x.expiresAt||x.expiresAt>now));
}
function setTemporaryRule(s,rule,enabled,minutes,action){
  const n=cleanup(s);
  n.security.temporary=n.security.temporary.filter(x=>x.rule!==rule);
  if(enabled)n.security.temporary.push({rule,enabled:true,action:action||null,expiresAt:Date.now()+minutes*60000});
  return n;
}
function effectiveRule(s,rule){
  const n=cleanup(s),base=n[rule]||{};
  const t=n.security.temporary.find(x=>x.rule===rule);
  return t?{...base,enabled:t.enabled,action:t.action||base.action}:base;
}
function snapshot(s){
  const n=cleanup(s);
  return JSON.parse(JSON.stringify({security:n.security,...RULES.reduce((o,k)=>(o[k]=n[k],o),{})}));
}
function backup(s,label){
  const n=state(s),item={id:Date.now().toString(36),label:String(label||"manual"),time:new Date().toISOString(),snapshot:snapshot(n)};
  n.security.backups=[...n.security.backups,item].slice(-10); return n;
}
function restoreBackup(s,id){
  const n=state(s),b=n.security.backups.find(x=>String(x.id)===String(id));
  if(!b)return null;
  const restored={...n,...b.snapshot,security:{...n.security,...b.snapshot.security,backups:n.security.backups}};
  return restored;
}
module.exports={DEFAULT_WARNING_LIMIT,RULES,LOCKS,PRESETS,state,cleanup,applyPreset,addModLog,addReputation,setLock,isLocked,setTemporaryRule,effectiveRule,snapshot,backup,restoreBackup};