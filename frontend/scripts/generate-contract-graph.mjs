import prettier from "prettier";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
const root = path.resolve(".");
const ids = new Map();
for (const name of ["host-data.ts", "host-requests.ts", "gpu-resources.ts"]) {
  const file = path.join(root, "packages/contracts/src", name);
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  function collect(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    ) {
      const init = node.initializer;
      if (ts.isCallExpression(init) && ts.isStringLiteral(init.arguments[0]))
        ids.set(node.name.text, init.arguments[0].text);
      else if (ts.isObjectLiteralExpression(init)) {
        const id = init.properties.find(
          (p) => ts.isPropertyAssignment(p) && p.name.getText(source) === "id",
        );
        if (id && ts.isStringLiteral(id.initializer))
          ids.set(node.name.text, id.initializer.text);
      }
    }
    ts.forEachChild(node, collect);
  }
  collect(source);
}
function evaluate(node) {
  if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node))
    return evaluate(node.expression);
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(evaluate);
  if (ts.isObjectLiteralExpression(node))
    return Object.fromEntries(
      node.properties.map((p) => {
        if (!ts.isPropertyAssignment(p))
          throw new Error("Manifest must use explicit properties");
        return [p.name.getText().replaceAll('"', ""), evaluate(p.initializer)];
      }),
    );
  if (ts.isIdentifier(node) && ids.has(node.text)) return ids.get(node.text);
  throw new Error(`Unsupported manifest expression: ${node.getText()}`);
}
const features = [];
for (const folder of fs
  .readdirSync(path.join(root, "packages/features"))
  .sort()) {
  const file = path.join(root, "packages/features", folder, "src/manifest.ts");
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText() === "manifest")
      features.push({
        ...evaluate(node.initializer),
        source: path.relative(root, file),
      });
    ts.forEachChild(node, visit);
  }
  visit(source);
}
const bindings = [];
function inspect(folder) {
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const file = path.join(folder, entry.name);
    if (entry.isDirectory()) inspect(file);
    else if (/\.tsx?$/.test(file) && !file.includes(".test.")) {
      const source = ts.createSourceFile(
        file,
        fs.readFileSync(file, "utf8"),
        ts.ScriptTarget.Latest,
        true,
      );
      function visit(node) {
        if (
          ts.isCallExpression(node) &&
          ((ts.isIdentifier(node.expression) &&
            ["useBindValue", "useBindQuery", "useBindRequest"].includes(
              node.expression.text,
            )) ||
            (ts.isPropertyAccessExpression(node.expression) &&
              node.expression.name.text === "bindData"))
        ) {
          const arg = ts.isIdentifier(node.expression)
            ? node.arguments[1]
            : node.arguments[0];
          const name =
            arg &&
            (ts.isPropertyAccessExpression(arg)
              ? arg.name.text
              : arg.getText(source));
          if (ids.has(name)) {
            const loc = source.getLineAndCharacterOfPosition(node.getStart());
            bindings.push({
              contract: ids.get(name),
              kind: node.expression.getText(source),
              source: path.relative(root, file),
              line: loc.line + 1,
              adapter: node.arguments
                .at(-1)
                ?.getText(source)
                .replace(/\s+/g, " "),
            });
          }
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
  }
}
inspect(path.join(root, "apps/host/src/runtime"));
const contracts = [...ids]
  .map(([symbol, id]) => ({ symbol, id }))
  .sort((a, b) => a.id.localeCompare(b.id));
const nodes = [
  ...features.map((feature) => ({
    id: feature.id,
    type: "feature",
    data: { label: feature.id, scope: feature.scope, source: feature.source },
  })),
  ...contracts.map((contract) => ({
    id: contract.id,
    type: "contract",
    data: contract,
  })),
];
const edges = [];
for (const feature of features) {
  for (const read of feature.reads)
    edges.push({
      id: `${read}->${feature.id}`,
      source: read,
      target: feature.id,
      data: { kind: "reads" },
    });
  for (const call of feature.calls)
    edges.push({
      id: `${feature.id}->${call}`,
      source: feature.id,
      target: call,
      data: { kind: "calls" },
    });
  for (const handle of feature.handles ?? [])
    edges.push({
      id: `${handle}->${feature.id}`,
      source: handle,
      target: feature.id,
      data: { kind: "handles" },
    });
  for (const contribution of feature.contributions) {
    for (const input of contribution.inputs ?? [])
      edges.push({
        id: `${input}->${contribution.id}`,
        source: input,
        target: feature.id,
        data: { kind: "gpu-input", pass: contribution.id },
      });
    for (const output of contribution.outputs ?? [])
      edges.push({
        id: `${contribution.id}->${output}`,
        source: feature.id,
        target: output,
        data: { kind: "gpu-output", pass: contribution.id },
      });
  }
}
const graph = {
  schemaVersion: 2,
  features,
  contracts,
  nodes,
  edges,
  bindings: bindings.sort((a, b) => a.contract.localeCompare(b.contract)),
  note: "Declarations are permitted flows; HostRuntime.trace records actual access without payloads. Frame and GPU execution remain separate graphs.",
};
fs.mkdirSync(path.join(root, "docs"), { recursive: true });
const output = path.join(root, "docs/frontend-contract-graph.json");
const text = await prettier.format(JSON.stringify(graph, null, 2) + "\n", {
  parser: "json",
});
if (process.argv.includes("--check")) {
  if (!fs.existsSync(output) || fs.readFileSync(output, "utf8") !== text) {
    process.stderr.write(
      "Contract graph is stale; run npm run graph:generate.\n",
    );
    process.exitCode = 1;
  }
} else {
  fs.writeFileSync(output, text);
  process.stdout.write(
    `Generated graph for ${features.length} features and ${contracts.length} contracts.\n`,
  );
}
