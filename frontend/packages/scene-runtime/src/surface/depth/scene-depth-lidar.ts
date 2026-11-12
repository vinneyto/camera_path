import { Matrix4, Vector3, type Camera, type Scene } from "three";
import type { GaussianLidarInstance } from "../model/gaussian-lidar";
import type { SceneDepthCapture } from "./scene-depth-capture";
import type { GpuLidarView } from "./gpu-lidar-view";
import { LIDAR_CAPTURE_INTERVAL_MS, LIDAR_ERROR_RETRY_MS } from "./constants";

/** Shared scheduling and pose snapshots. Depth, radial bins and hit placement stay on GPU. */
export class SceneDepthLidar implements GaussianLidarInstance {
  readonly object;
  readonly ranges;
  readonly diagnostics = {
    captures: 0,
    // End-to-end completion time, including a GPU fence without data readback.
    captureMs: 0,
    error: null as string | null,
  };
  private readonly pose = new Matrix4();
  private disposed = false;
  private inFlight = false;
  private nextCapture = 0;
  private poseReady = false;
  constructor(
    private readonly capture: SceneDepthCapture,
    private readonly view: GpuLidarView,
    private readonly onDispose: () => void = () => undefined,
  ) {
    this.object = view.object;
    this.ranges = view.ranges;
    this.object.userData.lidarDiagnostics = this.diagnostics;
    this.object.visible = false;
  }
  setPose(camera: Camera): void {
    camera.updateWorldMatrix(true, false);
    this.pose
      .extractRotation(camera.matrixWorld)
      .setPosition(new Vector3().setFromMatrixPosition(camera.matrixWorld));
    this.poseReady = true;
  }
  update(scene: Scene): void {
    const now = performance.now();
    if (
      this.disposed ||
      !this.poseReady ||
      this.inFlight ||
      now < this.nextCapture
    )
      return;
    this.inFlight = true;
    const pose = this.pose.clone();
    this.nextCapture = now + LIDAR_CAPTURE_INTERVAL_MS;
    void this.capture
      .render(scene, pose)
      .then(async (cube) => {
        if (this.disposed) return;
        if (!cube) {
          this.object.visible = false;
          return;
        }
        await this.view.draw(cube, pose);
        if (this.disposed) return;
        this.object.visible = true;
        this.diagnostics.captures++;
        this.diagnostics.captureMs = performance.now() - now;
        this.diagnostics.error = null;
      })
      .catch((error: unknown) => {
        if (!this.disposed) {
          this.object.visible = false;
          const message =
            error instanceof Error ? error.message : String(error);
          if (message !== this.diagnostics.error)
            console.error("LiDAR depth capture failed", error);
          this.diagnostics.error = message;
          this.nextCapture = performance.now() + LIDAR_ERROR_RETRY_MS;
        }
      })
      .finally(() => {
        this.inFlight = false;
        if (this.disposed) this.releaseResources();
      });
  }
  private releaseResources(): void {
    this.capture.dispose();
    this.view.dispose();
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.object.removeFromParent();
    if (!this.inFlight) this.releaseResources();
    this.onDispose();
  }
}
