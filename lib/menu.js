const FOOTER="TOHID-AGENT V4 • By Tohid";

const MENUS={
  main:[
    ["menu_ai","🤖 AI Chat"],["menu_image","🖼️ Generate Image"],["menu_video","🎬 Generate Video"],
    ["menu_voice","🎤 Voice"],["menu_memory","🧠 Memory"],["menu_github","💻 GitHub"],
    ["menu_stats","📊 Stats"],["menu_settings","⚙️ Settings"]
  ],
  settings:[
    ["settings_voice_on","🎙️ Voice ON"],["settings_voice_off","🔇 Voice OFF"],
    ["settings_memory_on","🧠 Memory ON"],["settings_memory_off","🧹 Memory OFF"],
    ["settings_buttons","🔘 Use Buttons"],["settings_text","📝 Use Text"],["menu_back","⬅️ Back"]
  ],
  github:[
    ["github_repos","📁 Repositories"],["github_search","🔎 Search"],["github_read","📄 Read File"],
    ["github_branch","🌿 Create Branch"],["github_issue","🐛 Create Issue"],["github_pr","🔀 Create PR"],["menu_back","⬅️ Back"]
  ]
};

async function sendMenu(sock,jid,kind="main",options={}){
  const rows=MENUS[kind]||MENUS.main;
  const text=options.text||"🤖 *TOHID-AGENT V4*\\nSelect an option:";
  const buttons=rows.map(([id,label])=>({buttonId:id,buttonText:{displayText:label},type:1}));
  try{
    await sock.sendMessage(jid,{text,footer:FOOTER,buttons,headerType:1});
    return true;
  }catch(e){
    const fallback=text+"\\n\\n"+rows.map(([,label],i)=>((i+1)+". "+label)).join("\\n")+"\\n\\nReply with the option number or use .menu.";
    await sock.sendMessage(jid,{text:fallback});
    return false;
  }
}

function buttonId(message){
  return message?.buttonsResponseMessage?.selectedButtonId||message?.templateButtonReplyMessage?.selectedId||message?.listResponseMessage?.singleSelectReply?.selectedRowId||null;
}
module.exports={sendMenu,buttonId,MENUS};
