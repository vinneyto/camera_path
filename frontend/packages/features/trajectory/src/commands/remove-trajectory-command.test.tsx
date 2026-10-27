// @vitest-environment happy-dom
import {
  createEditorActions,
  EditorActionsProvider,
} from "@camera-path/actions";
import { forgetProjectRevision } from "@camera-path/api/client/orval-fetch";
import { CommandsProvider } from "@camera-path/commands";
import { Slot, SlotProvider } from "@camera-path/slots";
import {
  createEditorStore,
  EditorStoreProvider,
  ResourceScopeProvider,
} from "@camera-path/store";
import { trajectoryObjectId } from "@camera-path/types/trajectory-object-id";
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

const projectId = "trajectory-command-project";
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

function mount(selected: string | null = trajectoryObjectId) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  clients.push(client);
  const store = createEditorStore();
  const actions = createEditorActions(store);
  actions.selectObject({ id: selected });
  actions.hoverObject({ id: trajectoryObjectId });
  actions.setPlaying(true);
  actions.setPlaybackFrame({ pathPosition: 0.5, elapsed: 2 });
  render(
    <QueryClientProvider client={client}>
      <ResourceScopeProvider projectId={projectId}>
        <EditorStoreProvider store={store}>
          <EditorActionsProvider actions={actions}>
            <SlotProvider features={[slots]}>
              <CommandsProvider>
                <Slot name="project.commands" />
              </CommandsProvider>
            </SlotProvider>
          </EditorActionsProvider>
        </EditorStoreProvider>
      </ResourceScopeProvider>
    </QueryClientProvider>,
  );
  return { client, store };
}

it("deletes the selected trajectory once through the real API and resets playback and selection", async () => {
  let exists = true;
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
        { segments: exists ? [{ id: "segment" }] : [] },
        { headers: { ETag: exists ? '"10"' : '"11"' } },
      );
    }),
  );
  const { store } = mount();
  const search = await screen.findByRole("combobox");
  fireEvent.focus(search);
  fireEvent.change(search, { target: { value: "trajectory" } });
  fireEvent.keyDown(search, { key: "Enter" });
  await waitFor(() =>
    expect(deletes).toEqual([`/api/v1/projects/${projectId}/trajectory`]),
  );
  fireEvent.focus(search);
  expect(
    (
      screen.getByRole("option", {
        name: "Trajectory: Remove",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  fireEvent.keyDown(search, { key: "Enter" });
  expect(deletes).toHaveLength(1);
  await act(async () => {
    exists = false;
    finish(new Response(null, { status: 204, headers: { ETag: '"11"' } }));
  });
  await waitFor(() => expect(screen.queryByRole("combobox")).toBeNull());
  expect(store.getState().sceneInteraction).toEqual({
    hoveredObjectId: null,
    selectedObjectId: null,
  });
  expect(store.getState().playback).toEqual({
    playing: false,
    elapsed: 0,
    pathPosition: 0,
  });
  cleanup();
  const reopened = mount();
  await waitFor(() => expect(reopened.client.isFetching()).toBe(0));
  expect(screen.queryByRole("combobox")).toBeNull();
});

it("keeps the trajectory selected and shows an API error when deletion fails", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_path: string, options: RequestInit) =>
      options.method === "DELETE"
        ? Response.json({ detail: "Deletion unavailable" }, { status: 503 })
        : Response.json(
            { segments: [{ id: "segment" }] },
            { headers: { ETag: '"10"' } },
          ),
    ),
  );
  const { store } = mount();
  const search = await screen.findByRole("combobox");
  fireEvent.focus(search);
  fireEvent.keyDown(search, { key: "Enter" });
  await screen.findByText("Deletion unavailable");
  expect(store.getState().sceneInteraction.selectedObjectId).toBe(
    trajectoryObjectId,
  );
  expect(store.getState().playback.playing).toBe(true);
});

it.each<[boolean, string | null, boolean]>([
  [false, trajectoryObjectId, true],
  [true, null, true],
  [true, "another-object", true],
  [true, trajectoryObjectId, false],
])(
  "registers no command when canEdit=%s, selected=%s and exists=%s",
  async (canEdit, selected, exists) => {
    auth.canEdit = canEdit;
    const fetcher = vi.fn(async () =>
      Response.json(
        { segments: exists ? [{ id: "segment" }] : [] },
        { headers: { ETag: '"10"' } },
      ),
    );
    vi.stubGlobal("fetch", fetcher);
    const { client } = mount(selected);
    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(screen.queryByRole("combobox")).toBeNull();
  },
);
