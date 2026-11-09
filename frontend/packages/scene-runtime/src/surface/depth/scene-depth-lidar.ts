import {
  DataTexture,
  DynamicDrawUsage,
  FloatType,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  NearestFilter,
  NoColorSpace,
  RedFormat,
  SphereGeometry,
  Vector3,
  type Camera,
  type Scene,
} from "three";
import type {
  GaussianLidarInstance,
  GaussianLidarSettings,
} from "../model/gaussian-lidar";
import type { SceneDepthCapture } from "./scene-depth-capture";
import { createLidarRays } from "./create-lidar-rays";
import { sampleDepthCube } from "./sample-depth-cube";
import {
  LIDAR_CAPTURE_INTERVAL_MS,
  LIDAR_ERROR_RETRY_MS,
  LIDAR_HIT_COLOR,
  LIDAR_HIT_RADIUS,
  LIDAR_HIT_RENDER_ORDER,
  LIDAR_HIT_SEGMENTS,
} from "./constants";

/** The same capture -> radial bins -> world-space hits lifecycle on both APIs.
 * A bounded CPU readback is intentional: no renderer-specific feature or
 * drawing path, and no collision rays against incomplete camera-visible data.
 */
export class SceneDepthLidar implements GaussianLidarInstance {
  readonly object: InstancedMesh;
  readonly ranges;
  readonly diagnostics = {
    captures: 0,
    captureMs: 0,
    hitCount: 0,
    error: null as string | null,
  };
  private readonly pose = new Matrix4();
  private readonly rays;
  private readonly data;
  private readonly texture;
  private readonly geometry = new SphereGeometry(
    LIDAR_HIT_RADIUS,
    LIDAR_HIT_RENDER_ORDER,
    LIDAR_HIT_SEGMENTS,
    LIDAR_HIT_SEGMENTS,
  );
  private readonly material = new MeshBasicMaterial({
    color: LIDAR_HIT_COLOR,
    // Spark is in Three's transparent queue. Opaque hits would be painted
    // before it regardless of renderOrder. WebGPU also composites this queue
    // after the Gaussian layer. Keep normal mesh depth testing enabled.
    transparent: true,
    depthWrite: false,
  });
  private disposed = false;
  private inFlight = false;
  private nextCapture = 0;
  private poseReady = false;
  constructor(
    private readonly capture: SceneDepthCapture,
    settings: GaussianLidarSettings,
    private readonly onDispose: () => void = () => undefined,
  ) {
    const { horizontalResolution: width, verticalResolution: height } =
      settings;
    this.rays = createLidarRays(settings);
    this.data = new Float32Array(width * height).fill(Infinity);
    this.texture = new DataTexture(
      this.data,
      width,
      height,
      RedFormat,
      FloatType,
    );
    this.texture.colorSpace = NoColorSpace;
    this.texture.minFilter = this.texture.magFilter = NearestFilter;
    this.texture.generateMipmaps = false;
    this.texture.needsUpdate = true;
    this.ranges = {
      texture: this.texture,
      width,
      height,
      units: "meters" as const,
      format: "r32float" as const,
      invalidValue: Infinity,
    };
    this.object = new InstancedMesh(
      this.geometry,
      this.material,
      width * height,
    );
    this.object.instanceMatrix.setUsage(DynamicDrawUsage);
    this.object.name = "LiDAR hits";
    this.object.renderOrder = LIDAR_HIT_RENDER_ORDER;
    this.object.userData.excludeFromSceneDepth = true;
    this.object.userData.lidarDiagnostics = this.diagnostics;
    this.object.frustumCulled = false;
    this.object.visible = false;
    this.object.raycast = () => undefined;
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
      .capture(scene, pose)
      .then((cube) => {
        if (this.disposed) return;
        if (!cube) {
          this.object.visible = false;
          return;
        }
        sampleDepthCube(cube, this.rays, this.data);
        const point = new Vector3(),
          matrix = new Matrix4();
        let count = 0;
        for (let i = 0; i < this.data.length; i++) {
          const range = this.data[i];
          if (!Number.isFinite(range)) continue;
          point
            .fromArray(this.rays, i * 3)
            .multiplyScalar(range)
            .applyMatrix4(pose);
          matrix.makeTranslation(point.x, point.y, point.z);
          this.object.setMatrixAt(count++, matrix);
        }
        this.object.count = count;
        this.object.instanceMatrix.clearUpdateRanges();
        if (count > 0) this.object.instanceMatrix.addUpdateRange(0, count * 16);
        this.object.instanceMatrix.needsUpdate = true;
        this.object.visible = count > 0;
        this.texture.needsUpdate = true;
        this.diagnostics.captures++;
        this.diagnostics.hitCount = count;
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
        if (this.disposed) this.capture.dispose();
      });
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.object.removeFromParent();
    if (!this.inFlight) this.capture.dispose();
    this.texture.dispose();
    this.geometry.dispose();
    this.material.dispose();
    this.object.dispose();
    this.onDispose();
  }
}
