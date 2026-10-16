import ts from "typescript";
import { loadProject } from "./load-project.mjs";
import { createSymbolResolver } from "./create-symbol-resolver.mjs";
import { createStateReader } from "./create-state-reader.mjs";
import { readSlots } from "./read-slots.mjs";

export function scanModules(configPath) {
  const context = loadProject(configPath);
  const { checker, relative, moduleOf } = context;
  const resolve = createSymbolResolver(checker);
  const state = createStateReader(context, resolve);
  const diagnostics = [];
  const location = (node) => {
    const source = node.getSourceFile();
    const point = source.getLineAndCharacterOfPosition(node.getStart(source));
    return {
      file: relative(source.fileName),
      line: point.line + 1,
      column: point.character + 1,
    };
  };
  function isReference(node) {
    for (
      let current = node;
      current && !ts.isSourceFile(current);
      current = current.parent
    ) {
      if (
        ts.isTypeNode(current) ||
        ts.isImportDeclaration(current) ||
        ts.isExportDeclaration(current)
      )
        return false;
    }
    const parent = node.parent;
    if (
      ts.isIdentifier(node) &&
      ts.isPropertyAccessExpression(parent) &&
      parent.name === node
    )
      return false;
    if (
      parent.name === node &&
      (ts.isVariableDeclaration(parent) ||
        ts.isParameter(parent) ||
        ts.isFunctionDeclaration(parent) ||
        ts.isBindingElement(parent) ||
        ts.isPropertyAssignment(parent) ||
        ts.isMethodDeclaration(parent))
    )
      return false;
    return true;
  }
  const modules = context.modules.map((module) => {
    const files = context.files.filter(
      (source) => moduleOf(source.fileName) === module,
    );
    const actions = new Map(),
      selectors = new Map();
    function add(map, target, kind, node, statePaths) {
      const definition = location(target.declaration);
      const key = `${kind}:${definition.file}:${definition.line}:${definition.column}:${target.name}`;
      const dependency = map.get(key) ?? {
        name: target.name,
        kind,
        package:
          target.package ??
          moduleOf(target.declaration.getSourceFile().fileName).name,
        definition,
        ...(statePaths ? { statePaths: [] } : {}),
        usages: [],
      };
      if (statePaths)
        dependency.statePaths = [
          ...new Set([...dependency.statePaths, ...statePaths]),
        ].sort();
      if (statePaths?.some((p) => p.split(".").includes("*")))
        diagnostics.push({
          severity: "warning",
          code: "dynamic-state-access",
          ...location(node),
          message: "Dynamic state key is represented by a wildcard (*).",
        });
      const usage = { ...location(node), expression: node.getText() };
      if (
        !dependency.usages.some(
          (item) =>
            item.file === usage.file &&
            item.line === usage.line &&
            item.column === usage.column,
        )
      )
        dependency.usages.push(usage);
      map.set(key, dependency);
    }
    function snapshot(access, node) {
      const type = checker.getTypeAtLocation(access.root);
      const symbol = [type.symbol, type.aliasSymbol].find((s) =>
        ["EditorState", "UserSettingsState"].includes(s?.name),
      );
      add(
        selectors,
        {
          name: "getState",
          package: "@camera-path/store",
          declaration: symbol.declarations[0],
        },
        "store-snapshot",
        node,
        [access.path.length ? access.path.join(".") : "$"],
      );
    }
    for (const source of files) {
      for (const error of source.parseDiagnostics) {
        const position = source.getLineAndCharacterOfPosition(error.start ?? 0);
        diagnostics.push({
          severity: "error",
          code: "typescript-syntax",
          file: relative(source.fileName),
          line: position.line + 1,
          column: position.character + 1,
          message: ts.flattenDiagnosticMessageText(error.messageText, "\n"),
        });
      }
      function visit(node) {
        if (
          ((ts.isImportDeclaration(node) && node.importClause) ||
            ts.isExportDeclaration(node)) &&
          node.moduleSpecifier &&
          ts.isStringLiteralLike(node.moduleSpecifier) &&
          (node.moduleSpecifier.text.startsWith(".") ||
            node.moduleSpecifier.text.startsWith("@camera-path/")) &&
          !checker.getSymbolAtLocation(node.moduleSpecifier)
        )
          diagnostics.push({
            severity: "error",
            code: "unresolved-import",
            ...location(node.moduleSpecifier),
            message: `Cannot resolve ${node.moduleSpecifier.text}; install dependencies and check tsconfig paths.`,
          });
        if (
          (ts.isIdentifier(node) ||
            ts.isPropertyAccessExpression(node) ||
            ts.isElementAccessExpression(node)) &&
          isReference(node)
        ) {
          const target = resolve(node);
          if (
            target &&
            !target.symbol.name.endsWith("Provider") &&
            moduleOf(target.declaration.getSourceFile().fileName)?.name ===
              "@camera-path/actions" &&
            checker.getTypeAtLocation(node).getCallSignatures().length
          )
            add(
              actions,
              target,
              target.symbol.name.startsWith("use") ? "hook" : "action",
              node,
            );
        }
        if (ts.isCallExpression(node)) {
          const target = resolve(node.expression);
          const owner =
            target &&
            moduleOf(target.declaration.getSourceFile().fileName)?.name;
          if (
            target &&
            target.symbol.name.startsWith("use") &&
            owner === "@camera-path/store"
          ) {
            const paths = ["useEditorStore", "useUserSettingsStore"].includes(
              target.symbol.name,
            )
              ? node.arguments[0] && state.selectorPaths(node.arguments[0])
              : state.hookPaths(target);
            add(
              selectors,
              target,
              ["useEditorStore", "useUserSettingsStore"].includes(
                target.symbol.name,
              )
                ? "store-selector"
                : "store-hook",
              node,
              paths ?? [],
            );
            if (
              ["useEditorStore", "useUserSettingsStore"].includes(
                target.symbol.name,
              ) &&
              paths == null
            )
              diagnostics.push({
                severity: "warning",
                code: "unresolved-selector",
                ...location(node),
                message: "Cannot statically resolve this selector function.",
              });
          } else if (
            target &&
            target.symbol.name.startsWith("use") &&
            owner === "@camera-path/api"
          )
            add(selectors, target, "api-hook", node);
          const access = state.snapshotAccess(node);
          if (
            access &&
            !ts.isVariableDeclaration(node.parent) &&
            !(
              (ts.isPropertyAccessExpression(node.parent) ||
                ts.isElementAccessExpression(node.parent)) &&
              node.parent.expression === node
            )
          )
            snapshot(access, node);
        }
        if (
          ts.isIdentifier(node) ||
          ts.isPropertyAccessExpression(node) ||
          ts.isElementAccessExpression(node)
        ) {
          const parent = node.parent;
          const extended =
            (ts.isPropertyAccessExpression(parent) ||
              ts.isElementAccessExpression(parent)) &&
            parent.expression === node;
          const access =
            extended || !isReference(node) ? null : state.snapshotAccess(node);
          if (access) snapshot(access, node);
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
    const sorted = (map) =>
      [...map.values()].sort((a, b) =>
        `${a.kind}:${a.name}:${a.definition.file}` <
        `${b.kind}:${b.name}:${b.definition.file}`
          ? -1
          : 1,
      );
    const entry = files.find((source) => source.fileName === module.entrypoint);
    return {
      name: module.name,
      kind: module.kind,
      root: module.root,
      entrypoint: entry ? relative(entry.fileName) : null,
      files: files.map((source) => relative(source.fileName)),
      slots: entry ? readSlots(entry, context, resolve, diagnostics) : {},
      actions: sorted(actions),
      selectors: sorted(selectors),
    };
  });
  diagnostics.sort((a, b) =>
    `${a.file}:${a.line}:${a.column}:${a.code}` <
    `${b.file}:${b.line}:${b.column}:${b.code}`
      ? -1
      : 1,
  );
  return { schemaVersion: 1, modules, diagnostics };
}
