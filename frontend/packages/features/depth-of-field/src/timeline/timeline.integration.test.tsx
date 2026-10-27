// @vitest-environment happy-dom
import {
  createEditorActions,
  EditorActionsProvider,
} from "@camera-path/actions";
import { CommandsProvider } from "@camera-path/commands";
import { Slot, SlotProvider } from "@camera-path/slots";
import {
  createEditorStore,
  EditorStoreProvider,
  ResourceScopeProvider,
} from "@camera-path/store";
import type {
  CompiledDepthOfFieldKeyframe,
  CompiledTrajectory,
} from "@camera-path/types/trajectory";
import { EditableProvider } from "@camera-path/ui-kit/editable-provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { slots } from "../index";
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
const auth = vi.hoisted(() => ({ canEdit: true }));
vi.mock("@camera-path/api/identity/auth-provider", () => ({
  useAuth: () => auth,
}));
const clients: QueryClient[] = [];
afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.clear();
  vi.unstubAllGlobals();
  auth.canEdit = true;
});
function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  clients.push(client);
  function Harness() {
    const [store] = useState(() => {
      const store = createEditorStore();
      createEditorActions(store).setPlaybackFrame({
        pathPosition: 0.25,
        elapsed: 0.5,
      });
      return store;
    });
    const [actions] = useState(() => createEditorActions(store));
    return (
      <QueryClientProvider client={client}>
        <ResourceScopeProvider projectId="project">
          <EditorStoreProvider store={store}>
            <EditorActionsProvider actions={actions}>
              <EditableProvider editable={auth.canEdit}>
                <SlotProvider features={[slots]}>
                  <CommandsProvider>
                    <Slot name="project.commands" />
                  </CommandsProvider>
                  <Slot name="timeline.tracks" />
                </SlotProvider>
              </EditableProvider>
            </EditorActionsProvider>
          </EditorStoreProvider>
        </ResourceScopeProvider>
      </QueryClientProvider>
    );
  }
  return render(<Harness />);
}
it("adds and deletes a keyframe through the real shared client/cache using feature commands without host props", async () => {
  let key: CompiledDepthOfFieldKeyframe | null = null,
    revision = 1;
  const writes: { method: string; path: string; input: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string, options: RequestInit) => {
      const method = options.method ?? "GET";
      if (method !== "GET") {
        expect(new Headers(options.headers).get("If-Match")).toBe(
          `"${revision}"`,
        );
        const input = options.body ? JSON.parse(options.body as string) : null;
        writes.push({ method, path, input });
        key =
          method === "POST"
            ? { id: "dof", ...input, focus_range_scale: 0.1, bokeh_scale: 1 }
            : null;
        revision++;
        return method === "POST"
          ? Response.json(key, {
              status: 201,
              headers: { ETag: `"${revision}"` },
            })
          : new Response(null, {
              status: 204,
              headers: { ETag: `"${revision}"` },
            });
      }
      const data = path.endsWith("/compiled")
        ? {
            ...compiled,
            revision,
            camera_track: {
              ...compiled.camera_track,
              depth_of_field_keyframes: key ? [key] : [],
            },
          }
        : path.endsWith("/depth-of-field")
          ? { keyframes: key ? { dof: key } : {} }
          : [];
      return Response.json(data, { headers: { ETag: `"${revision}"` } });
    }),
  );
  vi.stubGlobal(
    "confirm",
    vi.fn(() => true),
  );
  mount();
  fireEvent.focus(await screen.findByRole("combobox"));
  fireEvent.click(
    await screen.findByRole("option", { name: "Depth of Field: Add" }),
  );
  const marker = await screen.findByRole("button", {
    name: /Nine-point autofocus/,
  });
  fireEvent.focus(screen.getByRole("combobox"));
  expect(
    await screen.findByRole("option", { name: "Depth of Field: Remove" }),
  ).toBeTruthy();
  expect(
    screen.queryByRole("option", { name: "Depth of Field: Add" }),
  ).toBeNull();
  fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
  expect(writes[0]).toEqual({
    method: "POST",
    path: "/api/v1/projects/project/camera/depth-of-field/keyframes",
    input: { path_position: 0.25, focus: { kind: "center_weighted_9" } },
  });
  fireEvent.contextMenu(marker);
  fireEvent.click(
    await screen.findByRole("menuitem", {
      name: "Delete depth of field keyframe",
    }),
  );
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: /Nine-point autofocus/ }),
    ).toBeNull(),
  );
  expect(writes[1]).toEqual({
    method: "DELETE",
    path: "/api/v1/projects/project/camera/depth-of-field/keyframes/dof",
    input: null,
  });
  await screen.findByRole("combobox");
});
it("shows action errors in the palette and registers no commands for a viewer", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string, options: RequestInit) =>
      options.method === "POST"
        ? Response.json({ detail: "Save failed" }, { status: 500 })
        : Response.json(
            path.endsWith("/compiled")
              ? compiled
              : path.endsWith("/scene-points")
                ? []
                : { keyframes: {} },
            { headers: { ETag: '"10"' } },
          ),
    ),
  );
  const view = mount();
  fireEvent.focus(await screen.findByRole("combobox"));
  fireEvent.click(
    await screen.findByRole("option", { name: "Depth of Field: Add" }),
  );
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    "Save failed",
  );
  view.unmount();
  auth.canEdit = false;
  await act(async () => {
    mount();
  });
  expect(screen.queryByRole("combobox")).toBeNull();
});
