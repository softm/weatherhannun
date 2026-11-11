// Cloudflare Workers Builds deploy entry point (no TinyFish or GitHub secrets).
// Workers Builds auto-created token has Workers KV edit permission, unlike D1.
import {readFileSync, writeFileSync} from "node:fs";
import {spawnSync} from "node:child_process";

const exec = (...args) => {
  const result = spawnSync("npx", ["wrangler", ...args], {encoding: "utf8",
    env: {...process.env, CI: "true"}});
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout || "Wrangler command failed");
    throw new Error("wrangler_" + args.join("_") + "_failed");
  }
  return result.stdout;
};
const listNamespaces = () => {
  const output = exec("kv", "namespace", "list");
  const begin = output.indexOf("[");
  const end = output.lastIndexOf("]");
  if (begin < 0 || end <= begin) throw new Error("kv_namespace_list_invalid");
  const data = JSON.parse(output.slice(begin, end + 1));
  if (!Array.isArray(data)) throw new Error("kv_namespace_list_not_array");
  return data;
};
const expectedNames = new Set(["weatherhannun-api-CACHE", "weatherhannun-api_CACHE"]);
const namespaceName = "weatherhannun-api-CACHE";
const initialConfig = `name = "weatherhannun-api"
main = "src/index.mjs"
compatibility_date = "2026-11-01"
compatibility_flags = ["nodejs_compat"]
workers_dev = true
`;
writeFileSync("wrangler.toml", initialConfig);
const before = listNamespaces();
let namespace = before.find(row => expectedNames.has(row.title));
if (!namespace) {
  // Create exactly one namespace for this Worker. We never delete existing resources.
  exec("kv", "namespace", "create", "CACHE");
  const after = listNamespaces();
  namespace = after.find(row => expectedNames.has(row.title))
    || after.find(row => !before.some(old => old.id === row.id));
}
if (!namespace?.id || !/^[a-f0-9]{32}$/i.test(namespace.id)) {
  throw new Error("cloudflare_kv_namespace_not_found: " + namespaceName);
}
const config = readFileSync("wrangler.kv.template.toml", "utf8")
  .replace("__KV_NAMESPACE_ID__", namespace.id);
writeFileSync("wrangler.toml", config);
console.log("Cloudflare KV binding configured for namespace: " + namespaceName);
exec("deploy");
console.log("Cloudflare Worker deployed with KV cache.");
