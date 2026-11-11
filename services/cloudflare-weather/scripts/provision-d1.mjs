#!/usr/bin/env node
// Idempotent Cloudflare D1 provisioning. Must run only with account-scoped CI credentials.
// Never prints token values, API keys or user weather payloads.
import {readFileSync, writeFileSync} from "node:fs";
import {execFileSync} from "node:child_process";

export const stageConfig = {
  staging: {worker: "weatherhannun-api-staging", database: "weatherhannun-staging", namespace: "110401"},
  production: {worker: "weatherhannun-api", database: "weatherhannun", namespace: "110402"},
};
export function renderConfig(template, stage, id) {
  if (!stageConfig[stage]) throw new Error("invalid_deploy_stage");
  if (!/^[\da-f]{8}-[\da-f-]{27,}$/i.test(id)) throw new Error("invalid_d1_database_id");
  const config = stageConfig[stage];
  return template.replaceAll("__WORKER_NAME__", config.worker)
    .replaceAll("__D1_DATABASE_NAME__", config.database)
    .replaceAll("__D1_DATABASE_ID__", id)
    .replaceAll("__RATE_NAMESPACE__", config.namespace)
    .replaceAll("__APP_ENV__", stage);
}
export function findDatabase(list, name) {
  return list.find(row => row.name === name || row.database_name === name) || null;
}
function wrangler(...args) {
  return execFileSync("npx", ["wrangler", ...args], {encoding: "utf8", stdio: ["ignore", "pipe", "pipe"]});
}
function listD1() {
  const output = wrangler("d1", "list", "--json").trim();
  const rows = JSON.parse(output);
  if (!Array.isArray(rows)) throw new Error("invalid_cloudflare_d1_list");
  return rows;
}
export function run() {
  const stage = process.argv[2];
  if (!stageConfig[stage]) throw new Error("Usage: provision-d1.mjs staging|production");
  if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID) {
    throw new Error("CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required");
  }
  const {database, worker} = stageConfig[stage];
  let row = findDatabase(listD1(), database);
  if (!row) {
    if (stage === "production" && process.env.CONFIRM_PRODUCTION !== "DEPLOY_PRODUCTION") {
      throw new Error("production_database_creation_requires_confirmation");
    }
    wrangler("d1", "create", database, "--location", "apac");
    row = findDatabase(listD1(), database);
  }
  const id = String(row?.uuid || row?.id || "");
  const template = readFileSync(new URL("../wrangler.template.toml", import.meta.url), "utf8");
  const config = renderConfig(template, stage, id);
  writeFileSync(new URL("../wrangler.toml", import.meta.url), config, {mode: 0o600});
  console.log("D1 ready:", database, "; Worker:", worker, "; stage:", stage);
}
if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) {
  try {run();} catch (error) {console.error("provision_error:", error.message); process.exitCode = 1;}
}
