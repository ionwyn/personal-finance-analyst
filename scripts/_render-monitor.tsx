import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { prisma } from "@/lib/prisma";
import { getDeskMonitor } from "@/lib/investments/monitor-loader";
import { MonitorView } from "@/components/features/monitor/monitor-view";

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { kind: "PERSONAL" } });
  if (!tenant) throw new Error("no personal tenant");
  const data = await getDeskMonitor(tenant.id);
  const html = renderToStaticMarkup(
    React.createElement(MonitorView, { data, watchlist: [], canEdit: false })
  );
  console.log("rendered length:", html.length);
  console.log("contains <script:", html.includes("<script"));
  console.log("nested anchors <a..<a:", /<a[^>]*>(?:(?!<\/a>).)*<a[\s>]/s.test(html));
  console.log("block <div inside <a:", /<a[^>]*>(?:(?!<\/a>).)*<div[\s>]/s.test(html));
  const rowMatch = html.match(/<a class="mon-row"[^>]*>.*?<\/a>/s);
  console.log("\nfirst row HTML:\n", rowMatch?.[0]?.slice(0, 700));
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error("RENDER THREW:", e);
  process.exit(1);
});
