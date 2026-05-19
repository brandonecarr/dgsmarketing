"use client";

import { Eye } from "lucide-react";
import { cn } from "../lib/cn";

export interface ViewingAsBannerProps {
  name: string;
  onExit?: () => void;
  className?: string;
}

export function ViewingAsBanner({ name, onExit, className }: ViewingAsBannerProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 bg-amber-400 px-4 py-2 text-sm font-medium text-amber-950",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4" />
        <span>Viewing as {name}</span>
      </div>
      {onExit ? (
        <button
          onClick={onExit}
          className="rounded-md border border-amber-700/20 bg-white/40 px-3 py-1 text-xs font-semibold hover:bg-white/70"
        >
          ← Back to Admin
        </button>
      ) : null}
    </div>
  );
}
