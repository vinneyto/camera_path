import { dyno } from "@sparkjsdev/spark";
import { DEPTH_ALPHA_CUTOFF } from "../../depth/constants";
/** Spark's official render-cube-depth demo opacity rule, before covariance conversion. */
export function createSparkDepthFilter() {
  return dyno.dynoBlock(
    { gsplat: dyno.Gsplat },
    { gsplat: dyno.Gsplat },
    ({ gsplat }) =>
      new dyno.Dyno({
        inTypes: { gsplat: dyno.Gsplat },
        outTypes: { gsplat: dyno.Gsplat },
        inputs: { gsplat },
        statements: ({ inputs, outputs }) => [
          `${outputs.gsplat} = ${inputs.gsplat};`,
          `if (${inputs.gsplat}.rgba.a > ${DEPTH_ALPHA_CUTOFF}) { ${outputs.gsplat}.rgba.a = 1.0; } else { ${outputs.gsplat}.flags = 0u; }`,
        ],
      }).outputs,
  );
}
