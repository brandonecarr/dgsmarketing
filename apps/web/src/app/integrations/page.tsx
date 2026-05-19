import Link from "next/link";
import "../p/[slug]/public.css";
import {
  CATEGORY_LABELS,
  INTEGRATIONS,
  STATUS_BADGES,
  type IntegrationCategory,
} from "@/lib/integrations/catalog";

export const metadata = {
  title: "Integrations · Works with Rosie",
  description: "Every platform Rosie connects to — SMS, voice, ads, search, billing, AI.",
};

export const dynamic = "force-static";

const CATEGORY_ORDER: IntegrationCategory[] = [
  "messaging",
  "voice",
  "ads",
  "search",
  "ai",
  "automation",
  "analytics",
  "billing",
  "crm",
];

export default function IntegrationsCatalog() {
  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: INTEGRATIONS.filter((i) => i.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="rosie-public">
      <main className="rosie-public__main" style={{ maxWidth: 980 }}>
        <header className="rosie-public__hero">
          <h1>Works with Rosie</h1>
          <p className="rosie-public__subhead">
            Every platform Rosie plugs into. Pick what you already use — Rosie reads the data,
            normalizes it, and surfaces it as one operator dashboard.
          </p>
        </header>

        <div style={{ marginTop: "2.5rem", display: "flex", flexWrap: "wrap", gap: ".5rem" }}>
          {grouped.map((g) => (
            <a
              key={g.category}
              href={`#${g.category}`}
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: ".4rem .85rem",
                borderRadius: 999,
                border: "1px solid #d4d4d8",
                color: "#1f1f23",
                textDecoration: "none",
              }}
            >
              {CATEGORY_LABELS[g.category]} · {g.items.length}
            </a>
          ))}
        </div>

        {grouped.map((g) => (
          <section key={g.category} id={g.category} style={{ marginTop: "3rem" }}>
            <h2
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: "var(--primary)",
                marginBottom: "1rem",
              }}
            >
              {CATEGORY_LABELS[g.category]}
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: "1rem",
              }}
            >
              {g.items.map((i) => (
                <Link
                  key={i.key}
                  href={`/integrations/${i.key}`}
                  style={{
                    display: "block",
                    padding: "1rem 1.1rem",
                    background: "#fff",
                    borderRadius: 12,
                    border: "1px solid #e7e7ee",
                    textDecoration: "none",
                    color: "#0b0b14",
                    transition: "transform .12s, box-shadow .12s",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 8,
                      marginBottom: 6,
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{i.name}</div>
                    <span
                      className={STATUS_BADGES[i.status]}
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: ".05em",
                        textTransform: "uppercase",
                        padding: "2px 8px",
                        borderRadius: 999,
                      }}
                    >
                      {i.status}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: 13,
                      color: "#52525b",
                      lineHeight: 1.45,
                      margin: 0,
                      minHeight: 38,
                    }}
                  >
                    {i.tagline}
                  </p>
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 11,
                      color: "var(--primary)",
                      fontWeight: 600,
                    }}
                  >
                    Setup guide →
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}

        <footer className="rosie-public__footer" style={{ marginTop: "5rem" }}>
          <small>
            Missing something? Drop us a line.{" "}
            <a href="/legal/privacy">Privacy</a>
            <a href="/legal/terms">Terms</a>
          </small>
        </footer>
      </main>
    </div>
  );
}
