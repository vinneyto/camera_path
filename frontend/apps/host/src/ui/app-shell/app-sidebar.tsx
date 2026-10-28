"use client";
import { Slot } from "@camera-path/slots";
import { TooltipProvider } from "@camera-path/ui-kit";
import Link from "next/link";
import { Camera } from "lucide-react";
import { NavigationLinks } from "./navigation-links";
import { ProfileMenu } from "./profile-menu";

export function AppSidebar() {
  return (
    <TooltipProvider>
      <aside
        aria-label="Application sidebar"
        className="relative z-50 hidden h-full w-12 shrink-0 flex-col items-center px-1 py-2 md:flex"
      >
        <Link
          href="/"
          aria-label="Camera Path — Projects"
          className="mb-5 flex size-8 shrink-0 items-center justify-center rounded-lg text-foreground outline-none transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
        >
          <Camera
            className="size-[18px]"
            strokeWidth={1.6}
            aria-hidden="true"
          />
        </Link>
        <NavigationLinks />
        <div className="mt-auto flex flex-col items-center gap-1 pt-6 [&_button]:size-8 [&_button]:rounded-lg [&_svg]:size-4">
          <Slot name="navigation.controls" />
          <ProfileMenu />
        </div>
      </aside>
    </TooltipProvider>
  );
}
