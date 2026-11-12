import type { ScenePrimitive } from "./scene-primitive";

export function parseScenePrimitive(json: string): ScenePrimitive {
  const value: unknown = JSON.parse(json);
  if (
    typeof value !== "object" ||
    value === null ||
    !("type" in value) ||
    !["cube", "sphere", "cone"].includes(String(value.type)) ||
    Object.keys(value).some((key) => key !== "type" && key !== "color") ||
    ("color" in value &&
      (typeof value.color !== "string" ||
        !/^#[0-9a-fA-F]{6}$/.test(value.color)))
  )
    throw new Error("Invalid scene primitive parameters");
  return value as ScenePrimitive;
}
