"use client";
import { libraryAsset } from "@camera-path/contracts/host-data";
import { useDataQuery } from "@camera-path/extension-api";
import { manifest } from "../manifest";
export function useGetLibraryAsset(assetId?: string) {
  const query = useDataQuery(manifest, libraryAsset);
  if (assetId && query.data && query.data.data.id !== assetId)
    throw new Error("Library asset scope mismatch");
  return query;
}
