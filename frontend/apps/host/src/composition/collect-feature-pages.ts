import type { FeaturePage, FeatureSlots } from "@camera-path/slots";

/** These namespaces are owned by native Next routes and cannot be shadowed. */
const nativeRoots = new Set(["projects", "library", "api", "_next"]);

export function collectFeaturePages(
  features: readonly FeatureSlots[],
): readonly FeaturePage[] {
  const pages = features.flatMap((feature) => feature.pages ?? []);
  const paths = new Set<string>();
  for (const page of pages) {
    if (!/^(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)+$/.test(page.path)) {
      throw new Error(
        `Invalid feature page path: ${page.path}. Use absolute lowercase slug segments.`,
      );
    }
    if (nativeRoots.has(page.path.split("/")[1])) {
      throw new Error(
        `Feature page path conflicts with a native route: ${page.path}`,
      );
    }
    if (paths.has(page.path)) {
      throw new Error(`Duplicate feature page path: ${page.path}`);
    }
    if (!page.label.trim())
      throw new Error(`Feature page label is empty: ${page.path}`);
    paths.add(page.path);
  }
  return pages;
}
