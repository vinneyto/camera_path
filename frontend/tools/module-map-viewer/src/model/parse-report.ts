import type { Report } from "./types";

export function parseReport(value: unknown): Report {
  function object(item: unknown): item is Record<string, unknown> {
    return item !== null && typeof item === "object" && !Array.isArray(item);
  }
  function location(item: unknown): boolean {
    return (
      object(item) &&
      typeof item.file === "string" &&
      Number.isInteger(item.line) &&
      Number.isInteger(item.column) &&
      Number(item.line) > 0 &&
      Number(item.column) > 0
    );
  }
  function dependency(item: unknown): boolean {
    return (
      object(item) &&
      typeof item.name === "string" &&
      typeof item.kind === "string" &&
      typeof item.package === "string" &&
      location(item.definition) &&
      Array.isArray(item.usages) &&
      item.usages.every(
        (u) => location(u) && object(u) && typeof u.expression === "string",
      ) &&
      (item.statePaths === undefined ||
        (Array.isArray(item.statePaths) &&
          item.statePaths.every((p) => typeof p === "string")))
    );
  }
  function slots(item: unknown, depth = 0): boolean {
    return (
      depth < 32 &&
      object(item) &&
      Object.values(item).every((child) =>
        Array.isArray(child)
          ? child.every(
              (c) => location(c) && object(c) && typeof c.name === "string",
            )
          : slots(child, depth + 1),
      )
    );
  }
  if (
    !object(value) ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.modules)
  )
    throw new Error("Ожидался отчёт frontend-modules.json с schemaVersion: 1.");
  const names = new Set<string>();
  for (const item of value.modules) {
    if (
      !object(item) ||
      typeof item.name !== "string" ||
      !["feature", "host", "shared"].includes(String(item.kind)) ||
      !slots(item.slots) ||
      !Array.isArray(item.actions) ||
      !item.actions.every(dependency) ||
      !Array.isArray(item.selectors) ||
      !item.selectors.every(dependency) ||
      names.has(item.name)
    )
      throw new Error(
        "В JSON некорректный модуль, дерево слотов или зависимости.",
      );
    names.add(item.name);
  }
  return value as unknown as Report;
}
