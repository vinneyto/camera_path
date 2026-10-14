import { describe, expect, it } from "vitest";
import { generatedSchema } from "./generated-schema";

describe("generated host DTO validation", () => {
  it("accepts scene object IDs and guarded clears but rejects invalid IDs", () => {
    const hover = generatedSchema("hoverObject");
    expect(hover.parse({ id: "anchor:a" })).toEqual({ id: "anchor:a" });
    expect(hover.parse({ id: null, ifCurrentId: "trajectory" })).toEqual({
      id: null,
      ifCurrentId: "trajectory",
    });
    expect(() => hover.parse({ id: "" })).toThrow();
    expect(() => hover.parse({ id: 3 })).toThrow();
    expect(() => hover.parse({ id: null, ifCurrentId: "" })).toThrow();
  });
  it("requires non-optional identity fields and allows nullable state", () => {
    const schema = generatedSchema("identityState");
    const state = {
      canEdit: false,
      loading: false,
      username: null,
      pending: false,
      challenge: null,
      errorMessage: null,
    };
    expect(schema.parse(state)).toEqual(state);
    expect(() => schema.parse({ ...state, challenge: undefined })).toThrow();
    expect(() =>
      schema.parse({ ...state, challenge: { challenge_id: "id" } }),
    ).toThrow();
  });
  it("preserves playback ranges and exact camera tuples with integer revisions", () => {
    const playback = generatedSchema("setPlaybackFrame");
    expect(playback.parse({ pathPosition: 0.5, elapsed: 2 })).toEqual({
      pathPosition: 0.5,
      elapsed: 2,
    });
    expect(() => playback.parse({ pathPosition: 1.1, elapsed: 2 })).toThrow();
    expect(() => playback.parse({ pathPosition: 0.5, elapsed: -1 })).toThrow();
    const camera = generatedSchema("trajectoryCameraPose");
    const pose = {
      position: [0, 0, 0],
      orientation: [0, 0, 0, 1],
      up: [0, 1, 0],
      frameId: 1,
      projectRevision: 0,
    };
    expect(camera.parse(null)).toBeNull();
    expect(camera.parse(pose)).toEqual(pose);
    expect(() => camera.parse({ ...pose, position: [0, 0] })).toThrow();
    expect(() =>
      camera.parse({ ...pose, orientation: [0, 0, 0, 1, 2] }),
    ).toThrow();
    expect(() => camera.parse({ ...pose, frameId: 1.5 })).toThrow();
    expect(() => camera.parse({ ...pose, projectRevision: -1 })).toThrow();
  });
  it("validates cloud action variants and nested OpenAPI constraints", () => {
    const action = generatedSchema("projectCloudAction");
    expect(
      action.parse({ type: "add", assetId: "cloud", translation: [0, 0, 0] }),
    ).toEqual({ type: "add", assetId: "cloud", translation: [0, 0, 0] });
    expect(() => action.parse({ type: "add", cloudId: "cloud" })).toThrow();
    expect(() =>
      action.parse({ type: "add", assetId: "cloud", translation: [0, 0] }),
    ).toThrow();
    const defaults = {
      assetId: "cloud",
      changes: { default_rotation_deg: [0, 0, 0], default_scale: 1 },
    };
    const update = generatedSchema("updateLibraryDefaults");
    expect(update.parse(defaults)).toEqual(defaults);
    expect(() =>
      update.parse({
        ...defaults,
        changes: { ...defaults.changes, default_scale: 0 },
      }),
    ).toThrow();
  });
  it("retains the closed permissions object", () => {
    const permissions = generatedSchema("projectPermissions");
    expect(permissions.parse({ canEdit: false })).toEqual({ canEdit: false });
    expect(() => permissions.parse({ canEdit: true, admin: true })).toThrow();
  });
});
