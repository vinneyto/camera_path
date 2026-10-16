import { flattenSlots } from "../model/flatten-slots";
import type { FeatureNode } from "../model/types";

export function SlotTooltip({ feature }: { feature: FeatureNode }) {
  const rows = flattenSlots(feature.module.slots);
  return (
    <>
      <div className="tooltip-heading">
        <span className="feature-symbol">◈</span>
        <strong>{feature.label}</strong>
        <span className="tooltip-label">SLOTS</span>
      </div>
      {rows.length ? (
        <div className="slot-rows">
          {rows.map((row) => (
            <div className="slot-row" key={row.path}>
              <code className="slot-path">{row.path}</code>
              <div className="slot-components">
                {row.components.map((component, index) => (
                  <code key={`${component.file}:${component.line}:${index}`}>
                    {component.name}
                  </code>
                ))}
                {!row.components.length && <span>empty</span>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="tooltip-empty">This feature exports no slots.</p>
      )}
    </>
  );
}
