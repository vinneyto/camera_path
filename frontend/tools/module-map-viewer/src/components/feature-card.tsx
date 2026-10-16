import { useId } from "react";
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useFloating,
} from "@floating-ui/react";
import type { FeatureNode } from "../model/types";
import { SlotTooltip } from "./slot-tooltip";

interface Props {
  feature: FeatureNode;
  active: boolean;
  dimmed: boolean;
  onHover: (id: string | null) => void;
  onFocusFeature: (id: string | null) => void;
}
export function FeatureCard({
  feature,
  active,
  dimmed,
  onHover,
  onFocusFeature,
}: Props) {
  const tooltipId = useId();
  const {
    refs: { setReference, setFloating },
    floatingStyles,
  } = useFloating({
    open: active,
    placement: "top",
    middleware: [offset(12), flip(), shift({ padding: 12 })],
    whileElementsMounted: autoUpdate,
  });
  return (
    <>
      <button
        type="button"
        ref={setReference}
        data-node-id={feature.id}
        className={`graph-node feature-card${active ? " is-active" : ""}${dimmed ? " is-dimmed" : ""}`}
        aria-label={`Feature ${feature.label}`}
        aria-describedby={active ? tooltipId : undefined}
        onMouseEnter={() => onHover(feature.id)}
        onMouseLeave={() => onHover(null)}
        onMouseDown={(event) => event.preventDefault()}
        onFocus={() => onFocusFeature(feature.id)}
        onBlur={() => onFocusFeature(null)}
      >
        <span className="node-port port-left" />
        <span className="feature-card-heading">
          <span className="feature-symbol">◈</span>
          <strong>{feature.label}</strong>
        </span>
        <span className="feature-counts">
          <span>{feature.selectorIds.length} sel.</span>
          <span className="count-divider" />
          <span>{feature.actionIds.length} act.</span>
        </span>
        <span className="node-port port-right" />
      </button>
      {active && (
        <FloatingPortal>
          <div
            ref={setFloating}
            style={floatingStyles}
            id={tooltipId}
            role="tooltip"
            className="slot-tooltip"
          >
            <SlotTooltip feature={feature} />
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
