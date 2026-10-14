import { describe, expect, it } from "vitest";
import { checkSource } from "./check-boundaries.mjs";
const feature = "/repo/frontend/packages/features/lidar/src/example.ts";
const resolve = (specifier: string) =>
  specifier.includes("trajectory")
    ? "/repo/frontend/packages/features/trajectory/src/index.ts"
    : specifier.includes("host")
      ? "/repo/frontend/apps/host/src/private.ts"
      : undefined;
describe("feature boundaries", () => {
  it.each([
    'import {x} from "@camera-path/feature-trajectory";',
    'export * from "../trajectory";',
    'import type {X} from "@camera-path/feature-trajectory";',
    'const x=import("@camera-path/feature-trajectory");',
    'type X=import("@camera-path/feature-trajectory").X;',
    'const x=require("@camera-path/feature-trajectory");',
  ])("rejects sibling access: %s", (source) =>
    expect(checkSource(feature, source, resolve)).not.toHaveLength(0),
  );
  it("rejects raw host, transport, and computed module access", () => {
    for (const source of [
      'import {store} from "@host/private";',
      'import("../"+name);',
      'fetch("/api");',
      'globalThis.fetch("/api");',
      "new WebSocket(url);",
      'import {QueryClient} from "@tanstack/react-query";',
    ])
      expect(checkSource(feature, source, resolve)).not.toHaveLength(0);
  });
  it("accepts contracts and a feature's local implementation", () =>
    expect(
      checkSource(
        feature,
        'import type {LidarSettings} from "@camera-path/contracts/api"; import {x} from "./local";',
        () => undefined,
      ),
    ).toEqual([]));
  it("rejects bypass through a platform re-export", () =>
    expect(
      checkSource(
        "/repo/frontend/packages/ui-kit/src/index.ts",
        'export * from "@host/private";',
        resolve,
      ),
    ).not.toHaveLength(0));
});
