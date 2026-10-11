"use client";

import { createContext, useContext } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/features/auth";
import {
  getUserSettings,
  updateUserSettings,
} from "@/shared/api/generated/client";
import type {
  UserSettings,
  UserSettingsUpdate,
} from "@/shared/api/generated/model";
import { readEditorSettings } from "./read-editor-settings";

export const EDITOR_SETTINGS_KEY = "camera-path-editor-settings";

interface UserSettingsContextValue {
  webGpuTileRenderer: boolean;
  showGrid: boolean;
  gaussianDpr: "1x" | "system";
  loading: boolean;
  saving: boolean;
  ready: boolean;
  error: Error | null;
  retry: () => void;
  save: (changes: UserSettingsUpdate) => void;
}

const UserSettingsContext = createContext<UserSettingsContextValue | null>(
  null,
);

export function UserSettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const key = ["profile-settings"];
  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      let fallback: UserSettings = {
        webgpu_tile_renderer: true,
        show_grid: true,
        gaussian_dpr: "1x",
      };
      try {
        const response = await getUserSettings();
        fallback = response.data;
      } catch {
        // Viewer preferences remain available if the backend cannot be reached.
      }
      const restored = readEditorSettings(fallback);
      localStorage.setItem(EDITOR_SETTINGS_KEY, JSON.stringify(restored));
      return restored;
    },
  });
  const mutation = useMutation({
    mutationFn: (changes: UserSettingsUpdate) => updateUserSettings(changes),
  });
  const preferences = query.data;
  const value: UserSettingsContextValue = {
    webGpuTileRenderer: preferences?.webgpu_tile_renderer ?? true,
    showGrid: preferences?.show_grid ?? true,
    gaussianDpr: preferences?.gaussian_dpr ?? "1x",
    loading: query.isPending,
    saving: auth.canEdit && mutation.isPending,
    ready: query.isSuccess,
    error: (auth.canEdit ? mutation.error : null) ?? query.error,
    retry: () => {
      void query.refetch();
    },
    save: (changes) => {
      if (!preferences || (auth.canEdit && mutation.isPending)) return;
      const next: UserSettings = { ...preferences, ...changes };
      if (next.webgpu_tile_renderer !== preferences.webgpu_tile_renderer) {
        const reloadWithRenderer = () => {
          // A late editor response must not overwrite newer viewer preferences.
          if (queryClient.getQueryData(key) !== preferences) return;
          localStorage.setItem(EDITOR_SETTINGS_KEY, JSON.stringify(next));
          // Keep the current renderer mounted until a fresh document takes over.
          window.location.reload();
        };
        if (auth.canEdit)
          mutation.mutate(changes, { onSuccess: reloadWithRenderer });
        else reloadWithRenderer();
        return;
      }
      // Viewer preferences survive login/logout and failed backend saves.
      localStorage.setItem(EDITOR_SETTINGS_KEY, JSON.stringify(next));
      queryClient.setQueryData(key, next);
      if (auth.canEdit) mutation.mutate(changes);
    },
  };
  return (
    <UserSettingsContext.Provider value={value}>
      {children}
    </UserSettingsContext.Provider>
  );
}

export function useUserSettings() {
  const context = useContext(UserSettingsContext);
  if (!context) throw new Error("UserSettingsProvider is required");
  return context;
}
