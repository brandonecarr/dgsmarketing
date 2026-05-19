"use client";

import * as React from "react";
import { cn } from "../lib/cn";

export interface TopBarProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function TopBar({ title, subtitle, actions, className }: TopBarProps) {
  return (
    <header
      className={cn(
        "flex h-14 items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--background))] px-6",
        className,
      )}
    >
      <div className="min-w-0">
        {title ? <h1 className="truncate text-sm font-semibold">{title}</h1> : null}
        {subtitle ? (
          <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">{subtitle}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">{actions}</div>
    </header>
  );
}
