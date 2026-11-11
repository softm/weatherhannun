import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, chmodSync, rmSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {tmpdir} from "node:os";
import {join} from "node:path";

test("Cloudflare Git build bootstrap creates KV once and reuses it", () => {
  const directory = mkdtempSync(join(tmpdir(), "weatherhannun-kv-"));
  try {
    mkdirSync(join(directory, "scripts"));
    mkdirSync(join(directory, "bin"));
    writeFileSync(join(directory, "scripts", "deploy-git.mjs"),
      readFileSync(new URL("../scripts/deploy-git.mjs", import.meta.url)));
    writeFileSync(join(directory, "wrangler.kv.template.toml"),
      readFileSync(new URL("../wrangler.kv.template.toml", import.meta.url)));
    const fakeNpx = join(directory, "bin", "npx");
    const mock = `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2).join(" ");
const file = "mock-kv.json";
const rows = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file,"utf8")) : [];
if (args === "wrangler kv namespace list") console.log(JSON.stringify(rows));
else if (args === "wrangler kv namespace create CACHE") {
  if (rows.length) process.exit(2);
  rows.push({title:"weatherhannun-api-CACHE",id:"0123456789abcdef0123456789abcdef"});
  fs.writeFileSync(file,JSON.stringify(rows));
  console.log("Created");
} else if (args === "wrangler deploy") console.log("Deployed");
else {console.error("Unknown command " + args);process.exit(3);}
`;
    writeFileSync(fakeNpx, mock);
    chmodSync(fakeNpx, 0o755);
    const run = () => spawnSync(process.execPath, ["scripts/deploy-git.mjs"], {
      cwd: directory, encoding: "utf8",
      env: {...process.env, PATH: join(directory, "bin") + ":" + process.env.PATH}
    });
    const first = run();
    assert.equal(first.status, 0, first.stderr || first.stdout);
    const config = readFileSync(join(directory, "wrangler.toml"), "utf8");
    assert.match(config, /id = "0123456789abcdef0123456789abcdef"/);
    assert.match(config, /binding = "CACHE"/);
    const second = run();
    assert.equal(second.status, 0, second.stderr || second.stdout);
    assert.equal(JSON.parse(readFileSync(join(directory, "mock-kv.json"))).length, 1);
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
});
