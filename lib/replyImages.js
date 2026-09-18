const fs=require("fs");
const path=require("path");

const ROOT=path.join(process.cwd(),"assets","reply-images");

const FILES={
  ai:"ai.jpg",
  github:"github.jpg",
  image:"image.jpg",
  vision:"vision.jpg",
  voice:"voice.jpg",
  video:"video.jpg",
  web:"web.jpg",
  code:"code.jpg",
  group:"group.jpg",
  admin:"admin.jpg",
  memory:"memory.jpg",
  utility:"utility.jpg",
  stats:"stats.jpg",
  security:"security.jpg",
  status:"status.jpg",
  error:"error.jpg"
};

function getCategory({mode,text="",imageData=false}={}){
  const t=String(text).toLowerCase();
  if(mode==="image"||/\\.imagine\\b|image generation|generate image|create image/.test(t))return"image";
  if(mode==="video"||/\\.video\\b|video generation|generate video|create video/.test(t))return"video";
  if(imageData)return"vision";
  if(mode==="memory"||/\\bmemory\\b|remember|forget memory/.test(t))return"memory";
  if(mode==="stats"||/\\bstats\\b|analytics|usage/.test(t))return"stats";
  if(mode==="status"||/\\bstatus\\b|online|health|system status/.test(t))return"status";
  if(mode==="block"||mode==="unblock"||mode==="maintenance_on"||mode==="maintenance_off"||/\\badmin\\b|maintenance|block user|unblock user/.test(t))return"admin";
  if(/github|git hub|repository|repo|pull request|\\bpr\\b|commit|branch|issue/.test(t))return"github";
  if(/web search|search the web|search online|latest news|find online/.test(t))return"web";
  if(/\\bcode\\b|coding|debug|error in code|javascript|node\\.js|python|typescript/.test(t))return"code";
  if(/voice|audio|speak|voice note|transcribe/.test(t))return"voice";
  if(/group|group info|anti-link|admin in group/.test(t))return"group";
  if(/download|convert|youtube|\\.play\\b|\\.song\\b|\\.yt\\b|utility/.test(t))return"utility";
  if(/security|blocked|permission|safe/.test(t))return"security";
  return"ai";
}

function getImage(category){
  const filename=FILES[category]||FILES.ai;
  const full=path.join(ROOT,filename);
  return fs.existsSync(full)?full:null;
}

module.exports={ROOT,FILES,getCategory,getImage};
