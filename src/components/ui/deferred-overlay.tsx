import type { ReactNode } from "react";

type DeferredOverlayProps = {
  /** Short status line shown in the chip, e.g. "Live market data". */
  label: string;
  /** Optional second line, e.g. "Coming in a later release". */
  hint?: string;
  /** The placeholder UI rendered (dimmed, non-interactive) beneath the scrim. */
  children: ReactNode;
};

/**
 * Wraps a section whose underlying data source isn't wired up yet (external
 * market data, AI analysis). The real layout renders beneath a subtle scrim so
 * the page reads at full fidelity while honestly signalling "not active yet".
 */
export function DeferredOverlay({ label, hint, children }: DeferredOverlayProps) {
  return (
    <div className="deferred-wrap">
      <div className="deferred-content" aria-hidden>
        {children}
      </div>
      <div className="deferred-scrim">
        <div className="deferred-chip">
          <span className="deferred-dot" />
          <div>
            <div className="deferred-label">{label}</div>
            {hint ? <div className="deferred-hint">{hint}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
