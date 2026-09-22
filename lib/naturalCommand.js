/*
 * lib/naturalCommand.js
 * Natural-language -> canonical TOHID-AGENT command bridge.
 * This layer is deterministic and runs before the AI fallback so routine
 * WhatsApp commands can be spoken/typed naturally without a prefix.
 */

const KNOWN = new Set([
  "menu","help","ping","status","doctor","pair","qr","url","tools","provider","plan",
  "newchat","reset","stats","memory","profile","language","lang","mode","ui","plugin",
  "admin","feature","file","owner","role","roles","dashboard","workflow","env","config",
  "shell","settings","maintenance","block","unblock","mission","missions","task","tasks",
  "schedule","schedules","antilink","antistatus","antigroupstatus","antibot","antitag",
  "antitagall","antipdm","antibad","anti","welcome","goodbye","security","warn",
  "warnings","resetwarn","warnlimit","modlog","group","lock","unlock","groupstats","member",
  "mute","unmute","msgmute","msgunmute","msgmuted","antispam","raid","verification",
  "verify","activity","topchatters","modstats","imagine","video","channel","baileys",
  "skills","health"
]);

function clean(s){return String(s||"").trim().replace(/[!?]+$/,"").replace(/\s+/g," ");}

function natural(text,prefix="."){
  const raw=clean(text);
  if(!raw)return raw;
  const p=String(prefix||".");
  if(raw.startsWith(p))return raw;

  const low=raw.toLowerCase();

  // Exact command names and command-style arguments: "menu", "antilink on", etc.
  const first=low.split(/\s+/)[0];
  if(KNOWN.has(first))return p+raw;

  // Core navigation/settings aliases.
  const direct=[
    [/^(show|open|send|give) (the )?(menu|commands)$/i,"menu"],
    [/^(show|open) (the )?help$/i,"help"],
    [/^(check|show) (the )?status$/i,"status"],
    [/^(check|show) (the )?dashboard$/i,"dashboard"],
    [/^(run|start) (a )?diagnostic(s)?$/i,"doctor"],
    [/^(show|list) (available )?tools$/i,"tools"],
    [/^(show|check) (ai )?provider(s)?$/i,"provider"],
    [/^(clear|reset) (my )?(ai )?chat|^(start|begin) new chat$/i,"newchat"],
    [/^(show|open) settings$/i,"settings"],
    [/^(show|open) (all )?commands$/i,"menu"],
    [/^(show|open) (my )?profile$/i,"profile"],
    [/^(show|open) (my )?roles$/i,"roles"],
    [/^(show|open) (agent )?health$/i,"health"],
    [/^(show|check) baileys( capabilities)?$/i,"baileys"]
  ];
  for(const [re,cmd] of direct)if(re.test(raw))return p+cmd;

  // Voice/memory/language/UI.
  let m=low.match(/^(turn|switch|set|enable|disable)\s+(voice|memory)\s+(on|off)$/i);
  if(m)return p+m[2]+" "+m[3];
  m=low.match(/^(enable|turn on)\s+(voice|memory)$/i);
  if(m)return p+m[2]+" on";
  m=low.match(/^(disable|turn off)\s+(voice|memory)$/i);
  if(m)return p+m[2]+" off";
  m=raw.match(/^(?:change|set) (?:the )?language(?: to)?\s+(.+)$/i);
  if(m)return p+"language "+m[1].trim();
  m=raw.match(/^(?:set|change) (?:ui|interface) mode(?: to)?\s+(.+)$/i);
  if(m)return p+"mode "+m[1].trim();

  // Group-wide mute/unmute vs per-member message mute.
  m=raw.match(/^(?:mute|silence) (?:the )?(?:whole|entire|group)(?: for)?\s*(\d+\s*(?:s|m|h|d))?$/i);
  if(m)return p+"mute"+(m[1]?" "+m[1]:"");
  if(/^(?:unmute|unsilence|resume) (?:the )?(?:whole|entire|group)$/i.test(raw))return p+"unmute";

  m=raw.match(/^(?:msgmute|mute)\s+(@?\d{7,15})(?:\s+(?:for\s+)?(\d+\s*(?:s|m|h|d)))?(?:\s+(.+))?$/i);
  if(m)return p+"msgmute "+m[1]+(m[2]?" "+m[2]:"")+(m[3]?" "+m[3]:"");
  m=raw.match(/^(?:mute|silence)\s+(?:member|user|person)\s+(.+)$/i);
  if(m)return p+"msgmute "+m[1];
  m=raw.match(/^(?:unmute|unsilence)\s+(?:member|user|person)\s+(.+)$/i);
  if(m)return p+"msgunmute "+m[1];
  if(/^(?:show|list) (?:muted members|message mutes|msgmuted)$/i.test(raw))return p+"msgmuted";

  // Common protection commands in natural language.
  const rules={
    "anti link":"antilink","antilink":"antilink",
    "anti status":"antistatus","antistatus":"antistatus",
    "anti group status":"antigroupstatus","antigroupstatus":"antigroupstatus",
    "anti bot":"antibot","antibot":"antibot",
    "anti tag":"antitag","antitag":"antitag",
    "anti tag all":"antitagall","antitagall":"antitagall",
    "anti pdm":"antipdm","antipdm":"antipdm",
    "anti bad":"antibad","antibad":"antibad",
    "anti spam":"antispam","antispam":"antispam"
  };
  for(const [phrase,cmd] of Object.entries(rules)){
    const re=new RegExp("^(?:turn|switch|set|enable|disable|activate|deactivate|make|put|keep)?\\s*"+phrase.replace(/\s+/g,"\\s+")+"\\s+(on|off|delete|warn|kick|mute)$","i");
    m=raw.match(re);
    if(m)return p+cmd+" "+m[1];
    m=raw.match(new RegExp("^(?:enable|turn on|activate)\\s+"+phrase.replace(/\s+/g,"\\\\s+")+"$","i"));
    if(m)return p+cmd+" on";
    m=raw.match(new RegExp("^(?:disable|turn off|deactivate)\\s+"+phrase.replace(/\s+/g,"\\\\s+")+"$","i"));
    if(m)return p+cmd+" off";
  }

  // Security presets.
  m=raw.match(/^(?:set|switch) (?:group )?security (strict|normal|relaxed|off)$/i);
  if(m)return p+"security "+m[1];

  // Locks: "lock links", "unlock media", "lock all for 10m".
  m=raw.match(/^(lock|unlock)\s+(links|media|images|video|audio|voice|documents|stickers|forwards|polls|contacts|locations|newmembers|mentions|all)(?:\s+(\d+\s*(?:s|m|h|d)))?$/i);
  if(m)return p+m[1]+" "+m[2]+(m[3]?" "+m[3]:"");

  // Generic command phrases: "run .x ..." is normalized to .x ...
  m=raw.match(/^(?:run|execute|do)\s+\.([a-z0-9_-]+)(.*)$/i);
  if(m)return p+m[1]+m[2];

  return raw;
}

function normalizeForRouter(text,prefix="."){
  const out=natural(text,prefix);
  return {text:out,changed:out!==String(text||"").trim()};
}

module.exports={natural,normalizeForRouter,KNOWN};
