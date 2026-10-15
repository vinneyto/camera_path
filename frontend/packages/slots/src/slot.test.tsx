// @vitest-environment happy-dom
import {
  createEditorStore,
  EditorStoreProvider,
  useEditorStore,
} from "@camera-path/store";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, expect, it, vi } from "vitest";
import type { FeatureSlots } from "./feature-slots";
import { Slot } from "./slot";
import { SlotProvider } from "./slot-provider";
afterEach(cleanup);
it("renders an unknown feature in catalog/local order, ignores empty slots and adds no DOM wrappers", () => {
  const A = () => <span>A</span>,
    B = () => <span>B</span>,
    C = () => <span>C</span>;
  const features: readonly FeatureSlots[] = [
    {},
    { settings: { content: [A, B] }, project: { sidebar: [C] } },
    { settings: { content: [C] } },
  ];
  const { container } = render(
    <SlotProvider features={features}>
      <Slot name="settings.content" />
      <Slot name="dashboard.content" />
    </SlotProvider>,
  );
  expect(
    [...container.children].map((e) => [e.tagName, e.textContent]),
  ).toEqual([
    ["SPAN", "A"],
    ["SPAN", "B"],
    ["SPAN", "C"],
  ]);
});
it("mounts components without props under existing providers and retains them on parent rerenders", () => {
  const store = createEditorStore();
  const dispose = vi.fn(),
    setup = vi.fn();
  function ReadStore() {
    const position = useEditorStore((s) => s.playback.pathPosition);
    useEffect(() => {
      setup();
      return dispose;
    }, []);
    return (
      <button
        onClick={() =>
          store.setState((s) => ({
            playback: { ...s.playback, pathPosition: 0.75 },
          }))
        }
      >
        {position}
      </button>
    );
  }
  const features: readonly FeatureSlots[] = [
    { timeline: { controls: [ReadStore] } },
  ];
  const tree = () => (
    <EditorStoreProvider store={store}>
      <SlotProvider features={features}>
        <Slot name="timeline.controls" />
      </SlotProvider>
    </EditorStoreProvider>
  );
  const view = render(tree());
  fireEvent.click(screen.getByRole("button", { name: "0" }));
  expect(screen.getByRole("button", { name: "0.75" })).toBeTruthy();
  view.rerender(tree());
  expect(setup).toHaveBeenCalledOnce();
  expect(dispose).not.toHaveBeenCalled();
  view.unmount();
  expect(dispose).toHaveBeenCalledOnce();
});
it("releases a removed slot's mounted behavior", () => {
  const dispose = vi.fn();
  function Behavior() {
    useEffect(() => dispose, []);
    return null;
  }
  const features: readonly FeatureSlots[] = [{ project: { root: [Behavior] } }];
  const view = render(
    <SlotProvider features={features}>
      <Slot name="project.root" />
    </SlotProvider>,
  );
  act(() =>
    view.rerender(<SlotProvider features={features}>{null}</SlotProvider>),
  );
  expect(dispose).toHaveBeenCalledOnce();
});
