const catalog=require("./commandCatalog");
const MENUS={
 main:[["All Commands","Open the complete command catalog with examples"],["AI / Chat","AI, memory, voice and generation commands"],["Group Protection","AntiLink, AntiStatus, AntiTag, AntiBot, AntiBad, AntiPDM"],["Welcome / Goodbye","Join/leave messages and custom media"],["Developer / Admin","GitHub, plugins, files, hosting, owners and control"]]
};
async function sendMenu(sock,jid,kind="main",options={}){
 const text=options.text||catalog.menuText();
 return sock.sendMessage(jid,{text});
}
module.exports={sendMenu,MENUS};
