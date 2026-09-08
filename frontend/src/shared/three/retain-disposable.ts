interface Disposable {
  dispose(): void;
}

interface DisposableOwnership {
  count: number;
  timer: ReturnType<typeof setTimeout> | null;
}

const ownership = new WeakMap<Disposable, DisposableOwnership>();

export function retainDisposable(resource: Disposable): () => void {
  const state = ownership.get(resource) ?? { count: 0, timer: null };
  if (state.timer !== null) clearTimeout(state.timer);
  state.timer = null;
  state.count += 1;
  ownership.set(resource, state);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    state.count -= 1;
    if (state.count !== 0) return;

    // React Strict Mode immediately retains the same memoized resource again
    // after its development-only effect cleanup. Waiting one task lets that
    // retain cancel disposal without leaking resources after a real unmount.
    state.timer = setTimeout(() => {
      if (state.count !== 0) return;
      ownership.delete(resource);
      resource.dispose();
    }, 0);
  };
}
