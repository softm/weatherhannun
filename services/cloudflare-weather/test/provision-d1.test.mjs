import test from "node:test";
import assert from "node:assert/strict";
import {renderConfig,findDatabase,stageConfig} from "../scripts/provision-d1.mjs";
const template = [
'name = "__WORKER_NAME__"',
'[[d1_databases]]',
'binding = "DB"',
'database_name = "__D1_DATABASE_NAME__"',
'database_id = "__D1_DATABASE_ID__"',
'namespace_id = "__RATE_NAMESPACE__"',
'APP_ENV = "__APP_ENV__"'].join("\n");
const id = "12345678-abcd-1234-abcd-123456789abc";
test("staging and production must use different Worker, D1 and rate limit names", () => {
  assert.notEqual(stageConfig.staging.worker,stageConfig.production.worker);
  assert.notEqual(stageConfig.staging.database,stageConfig.production.database);
  assert.notEqual(stageConfig.staging.namespace,stageConfig.production.namespace);
});
test("Wrangler staging config binds an existing D1 by UUID without secrets", () => {
  const result=renderConfig(template,"staging",id);
  assert.match(result,/name = "weatherhannun-api-staging"/);
  assert.match(result,/database_name = "weatherhannun-staging"/);
  assert.match(result,/namespace_id = "110401"/);
  assert.ok(result.includes(id));
  assert.doesNotMatch(result,/__WORKER_NAME__|__D1_DATABASE_ID__/);
});
test("D1 discovery only uses exact expected name", () => {
  const list=[{name:"weatherhannun",uuid:id},{name:"weatherhannun-staging",uuid:"99999999-abcd-1234-abcd-123456789abc"}];
  assert.equal(findDatabase(list,"weatherhannun-staging").name,"weatherhannun-staging");
  assert.equal(findDatabase(list,"weatherhannun-prod"),null);
});
test("unsafe D1 ids or unexpected stages are rejected", () => {
  assert.throws(()=>renderConfig(template,"production","bad-id"),/invalid_d1_database_id/);
  assert.throws(()=>renderConfig(template,"unknown",id),/invalid_deploy_stage/);
});
