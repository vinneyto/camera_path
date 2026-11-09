import {
  Fn,
  If,
  instanceIndex,
  storage,
  textureLoad,
  uint,
  uvec2,
} from "three/tsl";
import type { GaussianPass } from "3dgs-tile-webgpu";
import type { StorageBufferAttribute } from "three/webgpu";
export function createTileDepthReadback(
  pass: GaussianPass,
  output: StorageBufferAttribute,
  size: number,
) {
  const data = storage(output, "float", size * size + 1);
  return Fn(() => {
    If(instanceIndex.equal(0), () => {
      data.element(size * size).assign(pass.outputReadyNode.select(1, 0));
    });
    const pixel = uvec2(
      instanceIndex.mod(uint(size)),
      instanceIndex.div(uint(size)),
    );
    const value = textureLoad(pass.depthTexture!, pixel).r;
    If(pass.outputReadyNode, () =>
      data.element(instanceIndex).assign(value),
    ).Else(() => data.element(instanceIndex).assign(0));
  })().compute(size * size);
}
