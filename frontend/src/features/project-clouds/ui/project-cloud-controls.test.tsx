// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  EditorStoreProvider,
  useCloudPlacement,
  useSceneGrid,
} from "@/features/project-editor";

import { ProjectCloudControls } from "./project-cloud-controls";

const mutate = vi.hoisted(() => vi.fn());

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
      screen.getByRole("option", { name: "Grid: Hide" }).querySelector("svg"),
    ).not.toBeNull();
    openAddCloud();
    expect(screen.getByTestId("pending-cloud").textContent).toBe("Mug");
    expect(mutate).not.toHaveBeenCalled();
  });

  it("adds the first cloud at the origin when the grid is off", () => {
    render(
      <EditorStoreProvider>
        <ProjectCloudControls projectId="project" />
        <PlacementState />
      </EditorStoreProvider>,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Toggle grid in test" }),
    );
    openAddCloud();
    expect(screen.getByTestId("pending-cloud").textContent).toBe("none");
    expect(mutate).toHaveBeenCalledExactlyOnceWith({
      type: "add",
      assetId: "asset",
    });
  });
});
