import "dotenv/config";

import { stdin, stdout } from "node:process";
import readline from "node:readline";

import { encryptToken } from "../src/lib/security/token-crypto";

function readFromPipe() {
  return new Promise<string>((resolve, reject) => {
    let value = "";
    stdin.setEncoding("utf8");
    stdin.on("data", (chunk) => {
      value += chunk;
    });
    stdin.on("end", () => {
      resolve(value.trimEnd());
    });
    stdin.on("error", reject);
  });
}

function readHiddenLine(prompt: string) {
  return new Promise<string>((resolve, reject) => {
    readline.emitKeypressEvents(stdin);

    const wasRaw = stdin.isRaw;
    if (stdin.setRawMode) stdin.setRawMode(true);
    stdin.resume();
    stdout.write(prompt);

    let value = "";

    function cleanup() {
      if (stdin.setRawMode) stdin.setRawMode(wasRaw);
      stdin.off("keypress", onKeypress);
      stdout.write("\n");
    }

    function onKeypress(str: string, key: readline.Key) {
      if (key.ctrl && key.name === "c") {
        cleanup();
        reject(new Error("Cancelled."));
        return;
      }

      if (key.name === "return" || key.name === "enter") {
        cleanup();
        resolve(value);
        return;
      }

      if (key.name === "backspace") {
        if (value.length > 0) {
          value = value.slice(0, -1);
          stdout.write("\b \b");
        }
        return;
      }

      if (str && !key.ctrl && !key.meta) {
        value += str;
        stdout.write("*");
      }
    }

    stdin.on("keypress", onKeypress);
  });
}

async function readSecret() {
  const envSecret = process.env.SNAPTRADE_USER_SECRET_PLAINTEXT;
  if (envSecret) return envSecret;

  if (!stdin.isTTY) return readFromPipe();

  return readHiddenLine("SnapTrade user secret: ");
}

const secret = await readSecret();
if (!secret) {
  throw new Error(
    "Missing SnapTrade user secret. Type it at the prompt, pipe it on stdin, or set SNAPTRADE_USER_SECRET_PLAINTEXT for one command."
  );
}

console.log(`SNAPTRADE_USER_SECRET_ENCRYPTED="${encryptToken(secret)}"`);
