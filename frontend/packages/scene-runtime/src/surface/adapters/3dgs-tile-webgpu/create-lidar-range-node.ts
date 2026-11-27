import { Fn, If, float, ivec2, max, min, textureLoad, vec2 } from "three/tsl";
import type { Node, TextureNode } from "three/webgpu";
import { DEPTH_FAR, DEPTH_NEAR } from "../../depth/constants";
export function createLidarRangeNode(
  ray: Node<"vec3">,
  faces: TextureNode[],
  size: Node<"float">,
  hasValidity: Node<"float">,
) {
  return Fn(() => {
    const a = ray.abs(),
      d = max(max(a.x, a.y), a.z),
      uv = vec2(0).toVar(),
      face = float(0).toVar();
    If(a.x.greaterThanEqual(a.y).and(a.x.greaterThanEqual(a.z)), () => {
      face.assign(ray.x.greaterThanEqual(0).select(0, 1));
      uv.assign(
        vec2(
          ray.x.greaterThanEqual(0).select(ray.z.negate(), ray.z),
          ray.y.negate(),
        ).div(d),
      );
    })
      .ElseIf(a.y.greaterThanEqual(a.z), () => {
        face.assign(ray.y.greaterThanEqual(0).select(2, 3));
        uv.assign(
          vec2(
            ray.x,
            ray.y.greaterThanEqual(0).select(ray.z, ray.z.negate()),
          ).div(d),
        );
      })
      .Else(() => {
        face.assign(ray.z.greaterThanEqual(0).select(4, 5));
        uv.assign(
          vec2(
            ray.z.greaterThanEqual(0).select(ray.x, ray.x.negate()),
            ray.y.negate(),
          ).div(d),
        );
      });
    // WebGPU textures use top-left pixel coordinates.
    const pixel = ivec2(
      min(
        max(
          vec2(uv.x.mul(0.5).add(0.5), uv.y.mul(-0.5).add(0.5))
            .mul(size)
            .floor(),
          vec2(0),
        ),
        vec2(size.sub(1)),
      ),
    );
    const z = float(0).toVar();
    for (let i = 0; i < 6; i++)
      If(face.equal(i), () => {
        z.assign(textureLoad(faces[i], pixel).r);
      });
    const allReady = faces
      .map((face) => textureLoad(face, ivec2(0)).g.greaterThan(0.5))
      .reduce((a, b) => a.and(b));
    const complete = hasValidity.equal(0).or(allReady);
    const range = z.div(d);
    return complete
      .and(z.greaterThanEqual(DEPTH_NEAR).and(range.lessThanEqual(DEPTH_FAR)))
      .select(range, 0);
  })();
}
