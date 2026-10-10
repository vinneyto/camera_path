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
import { ProfileControl } from "@/features/auth/ui/profile-control";
import { ThemeProvider } from "@/features/theme-switcher";
import { useChatComposer } from "@/features/chat-agent/model/use-chat-composer";
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
  const composer = useChatComposer({ pending: false, onSend: async () => {} });
  const settings = useUserSettings();
  const tool = useActiveEditorTool();
  return (
    <>
      <span data-testid="preferences">{`${settings.webGpuTileRenderer}/${settings.showGrid}/${settings.gaussianDpr}`}</span>
      <button
        onClick={() =>
          settings.save({ webgpu_tile_renderer: settings.webGpuTileRenderer })
        }
      >
        Save current renderer
      </button>
      <button onClick={() => void auth.login("editor", "password")}>
        Login
      </button>

      <span data-testid="tool">{tool ?? "none"}</span>
      <UserSettingsPanel />
      <ProfileControl />
      <EditorOnly>
        <AnchorToolShortcut />
        <ProjectCreateForm onCreate={async () => true} />
        <LibraryUploadForm />
      </EditorOnly>
      <ChatPanel
        anchors={[]}
        messages={[]}
        error={null}
        pending={false}
        composer={composer}
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
      <ThemeProvider>
        <AuthProvider>
          <UserSettingsProvider>
            <EditorStoreProvider>
              <Controls />
            </EditorStoreProvider>
          </UserSettingsProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
  return { ...result, client };
}

async function openSettings() {
  fireEvent.click(await screen.findByRole("button", { name: "Settings" }));
  return (await screen.findByRole("checkbox", {
    name: "Show grid",
  })) as HTMLInputElement;
}

