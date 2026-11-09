// Spark 2.2 public custom fragment hook; retain its stock vertex shader and
// covariance transform. Read float32 centers directly, without RGB/depth01 packing.
export const SPARK_DEPTH_FRAGMENT = /* glsl */ `
precision highp float;
precision highp usampler2DArray;
#include <splatDefines>
uniform usampler2DArray extSplats;
uniform usampler2DArray extSplats2;
uniform mat3 renderToViewBasis;
uniform vec3 renderToViewPos;
flat in uint vSplatIndex;
in vec4 vRgba;
in vec2 vSplatUv;
flat in float adjustedStdDev;
out vec4 fragColor;
void main() {
  if (dot(vSplatUv, vSplatUv) > adjustedStdDev * adjustedStdDev || vRgba.a <= 0.0) discard;
  ivec3 coord = splatTexCoord(int(vSplatIndex));
  vec3 center, covarianceDiagonal, covarianceOffDiagonal;
  vec4 rgba;
  unpackSplatExtCov(texelFetch(extSplats, coord, 0), texelFetch(extSplats2, coord, 0),
    center, rgba, covarianceDiagonal, covarianceOffDiagonal);
  float viewZ = -(renderToViewBasis * center + renderToViewPos).z;
  fragColor = vec4(viewZ, 0.0, 0.0, 1.0);
}
`;
