"use client";
import { ExtensionProvider } from "@camera-path/extension-api/extension-provider";
import { ExtensionSlot } from "@camera-path/extension-api/extension-slot";
import { applicationFeatures } from "@host/composition/application-features";
import { useActivateFeatures } from "./use-activate-features";

import * as data from "@camera-path/contracts/host-data";
import * as requests from "@camera-path/contracts/host-requests";
import { HostProvider } from "@camera-path/extension-api/host-provider";
import { HostRuntime } from "@camera-path/extension-api/host-runtime";
import { EditableProvider } from "@camera-path/ui-kit/editable-provider";
import {
  getGetLibraryAssetQueryKey,
  getListLibraryAssetsQueryKey,
  updateLibraryAssetDefaults,
  useListLibraryAssets,
  useListProjects,
} from "@host/adapters/api/generated/client";
import { useTheme } from "@host/adapters/appearance/theme-provider";
import { useDeleteProject } from "@host/adapters/deletions";
import { useDeleteLibraryAssets } from "@host/adapters/features/library/use-delete-library-assets";
import { useUploadLibraryFile } from "@host/adapters/features/library/use-upload-library-file";
import { useCreateProject } from "@host/adapters/features/projects/use-create-project";
import { useAuth } from "@host/adapters/identity/auth-provider";
import { useUserSettings } from "@host/adapters/settings";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useState, type ReactNode } from "react";
import { useBindQuery } from "./use-bind-query";
import { useBindRequest } from "./use-bind-request";
import { useBindValue } from "./use-bind-value";
import { useRuntimeLifecycle } from "./use-runtime-lifecycle";
export function ApplicationHostProvider({ children }: { children: ReactNode }) {
  const [runtime] = useState(
    () => new HostRuntime("application", "application"),
  );
  useRuntimeLifecycle(runtime);
  const auth = useAuth();
  const settings = useUserSettings();
  const theme = useTheme();
  const router = useRouter();
  const library = useListLibraryAssets();
  const projects = useListProjects();
  const create = useCreateProject();
  const remove = useDeleteProject();
  const upload = useUploadLibraryFile();
  const deleteAssets = useDeleteLibraryAssets();
  const cache = useQueryClient();
  useLayoutEffect(() => {
    if (!auth.canEdit) runtime.revokeEditorRequests();
  }, [runtime, auth.canEdit]);
  useBindValue(runtime, data.projectPermissions, { canEdit: auth.canEdit });
  useBindValue(runtime, data.identityState, {
    canEdit: auth.canEdit,
    loading: auth.loading,
    username: auth.username,
    errorMessage: auth.error?.message ?? null,
    pending: auth.pending,
    challenge: auth.challenge,
  });
  useBindValue(runtime, data.preferencesState, {
    webGpuTileRenderer: settings.webGpuTileRenderer,
    showGrid: settings.showGrid,
    gaussianDpr: settings.gaussianDpr,
    loading: settings.loading,
    saving: settings.saving,
    ready: settings.ready,
    errorMessage: settings.error?.message ?? null,
  });
  useBindValue(runtime, data.themeState, theme.theme);
  useBindQuery(runtime, data.libraryCatalog, library);
  useBindQuery(runtime, data.projectsCatalog, projects);
  useBindRequest(runtime, requests.login, ({ username, password }) =>
    auth.login(username, password),
  );
  useBindRequest(runtime, requests.verify, (code) => auth.verify(code));
  useBindRequest(runtime, requests.resend, () => auth.resend());
  useBindRequest(runtime, requests.cancelLogin, () => auth.cancelLogin());
  useBindRequest(runtime, requests.logout, () => auth.logout());
  useBindRequest(runtime, requests.savePreferences, (changes) =>
    settings.save(changes),
  );
  useBindRequest(runtime, requests.retryPreferences, () => settings.retry());
  useBindRequest(runtime, requests.toggleTheme, () => theme.toggleTheme());
  useBindRequest(runtime, requests.navigate, (path) => {
    if (!/^\/(?:projects(?:\/[^/]+)?|library(?:\/[^/]+)?)?$/.test(path))
      throw new Error("Unsupported navigation destination");
    router.push(path);
  });
  useBindRequest(runtime, requests.createProject, (name) =>
    create.mutateAsync(name),
  );
  useBindRequest(runtime, requests.deleteProject, async (id) => {
    await remove.mutateAsync(id);
  });
  useBindRequest(runtime, requests.uploadLibraryFile, async (file) => {
    await upload.mutateAsync(file);
  });
  useBindRequest(runtime, requests.deleteLibraryAssets, async (ids) => {
    await deleteAssets.mutateAsync(ids);
  });
  const defaults = useMutation({
    mutationFn: async (input: {
      assetId: string;
      changes: import("@camera-path/contracts/api").LibraryAssetDefaultsUpdate;
    }) => {
      await updateLibraryAssetDefaults(input.assetId, input.changes);
      await Promise.all([
        cache.invalidateQueries({ queryKey: getListLibraryAssetsQueryKey() }),
        cache.invalidateQueries({
          queryKey: getGetLibraryAssetQueryKey(input.assetId),
        }),
      ]);
    },
  });
  useBindRequest(runtime, requests.updateLibraryDefaults, async (input) => {
    await defaults.mutateAsync(input);
  });
  useActivateFeatures(runtime, applicationFeatures);
  return (
    <HostProvider runtime={runtime}>
      <ExtensionProvider extensions={applicationFeatures}>
        <EditableProvider editable={auth.canEdit}>
          <ExtensionSlot name="application.root" />
          {children}
        </EditableProvider>
      </ExtensionProvider>
    </HostProvider>
  );
}
