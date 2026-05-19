import "../../p/[slug]/public.css";

export const metadata = {
  title: "API reference · Rosie",
  description: "Public REST endpoints, scopes, and outbound webhook contracts.",
};

export const dynamic = "force-static";

interface Endpoint {
  method: "GET" | "POST" | "DELETE";
  path: string;
  scope: string;
  blurb: string;
  example?: string;
}

const ENDPOINTS: Endpoint[] = [
  {
    method: "GET",
    path: "/api/v1/leads",
    scope: "leads:read",
    blurb: "List the most recent 50 leads. Optional ?stage=&limit=.",
  },
  {
    method: "POST",
    path: "/api/v1/leads",
    scope: "leads:write",
    blurb: "Create a lead. Body: { name?, phone?, email?, source?, metadata? }.",
  },
  {
    method: "GET",
    path: "/api/v1/conversations",
    scope: "conversations:read",
    blurb: "List conversations sorted by lastMessageAt. Optional ?limit=.",
  },
  {
    method: "GET",
    path: "/api/v1/posts",
    scope: "posts:read",
    blurb: "List recent scheduled posts.",
  },
  {
    method: "POST",
    path: "/api/v1/posts",
    scope: "posts:write",
    blurb: "Create a scheduled post.",
  },
  {
    method: "POST",
    path: "/api/v1/data-export",
    scope: "data:export",
    blurb: "GDPR Article 20 portability for a single email/phone. Body: { email?, phone? }.",
  },
  {
    method: "POST",
    path: "/api/v1/data-delete",
    scope: "data:delete",
    blurb: "GDPR Article 17 erasure. Body: { email?, phone?, alsoOptOutSms? }.",
  },
];

const EVENTS: Array<{ name: string; trigger: string }> = [
  { name: "lead.created", trigger: "A new lead lands via webhook, form, or API." },
  { name: "lead.stage_changed", trigger: "An operator (or Auto-Rosie) moves a lead to a new pipeline stage." },
  { name: "lead.won", trigger: "A lead is marked won — fires alongside ad-platform CAPI conversions." },
  {
    name: "conversation.message_received",
    trigger: "An inbound SMS / DM / call transcript arrives.",
  },
  { name: "conversation.message_sent", trigger: "An outbound message goes out the door." },
  { name: "call.completed", trigger: "A Vapi call ends and the transcript + recording are stored." },
  { name: "review.received", trigger: "A new Google Business Profile review is detected." },
];

