"use client";

import { type ComponentProps, useLayoutEffect, useRef } from "react";

import { Textarea } from "@/shared/ui";

const MAX_HEIGHT_PX = 192;

type AutoGrowingTextareaProps = ComponentProps<typeof Textarea>;

export function AutoGrowingTextarea({ value, ...props }: AutoGrowingTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (textarea === null) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_HEIGHT_PX)}px`;
    textarea.style.overflowY = textarea.scrollHeight > MAX_HEIGHT_PX ? "auto" : "hidden";
  }, [value]);

  return <Textarea {...props} ref={textareaRef} rows={1} value={value} />;
}
