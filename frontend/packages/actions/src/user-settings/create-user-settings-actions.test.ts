// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createUserSettingsStore } from "@camera-path/store";
import {
  getUserSettings,
  updateUserSettings,
} from "@camera-path/api/client/generated/client";
import { createUserSettingsActions } from "./create-user-settings-actions";
import { EDITOR_SETTINGS_KEY } from "./editor-settings-key";

vi.mock("@camera-path/api/client/generated/client", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@camera-path/api/client/generated/client")
  >()),
  getUserSettings: vi.fn(),
  updateUserSettings: vi.fn(),
}));
const server = {
  webgpu_tile_renderer: true,
  show_grid: true,
  gaussian_dpr: "1x" as const,
};
let store: ReturnType<typeof createUserSettingsStore>;
let actions: ReturnType<typeof createUserSettingsActions>;
let reload: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  store = createUserSettingsStore();
  actions = createUserSettingsActions(store);
  vi.mocked(getUserSettings).mockResolvedValue({
    data: server,
    status: 200,
    headers: new Headers(),
  });
  vi.mocked(updateUserSettings).mockResolvedValue({
    data: server,
    status: 200,
    headers: new Headers(),
  });
  reload = vi.spyOn(window.location, "reload").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("restores local viewer values over server defaults and saves locally without a server mutation", async () => {
  localStorage.setItem(
    EDITOR_SETTINGS_KEY,
    JSON.stringify({ show_grid: false, gaussian_dpr: "system" }),
  );
  await actions.load();
  expect(store.getState().userSettings).toMatchObject({
    showGrid: false,
    gaussianDpr: "system",
    ready: true,
    loading: false,
  });
  await actions.save({ show_grid: true });
  expect(store.getState().userSettings.showGrid).toBe(true);
  expect(JSON.parse(localStorage.getItem(EDITOR_SETTINGS_KEY)!)).toMatchObject({
    show_grid: true,
  });
  expect(updateUserSettings).not.toHaveBeenCalled();
});

it("keeps viewer settings available offline and ignores malformed local values", async () => {
  vi.mocked(getUserSettings).mockRejectedValue(new Error("Offline"));
  localStorage.setItem(
    EDITOR_SETTINGS_KEY,
    '{"show_grid":"wrong","gaussian_dpr":"bad"}',
  );
  await actions.load();
  expect(store.getState().userSettings).toMatchObject({
    webGpuTileRenderer: false,
    showGrid: true,
    gaussianDpr: "1x",
    ready: true,
    error: null,
  });
});

it("updates editor preferences optimistically and retains them on a failed backend save", async () => {
  await actions.load();
  actions.setCanEdit(true);
  let reject!: (error: Error) => void;
  vi.mocked(updateUserSettings).mockImplementationOnce(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  const pending = actions.save({ gaussian_dpr: "system" });
  expect(store.getState().userSettings).toMatchObject({
    gaussianDpr: "system",
    saving: true,
  });
  await actions.save({ show_grid: false });
  expect(updateUserSettings).toHaveBeenCalledTimes(1);
  reject(new Error("Save failed"));
  await pending;
  expect(store.getState().userSettings).toMatchObject({
    gaussianDpr: "system",
    saving: false,
    error: new Error("Save failed"),
  });
  expect(JSON.parse(localStorage.getItem(EDITOR_SETTINGS_KEY)!)).toMatchObject({
    gaussian_dpr: "system",
  });
});

it("reloads a viewer renderer change while retaining the mounted renderer state", async () => {
  await actions.load();
  await actions.save({ webgpu_tile_renderer: false });
  expect(reload).toHaveBeenCalledOnce();
  expect(store.getState().userSettings.webGpuTileRenderer).toBe(true);
  expect(JSON.parse(localStorage.getItem(EDITOR_SETTINGS_KEY)!)).toMatchObject({
    webgpu_tile_renderer: false,
  });
  expect(updateUserSettings).not.toHaveBeenCalled();
});

it("waits for editor renderer persistence before reload and does not reload on failure", async () => {
  await actions.load();
  actions.setCanEdit(true);
  let finish!: () => void;
  vi.mocked(updateUserSettings).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = () =>
          resolve({ data: server, status: 200, headers: new Headers() });
      }),
  );
  const pending = actions.save({ webgpu_tile_renderer: false });
  expect(reload).not.toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem(EDITOR_SETTINGS_KEY)!)).toMatchObject({
    webgpu_tile_renderer: true,
  });
  finish();
  await pending;
  expect(reload).toHaveBeenCalledOnce();
  reload.mockClear();
  vi.mocked(updateUserSettings).mockRejectedValueOnce(new Error("Save failed"));
  await actions.save({ webgpu_tile_renderer: false });
  expect(reload).not.toHaveBeenCalled();
  expect(store.getState().userSettings.webGpuTileRenderer).toBe(true);
});

