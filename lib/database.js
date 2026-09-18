const {MongoClient}=require("mongodb");
const cfg=require("../config");
let client,db;
async function connect(){if(!cfg.mongoUri)return null;if(db)return db;client=new MongoClient(cfg.mongoUri);await client.connect();db=client.db(cfg.mongoDb);await Promise.all([db.collection("users").createIndex({jid:1},{unique:true}),db.collection("conversations").createIndex({jid:1},{unique:true}),db.collection("usage").createIndex({jid:1},{unique:true})]);return db;}
async function getMemory(jid){const d=await connect();if(!d)return [];return (await d.collection("conversations").findOne({jid}))?.messages||[];}
async function saveMemory(jid,messages){const d=await connect();if(d)await d.collection("conversations").updateOne({jid},{$set:{messages:messages.slice(-20),updatedAt:new Date()}},{upsert:true});}
async function clearMemory(jid){const d=await connect();if(d)await d.collection("conversations").deleteOne({jid});}
async function track(jid,type){const d=await connect();if(!d)return;await d.collection("users").updateOne({jid},{$set:{lastSeen:new Date()},$setOnInsert:{createdAt:new Date()}},{upsert:true});await d.collection("usage").updateOne({jid},{$inc:{[type]:1},$set:{updatedAt:new Date()}},{upsert:true});}
async function stats(){const d=await connect();if(!d)return {database:false};const [users,usage]=await Promise.all([d.collection("users").countDocuments(),d.collection("usage").aggregate([{$group:{_id:null,chat:{$sum:"$chat"},voice:{$sum:"$voice"},image:{$sum:"$image"},video:{$sum:"$video"}}}]).toArray()]);return {database:true,users,usage:usage[0]||{chat:0,voice:0,image:0,video:0}};}
module.exports={connect,getMemory,saveMemory,clearMemory,track,stats};