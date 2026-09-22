const SECTIONS=[
  {title:"🤖 AI / CHAT",items:[
    [".imagine <prompt>","Generate an image"," .imagine a futuristic robot"],
    [".video <prompt>","Generate a video"," .video a sunset over mountains"],
    [".newchat / .reset","Clear AI conversation memory"," .newchat"],
    [".memory","Show memory count"," .memory"],
    [".memory on/off","Enable or disable memory"," .memory on"],
    [".voice on/off","Enable or disable voice replies"," .voice on"]
  ]},
  {title:"🧭 CORE / TOOLS",items:[
    [".menu","Open all commands"," .menu"],
    [".help [language]","Detailed help with examples"," .help Hindi"],
    [".ping","Health check"," .ping"],
    [".status","Bot status"," .status"],
    [".doctor","Run diagnostics"," .doctor"],
    [".tools","Show available tools"," .tools"],
    [".provider","AI provider status"," .provider"],
    [".plan <task>","Preview execution plan"," .plan deploy my project"],
    [".agent [status]","Agent core status"," .agent status"],
    [".health","Agent health"," .health"],
    [".baileys","Baileys capability status"," .baileys"],
    [".skills","List active skills"," .skills"],
    [".mode / .ui <mode>","Set UI mode"," .mode hybrid"],
    [".language <language>","Change language"," .language Hindi"],
    [".profile","View profile"," .profile"],
    [".profile name/bio/language","Update profile"," .profile name Tohid"],
    [".settings","Open settings"," .settings"]
  ]},
  {title:"🎯 MISSIONS / AUTOMATION",items:[
    [".mission <request>","Create/start mission"," .mission check my GitHub"],
    [".mission status <id>","View mission"," .mission status 123"],
    [".mission confirm <id>","Confirm mission"," .mission confirm 123"],
    [".mission cancel <id>","Cancel mission"," .mission cancel 123"],
    [".missions","List missions"," .missions"],
    [".schedule <delay> <task>","Schedule mission"," .schedule 30m check GitHub"],
    [".schedules","List schedules"," .schedules"],
    [".schedule cancel <id>","Cancel schedule"," .schedule cancel 123"],
    [".task <request>","Start agent task"," .task inspect my repo"],
    [".tasks","Recent agent tasks"," .tasks"],
    [".workflow <task>","Multi-step workflow"," .workflow inspect and deploy project"]
  ]},
  {title:"🐙 GITHUB / DEVOPS",items:[
    ["Natural-language GitHub","Repos, files, branches, issues, PRs"," Show my GitHub repositories"],
    [".url list/add/switch/remove","Manage pairing URLs"," .url list"],
    [".pair <number>","8-digit pairing"," .pair 919876543210"],
    [".qr","QR pairing without number"," .qr"],
    [".plugin list/search/install/...","Plugin management"," .plugin list"],
    [".file list/read/backup/...","Workspace files"," .file list"],
    [".feature list/on/off","Runtime features"," .feature list"],
    [".admin","Control center"," .admin"],
    [".dashboard","Dashboard"," .dashboard"],
    [".role / .roles","RBAC roles"," .roles"],
    [".owner list/add/remove/revokeall","Delegated owners"," .owner list"],
    [".env / .config ...","Global config"," .config list"],
    [".shell <command> CONFIRM","Restricted shell"," .shell uptime CONFIRM"],
    [".maintenance on/off","Maintenance mode"," .maintenance on"]
  ]},
  {title:"📢 CHANNEL / GROUP",items:[
    [".channel <action>","WhatsApp Channel management"," .channel info <jid>"],
    [".groupstatus <text>","Send group status"," .groupstatus Hello group"],
    [".welcome on/off","Enable/disable welcome"," .welcome on"],
    [".welcome add <text> | <image URL>","Custom welcome"," .welcome add Welcome @member! | https://example.com/welcome.jpg"],
    [".welcome remove <number>","Remove custom welcome"," .welcome remove 1"],
    [".welcome list","List custom welcome"," .welcome list"],
    [".welcome clear","Clear custom welcome"," .welcome clear"],
    [".goodbye on/off","Enable/disable goodbye"," .goodbye on"],
    [".goodbye add <text> | <image URL>","Custom goodbye"," .goodbye add Goodbye @member! | https://example.com/bye.jpg"],
    [".goodbye remove <number>","Remove custom goodbye"," .goodbye remove 1"],
    [".goodbye list","List custom goodbye"," .goodbye list"],
    [".goodbye clear","Clear custom goodbye"," .goodbye clear"]
  ]},
  {title:"🛡️ GROUP PROTECTION — ADMIN ONLY",items:[
    [".antilink on/off/delete/warn/kick","Block links"," .antilink on"],
    [".antilink allow/disallow/allowed","Member exceptions"," .antilink allow 919876543210"],
    [".antistatus on/off/delete/warn/kick","Block status mentions"," .antistatus on"],
    [".antistatus allow/disallow/allowed","Member exceptions"," .antistatus allow @member"],
    [".antitag on/off/delete/warn/kick","Block member tags"," .antitag on"],
    [".antitag allow/disallow/allowed","Member exceptions"," .antitag allow @member"],
    [".antitagall on/off/delete/warn/kick","Block mass tags"," .antitagall on"],
    [".antitagall allow/disallow/allowed","Member exceptions"," .antitagall allow @member"],
    [".antibot on/off/delete/warn/kick","Configured bot protection"," .antibot on"],
    [".antibot add/remove/list/clear","Manage bot numbers"," .antibot add 919876543210"],
    [".antibot allow/disallow/allowed","Member exceptions"," .antibot allow @member"],
    [".antipdm on/off","Protect admin changes"," .antipdm on"],
    [".antipdm allow/disallow/allowed","Actor exceptions"," .antipdm allow @member"],
    [".antigroupstatus on/off/delete/warn/kick","Dedicated group-status protection"," .antigroupstatus on"],
    [".security status|strict|normal|relaxed|off","Group security presets"," .security strict"],
    [".warn <number/@mention/reply>","Issue a moderation warning"," .warn @member"],
    [".warnings <number/@mention/reply>","Show member warnings"," .warnings @member"],
    [".resetwarn <number/@mention/reply>","Reset member warnings"," .resetwarn @member"],
    [".warnlimit <1-20>","Set automatic warning limit"," .warnlimit 3"],
    [".modlog","Show recent moderation events"," .modlog"],
    [".antibad on/off/delete/warn/kick","Detect bad words"," .antibad on"],
    [".antibad add/remove/list/clear","Custom bad words"," .antibad add example"],
    [".antibad allow/disallow/allowed","Member exceptions"," .antibad allow @member"]
  ]},
  {title:"👤 USER / ADMIN",items:[
    [".block <number>","Block user"," .block 919876543210"],
    [".unblock <number>","Unblock user"," .unblock 919876543210"],
    [".stats","Owner statistics"," .stats"]
  ]}
];
function text(){
  return SECTIONS.map(s=>s.title+"\\n"+s.items.map(([cmd,desc,example])=>"• "+cmd+" — "+desc+"\\n  Example: "+example.trim()).join("\\n")).join("\\n\\n");
}
function menuText(){return "🤖 *TOHID-AGENT — ALL COMMANDS*\\n\\n"+text();}
function idFor(cmd){return "tohid_cmd_"+cmd.replace(/[^a-z0-9]+/gi,"_").slice(0,70);}
function categoryRows(){return SECTIONS.map((s,i)=>({title:s.title,description:"Open this command category",id:"tohid_cat_"+i}));}
function commandRows(index){const s=SECTIONS[index];if(!s)return [];return s.items.map(([cmd,desc])=>({title:cmd.slice(0,24),description:desc.slice(0,68),id:idFor(cmd)}));}
function categoryMap(){const out={};SECTIONS.forEach((s,i)=>out["tohid_cat_"+i]=i);return out;}
function commandMap(){const out={};for(const s of SECTIONS)for(const [cmd,,example] of s.items)out[idFor(cmd)]=example.trim();return out;}
module.exports={SECTIONS,text,menuText,categoryRows,commandRows,categoryMap,commandMap,idFor};
