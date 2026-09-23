const fs=require("fs");
const path=require("path");
require("dotenv").config();

function loadSecrets(){
  try{
    const file=path.join(__dirname,"secrets.js");
    if(fs.existsSync(file))return require(file)||{};
  }catch(error){
    console.warn("⚠️ Private secrets file could not be loaded:",error?.message||error);
  }
  return {};
}
const secrets=loadSecrets();

module.exports={
  developer:"Tohid",
  brand:"TOHID-AGENT",
  version:"11.2.0",

  // Private secrets live in secrets.js (gitignored). Runtime env is kept small.
  // Built-in downloader/API provider configuration lives here so deployers do not need API ENV variables.
  apiProviders:Object.freeze({
    xteam:{baseUrl:"https://api.xteam.xyz",apiKey:""},
    dzx:{baseUrl:"https://api.dhamzxploit.my.id",apiKey:""},
    lol:{baseUrl:"https://api.lolhuman.xyz",apiKey:""},
    violetics:{baseUrl:"https://violetics.pw",apiKey:""},
    neoxr:{baseUrl:"https://api.neoxr.my.id",apiKey:""},
    zenzapis:{baseUrl:"https://zenzapis.xyz",apiKey:""},
    akuari:{baseUrl:"https://api.akuari.my.id",apiKey:""},
    akuari2:{baseUrl:"https://apimu.my.id",apiKey:""},
    nrtm:{baseUrl:"https://fg-nrtm.ddns.net",apiKey:""},
    bg:{baseUrl:"http://bochil.ddns.net",apiKey:""},
    fgmods:{baseUrl:"https://api-fgmods.ddns.net",apiKey:""},
    discard:{baseUrl:"https://discardapi.dpdns.org",apiKey:"guru"},
    qasimdev:{baseUrl:"https://api.qasimdev.dpdns.org",apiKey:"qasim-dev"}
  }),
  openaiKey:secrets.openaiApiKey||"",
  geminiKey:secrets.geminiApiKey||"",
  githubToken:secrets.githubToken||"",
  herokuToken:secrets.herokuApiKey||"",
  vercelToken:secrets.vercelToken||"",
  renderApiKey:secrets.renderApiKey||"",
  koyebToken:secrets.koyebApiToken||"",
  telegramBotToken:secrets.telegramBotToken||"",
  adminPanelToken:secrets.adminPanelToken||"",

  // Stable application defaults belong in code, not deployment ENV.
  defaultLanguage:"English",
  defaultUIMode:"auto",
  pluginSystemEnabled:true,
  pluginInstallLimitKb:512,
  remoteShellEnabled:false,
  openaiModel:"gpt-5.6-luna",
  model:"gpt-5.6-luna",
  geminiModel:"gemini-3.8-flash",
  geminiImageModel:"gemini-3.1-flash-image",
  geminiVideoModel:"veo-3.1-generate-preview",
  geminiTtsModel:"gemini-3.1-flash-tts-preview",
  geminiTtsVoice:"Kore",
  geminiTranscribeModel:"gemini-3.5-transcribe",
  aiProvider:"auto",
  imageModel:"gpt-image-2",
  videoModel:"sora-2",
  videoSeconds:8,
  videoSize:"1280x720",
  videoEnabled:true,
  transcribeModel:"gpt-4o-transcribe",
  ttsModel:"gpt-4o-mini-tts",
  ttsVoice:"cedar",
  githubOwner:"Tohidkhan6332",
  delegatedOwnerNumbers:[],
  enabled:true,
  voiceReply:false,
  webSearch:true,
  prefix:".",
  groupMode:"mention",
  rateLimitPerMinute:20,
  pendingActionTtlMs:300000,
  adminPanelEnabled:false,
  maxMessageChars:12000,
  maxMemoryMessages:50,
  toolLoopLimit:8,
  requestTimeoutMs:120000,
  maxOutputChars:12000,
  agentMode:"autonomous",
  plannerEnabled:true,
  autonomousTasks:true,
  taskHistoryLimit:20,
  taskVerification:true,
  interactiveButtonsEnabled:true,
  baileysExtrasEnabled:true,
  debug:false,
  githubEnabled:true,
  hostingEnabled:true,
  strictProduction:true,
  missionSchedulerEnabled:true,
  missionPollIntervalMs:60000,
  telegramPairingEnabled:true,

  // Deployment/user-specific runtime values only.
  ownerNumber:String(process.env.OWNER_NUMBER||"").replace(/\D/g,""),
  mongoUri:process.env.MONGO_URI||"",
  postgresUrl:process.env.POSTGRES_URL||"",
  postgresSsl:String(process.env.POSTGRES_SSL||"false").toLowerCase()==="true",
  postgresPoolMax:Number(process.env.POSTGRES_POOL_MAX||5),
  mongoDb:process.env.MONGO_DB||"tohid-agent",
  loginMethod:(process.env.LOGIN_METHOD||"pairing").toLowerCase(),
  pairingNumber:String(process.env.PAIRING_NUMBER||"").replace(/\D/g,""),
  telegramPairingEnabled:true
};