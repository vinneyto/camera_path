import { settleDepthReadbacks } from "../../depth/settle-depth-readbacks";
import { RENDER_PIPELINE_SCENE_LAYER } from "@camera-path/render-pipeline";
import { gaussianPass, GaussianStore } from "3dgs-tile-webgpu";
import {
  Color,
  FloatType,
  NearestFilter,
  NoColorSpace,
  RedFormat,
  RenderTarget,
  PerspectiveCamera,
  StorageBufferAttribute,
  Vector4,
  Scene,
  type Matrix4,
  type WebGPURenderer,
} from "three/webgpu";
import { createDepthCameras } from "../../depth/create-depth-cameras";
import {
  DEPTH_FAR,
  DEPTH_NEAR,
  DEPTH_OPAQUE_TRANSMITTANCE_THRESHOLD,
} from "../../depth/constants";
import { SceneDepthMaterials } from "../../depth/scene-depth-materials";
import type { SceneDepthCapture } from "../../depth/scene-depth-capture";
import { createWebGpuDepthMaterial } from "./create-webgpu-depth-material";
import { configureTileDepthPass } from "./configure-tile-depth-pass";
import { createTileDepthReadback } from "./create-tile-depth-readback";
import type { TileDepthSources } from "./tile-depth-source";
import type { GaussianCloud } from "3dgs-tile-webgpu";

export class WebGpuSceneDepthCapture implements SceneDepthCapture {
  // A camera-independent full source store: never reuse the editor's visible LOD cut.
  private readonly store = new GaussianStore();
  private readonly sourceScene = new Scene();
  private readonly copies = new Map<GaussianCloud, GaussianCloud>();
  private readonly camera = new PerspectiveCamera(90, 1, DEPTH_NEAR, DEPTH_FAR);
  private readonly pass;
  private readonly materials = new SceneDepthMaterials(
    createWebGpuDepthMaterial,
  );
  private readonly target;
  private readonly output;
  private readonly readback;
  private disposed = false;
  constructor(
    private readonly renderer: WebGPURenderer,
    private readonly size: number,
    private readonly sources: TileDepthSources,
  ) {
    this.pass = gaussianPass(renderer, this.camera, this.store, {
      fixedSize: { width: size, height: size },
      depthRange: [DEPTH_NEAR, DEPTH_FAR],
      outputDepth: true,
      invalidDepthValue: 0,
      rasterTransmittanceThreshold: DEPTH_OPAQUE_TRANSMITTANCE_THRESHOLD,
      depthAlphaThreshold: 0,
      depthSortMode: "float32",
      filterVariance: 0,
      antialiasMode: "classic",
      background: [0, 0, 0, 0],
      redrawStrategy: "always",
    });
    configureTileDepthPass(this.pass);
    this.target = new RenderTarget(size, size, {
      type: FloatType,
      format: RedFormat,
      colorSpace: NoColorSpace,
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      generateMipmaps: false,
      depthBuffer: true,
    });
    this.output = Array.from({ length: 6 }, () => {
      const output = new StorageBufferAttribute(size * size + 1, 1);
      return output;
    });
    this.readback = this.output.map((output) =>
      createTileDepthReadback(this.pass, output, size),
    );
  }
  async capture(scene: Scene, matrix: Matrix4) {
    if (this.disposed) return null;
    // Establish device capabilities before asking the worker to pack full sources.
    this.pass.render();
    for (const [source, copy] of this.copies)
      if (!this.sources.has(source)) {
        copy.dispose();
        this.copies.delete(source);
      }
    await Promise.all(
      [...this.sources].map(async ([source, record]) => {
        if (this.copies.has(source)) return;
        const copy = await this.store.loadBuffer(record.buffer.slice(0), {
          ...record.options,
          mipmaps: { type: "none" },
        });
        if (this.disposed || !this.sources.has(source)) {
          copy.dispose();
          return;
        }
        this.copies.set(source, copy);
        this.sourceScene.add(copy);
        await this.store.whenRenderReady(copy);
      }),
    );
    if (this.disposed) return null;
    scene.updateMatrixWorld(true);
    for (const [source, copy] of this.copies) {
      copy.matrixAutoUpdate = false;
      copy.matrix.copy(source.matrixWorld);
      copy.updateMatrixWorld(true);
      let visible = source.layers.isEnabled(RENDER_PIPELINE_SCENE_LAYER);
      let root: typeof source.parent = source;
      for (let node: typeof source.parent = source; node; node = node.parent) {
        visible = visible && node.visible;
        root = node;
      }
      copy.visible = visible && root === scene;
    }
    for (const copy of this.copies.values()) {
      if (copy.gaussianCount < this.store.getSourceCount(copy)) {
        throw new Error(
          "LiDAR full-scene source exceeds the device's Gaussian budget",
        );
      }
    }
    // Encode all faces before yielding, so animation cannot move geometry
    // halfway through a scan. Each readback owns its destination buffer.
    const pending = createDepthCameras(matrix).map((camera, face) => {
      this.camera.copy(camera);
      this.camera.updateMatrixWorld(true);
      const meshPixels = this.draw(scene);
      this.pass.render();
      this.renderer.compute(this.readback[face]);
      return Promise.all([
        meshPixels,
        this.renderer.getArrayBufferAsync(this.output[face]),
      ]);
    });
    const captured = await settleDepthReadbacks(pending);
    if (this.disposed) return null;
    const status = this.pass.getOutputStatus();
    if (status.error) throw new Error(status.error);
    const faces: Float32Array[] = [];
    for (const [pixels, splatBuffer] of captured) {
      const splats = new Float32Array(splatBuffer),
        meshes = pixels as Float32Array;
      // Incomplete/overflowed Gaussian output must never look like a mesh-only scan.
      if (this.store.count > 0 && splats[this.size * this.size] !== 1)
        return null;
      const result = new Float32Array(this.size * this.size);
      for (let i = 0; i < result.length; i++) {
        const a = meshes[i],
          b = splats[i];
        result[i] = a > 0 && b > 0 ? Math.min(a, b) : Math.max(a, b);
      }
      faces.push(result);
    }
    return { faces, size: this.size };
  }
  private draw(scene: Scene) {
    const renderer = this.renderer;
    const target = renderer.getRenderTarget(),
      face = renderer.getActiveCubeFace(),
      mip = renderer.getActiveMipmapLevel();
    const color = renderer.getClearColor(new Color()),
      alpha = renderer.getClearAlpha();
    const viewport = renderer.getViewport(new Vector4()),
      scissor = renderer.getScissor(new Vector4()),
      scissorTest = renderer.getScissorTest();
    const autoClear = renderer.autoClear;
    try {
      renderer.autoClear = true;
      renderer.setClearColor(0, 0);
      renderer.setScissorTest(false);
      renderer.setRenderTarget(this.target);
      this.materials.draw(scene, () => renderer.render(scene, this.camera));
      return renderer.readRenderTargetPixelsAsync(
        this.target,
        0,
        0,
        this.size,
        this.size,
      );
    } finally {
      renderer.setRenderTarget(target, face, mip);
      renderer.setClearColor(color, alpha);
      renderer.setViewport(viewport);
      renderer.setScissor(scissor);
      renderer.setScissorTest(scissorTest);
      renderer.autoClear = autoClear;
    }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.pass.dispose();
    this.store.dispose();
    this.target.dispose();
    for (const readback of this.readback) readback.dispose();
    this.materials.dispose();
    for (const output of this.output) output.dispose();
  }
}
