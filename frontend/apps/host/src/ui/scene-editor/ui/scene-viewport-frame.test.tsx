// @vitest-environment happy-dom
import { useEffect } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SceneViewportFrame } from "./scene-viewport-frame";
import { useViewportServices } from "@camera-path/scene-runtime/viewport/viewport-provider";
vi.mock("@host/adapters/appearance/theme-provider", () => ({
  useTheme: () => ({ theme: "dark" }),
}));
afterEach(cleanup);
function UnknownContribution({ pending = false }: { pending?: boolean }) {
  const viewport = useViewportServices();
  useEffect(() => {
    viewport.setMessage("unknown", { text: "Unknown resource: Loading…" });
    return () => viewport.setMessage("unknown", null);
  }, [viewport]);
  return (
    <button
      onContextMenu={() =>
        viewport.openMenu(
          [
            {
              label: "Delete unknown object",
              disabled: pending,
              onSelect: () =>
                viewport.setMessage("unknown", { text: "Deleted" }),
            },
          ],
          { x: 40, y: 60 },
        )
      }
      onClick={() =>
        viewport.setMessage("unknown", { text: "Network error", error: true })
      }
    >
      unknown object
    </button>
  );
}
describe("generic viewport services", () => {
  it("clears hover on viewport leave", () => {
    const leave = vi.fn();
    const { container } = render(
      <SceneViewportFrame
        available
        onScenePointerLeave={leave}
        renderScene={() => null}
      />,
    );
    fireEvent.pointerLeave(container.firstElementChild!);
    expect(leave).toHaveBeenCalledOnce();
  });
  it("hosts a menu supplied by an unknown extension and closes it with Escape", () => {
    render(
      <SceneViewportFrame
        available
        renderScene={() => <UnknownContribution />}
      />,
    );
    fireEvent.contextMenu(screen.getByText("unknown object"));
    expect(
      screen.getByRole("menuitem", { name: "Delete unknown object" }),
    ).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.contextMenu(screen.getByText("unknown object"));
    fireEvent.click(screen.getByRole("menuitem"));
    expect(screen.getByText("Deleted")).toBeTruthy();
    expect(screen.queryByRole("menu")).toBeNull();
  });
  it("honors a contribution's disabled operation", () => {
    render(
      <SceneViewportFrame
        available
        renderScene={() => <UnknownContribution pending />}
      />,
    );
    fireEvent.contextMenu(screen.getByText("unknown object"));
    expect(screen.getByRole<HTMLButtonElement>("menuitem").disabled).toBe(true);
  });
  it("reports resource errors and releases messages when the contribution unmounts", () => {
    const { rerender } = render(
      <SceneViewportFrame
        available
        renderScene={() => <UnknownContribution />}
      />,
    );
    expect(screen.getByText("Unknown resource: Loading…")).toBeTruthy();
    fireEvent.click(screen.getByText("unknown object"));
    expect(screen.getByRole("alert").textContent).toBe("Network error");
    rerender(<SceneViewportFrame available renderScene={() => null} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
