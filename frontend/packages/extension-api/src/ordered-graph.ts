export interface OrderedEntry {
  readonly id: string;
  readonly after?: readonly string[];
  readonly before?: readonly string[];
}
export function orderedGraph<T extends OrderedEntry>(
  entries: readonly T[],
  external: readonly string[] = [],
): readonly T[] {
  const nodes = new Map(entries.map((e) => [e.id, e]));
  if (nodes.size !== entries.length) throw new Error("Duplicate graph node");
  const incoming = new Map(entries.map((e) => [e.id, new Set<string>()]));
  for (const entry of entries) {
    for (const id of entry.after ?? []) {
      if (!nodes.has(id) && !external.includes(id))
        throw new Error(`Missing dependency: ${id}`);
      if (nodes.has(id)) incoming.get(entry.id)!.add(id);
    }
    for (const id of entry.before ?? []) {
      if (!nodes.has(id) && !external.includes(id))
        throw new Error(`Missing dependency: ${id}`);
      if (nodes.has(id)) incoming.get(id)!.add(entry.id);
    }
  }
  const result: T[] = [];
  while (incoming.size) {
    const ready = [...incoming]
      .filter(([, deps]) => !deps.size)
      .map(([id]) => id)
      .sort();
    if (!ready.length) throw new Error("Cyclic graph dependency");
    for (const id of ready) {
      result.push(nodes.get(id)!);
      incoming.delete(id);
      for (const deps of incoming.values()) deps.delete(id);
    }
  }
  return result;
}
