import { MeshBasicNodeMaterial, NoBlending, type Texture } from "three/webgpu";
import {
  Fn,
  float,
  min,
  vec3,
  screenCoordinate,
  textureLoad,
  ivec2,
  uniform,
} from "three/tsl";
import type { GaussianPass } from "3dgs-tile-webgpu";
export function createTileDepthMergeMaterial(
  pass: GaussianPass,
  meshDepth: Texture,
) {
  const hasSplats = uniform(0);
  const material = new MeshBasicNodeMaterial({
    depthTest: false,
    depthWrite: false,
    blending: NoBlending,
    toneMapped: false,
  });
  material.colorNode = Fn(() => {
    const pixel = ivec2(screenCoordinate);
    const a = textureLoad(meshDepth, pixel).r,
      b = textureLoad(pass.depthTexture!, pixel).r;
    const nearest = a
      .greaterThan(0)
      .and(b.greaterThan(0))
      .select(min(a, b), a.greaterThan(0).select(a, b));
    // Never expose a mesh-only partial frame while Gaussian output is incomplete.
    const ready = hasSplats.equal(0).or(pass.outputReadyNode);
    return vec3(ready.select(nearest, float(0)), ready.select(1, 0), 0);
  })();
  return { material, hasSplats };
}
