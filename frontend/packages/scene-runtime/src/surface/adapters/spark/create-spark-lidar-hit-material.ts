import { Matrix4, MeshPhongMaterial, Vector2, type Texture } from "three";
import type { GaussianLidarSettings } from "../../model/gaussian-lidar";
import {
  LIDAR_HIT_COLOR,
  LIDAR_HIT_OPACITY,
  LIDAR_HIT_RADIUS,
} from "../../depth/constants";
import { LIDAR_DIRECTION_GLSL } from "./lidar-glsl";
export function createSparkLidarHitMaterial(
  texture: Texture,
  pose: Matrix4,
  settings: GaussianLidarSettings,
) {
  const material = new MeshPhongMaterial({
    color: LIDAR_HIT_COLOR,
    opacity: LIDAR_HIT_OPACITY,
    transparent: true,
    depthWrite: false,
    specular: 0x000000,
    shininess: 0,
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      lidarRanges: { value: texture },
      lidarPose: { value: pose },
      lidarSize: {
        value: new Vector2(
          settings.horizontalResolution,
          settings.verticalResolution,
        ),
      },
      verticalFov: { value: (settings.verticalFovDegrees * Math.PI) / 180 },
    });
    shader.vertexShader =
      `uniform sampler2D lidarRanges;uniform mat4 lidarPose;uniform ivec2 lidarSize;uniform float verticalFov; varying vec3 lidarCenterView; varying vec3 lidarPlaneView;\n${LIDAR_DIRECTION_GLSL}\n` +
      shader.vertexShader;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <begin_vertex>",
        `
      ivec2 lidarPixel=ivec2(gl_InstanceID%lidarSize.x,gl_InstanceID/lidarSize.x);
      float lidarRange=texelFetch(lidarRanges,lidarPixel,0).r;
      vec3 lidarCenter=(lidarPose*vec4(lidarDirection(lidarPixel,lidarSize,verticalFov)*lidarRange,1.0)).xyz;
      lidarCenterView=(modelViewMatrix*vec4(lidarCenter,1.0)).xyz;
      vec2 extent=${LIDAR_HIT_RADIUS.toFixed(8)}*(vec2(1.0)+abs(lidarCenterView.xy)/max(0.0001,-lidarCenterView.z));
      extent*=max(1.0,-lidarCenterView.z/max(0.0001,-lidarCenterView.z-${LIDAR_HIT_RADIUS.toFixed(8)}));
      vec3 cameraRight=vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]);
      vec3 cameraUp=vec3(viewMatrix[0][1],viewMatrix[1][1],viewMatrix[2][1]);
      vec3 transformed=lidarCenter+cameraRight*position.x*extent.x+cameraUp*position.y*extent.y;
    `,
      )
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>\nlidarPlaneView=mvPosition.xyz; if(lidarRange<=0.0)gl_Position=vec4(2.0,2.0,2.0,1.0);`,
      );
    shader.fragmentShader =
      `uniform mat4 projectionMatrix; varying vec3 lidarCenterView; varying vec3 lidarPlaneView;\n` +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      `
      #include <normal_fragment_maps>
      vec3 ray=normalize(lidarPlaneView);
      float along=dot(ray,lidarCenterView);
      vec3 closest=ray*along-lidarCenterView;
      float discriminant=${(LIDAR_HIT_RADIUS ** 2).toFixed(10)}-dot(closest,closest);
      if(discriminant<0.0)discard;
      float root=sqrt(max(discriminant,0.0));
      normal=normalize(closest-ray*root);
      vec3 surface=ray*(along-root);
      vec4 clip=projectionMatrix*vec4(surface,1.0);
      gl_FragDepth=0.5*(clip.z/clip.w)+0.5;
    `,
    );
  };
  material.customProgramCacheKey = () => "gpu-lidar-analytic-spheres-v2";
  return material;
}
