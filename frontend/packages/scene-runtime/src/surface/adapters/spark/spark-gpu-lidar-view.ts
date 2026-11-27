import { waitForWebGlGpu } from "./wait-for-webgl-gpu";
import {
  Color,
  FloatType,
  GLSL3,
  Matrix4,
  Mesh,
  NearestFilter,
  NoBlending,
  NoColorSpace,
  OrthographicCamera,
  PlaneGeometry,
  RedFormat,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector4,
  WebGLRenderTarget,
  type WebGLRenderer,
} from "three";
import type { GaussianLidarSettings } from "../../model/gaussian-lidar";
import type { SceneDepthGpuCube } from "../../depth/scene-depth-capture";
import type { GpuLidarView } from "../../depth/gpu-lidar-view";
import { createLidarHitMesh } from "../../depth/create-lidar-hit-mesh";
import { createSparkLidarHitMaterial } from "./create-spark-lidar-hit-material";
import { LIDAR_RANGE_FRAGMENT } from "./lidar-glsl";
export class SparkGpuLidarView implements GpuLidarView {
  readonly object;
  readonly ranges;
  private readonly target;
  private readonly pose = new Matrix4();
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly quad;
  constructor(
    private readonly renderer: WebGLRenderer,
    settings: GaussianLidarSettings,
  ) {
    const width = settings.horizontalResolution,
      height = settings.verticalResolution;
    this.target = new WebGLRenderTarget(width, height, {
      type: FloatType,
      format: RedFormat,
      internalFormat: "R32F",
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      generateMipmaps: false,
      depthBuffer: false,
      colorSpace: NoColorSpace,
    });
    this.ranges = {
      texture: this.target.texture,
      width,
      height,
      units: "meters" as const,
      format: "r32float" as const,
      invalidValue: 0,
    };
    this.object = createLidarHitMesh(
      createSparkLidarHitMaterial(this.target.texture, this.pose, settings),
      settings,
    );
    const uniforms: Record<string, { value: unknown }> = {
      lidarSize: { value: new Vector2(width, height) },
      faceSize: { value: 1 },
      verticalFov: { value: (settings.verticalFovDegrees * Math.PI) / 180 },
    };
    for (let i = 0; i < 6; i++) uniforms["depth" + i] = { value: null };
    this.quad = new Mesh(
      new PlaneGeometry(2, 2),
      new ShaderMaterial({
        glslVersion: GLSL3,
        uniforms,
        vertexShader: "void main(){gl_Position=vec4(position.xy,0.0,1.0);}",
        fragmentShader: LIDAR_RANGE_FRAGMENT,
        depthTest: false,
        depthWrite: false,
        blending: NoBlending,
        toneMapped: false,
      }),
    );
    this.scene.add(this.quad);
  }
  draw(cube: SceneDepthGpuCube, pose: Matrix4) {
    if (cube.origin !== "bottom-left")
      throw new Error("Spark LiDAR requires native WebGL depth textures");
    const renderer = this.renderer,
      target = renderer.getRenderTarget(),
      face = renderer.getActiveCubeFace(),
      mip = renderer.getActiveMipmapLevel();
    const viewport = renderer.getViewport(new Vector4()),
      scissor = renderer.getScissor(new Vector4()),
      scissorTest = renderer.getScissorTest(),
      autoClear = renderer.autoClear,
      xr = renderer.xr.enabled;
    const color = renderer.getClearColor(new Color()),
      alpha = renderer.getClearAlpha();
    try {
      renderer.xr.enabled = false;
      renderer.autoClear = true;
      renderer.setScissorTest(false);
      for (let i = 0; i < 6; i++)
        this.quad.material.uniforms["depth" + i].value = cube.faces[i];
      this.quad.material.uniforms.faceSize.value = cube.size;
      renderer.setRenderTarget(this.target);
      renderer.render(this.scene, this.camera);
      this.pose.copy(pose);
    } finally {
      renderer.setRenderTarget(target, face, mip);
      renderer.setViewport(viewport);
      renderer.setScissor(scissor);
      renderer.setScissorTest(scissorTest);
      renderer.setClearColor(color, alpha);
      renderer.autoClear = autoClear;
      renderer.xr.enabled = xr;
    }
    return waitForWebGlGpu(renderer.getContext());
  }
  /** Explicit diagnostics/export only; the live scheduler never invokes readback. */
  async readRanges(): Promise<Float32Array> {
    const pixels = new Float32Array(this.ranges.width * this.ranges.height);
    await this.renderer.readRenderTargetPixelsAsync(
      this.target,
      0,
      0,
      this.ranges.width,
      this.ranges.height,
      pixels,
    );
    return pixels;
  }
  dispose() {
    this.target.dispose();
    this.quad.geometry.dispose();
    this.quad.material.dispose();
    this.object.geometry.dispose();
    this.object.material.dispose();
  }
}
