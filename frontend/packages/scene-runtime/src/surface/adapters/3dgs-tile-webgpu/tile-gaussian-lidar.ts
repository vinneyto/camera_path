import {
  gaussianPass,
  rasterOutputDepth,
  type GaussianRenderStore,
} from "3dgs-tile-webgpu";
import { createLidarHitKernel } from "@camera-path/scene-runtime/surface/adapters/3dgs-tile-webgpu/create-lidar-hit-kernel";
import { createLidarProjectionNode } from "@camera-path/scene-runtime/surface/adapters/3dgs-tile-webgpu/create-lidar-projection-node";
import type {
  GaussianLidarInstance,
  GaussianLidarSettings,
} from "@camera-path/scene-runtime/surface/model/gaussian-lidar";
import { attribute, positionLocal, uniform } from "three/tsl";
import {
  Camera,
  InstancedMesh,
  Matrix4,
  MeshStandardNodeMaterial,
  SphereGeometry,
  StorageInstancedBufferAttribute,
  type WebGPURenderer,
} from "three/webgpu";

export class TileGaussianLidar implements GaussianLidarInstance {
  readonly object: InstancedMesh;
  private readonly camera = new Camera();
  private readonly pass;
  private readonly geometry = new SphereGeometry(0.01, 8, 6);
  private readonly material = new MeshStandardNodeMaterial({
    color: 0x35f2a1,
    emissive: 0x35f2a1,
    emissiveIntensity: 0.12,
    roughness: 0.65,
    metalness: 0,
    opacity: 0.55,
    transparent: true,
    depthWrite: false,
  });
  private readonly hitBuffer;
  private readonly hitKernel;
  private readonly worldMatrix = uniform(new Matrix4());
  private disposed = false;

  constructor(
    private readonly renderer: WebGPURenderer,
    store: GaussianRenderStore,
    settings: GaussianLidarSettings,
    private readonly onDispose: () => void,
  ) {
    const {
      horizontalResolution: width,
      verticalResolution: height,
      verticalFovDegrees,
    } = settings;
    const fov = (verticalFovDegrees * Math.PI) / 180;
    this.pass = gaussianPass(renderer, this.camera, store, {
      dataMode: "external",
      fixedSize: { width, height },
      depthRange: [0.01, 10000],
      boundaryPolicy: "repeat-x",
      outputDepth: true,
      invalidDepthValue: Infinity,
      background: [0, 0, 0, 0],
      depthAlphaThreshold: 0.95,
      redrawStrategy: "auto",
    });
    this.pass.gaussianProjectionNode = createLidarProjectionNode(fov);
    this.pass.rasterOutputDepthNode = rasterOutputDepth;
    this.hitBuffer = new StorageInstancedBufferAttribute(width * height, 4);
    // Geometry owns this storage attribute so its GPU buffer is released on dispose.
    this.geometry.setAttribute("lidarHit", this.hitBuffer);
    const hit = attribute<"vec4">("lidarHit", "vec4");
    this.material.positionNode = positionLocal.mul(hit.w).add(hit.xyz);
    this.object = new InstancedMesh(
      this.geometry,
      this.material,
      width * height,
    );
    this.object.name = "Experimental LiDAR hits";
    this.object.frustumCulled = false; // GPU positions are world-space; CPU bounds are meaningless.
    this.object.visible = false;
    this.object.raycast = () => {}; // Hits must not intercept authoring/autofocus rays.
    this.hitKernel = createLidarHitKernel(
      this.pass.depthTexture!,
      this.hitBuffer,
      this.worldMatrix,
      width,
      height,
      fov,
      10000,
      this.pass.outputReadyNode,
    );
  }

  get ranges() {
    return {
      texture: this.pass.depthTexture!,
      width: (this.pass.depthTexture!.image as { width: number }).width,
      height: (this.pass.depthTexture!.image as { height: number }).height,
      units: "meters" as const,
      format: "r32float" as const,
      invalidValue: Infinity,
    };
  }
  get hits() {
    return {
      buffer: this.hitBuffer,
      count: this.hitBuffer.count,
      stride: 4 as const,
      coordinates: "world" as const,
    };
  }

  setPose(camera: Camera): void {
    this.camera.position.copy(camera.position);
    this.camera.quaternion.copy(camera.quaternion);
    this.camera.scale.copy(camera.scale);
    this.camera.updateMatrixWorld();
    this.worldMatrix.value.copy(camera.matrixWorld);
  }

  render(): void {
    if (this.disposed) return;
    this.pass.render();
    if (this.pass.renderCount === 0) {
      this.object.visible = false;
      return;
    }
    // Submission order on one renderer: main pass -> angular pass -> hits -> scene.
    this.renderer.compute(this.hitKernel);
    this.object.visible = true;
  }

  hide(): void {
    this.object.visible = false;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.object.removeFromParent();
    this.pass.dispose();
    this.hitKernel.dispose();
    this.geometry.dispose();
    this.material.dispose();
    this.object.dispose();
    this.onDispose();
  }
}
