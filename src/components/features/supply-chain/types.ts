// View-model passed from the server pages into the client components.

export type PickHolding = {
  symbol: string;
  name: string;
  weightPct: number;
  /** Whether it's a US-listed issuer Vala-Fi can resolve (others are shown disabled). */
  trackable: boolean;
};
