import type {
  GaussianCloudInstance,
  GaussianCloudOptions,
  GaussianRenderingBackend,
} from "./gaussian-rendering-backend";
import type { GaussianCloudSource } from "./scene-surface-types";

interface GaussianCloudResourceEntry {
  disposed: boolean;
  name: string | undefined;
  promise: Promise<GaussianCloudInstance>;
  source: GaussianCloudSource;
  users: number;
}

export interface GaussianCloudResourceLease {
  readonly promise: Promise<GaussianCloudInstance>;
  release(): void;
}

export class GaussianCloudResourceCache {
  private readonly entries: GaussianCloudResourceEntry[] = [];

  constructor(private readonly backend: GaussianRenderingBackend) {}

  acquire(
    source: GaussianCloudSource,
    options: GaussianCloudOptions = {},
  ): GaussianCloudResourceLease {
    const name = options.name;
    let entry = this.entries.find(
      (candidate) => !candidate.disposed
        && candidate.name === name
        && this.sourcesMatch(candidate.source, source),
    );

    if (entry === undefined) {
      entry = {
        disposed: false,
        name,
        promise: this.backend.createCloud(source, options),
        source,
        users: 0,
      };
      this.entries.push(entry);
      const createdEntry = entry;
      void entry.promise.catch(() => {
        this.remove(createdEntry);
      });
    }

    entry.users += 1;
    let released = false;

    return {
      promise: entry.promise,
      release: () => {
        if (released) return;
        released = true;
        entry.users -= 1;

        queueMicrotask(() => {
          if (entry.users > 0 || entry.disposed) return;
          entry.disposed = true;
          this.remove(entry);
          void entry.promise.then((cloud) => cloud.dispose()).catch(() => undefined);
        });
      },
    };
  }

  private remove(entry: GaussianCloudResourceEntry): void {
    const index = this.entries.indexOf(entry);
    if (index >= 0) this.entries.splice(index, 1);
  }

  private sourcesMatch(
    left: GaussianCloudSource,
    right: GaussianCloudSource,
  ): boolean {
    if (left.kind !== right.kind) return false;
    if (left.kind === "url" && right.kind === "url") return left.url === right.url;
    if (left.kind === "buffer" && right.kind === "buffer") {
      return left.buffer === right.buffer && left.name === right.name;
    }
    return false;
  }
}
