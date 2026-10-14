import type { GpuResourceDefinition } from "@camera-path/contracts/gpu-resources";
export interface GpuLease<T> {
  readonly generation: number;
  readonly ready: boolean;
  read(): T;
}
export class GpuRegistry {
  private readonly resources = new Map<
    string,
    {
      contract: GpuResourceDefinition;
      owner: string;
      value: unknown;
      generation: number;
      ready: boolean;
      valid: boolean;
    }
  >();
  private generation = 0;
  publish<T>(
    contract: GpuResourceDefinition<string, T>,
    owner: string,
    value: T,
    ready = false,
  ) {
    if (owner !== "host" && !contract.id.startsWith(owner + "."))
      throw new Error(`Invalid GPU resource owner: ${contract.id}`);
    if (this.resources.has(contract.id))
      throw new Error(`Duplicate GPU producer: ${contract.id}`);
    const validated = contract.validate(value);
    const physical =
      contract.resourceKind === "texture"
        ? (validated as { texture: object }).texture
        : contract.resourceKind === "buffer"
          ? (validated as { buffer: object }).buffer
          : null;
    if (
      physical &&
      [...this.resources.values()].some(
        (r) =>
          r.contract.resourceKind === contract.resourceKind &&
          ((r.value as { texture?: object; buffer?: object }).texture ??
            (r.value as { buffer?: object }).buffer) === physical,
      )
    )
      throw new Error("Conflicting GPU resource aliases");
    const resource = {
      contract,
      owner,
      value: validated,
      generation: ++this.generation,
      ready,
      valid: true,
    };
    this.resources.set(contract.id, resource);
    return {
      ready: () => {
        if (resource.valid) resource.ready = true;
      },
      dispose: () => {
        resource.valid = false;
        resource.ready = false;
        if (this.resources.get(contract.id) === resource)
          this.resources.delete(contract.id);
      },
    };
  }
  lease<T>(contract: GpuResourceDefinition<string, T>): GpuLease<T> {
    const resource = this.resources.get(contract.id);
    if (!resource || resource.contract !== contract)
      throw new Error(`Missing GPU provider: ${contract.id}`);
    return {
      generation: resource.generation,
      get ready() {
        return resource.valid && resource.ready;
      },
      read() {
        if (!resource.valid || !resource.ready)
          throw new Error(`Stale or unready GPU lease: ${contract.id}`);
        return resource.value as T;
      },
    };
  }
  clear() {
    for (const resource of this.resources.values()) {
      resource.valid = false;
      resource.ready = false;
    }
    this.resources.clear();
  }
}
