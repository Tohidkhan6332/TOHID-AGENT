const SECTIONS=[
{title:"🤖 AI / CHAT",items:[
[".imagine <prompt>","Generate an image",".imagine a futuristic robot"],[".video <prompt>","Generate a video",".video a sunset"],[".ask <question>","Ask AI",".ask explain Node.js"],[".vision","Analyze replied image",".vision"],[".summarize <text>","Summarize text",".summarize hello"],[".rewrite <text>","Rewrite text",".rewrite hello"],[".tts <text>","Text to speech",".tts hello"],[".stt","Transcribe replied audio",".stt"]
]},
{title:"🧭 CORE / TOOLS",items:[
[".menu","Open commands",".menu"],[".help [language]","Detailed help",".help Hindi"],[".ping","Health check",".ping"],[".status","Bot status",".status"],[".doctor","Diagnostics",".doctor"],[".tools","Available tools",".tools"],[".provider","AI provider",".provider"],[".plan <task>","Execution plan",".plan deploy"],[".agent","Agent status",".agent"],[".health","Agent health",".health"],[".settings","Settings",".settings"],[".language <language>","Change language",".language Hindi"],[".mode <mode>","Set UI mode",".mode hybrid"]
]},
{title:"🎯 MISSIONS / AUTOMATION",items:[
[".mission <request>","Create mission",".mission check GitHub"],[".missions","List missions",".missions"],[".schedule <delay> <task>","Schedule task",".schedule 30m check GitHub"],[".schedules","List schedules",".schedules"],[".task <request>","Agent task",".task inspect repo"],[".tasks","Recent tasks",".tasks"],[".workflow <task>","Multi-step workflow",".workflow deploy project"]
]},
{title:"🐙 GITHUB / DEVOPS",items:[
[".plugin list/search/install","Plugin management",".plugin list"],[".file list/read/backup","Workspace files",".file list"],[".feature list/on/off","Runtime features",".feature list"],[".admin","Control center",".admin"],[".dashboard","Dashboard",".dashboard"],[".role / .roles","RBAC roles",".roles"],[".owner list/add/remove","Delegated owners",".owner list"],[".shell <command> CONFIRM","Restricted shell",".shell uptime CONFIRM"],[".maintenance on/off","Maintenance",".maintenance on"]
]},
{title:"🛡️ GROUP PROTECTION",items:[
[".antilink on/off/delete/warn/kick","Link protection",".antilink on"],[".antistatus on/off/delete/warn/kick","Status protection",".antistatus on"],[".antitag on/off/delete/warn/kick","Tag protection",".antitag on"],[".antitagall on/off/delete/warn/kick","Mass-tag protection",".antitagall on"],[".antibot on/off/delete/warn/kick","Bot protection",".antibot on"],[".antipdm on/off","Admin-change protection",".antipdm on"],[".antibad on/off/delete/warn/kick","Bad-word protection",".antibad on"],[".security strict/normal/relaxed/off","Security preset",".security strict"],[".warn @member","Warning",".warn @member"],[".warnings @member","Show warnings",".warnings @member"],[".warnlimit 3","Warning limit",".warnlimit 3"],[".modlog","Moderation log",".modlog"]
]},
{title:"🛡️ GROUP AI / SECURITY OS",items:[
[".antispam on/off/delete/warn/mute/kick","Spam protection",".antispam on"],[".antispam <count> <window>","Spam threshold",".antispam 6 8s"],[".mute [duration]","Mute entire group",".mute 10m"],[".unmute","Unmute entire group",".unmute"],[".msgmute @member <duration>","Mute one member messages",".msgmute @member 10m"],[".msgunmute @member","Remove member mute",".msgunmute @member"],[".msgmuted","List member mutes",".msgmuted"],[".raid on/off/status","Raid protection",".raid on"],[".raid lockdown [minutes]","Emergency lockdown",".raid lockdown 10"],[".raid unlock","Unlock raid mode",".raid unlock"],[".verification on/off/status","Verification",".verification on"],[".verify","Verify member",".verify"],[".activity","Activity analytics",".activity"],[".topchatters","Top chatters",".topchatters"],[".modstats","Moderation analytics",".modstats"]
]},
{title:"👥 GROUP / MODERATION",items:[
[".kick @member","Remove member",".kick @member"],[".add <number>","Add member",".add 919876543210"],[".promote @member","Promote member",".promote @member"],[".demote @member","Demote member",".demote @member"],[".tagall","Mention all",".tagall"],[".hidetag <text>","Hidden mention",".hidetag announcement"],[".groupinfo","Group information",".groupinfo"],[".admins","List admins",".admins"],[".link","Group invite link",".link"],[".revoke","Revoke invite link",".revoke"],[".setname <name>","Change group name",".setname TOHID"],[".setdesc <text>","Change description",".setdesc hello"],[".welcome on/off","Welcome messages",".welcome on"],[".goodbye on/off","Goodbye messages",".goodbye on"]
]},
{title:"📥 DOWNLOADER / MEDIA / SEARCH",items:[
[".play <query>","Audio downloader — API later",".play kesariya"],[".song <query>","Song downloader — API later",".song arijit"],[".ytmp3 <url>","YouTube MP3 — API later",".ytmp3 <url>"],[".ytmp4 <url>","YouTube MP4 — API later",".ytmp4 <url>"],[".facebook <url>","Facebook downloader — API later",".facebook <url>"],[".instagram <url>","Instagram downloader — API later",".instagram <url>"],[".tiktok <url>","TikTok downloader — API later",".tiktok <url>"],[".twitter <url>","X/Twitter downloader — API later",".twitter <url>"],[".pinterest <url>","Pinterest downloader — API later",".pinterest <url>"],[".spotify <url/query>","Spotify resolver — API later",".spotify <url>"],[".mediafire <url>","MediaFire downloader — API later",".mediafire <url>"],[".apk <query>","APK lookup — API later",".apk whatsapp"],[".search <query>","Web search — API later",".search Node.js"],[".weather <city>","Weather — API later",".weather Delhi"],[".sticker","Create sticker",".sticker"],[".toimg","Sticker to image",".toimg"],[".tomp3","Media to audio",".tomp3"],[".tovideo","Media to video",".tovideo"]
]},
{title:"🎮 GAMES / FUN",items:[
[".quiz","Start quiz",".quiz"],[".trivia","Trivia",".trivia"],[".truth","Truth",".truth"],[".dare","Dare",".dare"],[".joke","Joke",".joke"],[".quote","Quote",".quote"],[".fact","Fact",".fact"],[".8ball <question>","Magic 8-ball",".8ball will I win?"],[".ship @a @b","Compatibility game",".ship @a @b"]
]},
{title:"✍️ TEXT / UTILITY",items:[
[".translate <text>","Translate text",".translate hello hindi"],[".font <text>","Stylize text",".font Tohid"],[".bold <text>","Bold text",".bold Tohid"],[".italic <text>","Italic text",".italic Tohid"],[".reverse <text>","Reverse text",".reverse Tohid"],[".base64 <text>","Base64 encode",".base64 Tohid"],[".qrgen <text>","Generate QR",".qrgen hello"],[".short <url>","Shorten URL — API later",".short <url>"]
]},
{title:"👑 OWNER / BOT",items:[
[".restart","Restart bot",".restart"],[".update","Update bot",".update"],[".broadcast <text>","Broadcast",".broadcast hello"],[".listusers","List users",".listusers"],[".listgroups","List groups",".listgroups"],[".blockuser <number>","Block bot user",".blockuser 919876543210"],[".unblockuser <number>","Unblock bot user",".unblockuser 919876543210"]
]}
];
function text(){return SECTIONS.map(s=>s.title+"\\n"+s.items.map(([cmd,desc,example])=>"• "+cmd+" — "+desc+"\\n  Example: "+example.trim()).join("\\n")).join("\\n\\n");}
function menuText(){return "🤖 *TOHID-AGENT — ALL COMMANDS*\\n\\n"+text();}
function idFor(cmd){return "tohid_cmd_"+cmd.replace(/[^a-z0-9]+/gi,"_").slice(0,70);}
function categoryRows(){return SECTIONS.map((s,i)=>({title:s.title,description:"Open this command category",id:"tohid_cat_"+i}));}
function commandRows(index){const s=SECTIONS[Number(index)];if(!s)return [];return s.items.map(([cmd,desc])=>({title:cmd.slice(0,24),description:desc.slice(0,68),id:idFor(cmd)}));}
function categoryMap(){const out={};SECTIONS.forEach((s,i)=>out["tohid_cat_"+i]=i);return out;}
function commandMap(){const out={};for(const s of SECTIONS)for(const [cmd,,example] of s.items)out[idFor(cmd)]=example.trim();return out;}
module.exports={SECTIONS,text,menuText,categoryRows,commandRows,categoryMap,commandMap,idFor};
