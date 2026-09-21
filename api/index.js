module.exports=(req,res)=>{
  res.status(200).json({
    name:"TOHID-AGENT",
    version:"11.2.0",
    developer:"Tohid",
    status:"api-online",
    note:"The WhatsApp Baileys worker requires a persistent host."
  });
};
