"use client";

import { usePathname } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Gauge,
  Building2,
  ChartBar,
  ClipboardCheck,
  ClipboardList,
  Compass,
  Globe,
  Map,
  Image as ImageIcon,
  Inbox,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Palette,
  PenSquare,
  Printer,
  QrCode,
  Rocket,
  Settings as SettingsIcon,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { Sidebar, type SidebarSection } from "@rosie/ui";

export function AppSidebar({
  tenantName,
  logoUrl,
  assistantName,
  onTalkToRosie,
  footer,
  mobileOpen,
  onMobileClose,
}: {
  tenantName: string;
  logoUrl?: string | null;
  assistantName?: string;
  onTalkToRosie: () => void;
  footer?: React.ReactNode;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const pathname = usePathname() ?? "/";

  const sections: SidebarSection[] = [
    {
      links: [
        { label: "Auto-Rosie", href: "/action-plan", icon: Bot },
        { label: "Overview", href: "/overview", icon: LayoutDashboard },
        { label: "Campaigns", href: "/campaigns", icon: Megaphone },
        { label: "Action Plan", href: "/action-plan", icon: ClipboardCheck },
        { label: "Weekly Review", href: "/review", icon: CheckCircle2 },
      ],
    },
    {
      title: "Pipeline Tools",
      links: [
        { label: "Inbox", href: "/inbox", icon: Inbox },
        { label: "Lead Follow-Up", href: "/follow-up", icon: MessageSquare },
        { label: "Bulk Messages", href: "/bulk", icon: Megaphone },
        { label: "Commercial Leads", href: "/commercial", icon: ClipboardList },
        { label: "Lead Assistant", href: "/lead-assistant", icon: Bot },
      ],
    },
    {
      title: "Customers & Routes",
      links: [
        { label: "Customers", href: "/customers", icon: Users },
        { label: "Routes", href: "/routes", icon: Map },
      ],
    },
    {
      title: "Marketing",
      links: [
        { label: "Image Creator", href: "/images", icon: ImageIcon },
        { label: "QR Studio", href: "/qr", icon: QrCode },
        { label: "Print Studio", href: "/print", icon: Printer },
        { label: "Post Scheduler", href: "/posts", icon: PenSquare },
        { label: "Quick Launch", href: "/launch", icon: Rocket },
        { label: "Coaching", href: "/coaching", icon: Sparkles },
        { label: "Site Builder", href: "/site", icon: Globe },
      ],
    },
    {
      title: "Operations",
      links: [
        { label: "My Business", href: "/business", icon: Building2 },
        { label: "Google Profile", href: "/gbp", icon: Globe },
        { label: "Competitor Intel", href: "/competitors", icon: Target },
        { label: "KPIs", href: "/kpis", icon: ChartBar },
        { label: "Specialists", href: "/specialists", icon: Users },
        { label: "People", href: "/people", icon: Users },
        { label: "Work Queue", href: "/work-queue", icon: ClipboardList },
        { label: "Hiring Hub", href: "/hiring", icon: Compass },
        { label: "Audit log", href: "/audit", icon: ClipboardCheck },
        { label: "Performance", href: "/perf", icon: Gauge },
        { label: "Dead-letter queue", href: "/dlq", icon: AlertTriangle },
        { label: "Settings", href: "/settings", icon: SettingsIcon },
      ],
    },
  ];

  // Mark active link
  for (const section of sections) {
    for (const link of section.links) {
      link.active = pathname === link.href || pathname.startsWith(link.href + "/");
    }
  }

  return (
    <Sidebar
      tenantName={tenantName}
      logoUrl={logoUrl}
      assistantName={assistantName}
      sections={sections}
      onTalkToRosie={onTalkToRosie}
      footer={footer}
      mobileOpen={mobileOpen}
      onMobileClose={onMobileClose}
    />
  );
}
