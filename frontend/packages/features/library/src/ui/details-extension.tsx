"use client";
import { HeaderControls, useFeatureHost } from "@camera-path/extension-api";
import { manifest } from "../manifest";
import { LibraryAssetDetails } from "./library-asset-details";
export function DetailsExtension() {
  const host = useFeatureHost(manifest);
  const assetId = host.scopeId.replace(/^asset:/, "");
  return <LibraryAssetDetails assetId={assetId} header={<HeaderControls />} />;
}
