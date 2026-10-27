import { createStore, type StoreApi } from "zustand/vanilla";

export interface UserSettingsState {
  userSettings: {
    webGpuTileRenderer: boolean;
    showGrid: boolean;
    gaussianDpr: "1x" | "system";
    loading: boolean;
    saving: boolean;
    ready: boolean;
    error: Error | null;
  };
}
export type UserSettingsStoreApi = StoreApi<UserSettingsState>;

/** Application lifetime: preferences must survive switching project stores. */
export function createUserSettingsStore(): UserSettingsStoreApi {
  return createStore<UserSettingsState>(() => ({
    userSettings: {
      webGpuTileRenderer: false,
      showGrid: true,
      gaussianDpr: "1x",
      loading: true,
      saving: false,
      ready: false,
      error: null,
    },
  }));
}
