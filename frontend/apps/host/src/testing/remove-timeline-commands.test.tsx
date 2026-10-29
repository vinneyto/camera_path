// @vitest-environment happy-dom
import { forgetProjectRevision } from "@camera-path/api/client/orval-fetch";
import { projectKeys } from "@camera-path/api/project";
import { CommandsProvider } from "@camera-path/commands";
import { Slot, SlotProvider } from "@camera-path/slots";
import { slots as speed } from "@camera-path/feature-speed-track";
import { slots as aim } from "@camera-path/feature-camera-aim";
import { slots as orientation } from "@camera-path/feature-camera-orientation";
import { EditorTestHost } from "./editor-host";
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

const projectId = "remove-timeline-project";
const auth = vi.hoisted(() => ({ canEdit: true }));
vi.mock("@camera-path/api/identity/auth-provider", () => ({
  useAuth: () => auth,
}));
const cases = [
  {
    name: "Speed",
    slots: speed,
    resource: "speed" as const,
    path: "motion",
    defaults: { default_speed: 1, keyframes: {} },
    settings: { default_speed: 3, keyframes: {} },
  },
  {
    name: "Aim",
    slots: aim,
    resource: "aim" as const,
    path: "camera",
    defaults: {
      default_aim: { kind: "follow_path", direction: "forward" },
      world_up: [0, 1, 0],
      keyframes: {},
    },
    settings: {
      default_aim: { kind: "follow_path", direction: "backward" },
      world_up: [0, 0, 1],
      keyframes: {},
    },
  },
  {
    name: "Orientation",
    slots: orientation,
    resource: "orientation" as const,
    path: "camera/orientation",
    defaults: {
      default_orientation: { yaw_deg: 0, pitch_deg: 0, roll_deg: 0 },
      keyframes: {},
    },
    settings: {
      default_orientation: { yaw_deg: 30, pitch_deg: 0, roll_deg: 0 },
      keyframes: {},
    },
  },
];
const clients: QueryClient[] = [];
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  forgetProjectRevision(projectId);
  vi.unstubAllGlobals();
  auth.canEdit = true;
});

function mount(slots: (typeof cases)[number]["slots"]) {
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

it.each(cases)(
  "deletes $name in one request, refreshes the track and compiled playback, and hides removal",
  async (testCase) => {
    let removed = false;
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
          removed
            ? testCase.defaults
            : {
                ...testCase.settings,
                keyframes: { first: { id: "first" }, last: { id: "last" } },
              },
          { headers: { ETag: removed ? '"11"' : '"10"' } },
        );
      }),
    );
    const client = mount(testCase.slots);
    const search = await screen.findByRole("combobox");
    await waitFor(() => expect(client.isFetching()).toBe(0));
    const untouched = [
      projectKeys.anchors(projectId),
      projectKeys.segments(projectId),
      projectKeys.lidar(projectId),
    ];
    for (const key of untouched) client.setQueryData(key, { keep: true });
    client.setQueryData(projectKeys.trajectory(projectId), {
      oldPlayback: true,
    });
    fireEvent.focus(search);
    fireEvent.change(search, { target: { value: "remove" } });
    fireEvent.keyDown(search, { key: "Enter" });
    await waitFor(() =>
      expect(deletes).toEqual([
        `/api/v1/projects/${projectId}/${testCase.path}`,
      ]),
    );
    fireEvent.focus(search);
    expect(
      (
        screen.getByRole("option", {
          name: `${testCase.name}: Remove`,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.keyDown(search, { key: "Enter" });
    expect(deletes).toHaveLength(1);
    await act(async () => {
      removed = true;
      finish(new Response(null, { status: 204, headers: { ETag: '"11"' } }));
    });
    await waitFor(() =>
      expect(
        screen.queryByRole("option", { name: `${testCase.name}: Remove` }),
      ).toBeNull(),
    );
    expect(
      client.getQueryState(projectKeys.trajectory(projectId))?.isInvalidated,
    ).toBe(true);
    for (const key of untouched) {
      expect(client.getQueryData(key)).toEqual({ keep: true });
      expect(client.getQueryState(key)?.isInvalidated).toBe(false);
    }
    cleanup();
    const reopened = mount(testCase.slots);
    await waitFor(() => expect(reopened.isFetching()).toBe(0));
    expect(
      screen.queryByRole("option", { name: `${testCase.name}: Remove` }),
    ).toBeNull();
  },
);

it.each(cases)(
  "offers $name removal for settings without keys and keeps it on server failure",
  async (testCase) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_path: string, options: RequestInit) =>
        options.method === "DELETE"
          ? Response.json({ detail: "Deletion unavailable" }, { status: 503 })
          : Response.json(testCase.settings, { headers: { ETag: '"10"' } }),
      ),
    );
    mount(testCase.slots);
    const search = await screen.findByRole("combobox");
    fireEvent.focus(search);
    await screen.findByRole("option", { name: `${testCase.name}: Remove` });
    fireEvent.keyDown(search, { key: "Enter" });
    await screen.findByText("Deletion unavailable");
    fireEvent.focus(search);
    expect(
      screen.getByRole("option", { name: `${testCase.name}: Remove` }),
    ).toBeTruthy();
  },
);

it.each(cases)(
  "hides $name removal for an empty timeline or read-only access",
  async (testCase) => {
    for (const canEdit of [true, false]) {
      auth.canEdit = canEdit;
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          Response.json(canEdit ? testCase.defaults : testCase.settings, {
            headers: { ETag: '"10"' },
          }),
        ),
      );
      const client = mount(testCase.slots);
      await waitFor(() => expect(client.isFetching()).toBe(0));
      const search = screen.queryByRole("combobox");
      if (search) fireEvent.focus(search);
      expect(
        screen.queryByRole("option", { name: `${testCase.name}: Remove` }),
      ).toBeNull();
      cleanup();
    }
  },
);