async function signOut() {
  if (screen.queryByRole("dialog"))
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
  fireEvent.pointerDown(screen.getByRole("button", { name: "Profile" }), {
    button: 0,
    ctrlKey: false,
    pointerType: "mouse",
  });
  fireEvent.click(await screen.findByRole("menuitem", { name: "Sign out" }));
  await waitFor(() => expect(signedIn).toBe(false));
  await waitFor(() =>
    expect(screen.queryByRole("menuitem", { name: "Sign out" })).toBeNull(),
  );
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

it.each([true, false])(
  "persists the guest renderer switch from %s before reloading the current page",
  async (initialRenderer) => {
    localStorage.setItem(
      EDITOR_SETTINGS_KEY,
      JSON.stringify({ ...DEFAULTS, webgpu_tile_renderer: initialRenderer }),
    );
    const href = window.location.href;
    const reload = vi
      .spyOn(window.location, "reload")
      .mockImplementation(() => {
        expect(
          JSON.parse(localStorage.getItem(EDITOR_SETTINGS_KEY)!)
            .webgpu_tile_renderer,
        ).toBe(!initialRenderer);
        expect(window.location.href).toBe(href);
      });
    const first = mount();
    await openSettings();
    const renderer = screen.getByRole("checkbox", {
      name: "Use WebGPU renderer (off: WebGL)",
    }) as HTMLInputElement;
    await waitFor(() => expect(renderer.disabled).toBe(false));
    fireEvent.click(renderer);
    expect(reload).toHaveBeenCalledOnce();
    expect(patches).toEqual([]);
    // Simulate the new document's settings provider reading the saved choice.
    first.unmount();
    first.client.clear();
    mount();
    await openSettings();
    await waitFor(() =>
      expect(screen.getByTestId("preferences").textContent).toBe(
        `${!initialRenderer}/true/1x`,
      ),
    );
    expect(reload).toHaveBeenCalledOnce();
  },
);

it("waits for an editor renderer save without mounting the other renderer", async () => {
  signedIn = true;
  holdWrite = true;
  const reload = vi.spyOn(window.location, "reload").mockImplementation(() => {
    expect(server.webgpu_tile_renderer).toBe(false);
    expect(
      JSON.parse(localStorage.getItem(EDITOR_SETTINGS_KEY)!)
        .webgpu_tile_renderer,
    ).toBe(false);
  });
  mount();
  await openSettings();
  const renderer = screen.getByRole("checkbox", {
    name: "Use WebGPU renderer (off: WebGL)",
  }) as HTMLInputElement;
  await waitFor(() => expect(renderer.disabled).toBe(false));
  fireEvent.click(renderer);
  await waitFor(() => expect(releaseWrite).toBeDefined());
  expect(reload).not.toHaveBeenCalled();
  expect(renderer.disabled).toBe(true);
  expect(screen.getByTestId("preferences").textContent).toBe("true/true/1x");
  expect(JSON.parse(localStorage.getItem(EDITOR_SETTINGS_KEY)!)).toEqual(
    DEFAULTS,
  );
  await act(async () => releaseWrite!());
  await waitFor(() => expect(reload).toHaveBeenCalledOnce());
  expect(patches).toEqual([{ webgpu_tile_renderer: false }]);
});

it("keeps the current renderer after a failed save and reloads on a successful retry", async () => {
  signedIn = true;
  failWrite = true;
  const reload = vi
    .spyOn(window.location, "reload")
    .mockImplementation(() => {});
  mount();
  await openSettings();
  const renderer = screen.getByRole("checkbox", {
    name: "Use WebGPU renderer (off: WebGL)",
  }) as HTMLInputElement;
  await waitFor(() => expect(renderer.disabled).toBe(false));
  fireEvent.click(renderer);
  await screen.findByText("Save failed");
  expect(reload).not.toHaveBeenCalled();
  expect(renderer.checked).toBe(true);
  expect(JSON.parse(localStorage.getItem(EDITOR_SETTINGS_KEY)!)).toEqual(
    DEFAULTS,
  );
  failWrite = false;
  fireEvent.click(renderer);
  await waitFor(() => expect(reload).toHaveBeenCalledOnce());
});

it.each([false, true])(
  "does not reload for unchanged renderer, grid or DPR settings (editor: %s)",
  async (editor) => {
    signedIn = editor;
    const reload = vi
      .spyOn(window.location, "reload")
      .mockImplementation(() => {});
    mount();
    const grid = await openSettings();
    await waitFor(() => expect(grid.disabled).toBe(false));
    fireEvent.click(screen.getByText("Save current renderer"));
    if (editor) await waitFor(() => expect(patches).toHaveLength(1));
    await waitFor(() => expect(grid.disabled).toBe(false));
    fireEvent.click(grid);
    await waitFor(() => expect(grid.checked).toBe(false));
    await waitFor(() => expect(grid.disabled).toBe(false));
    fireEvent.change(screen.getByRole("combobox", { name: "Gaussian DPR" }), {
      target: { value: "system" },
    });
    await waitFor(() =>
      expect(screen.getByTestId("preferences").textContent).toBe(
        "true/false/system",
      ),
    );
    expect(reload).not.toHaveBeenCalled();
  },
);

it("ignores a late renderer save after newer guest preferences are applied", async () => {
  signedIn = true;
  holdWrite = true;
  const reload = vi
    .spyOn(window.location, "reload")
    .mockImplementation(() => {});
  mount();
  await openSettings();
  const renderer = screen.getByRole("checkbox", {
    name: "Use WebGPU renderer (off: WebGL)",
  }) as HTMLInputElement;
  await waitFor(() => expect(renderer.disabled).toBe(false));
  fireEvent.click(renderer);
  await waitFor(() => expect(releaseWrite).toBeDefined());
  await signOut();
  fireEvent.click(await openSettings());
  await act(async () => releaseWrite!());
  await waitFor(() => expect(server.webgpu_tile_renderer).toBe(false));
  expect(reload).not.toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem(EDITOR_SETTINGS_KEY)!)).toEqual({
    ...DEFAULTS,
    show_grid: false,
  });
});

