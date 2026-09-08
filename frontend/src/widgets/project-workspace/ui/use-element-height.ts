"use client";

import { useLayoutEffect, useRef, useState } from "react";

export function useElementHeight(active: boolean) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!active || !element) {
      setHeight(0);
      return;
    }

    const updateHeight = () => setHeight(element.getBoundingClientRect().height);
    const observer = new ResizeObserver(updateHeight);
    updateHeight();
    observer.observe(element);
    return () => observer.disconnect();
  }, [active]);

  return { elementRef, height };
}
