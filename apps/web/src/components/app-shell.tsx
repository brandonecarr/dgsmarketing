"use client";

import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { AppSidebar } from "./app-sidebar";
import { RosieChat } from "./rosie-chat";
import { GlobalSearch } from "./global-search";
import { TenantSwitcher, type TenantMembership } from "./tenant-switcher";
import { PushToggle } from "./push-toggle";
import { OfflineBanner } from "./offline-banner";
import { ThemeToggle } from "@rosie/ui";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { usePathname, useRouter } from "next/navigation";

interface ThemeVars {
  primaryColor?: string;
  accentColor?: string;
  sidebarColor?: string;
  backgroundColor?: string;
}

function hexToHsl(hex: string): string | null {
  const m = hex.replace("#", "").match(/^([0-9a-fA-F]{6})$/);
  if (!m || !m[1]) return null;
  const v = m[1];
  const r = parseInt(v.slice(0, 2), 16) / 255;
  const g = parseInt(v.slice(2, 4), 16) / 255;
  const b = parseInt(v.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function AppShell({
  tenantId,
  tenantName,
  memberships,
  assistantName = "Rosie",
  logoUrl,
  themeVars,
  userEmail,
  userName,
  vapidPublicKey,
  children,
}: {
  tenantId: string;
  tenantName: string;
  memberships: TenantMembership[];
  assistantName?: string;
  logoUrl?: string | null;
  themeVars?: ThemeVars;
  userEmail: string;
  userName: string;
  vapidPublicKey?: string | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [chatOpen, setChatOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Close the mobile drawer on route change.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  async function signOut() {
    await getSupabaseBrowser().auth.signOut();
    router.replace("/login");
  }

  // Build CSS variable overrides for white-label.
  const styleVars: React.CSSProperties = {};
  if (themeVars?.backgroundColor) {
    const hsl = hexToHsl(themeVars.backgroundColor);
    if (hsl) (styleVars as Record<string, string>)["--background"] = hsl;
  }
  if (themeVars?.sidebarColor) {
    const hsl = hexToHsl(themeVars.sidebarColor);
    if (hsl) (styleVars as Record<string, string>)["--card"] = hsl;
  }
  // Primary / accent: map to brand tokens used by buttons + accents.
  if (themeVars?.primaryColor) {
    (styleVars as Record<string, string>)["--color-rosie-600"] = themeVars.primaryColor;
  }
  if (themeVars?.accentColor) {
    (styleVars as Record<string, string>)["--color-rosie-500"] = themeVars.accentColor;
  }

  return (
    <div className="flex min-h-screen" style={styleVars}>
      <AppSidebar
        tenantName={tenantName}
        logoUrl={logoUrl}
        assistantName={assistantName}
        onTalkToRosie={() => setChatOpen(true)}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
        footer={
          <div className="flex items-center justify-between gap-2 px-2 py-1">
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold">{userName}</div>
              <div className="truncate text-[10px] text-[hsl(var(--muted-foreground))]">
                {userEmail}
              </div>
            </div>
            <button
              onClick={signOut}
              className="rounded-md border border-[hsl(var(--border))] px-2 py-1 text-[10px] hover:bg-[hsl(var(--muted))]"
            >
              Logout
            </button>
          </div>
        }
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <OfflineBanner />
        <header className="flex h-14 items-center justify-between border-b border-[hsl(var(--border))] px-4 md:px-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="rounded-md border border-[hsl(var(--border))] p-1.5 md:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <TenantSwitcher
              active={{ tenantId, tenantName }}
              memberships={memberships}
            />
          </div>
          <div className="flex items-center gap-2">
            <GlobalSearch />
            <PushToggle vapidPublicKey={vapidPublicKey ?? null} />
            <ThemeToggle />
            <button
              onClick={() => setChatOpen((v) => !v)}
              className="hidden md:inline-flex rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-xs hover:bg-[hsl(var(--muted))]"
            >
              {chatOpen ? `Hide ${assistantName}` : `Talk to ${assistantName}`}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-[hsl(var(--background))] p-4 md:p-6">{children}</main>
      </div>

      <RosieChat
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        tenantName={tenantName}
      />
    </div>
  );
}
