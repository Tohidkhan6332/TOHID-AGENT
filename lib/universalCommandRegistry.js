/*
 * Universal command registry for TOHID-AGENT.
 * Commands can be exposed through text, natural language and buttons.
 * External integrations are deliberately represented as dependencies so
 * missing API keys can be added later without changing the command contract.
 */

const COMMANDS = [
  // Downloader / media
  ["play","media","Download/play audio from a search query",["song","music"],["MEDIA_API_KEY"]],
  ["song","media","Download a song",["play"],["MEDIA_API_KEY"]],
  ["video","media","Download or generate video",["vid","ytvideo"],["MEDIA_API_KEY"]],
  ["ytmp3","downloader","YouTube to MP3",["ytaudio"],["YOUTUBE_API_KEY"]],
  ["ytmp4","downloader","YouTube to MP4",["ytvideo"],["YOUTUBE_API_KEY"]],
  ["facebook","downloader","Download Facebook media",["fb","fbdl"],["FACEBOOK_API_KEY"]],
  ["instagram","downloader","Download Instagram media",["ig","igdl"],["INSTAGRAM_API_KEY"]],
  ["tiktok","downloader","Download TikTok media",["tt","ttdl"],["TIKTOK_API_KEY"]],
  ["twitter","downloader","Download X/Twitter media",["xdl","twitterdl"],["TWITTER_API_KEY"]],
  ["pinterest","downloader","Download Pinterest media",["pin","pindl"],["PINTEREST_API_KEY"]],
  ["spotify","downloader","Resolve Spotify media",["sp","spdl"],["SPOTIFY_API_KEY"]],
  ["mediafire","downloader","Download MediaFire files",["mfire"],["MEDIAFIRE_API_KEY"]],
  ["apk","downloader","Find/download APK information",["app"],["APK_API_KEY"]],

  // Search / utility
  ["search","search","Web search",["google","web"],["SEARCH_API_KEY"]],
  ["image","search","Search images",["imagesearch"],["SEARCH_API_KEY"]],
  ["weather","utility","Weather lookup",["forecast"],["WEATHER_API_KEY"]],
  ["translate","utility","Translate text",["tr"],[]],
  ["short","utility","Shorten a URL",["shorturl"],["URL_SHORTENER_API_KEY"]],
  ["qrgen","utility","Generate a QR code",["qrcode"],[]],
  ["sticker","media","Create a sticker from media",["s"],[]],
  ["toimg","media","Convert sticker/media to image",["toimage"],[]],
  ["tomp3","media","Convert media to audio",[],[]],
  ["tovideo","media","Convert media to video",[],[]],

  // AI
  ["ask","ai","Ask the AI agent",["ai","chat"],["AI_PROVIDER_KEY"]],
  ["summarize","ai","Summarize text/media",["summary"],["AI_PROVIDER_KEY"]],
  ["rewrite","ai","Rewrite text",["rephrase"],["AI_PROVIDER_KEY"]],
  ["imagine","ai","Generate an image",["imagegen"],["AI_PROVIDER_KEY"]],
  ["vision","ai","Analyze an image",["analyze"],["AI_PROVIDER_KEY"]],
  ["tts","ai","Text to speech",["say"],["TTS_API_KEY"]],
  ["stt","ai","Speech to text",["transcribe"],["STT_API_KEY"]],

  // Games / fun
  ["quiz","games","Start a quiz",["q"],[]],
  ["trivia","games","Trivia question",[],[]],
  ["truth","fun","Truth prompt",[],[]],
  ["dare","fun","Dare prompt",[],[]],
  ["joke","fun","Tell a joke",["jokes"],[]],
  ["quote","fun","Random quote",["quotes"],[]],
  ["fact","fun","Random fact",["facts"],[]],
  ["8ball","fun","Magic 8-ball response",["eightball"],[]],
  ["ship","fun","Compatibility game",["compatibility"],[]],
  ["roast","fun","Playful roast",[],["AI_PROVIDER_KEY"]],

  // Text / formatting
  ["font","text","Stylize text",["fancy"],[]],
  ["bold","text","Bold text",[],[]],
  ["italic","text","Italic text",[],[]],
  ["reverse","text","Reverse text",[],[]],
  ["encode","text","Encode text",[],[]],
  ["decode","text","Decode text",[],[]],
  ["base64","text","Base64 encode/decode",[],[]],

  // Group / moderation aliases that map to existing engines
  ["kick","moderation","Remove a group member",["remove"],[]],
  ["add","moderation","Add a group member",["invite"],[]],
  ["promote","moderation","Promote a group member",["admin"],[]],
  ["demote","moderation","Demote a group member",["deadmin"],[]],
  ["tagall","group","Mention group members",["everyone"],[]],
  ["hidetag","group","Mention all members without visible mentions",["silenttag"],[]],
  ["groupinfo","group","Show group information",["ginfo"],[]],
  ["admins","group","List group admins",["adminlist"],[]],
  ["link","group","Get group invite link",["grouplink"],[]],
  ["revoke","group","Revoke group invite link",[],[]],
  ["setname","group","Change group subject",["subject"],[]],
  ["setdesc","group","Change group description",["description"],[]],

  // Owner / bot control aliases
  ["restart","owner","Restart the bot",["reboot"],[]],
  ["update","owner","Update bot/plugin code",["upgrade"],[]],
  ["broadcast","owner","Broadcast a message",["bc"],[]],
  ["listusers","owner","List known users",["users"],[]],
  ["listgroups","owner","List known groups",["groups"],[]],
  ["blockuser","owner","Block a bot user",["ban"],[]],
  ["unblockuser","owner","Unblock a bot user",["unban"],[]]
].map(([name,category,description,aliases=[],requires=[]])=>({
  name,category,description,aliases,requires,
  permission: ["owner"].includes(category) ? "bot.write" :
    ["moderation","group"].includes(category) ? "group.admin" : "user",
  handler: "universal",
  registered: true
}));

const byName=new Map();
for(const command of COMMANDS){
  byName.set(command.name,command);
  for(const alias of command.aliases)byName.set(alias,command);
}

function get(name){return byName.get(String(name||"").toLowerCase())||null;}
function all(){return COMMANDS.slice();}
function categories(){
  return [...new Set(COMMANDS.map(x=>x.category))];
}
function missingEnv(command,env=process.env){
  if(!command)return [];
  return command.requires.filter(key=>{
    if(key==="AI_PROVIDER_KEY")return !(env.OPENAI_API_KEY||env.GEMINI_API_KEY||env.AI_API_KEY);
    return !env[key];
  });
}
function parse(text,prefix="."){
  const raw=String(text||"").trim();
  const p=String(prefix||".");
  const value=raw.startsWith(p)?raw.slice(p.length).trim():raw;
  const name=value.split(/\s+/)[0].toLowerCase();
  const command=get(name);
  return command?{command,args:value.split(/\s+/).slice(1),raw}:null;
}

module.exports={COMMANDS,get,all,categories,missingEnv,parse};
