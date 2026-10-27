"use client";
import { Slot } from "@camera-path/slots";
import { TooltipProvider } from "@camera-path/ui-kit";
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
        <div
          aria-label="Camera Path"
          className="mb-5 flex size-8 shrink-0 items-center justify-center text-foreground"
        >
          <Camera
            className="size-[18px]"
            strokeWidth={1.6}
            aria-hidden="true"
          />
        </div>
        <NavigationLinks />
        <div className="mt-auto flex flex-col items-center gap-1 pt-6 [&_button]:size-8 [&_button]:rounded-lg [&_svg]:size-4">
          <Slot name="navigation.controls" />
          <ProfileMenu />
        </div>
      </aside>
    </TooltipProvider>
  );
}
