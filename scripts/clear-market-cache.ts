import { prisma } from "@/lib/prisma";

async function clearCache() {
  console.log("Clearing market data cache...");

  const [quotes, profiles, prices, news, events] = await Promise.all([
    prisma.marketQuote.deleteMany({}),
    prisma.marketProfile.deleteMany({}),
    prisma.marketPriceDay.deleteMany({}),
    prisma.marketNews.deleteMany({}),
    prisma.marketEvents.deleteMany({}),
  ]);

  console.log(`✓ Deleted ${quotes.count} quote records`);
  console.log(`✓ Deleted ${profiles.count} profile records`);
  console.log(`✓ Deleted ${prices.count} price day records`);
  console.log(`✓ Deleted ${news.count} news records`);
  console.log(`✓ Deleted ${events.count} event records`);
  console.log("\nCache cleared. Fresh data will be fetched on next page load.");

  await prisma.$disconnect();
}

clearCache().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
