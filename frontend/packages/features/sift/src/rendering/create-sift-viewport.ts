import * as THREE from "three";
import type { KeyPoint } from "../types";
import { plasma } from "./plasma";

/** Owns the lab's WebGL resources; created and disposed by the session effect. */
export function createSiftViewport(
  target: HTMLDivElement,
  media: HTMLVideoElement | ImageBitmap,
) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x09090b);
  renderer.domElement.setAttribute("aria-label", "Media with SIFT keypoints");
  target.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 2;
  const texture =
    media instanceof HTMLVideoElement
      ? new THREE.VideoTexture(media)
      : new THREE.Texture(media);
  // ImageBitmap ignores WebGL unpack flipY; flip its UVs explicitly.
  if (media instanceof ImageBitmap) {
    texture.repeat.y = -1;
    texture.offset.y = 1;
  }
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  const planeGeometry = new THREE.PlaneGeometry(1, 1);
  const planeMaterial = new THREE.MeshBasicMaterial({
    map: texture,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const plane = new THREE.Mesh(planeGeometry, planeMaterial);
  scene.add(plane);
  let geometry = new THREE.BufferGeometry();
  let capacity = 1024;
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(
      THREE.DynamicDrawUsage,
    ),
  );
  geometry.setAttribute(
    "color",
    new THREE.BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(
      THREE.DynamicDrawUsage,
    ),
  );
  geometry.setDrawRange(0, 0);
  const material = new THREE.ShaderMaterial({
    uniforms: { diameter: { value: 7 * renderer.getPixelRatio() } },
    vertexColors: true,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    vertexShader: `uniform float diameter; varying vec3 tint;
      void main() { tint = color; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = diameter; }`,
    fragmentShader: `varying vec3 tint;
      void main() { float r = length(gl_PointCoord - vec2(0.5)); if (r > 0.5) discard;
        gl_FragColor = vec4(mix(tint, vec3(0.0), smoothstep(0.36, 0.44, r)), 1.0 - smoothstep(0.46, 0.5, r));
        #include <colorspace_fragment>
      }`,
  });
  const markers = new THREE.Points(geometry, material);
  markers.frustumCulled = false;
  markers.renderOrder = 1;
  scene.add(markers);
  let imageWidth =
    media instanceof HTMLVideoElement ? media.videoWidth : media.width;
  let imageHeight =
    media instanceof HTMLVideoElement ? media.videoHeight : media.height;
  const fit = () => {
    const width = Math.max(1, target.clientWidth);
    const height = Math.max(1, target.clientHeight);
    renderer.setSize(width, height);
    const scale = Math.min(width / imageWidth, height / imageHeight);
    camera.left = -width / scale / 2;
    camera.right = width / scale / 2;
    camera.top = height / scale / 2;
    camera.bottom = -height / scale / 2;
    camera.updateProjectionMatrix();
    plane.scale.set(imageWidth, imageHeight, 1);
  };
  const observer = new ResizeObserver(fit);
  observer.observe(target);
  fit();
  renderer.setAnimationLoop(() => renderer.render(scene, camera));
  return {
    clearPoints() {
      geometry.setDrawRange(0, 0);
    },
    refreshMedia() {
      texture.needsUpdate = true;
    },
    setPoints(points: KeyPoint[], width: number, height: number) {
      imageWidth = width;
      imageHeight = height;
      fit();
      const octaves = [...new Set(points.map((p) => p.octave))].sort(
        (a, b) => a - b,
      );
      if (points.length > capacity) {
        capacity = 2 ** Math.ceil(Math.log2(points.length));
        geometry.dispose();
        geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          "position",
          new THREE.BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(
            THREE.DynamicDrawUsage,
          ),
        );
        geometry.setAttribute(
          "color",
          new THREE.BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(
            THREE.DynamicDrawUsage,
          ),
        );
        markers.geometry = geometry;
      }
      const positions = geometry.getAttribute("position").array as Float32Array;
      const colors = geometry.getAttribute("color").array as Float32Array;
      points.forEach((point, i) => {
        positions.set([point.x - width / 2, height / 2 - point.y, 0.01], i * 3);
        const t =
          1 - octaves.indexOf(point.octave) / Math.max(octaves.length - 1, 1);
        const rgb = plasma[Math.min(255, Math.floor(t * 256))];
        const color = new THREE.Color().setRGB(
          rgb[0] / 255,
          rgb[1] / 255,
          rgb[2] / 255,
          THREE.SRGBColorSpace,
        );
        colors.set([color.r, color.g, color.b], i * 3);
      });
      geometry.getAttribute("position").needsUpdate = true;
      geometry.getAttribute("color").needsUpdate = true;
      geometry.setDrawRange(0, points.length);
    },
    dispose() {
      observer.disconnect();
      renderer.setAnimationLoop(null);
      texture.dispose();
      planeGeometry.dispose();
      planeMaterial.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
