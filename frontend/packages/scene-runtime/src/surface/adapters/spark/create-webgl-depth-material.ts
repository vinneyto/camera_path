import {
  BasicDepthPacking,
  MeshDepthMaterial,
  NoBlending,
  type Material,
} from "three";
export function createWebGlDepthMaterial(original: Material): Material {
  const source = original as MeshDepthMaterial;
  const material = new MeshDepthMaterial({
    depthPacking: BasicDepthPacking,
    side: original.side,
    map: source.map ?? null,
    alphaMap: source.alphaMap ?? null,
    alphaTest: original.alphaTest,
    displacementMap: source.displacementMap ?? null,
    displacementScale: source.displacementScale ?? 1,
    displacementBias: source.displacementBias ?? 0,
    clippingPlanes: original.clippingPlanes,
    clipIntersection: original.clipIntersection,
    opacity: original.opacity,
    blending: NoBlending,
    toneMapped: false,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader =
      "varying float lidarViewZ;\n" +
      shader.vertexShader.replace(
        "#include <project_vertex>",
        "#include <project_vertex>\nlidarViewZ = -mvPosition.z;",
      );
    shader.fragmentShader =
      "varying float lidarViewZ;\n" +
      shader.fragmentShader.replace(
        "gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );",
        "gl_FragColor = vec4(lidarViewZ, 0.0, 0.0, 1.0);",
      );
  };
  material.customProgramCacheKey = () => "lidar-linear-view-z";
  return material;
}
