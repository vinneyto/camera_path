"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { ContributionRegistry } from "./contribution-registry";
import type { Extension } from "./extension";

type Entry = Extension["contributions"][number] & { order: number };
const Context = createContext<readonly ContributionRegistry<Entry>[]>([]);

export function ExtensionProvider({
  extensions,
  children,
}: {
  extensions: readonly Extension[];
  children: ReactNode;
}) {
  const parents = useContext(Context);
  // A scope owns one immutable registration set for its entire lifetime.
  const [registry] = useState(() => {
    const registry = new ContributionRegistry<Entry>();
    for (const extension of extensions)
      for (const entry of extension.contributions)
        registry.register(extension.manifest, entry.id, {
          ...entry,
          order:
            extension.manifest.contributions.find((c) => c.id === entry.id)
              ?.order ?? 0,
        });
    return registry;
  });
  return (
    <Context.Provider value={[...parents, registry]}>
      {children}
    </Context.Provider>
  );
}

export function useSlotContributions(slot: string) {
  return useContext(Context)
    .flatMap((registry) => registry.list(slot))
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}
