"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { usePlaidLink } from "react-plaid-link";

type PlaidMetadata = {
  institution?: {
    institution_id?: string | null;
    name?: string | null;
  } | null;
};

export function PlaidLinkButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingOpenRef = useRef(false);

  const { open, ready } = usePlaidLink({
    token,
    onSuccess: async (publicToken, metadata) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/plaid/exchange-public-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            public_token: publicToken,
            institution: (metadata as PlaidMetadata).institution
          })
        });

        if (!response.ok) throw new Error("Plaid Item exchange failed.");
        router.refresh();
      } catch (exchangeError) {
        setError(exchangeError instanceof Error ? exchangeError.message : "Plaid exchange failed.");
      } finally {
        setLoading(false);
      }
    }
  });

  useEffect(() => {
    if (pendingOpenRef.current && ready) {
      pendingOpenRef.current = false;
      open();
    }
  }, [open, ready]);

  async function startLink() {
    setLoading(true);
    setError(null);
    try {
      if (!token) {
        const response = await fetch("/api/plaid/link-token", { method: "POST" });
        if (!response.ok) throw new Error("Could not create a Plaid Link token.");
        const body = (await response.json()) as { link_token: string };
        pendingOpenRef.current = true;
        setToken(body.link_token);
      } else {
        open();
      }
    } catch (linkError) {
      setError(linkError instanceof Error ? linkError.message : "Plaid Link failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button className="btn btn-primary" onClick={startLink} type="button" disabled={loading}>
        {loading ? <Loader2 size={12} className="spin" /> : <Plus size={12} />}
        {compact ? "Link account" : "Link account"}
      </button>
      {error ? <span className="inline-error">{error}</span> : null}
    </>
  );
}
