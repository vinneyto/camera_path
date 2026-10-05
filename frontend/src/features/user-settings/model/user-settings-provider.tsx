"use client";

import { createContext, useContext } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  getGetUserSettingsQueryKey,
  useGetUserSettings,
  useUpdateUserSettings,
} from "@/shared/api/generated/client";
import type { UserSettingsUpdate } from "@/shared/api/generated/model";

interface UserSettingsContextValue {
  webGpuTileRenderer: boolean;
  showGrid: boolean;
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
  const queryClient = useQueryClient();
  const query = useGetUserSettings({ query: { staleTime: Infinity } });
  const mutation = useUpdateUserSettings<Error>({
    mutation: {
      onMutate: async () => {
        // A read started before the save must not overwrite the confirmed result.
        await queryClient.cancelQueries({
          queryKey: getGetUserSettingsQueryKey(),
        });
      },
      onSuccess: (response) => {
        if (response.status === 200) {
          queryClient.setQueryData(getGetUserSettingsQueryKey(), response);
        }
      },
    },
  });

  const value: UserSettingsContextValue = {
    webGpuTileRenderer: query.data?.data.webgpu_tile_renderer ?? true,
    showGrid: query.data?.data.show_grid ?? true,
    loading: query.isPending,
    saving: mutation.isPending,
    ready: query.isSuccess,
    error:
      mutation.error ?? (query.error instanceof Error ? query.error : null),
    retry: () => {
      void query.refetch();
    },
    save: (changes) => {
      if (!query.isSuccess || mutation.isPending) return;
      mutation.mutate({ data: changes });
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
