const axios=require("axios");
const fs=require("fs");
const path=require("path");
const FormData=require("form-data");
const cfg=require("../config");
const gh=require("./github");
const db=require("./database");
const memory=new Map();
const jsonHeaders=()=>({Authorization:"Bearer "+cfg.openaiKey,"Content-Type":"application/json"});
async function history(id){if(!memory.has(id)){const saved=await db.getMemory(id);memory.set(id,saved);}return memory.get(id);}
async function remember(id,role,content){const h=await history(id);h.push({role,content});const trimmed=h.slice(-20);memory.set(id,trimmed);await db.saveMemory(id,trimmed);}
async function clearMemory(id){memory.delete(id);await db.clearMemory(id);}
function toolDefs(){return [
{type:"function",name:"github_list_repositories",description:"List repositories for a GitHub owner.",parameters:{type:"object",properties:{owner:{type:"string"}},required:[],additionalProperties:false}},
{type:"function",name:"github_read_file",description:"Read a GitHub repository file or directory.",parameters:{type:"object",properties:{repo:{type:"string"},path:{type:"string"},ref:{type:"string"}},required:["repo","path"],additionalProperties:false}},
{type:"function",name:"github_write_file",description:"Create or update a GitHub text file. Use only after explicit user intent to modify code.",parameters:{type:"object",properties:{repo:{type:"string"},path:{type:"string"},content:{type:"string"},message:{type:"string"},branch:{type:"string"},sha:{type:"string"}},required:["repo","path","content","message"],additionalProperties:false}},
{type:"function",name:"github_create_branch",description:"Create a GitHub branch.",parameters:{type:"object",properties:{repo:{type:"string"},branch:{type:"string"},from:{type:"string"}},required:["repo","branch"],additionalProperties:false}},
{type:"function",name:"github_create_issue",description:"Create a GitHub issue.",parameters:{type:"object",properties:{repo:{type:"string"},title:{type:"string"},body:{type:"string"}},required:["repo","title"],additionalProperties:false}},
{type:"function",name:"github_create_pull_request",description:"Create a GitHub pull request.",parameters:{type:"object",properties:{repo:{type:"string"},title:{type:"string"},head:{type:"string"},base:{type:"string"},body:{type:"string"}},required:["repo","title","head"],additionalProperties:false}}
];}
async function githubTool(name,args,isOwner){
const writes=["github_write_file","github_create_branch","github_create_issue","github_create_pull_request"];
if(writes.includes(name)&&!isOwner)throw new Error("GitHub write actions are owner-only.");
switch(name){
case "github_list_repositories":return gh.listRepos(args.owner||cfg.githubOwner);
case "github_read_file":return gh.getFile(args.repo,args.path,args.ref);
case "github_write_file":return gh.putFile(args.repo,args.path,args.content,args.message,args.branch,args.sha);
case "github_create_branch":return gh.createBranch(args.repo,args.branch,args.from||"main");
case "github_create_issue":return gh.issue(args.repo,args.title,args.body||"");
case "github_create_pull_request":return gh.pull(args.repo,args.title,args.head,args.base||"main",args.body||"");
default:throw new Error("Unknown GitHub tool");}}
async function ask(userId,text,{isOwner=false}={}){
if(!cfg.openaiKey)throw new Error("OPENAI_API_KEY is not configured.");
await remember(userId,"user",text);
const system="You are TOHID AGENT V2, a multilingual ChatGPT-style WhatsApp AI agent created by Tohid. Reply in the user's language and keep answers useful. You can explain, code, translate, summarize, reason, and help with GitHub. GitHub owner is "+cfg.githubOwner+". Never claim an action succeeded unless a tool returned success. GitHub write tools are owner-only. Do not expose secrets or tokens. Ask for missing information instead of guessing.";
const body={model:cfg.model,input:[{role:"system",content:system},...(await history(userId))],tools:toolDefs(),store:false};
if(cfg.webSearch)body.tools.push({type:"web_search_preview"});
for(let round=0;round<8;round++){
const r=await axios.post("https://api.openai.com/v1/responses",body,{headers:jsonHeaders(),timeout:120000});
const out=r.data.output||[],calls=out.filter(x=>x.type==="function_call");
if(!calls.length){const answer=(r.data.output_text||"").trim();await remember(userId,"assistant",answer);await db.track(userId,"chat");return answer||"I couldn't generate a response.";}
for(const call of calls){let result;try{result=await githubTool(call.name,JSON.parse(call.arguments||"{}"),isOwner);}catch(e){result={error:e.message};}body.input.push({type:"function_call_output",call_id:call.call_id,output:JSON.stringify(result)});}
}
throw new Error("Agent tool loop exceeded its limit.");}
async function transcribe(file){const form=new FormData();form.append("file",fs.createReadStream(file));form.append("model",cfg.transcribeModel);const r=await axios.post("https://api.openai.com/v1/audio/transcriptions",form,{headers:{Authorization:"Bearer "+cfg.openaiKey,...form.getHeaders()},timeout:120000});return r.data.text;}
async function tts(text,out){const r=await axios.post("https://api.openai.com/v1/audio/speech",{model:cfg.ttsModel,voice:cfg.ttsVoice,input:text,format:"mp3"},{headers:jsonHeaders(),responseType:"arraybuffer",timeout:120000});fs.writeFileSync(out,r.data);return out;}
async function image(prompt){const r=await axios.post("https://api.openai.com/v1/images/generations",{model:cfg.imageModel,prompt,size:"1024x1024",quality:"auto",output_format:"png"},{headers:jsonHeaders(),timeout:180000});const b64=r.data.data?.[0]?.b64_json;if(!b64)throw new Error("Image API did not return image bytes.");const out=path.join(process.cwd(),"tmp-"+Date.now()+".png");fs.writeFileSync(out,Buffer.from(b64,"base64"));return out;}
async function video(prompt){if(!cfg.videoEnabled)throw new Error("Video generation is disabled.");const form=new FormData();form.append("model",cfg.videoModel);form.append("prompt",prompt);form.append("seconds",String(cfg.videoSeconds));form.append("size",cfg.videoSize);const created=await axios.post("https://api.openai.com/v1/videos",form,{headers:{Authorization:"Bearer "+cfg.openaiKey,...form.getHeaders()},timeout:120000});const id=created.data.id;if(!id)throw new Error("Video API did not return a job ID.");let job=created.data;for(let i=0;i<90&&["queued","in_progress"].includes(job.status);i++){await new Promise(r=>setTimeout(r,10000));job=(await axios.get("https://api.openai.com/v1/videos/"+id,{headers:{Authorization:"Bearer "+cfg.openaiKey},timeout:60000})).data;if(job.status==="failed")throw new Error(job.error?.message||"Video generation failed.");}if(job.status!=="completed")throw new Error("Video generation timed out. Job: "+id);const out=path.join(process.cwd(),"tmp-video-"+Date.now()+".mp4");const media=await axios.get("https://api.openai.com/v1/videos/"+id+"/content",{headers:{Authorization:"Bearer "+cfg.openaiKey},responseType:"arraybuffer",timeout:180000});fs.writeFileSync(out,media.data);return out;}
module.exports={ask,transcribe,tts,image,video,clearMemory};