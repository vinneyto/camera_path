import type { CompiledTrajectory } from "@camera-path/contracts/trajectory";
// @vitest-environment happy-dom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import * as data from "@camera-path/contracts/host-data";
import * as requests from "@camera-path/contracts/host-requests";
import type { DataContract } from "@camera-path/contracts/contract-types";
import { HostRuntime } from "@camera-path/extension-api/host-runtime";
import { HostProvider } from "@camera-path/extension-api/host-provider";
import { DataCell } from "@camera-path/extension-api/data-cell";
import { ExtensionProvider } from "@camera-path/extension-api/extension-provider";
import { ExtensionSlot } from "@camera-path/extension-api";
import { EditableProvider } from "@camera-path/ui-kit/editable-provider";
import { extension } from "../extension";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const compiled: CompiledTrajectory = {
  arc_length_table: [],
  camera_track: {
    depth_of_field_keyframes: [],
    default_aim: { kind: "follow_path", direction: "forward" },
    default_orientation: { pitch_deg: 0, roll_deg: 0, yaw_deg: 0 },
    keyframes: [],
    orientation_keyframes: [],
    world_up: [0, 1, 0],
  },
  duration_seconds: 1,
  motion_profile: { default_speed: 1, keyframes: [] },
  position_segments: [],
  project_id: "project",
  revision: 1,
  total_length: 1,
  warnings: [],
};
function bind<T>(
  runtime: HostRuntime,
  contract: DataContract<string, T>,
  value: unknown,
) {
  const cell = new DataCell(contract);
  cell.set(contract.schema.parse(value));
  runtime.bindData(contract, cell.read, cell.subscribe);
  return cell;
}
it("adds and deletes DOF through its host API and reacts to published data without host props", async () => {
  const runtime = new HostRuntime("project", "project");
  bind(runtime, data.projectPermissions, { canEdit: true });
  bind(runtime, data.playbackState, {
    elapsed: 0.5,
    pathPosition: 0.25,
    playing: false,
  });
  bind(runtime, data.scenePoints, []);
  const trajectory = bind(runtime, data.compiledTrajectory, compiled);
  const timeline = bind(runtime, data.depthOfFieldTimeline, { keyframes: {} });
  const add = vi.fn((input: unknown) => {
    expect(input).toEqual({
      path_position: 0.25,
      focus: { kind: "center_weighted_9" },
    });
    trajectory.set({
      ...compiled,
      camera_track: {
        ...compiled.camera_track,
        depth_of_field_keyframes: [
          {
            id: "dof",
            path_position: 0.25,
            focus: { kind: "center_weighted_9" },
            focus_range_scale: 0.1,
            bokeh_scale: 1,
          },
        ],
      },
    });
    timeline.set({
      keyframes: {
        dof: {
          id: "dof",
          path_position: 0.25,
          focus: { kind: "center_weighted_9" },
          focus_range_scale: 0.1,
          bokeh_scale: 1,
        },
      },
    });
  });
  const remove = vi.fn((id: string) => {
    expect(id).toBe("dof");
    trajectory.set(data.compiledTrajectory.schema.parse(compiled));
    timeline.set({ keyframes: {} });
  });
  runtime.bindRequest(requests.addDepthOfFieldKeyframe, add);
  runtime.bindRequest(requests.deleteDepthOfFieldKeyframe, remove);
  vi.stubGlobal(
    "confirm",
    vi.fn(() => true),
  );
  const mounted = render(
    <HostProvider runtime={runtime}>
      <ExtensionProvider extensions={[extension]}>
        <EditableProvider editable>
          <ExtensionSlot name="timeline.effects" />
          <ExtensionSlot name="timeline.tracks" />
        </EditableProvider>
      </ExtensionProvider>
    </HostProvider>,
  );
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Depth of Field" })),
  );
  expect(add).toHaveBeenCalledOnce();
  await waitFor(() => expect(screen.getByText("Depth of field")).toBeTruthy());
  const key = screen.getByRole("button", { name: /Nine-point autofocus/ });
  fireEvent.contextMenu(key);
  await act(async () =>
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Delete depth of field keyframe" }),
    ),
  );
  expect(remove).toHaveBeenCalledOnce();
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Depth of Field" })).toBeTruthy(),
  );
  mounted.unmount();
  runtime.dispose();
});
it("keeps mutation errors inside the contribution", async () => {
  const runtime = new HostRuntime("project", "project");
  bind(runtime, data.projectPermissions, { canEdit: true });
  bind(runtime, data.playbackState, {
    elapsed: 0,
    pathPosition: 0,
    playing: false,
  });
  bind(runtime, data.depthOfFieldTimeline, { keyframes: {} });
  runtime.bindRequest(requests.addDepthOfFieldKeyframe, () => {
    throw Error("Save failed");
  });
  render(
    <HostProvider runtime={runtime}>
      <ExtensionProvider extensions={[extension]}>
        <ExtensionSlot name="timeline.effects" />
      </ExtensionProvider>
    </HostProvider>,
  );
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Depth of Field" })),
  );
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    "Save failed",
  );
  cleanup();
  runtime.dispose();
});
