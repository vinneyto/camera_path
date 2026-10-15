import ts from "typescript";

export function createStateReader(context, resolve) {
  const { checker, moduleOf } = context;
  const hookCache = new Map();
  function unwrap(node) {
    while (
      node &&
      (ts.isParenthesizedExpression(node) ||
        ts.isAsExpression(node) ||
        ts.isSatisfiesExpression(node) ||
        ts.isNonNullExpression(node))
    )
      node = node.expression;
    return node;
  }
  function stateType(node) {
    const type = checker.getTypeAtLocation(node);
    return [type.symbol, type.aliasSymbol].some(
      (symbol) =>
        symbol?.name === "EditorState" &&
        symbol.declarations?.some(
          (d) =>
            moduleOf(d.getSourceFile().fileName)?.name === "@camera-path/store",
        ),
    );
  }
  function access(node, parameter, seen = new Set()) {
    node = unwrap(node);
    if (!node || seen.has(node)) return null;
    const next = new Set(seen).add(node);
    if (ts.isIdentifier(node)) {
      const symbol = checker.getSymbolAtLocation(node);
      if (parameter?.has(symbol))
        return { path: parameter.get(symbol), root: node };
      const declaration = symbol?.valueDeclaration;
      if (
        declaration &&
        ts.isVariableDeclaration(declaration) &&
        declaration.initializer
      )
        return access(declaration.initializer, parameter, next);
      if (declaration && ts.isBindingElement(declaration)) {
        const binding = declaration.parent.parent;
        const base = ts.isVariableDeclaration(binding)
          ? binding.initializer
          : ts.isBindingElement(binding)
            ? binding.name
            : null;
        const parent = base && access(base, parameter, next);
        const name = declaration.propertyName ?? declaration.name;
        if (parent && (ts.isIdentifier(name) || ts.isStringLiteralLike(name)))
          return { ...parent, path: [...parent.path, name.text] };
      }
      return null;
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "getState" &&
      stateType(node)
    )
      return { path: [], root: node };
    if (ts.isPropertyAccessExpression(node)) {
      const base = access(node.expression, parameter, next);
      return base && { ...base, path: [...base.path, node.name.text] };
    }
    if (ts.isElementAccessExpression(node)) {
      const base = access(node.expression, parameter, next);
      const key = node.argumentExpression;
      return (
        base && {
          ...base,
          path: [
            ...base.path,
            key && (ts.isStringLiteralLike(key) || ts.isNumericLiteral(key))
              ? key.text
              : "*",
          ],
        }
      );
    }
    return null;
  }
  function selectorPaths(node) {
    node = unwrap(node);
    const declaration = node && resolve(node)?.declaration;
    if (declaration && ts.isVariableDeclaration(declaration))
      node = unwrap(declaration.initializer);
    else if (declaration && ts.isFunctionDeclaration(declaration))
      node = declaration;
    if (
      !node ||
      (!ts.isArrowFunction(node) &&
        !ts.isFunctionExpression(node) &&
        !ts.isFunctionDeclaration(node))
    )
      return null;
    const parameter = node.parameters[0];
    if (!parameter) return null;
    const bindings = new Map();
    function bind(name, prefix = []) {
      if (ts.isIdentifier(name))
        bindings.set(checker.getSymbolAtLocation(name), prefix);
      else if (ts.isObjectBindingPattern(name)) {
        for (const element of name.elements) {
          const key = element.propertyName ?? element.name;
          const part =
            !element.dotDotDotToken &&
            (ts.isIdentifier(key) || ts.isStringLiteralLike(key))
              ? key.text
              : "*";
          bind(element.name, [...prefix, part]);
        }
      }
    }
    bind(parameter.name);
    if (!bindings.size) return null;
    const paths = new Set();
    function visit(child) {
      const result = access(child, bindings);
      if (result) {
        const parent = child.parent;
        const extended =
          (ts.isPropertyAccessExpression(parent) ||
            ts.isElementAccessExpression(parent)) &&
          parent.expression === child;
        const declarationName = ts.isParameter(parent) && parent.name === child;
        if (
          !extended &&
          !declarationName &&
          !result.path.length &&
          child !== result.root
        )
          paths.add("$");
        else if (!extended && !declarationName && result.path.length)
          paths.add(result.path.join("."));
        else if (!extended && child === result.root && child !== parameter.name)
          paths.add("$");
      }
      ts.forEachChild(child, visit);
    }
    if (node.body) visit(node.body);
    return [...paths].sort();
  }
  function hookPaths(target, seen = new Set()) {
    if (hookCache.has(target.symbol)) return hookCache.get(target.symbol);
    if (seen.has(target.symbol)) return [];
    const next = new Set(seen).add(target.symbol);
    const paths = new Set();
    function visit(node) {
      if (ts.isCallExpression(node)) {
        const callee = resolve(node.expression);
        if (
          callee &&
          moduleOf(callee.declaration.getSourceFile().fileName)?.name ===
            "@camera-path/store"
        ) {
          if (callee.symbol.name === "useEditorStore" && node.arguments[0]) {
            for (const p of selectorPaths(node.arguments[0]) ?? [])
              paths.add(p);
          } else for (const p of hookPaths(callee, next)) paths.add(p);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(target.declaration);
    const result = [...paths].sort();
    hookCache.set(target.symbol, result);
    return result;
  }
  return { selectorPaths, hookPaths, snapshotAccess: (node) => access(node) };
}
