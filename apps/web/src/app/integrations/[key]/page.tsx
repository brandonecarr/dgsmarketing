import Link from "next/link";
import { notFound } from "next/navigation";
import "../../p/[slug]/public.css";
import {
  CATEGORY_LABELS,
  INTEGRATIONS,
  STATUS_BADGES,
  findIntegration,
} from "@/lib/integrations/catalog";

export function generateStaticParams() {
  return INTEGRATIONS.map((i) => ({ key: i.key }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const integ = findIntegration(key);
  if (!integ) return { title: "Integration not found" };
  return {
    title: `${integ.name} · Works with Rosie`,
    description: integ.tagline,
  };
}

export default async function IntegrationDetailPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const integ = findIntegration(key);
  if (!integ) notFound();

  return (
    <div className="rosie-public">
      <main className="rosie-public__main" style={{ maxWidth: 820 }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <Link
            href="/integrations"
            style={{ fontSize: 12, color: "var(--primary)", textDecoration: "none", fontWeight: 600 }}
          >
            ← All integrations
          </Link>
        </div>

        <header className="rosie-public__hero">
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ marginBottom: 0 }}>{integ.name}</h1>
            <span
              className={STATUS_BADGES[integ.status]}
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: ".06em",
                textTransform: "uppercase",
                padding: "3px 10px",
                borderRadius: 999,
              }}
            >
              {integ.status}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "3px 10px",
                borderRadius: 999,
                border: "1px solid #d4d4d8",
                color: "#52525b",
              }}
            >
              {CATEGORY_LABELS[integ.category]}
            </span>
          </div>
          <p className="rosie-public__subhead">{integ.tagline}</p>
        </header>

        <section style={{ marginTop: "2rem", lineHeight: 1.6, color: "#1f1f23", fontSize: 15 }}>
          <p>{integ.description}</p>
        </section>

        <section style={{ marginTop: "2.5rem" }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--primary)", marginBottom: 12 }}>
            What it unlocks
          </h2>
          <ul style={{ paddingLeft: "1.25rem", margin: 0 }}>
            {integ.unlocks.map((u, i) => (
              <li key={i} style={{ marginBottom: 6, fontSize: 14 }}>
                {u}
              </li>
            ))}
          </ul>
        </section>

        <section style={{ marginTop: "2.5rem" }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--primary)", marginBottom: 12 }}>
            Setup
          </h2>
          <ol style={{ paddingLeft: "1.25rem", margin: 0 }}>
            {integ.setup.map((step, i) => (
              <li key={i} style={{ marginBottom: 8, fontSize: 14, lineHeight: 1.5 }}>
                {step}
              </li>
            ))}
          </ol>
        </section>

        <section
          style={{
            marginTop: "3rem",
            padding: "1.25rem",
            background: "#f6f6fa",
            borderRadius: 12,
            border: "1px solid #e7e7ee",
          }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, marginBottom: 6 }}>
            Ready to connect?
          </h3>
          <p style={{ fontSize: 13, color: "#52525b", margin: 0, marginBottom: 12 }}>
            {integ.connectPath
              ? "Jump into Rosie and configure this integration in a couple clicks."
              : "Setup happens at the deployment env layer for this one — see the docs."}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {integ.connectPath ? (
              <Link
                href={integ.connectPath}
                className="rosie-public__cta-primary"
                style={{ fontSize: 13 }}
              >
                Open in Rosie
              </Link>
            ) : null}
            {integ.docsUrl ? (
              <a
                href={integ.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="rosie-public__cta-secondary"
                style={{ fontSize: 13 }}
              >
                Provider docs ↗
              </a>
            ) : null}
          </div>
        </section>

        {integ.tags.length > 0 ? (
          <section style={{ marginTop: "2.5rem" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {integ.tags.map((t) => (
                <span
                  key={t}
                  style={{
                    fontSize: 10,
                    padding: "3px 9px",
                    borderRadius: 999,
                    border: "1px solid #e7e7ee",
                    color: "#71717a",
                    fontFamily: "ui-monospace, monospace",
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        <footer className="rosie-public__footer" style={{ marginTop: "5rem" }}>
          <small>
            <a href="/legal/privacy">Privacy</a>
            <a href="/legal/terms">Terms</a>
          </small>
        </footer>
      </main>
    </div>
  );
}
