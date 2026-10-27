"use client";
import { FolderOpen, Library } from "lucide-react";
import { usePathname } from "next/navigation";
import { featurePages } from "@host/composition/feature-pages";
import { NavigationLink } from "./navigation-link";

export function NavigationLinks({
  variant = "rail",
  onNavigate,
}: {
  variant?: "rail" | "menu";
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main navigation"
      className={variant === "rail" ? "flex flex-col gap-1" : "space-y-1"}
    >
      <NavigationLink
        href="/"
        label="Projects"
        icon={FolderOpen}
        active={pathname === "/" || pathname.startsWith("/projects/")}
        variant={variant}
        onNavigate={onNavigate}
      />
      <NavigationLink
        href="/library"
        label="Library"
        icon={Library}
        active={pathname === "/library" || pathname.startsWith("/library/")}
        variant={variant}
        onNavigate={onNavigate}
      />
      {featurePages.map((page) => (
        <NavigationLink
          key={page.path}
          href={page.path}
          label={page.label}
          icon={page.icon}
          active={pathname === page.path}
          variant={variant}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}
