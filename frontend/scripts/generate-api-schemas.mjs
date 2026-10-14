import prettier from "prettier";
import fs from "node:fs";
const openapi = JSON.parse(fs.readFileSync("../backend/openapi.json", "utf8"));
fs.writeFileSync(
  "packages/contracts/src/api-schemas.json",
  await prettier.format(
    JSON.stringify(
      { $id: "camera-path-api", components: openapi.components },
      null,
      2,
    ) + "\n",
    { parser: "json" },
  ),
);
