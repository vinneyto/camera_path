// @vitest-environment happy-dom
import { useEffect } from "react";
import {
  cleanup,
  render,
  screen,
  fireEvent,
  act,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { Extension } from "./extension";
import { ExtensionProvider } from "./extension-provider";
import { ExtensionSlot } from "./extension-slot";
import { HostProvider } from "./host-provider";
import { HostRuntime } from "./host-runtime";
import { defineDataContract } from "@camera-path/contracts/define-data-contract";
import { defineRequest } from "@camera-path/contracts/define-request";
import { valueSchema } from "@camera-path/contracts/value-schema";
import { voidSchema } from "@camera-path/contracts/basic-schemas";
import { useData } from "./use-data";
import { useRequestAction } from "./use-request-action";
import { DataCell } from "./data-cell";
afterEach(cleanup);
const schema = valueSchema<number>(
  (value): value is number => typeof value === "number",
  "number",
);
const state = defineDataContract("test.count@1", "Test count.", schema);
const increment = defineRequest(
  "test.increment@1",
  "Increment count.",
  voidSchema,
  voidSchema,
  false,
);
const dispose = vi.fn();
const manifest = {
  manifestVersion: 1,
  id: "unknown",
  scope: "project",
  reads: [state],
  calls: [increment],
  frames: [],
  capabilities: [],
  contributions: [
    {
      id: "unknown.track",
      kind: "timeline",
      slot: "timeline.tracks",
      resourceType: "unknown",
      order: 5,
    },
  ],
} as const;
function UnknownTrack() {
  const count = useData(manifest, state);
  const call = useRequestAction(manifest, increment);
  useEffect(() => () => dispose(), []);
  return <button onClick={() => void call(undefined)}>Count {count}</button>;
}
const extension: Extension = {
  manifest,
  contributions: [{ id: "unknown.track", Component: UnknownTrack }],
};
it("mounts an unknown timeline whose state and actions flow only through its host API", async () => {
  dispose.mockClear();
  const runtime = new HostRuntime("one", "project");
  const cell = new DataCell(state);
  cell.set(0);
  runtime.bindData(state, cell.read, cell.subscribe);
  runtime.bindRequest(increment, () =>
    cell.set(
      cell.read().status === "ready"
        ? (cell.read() as { value: number }).value + 1
        : 1,
    ),
  );
  const mounted = render(
    <HostProvider runtime={runtime}>
      <ExtensionProvider extensions={[extension]}>
        <ExtensionSlot name="timeline.tracks" />
      </ExtensionProvider>
    </HostProvider>,
  );
  await act(async () => fireEvent.click(screen.getByRole("button")));
  expect(screen.getByText("Count 1")).toBeTruthy();
  mounted.unmount();
  expect(dispose).toHaveBeenCalledOnce();
  runtime.dispose();
});
it("merges application/project contributions in global slot order", () => {
  const parent: Extension = {
    manifest: {
      ...manifest,
      id: "parent",
      scope: "application",
      contributions: [
        { id: "parent.track", kind: "ui", slot: "slot", order: 20 },
      ],
    },
    contributions: [
      { id: "parent.track", Component: () => <span>Parent</span> },
    ],
  };
  const child: Extension = {
    manifest: {
      ...manifest,
      contributions: [
        { id: "unknown.track", kind: "ui", slot: "slot", order: 10 },
      ],
    },
    contributions: [
      { id: "unknown.track", Component: () => <span>Child</span> },
    ],
  };
  const { container } = render(
    <ExtensionProvider extensions={[parent]}>
      <ExtensionProvider extensions={[child]}>
        <ExtensionSlot name="slot" />
      </ExtensionProvider>
    </ExtensionProvider>,
  );
  expect(container.textContent).toBe("ChildParent");
});
it("rejects undeclared UI contributions", () => {
  expect(() =>
    render(
      <ExtensionProvider
        extensions={[
          {
            ...extension,
            contributions: [
              { id: "unknown.undeclared", Component: () => null },
            ],
          },
        ]}
      >
        {null}
      </ExtensionProvider>,
    ),
  ).toThrow(/Undeclared contribution/);
});
