"use client";

import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type RefObject,
  useState,
} from "react";
import type { ThreeEvent } from "@react-three/fiber";
import {
  GaussianCloud as GaussianCloudObject,
  GaussianStore,
  gaussianPass,
} from "3dgs-tile-webgpu";
import {
  PerspectiveCamera,
} from "three/webgpu";

import { useRenderPipeline } from "./render-pipeline";

type GaussianBackground = readonly [number, number, number, number];

export interface GaussianTileContextValue {
  store: GaussianStore;
  registerCloud: () => () => void;
}

interface GaussianTileProps extends PropsWithChildren {
  background: GaussianBackground;
}

interface GaussianCloudProps {
  cloudRef?: RefObject<GaussianCloudObject | null>;
  name?: string;
  onClick?: (event: ThreeEvent<MouseEvent>) => void;
  onError?: (error: Error) => void;
  onLoad?: (cloud: GaussianCloudObject) => void;
  onLoading?: () => void;
  src: string;
}

const GaussianTileContext = createContext<GaussianTileContextValue | null>(null);

/** Owns the shared GaussianStore and contributes its pass to the app pipeline. */
export function GaussianTile({ background, children }: GaussianTileProps) {
  const { camera, registerLayer, renderer } = useRenderPipeline();
  const [store] = useState(() => new GaussianStore());
  const [cloudCount, setCloudCount] = useState(0);

  const registerCloud = useCallback(() => {
    setCloudCount((count) => count + 1);
    let registered = true;
    return () => {
      if (!registered) return;
      registered = false;
      setCloudCount((count) => Math.max(0, count - 1));
    };
  }, []);

  const value = useMemo(() => ({ registerCloud, store }), [registerCloud, store]);
  const backgroundKey = background.join(",");

  useEffect(() => {
    if (cloudCount === 0) return;
    if (!(camera instanceof PerspectiveCamera)) {
      throw new TypeError("GaussianTile requires a PerspectiveCamera");
    }

    const pass = gaussianPass(renderer, camera, store, { background });
    const unregister = registerLayer(pass, { order: -100 });

    return () => {
      unregister();
      pass.dispose();
    };
  // backgroundKey deliberately tracks tuple values instead of tuple identity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backgroundKey, camera, cloudCount, registerLayer, renderer, store]);

  useEffect(() => () => store.dispose(), [store]);

  return (
    <GaussianTileContext.Provider value={value}>
      {children}
    </GaussianTileContext.Provider>
  );
}

/** Loads one PLY-backed GaussianCloud and mounts it as a native R3F object. */
export function GaussianCloud({
  cloudRef,
  name,
  onClick,
  onError,
  onLoad,
  onLoading,
  src,
}: GaussianCloudProps) {
  const { registerCloud, store } = useGaussianTile();
  const [cloud, setCloud] = useState<GaussianCloudObject | null>(null);

  useEffect(() => {
    let active = true;
    let loadedCloud: GaussianCloudObject | null = null;
    let unregister: (() => void) | null = null;
    onLoading?.();

    // Deferring one tick avoids downloading and parsing the PLY twice during
    // React Strict Mode's development-only effect probe.
    const loadTimer = window.setTimeout(() => {
      void store.load(src, { name }).then((result) => {
        if (!active) {
          result.dispose();
          return;
        }
        loadedCloud = result;
        result.raycastMode = "full";
        if (cloudRef) cloudRef.current = result;
        unregister = registerCloud();
        setCloud(result);
        onLoad?.(result);
      }).catch((reason: unknown) => {
        if (!active) return;
        onError?.(toError(reason));
      });
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(loadTimer);
      unregister?.();
      if (cloudRef?.current === loadedCloud) cloudRef.current = null;
      loadedCloud?.dispose();
    };
  }, [cloudRef, name, onError, onLoad, onLoading, registerCloud, src, store]);

  return cloud ? <primitive dispose={null} object={cloud} onClick={onClick} /> : null;
}

export function useGaussianTile(): GaussianTileContextValue {
  const value = useContext(GaussianTileContext);
  if (value === null) {
    throw new Error("GaussianCloud must be rendered inside GaussianTile");
  }
  return value;
}

function toError(reason: unknown): Error {
  return reason instanceof Error ? reason : new Error(String(reason));
}
