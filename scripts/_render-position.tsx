import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { prisma } from "@/lib/prisma";
import { getPositionDetail } from "@/lib/investments/position-loader";
import { PositionView } from "@/components/features/positions/position-view";

async function render(data: unknown): Promise<string> {
  // PositionView is a client component; renderToStaticMarkup runs it.
  return renderToStaticMarkup(React.createElement(PositionView, { data } as never));
}

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { kind: "PERSONAL" } });
  if (!tenant) throw new Error("no personal tenant");
  for (const sym of ["NVDA", "TTWO", "VFV.TO"]) {
    const data = await getPositionDetail(tenant.id, sym);
    if (!data) {
      console.log(`${sym}: no position`);
      continue;
    }
    let html1 = "",
      html2 = "";
    try {
      html1 = await render(data);
    } catch (e) {
      console.log(`${sym}: RENDER 1 THREW:`, (e as Error).message);
      continue;
    }
    // Simulate the client hydration moment ~30s later to expose Date.now drift.
    const realNow = Date.now;
    Date.now = () => realNow() + 30_000;
    try {
      html2 = await render(data);
    } finally {
      Date.now = realNow;
    }
    console.log(
      `${sym}: len=${html1.length} script=${html1.includes("<script")} deterministic=${html1 === html2}`
    );
    if (html1 !== html2) {
      // find first diff index
      let i = 0;
      while (i < html1.length && html1[i] === html2[i]) i++;
      console.log(
        `  DIFF at ${i}: server="${html1.slice(i - 40, i + 40)}"  client="${html2.slice(i - 40, i + 40)}"`
      );
    }
  }
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error("THREW:", e);
  process.exit(1);
});
