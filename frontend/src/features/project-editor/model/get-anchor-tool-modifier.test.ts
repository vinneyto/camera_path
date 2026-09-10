import { expect, it } from "vitest";

import { getAnchorToolModifier } from "./get-anchor-tool-modifier";

it("uses Command on macOS", () => {
  expect(
    getAnchorToolModifier(
      { ctrlKey: false, metaKey: true },
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    ),
  ).toEqual({ key: "Meta", pressed: true });
});

it("uses Control on Windows", () => {
  expect(
    getAnchorToolModifier(
      { ctrlKey: true, metaKey: false },
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    ),
  ).toEqual({ key: "Control", pressed: true });
});
