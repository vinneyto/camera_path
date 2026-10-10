// @vitest-environment happy-dom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useChatComposer } from "../model/use-chat-composer";
import { ResponsiveChatPanel } from "./responsive-chat-panel";

vi.mock("@/features/auth", () => ({
  EditorOnly: ({ children }: { children: React.ReactNode }) => children,
}));

let mobile = true;
const media = new EventTarget();
const viewport = new EventTarget();
let viewportHeight = 800;
let viewportTop = 0;
const onSend = vi.fn<
  (id: string, message: string, onAccepted: () => void) => Promise<void>
>(async () => {});

function Panel({ pending = false }: { pending?: boolean }) {
  const composer = useChatComposer({ pending, onSend });
  return (
    <ResponsiveChatPanel
      anchors={[]}
      messages={[]}
      error={null}
      pending={pending}
      composer={composer}
    />
  );
}

beforeEach(() => {
  mobile = true;
  viewportHeight = 800;
  viewportTop = 0;
  vi.stubGlobal("matchMedia", () => ({
    get matches() {
      return mobile;
    },
    addEventListener: media.addEventListener.bind(media),
    removeEventListener: media.removeEventListener.bind(media),
  }));
  Object.defineProperties(viewport, {
    height: { configurable: true, get: () => viewportHeight },
    offsetTop: { configurable: true, get: () => viewportTop },
  });
  vi.stubGlobal("visualViewport", viewport);
  onSend.mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("opens from the mobile composer, focuses input, and retains drafts across closing and resizing", async () => {
  render(<Panel />);
  expect(screen.queryByRole("textbox")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Open trajectory chat" }));
  const input = await screen.findByRole("textbox", {
    name: "Message to trajectory agent",
  });
  await waitFor(() => expect(document.activeElement).toBe(input));
  fireEvent.change(input, { target: { value: "Build a spiral" } });
  fireEvent.click(screen.getByRole("button", { name: "Close chat" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(
    screen.getByRole("button", { name: "Open trajectory chat" }).textContent,
  ).toContain("Build a spiral");
  fireEvent.click(screen.getByRole("button", { name: "Open trajectory chat" }));
  expect(
    (await screen.findByRole("textbox")) as HTMLTextAreaElement,
  ).toHaveProperty("value", "Build a spiral");
  act(() => {
    mobile = false;
    media.dispatchEvent(new Event("change"));
  });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Open trajectory chat" }),
  ).toBeNull();
  expect(screen.getByRole("textbox") as HTMLTextAreaElement).toHaveProperty(
    "value",
    "Build a spiral",
  );
  act(() => {
    mobile = true;
    media.dispatchEvent(new Event("change"));
  });
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Open trajectory chat" }));
  fireEvent.keyDown(await screen.findByRole("textbox"), { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it("retains a failed message's retry ID when the drawer closes", async () => {
  render(<Panel />);
  fireEvent.click(screen.getByRole("button", { name: "Open trajectory chat" }));
  fireEvent.change(await screen.findByRole("textbox"), {
    target: { value: "Build a spline" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  fireEvent.click(screen.getByRole("button", { name: "Close chat" }));
  fireEvent.click(screen.getByRole("button", { name: "Open trajectory chat" }));
  fireEvent.click(await screen.findByRole("button", { name: "Send message" }));
  expect(onSend).toHaveBeenCalledTimes(2);
  expect(onSend.mock.calls[0][0]).toBe(onSend.mock.calls[1][0]);
  act(() => onSend.mock.calls[1][2]());
  expect(screen.getByRole("textbox") as HTMLTextAreaElement).toHaveProperty(
    "value",
    "",
  );
});

it("keeps the drawer inside the visible viewport when the mobile keyboard opens", async () => {
  render(<Panel />);
  fireEvent.click(screen.getByRole("button", { name: "Open trajectory chat" }));
  const dialog = await screen.findByRole("dialog");
  act(() => {
    viewportHeight = 400;
    viewportTop = 20;
    viewport.dispatchEvent(new Event("resize"));
  });
  expect(dialog.style.top).toBe("80px");
  expect(dialog.style.height).toBe("340px");
  expect(dialog.style.bottom).toBe("auto");
});

it("shows the desktop chat directly without a drawer launcher", () => {
  mobile = false;
  render(<Panel />);
  expect(screen.getByRole("textbox")).toBeTruthy();
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Open trajectory chat" }),
  ).toBeNull();
});

it("keeps keyboard focus in the drawer while an agent request is pending", async () => {
  render(<Panel pending />);
  fireEvent.click(screen.getByRole("button", { name: "Open trajectory chat" }));
  const dialog = await screen.findByRole("dialog");
  await waitFor(() => expect(document.activeElement).toBe(dialog));
  expect(screen.getByRole("textbox") as HTMLTextAreaElement).toHaveProperty(
    "disabled",
    true,
  );
  expect(screen.getByRole("button", { name: "Close chat" })).toBeTruthy();
});
