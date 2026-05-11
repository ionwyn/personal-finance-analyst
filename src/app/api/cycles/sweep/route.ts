import { randomBytes } from "crypto";

import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUserTenant } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { ensureCycleForDate } from "@/lib/cycles/generate";
import { TX_SOURCE_MANUAL_SWEEP } from "@/lib/cycles/types";

const sweepSchema = z.object({
  amount: z.number().positive(),
  note: z.string().max(500).optional()
});

const skipSchema = z.object({
  note: z.string().max(500).optional()
});

export async function POST(request: Request) {
  const auth = await requireUserTenant();
  if ("error" in auth) return auth.error;

  let body: z.infer<typeof sweepSchema>;
  try {
    body = sweepSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid body" },
      { status: 400 }
    );
  }

  const now = new Date();
  const cycle = await ensureCycleForDate(auth.tenant.id, now);

  const depositoryAccount = await prisma.plaidAccount.findFirst({
    where: { tenantId: auth.tenant.id, type: "depository" },
    orderBy: { createdAt: "asc" }
  });

  if (!depositoryAccount) {
    return NextResponse.json(
      { error: "No depository account linked to record the sweep against" },
      { status: 400 }
    );
  }

  const syntheticId = `manual_sweep_${randomBytes(8).toString("hex")}`;
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const result = await prisma.$transaction(async (tx) => {
    const manualTx = await tx.plaidTransaction.create({
      data: {
        tenantId: auth.tenant.id,
        itemId: depositoryAccount.itemId,
        accountId: depositoryAccount.id,
        plaidTransactionId: syntheticId,
        name: "Wealthsimple (manual sweep)",
        merchantName: "Wealthsimple",
        amount: new Prisma.Decimal(body.amount),
        isoCurrencyCode: depositoryAccount.isoCurrencyCode ?? "CAD",
        date: today,
        pending: false,
        removed: false,
        raw: { source: "manual_sweep", note: body.note ?? null },
        cycleId: cycle.id,
        txnType: "savings",
        source: TX_SOURCE_MANUAL_SWEEP
      }
    });

    const prior = cycle.sweptAmount ?? new Prisma.Decimal(0);
    const updatedCycle = await tx.payCycle.update({
      where: { id: cycle.id },
      data: {
        sweptAmount: prior.add(body.amount),
        notes: body.note ? appendNote(cycle.notes, body.note) : cycle.notes
      }
    });

    return { manualTx, updatedCycle };
  });

  return NextResponse.json({ transactionId: result.manualTx.id, cycleId: result.updatedCycle.id });
}

export async function PATCH(request: Request) {
  const auth = await requireUserTenant();
  if ("error" in auth) return auth.error;

  let body: z.infer<typeof skipSchema>;
  try {
    body = skipSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid body" },
      { status: 400 }
    );
  }

  const cycle = await ensureCycleForDate(auth.tenant.id, new Date());
  await prisma.payCycle.update({
    where: { id: cycle.id },
    data: {
      sweptAmount: new Prisma.Decimal(0),
      notes: body.note ? appendNote(cycle.notes, `Skipped sweep: ${body.note}`) : cycle.notes
    }
  });

  return NextResponse.json({ ok: true });
}

function appendNote(existing: string | null, addition: string): string {
  if (!existing) return addition;
  return `${existing}\n${addition}`;
}
