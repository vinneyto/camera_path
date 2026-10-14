"use client";
import { cn } from "@camera-path/ui-kit/lib/cn";
import { useEffect, useRef, type ComponentPropsWithoutRef } from "react";

type CheckboxProps = Omit<ComponentPropsWithoutRef<"input">, "type"> & {
  indeterminate?: boolean;
};

export function Checkbox({
  indeterminate = false,
  className,
  ...props
}: CheckboxProps) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (input.current) input.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      {...props}
      ref={input}
      type="checkbox"
      className={cn(
        "size-4 shrink-0 cursor-pointer accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-default",
        className,
      )}
    />
  );
}
