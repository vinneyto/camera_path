import { RENDER_PIPELINE_SCENE_LAYER } from "@camera-path/render-pipeline";
import { Material, Mesh, type Object3D, type Scene } from "three";
import { isDepthMeshMaterial } from "./is-depth-mesh-material";

/** Replace materials only during synchronous drawing, preserving children,
 * visibility, transforms, side/alpha tests and the editor's original materials.
 */
export class SceneDepthMaterials {
  private readonly hidden = Object.assign(new Material(), { visible: false });
  private readonly cache = new Map<Material, Material>();
  constructor(private readonly create: (original: Material) => Material) {}
  draw(scene: Scene, draw: () => void): void {
    const saved: {
      object: Object3D & { material: Material | Material[] };
      material: Material | Material[];
    }[] = [];
    const background = scene.background,
      override = scene.overrideMaterial;
    try {
      scene.background = null;
      scene.overrideMaterial = null;
      scene.traverse((object) => {
        if (!("material" in object)) return;
        const renderable = object as Object3D & {
          material: Material | Material[];
        };
        const original = renderable.material;
        saved.push({ object: renderable, material: original });
        const eligible =
          object instanceof Mesh &&
          object.layers.isEnabled(RENDER_PIPELINE_SCENE_LAYER) &&
          !object.userData.excludeFromSceneDepth;
        const replace = (material: Material) => {
          if (!eligible || !isDepthMeshMaterial(material)) return this.hidden;
          let depth = this.cache.get(material);
          if (!depth) {
            depth = this.create(material);
            this.cache.set(material, depth);
          }
          return depth;
        };
        renderable.material = Array.isArray(original)
          ? original.map(replace)
          : replace(original);
      });
      draw();
    } finally {
      for (const { object, material } of saved) object.material = material;
      scene.background = background;
      scene.overrideMaterial = override;
    }
  }
  dispose(): void {
    this.hidden.dispose();
    for (const material of this.cache.values()) material.dispose();
    this.cache.clear();
  }
}
