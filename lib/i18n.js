const cfg=require("../config");
const db=require("./database");

const cache=new Map();
const aliases={
  en:"English",english:"English",
  hi:"Hindi",hindi:"Hindi",
  hinglish:"Hinglish",
  bn:"Bengali",bengali:"Bengali",
  pa:"Punjabi",punjabi:"Punjabi",
  ur:"Urdu",urdu:"Urdu",
  ta:"Tamil",tamil:"Tamil",
  te:"Telugu",telugu:"Telugu",
  mr:"Marathi",marathi:"Marathi",
  gu:"Gujarati",gujarati:"Gujarati",
  kn:"Kannada",kannada:"Kannada",
  ml:"Malayalam",malayalam:"Malayalam",
  ar:"Arabic",arabic:"Arabic",
  es:"Spanish",spanish:"Spanish",
  fr:"French",french:"French",
  de:"German",german:"German",
  tr:"Turkish",turkish:"Turkish",
  ru:"Russian",russian:"Russian",
  ja:"Japanese",japanese:"Japanese",
  ko:"Korean",korean:"Korean",
  pt:"Portuguese",portuguese:"Portuguese"
};

function normalizeLanguage(value){
  const raw=String(value||"").trim();
  if(!raw)return String(cfg.defaultLanguage||"English");
  return aliases[raw.toLowerCase()]||raw.slice(0,40);
}

async function getLanguage(jid){
  if(!jid)return normalizeLanguage(cfg.defaultLanguage);
  try{
    const settings=await db.getSettings(jid);
    return normalizeLanguage(settings.language||cfg.defaultLanguage);
  }catch{
    return normalizeLanguage(cfg.defaultLanguage);
  }
}

async function setLanguage(jid,language){
  const lang=normalizeLanguage(language);
  if(jid)await db.setSettings(jid,{language:lang});
  return lang;
}

async function translate(text,language){
  const source=String(text??"");
  const lang=normalizeLanguage(language);
  if(!source||/^english$/i.test(lang))return source;
  const key=lang+"\n"+source;
  if(cache.has(key))return cache.get(key);

  const system=[
    "You are the TOHID-AGENT UI localization engine.",
    "Translate only the supplied WhatsApp bot/system message into the requested language.",
    "Preserve emojis, Markdown formatting, URLs, code, command names beginning with '.', product names, developer names, version numbers, IDs, JSON, technical identifiers, and the word CONFIRM exactly.",
    "Do not translate commands or values. Do not add, remove, summarize, explain, or comment.",
    "Return only the translated message."
  ].join(" ");

  let out="";
  const user="Target language: "+lang+"\n\nMessage:\n"+source;

  async function call(url,key,model){
    const r=await fetch(url,{
      method:"POST",
      headers:{"content-type":"application/json","authorization":"Bearer "+key},
      body:JSON.stringify({
        model,
        messages:[{role:"system",content:system},{role:"user",content:user}],
        temperature:0.1
      })
    });
    if(!r.ok)throw new Error("translation provider HTTP "+r.status);
    const j=await r.json();
    return String(j?.choices?.[0]?.message?.content||"").trim();
  }

  if(cfg.openaiKey){
    try{out=await call("https://api.openai.com/v1/chat/completions",cfg.openaiKey,cfg.openaiModel);}catch{}
  }
  if(!out&&cfg.geminiKey){
    try{out=await call("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",cfg.geminiKey,cfg.geminiModel);}catch{}
  }

  if(!out) return source;
  if(cache.size>500)cache.delete(cache.keys().next().value);
  cache.set(key,out);
  return out;
}

module.exports={normalizeLanguage,getLanguage,setLanguage,translate};
