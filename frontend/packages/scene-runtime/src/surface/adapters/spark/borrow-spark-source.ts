import type { SplatMesh } from "@sparkjsdev/spark";
/** A depth proxy borrows source textures; disposing it must not dispose the cloud. */
export function borrowSparkSource(
  source: NonNullable<SplatMesh["splats"]>,
): NonNullable<SplatMesh["splats"]> {
  return {
    prepareFetchSplat: () => source.prepareFetchSplat(),
    getNumSplats: () => source.getNumSplats(),
    hasRgbDir: () => source.hasRgbDir(),
    getNumSh: () => source.getNumSh(),
    setMaxSh: () => undefined,
    fetchSplat: (args) => source.fetchSplat(args),
    forEachSplat: (callback) => source.forEachSplat(callback),
    dispose: () => undefined,
  };
}
