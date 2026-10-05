// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSceneGrid } from "@/features/project-editor";
import {
  UserSettingsProvider,
  useUserSettings,
} from "../model/user-settings-provider";
import { UserSettingsPanel } from "./user-settings-panel";

let persisted = { webgpu_tile_renderer: true, show_grid: true };
let failRead = false;
let failWrite = false;
let finishWrite: (() => void) | undefined;
let holdWrite = false;
const patches: unknown[] = [];

function ScenePreference({ name }: { name: string }) {
  const { webGpuTileRenderer } = useUserSettings();
  const grid = useSceneGrid();
  return (
    <div>
      <span data-testid={name}>{`${webGpuTileRenderer}/${grid.showGrid}`}</span>
      <button onClick={grid.toggleGrid} disabled={!grid.ready || grid.saving}>
        Toggle grid {name}
      </button>
    </div>
  );
}

function mount() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <UserSettingsProvider>
        <UserSettingsPanel />
        <ScenePreference name="project-a" />
        <ScenePreference name="project-b" />
      </UserSettingsProvider>
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Profile settings" }));
  return { ...result, queryClient };
}

beforeEach(() => {
  persisted = { webgpu_tile_renderer: true, show_grid: true };
  failRead = false;
  failWrite = false;
  holdWrite = false;
  finishWrite = undefined;
  patches.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, options: RequestInit) => {
      if (options.method === "PATCH") {
        const patch = JSON.parse(options.body as string);
        patches.push(patch);
        if (holdWrite)
          await new Promise<void>((resolve) => {
            finishWrite = resolve;
          });
        if (failWrite)
          return Response.json({ detail: "Save failed" }, { status: 500 });
        persisted = { ...persisted, ...patch };
      } else if (failRead)
        return Response.json({ detail: "Load failed" }, { status: 500 });
      return Response.json(persisted);
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("server profile settings", () => {
  it("restores both server preferences and ignores old localStorage", async () => {
    persisted = { webgpu_tile_renderer: false, show_grid: false };
    localStorage.setItem(
      "camera-path-gaussian-rendering-settings",
      JSON.stringify({ state: { webGpuTileRenderer: true } }),
    );
    mount();
    expect(screen.getByRole("status").textContent).toBe("Loading settings…");
    await waitFor(() =>
      expect(screen.getByTestId("project-a").textContent).toBe("false/false"),
    );
    const boxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    expect(boxes.every((box) => !box.checked && !box.disabled)).toBe(true);
  });

  it("shares confirmed saves with all projects, blocks pending edits, and reloads in a new client", async () => {
    holdWrite = true;
    const first = mount();
    const renderer = screen.getByRole("checkbox", {
      name: "WebGPU tile renderer (experimental)",
    }) as HTMLInputElement;
    await waitFor(() => expect(renderer.disabled).toBe(false));
    expect(renderer.checked).toBe(true);
    fireEvent.click(renderer);
    await screen.findByText("Saving…");
    expect(renderer.disabled).toBe(true);
    expect(screen.getByTestId("project-b").textContent).toBe("true/true");
    await waitFor(() => expect(finishWrite).toBeDefined());
    await act(async () => {
      finishWrite!();
    });
    await waitFor(() =>
      expect(screen.getByTestId("project-b").textContent).toBe("false/true"),
    );
    expect(patches).toEqual([{ webgpu_tile_renderer: false }]);
    holdWrite = false;
    fireEvent.click(
      screen.getByRole("button", { name: "Toggle grid project-a" }),
    );
    await waitFor(() =>
      expect(screen.getByTestId("project-b").textContent).toBe("false/false"),
    );
    first.unmount();
    first.queryClient.clear();
    mount();
    await waitFor(() =>
      expect(screen.getByTestId("project-a").textContent).toBe("false/false"),
    );
    expect(
      localStorage.getItem("camera-path-gaussian-rendering-settings"),
    ).toBeNull();
  });

  it("keeps confirmed settings after a failed save and allows another attempt", async () => {
    mount();
    const grid = screen.getByRole("checkbox", {
      name: "Show grid",
    }) as HTMLInputElement;
    await waitFor(() => expect(grid.disabled).toBe(false));
    failWrite = true;
    fireEvent.click(grid);
    expect((await screen.findByRole("alert")).textContent).toBe("Save failed");
    expect(grid.checked).toBe(true);
    expect(screen.getByTestId("project-b").textContent).toBe("true/true");
    failWrite = false;
    fireEvent.click(grid);
    await waitFor(() => expect(grid.checked).toBe(false));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows load errors and retries before enabling edits", async () => {
    failRead = true;
    mount();
    expect((await screen.findByRole("alert")).textContent).toBe("Load failed");
    expect(
      (screen.getByRole("checkbox", { name: "Show grid" }) as HTMLInputElement)
        .disabled,
    ).toBe(true);
    failRead = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() =>
      expect(
        (
          screen.getByRole("checkbox", {
            name: "Show grid",
          }) as HTMLInputElement
        ).disabled,
      ).toBe(false),
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
