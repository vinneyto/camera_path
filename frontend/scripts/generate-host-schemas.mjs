import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import prettier from "prettier";
import { createGenerator } from "ts-json-schema-generator";

export function generateHostSchemas(root) {
  const contracts = path.join(root, "packages/contracts/src");
  const api = JSON.parse(
    fs.readFileSync(path.join(contracts, "api-schemas.json"), "utf8"),
  );
  const schema = createGenerator({
    path: path.join(contracts, "host-schema-types.ts"),
    tsconfig: path.join(root, "tsconfig.json"),
    type: "HostSchemaTypes",
    jsDoc: "extended",
    extraTags: ["additionalProperties"],
    additionalProperties: true,
    strictTuples: true,
    topRef: false,
    functions: "fail",
  }).createSchema("HostSchemaTypes");

  // Keep OpenAPI as the authority for imported API DTOs and their validation rules.
  // The generator emits draft-07 tuples; the runtime uses JSON Schema 2020-12.
  function normalize(node) {
    if (!node || typeof node !== "object") return;
    if (
      typeof node.$ref === "string" &&
      node.$ref.startsWith("#/definitions/")
    ) {
      const name = decodeURIComponent(node.$ref.slice("#/definitions/".length));
      if (Object.hasOwn(api.components.schemas, name))
        node.$ref = `camera-path-api#/components/schemas/${name}`;
    }
    if (Array.isArray(node.items)) {
      node.prefixItems = node.items;
      node.items = node.additionalItems ?? true;
      delete node.additionalItems;
    }
    for (const value of Object.values(node)) normalize(value);
  }
  normalize(schema);
  const definitions = schema.definitions ?? {};
  delete schema.definitions;
  const reachable = new Set();
  function collect(node) {
    if (!node || typeof node !== "object") return;
    if (
      typeof node.$ref === "string" &&
      node.$ref.startsWith("#/definitions/")
    ) {
      const name = decodeURIComponent(node.$ref.slice("#/definitions/".length));
      if (!reachable.has(name)) {
        if (!Object.hasOwn(definitions, name))
          throw new Error(`Missing schema definition: ${name}`);
        reachable.add(name);
        collect(definitions[name]);
      }
    }
    for (const value of Object.values(node)) collect(value);
  }
  collect(schema);
  return {
    ...schema,
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "camera-path-host",
    definitions: Object.fromEntries(
      [...reachable].sort().map((name) => [name, definitions[name]]),
    ),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const schema = generateHostSchemas(path.resolve("."));
  const output = "packages/contracts/src/generated/host-schemas.json";
  const text = await prettier.format(JSON.stringify(schema, null, 2) + "\n", {
    parser: "json",
  });
  if (process.argv.includes("--check")) {
    if (!fs.existsSync(output) || fs.readFileSync(output, "utf8") !== text) {
      process.stderr.write(
        "Host schemas are stale; run npm run schemas:generate.\n",
      );
      process.exitCode = 1;
    }
  } else {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, text);
    process.stdout.write(
      `Generated ${Object.keys(schema.properties).length} host DTO schemas from TypeScript.\n`,
    );
  }
}
