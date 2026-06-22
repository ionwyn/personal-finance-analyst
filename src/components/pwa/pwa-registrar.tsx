"use client";

import { useEffect } from "react";

const SERVICE_WORKER_URL = "/sw.js";

function canRegisterServiceWorker() {
  if (!("serviceWorker" in navigator)) return false;
  if (window.location.protocol === "https:") return true;
  return ["localhost", "127.0.0.1"].includes(window.location.hostname);
}

export function PwaRegistrar() {
  useEffect(() => {
    if (!canRegisterServiceWorker()) return;

    let cancelled = false;

    navigator.serviceWorker
      .register(SERVICE_WORKER_URL, { scope: "/", updateViaCache: "none" })
      .then((registration) => {
        if (!cancelled) void registration.update();
      })
      .catch(() => {
        // Registration is progressive enhancement; the app stays fully usable.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
