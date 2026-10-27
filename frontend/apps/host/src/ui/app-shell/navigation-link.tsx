"use client";
import type { FeaturePage } from "@camera-path/slots";
import Link from "next/link";
import { Tooltip } from "@camera-path/ui-kit";
import { cn } from "@camera-path/ui-kit/lib/cn";

interface NavigationLinkProps {
  href: string;
  label: string;
  icon: FeaturePage["icon"];
  active: boolean;
  variant?: "rail" | "menu";
  onNavigate?: () => void;
}

export function NavigationLink({
  href,
  label,
  icon: Icon,
  active,
  variant = "rail",
  onNavigate,
}: NavigationLinkProps) {
  const link = (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "flex items-center rounded-lg outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
        variant === "rail"
          ? "size-8 justify-center"
          : "h-11 gap-3 px-3 text-sm",
        active
          ? "bg-accent text-foreground shadow-sm"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
      )}
    >
      <Icon
        className={variant === "rail" ? "size-4" : "size-[18px]"}
        strokeWidth={1.7}
        aria-hidden="true"
      />
      <span className={variant === "rail" ? "sr-only" : undefined}>
        {label}
      </span>
    </Link>
  );
  return variant === "rail" ? <Tooltip label={label}>{link}</Tooltip> : link;
}
