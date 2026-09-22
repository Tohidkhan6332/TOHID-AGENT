const DEFAULT_WARNING_LIMIT=3;
const PRESETS={
  strict:{antilink:{enabled:true,action:"delete"},antistatus:{enabled:true,action:"delete"},antigroupstatus:{enabled:true,action:"delete"},antitag:{enabled:true,action:"delete"},antitagall:{enabled:true,action:"kick"},antibot:{enabled:false,action:"kick"},antipdm:{enabled:true},antibad:{enabled:true,action:"warn"}},
  normal:{antilink:{enabled:true,action:"delete"},antistatus:{enabled:true,action:"delete"},antigroupstatus:{enabled:true,action:"delete"},antitag:{enabled:false,action:"delete"},antitagall:{enabled:true,action:"warn"},antibot:{enabled:false,action:"kick"},antipdm:{enabled:false},antibad:{enabled:false,action:"delete"}},
  relaxed:{antilink:{enabled:true,action:"warn"},antistatus:{enabled:false,action:"delete"},antigroupstatus:{enabled:false,action:"delete"},antitag:{enabled:false,action:"delete"},antitagall:{enabled:false,action:"delete"},antibot:{enabled:false,action:"kick"},antipdm:{enabled:false},antibad:{enabled:false,action:"delete"}},
  off:{antilink:{enabled:false},antistatus:{enabled:false},antigroupstatus:{enabled:false},antitag:{enabled:false},antitagall:{enabled:false},antibot:{enabled:false},antipdm:{enabled:false},antibad:{enabled:false}}
};
function securityState(s){return {...(s.security||{}),warningLimit:Number(s.security?.warningLimit)||DEFAULT_WARNING_LIMIT,modlog:Array.isArray(s.security?.modlog)?s.security.modlog:[]};}
function applyPreset(s,name){
  const p=PRESETS[name];if(!p)return null;
  const next={...s,security:{...securityState(s),preset:name}};
  for(const [k,v] of Object.entries(p))next[k]={...(next[k]||{}),...v};
  return next;
}
function addModLog(s,entry){
  const state=securityState(s);
  const log=[...state.modlog,{...entry,time:new Date().toISOString()}].slice(-100);
  return {...s,security:{...state,modlog:log}};
}
module.exports={DEFAULT_WARNING_LIMIT,PRESETS,securityState,applyPreset,addModLog};