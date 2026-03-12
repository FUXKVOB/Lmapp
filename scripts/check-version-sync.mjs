import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(projectRoot, relativePath), "utf8"));
}

function readCargoVersion(relativePath) {
  const raw = fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
  const match = raw.match(/^version\s*=\s*"([^"]+)"/m);
  if (!match) {
    throw new Error(`Could not find package version in ${relativePath}`);
  }
  return match[1];
}

const packageVersion = readJson("package.json").version;
const tauriVersion = readJson(path.join("src-tauri", "tauri.conf.json")).version;
const cargoVersion = readCargoVersion(path.join("src-tauri", "Cargo.toml"));
const latestVersion = readJson("latest.json").version;

const versions = {
  "package.json": packageVersion,
  "src-tauri/tauri.conf.json": tauriVersion,
  "src-tauri/Cargo.toml": cargoVersion,
  "latest.json": latestVersion
};

const uniqueVersions = [...new Set(Object.values(versions))];

if (uniqueVersions.length !== 1) {
  console.error("Version mismatch detected:");
  for (const [file, version] of Object.entries(versions)) {
    console.error(`- ${file}: ${version}`);
  }
  process.exit(1);
}

console.log(`Version sync OK: ${packageVersion}`);
