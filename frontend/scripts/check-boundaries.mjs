import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = ts.readConfigFile(
  path.join(root, "tsconfig.json"),
  ts.sys.readFile,
);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
const normalize = (value) => value.replaceAll("\\", "/");
const featureOf = (file) =>
  /\/packages\/features\/([^/]+)\//.exec(normalize(file))?.[1];
const packageOf = (file) =>
  featureOf(file)
    ? `feature-${featureOf(file)}`
    : /\/packages\/([^/]+)\//.exec(normalize(file))?.[1];

/** Static source dependencies only: no feature registration API or runtime permission system. */
export function inspectSource(
  file,
  text,
  resolve = (specifier) =>
    ts.resolveModuleName(specifier, file, parsed.options, ts.sys).resolvedModule
      ?.resolvedFileName,
) {
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const issues = [];
  const feature = featureOf(file);
  const shared = packageOf(file) && !feature;
  const host =
    normalize(file).includes("/apps/host/") ||
    normalize(file).includes("/src/app/");
  const report = (node, message) =>
    issues.push(
      `${normalize(path.relative(root, file))}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}: ${message}`,
    );
  const check = (node, specifier) => {
    const target = resolve(specifier);
    const targetFeature = target && featureOf(target);
    if (feature && targetFeature && targetFeature !== feature)
      report(node, "Features must not import one another");
    if (
      (feature || shared) &&
      target &&
      (normalize(target).includes("/apps/host/") ||
        normalize(target).includes("/src/app/"))
    )
      report(node, "Shared packages and features must not import the host");
    if (shared && targetFeature)
      report(node, "Shared packages must not import features");
    if (
      host &&
      targetFeature &&
      !normalize(target).endsWith(`/features/${targetFeature}/src/index.ts`)
    )
      report(
        node,
        "Host imports feature components only through the public package entrypoint",
      );
    if (host && targetFeature) {
      const bindings =
        ts.isImportDeclaration(node) && node.importClause?.namedBindings;
      const catalog = normalize(file).endsWith(
        "/apps/host/src/composition/feature-slots.ts",
      );
      if (
        !catalog ||
        !bindings ||
        !ts.isNamedImports(bindings) ||
        node.importClause?.name ||
        node.importClause?.isTypeOnly ||
        bindings.elements.length !== 1 ||
        (bindings.elements[0].propertyName ?? bindings.elements[0].name)
          .text !== "slots"
      )
        report(node, "Host imports only slots objects in the feature catalog");
    }
    if (
      feature &&
      specifier === "@camera-path/slots" &&
      ts.isImportDeclaration(node)
    ) {
      const clause = node.importClause;
      const bindings = clause?.namedBindings;
      if (
        !clause?.isTypeOnly &&
        (!bindings ||
          !ts.isNamedImports(bindings) ||
          bindings.elements.some((e) => !e.isTypeOnly))
      )
        report(
          node,
          "Features import only slot types; slot containers belong to host",
        );
    }

    if (
      feature &&
      (specifier === "@tanstack/react-query" ||
        specifier.startsWith("@tanstack/react-query/"))
    )
      report(
        node,
        "Features use shared API/action hooks instead of owning the API cache",
      );
  };
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      check(node, node.moduleSpecifier.text);
    if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression &&
      ts.isStringLiteral(node.moduleReference.expression)
    )
      check(node, node.moduleReference.expression.text);
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        node.expression.getText(source) === "require")
    ) {
      const arg = node.arguments[0];
      if (arg && ts.isStringLiteral(arg)) check(node, arg.text);
      else if (feature || shared)
        report(
          node,
          "Computed module imports cannot be checked across package boundaries",
        );
    }
    if (
      feature &&
      ts.isCallExpression(node) &&
      ["fetch", "window.fetch", "globalThis.fetch"].includes(
        node.expression.getText(source),
      )
    )
      report(node, "Features call the shared API, not fetch");
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (
    feature &&
    normalize(file).endsWith(`/features/${feature}/src/index.ts`)
  ) {
    for (const node of source.statements) {
      if (ts.isExportDeclaration(node) || ts.isExportAssignment(node))
        report(node, "Feature entrypoints export only their slots object");
      else if (
        node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) &&
        (!ts.isVariableStatement(node) ||
          node.declarationList.declarations.some(
            (d) => !ts.isIdentifier(d.name) || d.name.text !== "slots",
          ))
      )
        report(node, "Feature entrypoints export only their slots object");
    }
  }
  return issues;
}

export function checkProject() {
  const files = parsed.fileNames.filter(
    (file) =>
      !/\.(test|spec)\./.test(file) &&
      !normalize(file).includes("/node_modules/"),
  );
  const issues = files.flatMap((file) =>
    inspectSource(file, fs.readFileSync(file, "utf8")),
  );
  // Dependency cycles are caught at workspace-package level, not only per import spelling.
  const graph = new Map();
  for (const file of files) {
    const owner = packageOf(file);
    if (!owner) continue;
    const edges = graph.get(owner) ?? new Set();
    graph.set(owner, edges);
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    const visit = (node) => {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        const target = ts.resolveModuleName(
          node.moduleSpecifier.text,
          file,
          parsed.options,
          ts.sys,
        ).resolvedModule?.resolvedFileName;
        const other = target && packageOf(target);
        if (other && other !== owner) edges.add(other);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  const done = new Set(),
    active = new Set();
  const visit = (name) => {
    if (active.has(name)) {
      issues.push(`Workspace dependency cycle at ${name}`);
      return;
    }
    if (done.has(name)) return;
    active.add(name);
    for (const next of graph.get(name) ?? []) visit(next);
    active.delete(name);
    done.add(name);
  };
  for (const name of graph.keys()) visit(name);
  return issues;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const issues = checkProject();
  if (issues.length) {
    console.error(issues.join("\n"));
    process.exitCode = 1;
  } else
    console.log(
      "Package boundaries and slot-only feature entrypoints are valid.",
    );
}
