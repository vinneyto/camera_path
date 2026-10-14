import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
export function checkSource(fileName, source, resolve) {
  const failures = [];
  const normalized = fileName.replaceAll("\\", "/");
  const feature = normalized.match(/\/packages\/features\/([^/]+)\//)?.[1];
  const platform = normalized.match(
    /\/packages\/(contracts|extension-api|ui-kit|trajectory-math|scene-runtime)\//,
  )?.[1];
  const syntax = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const report = (node, message) => {
    const location = syntax.getLineAndCharacterOfPosition(node.getStart());
    failures.push(
      `${fileName}:${location.line + 1}:${location.character + 1} ${message}`,
    );
  };
  function checkImport(node, specifier) {
    const resolved = resolve(specifier, fileName)?.replaceAll("\\", "/");
    const targetFeature = resolved?.match(
      /\/packages\/features\/([^/]+)\//,
    )?.[1];
    const targetHost =
      resolved?.includes("/apps/host/") || resolved?.includes("/src/app/");
    if (feature && (targetHost || specifier.startsWith("@host")))
      report(node, "Feature → private host import");
    if (feature && targetFeature && targetFeature !== feature)
      report(node, `Feature → feature import (${targetFeature})`);
    if (platform && (targetHost || targetFeature))
      report(node, `Platform ${platform} → implementation import`);
    if (
      feature &&
      (specifier === "@tanstack/react-query" ||
        specifier.startsWith("@camera-path/extension-api/") ||
        specifier.includes("extension-api/data-cell") ||
        specifier.includes("extension-api/gpu-registry") ||
        specifier.includes("extension-api/frame-registry") ||
        specifier.includes("scene-runtime/surface/adapters/") ||
        specifier === "next/navigation")
    )
      report(node, "Feature bypasses scoped host ports");
    if (!feature && !platform && targetFeature) {
      const catalog =
        /\/apps\/host\/src\/composition\/(application|project)-features\.ts$/.test(
          normalized,
        );
      const bindings = ts.isImportDeclaration(node)
        ? node.importClause?.namedBindings
        : undefined;
      const descriptorOnly =
        bindings &&
        ts.isNamedImports(bindings) &&
        !node.importClause?.name &&
        bindings.elements.length === 1 &&
        (bindings.elements[0].propertyName ?? bindings.elements[0].name)
          .text === "extension";
      if (
        !catalog ||
        !descriptorOnly ||
        specifier !== `@camera-path/feature-${targetFeature}`
      )
        report(
          node,
          "Host may load only an extension descriptor in the composition catalog; feature implementations are private",
        );
    }
  }
  function visit(node) {
    if (
      feature &&
      /\/packages\/features\/[^/]+\/src\/index\.ts$/.test(normalized)
    ) {
      if (ts.isExportDeclaration(node)) {
        const entries = node.exportClause;
        if (
          !entries ||
          !ts.isNamedExports(entries) ||
          entries.elements.length !== 1 ||
          entries.elements[0].name.text !== "extension" ||
          (entries.elements[0].propertyName ?? entries.elements[0].name)
            .text !== "extension" ||
          !node.moduleSpecifier ||
          !ts.isStringLiteral(node.moduleSpecifier) ||
          node.moduleSpecifier.text !== "./extension"
        )
          report(
            node,
            "A feature entrypoint exports only its extension descriptor",
          );
      } else if (
        ts.isExportAssignment(node) ||
        node.modifiers?.some(
          (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
        )
      )
        report(
          node,
          "A feature entrypoint exports only its extension descriptor",
        );
    }
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      checkImport(node, node.moduleSpecifier.text);
    if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    )
      checkImport(node, node.argument.literal.text);
    if (ts.isCallExpression(node)) {
      const dynamic =
        node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === "require");
      if (dynamic) {
        if (
          node.arguments.length === 1 &&
          ts.isStringLiteral(node.arguments[0])
        )
          checkImport(node, node.arguments[0].text);
        else if (feature)
          report(node, "Computed module access is forbidden in a feature");
      }
      if (
        feature &&
        ((ts.isIdentifier(node.expression) &&
          ["fetch", "XMLHttpRequest", "WebSocket"].includes(
            node.expression.text,
          )) ||
          (ts.isPropertyAccessExpression(node.expression) &&
            ["fetch", "XMLHttpRequest", "WebSocket"].includes(
              node.expression.name.text,
            )))
      )
        report(node, "Feature performs transport outside a host adapter");
    }
    if (
      feature &&
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      ["XMLHttpRequest", "WebSocket", "QueryClient"].includes(
        node.expression.text,
      )
    )
      report(node, "Feature creates raw transport/query cache");
    ts.forEachChild(node, visit);
  }
  visit(syntax);
  return failures;
}
export function checkWorkspace(root) {
  const config = ts.readConfigFile(
    path.join(root, "tsconfig.json"),
    ts.sys.readFile,
  );
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  const failures = [];
  for (const file of parsed.fileNames) {
    if (
      file.includes("/.next/") ||
      file.includes(".test.") ||
      file.includes("/testing/") ||
      file.includes("/test-helpers/")
    )
      continue;
    failures.push(
      ...checkSource(file, fs.readFileSync(file, "utf8"), (spec, from) => {
        const result = ts.resolveModuleName(spec, from, parsed.options, ts.sys)
          .resolvedModule?.resolvedFileName;
        return result ? fs.realpathSync(result) : undefined;
      }),
    );
  }
  return failures;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const failures = checkWorkspace(path.resolve("."));
  if (failures.length) {
    process.stderr.write(failures.join("\n") + "\n");
    process.exitCode = 1;
  } else
    process.stdout.write("Feature and platform import boundaries passed.\n");
}
