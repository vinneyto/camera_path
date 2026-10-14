import { gaussianScene } from "@camera-path/contracts/gpu-resources";
import { describe, expect, it } from "vitest";
import { FrameRegistry } from "./frame-registry";
import { GpuRegistry } from "./gpu-registry";
import { orderedGraph } from "./ordered-graph";
describe("frame and GPU lifetimes", () => {
  it("orders deterministically and rejects missing or cyclic dependencies", () => {
    expect(
      orderedGraph([{ id: "b", after: ["a"] }, { id: "c" }, { id: "a" }]).map(
        (e) => e.id,
      ),
    ).toEqual(["a", "c", "b"]);
    expect(() => orderedGraph([{ id: "a", after: ["missing"] }])).toThrow(
      /Missing/,
    );
    expect(() =>
      orderedGraph([
        { id: "a", after: ["b"] },
        { id: "b", after: ["a"] },
      ]),
    ).toThrow(/Cyclic/);
  });
  it("runs the host camera update before a sensor regardless of registration order", () => {
    const frames = new FrameRegistry();
    const order: string[] = [];
    frames.register(
      { id: "lidar.update", phase: "update", after: ["host.camera"] },
      () => order.push("sensor"),
    );
    frames.register({ id: "host.camera", phase: "update" }, () =>
      order.push("camera"),
    );
    frames.run("update", {
      frameId: 1,
      deltaSeconds: 0.016,
      elapsedSeconds: 1,
    });
    expect(order).toEqual(["camera", "sensor"]);
  });
  it("invalidates GPU leases on producer release and assigns a new generation", () => {
    const registry = new GpuRegistry();
    const view = {
      available: true,
      createSensor: () => {
        throw new Error("Unused");
      },
    };
    const producer = registry.publish(gaussianScene, "host", view);
    const lease = registry.lease(gaussianScene);
    expect(lease.ready).toBe(false);
    expect(() => lease.read()).toThrow(/unready/);
    producer.ready();
    expect(lease.read()).toBe(view);
    producer.dispose();
    expect(() => lease.read()).toThrow(/Stale/);
    registry.publish(gaussianScene, "host", view, true);
    expect(registry.lease(gaussianScene).generation).toBeGreaterThan(
      lease.generation,
    );
  });
});
