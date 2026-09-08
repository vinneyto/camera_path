"use client";

import { useEffect } from "react";

import { retainDisposable } from "./retain-disposable";

interface Disposable {
  dispose(): void;
}

export function useRetainedDisposable(resource: Disposable): void {
  useEffect(() => retainDisposable(resource), [resource]);
}
