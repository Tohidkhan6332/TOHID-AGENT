const assert=require("assert");
const fs=require("fs");
const core=require("../lib/agentCore");
const mission=require("../lib/mission");
const plugins=require("../lib/pluginManager");

const plan=core.createPlan("Build my website and deploy it to Vercel");
assert.ok(plan.steps.length>=2);
assert.ok(plan.confirmationRequired);
assert.strictEqual(core.classifyAction("list repositories"),"low");
assert.strictEqual(core.classifyAction("delete deployment"),"critical");
assert.ok(mission.STATUS.RUNNING);

const extras=fs.readFileSync(require.resolve("../lib/baileysForkExtras"),"utf8");
assert.ok(extras.includes("mauricegift/baileys-new"));
assert.ok(!extras.includes("makeWASocket("));

const adapter=fs.readFileSync(require.resolve("../lib/baileysExtras"),"utf8");
assert.ok(adapter.includes('primary:"official"'));
assert.ok(adapter.includes('secondSocket:false'));

console.log("TOHID-AGENT V9 core tests passed.");


const validation=plugins.validateSource(`module.exports={name:"test-plugin",version:"1.0.0",commands:{hello:async()=>{}}};`);
assert.strictEqual(validation.warning,null);
assert.throws(()=>plugins.validateSource("module.exports={"),/Unexpected token|Unexpected end/);
assert.ok(Array.isArray(plugins.list()));
console.log("V10 plugin manager tests passed.");
