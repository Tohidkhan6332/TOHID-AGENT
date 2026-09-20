const startedAt=Date.now();
function line(level,message,meta){
  const payload=meta&&Object.keys(meta).length?" "+JSON.stringify(meta):"";
  console.log("["+new Date().toISOString()+"] ["+level+"] "+message+payload);
}
module.exports={
  startedAt,
  info:(message,meta)=>line("INFO",message,meta),
  warn:(message,meta)=>line("WARN",message,meta),
  error:(message,meta)=>line("ERROR",message,meta),
  uptime:()=>Math.floor((Date.now()-startedAt)/1000)
};
