import "../../p/[slug]/public.css";

export const metadata = {
  title: "Terms of Service",
};

export default function TermsPage() {
  return (
    <div className="rosie-public">
      <main className="rosie-public__main">
        <header className="rosie-public__hero">
          <h1>Terms of Service</h1>
          <p className="rosie-public__subhead">
            The rules of the road for using Rosie and its messaging tools.
          </p>
        </header>
        <section style={{ marginTop: "2rem", lineHeight: 1.65, color: "#1f1f23" }}>
          <h2 style={{ marginTop: "2rem", fontWeight: 800, color: "var(--primary)" }}>1. Acceptance</h2>
          <p>
            By using a website or messaging program powered by Rosie, you agree to these terms. If
            you don't agree, please don't submit forms or reply to SMS programs.
          </p>

          <h2 style={{ marginTop: "2rem", fontWeight: 800, color: "var(--primary)" }}>2. Messaging program</h2>
          <p>
            When you submit a phone number and check the SMS consent box, you authorize the
            Operator (and Rosie, acting on their behalf) to send SMS and MMS messages related to
            your inquiry and, where indicated, marketing messages. Standard message and data rates
            apply.
          </p>
          <ul style={{ paddingLeft: "1.25rem" }}>
            <li>Reply <strong>STOP</strong> at any time to unsubscribe.</li>
            <li>Reply <strong>HELP</strong> for help.</li>
            <li>Message frequency varies based on Operator activity and your responses.</li>
            <li>Carriers are not liable for delayed or undelivered messages.</li>
          </ul>

          <h2 style={{ marginTop: "2rem", fontWeight: 800, color: "var(--primary)" }}>3. Acceptable use</h2>
          <p>You agree not to:</p>
          <ul style={{ paddingLeft: "1.25rem" }}>
            <li>Submit information that isn't yours, or impersonate someone else.</li>
            <li>Use any Rosie-hosted page to harass, threaten, or deceive others.</li>
            <li>Interfere with the operation of the service or attempt to bypass rate limits.</li>
          </ul>

          <h2 style={{ marginTop: "2rem", fontWeight: 800, color: "var(--primary)" }}>4. Operator relationship</h2>
          <p>
            Each Rosie-powered page or program is operated by an independent business. Rosie
            provides the platform but does not provide the services advertised. Disputes about
            quotes, work performed, or payment are between you and the Operator.
          </p>

          <h2 style={{ marginTop: "2rem", fontWeight: 800, color: "var(--primary)" }}>5. Disclaimers</h2>
          <p>
            The service is provided "as is" without warranty of any kind. Rosie is not liable for
            indirect or consequential damages. To the extent any liability is found, it is limited
            to the amount you paid Rosie directly (which is typically zero for end users).
          </p>

          <h2 style={{ marginTop: "2rem", fontWeight: 800, color: "var(--primary)" }}>6. Changes</h2>
          <p>
            We may update these terms from time to time. Continued use after a change constitutes
            acceptance.
          </p>

          <h2 style={{ marginTop: "2rem", fontWeight: 800, color: "var(--primary)" }}>7. Contact</h2>
          <p>
            Questions? Email
            <a href="mailto:legal@gromoremedia.com"> legal@gromoremedia.com</a>.
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
