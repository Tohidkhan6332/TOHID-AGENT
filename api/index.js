module.exports=(req,res)=>{
  res.status(200).json({
    name:"TOHID-AGENT",
    version:"3.0.0",
    developer:"Tohid",
    status:"online",
    note:"WhatsApp worker must run on a persistent worker host. Vercel is suitable for the HTTP/API layer, not the long-running Baileys WhatsApp connection."
  });
};
