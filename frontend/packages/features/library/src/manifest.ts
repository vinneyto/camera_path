import {
  libraryAsset,
  libraryCatalog,
  projectPermissions,
} from "@camera-path/contracts/host-data";
import {
  deleteLibraryAssets,
  navigate,
  updateLibraryDefaults,
  uploadLibraryFile,
} from "@camera-path/contracts/host-requests";
import type { FeatureManifest } from "@camera-path/extension-api";
export const manifest = {
  manifestVersion: 1,
  id: "library",
  scope: "application",
  reads: [projectPermissions, libraryCatalog, libraryAsset],
  calls: [
    uploadLibraryFile,
    deleteLibraryAssets,
    updateLibraryDefaults,
    navigate,
  ],
  frames: [],
  contributions: [],
  capabilities: [],
} as const satisfies FeatureManifest<"library">;
