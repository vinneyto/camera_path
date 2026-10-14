import type {
  ContractValue,
  DataContract,
  DataState,
  RequestDefinition,
  RequestInput,
  RequestOutput,
  RequestResult,
} from "@camera-path/contracts/contract-types";
import type { FeatureContext } from "./feature-context";
import { immutableValue } from "./immutable-value";
import type { FeatureManifest } from "./manifest";

interface DataBinding {
  contract: DataContract;
  owner: string;
  read: () => DataState<unknown>;
  subscribe: (listener: () => void) => () => void;
}
interface RequestBinding {
  contract: RequestDefinition<string, unknown, unknown>;
  owner: string;
  handle: (input: never, signal: AbortSignal) => unknown;
}
export interface AccessTrace {
  feature: string;
  scopeId: string;
  operation: string;
  contract: string;
  result: "allowed" | "denied";
}
// This is a host service. Feature packages import only its scoped interface via the React boundary.
export class HostRuntime {
  readonly controller = new AbortController();
  private readonly dataBindings = new Map<string, DataBinding>();
  private readonly requestBindings = new Map<string, RequestBinding>();
  private readonly contexts = new Map<
    string,
    FeatureContext<FeatureManifest>
  >();
  private readonly manifests = new Map<string, FeatureManifest>();
  private readonly cleanups = new Set<() => void>();
  private readonly children = new Set<HostRuntime>();
  private readonly editorRequests = new Set<AbortController>();
  readonly trace: AccessTrace[] = [];
  constructor(
    readonly scopeId: string,
    readonly scope: "application" | "project",
    readonly parent?: HostRuntime,
  ) {
    parent?.children.add(this);
  }
  bindData<C extends DataContract>(
    contract: C,
    read: () => DataState<ContractValue<C>>,
    subscribe: (listener: () => void) => () => void,
    owner = "host",
  ): () => void {
    this.assertAlive();
    if (this.dataBindings.has(contract.id))
      throw new Error(`Duplicate data provider: ${contract.id}`);
    const binding = { contract, read, subscribe, owner };
    this.dataBindings.set(contract.id, binding);
    return () => {
      if (this.dataBindings.get(contract.id) === binding)
        this.dataBindings.delete(contract.id);
    };
  }
  bindRequest<C extends RequestDefinition<string, unknown, unknown>>(
    contract: C,
    handle: (
      input: RequestInput<C>,
      signal: AbortSignal,
    ) => Promise<RequestOutput<C>> | RequestOutput<C>,
    owner = "host",
  ): () => void {
    this.assertAlive();
    if (this.requestBindings.has(contract.id))
      throw new Error(`Duplicate request handler: ${contract.id}`);
    const binding = {
      contract,
      handle: handle as RequestBinding["handle"],
      owner,
    };
    this.requestBindings.set(contract.id, binding);
    return () => {
      if (this.requestBindings.get(contract.id) === binding)
        this.requestBindings.delete(contract.id);
    };
  }
  feature<const M extends FeatureManifest>(manifest: M): FeatureContext<M> {
    this.assertAlive();
    const existing = this.contexts.get(manifest.id);
    if (existing) {
      if (this.manifests.get(manifest.id) !== manifest)
        throw new Error(`Duplicate feature: ${manifest.id}`);
      return existing as FeatureContext<M>;
    }
    if (manifest.scope !== this.scope) {
      if (this.parent) return this.parent.feature(manifest);
      throw new Error(`Scope mismatch: ${manifest.id}`);
    }
    for (const contract of manifest.data.provides)
      if (!contract.id.startsWith(manifest.id + "."))
        throw new Error(`Invalid data owner: ${contract.id}`);
    for (const contract of manifest.requests.handles)
      if (!contract.id.startsWith(manifest.id + "."))
        throw new Error(`Invalid request owner: ${contract.id}`);
    for (const contribution of manifest.contributions) {
      if (!contribution.id.startsWith(manifest.id + "."))
        throw new Error(`Invalid contribution owner: ${contribution.id}`);
      for (const output of contribution.outputs ?? [])
        if (!output.id.startsWith(manifest.id + "."))
          throw new Error(`Invalid GPU output owner: ${output.id}`);
    }
    for (const frame of manifest.frames)
      if (!frame.id.startsWith(manifest.id + "."))
        throw new Error(`Invalid frame owner: ${frame.id}`);
    const permission = (
      contract: DataContract,
      mode: "read" | "readAsync" | "subscribe",
    ) => {
      const allowed = manifest.data.reads.some(
        (d) => d.contract === contract && d.access.includes(mode),
      );
      this.record(manifest.id, mode, contract.id, allowed);
      if (!allowed)
        throw new Error(`Undeclared ${mode}: ${manifest.id} → ${contract.id}`);
      return this.findData(contract);
    };
    const context: FeatureContext<M> = {
      scopeId: this.scopeId,
      signal: this.controller.signal,
      data: {
        state: (contract) => {
          const b = permission(contract, "read");
          return b.read() as never;
        },
        read: (contract) => {
          const b = permission(contract, "read");
          const state = b.read();
          if (state.status !== "ready")
            throw state.error ?? new Error(`Data not ready: ${contract.id}`);
          return state.value as never;
        },
        readAsync: (contract) => {
          const binding = permission(contract, "readAsync");
          return new Promise((resolve, reject) => {
            let off = () => {};
            const cleanup = () => {
              off();
              this.controller.signal.removeEventListener("abort", abort);
              this.cleanups.delete(abort);
            };
            const abort = () => {
              cleanup();
              reject(new DOMException("Scope disposed", "AbortError"));
            };
            const check = () => {
              const s = binding.read();
              if (s.status === "ready") {
                cleanup();
                resolve(s.value as never);
              } else if (s.status === "error") {
                cleanup();
                reject(s.error);
              }
            };
            off = binding.subscribe(check);
            this.cleanups.add(abort);
            this.controller.signal.addEventListener("abort", abort, {
              once: true,
            });
            check();
          });
        },
        subscribe: (contract, listener) => {
          const binding = permission(contract, "subscribe");
          let active = true;
          const off = binding.subscribe(() => {
            if (active && !this.controller.signal.aborted) listener();
          });
          const cleanup = () => {
            if (!active) return;
            active = false;
            off();
            this.cleanups.delete(cleanup);
          };
          this.cleanups.add(cleanup);
          return cleanup;
        },
        provide: (contract, value) => {
          this.assertAlive();
          if (!manifest.data.provides.includes(contract))
            throw new Error(`Undeclared provide: ${contract.id}`);
          const next = immutableValue(contract.schema.parse(value));
          let b = this.dataBindings.get(contract.id);
          if (b && b.owner !== manifest.id)
            throw new Error(`Duplicate data owner: ${contract.id}`);
          if (!b) {
            const listeners = new Set<() => void>();
            let state: DataState<unknown> = {
              status: "ready",
              value: next,
              error: null,
            };
            b = {
              contract,
              owner: manifest.id,
              read: () => state,
              subscribe: (fn) => {
                listeners.add(fn);
                return () => listeners.delete(fn);
              },
            };
            this.dataBindings.set(contract.id, b);
            this.localPublishers.set(contract.id, (v) => {
              state = { status: "ready", value: v, error: null };
              listeners.forEach((fn) => fn());
            });
          } else this.localPublishers.get(contract.id)!(next);
        },
      },
      requests: {
        call: (contract, input, options) => {
          const allowed = manifest.requests.calls.includes(contract);
          this.record(manifest.id, "call", contract.id, allowed);
          if (!allowed)
            return Promise.reject(
              new Error(`Undeclared call: ${manifest.id} → ${contract.id}`),
            );
          return this.call(contract, input, options);
        },
        handle: (contract, handler) => {
          if (!manifest.requests.handles.includes(contract))
            throw new Error(`Undeclared handle: ${contract.id}`);
          const off = this.bindRequest(contract, handler as never, manifest.id);
          this.cleanups.add(off);
          return () => {
            off();
            this.cleanups.delete(off);
          };
        },
      },
    };
    this.contexts.set(manifest.id, context as FeatureContext<FeatureManifest>);
    this.manifests.set(manifest.id, manifest);
    return context;
  }
  private readonly localPublishers = new Map<
    string,
    (value: unknown) => void
  >();
  async call<C extends RequestDefinition<string, unknown, unknown>>(
    contract: C,
    input: RequestInput<C>,
    options?: { signal?: AbortSignal; timeoutMs?: number },
  ): Promise<RequestResult<RequestOutput<C>>> {
    const cancellation = new AbortController();
    const signal = AbortSignal.any([
      this.controller.signal,
      cancellation.signal,
      ...(options?.signal ? [options.signal] : []),
    ]);
    const cancelled = (): RequestResult<RequestOutput<C>> => ({
      ok: false,
      error: { code: "cancelled", message: "Request cancelled" },
    });
    if (signal.aborted) return cancelled();
    const binding =
      this.requestBindings.get(contract.id) ??
      this.parent?.findRequest(contract.id);
    if (!binding)
      return {
        ok: false,
        error: {
          code: "unavailable",
          message: `Missing request provider: ${contract.id}`,
        },
      };
    if (binding.contract !== contract)
      throw new Error(`Contract version/reference mismatch: ${contract.id}`);
    if (contract.requiresEdit) {
      const permissions = this.findDataById("host.project.permissions@1");
      const state = permissions?.read();
      if (
        state?.status !== "ready" ||
        !(state.value as { canEdit: boolean }).canEdit
      )
        return {
          ok: false,
          error: { code: "forbidden", message: "Editor permission required" },
        };
    }
    let parsed: RequestInput<C>;
    try {
      parsed = contract.inputSchema.parse(input) as RequestInput<C>;
    } catch (error) {
      return {
        ok: false,
        error: { code: "invalid-input", message: String(error) },
      };
    }
    return new Promise((resolve) => {
      if (contract.requiresEdit) this.editorRequests.add(cancellation);
      const timeout = setTimeout(
        () => cancellation.abort(),
        options?.timeoutMs ?? 120_000,
      );
      const cleanup = () => {
        clearTimeout(timeout);
        this.editorRequests.delete(cancellation);
        signal.removeEventListener("abort", abort);
      };
      const abort = () => {
        cleanup();
        resolve(cancelled());
      };
      signal.addEventListener("abort", abort, { once: true });
      let task: unknown;
      try {
        task = binding.handle(parsed as never, signal);
      } catch (error) {
        task = Promise.reject(error);
      }
      Promise.resolve(task)
        .then((value) => {
          if (signal.aborted) {
            resolve(cancelled());
            return;
          }
          resolve({
            ok: true,
            value: contract.outputSchema.parse(value) as RequestOutput<C>,
          });
        })
        .catch((error: unknown) => {
          const status = (error as { status?: number })?.status;
          const declaredCode = (error as { code?: unknown })?.code;
          let checkedCode:
            | import("@camera-path/contracts/contract-types").RequestErrorCode
            | undefined;
          if (declaredCode !== undefined) {
            try {
              checkedCode = contract.errorSchema.parse(declaredCode);
            } catch {
              checkedCode = "failed";
            }
          }
          resolve({
            ok: false,
            error: {
              code:
                checkedCode ??
                (status === 409
                  ? "conflict"
                  : status === 401 || status === 403
                    ? "forbidden"
                    : "failed"),
              message: error instanceof Error ? error.message : String(error),
            },
          });
        })
        .finally(cleanup);
    });
  }
  private findDataById(id: string): DataBinding | undefined {
    return this.dataBindings.get(id) ?? this.parent?.findDataById(id);
  }
  private findData(contract: DataContract): DataBinding {
    this.assertAlive();
    const b = this.findDataById(contract.id);
    if (!b) throw new Error(`Missing data provider: ${contract.id}`);
    if (b.contract !== contract)
      throw new Error(`Contract version/reference mismatch: ${contract.id}`);
    return b;
  }
  private findRequest(id: string): RequestBinding | undefined {
    return this.requestBindings.get(id) ?? this.parent?.findRequest(id);
  }
  private assertAlive() {
    if (this.controller.signal.aborted)
      throw new Error(`Disposed scope: ${this.scopeId}`);
  }
  private record(
    feature: string,
    operation: string,
    contract: string,
    allowed: boolean,
  ) {
    this.trace.push({
      feature,
      scopeId: this.scopeId,
      operation,
      contract,
      result: allowed ? "allowed" : "denied",
    });
    if (this.trace.length > 500) this.trace.shift();
  }
  revokeEditorRequests() {
    for (const request of this.editorRequests) request.abort();
    for (const child of this.children) child.revokeEditorRequests();
  }
  dispose() {
    this.parent?.children.delete(this);
    for (const child of [...this.children]) child.dispose();
    this.children.clear();
    if (this.controller.signal.aborted) return;
    this.controller.abort();
    for (const cleanup of this.cleanups) cleanup();
    this.cleanups.clear();
    this.contexts.clear();
    this.manifests.clear();
    this.dataBindings.clear();
    this.requestBindings.clear();
    this.localPublishers.clear();
  }
}
