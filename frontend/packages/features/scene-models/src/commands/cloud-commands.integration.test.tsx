import { slots } from "@camera-path/feature-scene-models";
import { SlotProvider } from "@camera-path/slots";
import { EditorTestHost } from "@host/testing/editor-host";
import { WorkspaceCommands } from "@host/ui/commands/workspace-commands";
// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  useCloudPlacement,
  useUserSettingsActions,
} from "@camera-path/actions";
import { useUserSettings } from "@camera-path/store";

const mutate = vi.hoisted(() => vi.fn());
let canEdit = true;
let clouds: { id: string; name: string }[] = [];
vi.mock("@camera-path/api/resources", () => ({
  useLibraryCatalog: () => ({
    data: {
      data: [
        {
          id: "asset",
          name: "Mug",
          status: "ready",
          format: "ply",
          size_bytes: 10,
          created_at: "now",
          default_rotation_deg: [0, 0, 0],
          default_scale: 1,
          default_offset: [0, 0, 0],
        },
      ],
    },
    isPending: false,
    error: null,
  }),
  useSceneModels: () => ({
    data: { data: clouds },
    isPending: false,
    error: null,
  }),
}));
vi.mock("@camera-path/actions", async (importOriginal) => ({
  ...(await importOriginal()),
  useProjectCloudActionMutation: () => ({
    mutate,
    isPending: false,
    error: null,
  }),
}));

function PlacementState() {
  const { pendingCloud } = useCloudPlacement();
  const settings = useUserSettings();
  const actions = useUserSettingsActions();
  const toggleGrid = () => actions.save({ show_grid: !settings.showGrid });
  return (
    <>
      <button onClick={toggleGrid} type="button">
        Toggle grid in test
      </button>
      <span data-testid="pending-cloud">{pendingCloud?.name ?? "none"}</span>
    </>
  );
}

function openAddCloud() {
  const search = screen.getByRole("combobox");
  fireEvent.focus(search);
  fireEvent.click(screen.getByRole("option", { name: "Cloud: Add" }));
  fireEvent.click(screen.getByRole("option", { name: "Mug" }));
}

beforeEach(() => {
  canEdit = true;
  clouds = [];
});

afterEach(() => {
  cleanup();
  mutate.mockClear();
});

describe("project cloud commands", () => {
  it("removes the selected instance through its independent command", () => {
    clouds = [{ id: "cloud-a", name: "Mug" }];
    render(
      <EditorTestHost>
        <SlotProvider features={[slots]}>
          <WorkspaceCommands />
        </SlotProvider>
      </EditorTestHost>,
    );
    fireEvent.focus(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "Cloud: Remove" }));
    fireEvent.click(screen.getByRole("option", { name: "Mug · 1 · cloud-a" }));
    expect(mutate).toHaveBeenCalledExactlyOnceWith({
      type: "remove",
      cloudId: "cloud-a",
    });
  });
  it("removes commands when edit access is lost", () => {
    const view = (
      <EditorTestHost>
        <SlotProvider features={[slots]}>
          <WorkspaceCommands />
        </SlotProvider>
      </EditorTestHost>
    );
    const { rerender } = render(view);
    expect(screen.getByRole("combobox")).toBeTruthy();
    canEdit = false;
    rerender(
      <EditorTestHost>
        <SlotProvider features={[slots]}>
          <WorkspaceCommands />
        </SlotProvider>
      </EditorTestHost>,
    );
    expect(screen.queryByRole("combobox")).toBeNull();
  });
  it("places the first cloud on the enabled grid", () => {
    render(
      <EditorTestHost>
        <>
          <SlotProvider features={[slots]}>
            <WorkspaceCommands />
          </SlotProvider>
          <PlacementState />
        </>
      </EditorTestHost>,
    );
    fireEvent.focus(screen.getByRole("combobox"));
    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["Cloud: Add", "Cloud: Remove"]);
    openAddCloud();
    expect(screen.getByTestId("pending-cloud").textContent).toBe("Mug");
    expect(mutate).not.toHaveBeenCalled();
  });

  it("starts placement even when the scene is empty and the grid is off", () => {
    render(
      <EditorTestHost>
        <>
          <SlotProvider features={[slots]}>
            <WorkspaceCommands />
          </SlotProvider>
          <PlacementState />
        </>
      </EditorTestHost>,
    );
    fireEvent.focus(screen.getByRole("combobox"));
    fireEvent.click(
      screen.getByRole("button", { name: "Toggle grid in test" }),
    );
    openAddCloud();
    expect(screen.getByTestId("pending-cloud").textContent).toBe("Mug");
    expect(mutate).not.toHaveBeenCalled();
  });
});

vi.mock("@camera-path/api/identity/auth-provider", () => ({
  useAuth: () => ({ canEdit }),
}));
