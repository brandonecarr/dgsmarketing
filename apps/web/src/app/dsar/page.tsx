import "../p/[slug]/public.css";
import { DsarForm } from "./form";

export default function DsarPage() {
  return (
    <div className="rosie-public">
      <main className="rosie-public__main">
        <header className="rosie-public__hero">
          <h1>Your data request</h1>
          <p className="rosie-public__subhead">
            Request a copy of the personal data we hold about you, or ask us to delete it. We'll
            respond within 30 days as required by GDPR Articles 17 and 20 (and CCPA where
            applicable).
          </p>
        </header>
        <section className="rosie-public__form-wrap">
          <DsarForm />
        </section>
        <footer className="rosie-public__footer">
          <small>
            <a href="/legal/privacy">Privacy</a>
            <a href="/legal/terms">Terms</a>
          </small>
        </footer>
      </main>
    </div>
  );
}
