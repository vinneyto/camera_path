"use client";
import { libraryCatalog } from "@camera-path/contracts/host-data";
import { useDataQuery } from "@camera-path/extension-api";
import { manifest } from "../manifest";
export function useListLibraryAssets() {
  return useDataQuery(manifest, libraryCatalog);
}