it("ignores late editor renderer responses after logout and newer viewer edits", async () => {
  await actions.load();
  actions.setCanEdit(true);
  let finish!: () => void;
  vi.mocked(updateUserSettings).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = () =>
          resolve({ data: server, status: 200, headers: new Headers() });
      }),
  );
  const pending = actions.save({ webgpu_tile_renderer: false });
  actions.setCanEdit(false);
  expect(store.getState().userSettings.saving).toBe(false);
  await actions.save({ show_grid: false });
  finish();
  await pending;
  expect(reload).not.toHaveBeenCalled();
  expect(store.getState().userSettings).toMatchObject({
    showGrid: false,
    error: null,
  });
  expect(JSON.parse(localStorage.getItem(EDITOR_SETTINGS_KEY)!)).toMatchObject({
    webgpu_tile_renderer: true,
    show_grid: false,
  });
});

it("does not let a refresh overwrite settings edited while it was loading", async () => {
  await actions.load();
  let finish!: () => void;
  vi.mocked(getUserSettings).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = () =>
          resolve({ data: server, status: 200, headers: new Headers() });
      }),
  );
  const pending = actions.retry();
  await actions.save({ show_grid: false });
  finish();
  await pending;
  expect(store.getState().userSettings).toMatchObject({
    showGrid: false,
    loading: false,
    ready: true,
  });
});

it("ignores cancelled loads and permits a fresh Strict Mode setup", async () => {
  let finish!: () => void;
  vi.mocked(getUserSettings).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = () =>
          resolve({
            data: { ...server, show_grid: false },
            status: 200,
            headers: new Headers(),
          });
      }),
  );
  const old = actions.load();
  actions.cancel();
  await actions.load();
  finish();
  await old;
  expect(store.getState().userSettings).toMatchObject({
    showGrid: true,
    loading: false,
    ready: true,
  });
});

it("reports local persistence failures and recovers through retry", async () => {
  const storage = localStorage;
  vi.stubGlobal("localStorage", {
    getItem: () => null,
    setItem: () => {
      throw new Error("Storage unavailable");
    },
  });
  await actions.load();
  expect(store.getState().userSettings).toMatchObject({
    ready: false,
    loading: false,
    error: new Error("Storage unavailable"),
  });
  vi.stubGlobal("localStorage", storage);
  await actions.retry();
  expect(store.getState().userSettings).toMatchObject({
    ready: true,
    error: null,
  });
});

it("starts with Spark and keeps it when a fresh profile finishes loading, without reloading", async () => {
  expect(store.getState().userSettings.webGpuTileRenderer).toBe(false);
  vi.mocked(getUserSettings).mockResolvedValueOnce({
    data: { ...server, webgpu_tile_renderer: false },
    status: 200,
    headers: new Headers(),
  });
  await actions.load();
  expect(store.getState().userSettings).toMatchObject({
    webGpuTileRenderer: false,
    ready: true,
  });
  expect(reload).not.toHaveBeenCalled();
});

it.each([true, false])(
  "preserves the explicit local renderer choice %s over the server fallback",
  async (webgpu) => {
    localStorage.setItem(
      EDITOR_SETTINGS_KEY,
      JSON.stringify({ webgpu_tile_renderer: webgpu }),
    );
    vi.mocked(getUserSettings).mockResolvedValueOnce({
      data: { ...server, webgpu_tile_renderer: !webgpu },
      status: 200,
      headers: new Headers(),
    });
    await actions.load();
    expect(store.getState().userSettings.webGpuTileRenderer).toBe(webgpu);
    expect(reload).not.toHaveBeenCalled();
  },
);

it("preserves an existing server WebGPU preference when no local choice exists", async () => {
  await actions.load();
  expect(store.getState().userSettings.webGpuTileRenderer).toBe(true);
  expect(reload).not.toHaveBeenCalled();
});
