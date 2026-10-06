// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AuthProvider, EditorOnly, useAuth } from "@/features/auth";
import {
  UserSettingsProvider,
  useUserSettings,
  EDITOR_SETTINGS_KEY,
} from "../model/user-settings-provider";
import { UserSettingsPanel } from "./user-settings-panel";
import {
  AnchorToolShortcut,
  EditorStoreProvider,
  useActiveEditorTool,
} from "@/features/project-editor";
import { ProjectCreateForm } from "@/features/project-selection";
import { LibraryUploadForm } from "@/features/library";
import { ChatPanel } from "@/features/chat-agent/ui/chat-panel";

const DEFAULTS = {
  webgpu_tile_renderer: true,
  show_grid: true,
  gaussian_dpr: "1x",
};
let server = { ...DEFAULTS };
let signedIn = false;
let failWrite = false;
let releaseWrite: (() => void) | undefined;
let holdWrite = false;
const patches: unknown[] = [];
let guestReads = 0;

function Controls() {
  const auth = useAuth();
  const settings = useUserSettings();
  const tool = useActiveEditorTool();
  return (
    <>
      <span data-testid="preferences">{`${settings.webGpuTileRenderer}/${settings.showGrid}/${settings.gaussianDpr}`}</span>
      <button onClick={() => void auth.login("editor", "password")}>
        Login
      </button>
      <button onClick={() => void auth.logout()}>Logout</button>
      <span data-testid="tool">{tool ?? "none"}</span>
      <EditorOnly>
        <AnchorToolShortcut />
        <UserSettingsPanel />
        <ProjectCreateForm onCreate={async () => true} />
        <LibraryUploadForm />
      </EditorOnly>
      <ChatPanel
        anchors={[]}
        messages={[]}
        error={null}
        pending={false}
        onSend={async () => {}}
      />
    </>
  );
}

function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const result = render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <UserSettingsProvider>
          <EditorStoreProvider>
            <Controls />
          </EditorStoreProvider>
        </UserSettingsProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
  return { ...result, client };
}

async function openSettings() {
  fireEvent.click(
    await screen.findByRole("button", { name: "Profile settings" }),
  );
  return (await screen.findByRole("checkbox", {
    name: "Show grid",
  })) as HTMLInputElement;
}

beforeEach(() => {
  server = { ...DEFAULTS };
  signedIn = false;
  failWrite = false;
  holdWrite = false;
  releaseWrite = undefined;
  patches.length = 0;
  guestReads = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options: RequestInit) => {
      if (url.endsWith("/auth/login")) {
        signedIn = true;
        return Response.json({ expires_in: 28800 });
      }
      if (url.endsWith("/auth/logout")) {
        signedIn = false;
        return new Response(null, { status: 204 });
      }
      if (url.endsWith("/auth/session"))
        return signedIn
          ? Response.json({ username: "editor" })
          : Response.json(
              { detail: "Authentication required" },
              { status: 401 },
            );
      if (options.method === "PATCH") {
        const patch = JSON.parse(options.body as string);
        patches.push(patch);
        if (holdWrite)
          await new Promise<void>((resolve) => {
            releaseWrite = resolve;
          });
        if (failWrite)
          return Response.json({ detail: "Save failed" }, { status: 500 });
        server = { ...server, ...patch };
      } else if (!signedIn) guestReads += 1;
      return Response.json(server);
    }),
  );
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("guests load the server profile and cannot edit it even with editor localStorage", async () => {
  localStorage.setItem(
    EDITOR_SETTINGS_KEY,
    JSON.stringify({
      webgpu_tile_renderer: false,
      show_grid: false,
      gaussian_dpr: "system",
    }),
  );
  mount();
  await waitFor(() => expect(guestReads).toBe(1));
  expect(screen.getByTestId("preferences").textContent).toBe("true/true/1x");
  expect(screen.queryByRole("button", { name: "Profile settings" })).toBeNull();
  expect(screen.queryByRole("checkbox")).toBeNull();
  expect(patches).toEqual([]);
});

it("restores editor localStorage on login, saves changes there, and reloads backend settings on logout", async () => {
  const local = {
    webgpu_tile_renderer: false,
    show_grid: false,
    gaussian_dpr: "system",
  };
  localStorage.setItem(EDITOR_SETTINGS_KEY, JSON.stringify(local));
  mount();
  await waitFor(() => expect(guestReads).toBe(1));
  fireEvent.click(screen.getByRole("button", { name: "Login" }));
  await waitFor(() =>
    expect(screen.getByTestId("preferences").textContent).toBe(
      "false/false/system",
    ),
  );
  const grid = await openSettings();
  await waitFor(() => expect(grid.disabled).toBe(false));
  fireEvent.click(grid);
  await waitFor(() => expect(patches).toEqual([{ show_grid: true }]));
  expect(JSON.parse(localStorage.getItem(EDITOR_SETTINGS_KEY)!)).toEqual({
    ...local,
    show_grid: true,
  });
  server = { ...DEFAULTS, webgpu_tile_renderer: true, show_grid: false };
  fireEvent.click(screen.getByRole("button", { name: "Logout" }));
  await waitFor(() => expect(guestReads).toBeGreaterThan(1));
  await waitFor(() =>
    expect(screen.getByTestId("preferences").textContent).toBe("true/false/1x"),
  );
  expect(screen.queryByRole("checkbox", { name: "Show grid" })).toBeNull();
  // Signing out preserves editor settings for the next login, without applying them to the guest.
  fireEvent.click(screen.getByRole("button", { name: "Login" }));
  await waitFor(() =>
    expect(screen.getByTestId("preferences").textContent).toBe(
      "false/true/system",
    ),
  );
});

