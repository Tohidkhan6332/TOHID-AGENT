const skills=[
  {id:"core",name:"Agent Core",status:"active",description:"Planning, safety, verification and task lifecycle."},
  {id:"memory",name:"Long-Term Memory",status:"active",description:"Conversation memory, profiles and settings."},
  {id:"github",name:"GitHub Engineer",status:"active",description:"Repositories, files, branches, issues and pull requests."},
  {id:"devops",name:"DevOps",status:"active",description:"Vercel, Render, Koyeb and Heroku operations."},
  {id:"vision",name:"Vision",status:"active",description:"Image understanding and visual troubleshooting."},
  {id:"voice",name:"Voice",status:"active",description:"Speech transcription and voice responses."},
  {id:"media",name:"Media Studio",status:"active",description:"Image and video generation."},
  {id:"planner",name:"Autonomous Planner",status:"active",description:"Multi-step planning with verification gates."},
  {id:"security",name:"Security Guard",status:"active",description:"Owner authorization, confirmation, rate limits and secret protection."}
];
function list(){return skills;}
function get(id){return skills.find(x=>x.id===id)||null;}
module.exports={skills,list,get};