it("guests restore and edit local preferences without backend writes", async () => {
  localStorage.setItem(
    EDITOR_SETTINGS_KEY,
    JSON.stringify({
      webgpu_tile_renderer: false,
      show_grid: false,
      gaussian_dpr: "system",
    }),
  );
  const first = mount();
  const grid = await openSettings();
  await waitFor(() => expect(grid.disabled).toBe(false));
  expect(screen.getByTestId("preferences").textContent).toBe(
    "false/false/system",
  );
  fireEvent.click(grid);
  await waitFor(() =>
    expect(screen.getByTestId("preferences").textContent).toBe(
      "false/true/system",
    ),
  );
  expect(JSON.parse(localStorage.getItem(EDITOR_SETTINGS_KEY)!).show_grid).toBe(
    true,
  );
  expect(patches).toEqual([]);
  expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
  first.unmount();
  first.client.clear();
  mount();
  const restored = await openSettings();
  await waitFor(() => expect(restored.disabled).toBe(false));
  await waitFor(() =>
    expect(screen.getByTestId("preferences").textContent).toBe(
      "false/true/system",
    ),
  );
});

it("keeps local preferences through login and logout; only editors publish changes", async () => {
  const local = {
    webgpu_tile_renderer: false,
    show_grid: false,
    gaussian_dpr: "system",
  };
  localStorage.setItem(EDITOR_SETTINGS_KEY, JSON.stringify(local));
  mount();
  await waitFor(() => expect(guestReads).toBe(1));
  fireEvent.click(screen.getByRole("button", { name: "Login" }));
  await screen.findByRole("textbox", { name: "Project name" });
  const grid = await openSettings();
  await waitFor(() => expect(grid.disabled).toBe(false));
  fireEvent.click(grid);
  await waitFor(() => expect(patches).toEqual([{ show_grid: true }]));
  expect(JSON.parse(localStorage.getItem(EDITOR_SETTINGS_KEY)!)).toEqual({
    ...local,
    show_grid: true,
  });
  await signOut();
  await waitFor(() =>
    expect(screen.getByTestId("preferences").textContent).toBe(
      "false/true/system",
    ),
  );
  const guestGrid = await openSettings();
  expect(guestGrid.disabled).toBe(false);
  fireEvent.click(guestGrid);
  expect(patches).toEqual([{ show_grid: true }]);
  fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
  fireEvent.click(screen.getByRole("button", { name: "Login" }));
  await screen.findByRole("textbox", { name: "Project name" });
  expect(screen.getByTestId("preferences").textContent).toBe(
    "false/false/system",
  );
});

it("keeps local preferences after logout even when backend persistence fails", async () => {
  signedIn = true;
  failWrite = true;
  mount();
  const grid = await openSettings();
  await waitFor(() => expect(grid.disabled).toBe(false));
  fireEvent.click(grid);
  await screen.findByText("Save failed");
  expect(grid.checked).toBe(false);
  await signOut();
  expect(screen.getByTestId("preferences").textContent).toBe("true/false/1x");
  const guestGrid = await openSettings();
  expect(guestGrid.checked).toBe(false);
  expect(guestGrid.disabled).toBe(false);
  expect(screen.queryByText("Save failed")).toBeNull();
});

it("preserves preferences while hiding writes when the session expires", async () => {
  signedIn = true;
  localStorage.setItem(
    EDITOR_SETTINGS_KEY,
    JSON.stringify({ ...DEFAULTS, show_grid: false }),
  );
  mount();
  const grid = await openSettings();
  await waitFor(() => expect(grid.disabled).toBe(false));
  signedIn = false;
  act(() => {
    window.dispatchEvent(new Event("camera-path-auth-expired"));
  });
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull(),
  );
  expect(screen.getByTestId("preferences").textContent).toBe("true/false/1x");
  fireEvent.click(grid);
  await waitFor(() => expect(grid.checked).toBe(true));
  expect(patches).toEqual([]);
});

it("a late editor save cannot replace newer guest preferences", async () => {
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
  await signOut();
  const guestGrid = await openSettings();
  expect(guestGrid.disabled).toBe(false);
  fireEvent.click(guestGrid);
  await act(async () => {
    releaseWrite!();
  });
  await waitFor(() =>
    expect(screen.getByTestId("preferences").textContent).toBe("false/true/1x"),
  );
  expect(JSON.parse(localStorage.getItem(EDITOR_SETTINGS_KEY)!)).toEqual({
    ...DEFAULTS,
    webgpu_tile_renderer: false,
  });
  expect(patches).toEqual([{ show_grid: false }]);
});

