// @vitest-environment happy-dom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useUserSettings } from "@camera-path/store";
import {
  getUserSettings,
  updateUserSettings,
} from "@camera-path/api/client/generated/client";
import { GridSettings } from "@camera-path/feature-scene-grid/ui/grid-settings";
import { RendererSettings } from "@camera-path/feature-renderer-preferences/ui/renderer-settings";
import { ProjectProviders } from "./project-providers";
import { UserSettingsProvider } from "./user-settings-provider";

let canEdit = false;
vi.mock("@camera-path/api/identity/auth-provider", () => ({
  useAuth: () => ({ canEdit }),
}));
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
beforeEach(() => {
  canEdit = false;
  localStorage.clear();
  vi.clearAllMocks();
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
});
afterEach(cleanup);

function ReadSettings() {
  const settings = useUserSettings();
  return (
    <output>
      {settings.showGrid ? "grid-on" : "grid-off"}:{settings.gaussianDpr}:
      {"save" in settings ? "has-actions" : "data-only"}
    </output>
  );
}

it("connects feature controls to a read-only selector and actions, across project switches and login/logout", async () => {
  const tree = (projectId: string) => (
    <StrictMode>
      <UserSettingsProvider>
        <GridSettings />
        <RendererSettings />
        <ProjectProviders key={projectId} projectId={projectId}>
          <ReadSettings />
        </ProjectProviders>
      </UserSettingsProvider>
    </StrictMode>
  );
  const view = render(tree("one"));
  const grid = screen.getByRole("checkbox", { name: "Show grid" });
  await waitFor(() => expect((grid as HTMLInputElement).disabled).toBe(false));
  fireEvent.click(grid);
  expect(screen.getByText("grid-off:1x:data-only")).toBeTruthy();
  expect(updateUserSettings).not.toHaveBeenCalled();
  const loads = vi.mocked(getUserSettings).mock.calls.length;
  view.rerender(tree("two"));
  expect(screen.getByText("grid-off:1x:data-only")).toBeTruthy();
  expect(getUserSettings).toHaveBeenCalledTimes(loads);
  canEdit = true;
  view.rerender(tree("two"));
  fireEvent.change(screen.getByRole("combobox", { name: "Gaussian DPR" }), {
    target: { value: "system" },
  });
  await waitFor(() =>
    expect(updateUserSettings).toHaveBeenCalledExactlyOnceWith({
      gaussian_dpr: "system",
    }),
  );
  await act(async () => {});
  expect(screen.getByText("grid-off:system:data-only")).toBeTruthy();
  canEdit = false;
  view.rerender(tree("two"));
  fireEvent.click(grid);
  expect(screen.getByText("grid-on:system:data-only")).toBeTruthy();
  expect(updateUserSettings).toHaveBeenCalledTimes(1);
});
