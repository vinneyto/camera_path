import { MapPin } from "lucide-react";

import type { Anchor } from "@/entities/project/model/types";
import { Button } from "@/shared/ui/button";

interface AnchorReferencePickerProps {
  anchors: Anchor[];
  onSelect: (anchor: Anchor) => void;
}

export function AnchorReferencePicker({ anchors, onSelect }: AnchorReferencePickerProps) {
  if (anchors.length === 0) return null;
  return (
    <div className="flex gap-1 overflow-x-auto pb-1">
      {anchors.map((anchor) => (
        <Button
          className="h-6 shrink-0 px-2 text-[10px]"
          key={anchor.id}
          onClick={() => onSelect(anchor)}
          size="sm"
          type="button"
          variant="outline"
        >
          <MapPin className="size-3" />
          {anchor.label}
        </Button>
      ))}
    </div>
  );
}
