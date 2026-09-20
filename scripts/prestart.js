const preflight=require("../lib/preflight");
const log=require("../lib/logger");
const result=preflight.validate();
log.info("TOHID-AGENT production preflight",preflight.safeSummary());
if(result.warnings.length)result.warnings.forEach(x=>log.warn(x));
if(!result.ok){
  result.errors.forEach(x=>log.error(x));
  process.exit(1);
}
log.info("Preflight passed");
