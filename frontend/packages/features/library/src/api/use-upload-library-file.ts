"use client";
import { uploadLibraryFile } from "@camera-path/contracts/host-requests";
import { useRequestMutation } from "@camera-path/extension-api";
import { manifest } from "../manifest";
export function useUploadLibraryFile() {
  return useRequestMutation(manifest, uploadLibraryFile);
}
