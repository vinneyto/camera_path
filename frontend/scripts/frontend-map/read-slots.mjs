import ts from "typescript";

/** Read static data only. Never import/execute a feature to discover its contributions. */
export function readSlots(source, context, resolve, diagnostics) {
  const { checker, relative } = context;
  const location = (node) => {
    const file = node.getSourceFile();
    const position = file.getLineAndCharacterOfPosition(node.getStart(file));
    return {
      file: relative(file.fileName),
      line: position.line + 1,
      column: position.character + 1,
    };
  };
  function fail(node, message) {
    diagnostics.push({
      severity: "error",
      code: "unsupported-slot-expression",
      ...location(node),
      message,
    });
  }
  function unwrap(node, seen = new Set()) {
    if (!node || seen.has(node)) return null;
    seen.add(node);
    if (
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isSatisfiesExpression(node) ||
      ts.isTypeAssertionExpression(node) ||
      ts.isNonNullExpression(node)
    )
      return unwrap(node.expression, seen);
    const declaration = resolve(node)?.declaration;
    if (
      declaration &&
      ts.isVariableDeclaration(declaration) &&
      declaration.initializer
    )
      return unwrap(declaration.initializer, seen);
    return node;
  }
  function key(node) {
    if (
      ts.isIdentifier(node) ||
      ts.isStringLiteralLike(node) ||
      ts.isNumericLiteral(node)
    )
      return node.text;
    if (ts.isComputedPropertyName(node)) {
      const value = unwrap(node.expression);
      if (value && ts.isStringLiteralLike(value)) return value.text;
    }
    fail(node, "Slot keys must be statically known strings.");
    return null;
  }
  function object(node, seen) {
    const value = unwrap(node);
    if (!value || !ts.isObjectLiteralExpression(value) || seen.has(value)) {
      fail(
        node,
        "Expected a static slots object (cyclic/dynamic values are unsupported).",
      );
      return new Map();
    }
    const next = new Set(seen).add(value);
    const result = new Map();
    for (const property of value.properties) {
      if (ts.isSpreadAssignment(property)) {
        for (const [name, expression] of object(property.expression, next))
          result.set(name, expression);
      } else if (
        ts.isPropertyAssignment(property) ||
        ts.isShorthandPropertyAssignment(property)
      ) {
        const name = key(property.name);
        if (name !== null)
          result.set(
            name,
            ts.isPropertyAssignment(property)
              ? property.initializer
              : property.name,
          );
      } else
        fail(
          property,
          "Only static properties and object spreads are supported in slots.",
        );
    }
    return result;
  }
  function array(node, seen) {
    const value = unwrap(node);
    if (!value || !ts.isArrayLiteralExpression(value) || seen.has(value)) {
      fail(
        node,
        "Expected a static component array (cyclic/dynamic values are unsupported).",
      );
      return [];
    }
    const next = new Set(seen).add(value);
    return value.elements.flatMap((element) => {
      if (ts.isSpreadElement(element)) return array(element.expression, next);
      const target = resolve(element);
      if (
        !target ||
        !checker.getTypeAtLocation(element).getCallSignatures().length
      ) {
        fail(element, "A slot component must resolve to a callable symbol.");
        return [];
      }
      return [{ name: target.name, ...location(target.declaration) }];
    });
  }
  function pages(node, seen) {
    const value = unwrap(node);
    if (!value || !ts.isArrayLiteralExpression(value) || seen.has(value)) {
      fail(node, "Expected a static feature pages array.");
      return {};
    }
    const next = new Set(seen).add(value);
    const result = {};
    for (const element of value.elements) {
      if (ts.isSpreadElement(element)) {
        Object.assign(result, pages(element.expression, next));
        continue;
      }
      const fields = object(element, next);
      const path = unwrap(fields.get("path"));
      if (!path || !ts.isStringLiteralLike(path)) {
        fail(element, "Feature page paths must be static strings.");
        continue;
      }
      const entry = {};
      for (const field of ["component", "icon"]) {
        const component = fields.get(field);
        const target = component && resolve(component);
        if (
          !target ||
          !checker.getTypeAtLocation(component).getCallSignatures().length
        ) {
          fail(
            element,
            `Feature page ${field} must resolve to a callable symbol.`,
          );
          continue;
        }
        entry[field] = [{ name: target.name, ...location(target.declaration) }];
      }
      result[path.text] = entry;
    }
    return result;
  }
  function tree(node, seen = new Set()) {
    const result = {};
    for (const [name, expression] of object(node, seen)) {
      const value = unwrap(expression);
      result[name] =
        name === "pages" && seen.size === 0
          ? pages(expression, seen)
          : value && ts.isArrayLiteralExpression(value)
            ? array(expression, seen)
            : tree(expression, new Set(seen).add(unwrap(node)));
    }
    return result;
  }
  const moduleSymbol = checker.getSymbolAtLocation(source);
  const exported =
    moduleSymbol &&
    checker
      .getExportsOfModule(moduleSymbol)
      .find((symbol) => symbol.name === "slots");
  if (!exported) return {};
  let symbol = exported;
  if (symbol.flags & ts.SymbolFlags.Alias)
    symbol = checker.getAliasedSymbol(symbol);
  const declaration = symbol.valueDeclaration;
  if (
    !declaration ||
    !ts.isVariableDeclaration(declaration) ||
    !declaration.initializer
  ) {
    fail(
      source,
      "The slots export must resolve to a statically declared variable.",
    );
    return {};
  }
  return tree(declaration.initializer);
}
