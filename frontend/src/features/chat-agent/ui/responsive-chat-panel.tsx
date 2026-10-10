"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { MessageCircle, X } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { Button, CONTEXT_MENU_Z_INDEX } from "@/shared/ui";
import { ChatPanel, type ChatPanelProps } from "./chat-panel";

const MOBILE_QUERY = "(width < 768px)";

export function ResponsiveChatPanel(props: ChatPanelProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const mobile = useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia(MOBILE_QUERY);
      const update = () => {
        if (!query.matches) setOpen(false);
        notify();
      };
      query.addEventListener("change", update);
      return () => query.removeEventListener("change", update);
    },
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  );
  const [viewport, setViewport] = useState<{
    top: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    if (!mobile || !open || !window.visualViewport) return;
    const visualViewport = window.visualViewport;
    const update = () =>
      setViewport({
        top: visualViewport.offsetTop,
        height: visualViewport.height,
      });
    update();
    visualViewport.addEventListener("resize", update);
    visualViewport.addEventListener("scroll", update);
    return () => {
      visualViewport.removeEventListener("resize", update);
      visualViewport.removeEventListener("scroll", update);
    };
  }, [mobile, open]);

  if (!mobile) return <ChatPanel {...props} />;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <div className="shrink-0 border-t bg-background p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <Dialog.Trigger asChild>
          <Button
            aria-label="Open trajectory chat"
            className="h-11 w-full justify-start rounded-xl text-xs text-muted-foreground"
            variant="outline"
          >
            <MessageCircle className="size-4 shrink-0" />
            <span className="truncate">
              {props.composer.message || "Ask the trajectory agent…"}
            </span>
          </Button>
        </Dialog.Trigger>
      </div>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 bg-black/40 backdrop-blur-sm"
          style={{ zIndex: CONTEXT_MENU_Z_INDEX + 1 }}
        />
        <Dialog.Content
          ref={contentRef}
          aria-describedby={undefined}
          className="mobile-chat-drawer fixed inset-x-0 bottom-0 flex h-[min(85dvh,720px)] min-h-0 flex-col overflow-hidden rounded-t-2xl border bg-background pt-2 shadow-xl outline-none"
          style={{
            zIndex: CONTEXT_MENU_Z_INDEX + 2,
            ...(viewport
              ? {
                  bottom: "auto",
                  top: viewport.top + viewport.height * 0.15,
                  height: viewport.height * 0.85,
                }
              : {}),
          }}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            const input =
              contentRef.current?.querySelector<HTMLTextAreaElement>(
                "textarea",
              );
            if (input && !input.disabled) input.focus();
            else contentRef.current?.focus();
          }}
        >
          <div
            aria-hidden="true"
            className="mx-auto mb-1 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/30"
          />
          <Dialog.Title className="sr-only">Trajectory chat</Dialog.Title>
          <ChatPanel
            {...props}
            headerAction={
              <Dialog.Close asChild>
                <Button
                  aria-label="Close chat"
                  className="size-10"
                  size="icon"
                  variant="ghost"
                >
                  <X className="size-4" />
                </Button>
              </Dialog.Close>
            }
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
