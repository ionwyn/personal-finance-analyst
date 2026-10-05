import { copyFile, access, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const configPath = resolve(root, "assistant-config.json");
const examplePath = resolve(root, "assistant-config.example.json");
const configJson = process.env.ASSISTANT_CONFIG_JSON;

if (configJson) {
  let parsed;
  try {
    parsed = JSON.parse(configJson);
  } catch {
    throw new Error("ASSISTANT_CONFIG_JSON must contain valid JSON.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("ASSISTANT_CONFIG_JSON must contain a JSON object.");
  }
  await writeFile(configPath, `${JSON.stringify(parsed, null, 2)}\n`, {
    mode: 0o600,
  });
  console.log("Prepared assistant-config.json from ASSISTANT_CONFIG_JSON.");
} else {
  try {
    await access(configPath, constants.F_OK);
  } catch {
    await copyFile(examplePath, configPath);
    console.log("Prepared assistant-config.json from assistant-config.example.json.");
  }
}
