// DEBUG:recurring remove after rollout
//
// Single flag controlling the temporary Plaid-recurring debug overlays in the
// cycles UI (discovery panel + committed table). Set `NEXT_PUBLIC_RECURRING_DEBUG=1`
// to surface stream ids, Plaid status, predicted dates and corroboration counts.
//
// Removal checklist when the rollout is done:
//   1. delete this file
//   2. delete every block tagged `// DEBUG:recurring remove after rollout`
//   3. drop NEXT_PUBLIC_RECURRING_DEBUG from any .env
export const RECURRING_DEBUG = process.env.NEXT_PUBLIC_RECURRING_DEBUG === "1";
