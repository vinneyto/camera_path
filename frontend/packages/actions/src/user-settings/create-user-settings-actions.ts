import {
  getUserSettings,
  updateUserSettings,
} from "@camera-path/api/client/generated/client";
import type {
  UserSettingsState,
  UserSettingsStoreApi,
} from "@camera-path/store";
import type { UserSettings, UserSettingsUpdate } from "@camera-path/types/api";
import { EDITOR_SETTINGS_KEY } from "./editor-settings-key";
import { readEditorSettings } from "./read-editor-settings";

/** Persistence, mutation status and renderer reloads belong to actions, not selectors. */
export function createUserSettingsActions(store: UserSettingsStoreApi) {
  let canEdit = false;
  let authVersion = 0;
  let editVersion = 0;
  let loadVersion = 0;
  let pendingSaves = 0;
  let loadError: Error | null = null;
  let saveError: Error | null = null;

  function patch(changes: Partial<UserSettingsState["userSettings"]>) {
    store.setState((state) => ({
      userSettings: { ...state.userSettings, ...changes },
    }));
  }
  function status() {
    patch({
      saving: canEdit && pendingSaves > 0,
      error: saveError ?? loadError,
    });
  }
  function preferences(): UserSettings {
    const state = store.getState().userSettings;
    return {
      webgpu_tile_renderer: state.webGpuTileRenderer,
      show_grid: state.showGrid,
      gaussian_dpr: state.gaussianDpr,
    };
  }
  function apply(value: UserSettings) {
    patch({
      webGpuTileRenderer: value.webgpu_tile_renderer ?? false,
      showGrid: value.show_grid ?? true,
      gaussianDpr: value.gaussian_dpr ?? "1x",
    });
  }
  function failure(error: unknown) {
    return error instanceof Error
      ? error
      : new Error("Could not save user settings");
  }
  async function load() {
    const request = ++loadVersion;
    const version = editVersion;
    loadError = null;
    patch({ loading: true });
    status();
    try {
      let fallback: UserSettings = {
        webgpu_tile_renderer: false,
        show_grid: true,
        gaussian_dpr: "1x",
      };
      try {
        fallback = (await getUserSettings()).data;
      } catch {
        /* Offline viewers can still restore their local preferences. */
      }
      if (request !== loadVersion) return;
      if (version === editVersion) {
        const restored = readEditorSettings(fallback);
        localStorage.setItem(EDITOR_SETTINGS_KEY, JSON.stringify(restored));
        apply(restored);
      }
      patch({ loading: false, ready: true });
    } catch (error) {
      if (request !== loadVersion) return;
      loadError = failure(error);
      patch({ loading: false });
    }
    if (request === loadVersion) status();
  }
  async function save(changes: UserSettingsUpdate) {
    if (!store.getState().userSettings.ready || (canEdit && pendingSaves > 0))
      return;
    const previous = preferences();
    const next: UserSettings = { ...previous, ...changes };
    const version = ++editVersion;
    const session = authVersion;
    const editor = canEdit;
    const rendererChanged =
      next.webgpu_tile_renderer !== previous.webgpu_tile_renderer;
    saveError = null;
    if (editor) pendingSaves++;
    status();
    try {
      if (!rendererChanged) {
        localStorage.setItem(EDITOR_SETTINGS_KEY, JSON.stringify(next));
        apply(next);
      }
      if (editor) await updateUserSettings(changes);
      // Late editor responses cannot overwrite viewer edits or reload a new session.
      if (version !== editVersion || session !== authVersion) return;
      if (rendererChanged) {
        localStorage.setItem(EDITOR_SETTINGS_KEY, JSON.stringify(next));
        // Keep the old renderer mounted until the fresh document takes over.
        window.location.reload();
      }
    } catch (error) {
      if (version === editVersion && session === authVersion)
        saveError = failure(error);
    } finally {
      if (editor) pendingSaves--;
      status();
    }
  }
  return {
    load,
    retry: load,
    save,
    setCanEdit(value: boolean) {
      if (value !== canEdit) {
        canEdit = value;
        authVersion++;
        saveError = null;
      }
      status();
    },
    cancel() {
      loadVersion++;
      editVersion++;
    },
  };
}
export type UserSettingsActions = ReturnType<typeof createUserSettingsActions>;
