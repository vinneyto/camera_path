import { afterEach, describe, expect, it, vi } from "vitest";

import { retainDisposable } from "./retain-disposable";

describe("retainDisposable", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps a resource alive across a Strict Mode effect probe", () => {
    vi.useFakeTimers();
    const resource = { dispose: vi.fn() };

    const releaseProbe = retainDisposable(resource);
    releaseProbe();
    const releaseMounted = retainDisposable(resource);
    vi.runAllTimers();

    expect(resource.dispose).not.toHaveBeenCalled();

    releaseMounted();
    vi.runAllTimers();

    expect(resource.dispose).toHaveBeenCalledOnce();
  });

  it("disposes a replaced resource without affecting its replacement", () => {
    vi.useFakeTimers();
    const previous = { dispose: vi.fn() };
    const next = { dispose: vi.fn() };

    retainDisposable(previous)();
    const releaseNext = retainDisposable(next);
    vi.runAllTimers();

    expect(previous.dispose).toHaveBeenCalledOnce();
    expect(next.dispose).not.toHaveBeenCalled();

    releaseNext();
    vi.runAllTimers();

    expect(next.dispose).toHaveBeenCalledOnce();
  });
});
