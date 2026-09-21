const fs=require("fs");
const dns=require("dns").promises;
async function check(name,fn){
  try{const value=await fn();return{name,ok:true,detail:value===undefined?"OK":String(value)};}
  catch(e){return{name,ok:false,detail:e?.message||"failed"};}
}
async function run({cfg,db,plugins}){
  const checks=[];
  checks.push(await check("Node.js",()=>process.versions.node));
  checks.push(await check("MongoDB",async()=>cfg.mongoUri?(await db.stats()).database:"not configured"));
  checks.push(await check("AI provider",()=>cfg.openaiKey||cfg.geminiKey?"configured":"no provider key"));
  checks.push(await check("GitHub",()=>cfg.githubToken?"configured":"not configured"));
  checks.push(await check("Plugin directory",()=>fs.existsSync(plugins.ROOT)?"ready":"missing"));
  checks.push(await check("DNS / network",async()=>{await dns.lookup("github.com");return"reachable";}));
  const failed=checks.filter(x=>!x.ok).length;
  return{ok:failed===0,checks,failed};
}
function format(result){
  return "🩺 *TOHID-AGENT DOCTOR*\n\n"+result.checks.map(x=>(x.ok?"✅ ":"❌ ")+x.name+" — "+x.detail).join("\n")+
    "\n\n"+(result.ok?"🟢 All checks passed.":"🟠 "+result.failed+" check(s) need attention.");
}
module.exports={run,format};