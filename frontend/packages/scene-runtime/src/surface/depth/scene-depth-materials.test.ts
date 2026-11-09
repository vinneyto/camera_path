import { Material, Mesh, MeshBasicMaterial, PlaneGeometry, Scene } from "three";
import { expect, it } from "vitest";
import { SceneDepthMaterials } from "./scene-depth-materials";

it("restores materials on errors and excludes overlays, helpers and transparency without hiding children", () => {
  const scene = new Scene(),
    geometry = new PlaneGeometry(),
    material = new MeshBasicMaterial();
  const opaque = new Mesh(geometry, material),
    transparent = new Mesh(
      geometry,
      new MeshBasicMaterial({ transparent: true }),
    );
  const decoration = new Mesh(geometry, material);
  decoration.layers.set(6);
  const noDepth = new Mesh(
    geometry,
    new MeshBasicMaterial({ depthWrite: false }),
  );
  transparent.add(opaque);
  scene.add(transparent, decoration, noDepth);
  const depth = new MeshBasicMaterial(),
    pass = new SceneDepthMaterials(() => depth);
  const override = new Material();
  scene.overrideMaterial = override;
  expect(() =>
    pass.draw(scene, () => {
      expect(opaque.material).toBe(depth);
      expect(transparent.visible).toBe(true);
      expect(transparent.material.visible).toBe(false);
      expect(decoration.material.visible).toBe(false);
      expect(noDepth.material.visible).toBe(false);
      expect(scene.overrideMaterial).toBe(null);
      throw new Error("draw failed");
    }),
  ).toThrow("draw failed");
  expect(opaque.material).toBe(material);
  expect(decoration.material).toBe(material);
  expect(scene.overrideMaterial).toBe(override);
  pass.dispose();
  geometry.dispose();
});
