const db=require("./database");

const ROLES={
  primary_owner:{label:"Primary Owner",permissions:["*"]},
  delegated_owner:{label:"Delegated Owner",permissions:["*","owner.manage.read"]},
  developer:{label:"Developer",permissions:["github.read","github.write","hosting.read","hosting.write","plugins.read","plugins.write","files.read","files.write","missions.write"]},
  admin:{label:"Admin",permissions:["bot.read","bot.write","users.manage","plugins.read","plugins.write","missions.write"]},
  user:{label:"User",permissions:["bot.read","ai.use","memory.use"]}
};

function normalize(jid){return String(jid||"").split("@")[0].replace(/\D/g,"");}
async function getRole(jid,cfg,delegatedOwners){
  const n=normalize(jid);
  if(cfg.ownerNumber&&n===cfg.ownerNumber)return"primary_owner";
  if(delegatedOwners?.has(n))return"delegated_owner";
  const p=await db.getProfile(jid);
  return ROLES[p.role]?p.role:"user";
}
async function setRole(jid,role){if(!ROLES[role])throw new Error("Unknown role: "+role);return db.setProfile(jid,{role});}
async function can(jid,permission,cfg,delegatedOwners){
  const role=await getRole(jid,cfg,delegatedOwners);
  const list=ROLES[role]?.permissions||[];
  return list.includes("*")||list.includes(permission)||list.includes(permission.split(".")[0]+".*");
}
function listRoles(){return Object.entries(ROLES).map(([id,x])=>({id,label:x.label,permissions:x.permissions}));}
module.exports={ROLES,normalize,getRole,setRole,can,listRoles};