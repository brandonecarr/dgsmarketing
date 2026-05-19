"use client";

import * as React from "react";
import { Sparkles, type LucideIcon } from "lucide-react";
import { cn } from "../lib/cn";

export interface SidebarLink {
  label: string;
  href: string;
  icon?: LucideIcon;
  badge?: string | number;
  active?: boolean;
}

export interface SidebarSection {
  title?: string;
  collapsible?: boolean;
  links: SidebarLink[];
}

export interface SidebarProps {
  tenantName: string;
  logoUrl?: string | null;
  assistantName?: string;
  sections: SidebarSection[];
  onTalkToRosie?: () => void;
  /** Slot for the user menu at the bottom. */
  footer?: React.ReactNode;
  className?: string;
  /** When true (mobile), the sidebar slides in as an overlay. */
  mobileOpen?: boolean;
  /** Called when the user taps the overlay or a link on mobile. */
  onMobileClose?: () => void;
}

export function Sidebar({
  tenantName,
  logoUrl,
  assistantName = "Rosie",
  sections,
  onTalkToRosie,
  footer,
  className,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  return (
    <>
      {mobileOpen ? (
        <button
          aria-label="Close menu"
          onClick={onMobileClose}
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
        />
      ) : null}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-screen w-64 flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--card))] transition-transform",
          "md:static md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          className,
        )}
        onClick={(e) => {
          // Close when an inner link is tapped — but not on container itself.
          const target = e.target as HTMLElement;
          if (target.closest("a") && onMobileClose) onMobileClose();
        }}
      >
      <div className="flex items-center gap-2 px-5 py-4">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rosie-600 text-white text-sm font-bold">
            {(assistantName ?? "R").charAt(0).toUpperCase()}
          </div>
        )}
        <div className="truncate font-semibold">{tenantName}</div>
      </div>

      <button
        onClick={onTalkToRosie}
        className="mx-3 mb-3 flex items-center justify-center gap-2 rounded-lg bg-neutral-900 dark:bg-neutral-100 px-4 py-3 text-sm font-semibold text-white dark:text-neutral-900 hover:opacity-90 transition"
      >
        <Sparkles className="h-4 w-4" />
        Talk to {assistantName}
      </button>

      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        {sections.map((section, i) => (
          <SidebarGroup key={i} title={section.title}>
            {section.links.map((link) => (
              <SidebarItem key={link.href} {...link} />
            ))}
          </SidebarGroup>
        ))}
      </nav>

      {footer ? (
        <div className="border-t border-[hsl(var(--border))] px-3 py-2">{footer}</div>
      ) : null}
      </aside>
    </>
  );
}

export function SidebarGroup({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-2">
      {title ? (
        <div className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
          {title}
        </div>
      ) : null}
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}

export function SidebarItem({ label, href, icon: Icon, badge, active }: SidebarLink) {
  return (
    <li>
      <a
        href={href}
        className={cn(
          "group flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
          active
            ? "bg-rosie-50 text-rosie-700 dark:bg-rosie-950 dark:text-rosie-200"
            : "text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]",
        )}
      >
        {Icon ? (
          <Icon
            className={cn(
              "h-4 w-4 shrink-0",
              active ? "text-rosie-600" : "text-[hsl(var(--muted-foreground))]",
            )}
          />
        ) : null}
        <span className="flex-1 truncate">{label}</span>
        {badge !== undefined ? (
          <span className="rounded-full bg-rosie-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {badge}
          </span>
        ) : null}
      </a>
    </li>
  );
}
