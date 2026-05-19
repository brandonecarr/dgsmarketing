import "../[slug]/public.css";

export default function ThanksPage() {
  return (
    <div className="rosie-public">
      <main className="rosie-public__main">
        <header className="rosie-public__hero">
          <h1>Thanks — we got it.</h1>
          <p className="rosie-public__subhead">
            We'll be in touch soon. Reply STOP to any text we send to opt out of future messages.
          </p>
        </header>
        <footer className="rosie-public__footer">
          <small>
            <a href="/legal/privacy">Privacy</a>
            <a href="/legal/terms">Terms</a>
            <a href="/dsar">Data request</a>
          </small>
        </footer>
      </main>
    </div>
  );
}
