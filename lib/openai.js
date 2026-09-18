const axios=require("axios");
const fs=require("fs");
const path=require("path");
const FormData=require("form-data");
const cfg=require("../config");
const gh=require("./github");

const memory=new Map();
const jsonHeaders=()=>({Authorization:"Bearer "+cfg.openaiKey,"Content-Type":"application/json"});

function history(id){return memory.get(id)||[];}
function remember(id,role,content){
  const h=history(id);
  h.push({role,content});
  memory.set(id,h.slice(-20));
}
function toolDefs(){
  return [
    {type:"function",name:"github_list_repositories",description:"List repositories for a GitHub owner.",parameters:{type:"object",properties:{owner:{type:"string"}},required:[],additionalProperties:false}},
    {type:"function",name:"github_read_file",description:"Read a GitHub repository file or directory.",parameters:{type:"object",properties:{repo:{type:"string"},path:{type:"string"},ref:{type:"string"}},required:["repo","path"],additionalProperties:false}},
    {type:"function",name:"github_write_file",description:"Create or update a GitHub text file. Only use when the user explicitly asks to create, edit, replace or push code.",parameters:{type:"object",properties:{repo:{type:"string"},path:{type:"string"},content:{type:"string"},message:{type:"string"},branch:{type:"string"},sha:{type:"string"}},required:["repo","path","content","message"],additionalProperties:false}},
    {type:"function",name:"github_create_branch",description:"Create a GitHub branch.",parameters:{type:"object",properties:{repo:{type:"string"},branch:{type:"string"},from:{type:"string"}},required:["repo","branch"],additionalProperties:false}},
    {type:"function",name:"github_create_issue",description:"Create a GitHub issue.",parameters:{type:"object",properties:{repo:{type:"string"},title:{type:"string"},body:{type:"string"}},required:["repo","title"],additionalProperties:false}},
    {type:"function",name:"github_create_pull_request",description:"Create a GitHub pull request.",parameters:{type:"object",properties:{repo:{type:"string"},title:{type:"string"},head:{type:"string"},base:{type:"string"},body:{type:"string"}},required:["repo","title","head"],additionalProperties:false}}
  ];
}
async function githubTool(name,args,isOwner){
  const writes=["github_write_file","github_create_branch","github_create_issue","github_create_pull_request"];
  if(writes.includes(name)&&!isOwner) throw new Error("GitHub write actions are owner-only.");
  switch(name){
    case "github_list_repositories":return gh.listRepos(args.owner||cfg.githubOwner);
    case "github_read_file":return gh.getFile(args.repo,args.path,args.ref);
    case "github_write_file":return gh.putFile(args.repo,args.path,args.content,args.message,args.branch,args.sha);
    case "github_create_branch":return gh.createBranch(args.repo,args.branch,args.from||"main");
    case "github_create_issue":return gh.issue(args.repo,args.title,args.body||"");
    case "github_create_pull_request":return gh.pull(args.repo,args.title,args.head,args.base||"main",args.body||"");
    default:throw new Error("Unknown GitHub tool");
  }
}
async function ask(userId,text,{isOwner=false}={}){
  if(!cfg.openaiKey) throw new Error("OPENAI_API_KEY is not configured.");
  remember(userId,"user",text);
  const system="You are TOHID AGENT, a ChatGPT-style WhatsApp assistant created by Tohid. Understand and reply in any language the user uses. You can explain, code, translate, summarize, reason, analyze images, and help with GitHub. Current GitHub owner: "+cfg.githubOwner+". Never claim an action succeeded unless its tool returned success. GitHub read actions may be used when useful; GitHub write actions require explicit user intent and are authorized only for the owner.";
  const body={model:cfg.model,input:[{role:"system",content:system},...history(userId)],tools:toolDefs(),store:false};
  if(cfg.webSearch) body.tools.push({type:"web_search_preview"});
  for(let round=0;round<8;round++){
    const r=await axios.post("https://api.openai.com/v1/responses",body,{headers:jsonHeaders(),timeout:120000});
    const out=r.data.output||[];
    const calls=out.filter(x=>x.type==="function_call");
    if(!calls.length){
      const answer=(r.data.output_text||"").trim();
      remember(userId,"assistant",answer);
      return answer||"I couldn't generate a response.";
    }
    for(const call of calls){
      let result;
      try{result=await githubTool(call.name,JSON.parse(call.arguments||"{}"),isOwner);}
      catch(e){result={error:e.message};}
      body.input.push({type:"function_call_output",call_id:call.call_id,output:JSON.stringify(result)});
    }
  }
  throw new Error("Agent tool loop exceeded its limit.");
}
async function transcribe(file){
  const form=new FormData();
  form.append("file",fs.createReadStream(file));
  form.append("model",cfg.transcribeModel);
  const r=await axios.post("https://api.openai.com/v1/audio/transcriptions",form,{headers:{Authorization:"Bearer "+cfg.openaiKey,...form.getHeaders()},timeout:120000});
  return r.data.text;
}
async function tts(text,out){
  const r=await axios.post("https://api.openai.com/v1/audio/speech",{model:cfg.ttsModel,voice:cfg.ttsVoice,input:text,format:"mp3"},{headers:jsonHeaders(),responseType:"arraybuffer",timeout:120000});
  fs.writeFileSync(out,r.data);
  return out;
}
async function image(prompt){
  const r=await axios.post("https://api.openai.com/v1/images/generations",{model:cfg.imageModel,prompt,size:"1024x1024",quality:"auto",output_format:"png"},{headers:jsonHeaders(),timeout:180000});
  const b64=r.data.data?.[0]?.b64_json;
  if(!b64) throw new Error("Image API did not return image bytes.");
  const out=path.join(process.cwd(),"tmp-"+Date.now()+".png");
  fs.writeFileSync(out,Buffer.from(b64,"base64"));
  return out;
}
module.exports={ask,transcribe,tts,image};
