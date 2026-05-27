import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// Returns false during SSR and the first client render, true thereafter.
// Used to gate theme-dependent UI (next-themes values are only known on the
// client) without a setState-in-effect, which avoids hydration mismatches.
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
