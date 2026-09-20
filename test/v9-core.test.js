const assert=require("assert");
const core=require("../lib/agentCore");
const mission=require("../lib/mission");

const plan=core.createPlan("Build my website and deploy it to Vercel");
assert.ok(plan.steps.length>=2);
assert.ok(plan.confirmationRequired);
assert.strictEqual(core.classifyAction("list repositories"),"low");
assert.strictEqual(core.classifyAction("delete deployment"),"critical");
assert.ok(mission.STATUS.RUNNING);

console.log("TOHID-AGENT V9 core tests passed.");
