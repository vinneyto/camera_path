import type { CanvasProps } from "@react-three/fiber";
import { WebGPURenderer } from "three/webgpu";

type FunctionParameter<T> = T extends (props: infer P) => unknown ? P : never;
type CanvasGlProps = FunctionParameter<NonNullable<CanvasProps["gl"]>>;

export async function createWebGpuRenderer({ canvas }: CanvasGlProps) {
  const renderer = new WebGPURenderer({
    antialias: true,
    canvas: canvas as HTMLCanvasElement,
  });
  await renderer.init();
  renderer.setClearColor(0x000000, 0);
  return renderer;
}
