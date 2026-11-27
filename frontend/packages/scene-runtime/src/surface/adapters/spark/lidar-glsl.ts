import { DEPTH_NEAR, DEPTH_FAR } from "../../depth/constants";
export const LIDAR_DIRECTION_GLSL = `
vec3 lidarDirection(ivec2 pixel, ivec2 size, float fov) {
  float azimuth = ((float(pixel.x)+0.5)/float(size.x)-0.5)*6.283185307179586;
  float elevation = (0.5-(float(pixel.y)+0.5)/float(size.y))*fov;
  return vec3(sin(azimuth)*cos(elevation),sin(elevation),-cos(azimuth)*cos(elevation));
}`;
export const LIDAR_RANGE_FRAGMENT = `
precision highp float;
uniform sampler2D depth0, depth1, depth2, depth3, depth4, depth5;
uniform ivec2 lidarSize;
uniform int faceSize;
uniform float verticalFov;
out vec4 fragColor;
${LIDAR_DIRECTION_GLSL}
void main() {
  vec3 ray=lidarDirection(ivec2(gl_FragCoord.xy),lidarSize,verticalFov);
  vec3 a=abs(ray); float d; vec2 uv; int face;
  if(a.x>=a.y && a.x>=a.z){d=a.x;face=ray.x>=0.0?0:1;uv=vec2(ray.x>=0.0?-ray.z:ray.z,-ray.y)/d;}
  else if(a.y>=a.z){d=a.y;face=ray.y>=0.0?2:3;uv=vec2(ray.x,ray.y>=0.0?ray.z:-ray.z)/d;}
  else{d=a.z;face=ray.z>=0.0?4:5;uv=vec2(ray.z>=0.0?ray.x:-ray.x,-ray.y)/d;}
  // WebGL face textures have a bottom-left origin.
  ivec2 pixel=clamp(ivec2(floor((uv*0.5+0.5)*float(faceSize))),ivec2(0),ivec2(faceSize-1));
  float z;
  if(face==0) z=texelFetch(depth0,pixel,0).r;
  else if(face==1) z=texelFetch(depth1,pixel,0).r;
  else if(face==2) z=texelFetch(depth2,pixel,0).r;
  else if(face==3) z=texelFetch(depth3,pixel,0).r;
  else if(face==4) z=texelFetch(depth4,pixel,0).r;
  else z=texelFetch(depth5,pixel,0).r;
  float range=z/d;
  fragColor=vec4(z>=${DEPTH_NEAR.toFixed(2)} && range<=${DEPTH_FAR.toFixed(1)}?range:0.0,0.0,0.0,1.0);
}`;
