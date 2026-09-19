function route(text,prefix="."){
 const t=text.trim().toLowerCase();
 if(t.startsWith(prefix+"imagine "))return"image";
 if(t.startsWith(prefix+"video "))return"video";
 if(t===prefix+"help")return"help";
 if(t===prefix+"menu")return"menu";
 if(t===prefix+"ping")return"ping";
 if(t===prefix+"status")return"status";
 if(t===prefix+"newchat"||t===prefix+"reset")return"reset";
 if(t===prefix+"stats")return"stats";
 if(t===prefix+"memory")return"memory";
 if(t===prefix+"profile"||t.startsWith(prefix+"profile "))return"profile";
 if(t===prefix+"settings"||/^(voice|memory)\s+(on|off)$/i.test(t.slice(prefix.length)))return"settings";
 if(t===prefix+"maintenance on")return"maintenance_on";
 if(t===prefix+"maintenance off")return"maintenance_off";
 if(t.startsWith(prefix+"block "))return"block";
 if(t.startsWith(prefix+"unblock "))return"unblock";
 return"ai";
}
module.exports={route};