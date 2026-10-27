"use client";
import type { ReactNode } from "react";
import { AppSidebar } from "./app-sidebar";
import { MobileNavigation } from "./mobile-navigation";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[var(--shell-background)] md:flex-row md:py-2 md:pr-2">
      <a
        href="#main-content"
        className="fixed left-3 top-4 z-[999999] -translate-y-24 rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:translate-y-0 md:left-14"
      >
        Skip to content
      </a>
      <AppSidebar />
      <MobileNavigation />
      <div
        id="main-content"
        tabIndex={-1}
        className="relative isolate min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain bg-background outline-none md:rounded-[20px] md:border md:border-border/60 md:shadow-sm"
      >
        {children}
      </div>
    </div>
  );
}
