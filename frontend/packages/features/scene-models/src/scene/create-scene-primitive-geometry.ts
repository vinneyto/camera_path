import { BoxGeometry, ConeGeometry, SphereGeometry } from "three";
import type { ScenePrimitive } from "./scene-primitive";
import {
  PRIMITIVE_SIZE,
  PRIMITIVE_RADIUS,
  PRIMITIVE_RADIAL_SEGMENTS,
  PRIMITIVE_HEIGHT_SEGMENTS,
} from "./primitive-constants";

/** Only the client constructs geometry. Dimensions come from the instance's scale. */
export function createScenePrimitiveGeometry(type: ScenePrimitive["type"]) {
  switch (type) {
    case "cube":
      return new BoxGeometry(PRIMITIVE_SIZE, PRIMITIVE_SIZE, PRIMITIVE_SIZE);
    case "sphere":
      return new SphereGeometry(
        PRIMITIVE_RADIUS,
        PRIMITIVE_RADIAL_SEGMENTS,
        PRIMITIVE_HEIGHT_SEGMENTS,
      );
    case "cone":
      return new ConeGeometry(
        PRIMITIVE_RADIUS,
        PRIMITIVE_SIZE,
        PRIMITIVE_RADIAL_SEGMENTS,
      );
  }
}
