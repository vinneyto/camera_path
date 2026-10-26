// @vitest-environment happy-dom
import { forgetProjectRevision } from "@camera-path/api/client/orval-fetch";
import { projectKeys } from "@camera-path/api/project";
import { CommandsProvider } from "@camera-path/commands";
import { Slot, SlotProvider } from "@camera-path/slots";
import { EditorTestHost } from "@host/testing/editor-host";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { slots } from "../index";

const projectId = "remove-lidar-command-project";
const auth = vi.hoisted(() => ({ canEdit: true }));
vi.mock("@camera-path/api/identity/auth-provider", () => ({
  useAuth: () => auth,
}));
const clients: QueryClient[] = [];
afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.clear();
  forgetProjectRevision(projectId);
  vi.unstubAllGlobals();
  auth.canEdit = true;
});

function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  clients.push(client);
  render(
    <QueryClientProvider client={client}>
      <EditorTestHost projectId={projectId}>
        <SlotProvider features={[slots]}>
          <CommandsProvider>
            <Slot name="project.commands" />
          </CommandsProvider>
        </SlotProvider>
      </EditorTestHost>
    </QueryClientProvider>,
  );
  return client;
}

it("removes LiDAR once with If-Match, refreshes its resource and offers creation again", async () => {
  let enabled = true;
  let finish!: (response: Response) => void;
  const deletes: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string, options: RequestInit) => {
      if (options.method === "DELETE") {
        expect(new Headers(options.headers).get("If-Match")).toBe('"10"');
        deletes.push(path);
        return new Promise<Response>((resolve) => {
          finish = resolve;
        });
      }
      return Response.json(
        { lidar_keyframe: enabled ? { id: "lidar", path_position: 0 } : null },
        { headers: { ETag: enabled ? '"10"' : '"11"' } },
      );
    }),
  );
  const client = mount();
  const untouched = [
    projectKeys.segments(projectId),
    projectKeys.anchors(projectId),
    projectKeys.depthOfField(projectId),
  ];
  for (const key of untouched) client.setQueryData(key, { keep: true });
  const search = await screen.findByRole("combobox");
  fireEvent.focus(search);
  fireEvent.change(search, { target: { value: "remove" } });
  fireEvent.keyDown(search, { key: "Enter" });
  await waitFor(() =>
    expect(deletes).toEqual([`/api/v1/projects/${projectId}/camera/lidar`]),
  );
  fireEvent.focus(search);
  expect(
    (screen.getByRole("option", { name: "LiDAR: Remove" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.keyDown(search, { key: "Enter" });
  expect(deletes).toHaveLength(1);
  await act(async () => {
    enabled = false;
    finish(new Response(null, { status: 204, headers: { ETag: '"11"' } }));
  });
  fireEvent.change(search, { target: { value: "lidar" } });
  fireEvent.focus(search);
  await screen.findByRole("option", { name: "LiDAR: Add" });
  expect(screen.queryByRole("option", { name: "LiDAR: Remove" })).toBeNull();
  for (const key of untouched) {
    expect(client.getQueryData(key)).toEqual({ keep: true });
    expect(client.getQueryState(key)?.isInvalidated).toBe(false);
  }
  cleanup();
  const reopened = mount();
  await waitFor(() => expect(reopened.isFetching()).toBe(0));
  const reopenedSearch = screen.getByRole("combobox");
  fireEvent.focus(reopenedSearch);
  expect(screen.getByRole("option", { name: "LiDAR: Add" })).toBeTruthy();
});

it("keeps LiDAR and exposes a server error when deletion fails", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_path: string, options: RequestInit) =>
      options.method === "DELETE"
        ? Response.json(
            { detail: "LiDAR deletion unavailable" },
            { status: 503 },
          )
        : Response.json(
            { lidar_keyframe: { id: "lidar", path_position: 0 } },
            { headers: { ETag: '"10"' } },
          ),
    ),
  );
  mount();
  const search = await screen.findByRole("combobox");
  fireEvent.focus(search);
  fireEvent.keyDown(search, { key: "Enter" });
  await screen.findByText("LiDAR deletion unavailable");
  fireEvent.focus(search);
  expect(screen.getByRole("option", { name: "LiDAR: Remove" })).toBeTruthy();
});

it.each([
  [false, true],
  [true, false],
])("hides removal when canEdit=%s and enabled=%s", async (canEdit, enabled) => {
  auth.canEdit = canEdit;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json(
        { lidar_keyframe: enabled ? { id: "lidar", path_position: 0 } : null },
        { headers: { ETag: '"10"' } },
      ),
    ),
  );
  const client = mount();
  await waitFor(() => expect(client.isFetching()).toBe(0));
  const search = screen.queryByRole("combobox");
  if (search) fireEvent.focus(search);
  expect(screen.queryByRole("option", { name: "LiDAR: Remove" })).toBeNull();
});
