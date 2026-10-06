// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  EditorStoreProvider,
  useCloudPlacement,
  useSceneGrid,
} from "@/features/project-editor";

import { ProjectCloudControls } from "./project-cloud-controls";

const mutate = vi.hoisted(() => vi.fn());
let showGrid = true;
vi.mock("@/features/user-settings", async () => {
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

vi.mock("@/shared/api/generated/client", () => ({
  useListLibraryAssets: () => ({
    data: { data: [{ id: "asset", name: "Mug", status: "ready" }] },
    isPending: false,
    error: null,
  }),
  useListProjectClouds: () => ({
    data: { data: [] },
    isPending: false,
    error: null,
  }),
}));
vi.mock("../api/use-project-cloud-actions", () => ({
  useProjectCloudActions: () => ({ mutate, isPending: false, error: null }),
}));

function PlacementState() {
  const { pendingCloud } = useCloudPlacement();
  const { toggleGrid } = useSceneGrid();
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
      <EditorStoreProvider>
        <ProjectCloudControls projectId="project" />
        <PlacementState />
      </EditorStoreProvider>,
    );
    fireEvent.focus(screen.getByRole("combobox"));
    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["Cloud: Add", "Cloud: Remove", "Grid: Hide"]);
    expect(
      screen.getByRole("option", { name: "Grid: Hide" }).querySelector("svg"),
    ).not.toBeNull();
    openAddCloud();
    expect(screen.getByTestId("pending-cloud").textContent).toBe("Mug");
    expect(mutate).not.toHaveBeenCalled();
  });

  it("starts placement even when the scene is empty and the grid is off", () => {
    render(
      <EditorStoreProvider>
        <ProjectCloudControls projectId="project" />
        <PlacementState />
      </EditorStoreProvider>,
    );
    fireEvent.focus(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "Grid: Hide" }));
    openAddCloud();
    expect(screen.getByTestId("pending-cloud").textContent).toBe("Mug");
    expect(mutate).not.toHaveBeenCalled();
  });
});
