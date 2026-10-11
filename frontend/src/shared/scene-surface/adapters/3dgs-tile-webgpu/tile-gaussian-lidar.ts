import {
  gaussianPass,
  rasterOutputDepth,
  type GaussianRenderStore,
} from "3dgs-tile-webgpu";
import {
  Camera,
  InstancedMesh,
  Matrix4,
  MeshStandardNodeMaterial,
  SphereGeometry,
  StorageInstancedBufferAttribute,
  type WebGPURenderer,
} from "three/webgpu";
import { attribute, positionLocal, uniform } from "three/tsl";
import type {
  GaussianLidarInstance,
  GaussianLidarSettings,
} from "../../model/gaussian-lidar";
import { createLidarProjectionNode } from "./create-lidar-projection-node";
import { createLidarHitKernel } from "./create-lidar-hit-kernel";

export class TileGaussianLidar implements GaussianLidarInstance {
  readonly object: InstancedMesh;
  private readonly camera = new Camera();
  private readonly pass;
  private readonly geometry = new SphereGeometry(0.01, 8, 6);
  private readonly material = new MeshStandardNodeMaterial({
    color: 0x35f2a1,
    roughness: 0.65,
    metalness: 0,
    opacity: 0.45,
    transparent: true,
    depthWrite: false,
  });
  private readonly hits;
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
    this.hits = new StorageInstancedBufferAttribute(width * height, 4);
    // Geometry owns this storage attribute so its GPU buffer is released on dispose.
    this.geometry.setAttribute("lidarHit", this.hits);
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
      this.hits,
      this.worldMatrix,
      width,
      height,
      fov,
      10000,
    );
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