it("uses backend defaults for an invalid local profile", async () => {
  localStorage.setItem(
    EDITOR_SETTINGS_KEY,
    '{"show_grid":"wrong","gaussian_dpr":"invalid"}',
  );
  server.show_grid = false;
  mount();
  const grid = await openSettings();
  await waitFor(() => expect(grid.disabled).toBe(false));
  expect(screen.getByTestId("preferences").textContent).toBe("true/false/1x");
});

it("keeps local settings usable when profile reads fail", async () => {
  const fetch = globalThis.fetch;
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, options: RequestInit) => {
      if (url.endsWith("/profile/settings"))
        return Promise.reject(new Error("Offline"));
      return fetch(url, options);
    }),
  );
  localStorage.setItem(
    EDITOR_SETTINGS_KEY,
    JSON.stringify({ ...DEFAULTS, show_grid: false }),
  );
  mount();
  const grid = await openSettings();
  await waitFor(() => expect(grid.disabled).toBe(false));
  expect(grid.checked).toBe(false);
  fireEvent.click(grid);
  await waitFor(() => expect(grid.checked).toBe(true));
  expect(patches).toEqual([]);
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
    expect(
      screen.queryByLabelText("Add a PLY or SOG file to the library"),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Send message" })).toBeNull();
    expect(screen.getByText("Trajectory agent")).toBeTruthy();
    fireEvent.keyDown(window, { key, ...modifier });
    expect(screen.getByTestId("tool").textContent).toBe("none");
    fireEvent.click(screen.getByRole("button", { name: "Login" }));
    await screen.findByRole("textbox", { name: "Project name" });
    expect(
      screen.getByLabelText("Add a PLY or SOG file to the library"),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send message" })).toBeTruthy();
    fireEvent.keyDown(window, { key, ...modifier });
    expect(screen.getByTestId("tool").textContent).toBe("anchor");
    await signOut();
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Send message" })).toBeNull(),
    );
    expect(screen.getByTestId("tool").textContent).toBe("none");
    fireEvent.keyDown(window, { key, ...modifier });
    expect(screen.getByTestId("tool").textContent).toBe("none");
  },
);

it("closes settings with the cross and Escape", async () => {
  signedIn = true;
  mount();
  await openSettings();
  fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await openSettings();
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it("closes on the overlay without activating the page", async () => {
  signedIn = true;
  mount();
  await openSettings();
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  const overlay = document.querySelector('.fixed.inset-0[data-state="open"]')!;
  fireEvent.pointerDown(overlay, { pointerType: "mouse", button: 0 });
  fireEvent.click(overlay);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(signedIn).toBe(true);
});

it("keeps two icons for guests, separates settings from sign-in, and opens a logout menu after login", async () => {
  mount();
  await waitFor(() => expect(guestReads).toBe(1));
  expect(screen.getByRole("button", { name: "Settings" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Profile" })).toBeTruthy();
  await openSettings();
  expect(screen.queryByText("Sign out")).toBeNull();
  expect(screen.getByRole("combobox", { name: "Gaussian DPR" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
  fireEvent.click(screen.getByRole("button", { name: "Profile" }));
  expect(
    await screen.findByRole("dialog", { name: "Editor sign in" }),
  ).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Username"), {
    target: { value: "editor" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  await screen.findByRole("textbox", { name: "Project name" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await openSettings();
  expect(screen.queryByText("Sign out")).toBeNull();
  await signOut();
  expect(screen.getByRole("button", { name: "Settings" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Profile" })).toBeTruthy();
});

it("shows logout errors next to profile and keeps the session available for retry", async () => {
  signedIn = true;
  const fetch = globalThis.fetch;
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, options: RequestInit) =>
      url.endsWith("/auth/logout")
        ? Promise.resolve(
            Response.json({ detail: "Logout failed" }, { status: 500 }),
          )
        : fetch(url, options),
    ),
  );
  mount();
  await screen.findByRole("textbox", { name: "Project name" });
  fireEvent.pointerDown(screen.getByRole("button", { name: "Profile" }), {
    button: 0,
    ctrlKey: false,
    pointerType: "mouse",
  });
  fireEvent.click(await screen.findByRole("menuitem", { name: "Sign out" }));
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    "Logout failed",
  );
  expect(signedIn).toBe(true);
  expect(screen.getByRole("textbox", { name: "Project name" })).toBeTruthy();
});