export default function ApiDocsPage() {
  return (
    <div className="rosie-public">
      <main className="rosie-public__main" style={{ maxWidth: 880 }}>
        <header className="rosie-public__hero">
          <h1>API reference</h1>
          <p className="rosie-public__subhead">
            REST endpoints, key scopes, and the outbound webhook contract for integrating Rosie
            with anything you build.
          </p>
        </header>

        <Section title="Authentication">
          <p>
            Every <code>/api/v1/*</code> call requires a Bearer token. Generate one in Settings →
            API keys. Keys have <strong>scopes</strong> — granular permissions like{" "}
            <code>leads:write</code> or <code>data:export</code> — and the API returns{" "}
            <code>403</code> with a useful error if you call an endpoint your key isn&apos;t
            authorized for.
          </p>
          <Code>{`curl -X GET https://app.rosie.com/api/v1/leads \\
  -H "Authorization: Bearer rosie_..."`}</Code>
        </Section>

        <Section title="Endpoints">
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {ENDPOINTS.map((e) => (
              <div
                key={`${e.method} ${e.path}`}
                style={{
                  border: "1px solid #e7e7ee",
                  borderRadius: 10,
                  padding: "12px 14px",
                  background: "#fff",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 6,
                      fontFamily: "ui-monospace, monospace",
                      fontSize: 11,
                      fontWeight: 700,
                      background:
                        e.method === "GET"
                          ? "#dcfce7"
                          : e.method === "POST"
                            ? "#dbeafe"
                            : "#fee2e2",
                      color:
                        e.method === "GET"
                          ? "#166534"
                          : e.method === "POST"
                            ? "#1e40af"
                            : "#991b1b",
                    }}
                  >
                    {e.method}
                  </span>
                  <code style={{ fontFamily: "ui-monospace, monospace", fontWeight: 700, fontSize: 14 }}>
                    {e.path}
                  </code>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 10,
                      padding: "2px 8px",
                      borderRadius: 999,
                      border: "1px solid #d4d4d8",
                      fontFamily: "ui-monospace, monospace",
                      color: "#52525b",
                    }}
                  >
                    {e.scope}
                  </span>
                </div>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "#52525b" }}>{e.blurb}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Outbound webhooks">
          <p>
            Subscribe an HTTPS endpoint to Rosie events under Settings → Outbound webhooks. Each
            delivery is a JSON POST with HMAC-SHA256 signature headers.
          </p>
          <h3 style={subhead}>Available events</h3>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
            }}
          >
            <tbody>
              {EVENTS.map((ev) => (
                <tr key={ev.name} style={{ borderTop: "1px solid #e7e7ee" }}>
                  <td
                    style={{
                      padding: "8px 6px",
                      fontFamily: "ui-monospace, monospace",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {ev.name}
                  </td>
                  <td style={{ padding: "8px 6px", color: "#52525b" }}>{ev.trigger}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 style={subhead}>Headers Rosie sends</h3>
          <ul style={{ paddingLeft: "1.25rem", fontSize: 13 }}>
            <li>
              <code>X-Rosie-Event</code> — event name, eg <code>lead.created</code>
            </li>
            <li>
              <code>X-Rosie-Event-Id</code> — unique per delivery; use it to dedupe replays
            </li>
            <li>
              <code>X-Rosie-Timestamp</code> — unix seconds when the dispatch started
            </li>
            <li>
              <code>X-Rosie-Signature</code> — <code>sha256=&lt;hex&gt;</code> of{" "}
              <code>HMAC_SHA256(secret, &quot;&lt;ts&gt;.&lt;raw-body&gt;&quot;)</code>
            </li>
          </ul>

          <h3 style={subhead}>Verifying the signature (Node.js)</h3>
          <Code>{`import { createHmac, timingSafeEqual } from "node:crypto";

function verify(req, secret) {
  const ts = req.headers["x-rosie-timestamp"];
  const sig = req.headers["x-rosie-signature"];
  const rawBody = req.rawBody; // string the body parser preserved
  const expected = "sha256=" + createHmac("sha256", secret)
    .update(\`\${ts}.\${rawBody}\`)
    .digest("hex");
  return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}`}</Code>

          <h3 style={subhead}>Verifying the signature (Python)</h3>
          <Code>{`import hashlib, hmac

def verify(request, secret):
    ts = request.headers["X-Rosie-Timestamp"]
    sig = request.headers["X-Rosie-Signature"]
    expected = "sha256=" + hmac.new(
        secret.encode(), f"{ts}.{request.body.decode()}".encode(), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, sig)`}</Code>
        </Section>

        <Section title="Delivery semantics">
          <ul style={{ paddingLeft: "1.25rem", fontSize: 13, lineHeight: 1.6 }}>
            <li>
              <strong>At-least-once.</strong> Network blips trigger backoff retries; idempotency
              key in <code>X-Rosie-Event-Id</code> lets you dedupe.
            </li>
            <li>
              <strong>10-second timeout per attempt.</strong> Slower endpoints will be retried as
              if they had timed out.
            </li>
            <li>
              <strong>Failure logging.</strong> Every attempt — successful or not — lands in{" "}
              <code>webhook_deliveries</code>. After exhausted retries the entry also lands in the
              DLQ for manual replay.
            </li>
            <li>
              <strong>Auto-suspend.</strong> If a subscription returns 4xx repeatedly, Rosie may
              flip <code>suspended_at</code> and stop fan-out. Re-enable from settings to resume.
            </li>
          </ul>
        </Section>

        <footer className="rosie-public__footer" style={{ marginTop: "4rem" }}>
          <small>
            <a href="/legal/privacy">Privacy</a>
            <a href="/legal/terms">Terms</a>
            <a href="/integrations">Integrations</a>
          </small>
        </footer>
      </main>
    </div>
  );
}

const subhead = {
  marginTop: "1.5rem",
  marginBottom: "0.5rem",
  fontSize: 14,
  fontWeight: 800,
  color: "var(--primary)",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: "2.5rem" }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--primary)", marginBottom: "0.75rem" }}>
        {title}
      </h2>
      <div style={{ fontSize: 14, lineHeight: 1.6, color: "#1f1f23" }}>{children}</div>
    </section>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre
      style={{
        overflowX: "auto",
        background: "#0b0b14",
        color: "#e5e5e5",
        padding: "12px 14px",
        borderRadius: 10,
        fontSize: 12,
        lineHeight: 1.5,
        marginTop: 10,
      }}
    >
      <code>{children}</code>
    </pre>
  );
}
