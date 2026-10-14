"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { ContextMenu, type ContextMenuPosition } from "@camera-path/ui-kit";
import { SceneEvents } from "./scene-events";
type Items = import("react").ComponentProps<typeof ContextMenu>["items"];
interface ViewportServices {
  events: SceneEvents;
  openMenu: (items: Items, position: ContextMenuPosition) => void;
  closeMenu: () => void;
  setCursor: (id: string, cursor: string | null) => void;
  setMessage: (
    id: string,
    message: { text: string; error?: boolean } | null,
  ) => void;
}
const Context = createContext<ViewportServices | null>(null);
export function ViewportProvider({ children }: { children: ReactNode }) {
  const [events] = useState(() => new SceneEvents());
  const [cursors, setCursors] = useState<Record<string, string>>({});
  const cursor = Object.values(cursors).at(-1);
  useEffect(() => {
    if (!cursor) return;
    const previous = document.body.style.cursor;
    document.body.style.cursor = cursor;
    return () => {
      document.body.style.cursor = previous;
    };
  }, [cursor]);
  const [menu, setMenu] = useState<{
    items: Items;
    position: ContextMenuPosition;
  } | null>(null);
  const [messages, setMessages] = useState<
    Record<string, { text: string; error?: boolean }>
  >({});
  // Imperative services are stable so a scope cleanup can safely release its messages/menu.
  const [services] = useState<ViewportServices>(() => ({
    events,
    openMenu: (items, position) => setMenu({ items, position }),
    closeMenu: () => setMenu(null),
    setCursor: (id, cursor) =>
      setCursors((previous) => {
        if (previous[id] === cursor || (!cursor && !(id in previous)))
          return previous;
        const next = { ...previous };
        if (cursor) next[id] = cursor;
        else delete next[id];
        return next;
      }),
    setMessage: (id, message) =>
      setMessages((previous) => {
        const next = { ...previous };
        if (message) next[id] = message;
        else delete next[id];
        return next;
      }),
  }));
  return (
    <Context.Provider value={services}>
      {children}
      <div className="pointer-events-none absolute bottom-3 left-3 z-10 space-y-1">
        {Object.entries(messages).map(([id, message]) => (
          <p
            key={id}
            role={message.error ? "alert" : "status"}
            className="rounded bg-background/90 px-2 py-1 text-xs"
          >
            {message.text}
          </p>
        ))}
      </div>
      <ContextMenu
        items={menu?.items ?? []}
        position={menu?.position ?? null}
        onClose={services.closeMenu}
      />
    </Context.Provider>
  );
}
export function useViewportServices() {
  const value = useContext(Context);
  if (!value) throw Error("ViewportProvider is required");
  return value;
}
