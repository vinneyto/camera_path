import type { RuntimeSchema } from "./contract-types";
import type { HostSchemaTypes } from "./host-schema-types";
import { jsonSchema } from "./json-schema";
export function generatedSchema<K extends keyof HostSchemaTypes>(
  name: K,
): RuntimeSchema<HostSchemaTypes[K]> {
  return jsonSchema<HostSchemaTypes[K]>({
    $ref: `camera-path-host#/properties/${name}`,
  });
}
