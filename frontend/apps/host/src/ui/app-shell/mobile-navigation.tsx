"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { Slot } from "@camera-path/slots";
import { Button } from "@camera-path/ui-kit";
import Link from "next/link";
import { Camera, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { NavigationLinks } from "./navigation-links";
import { ProfileMenu } from "./profile-menu";

export function MobileNavigation() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  return (
    <header className="relative z-50 flex h-11 shrink-0 items-center gap-2 border-b bg-background px-2 md:hidden">
      <Dialog.Root open={open} onOpenChange={setOpen} modal={false}>
        <Dialog.Trigger asChild>
          <Button
            aria-label={open ? "Close navigation" : "Open navigation"}
            size="icon"
            variant="ghost"
            className="size-9"
          >
            {open ? (
              <X className="size-[18px]" />
            ) : (
              <Menu className="size-[18px]" />
            )}
          </Button>
        </Dialog.Trigger>
        <Dialog.Content
          aria-describedby={undefined}
          className="absolute left-2 top-12 w-[min(19rem,calc(100vw-1rem))] rounded-xl border bg-popover p-2 text-popover-foreground shadow-xl outline-none"
          onOpenAutoFocus={(event) => {
            if (event.target instanceof HTMLElement) {
              event.preventDefault();
              event.target.querySelector("a")?.focus();
            }
          }}
        >
          <Dialog.Title className="sr-only">Navigation</Dialog.Title>
          <NavigationLinks variant="menu" onNavigate={() => setOpen(false)} />
          <div className="mt-2 flex items-center gap-1 border-t pt-2">
            <ProfileMenu showLabel />
            <Slot name="navigation.controls" />
          </div>
        </Dialog.Content>
      </Dialog.Root>
      <Link
        href="/"
        aria-label="Camera Path — Projects"
        onClick={() => setOpen(false)}
        className="flex h-9 items-center gap-2 rounded-lg px-2 text-xs font-medium tracking-tight text-muted-foreground outline-none transition-colors hover:bg-accent/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
      >
        <Camera className="size-[18px]" strokeWidth={1.6} aria-hidden="true" />
        Camera Path
      </Link>
    </header>
  );
}
