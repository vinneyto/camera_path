"use client";
import { Slot } from "@camera-path/slots";
import { Camera, FolderOpen, Library } from "lucide-react";
import { usePathname } from "next/navigation";
import { NavigationLink } from "./navigation-link";
import { ProfileMenu } from "./profile-menu";

export function AppSidebar() {
  const pathname = usePathname();
  return (
    <aside
      aria-label="Application sidebar"
      className="relative z-50 flex h-full w-14 shrink-0 flex-col items-center px-1.5 py-3 sm:w-[68px] sm:px-2 sm:py-4"
    >
      <div
        aria-label="Camera Path"
        className="mb-7 flex size-10 shrink-0 items-center justify-center text-foreground sm:size-11"
      >
        <Camera className="size-[23px]" strokeWidth={1.6} aria-hidden="true" />
      </div>
      <nav aria-label="Main navigation" className="flex flex-col gap-2">
        <NavigationLink
          href="/"
          label="Projects"
          icon={FolderOpen}
          active={pathname === "/" || pathname.startsWith("/projects/")}
        />
        <NavigationLink
          href="/library"
          label="Library"
          icon={Library}
          active={pathname === "/library" || pathname.startsWith("/library/")}
        />
      </nav>
      <div className="mt-auto flex flex-col items-center gap-2 pt-8 [&_button]:size-10 [&_button]:rounded-xl [&_svg]:size-[18px] sm:[&_button]:size-11">
        <Slot name="navigation.controls" />
        <ProfileMenu />
      </div>
    </aside>
  );
}
