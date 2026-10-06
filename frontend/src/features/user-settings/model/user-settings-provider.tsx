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
  canEdit: boolean;
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
  const mode = auth.canEdit ? "editor" : "guest";
  const key = ["profile-settings", mode];
  const query = useQuery({
    queryKey: key,
    enabled: !auth.loading,
    // Guest profile is read again on every transition (including logout/expiry).
    staleTime: 0,
    queryFn: async () => {
      const response = await getUserSettings();
      if (mode === "editor") {
        const restored = readEditorSettings(response.data);
        localStorage.setItem(EDITOR_SETTINGS_KEY, JSON.stringify(restored));
        return restored;
      }
      return response.data;
    },
  });
  const mutation = useMutation({
    mutationFn: (changes: UserSettingsUpdate) => updateUserSettings(changes),
    onSuccess: () => {
      // A late editor save cannot replace guest values after logout.
      void queryClient.invalidateQueries({
        queryKey: ["profile-settings", "guest"],
      });
    },
  });
  const preferences = query.data;
  const value: UserSettingsContextValue = {
    webGpuTileRenderer: preferences?.webgpu_tile_renderer ?? true,
    showGrid: preferences?.show_grid ?? true,
    gaussianDpr: preferences?.gaussian_dpr ?? "1x",
    loading: auth.loading || query.isPending,
    saving: mutation.isPending,
    ready: query.isSuccess,
    canEdit: auth.canEdit,
    error: (auth.canEdit ? mutation.error : null) ?? query.error,
    retry: () => {
      void query.refetch();
    },
    save: (changes) => {
      if (!auth.canEdit || !preferences || mutation.isPending) return;
      const next: UserSettings = { ...preferences, ...changes };
      // Editor UI state is always persisted locally, even if backend save fails.
      localStorage.setItem(EDITOR_SETTINGS_KEY, JSON.stringify(next));
      queryClient.setQueryData(key, next);
      mutation.mutate(changes);
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
