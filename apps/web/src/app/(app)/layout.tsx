import { loadActiveSession } from "@/lib/active-tenant";
import { AppShell } from "@/components/app-shell";
import { WebVitalsReporter } from "@/components/web-vitals";
import { isRtlLocale } from "@/lib/i18n";
import { LocaleDirectionEffect } from "@/components/locale-direction-effect";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await loadActiveSession();
  const theme = session.tenant.brandTheme ?? {};
  const displayName = theme.displayName?.trim() || session.tenant.name;
  const assistantName = theme.assistantName?.trim() || "Rosie";

  const dir: "ltr" | "rtl" = isRtlLocale(session.tenant.locale) ? "rtl" : "ltr";

  return (
    <AppShell
      tenantId={session.tenant.id}
      tenantName={displayName}
      memberships={session.memberships.map((m) => ({
        ...m,
        // Use the displayName override when the user is on a tenant with one.
        tenantName: m.tenantId === session.tenant.id ? displayName : m.tenantName,
      }))}
      assistantName={assistantName}
      logoUrl={theme.logoUrl ?? null}
      themeVars={{
        primaryColor: theme.primaryColor,
        accentColor: theme.accentColor,
        sidebarColor: theme.sidebarColor,
        backgroundColor: theme.backgroundColor,
      }}
      userEmail={session.user.email ?? ""}
      userName={session.user.user_metadata?.full_name ?? session.user.email ?? "Operator"}
      vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null}
    >
      <LocaleDirectionEffect locale={session.tenant.locale ?? "en-US"} dir={dir} />
      <WebVitalsReporter tenantId={session.tenant.id} />
      {children}
    </AppShell>
  );
}
