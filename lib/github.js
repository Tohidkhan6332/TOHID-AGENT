const axios=require("axios");
const cfg=require("../config");

function api(){
  if(!cfg.githubToken) throw new Error("GITHUB_TOKEN is not configured.");
  return axios.create({
    baseURL:"https://api.github.com",
    headers:{
      Authorization:"Bearer "+cfg.githubToken,
      Accept:"application/vnd.github+json",
      "X-GitHub-Api-Version":"2022-11-28",
      "User-Agent":"TOHID-AGENT"
    }
  });
}
async function listRepos(owner=cfg.githubOwner){
  const r=await api().get("/users/"+encodeURIComponent(owner)+"/repos",{params:{per_page:100,sort:"updated"}});
  return r.data.map(x=>({name:x.name,private:x.private,default_branch:x.default_branch,url:x.html_url}));
}
async function getFile(repo,path,ref){
  const r=await api().get("/repos/"+repo+"/contents/"+path,{params:ref?{ref}:{}});
  if(Array.isArray(r.data)) return r.data.map(x=>({name:x.name,path:x.path,type:x.type,url:x.html_url}));
  return {
    name:r.data.name,path:r.data.path,sha:r.data.sha,
    content:Buffer.from(r.data.content||"","base64").toString("utf8"),
    url:r.data.html_url
  };
}
async function putFile(repo,path,content,message,branch,sha){
  const body={message,content:Buffer.from(content).toString("base64")};
  if(branch) body.branch=branch;
  if(sha) body.sha=sha;
  const r=await api().put("/repos/"+repo+"/contents/"+path,body);
  return {commit:r.data.commit.sha,url:r.data.content?.html_url};
}
async function createBranch(repo,branch,from="main"){
  const base=await api().get("/repos/"+repo+"/git/ref/heads/"+encodeURIComponent(from));
  const r=await api().post("/repos/"+repo+"/git/refs",{ref:"refs/heads/"+branch,sha:base.data.object.sha});
  return {branch,sha:r.data.object.sha};
}
async function issue(repo,title,body=""){
  const r=await api().post("/repos/"+repo+"/issues",{title,body});
  return {number:r.data.number,url:r.data.html_url};
}
async function pull(repo,title,head,base="main",body=""){
  const r=await api().post("/repos/"+repo+"/pulls",{title,head,base,body});
  return {number:r.data.number,url:r.data.html_url};
}
module.exports={listRepos,getFile,putFile,createBranch,issue,pull};
