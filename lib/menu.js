const MENUS={
 main:[
  ["AI Chat","Send any message to chat with TOHID-AGENT."],
  ["Generate Image","Use .imagine <prompt>"],
  ["Generate Video","Use .video <prompt>"],
  ["Voice","Use .voice on/off"],
  ["Memory","Use .memory or .memory on/off"],
  ["GitHub","Ask naturally for GitHub actions"],
  ["Heroku","List/inspect apps, logs, builds, releases, rollback, config vars, maintenance, scale or redeploy"],
  ["Agent Planner","Use .plan <task> for a structured execution plan"],
  ["Stats","Use .stats (owner)"],
  ["Admin","Owner commands: .maintenance, .block, .unblock"],
  ["Settings","Use .settings"]
 ],
 settings:[
  ["Voice","Use .voice on/off"],
  ["Memory","Use .memory on/off"],
  ["Status","Use .status"],
  ["Back","Use .menu"]
 ],
 github:[
  ["Repositories","Ask: list my GitHub repositories"],
  ["Search","Ask: search GitHub for <query>"],
  ["Read File","Ask: read <repo> <path>"],
  ["Create Branch","Ask: create branch <repo> <branch>"],
  ["Create Issue","Ask: create issue <repo> <title>"],
  ["Create PR","Ask: create PR <repo> <branch> <title>"],
  ["Back","Use .menu"]
 ]
};
async function sendMenu(sock,jid,kind="main",options={}){
 const rows=MENUS[kind]||MENUS.main;
 const text=options.text||"🤖 *TOHID-AGENT V7.5*\n\nSelect an option by sending the command/action as text:";
 const body=rows.map(([label,action],i)=>(i+1)+". *"+label+"* — "+action).join("\n");
 return sock.sendMessage(jid,{text:text+"\n\n"+body});
}
module.exports={sendMenu,MENUS};