import { LIDAR_GPU_POLL_INTERVAL_MS } from "../../depth/constants";
/** Completion status only; no pixel or instance data crosses back to JavaScript. */
export function waitForWebGlGpu(
  context: WebGL2RenderingContext | WebGLRenderingContext,
): Promise<void> {
  if (!("fenceSync" in context))
    return Promise.reject(new Error("LiDAR requires WebGL2 fences"));
  const gl = context as WebGL2RenderingContext;
  const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  if (!sync)
    return Promise.reject(new Error("Unable to create LiDAR GPU fence"));
  const fence = sync;
  gl.flush();
  return new Promise((resolve, reject) => {
    function poll() {
      if (gl.isContextLost()) {
        gl.deleteSync(fence);
        reject(new Error("LiDAR WebGL context was lost"));
        return;
      }
      const status = gl.clientWaitSync(fence, 0, 0);
      if (status === gl.WAIT_FAILED) {
        gl.deleteSync(fence);
        reject(new Error("LiDAR GPU fence failed"));
      } else if (
        status === gl.ALREADY_SIGNALED ||
        status === gl.CONDITION_SATISFIED
      ) {
        gl.deleteSync(fence);
        resolve();
      } else setTimeout(poll, LIDAR_GPU_POLL_INTERVAL_MS);
    }
    poll();
  });
}
