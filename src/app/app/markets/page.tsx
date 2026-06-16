import { MarketsView } from "@/components/features/markets/markets-view";

export const dynamic = "force-dynamic";

// No top-level await: MarketsView renders its header immediately and streams each
// data panel via its own <Suspense> boundary.
export default function MarketsPage() {
  return <MarketsView />;
}
