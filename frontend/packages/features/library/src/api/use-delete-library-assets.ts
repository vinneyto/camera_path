"use client";
import { deleteLibraryAssets } from "@camera-path/contracts/host-requests";
import { useRequestMutation } from "@camera-path/extension-api";
import { manifest } from "../manifest";
export function useDeleteLibraryAssets() {
  return useRequestMutation(manifest, deleteLibraryAssets);
}
