// Vala-Fi API response shapes (https://valafi.dev/docs) plus the internal
// envelopes our service/routes return. On the free tier `strength` is hidden
// and `evidence` is only present on the first two relationships of a list.

export type ValafiCompany = {
  ticker: string;
  name: string;
  node_type?: string | null;
  sector?: string | null;
  industry?: string | null;
  country?: string | null;
  exchange?: string | null;
};

export type ValafiRelationshipType = "supplier" | "customer" | "competitor" | (string & {});

export type ValafiEdge = {
  source: Partial<ValafiCompany> & { ticker: string };
  target: Partial<ValafiCompany> & { ticker: string };
  relationship_type: ValafiRelationshipType;
  strength?: number | null;
  evidence?: string | null;
  hop?: number | null;
};

export type ValafiSupplyChain = {
  company: ValafiCompany;
  suppliers?: ValafiEdge[];
  customers?: ValafiEdge[];
  total_suppliers?: number;
  total_customers?: number;
  hops_returned?: number;
  max_hops_available?: number;
  truncated?: boolean;
};

export type ValafiRelationships = {
  company: ValafiCompany;
  relationships?: ValafiEdge[];
  total?: number;
  truncated?: boolean;
};

export type ValafiConcentrationRisk = {
  supplier?: Partial<ValafiCompany> & { ticker?: string };
  dependency_type?: string; // e.g. "sole_supplier"
  alternatives_count?: number;
  risk_level?: "high" | "medium" | "low" | (string & {});
};

export type ValafiSharedNode = {
  company: Partial<ValafiCompany> & { ticker: string };
  relationship_to_source?: string;
  relationship_to_peer?: string;
};

export type ValafiExposure = {
  company: ValafiCompany;
  shared_suppliers?: ValafiSharedNode[];
  shared_customers?: ValafiSharedNode[];
  concentration_risks?: ValafiConcentrationRisk[];
  exposure_score?: number | null;
};

export type ValafiImpactedCompany = {
  company: Partial<ValafiCompany> & { ticker: string };
  impact_score?: number | null;
  hops_from_source?: number;
  propagation_path?: string[];
  relationship_chain?: string[];
};

export type ValafiImpact = {
  source: ValafiCompany;
  disruption_type: string;
  severity: number;
  impacted_companies?: ValafiImpactedCompany[];
  total_impacted?: number;
  sectors_affected?: string[];
  critical_exposures?: unknown[];
};

export type ValafiPath = {
  source: ValafiCompany;
  target: ValafiCompany;
  path?: ValafiCompany[];
  edges?: ValafiEdge[];
  path_length?: number;
};

// ── Portfolio monitoring ────────────────────────────────────────────────────

export type ValafiHolding = { ticker: string; weight: number; name?: string };

// POST /v1/portfolio response — API returns "id", not "portfolio_id".
export type ValafiPortfolioCreated = {
  id: number;
  name: string;
  holdings: ValafiHolding[];
  created_at: string;
};

// GET /v1/portfolio/{id}/exposure — shared_suppliers are per-entry objects.
export type ValafiPortfolioSharedSupplierEntry = {
  supplier: Partial<ValafiCompany> & { ticker: string };
  dependent_holdings: string[];
  aggregate_strength?: number | null;
  risk_level?: string | null;
};

export type ValafiPortfolioConcentrationWarning = {
  description?: string;
  severity?: string;
  affected_holdings: string[];
  supplier: Partial<ValafiCompany> & { ticker: string };
};

export type ValafiPortfolioExposure = {
  portfolio?: { id: number; name: string };
  aggregated_exposure_score?: number | null;
  shared_suppliers?: ValafiPortfolioSharedSupplierEntry[];
  concentration_warnings?: ValafiPortfolioConcentrationWarning[];
  sector_breakdown?: Record<string, number>;
  total_supply_chain_nodes?: number;
};

// GET /v1/portfolio/{id}/alerts returns a bare array.
export type ValafiPortfolioAlert = {
  type?: string;
  holding?: string;
  description?: string;
  severity?: string;
  detected_at?: string;
};
export type ValafiPortfolioAlerts = ValafiPortfolioAlert[];

export type ValafiChangeEvent = {
  event_type: string;
  source_ticker?: string;
  target_ticker?: string;
  holding_ticker?: string;
  relationship_type?: string;
  filing_date?: string;
  severity?: string;
  new_strength?: number | null;
  description?: string;
};

export type ValafiChangesFeed = {
  events?: ValafiChangeEvent[];
  since?: string;
  total?: number;
  tickers_affected?: number;
};

// POST /v1/portfolio/{id}/simulate response shape.
export type ValafiPortfolioSimulate = {
  portfolio?: { id: number; name: string };
  disrupted_company?: Partial<ValafiCompany> & { ticker: string };
  holdings_affected?: {
    ticker: string;
    name?: string;
    impact_score?: number | null;
    hops?: number;
    path?: string[];
    portfolio_weight?: number | null;
  }[];
  portfolio_weighted_impact?: number | null;
  total_holdings_affected?: number | null;
};

// ── Dev / quota ─────────────────────────────────────────────────────────────

export type ValafiDevUsage = {
  requests_today: number;
  unique_tickers_today: number;
  tier?: string;
  limits?: { requests_per_day: number; unique_tickers_per_day: number };
};

// ── Internal envelopes ──────────────────────────────────────────────────────

/** Quota snapshot powering the meter and the confirm-near-cap gate. */
export type ValafiUsageSnapshot = {
  date: string;
  requests: number;
  requestCap: number;
  uniqueTickers: number;
  tickerCap: number;
  confirmThreshold: number;
  /** Companies cached today that the user can reopen for free. */
  remoteSyncedAt: string | null;
  source: "local" | "reconciled" | "disabled";
};

/** Why a result is in the state it is — drives UI affordances. */
export type ValafiStatus =
  | "fresh" // just fetched live
  | "cached" // served from a fresh cache row, no spend
  | "stale" // served from an expired cache row because we couldn't refresh
  | "empty" // company isn't in the graph (foreign listing / ETF / 404)
  | "blocked" // a live fetch was needed but quota/confirm stopped it
  | "error" // the API errored
  | "disabled"; // VALAFI_API_KEY not configured

export type ValafiResult<T> = {
  data: T | null;
  status: ValafiStatus;
  /** Set when status is "blocked" because the user is near the ticker cap. */
  needsConfirm?: boolean;
  usage: ValafiUsageSnapshot;
  fetchedAt?: string | null;
  message?: string;
};

/** Everything the company explorer / position tab needs for one ticker,
 *  assembled from the 4-call bundle (profile + supply-chain + competitors +
 *  exposure). Costs 1 unique ticker. */
export type ValafiCompanyBundle = {
  ticker: string;
  profile: ValafiCompany | null;
  suppliers: ValafiEdge[];
  customers: ValafiEdge[];
  competitors: ValafiEdge[];
  exposure: ValafiExposure | null;
  truncated: boolean;
  maxHopsAvailable: number | null;
};
