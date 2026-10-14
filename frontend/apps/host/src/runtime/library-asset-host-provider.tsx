"use client";
import { libraryAsset } from "@camera-path/contracts/host-data";
import {
  HostProvider,
  useHostRuntime,
} from "@camera-path/extension-api/host-provider";
import { HostRuntime } from "@camera-path/extension-api/host-runtime";
import { useGetLibraryAsset } from "@host/adapters/api/generated/client";
import { useState, type ReactNode } from "react";
import { useBindQuery } from "./use-bind-query";
import { useRuntimeLifecycle } from "./use-runtime-lifecycle";
export function LibraryAssetHostProvider({
  assetId,
  children,
}: {
  assetId: string;
  children: ReactNode;
}) {
  const parent = useHostRuntime();
  const [runtime] = useState(
    () => new HostRuntime(`asset:${assetId}`, "application", parent),
  );
  useRuntimeLifecycle(runtime);
  useBindQuery(runtime, libraryAsset, useGetLibraryAsset(assetId));
  return <HostProvider runtime={runtime}>{children}</HostProvider>;
}
