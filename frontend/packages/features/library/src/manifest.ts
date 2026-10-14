import {
  library_deleteLibraryAssets,
  library_navigate,
  library_updateLibraryDefaults,
  library_uploadLibraryFile,
} from "@camera-path/contracts/feature-requests";
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
  data: {
    provides: [],
    reads: [
      {
        contract: projectPermissions,
        access: ["read", "readAsync", "subscribe"],
      },
      { contract: libraryCatalog, access: ["read", "readAsync", "subscribe"] },
      { contract: libraryAsset, access: ["read", "readAsync", "subscribe"] },
    ],
  },
  requests: {
    calls: [
      uploadLibraryFile,
      deleteLibraryAssets,
      updateLibraryDefaults,
      navigate,
    ],
    handles: [
      library_uploadLibraryFile,
      library_deleteLibraryAssets,
      library_updateLibraryDefaults,
      library_navigate,
    ],
  },
  frames: [],
  contributions: [],
  capabilities: [],
} as const satisfies FeatureManifest<"library">;
