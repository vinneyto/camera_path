import type { GaussianCloudLoadProgress } from "./gaussian-cloud-load-progress";
import type {
  GaussianCloudInstance,
  GaussianCloudOptions,
  GaussianRenderingBackend,
} from "./gaussian-rendering-backend";
import type { GaussianCloudSource } from "./scene-surface-types";

interface GaussianCloudResourceEntry {
  disposed: boolean;
  controller: AbortController;
  progress: {
    value: GaussianCloudLoadProgress | null;
    listeners: Set<(progress: GaussianCloudLoadProgress) => void>;
  };
  resourceKey: string | undefined;
  name: string | undefined;
  promise: Promise<GaussianCloudInstance>;
  source: GaussianCloudSource;
  users: number;
}

export interface GaussianCloudResourceLease {
  readonly promise: Promise<GaussianCloudInstance>;
  subscribeProgress(
    listener: (progress: GaussianCloudLoadProgress) => void,
  ): () => void;
  release(): void;
}

export class GaussianCloudResourceCache {
  private readonly entries: GaussianCloudResourceEntry[] = [];

  constructor(private readonly backend: GaussianRenderingBackend) {}

  acquire(
    source: GaussianCloudSource,
    options: GaussianCloudOptions = {},
    resourceKey?: string,
  ): GaussianCloudResourceLease {
    const name = options.name;
    let entry = this.entries.find(
      (candidate) =>
        !candidate.disposed &&
        (resourceKey === undefined
          ? candidate.resourceKey === undefined &&
            candidate.name === name &&
            this.sourcesMatch(candidate.source, source)
          : candidate.resourceKey === resourceKey),
    );

    if (entry === undefined) {
      const controller = new AbortController();
      const progress = {
        value: null as GaussianCloudLoadProgress | null,
        listeners: new Set<(progress: GaussianCloudLoadProgress) => void>(),
      };
      entry = {
        disposed: false,
        controller,
        progress,
        resourceKey,
        name,
        promise: this.backend.createCloud(source, {
          ...options,
          signal: controller.signal,
          onProgress: (update) => {
            progress.value = update;
            for (const listener of progress.listeners) listener(update);
          },
        }),
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
      subscribeProgress: (listener) => {
        entry.progress.listeners.add(listener);
        if (entry.progress.value) listener(entry.progress.value);
        return () => entry.progress.listeners.delete(listener);
      },
      release: () => {
        if (released) return;
        released = true;
        entry.users -= 1;

        queueMicrotask(() => {
          if (entry.users > 0 || entry.disposed) return;
          entry.disposed = true;
          entry.progress.listeners.clear();
          entry.controller.abort();
          this.remove(entry);
          void entry.promise
            .then((cloud) => cloud.dispose())
            .catch(() => undefined);
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
    if (left.kind === "url" && right.kind === "url")
      return left.url === right.url && left.format === right.format;
    if (left.kind === "buffer" && right.kind === "buffer") {
      return left.buffer === right.buffer && left.name === right.name;
    }
    return false;
  }
}
