import "dotenv/config";

import { prisma } from "../src/lib/prisma";
import {
  assertTokenCanEncrypt,
  assertTokenCanReEncrypt,
  decryptToken,
  encryptToken,
  getActiveTokenEncryptionKeyId,
  getEncryptedTokenKeyId,
} from "../src/lib/security/token-crypto";

type Mode = "dry-run" | "execute";

function parseMode(): Mode {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");
  const execute = args.has("--execute");

  if (dryRun === execute) {
    throw new Error("Pass exactly one mode: --dry-run or --execute.");
  }

  return execute ? "execute" : "dry-run";
}

function reEncrypt(payload: string) {
  return encryptToken(decryptToken(payload));
}

function printSnapTradeSecret(mode: Mode) {
  const encryptedSecret = process.env.SNAPTRADE_USER_SECRET_ENCRYPTED;
  if (!encryptedSecret) {
    console.log("SnapTrade env secret: skipped (SNAPTRADE_USER_SECRET_ENCRYPTED is not set)");
    return;
  }

  if (mode === "dry-run") {
    assertTokenCanReEncrypt(encryptedSecret);
    console.log("SnapTrade env secret: decrypt/re-encrypt check passed");
    return;
  }

  console.log("SnapTrade env secret: paste this rotated value into .env");
  console.log(`SNAPTRADE_USER_SECRET_ENCRYPTED="${reEncrypt(encryptedSecret)}"`);
}

async function main() {
  const mode = parseMode();
  const activeKid = getActiveTokenEncryptionKeyId();
  assertTokenCanEncrypt();

  const plaidItems = await prisma.plaidItem.findMany({
    select: {
      id: true,
      accessTokenEncrypted: true,
    },
    orderBy: {
      id: "asc",
    },
  });

  const alreadyCurrent = plaidItems.filter((item) => {
    return getEncryptedTokenKeyId(item.accessTokenEncrypted) === activeKid;
  });
  const needsRotation = plaidItems.filter((item) => {
    return getEncryptedTokenKeyId(item.accessTokenEncrypted) !== activeKid;
  });

  for (const item of plaidItems) {
    assertTokenCanReEncrypt(item.accessTokenEncrypted);
  }

  console.log(`Mode: ${mode}`);
  console.log(`Active token key id: ${activeKid ?? "legacy TOKEN_ENCRYPTION_KEY"}`);
  console.log(`Plaid token rows: ${plaidItems.length}`);
  console.log(`Already current: ${alreadyCurrent.length}`);
  console.log(`Needs rotation: ${needsRotation.length}`);

  if (mode === "dry-run") {
    printSnapTradeSecret(mode);
    console.log("Dry run complete. No database rows were updated.");
    return;
  }

  await prisma.$transaction(
    needsRotation.map((item) =>
      prisma.plaidItem.update({
        where: { id: item.id },
        data: { accessTokenEncrypted: reEncrypt(item.accessTokenEncrypted) },
      })
    )
  );

  console.log(`Updated Plaid token rows: ${needsRotation.length}`);
  printSnapTradeSecret(mode);
  console.log("Rotation complete. Restart the app after updating .env.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
