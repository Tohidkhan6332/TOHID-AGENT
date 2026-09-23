#!/usr/bin/env node
const fs=require("fs");
const path=require("path");
const {execFileSync}=require("child_process");

const root=path.resolve(__dirname,"..");
const files=[];
function walk(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(["node_modules",".git","auth_info_baileys","tmp","plugins"].includes(entry.name))continue;
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())walk(full);
    else if(entry.isFile()&&full.endsWith(".js"))files.push(full);
  }
}
walk(root);

const failures=[];
for(const file of files){
  try{execFileSync(process.execPath,["--check",file],{stdio:"pipe"});}
  catch(error){failures.push(path.relative(root,file)+": "+String(error.stderr||error.stdout||error.message).trim());}
}
for(const file of ["package.json","app.json","railway.json","vercel.json"]){
  const full=path.join(root,file);
  if(!fs.existsSync(full))continue;
  try{JSON.parse(fs.readFileSync(full,"utf8"));console.log("✓ JSON "+file);}
  catch(error){failures.push(file+": invalid JSON: "+error.message);}
}
if(!fs.existsSync(path.join(root,"app.js")))failures.push("app.js is missing");
if(!fs.existsSync(path.join(root,"MrTohid.js")))failures.push("MrTohid.js is missing");
if(failures.length){
  console.error("\n❌ Validation failed:");
  failures.forEach(x=>console.error(" - "+x));
  process.exit(1);
}
console.log("\n✅ TOHID-AGENT static validation passed ("+files.length+" JS files checked).");
