import type { ContributionDeclaration, FeatureManifest } from "./manifest";
export class ContributionRegistry<T> {
  private readonly entries = new Map<
    string,
    { declaration: ContributionDeclaration; owner: string; value: T }
  >();
  register(manifest: FeatureManifest, id: string, value: T): () => void {
    const declaration = manifest.contributions.find((c) => c.id === id);
    if (!declaration)
      throw new Error(`Undeclared contribution: ${manifest.id} → ${id}`);
    if (!id.startsWith(manifest.id + "."))
      throw new Error(`Invalid contribution owner: ${id}`);
    if (this.entries.has(id)) throw new Error(`Duplicate contribution: ${id}`);
    if (
      declaration.kind === "timeline" &&
      [...this.entries.values()].some(
        (e) =>
          e.declaration.kind === "timeline" &&
          e.declaration.resourceType === declaration.resourceType,
      )
    )
      throw new Error(`Duplicate track type: ${declaration.resourceType}`);
    const entry = { declaration, owner: manifest.id, value };
    this.entries.set(id, entry);
    return () => {
      if (this.entries.get(id) === entry) this.entries.delete(id);
    };
  }
  list(slot?: string): readonly T[] {
    return [...this.entries.values()]
      .filter((e) => !slot || e.declaration.slot === slot)
      .sort(
        (a, b) =>
          (a.declaration.order ?? 0) - (b.declaration.order ?? 0) ||
          a.declaration.id.localeCompare(b.declaration.id),
      )
      .map((e) => e.value);
  }
}
