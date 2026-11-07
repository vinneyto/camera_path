"use client";

import { useId, useState } from "react";
import { Input } from "@camera-path/ui-kit";

export function OptionalJobName({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);

  if (!expanded) {
    return (
      <button
        type="button"
        className="text-xs text-muted-foreground underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => setExpanded(true)}
      >
        Set name
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium">
        Job name (optional)
      </label>
      <Input
        id={id}
        value={value}
        maxLength={200}
        autoFocus
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
