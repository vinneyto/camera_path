import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { format } from "prettier";
import { scanModules } from "./frontend-map/scan-modules.mjs";

export async function run(args = process.argv.slice(2)) {
  const { values } = parseArgs({
    args,
    options: {
      project: { type: "string" },
      output: { type: "string" },
      check: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
  });
  if (values.help) {
    console.log(
      "Usage: node scripts/scan-frontend.mjs [--project tsconfig.json] [--output report.json] [--check]",
    );
    return 0;
  }
  const defaultRoot = fileURLToPath(new URL("..", import.meta.url));
  const configPath = path.resolve(
    values.project ?? path.join(defaultRoot, "tsconfig.json"),
  );
  const output = path.resolve(
    values.output ??
      path.join(path.dirname(configPath), "docs/frontend-modules.json"),
  );
  const report = scanModules(configPath);
  const json = await format(JSON.stringify(report), { parser: "json" });
  if (values.check) {
    if (!fs.existsSync(output) || fs.readFileSync(output, "utf8") !== json) {
      console.error(
        `Frontend module report is stale: ${output}. Run npm run modules:scan.`,
      );
      return 1;
    }
  } else {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    const temporary = `${output}.${process.pid}.tmp`;
    try {
      fs.writeFileSync(temporary, json);
      fs.renameSync(temporary, output);
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  }
  for (const item of report.diagnostics)
    console.error(
      `${item.severity}: ${item.file}:${item.line}:${item.column}: ${item.message}`,
    );
  console.log(
    `${values.check ? "Verified" : "Saved"} ${report.modules.length} frontend modules: ${output}`,
  );
  return report.diagnostics.some((item) => item.severity === "error") ? 1 : 0;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    process.exitCode = await run();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
