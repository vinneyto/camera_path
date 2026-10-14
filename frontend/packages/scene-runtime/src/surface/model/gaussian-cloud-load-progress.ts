export interface GaussianCloudLoadProgress {
  /** Null means the server did not provide a usable total size. */
  fraction: number | null;
  loadedBytes: number;
  totalBytes: number | null;
  phase: "download" | "processing" | "ready";
}
