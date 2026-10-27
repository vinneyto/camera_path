// @vitest-environment happy-dom
import { CommandsProvider } from "@camera-path/commands";
import { Slot, SlotProvider } from "@camera-path/slots";
import { forgetProjectRevision } from "@camera-path/api/client/orval-fetch";
import { trajectoryObjectId } from "@camera-path/types/trajectory-object-id";
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

const auth = vi.hoisted(() => ({ canEdit: true }));
vi.mock("@camera-path/api/identity/auth-provider", () => ({
  useAuth: () => auth,
}));
const clients: QueryClient[] = [];
afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.clear();
  forgetProjectRevision("dof-command-project");
  vi.unstubAllGlobals();
  auth.canEdit = true;
});

function mount(selectedObjectId: string | null = trajectoryObjectId) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  clients.push(client);
  render(
    <QueryClientProvider client={client}>
      <EditorTestHost
        projectId="dof-command-project"
        selectedObjectId={selectedObjectId}
      >
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

it("enables Depth of Field through the shared command palette, blocks duplicate pending requests and removes the command after success", async () => {
  let enabled = false;
  let finish!: (response: Response) => void;
  const writes: { path: string; input: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string, options: RequestInit) => {
      if (options.method === "POST") {
        expect(new Headers(options.headers).get("If-Match")).toBe('"10"');
        writes.push({ path, input: options.body ?? null });
        return new Promise<Response>((resolve) => {
          finish = resolve;
        });
      }
      return Response.json(
        {
          segments: [{ id: "segment" }],
          keyframes: enabled ? { dof: { id: "dof", path_position: 0 } } : {},
        },
        { headers: { ETag: enabled ? '"11"' : '"10"' } },
      );
    }),
  );
  mount();
  const search = await screen.findByRole("combobox");
  fireEvent.focus(search);
  fireEvent.change(search, { target: { value: "dof" } });
  fireEvent.keyDown(search, { key: "Enter" });
  await waitFor(() =>
    expect(writes).toEqual([
      {
        path: "/api/v1/projects/dof-command-project/camera/depth-of-field",
        input: null,
      },
    ]),
  );
  fireEvent.focus(search);
  const option = screen.getByRole("option", {
    name: "Depth of Field: Add",
  }) as HTMLButtonElement;
  expect(option.disabled).toBe(true);
  fireEvent.keyDown(search, { key: "Enter" });
  expect(writes).toHaveLength(1);
  await act(async () => {
    enabled = true;
    finish(
      Response.json(
        { keyframes: { dof: { id: "dof", path_position: 0 } } },
        { headers: { ETag: '"11"' } },
      ),
    );
  });
  fireEvent.focus(search);
  await screen.findByRole("option", { name: "Depth of Field: Remove" });
  expect(
    screen.queryByRole("option", { name: "Depth of Field: Add" }),
  ).toBeNull();
});

it.each([
  [false, false],
  [false, true],
  [true, true],
])(
  "registers no add command when canEdit=%s and alreadyEnabled=%s",
  async (canEdit, alreadyEnabled) => {
    auth.canEdit = canEdit;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            segments: [{ id: "segment" }],
            keyframes: alreadyEnabled
              ? { dof: { id: "dof", path_position: 0 } }
              : {},
          },
          { headers: { ETag: '"10"' } },
        ),
      ),
    );
    const client = mount();
    await waitFor(() => expect(client.isFetching()).toBe(0));
    const search = screen.queryByRole("combobox");
    if (canEdit && alreadyEnabled) {
      expect(search).not.toBeNull();
      fireEvent.focus(search!);
      expect(
        screen.queryByRole("option", { name: "Depth of Field: Add" }),
      ).toBeNull();
      expect(
        screen.getByRole("option", { name: "Depth of Field: Remove" }),
      ).toBeTruthy();
    } else expect(search).toBeNull();
  },
);

it.each([
  [null, true],
  ["anchor", true],
  [trajectoryObjectId, false],
])(
  "hides creation without a selected existing trajectory (%s, %s)",
  async (selected, hasPath) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            segments: hasPath ? [{ id: "segment" }] : [],
            keyframes: {},
          },
          { headers: { ETag: '\"10\"' } },
        ),
      ),
    );
    const client = mount(selected);
    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(screen.queryByRole("combobox")).toBeNull();
  },
);

it("reports a failed creation without adding a local Depth of Field track", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_path: string, options: RequestInit) =>
      options.method === "POST"
        ? Response.json(
            { detail: "Depth of Field creation unavailable" },
            { status: 503 },
          )
        : Response.json(
            { segments: [{ id: "segment" }], keyframes: {} },
            { headers: { ETag: '\"10\"' } },
          ),
    ),
  );
  mount();
  const search = await screen.findByRole("combobox");
  fireEvent.focus(search);
  fireEvent.keyDown(search, { key: "Enter" });
  await screen.findByText("Depth of Field creation unavailable");
  fireEvent.focus(search);
  expect(
    screen.getByRole("option", { name: "Depth of Field: Add" }),
  ).toBeTruthy();
  expect(
    screen.queryByRole("option", { name: "Depth of Field: Remove" }),
  ).toBeNull();
});
