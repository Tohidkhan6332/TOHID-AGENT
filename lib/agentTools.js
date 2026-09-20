const os=require("os");
const cfg=require("../config");
const defs=[
{type:"function",name:"calculator",description:"Evaluate basic arithmetic using numbers, operators, parentheses, decimals and percentages.",parameters:{type:"object",properties:{expression:{type:"string"}},required:["expression"],additionalProperties:false}},
{type:"function",name:"system_info",description:"Return safe runtime information about TOHID-AGENT. Never return secrets.",parameters:{type:"object",properties:{},required:[],additionalProperties:false}},
{type:"function",name:"current_time",description:"Return current server date/time and timezone.",parameters:{type:"object",properties:{},required:[],additionalProperties:false}}
];
function safeCalc(expression){
 const raw=String(expression||"").trim().replace(/,/g,"");
 if(!raw||raw.length>100||!/^[0-9+\-*/().%\s]+$/.test(raw))throw new Error("Invalid calculation.");
 const normalized=raw.replace(/(\d+(?:\.\d+)?)%/g,"($1/100)");
 const value=Function("return ("+normalized+")")();
 if(!Number.isFinite(value))throw new Error("Calculation is not finite.");
 return{expression:raw,result:value};
}
function run(name,args={}){
 if(name==="calculator")return safeCalc(args.expression);
 if(name==="system_info")return{node:process.version,platform:process.platform,arch:process.arch,uptime_seconds:Math.round(process.uptime()),memory_mb:Math.round(process.memoryUsage().rss/1024/1024),hostname:os.hostname(),agent_version:cfg.version};
 if(name==="current_time")return{iso:new Date().toISOString(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone};
 throw new Error("Unknown local tool: "+name);
}
module.exports={defs,run};