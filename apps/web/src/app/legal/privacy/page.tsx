import "../../p/[slug]/public.css";

export const metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <div className="rosie-public">
      <main className="rosie-public__main">
        <header className="rosie-public__hero">
          <h1>Privacy Policy</h1>
          <p className="rosie-public__subhead">
            How Rosie handles personal data collected on behalf of the local businesses we serve.
          </p>
        </header>
        <section style={{ marginTop: "2rem", lineHeight: 1.65, color: "#1f1f23" }}>
          <h2 style={{ marginTop: "2rem", fontWeight: 800, color: "var(--primary)" }}>1. Who we are</h2>
          <p>
            Rosie (operated by GroMore Media) provides marketing operations software to local
            service businesses ("Operators"). When you submit a form on a website powered by Rosie,
            the Operator is the data controller and Rosie acts as a data processor on their behalf.
          </p>

          <h2 style={{ marginTop: "2rem", fontWeight: 800, color: "var(--primary)" }}>2. What we collect</h2>
          <ul style={{ paddingLeft: "1.25rem" }}>
            <li>Identifiers you provide: name, email, phone, address, message body.</li>
            <li>Metadata: IP address (hashed for security), user agent, referrer, page URL.</li>
            <li>
              Communications: SMS, MMS, voice transcripts, and emails exchanged with the Operator,
              and the time and channel of each.
            </li>
            <li>Consent records: the exact disclosure text shown to you and your response.</li>
          </ul>

          <h2 style={{ marginTop: "2rem", fontWeight: 800, color: "var(--primary)" }}>3. How we use it</h2>
          <p>
            Solely to help the Operator respond to your inquiry, book service, send service-related
            messages, and (only if you've opted in) marketing messages. We do not sell personal
            data, and we do not share it with advertisers except in aggregate, hashed forms used to
            measure ad performance (server-side conversion APIs to Meta, Google, TikTok).
          </p>

          <h2 style={{ marginTop: "2rem", fontWeight: 800, color: "var(--primary)" }}>4. SMS terms</h2>
          <p>
            Reply <strong>STOP</strong> to unsubscribe at any time. Reply <strong>HELP</strong> for
            help. Message and data rates may apply. Message frequency varies. Carriers are not
            liable for delayed or undelivered messages.
          </p>

          <h2 style={{ marginTop: "2rem", fontWeight: 800, color: "var(--primary)" }}>5. Your rights</h2>
          <p>
            If you live in the EU/UK, California, Virginia, Colorado, Connecticut, or another
            jurisdiction with comparable data-rights laws, you may request access, deletion, or a
            portable export of your data. Visit <a href="/dsar">/dsar</a> to file a request. We
            respond within 30 days.
          </p>

          <h2 style={{ marginTop: "2rem", fontWeight: 800, color: "var(--primary)" }}>6. Retention</h2>
          <p>
            We keep personal data only as long as the Operator needs it to operate their business,
            plus a short audit window required by TCPA and other laws. Opt-out records are
            permanent.
          </p>

          <h2 style={{ marginTop: "2rem", fontWeight: 800, color: "var(--primary)" }}>7. Contact</h2>
          <p>
            For questions, contact the Operator whose business form you used, or email
            <a href="mailto:privacy@gromoremedia.com"> privacy@gromoremedia.com</a>.
          </p>
        </section>
        <footer className="rosie-public__footer">
          <small>
            <a href="/legal/privacy">Privacy</a>
            <a href="/legal/terms">Terms</a>
            <a href="/dsar">Your data request</a>
          </small>
        </footer>
      </main>
    </div>
  );
}
