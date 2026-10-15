import { slots } from "@camera-path/feature-scene-models";
import { SlotProvider } from "@camera-path/slots";
import { EditorTestHost } from "@host/testing/editor-host";
import { WorkspaceCommands } from "@host/ui/commands/workspace-commands";
// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCloudPlacement } from "@camera-path/actions";
import { useUserSettings } from "@camera-path/api/settings";

const mutate = vi.hoisted(() => vi.fn());
let showGrid = true;
vi.mock("@camera-path/api/settings", async () => {
  const { useState } = await import("react");
  return {
    useUserSettings: () => {
      const [grid, setGrid] = useState(showGrid);
      return {
        showGrid: grid,
        ready: true,
        saving: false,
        error: null,
        save: (changes: { show_grid: boolean }) => {
          showGrid = changes.show_grid;
          setGrid(changes.show_grid);
        },
      };
    },
  };
});

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
    data: { data: [] },
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
  const toggleGrid = () => settings.save({ show_grid: !settings.showGrid });
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
  showGrid = true;
});

afterEach(() => {
  cleanup();
  mutate.mockClear();
});

describe("project cloud controls", () => {
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
  useAuth: () => ({ canEdit: true }),
}));
