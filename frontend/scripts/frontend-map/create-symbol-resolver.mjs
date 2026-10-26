import ts from "typescript";

/** Resolve identities with TypeScript, including import/re-export aliases and local aliases. */
export function createSymbolResolver(checker) {
  function symbolAt(node) {
    if (ts.isPropertyAccessExpression(node))
      return checker.getSymbolAtLocation(node.name);
    if (
      ts.isElementAccessExpression(node) &&
      node.argumentExpression &&
      ts.isStringLiteralLike(node.argumentExpression)
    )
      return checker
        .getTypeAtLocation(node.expression)
        .getProperty(node.argumentExpression.text);
    if (ts.isIdentifier(node) && ts.isShorthandPropertyAssignment(node.parent))
      return checker.getShorthandAssignmentValueSymbol(node.parent);
    return checker.getSymbolAtLocation(node);
  }
  function resolve(node, seen = new Set(), suppliedSymbol) {
    const initial = suppliedSymbol ?? symbolAt(node);
    if (!initial || seen.has(initial)) return null;
    seen.add(initial);
    const imported = initial.declarations?.find(ts.isImportSpecifier);
    let symbol = initial;
    while (symbol.flags & ts.SymbolFlags.Alias) {
      const target = checker.getAliasedSymbol(symbol);
      if (target === symbol || seen.has(target)) return null;
      seen.add(target);
      symbol = target;
    }
    const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0];
    if (!declaration) return null;
    if (ts.isBindingElement(declaration)) {
      const key = declaration.propertyName ?? declaration.name;
      if (ts.isIdentifier(key) || ts.isStringLiteralLike(key)) {
        const property = checker
          .getTypeAtLocation(declaration.parent)
          .getProperty(key.text);
        if (property && property !== symbol)
          return resolve(node, seen, property);
      }
    }
    if (
      ts.isVariableDeclaration(declaration) &&
      declaration.initializer &&
      (ts.isIdentifier(declaration.initializer) ||
        ts.isPropertyAccessExpression(declaration.initializer) ||
        ts.isElementAccessExpression(declaration.initializer))
    ) {
      const target = resolve(declaration.initializer, seen);
      if (target) return target;
    }
    let owner = declaration.parent;
    while (owner && !ts.isSourceFile(owner) && !ts.isFunctionDeclaration(owner))
      owner = owner.parent;
    const member =
      ts.isPropertyAssignment(declaration) ||
      ts.isMethodDeclaration(declaration) ||
      ts.isPropertySignature(declaration);
    const ownerName =
      member && owner && ts.isFunctionDeclaration(owner)
        ? owner.name?.text
        : undefined;
    return {
      symbol,
      declaration,
      name: imported
        ? (imported.propertyName ?? imported.name).text
        : ownerName
          ? `${ownerName}.${symbol.name}`
          : symbol.name,
    };
  }
  return resolve;
}
