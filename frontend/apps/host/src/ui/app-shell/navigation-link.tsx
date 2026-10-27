"use client";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { Tooltip } from "@camera-path/ui-kit";
import { cn } from "@camera-path/ui-kit/lib/cn";

interface NavigationLinkProps {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
}

export function NavigationLink({
  href,
  label,
  icon: Icon,
  active,
}: NavigationLinkProps) {
  return (
    <Tooltip label={label}>
      <Link
        href={href}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex size-10 items-center justify-center rounded-xl outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none sm:size-11",
          active
            ? "bg-accent text-foreground shadow-sm"
            : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
        )}
      >
        <Icon className="size-[19px]" strokeWidth={1.7} aria-hidden="true" />
      </Link>
    </Tooltip>
  );
}
