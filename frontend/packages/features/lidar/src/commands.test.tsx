// @vitest-environment happy-dom
import { CommandsProvider } from "@camera-path/commands";
import { Slot, SlotProvider } from "@camera-path/slots";
import { forgetProjectRevision } from "@camera-path/api/client/orval-fetch";
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
import { slots } from ".";

const auth = vi.hoisted(() => ({ canEdit: true }));
vi.mock("@camera-path/api/identity/auth-provider", () => ({
  useAuth: () => auth,
}));
const clients: QueryClient[] = [];
afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.clear();
  forgetProjectRevision("lidar-command-project");
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
      <EditorTestHost projectId="lidar-command-project">
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

it("enables LiDAR through the shared command palette, blocks duplicate pending requests and removes the command after success", async () => {
  let enabled = false;
  let finish!: (response: Response) => void;
  const writes: { path: string; input: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string, options: RequestInit) => {
      if (options.method === "PATCH") {
        expect(new Headers(options.headers).get("If-Match")).toBe('"10"');
        writes.push({ path, input: JSON.parse(options.body as string) });
        return new Promise<Response>((resolve) => {
          finish = resolve;
        });
      }
      return Response.json(
        { lidar_keyframe: enabled ? { id: "lidar", path_position: 0 } : null },
        { headers: { ETag: enabled ? '"11"' : '"10"' } },
      );
    }),
  );
  mount();
  const search = await screen.findByRole("combobox");
  fireEvent.focus(search);
  fireEvent.change(search, { target: { value: "lidar" } });
  fireEvent.keyDown(search, { key: "Enter" });
  await waitFor(() =>
    expect(writes).toEqual([
      {
        path: "/api/v1/projects/lidar-command-project/camera/lidar",
        input: {},
      },
    ]),
  );
  fireEvent.focus(search);
  const option = screen.getByRole("option", {
    name: "LiDAR: Add",
  }) as HTMLButtonElement;
  expect(option.disabled).toBe(true);
  fireEvent.keyDown(search, { key: "Enter" });
  expect(writes).toHaveLength(1);
  await act(async () => {
    enabled = true;
    finish(
      Response.json(
        { lidar_keyframe: { id: "lidar", path_position: 0 } },
        { headers: { ETag: '"11"' } },
      ),
    );
  });
  await waitFor(() => expect(screen.queryByRole("combobox")).toBeNull());
});

it.each([
  [false, false],
  [false, true],
  [true, true],
])(
  "registers no LiDAR command when canEdit=%s and alreadyEnabled=%s",
  async (canEdit, alreadyEnabled) => {
    auth.canEdit = canEdit;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            lidar_keyframe: alreadyEnabled
              ? { id: "lidar", path_position: 0 }
              : null,
          },
          { headers: { ETag: '"10"' } },
        ),
      ),
    );
    const client = mount();
    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(screen.queryByRole("combobox")).toBeNull();
  },
);
