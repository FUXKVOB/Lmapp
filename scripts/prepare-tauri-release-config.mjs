import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const configPath = path.join(projectRoot, "src-tauri", "tauri.conf.json");

const updaterPubkey = process.env.TAURI_UPDATER_PUBKEY?.trim();

if (!updaterPubkey) {
  console.error("TAURI_UPDATER_PUBKEY is required for release builds.");
  process.exit(1);
}

const rawConfig = fs.readFileSync(configPath, "utf8");
const config = JSON.parse(rawConfig);

if (!config.plugins?.updater) {
  console.error("Updater plugin config was not found in src-tauri/tauri.conf.json.");
  process.exit(1);
}

config.plugins.updater.pubkey = updaterPubkey;

fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

console.log("Injected updater public key into src-tauri/tauri.conf.json for this build.");
