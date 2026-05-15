import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthButton } from "@/components/auth-button";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/app");

  const configured = Boolean(process.env.GITHUB_ID && process.env.GITHUB_SECRET);

  return (
    <main className="center-shell">
      <section className="signin-panel">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="brand-mark">WYN</div>
          <div className="brand-name">
            WYN Financial Ltd.
          </div>
        </div>
        <p className="eyebrow">Private workspace</p>
        <h1>Sign in to your finance workspace</h1>
        <p>
          GitHub OAuth is used for the private app. Set <code>ADMIN_EMAILS</code> to limit access
          to specific identities before deploying.
        </p>
        {configured ? (
          <AuthButton />
        ) : (
          <p className="form-error">GitHub OAuth is not configured yet.</p>
        )}
        <div
          style={{
            marginTop: 8,
            fontSize: 11,
            color: "var(--text-3)",
            display: "flex",
            justifyContent: "space-between"
          }}
        >
          <Link href="/demo" style={{ color: "var(--text-2)" }}>
            View public demo →
          </Link>
          <span style={{ fontFamily: "var(--font-mono)" }}>
            local · encrypted-at-rest
          </span>
        </div>
      </section>
    </main>
  );
}
