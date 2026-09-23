#!/usr/bin/env node
const doctor=require("../lib/doctor");
const cfg=require("../config");
const db=require("../lib/database");
const plugins=require("../lib/pluginManager");

(async()=>{
  try{
    const result=await doctor.run({cfg,db,plugins});
    console.log(doctor.format(result));
    process.exitCode=result.ok?0:1;
  }catch(error){
    console.error("❌ Doctor failed:",error?.stack||error?.message||error);
    process.exitCode=1;
  }finally{
    try{await db.close();}catch{}
  }
})();