it("keeps editor settings locally when server persistence fails, while the guest uses confirmed server values", async () => {
  signedIn = true;
  failWrite = true;
  mount();
  const grid = await openSettings();
  await waitFor(() => expect(grid.disabled).toBe(false));
  fireEvent.click(grid);
  await screen.findByText("Save failed");
  expect(grid.checked).toBe(false);
  expect(JSON.parse(localStorage.getItem(EDITOR_SETTINGS_KEY)!).show_grid).toBe(
    false,
  );
  fireEvent.click(screen.getByRole("button", { name: "Logout" }));
  await waitFor(() => expect(guestReads).toBeGreaterThan(0));
  await waitFor(() =>
    expect(screen.getByTestId("preferences").textContent).toBe("true/true/1x"),
  );
  expect(screen.queryByRole("checkbox", { name: "Show grid" })).toBeNull();
});

it("drops editor preferences and hides edits when the session expires", async () => {
  signedIn = true;
  localStorage.setItem(
    EDITOR_SETTINGS_KEY,
    JSON.stringify({ ...DEFAULTS, show_grid: false }),
  );
  mount();
  const grid = await openSettings();
  await waitFor(() => expect(grid.disabled).toBe(false));
  expect(grid.checked).toBe(false);
  signedIn = false;
  act(() => {
    window.dispatchEvent(new Event("camera-path-auth-expired"));
  });
  await waitFor(() => expect(guestReads).toBeGreaterThan(0));
  await waitFor(() =>
    expect(screen.getByTestId("preferences").textContent).toBe("true/true/1x"),
  );
  expect(screen.queryByRole("checkbox", { name: "Show grid" })).toBeNull();
});

it("a pending editor save cannot restore editor localStorage after logout", async () => {
  signedIn = true;
  holdWrite = true;
  localStorage.setItem(
    EDITOR_SETTINGS_KEY,
    JSON.stringify({ ...DEFAULTS, webgpu_tile_renderer: false }),
  );
  mount();
  const grid = await openSettings();
  await waitFor(() => expect(grid.disabled).toBe(false));
  fireEvent.click(grid);
  await waitFor(() => expect(releaseWrite).toBeDefined());
  fireEvent.click(screen.getByRole("button", { name: "Logout" }));
  await waitFor(() => expect(guestReads).toBeGreaterThan(0));
  await waitFor(() =>
    expect(screen.getByTestId("preferences").textContent).toBe("true/true/1x"),
  );
  await act(async () => {
    releaseWrite!();
  });
  await waitFor(() =>
    expect(screen.getByTestId("preferences").textContent).toBe("true/false/1x"),
  );
  expect(screen.queryByRole("checkbox", { name: "Show grid" })).toBeNull();
});

it.each([
  ["Macintosh", "Meta", { metaKey: true }],
  ["Linux", "Control", { ctrlKey: true }],
] as const)(
  "hides guest editing and cancels %s placement on logout",
  async (userAgent, key, modifier) => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);
    mount();
    await waitFor(() => expect(guestReads).toBe(1));
    expect(screen.queryByRole("textbox", { name: "Project name" })).toBeNull();
    expect(screen.queryByLabelText("Add a PLY file to the library")).toBeNull();
    expect(screen.queryByRole("button", { name: "Send message" })).toBeNull();
    expect(screen.getByText("Trajectory agent")).toBeTruthy();
    fireEvent.keyDown(window, { key, ...modifier });
    expect(screen.getByTestId("tool").textContent).toBe("none");
    fireEvent.click(screen.getByRole("button", { name: "Login" }));
    await screen.findByRole("textbox", { name: "Project name" });
    expect(screen.getByLabelText("Add a PLY file to the library")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send message" })).toBeTruthy();
    fireEvent.keyDown(window, { key, ...modifier });
    expect(screen.getByTestId("tool").textContent).toBe("anchor");
    fireEvent.click(screen.getByRole("button", { name: "Logout" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Send message" })).toBeNull(),
    );
    expect(screen.getByTestId("tool").textContent).toBe("none");
    fireEvent.keyDown(window, { key, ...modifier });
    expect(screen.getByTestId("tool").textContent).toBe("none");
  },
);
