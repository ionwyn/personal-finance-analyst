"use client";

import { useEffect, useRef } from "react";
import { usePlaidLink, type PlaidLinkOnExit, type PlaidLinkOnSuccess } from "react-plaid-link";

// Mounted only once a Link token exists (behind a dynamic() import), so
// react-plaid-link and the Plaid initialize script load on demand — on click —
// rather than on every page that mounts a Plaid provider/action. Auto-opens the
// Plaid modal as soon as the SDK reports ready; the `openedRef` guard keeps it to
// one open per mount, and callers force a fresh open by changing the `key`.
export function PlaidLinkLauncher({
  token,
  onSuccess,
  onExit,
  onOpen,
}: {
  token: string;
  onSuccess: PlaidLinkOnSuccess;
  onExit?: PlaidLinkOnExit;
  onOpen?: () => void;
}) {
  const openedRef = useRef(false);
  const { open, ready } = usePlaidLink({ token, onSuccess, onExit });

  useEffect(() => {
    if (ready && !openedRef.current) {
      openedRef.current = true;
      open();
      onOpen?.();
    }
  }, [open, ready, onOpen]);

  return null;
}
