"use client";

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Loader2, Plus } from "lucide-react";
import type { PlaidLinkOnSuccess } from "react-plaid-link";

import { Button } from "@/components/ui";

// react-plaid-link only loads once a link token is requested (on click).
const PlaidLinkLauncher = dynamic(
  () => import("./plaid-link-launcher").then((m) => m.PlaidLinkLauncher),
  { ssr: false }
);

type PlaidMetadata = {
  institution?: {
    institution_id?: string | null;
    name?: string | null;
  } | null;
};

type PlaidLinkContextValue = {
  activeButtonId: string | null;
  error: string | null;
  loading: boolean;
  startLink: (buttonId: string) => Promise<void>;
};

const PlaidLinkContext = createContext<PlaidLinkContextValue | null>(null);

export function PlaidLinkProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeButtonId, setActiveButtonId] = useState<string | null>(null);

  const handleSuccess = useCallback<PlaidLinkOnSuccess>(
    async (publicToken, metadata) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/plaid/exchange-public-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            public_token: publicToken,
            institution: (metadata as PlaidMetadata).institution,
          }),
        });

        if (!response.ok) throw new Error("Plaid Item exchange failed.");
        router.refresh();
      } catch (exchangeError) {
        setError(exchangeError instanceof Error ? exchangeError.message : "Plaid exchange failed.");
      } finally {
        setLoading(false);
        setToken(null);
      }
    },
    [router]
  );

  const startLink = useCallback(async (buttonId: string) => {
    setLoading(true);
    setError(null);
    setActiveButtonId(buttonId);
    try {
      const response = await fetch("/api/plaid/link-token", { method: "POST" });
      if (!response.ok) throw new Error("Could not create a Plaid Link token.");
      const body = (await response.json()) as { link_token: string };
      setToken(body.link_token);
    } catch (linkError) {
      setError(linkError instanceof Error ? linkError.message : "Plaid Link failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo(
    () => ({ activeButtonId, error, loading, startLink }),
    [activeButtonId, error, loading, startLink]
  );

  return (
    <PlaidLinkContext.Provider value={value}>
      {children}
      {token ? (
        <PlaidLinkLauncher
          key={token}
          token={token}
          onSuccess={handleSuccess}
          onExit={() => setToken(null)}
        />
      ) : null}
    </PlaidLinkContext.Provider>
  );
}

export function PlaidLinkButton({ compact = false }: { compact?: boolean }) {
  const buttonId = useId();
  const link = useContext(PlaidLinkContext);

  if (!link) {
    throw new Error("PlaidLinkButton must be rendered inside PlaidLinkProvider.");
  }

  const showError = link.activeButtonId === buttonId ? link.error : null;

  return (
    <>
      <Button
        variant="primary"
        onClick={() => void link.startLink(buttonId)}
        disabled={link.loading}
        icon={link.loading ? <Loader2 size={12} className="spin" /> : <Plus size={12} />}
      >
        {compact ? "Link account" : "Link account"}
      </Button>
      {showError ? <span className="inline-error">{showError}</span> : null}
    </>
  );
}
