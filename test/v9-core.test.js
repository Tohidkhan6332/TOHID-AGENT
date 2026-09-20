const assert=require("assert");
const fs=require("fs");
const core=require("../lib/agentCore");
const mission=require("../lib/mission");

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
