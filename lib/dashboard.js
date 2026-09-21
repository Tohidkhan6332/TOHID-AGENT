const os=require("os");
async function snapshot({cfg,db,plugins,control,delegatedOwners,startedAt}){
  const stats=await db.stats();
  const mem=process.memoryUsage();
  return {
    version:cfg.version,
    uptimeSeconds:Math.floor(process.uptime()),
    node:process.version,
    platform:process.platform,
    cpuCores:os.cpus().length,
    memory:{rss:mem.rss,heapUsed:mem.heapUsed,heapTotal:mem.heapTotal},
    database:stats.database,
    users:stats.users||0,
    blocked:stats.blocked||0,
    usage:stats.usage||{},
    plugins:plugins.list().map(x=>({name:x.name,version:x.version,enabled:!!x.enabled,loaded:!!x.loaded})),
    delegatedOwners:delegatedOwners?delegatedOwners.size:0,
    features:control.featureList(),
    integrations:{
      github:!!cfg.githubToken,
      vercel:!!cfg.vercelToken,
      render:!!cfg.renderApiKey,
      koyeb:!!cfg.koyebToken,
      heroku:!!cfg.herokuToken
    }
  };
}
function format(s){
  const on=v=>v?"✅":"❌";
  const u=Math.floor(s.uptimeSeconds/86400),h=Math.floor(s.uptimeSeconds%86400/3600),m=Math.floor(s.uptimeSeconds%3600/60);
  return "📊 *TOHID-AGENT DASHBOARD V11*\n\n"+
    "🟢 Runtime: ONLINE\n"+
    "⏱️ Uptime: "+u+"d "+h+"h "+m+"m\n"+
    "🟩 Node: "+s.node+"\n"+
    "🗄️ MongoDB: "+on(s.database)+"\n"+
    "👥 Users: "+s.users+"\n"+
    "🚫 Blocked: "+s.blocked+"\n"+
    "🧩 Plugins: "+s.plugins.length+"\n"+
    "👑 Delegated owners: "+s.delegatedOwners+"\n\n"+
    "🔗 *Integrations*\n"+
    "GitHub "+on(s.integrations.github)+" • Vercel "+on(s.integrations.vercel)+"\n"+
    "Render "+on(s.integrations.render)+" • Koyeb "+on(s.integrations.koyeb)+" • Heroku "+on(s.integrations.heroku)+"\n\n"+
    "🧠 *Usage*\n"+
    "Chat: "+(s.usage.chat||0)+" • Voice: "+(s.usage.voice||0)+"\n"+
    "Images: "+(s.usage.image||0)+" • Video: "+(s.usage.video||0);
}
module.exports={snapshot,format};