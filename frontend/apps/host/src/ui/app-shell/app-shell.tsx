"use client";
import type { ReactNode } from "react";
import { AppSidebar } from "./app-sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-[var(--shell-background)] sm:py-2 sm:pr-2">
      <a
        href="#main-content"
        className="fixed left-20 top-4 z-[999999] -translate-y-24 rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:translate-y-0"
      >
        Skip to content
      </a>
      <AppSidebar />
      <div
        id="main-content"
        tabIndex={-1}
        className="relative isolate min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain rounded-l-2xl border border-border/60 bg-background shadow-sm outline-none sm:rounded-[20px]"
      >
        {children}
      </div>
    </div>
  );
}
