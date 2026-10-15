"use client";
import { useAssetId } from "@camera-path/store";
import { LibraryAssetDetails } from "./library-asset-details";
export function LibraryDetails() {
  return <LibraryAssetDetails assetId={useAssetId()} />;
}
