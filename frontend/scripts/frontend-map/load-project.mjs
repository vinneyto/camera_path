import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

export function loadProject(configPath) {
  const root = path.dirname(path.resolve(configPath));
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error)
    throw new Error(
      ts.flattenDiagnosticMessageText(config.error.messageText, "\n"),
    );
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  if (parsed.errors.length)
    throw new Error(
      ts.formatDiagnosticsWithColorAndContext(parsed.errors, {
        getCanonicalFileName: (file) => file,
        getCurrentDirectory: () => root,
        getNewLine: () => "\n",
      }),
    );
  const relative = (file) =>
    path.relative(root, file).split(path.sep).join("/");
  const isSource = (file) => {
    const parts = relative(file).split("/");
    const name = path.basename(file);
    return (
      !parts.includes("node_modules") &&
      !parts.includes(".next") &&
      !parts.includes("generated") &&
      !relative(file).startsWith("packages/types/src/api/") &&
      !name.includes(".test.") &&
      !name.includes(".spec.") &&
      !name.includes(".type-test.") &&
      !name.endsWith(".d.ts")
    );
  };
  const workspaces = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8"),
  ).workspaces;
  if (
    !Array.isArray(workspaces) ||
    !workspaces.every((p) => typeof p === "string")
  )
    throw new Error(
      "The frontend package.json must declare a workspaces array.",
    );
  const manifests = ts.sys
    .readDirectory(
      root,
      [".json"],
      ["**/node_modules/**"],
      workspaces.map((p) => `${p}/package.json`),
    )
    .sort();
  const modules = manifests
    .map((file) => {
      const directory = path.dirname(file);
      const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
      const name = manifest.name;
      const moduleRoot = relative(directory);
      return {
        name,
        root: moduleRoot,
        kind: moduleRoot.startsWith("packages/features/")
          ? "feature"
          : moduleRoot.startsWith("apps/")
            ? "host"
            : "shared",
        directory,
        entrypoint: path.resolve(
          directory,
          typeof manifest.exports?.["."] === "string"
            ? manifest.exports["."]
            : "src/index.ts",
        ),
      };
    })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const moduleOf = (file) =>
    modules.find((module) => {
      const location = relative(file);
      return (
        location.startsWith(`${module.root}/src/`) ||
        (module.kind === "host" &&
          module.name === "@camera-path/host" &&
          location.startsWith("src/app/"))
      );
    });
  const program = ts.createProgram({
    rootNames: parsed.fileNames.filter(isSource),
    options: parsed.options,
  });
  const files = program
    .getSourceFiles()
    .filter(
      (source) =>
        !source.isDeclarationFile &&
        isSource(source.fileName) &&
        moduleOf(source.fileName),
    );
  files.sort((a, b) => (relative(a.fileName) < relative(b.fileName) ? -1 : 1));
  return {
    program,
    checker: program.getTypeChecker(),
    root,
    relative,
    files,
    modules,
    moduleOf,
  };
}
