import { numberSchema, voidSchema } from "@camera-path/contracts/basic-schemas";
import { defineDataContract } from "@camera-path/contracts/define-data-contract";
import { defineRequest } from "@camera-path/contracts/define-request";
import { projectPermissions } from "@camera-path/contracts/host-data";
import { jsonSchema } from "@camera-path/contracts/json-schema";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { DataCell } from "./data-cell";
import type { Handled } from "./feature-context";
import { HostRuntime } from "./host-runtime";
const value = defineDataContract(
  "host.test.value@1",
  "Numeric state used by host runtime tests.",
  numberSchema,
);
const privateValue = defineDataContract(
  "host.test.private@1",
  "Undeclared numeric state used to test access restrictions.",
  numberSchema,
);
const write = defineRequest(
  "host.test.write@1",
  "Numeric action used to test host request handling.",
  numberSchema,
  numberSchema,
);
const undeclared = defineRequest(
  "host.test.private@1",
  "Undeclared action used to test access restrictions.",
  voidSchema,
  voidSchema,
  false,
);
const manifest = {
  manifestVersion: 1,
  id: "test",
  scope: "project",
  reads: [value],
  calls: [write],
  frames: [],
  contributions: [],
  capabilities: [],
} as const;
function fixture(id = "project") {
  const runtime = new HostRuntime(id, "project");
  const cell = new DataCell(value);
  runtime.bindData(value, cell.read, cell.subscribe);
  const permissions = new DataCell(projectPermissions);
  permissions.set({ canEdit: true });
  runtime.bindData(projectPermissions, permissions.read, permissions.subscribe);
  return { runtime, cell, permissions, host: runtime.feature(manifest) };
}
describe("scoped host runtime", () => {
  it("enforces declared read contracts and calls", async () => {
    const { runtime, host } = fixture();
    expect(() =>
      host.data.read(privateValue as unknown as typeof value),
    ).toThrow(/Undeclared/);
    await expect(
      host.requests.call(undeclared as unknown as typeof write, 1),
    ).rejects.toThrow(/Undeclared/);
    expect(runtime.trace.map((t) => t.result)).toEqual(["denied", "denied"]);
  });
  it("denies every read method for undeclared contracts", () => {
    const { host } = fixture();
    const contract = privateValue as unknown as typeof value;
    expect(() => host.data.state(contract)).toThrow(/Undeclared/);
    expect(() => host.data.readAsync(contract)).toThrow(/Undeclared/);
    expect(() => host.data.subscribe(contract, () => {})).toThrow(/Undeclared/);
  });
  it("treats omitted or empty handles as no service permissions", () => {
    const { runtime, host } = fixture();
    expectTypeOf<Handled<typeof manifest>>().toEqualTypeOf<never>();
    expect(() =>
      host.requests.handle(write as never, () => {
        throw new Error("Must not be registered");
      }),
    ).toThrow(/Undeclared handle/);
    const empty = { ...manifest, id: "empty", handles: [] } as const;
    expectTypeOf<Handled<typeof empty>>().toEqualTypeOf<never>();
    expect(() =>
      runtime.feature(empty).requests.handle(write as never, () => {
        throw new Error("Must not be registered");
      }),
    ).toThrow(/Undeclared handle/);
  });
  it("routes declared feature services and releases them on unregister or disposal", async () => {
    const runtime = new HostRuntime("services", "project");
    const service = defineRequest(
      "provider.compute@1",
      "Numeric service used to test feature service registration.",
      numberSchema,
      numberSchema,
      false,
    );
    const providerManifest = {
      ...manifest,
      id: "provider",
      reads: [],
      calls: [],
      handles: [service],
    } as const;
    const provider = runtime.feature(providerManifest);
    const caller = runtime.feature({
      ...manifest,
      id: "caller",
      reads: [],
      calls: [service],
    } as const);
    expectTypeOf<Handled<typeof providerManifest>>().toEqualTypeOf<
      typeof service
    >();
    const off = provider.requests.handle(service, (n) => n + 1);
    expect(await caller.requests.call(service, 4)).toEqual({
      ok: true,
      value: 5,
    });
    off();
    expect(await caller.requests.call(service, 4)).toMatchObject({
      ok: false,
      error: { code: "unavailable" },
    });
    provider.requests.handle(service, (n) => n + 2);
    runtime.dispose();
    expect(await caller.requests.call(service, 4)).toMatchObject({
      ok: false,
      error: { code: "cancelled" },
    });
    expect(() => provider.requests.handle(service, (n) => n)).toThrow(
      /Disposed/,
    );
    expect(() =>
      new HostRuntime("invalid", "project").feature({
        ...providerManifest,
        id: "wrong-owner",
      }),
    ).toThrow(/Invalid request owner/);
  });
  it("keeps snapshots stable and subscribes before awaiting readiness", async () => {
    const { host, cell } = fixture();
    const waiting = host.data.readAsync(value);
    cell.set(4);
    expect(await waiting).toBe(4);
    const first = host.data.state(value);
    expect(host.data.state(value)).toBe(first);
    const listener = vi.fn();
    const off = host.data.subscribe(value, listener);
    cell.set(7);
    expect(listener).toHaveBeenCalledOnce();
    off();
    cell.set(8);
    expect(listener).toHaveBeenCalledOnce();
  });
  it("reports provider conflicts and schema failures", () => {
    const { runtime, cell } = fixture();
    expect(() => runtime.bindData(value, cell.read, cell.subscribe)).toThrow(
      /Duplicate/,
    );
    expect(() => cell.set("bad" as unknown as number)).toThrow();
    runtime.bindRequest(write, (n) => n);
    expect(() => runtime.bindRequest(write, (n) => n)).toThrow(/Duplicate/);
  });
  it("checks editing permissions and validates input/output", async () => {
    const { runtime, host, permissions } = fixture();
    runtime.bindRequest(write, (n) => n + 1);
    permissions.set({ canEdit: false });
    expect(await host.requests.call(write, 4)).toMatchObject({
      ok: false,
      error: { code: "forbidden" },
    });
    permissions.set({ canEdit: true });
    expect(
      await host.requests.call(write, "bad" as unknown as number),
    ).toMatchObject({ ok: false, error: { code: "invalid-input" } });
    expect(await host.requests.call(write, 4)).toEqual({ ok: true, value: 5 });
  });
  it("settles in-flight calls and readAsync on scope disposal; scopes remain separate", async () => {
    const a = fixture("a");
    const b = fixture("b");
    a.runtime.bindRequest(write, () => new Promise<number>(() => {}));
    const read = a.host.data.readAsync(value);
    const call = a.host.requests.call(write, 3);
    a.runtime.dispose();
    await expect(read).rejects.toMatchObject({ name: "AbortError" });
    expect(await call).toMatchObject({
      ok: false,
      error: { code: "cancelled" },
    });
    b.cell.set(9);
    expect(b.host.data.read(value)).toBe(9);
    expect(() => a.host.data.read(value)).toThrow(/Disposed/);
  });
  it("validates and freezes recursively published DTOs", () => {
    const dto = defineDataContract(
      "host.test.dto@1",
      "Nested data used to test immutable snapshots.",
      jsonSchema<{ items: number[] }>({
        type: "object",
        required: ["items"],
        properties: { items: { type: "array", items: { type: "number" } } },
      }),
    );
    const cell = new DataCell(dto);
    const original = { items: [1] };
    cell.set(original);
    original.items[0] = 8;
    const state = cell.read();
    if (state.status !== "ready") throw new Error("Expected ready");
    expect(state.value.items).toEqual([1]);
    expect(Object.isFrozen(state.value.items)).toBe(true);
  });
  it("releases subscriptions when the host is disposed", () => {
    const { runtime, host, cell } = fixture();
    const listener = vi.fn();
    host.data.subscribe(value, listener);
    runtime.dispose();
    cell.set(2);
    expect(listener).not.toHaveBeenCalled();
  });
  it("cancels editor work on logout without disabling guest reads", async () => {
    const { runtime, host, cell } = fixture();
    runtime.bindRequest(write, () => new Promise<number>(() => {}));
    const call = host.requests.call(write, 1);
    runtime.revokeEditorRequests();
    expect(await call).toMatchObject({
      ok: false,
      error: { code: "cancelled" },
    });
    cell.set(2);
    expect(host.data.read(value)).toBe(2);
  });
  it("uses one application instance across project children", () => {
    const app = new HostRuntime("app", "application");
    const a = new HostRuntime("a", "project", app);
    const b = new HostRuntime("b", "project", app);
    const m = { ...manifest, scope: "application" as const };
    expect(a.feature(m)).toBe(b.feature(m));
  });
});
