module.exports=(req,res)=>{
  res.status(200).json({
    name:"TOHID-AGENT",
    version:"6.3.0",
    developer:"Tohid",
    status:"api-online",
    note:"The WhatsApp Baileys worker requires a persistent host."
  });
};
