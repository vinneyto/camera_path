import { installWebGpuProbe } from "/webgpu-probe.mjs";
import init, { Detector } from "/pkg/camera_path_sift.js";

const probe = installWebGpuProbe();
let detector;
let baseline;
let totalCalls = 0;
let prewarmTrace = [];
const clockQuantum = (() => {
  let previous = performance.now(),
    minimum = Infinity;
  for (let i = 0; i < 4096; i++) {
    const now = performance.now();
    if (now > previous) minimum = Math.min(minimum, now - previous);
    previous = now;
  }
  return Number.isFinite(minimum) ? minimum : null;
})();
const percentile = (values, p) => {
  const sorted = values
    .filter((x) => typeof x === "number" && Number.isFinite(x))
    .sort((a, b) => a - b);
  return sorted.length ? sorted[Math.ceil(sorted.length * p) - 1] : null;
};
const median = (values) => percentile(values, 0.5);
const groupKernels = (samples, key, value) => {
  const groups = new Map();
  for (const sample of samples) {
    const frame = new Map();
    for (const kernel of sample.profile?.[key] ?? []) {
      const name = kernel.name;
      const row = frame.get(name) ?? { calls: 0, ms: 0, unmeasured: 0 };
      row.calls++;
      if (typeof kernel[value] === "number") row.ms += kernel[value];
      else row.unmeasured++;
      frame.set(name, row);
    }
    for (const [name, row] of frame) {
      const group = groups.get(name) ?? { calls: [], ms: [], unmeasured: [] };
      group.calls.push(row.calls);
      group.ms.push(row.ms);
      group.unmeasured.push(row.unmeasured);
      groups.set(name, group);
    }
  }
  return Object.fromEntries(
    [...groups].map(([name, row]) => [
      name,
      {
        calls_p50: median(row.calls),
        measured_sum_ms_p50: median(row.ms),
        unmeasured_calls_p50: median(row.unmeasured),
      },
    ]),
  );
};

self.onmessage = async ({ data }) => {
  try {
    const {
      mode,
      width,
      height,
      rgba,
      params,
      prewarm = 120,
      warmup = 12,
      measured = 30,
    } = data;
    const pixels = new Uint8Array(rgba);
    if (!detector) {
      await init();
      detector = await Detector.create();
      for (let i = 0; i < prewarm; i++) {
        self.postMessage({
          kind: "progress",
          mode,
          text: `Unprofiled session warm-up ${i + 1}/${prewarm}`,
        });
        const start = performance.now();
        const json = await detector.detect_rgba(width, height, pixels, params);
        prewarmTrace.push(performance.now() - start);
        totalCalls++;
        const points = JSON.stringify(JSON.parse(json).points);
        if (baseline === undefined) baseline = points;
        if (points !== baseline)
          throw new Error("Points changed during session warm-up");
      }
    }
    const callsBeforeMode = totalCalls;
    const samples = [];
    for (let i = 0; i < warmup + measured; i++) {
      self.postMessage({
        kind: "progress",
        mode,
        text:
          i < warmup
            ? `Warm-up ${i + 1}/${warmup}`
            : `Measuring ${i - warmup + 1}/${measured}`,
      });
      if (mode !== "baseline") probe.start();
      const start = performance.now();
      const json =
        mode === "baseline" || mode === "apis"
          ? await detector.detect_rgba(width, height, pixels, params)
          : await detector.profile_rgba(width, height, pixels, params, mode);
      const call_wall_ms = performance.now() - start;
      totalCalls++;
      const apis = probe.finish() ?? {};
      const parseStart = performance.now();
      const report = JSON.parse(json);
      const json_parse_ms = performance.now() - parseStart;
      const points = JSON.stringify(report.points);
      if (baseline === undefined) baseline = points;
      if (points !== baseline)
        throw new Error(`Profiling changed point output in ${mode}`);
      if (i >= warmup)
        samples.push({
          call_wall_ms,
          json_parse_ms,
          timings: report.timings,
          profile: report.profile ?? null,
          apis,
        });
    }
    const keys = new Set(mode === "baseline" ? [] : probe.instrumented);
    const api_p50 = Object.fromEntries(
      [...keys].map((key) => [
        key,
        Object.fromEntries(
          [
            "calls",
            "sync_cpu_ms",
            "bytes",
            "async_settled_ms_sum",
            "async_calls",
            "failures",
          ].map((field) => [
            field,
            median(samples.map((s) => s.apis[key]?.[field] ?? 0)),
          ]),
        ),
      ]),
    );
    const metrics = [
      "detection_wall_ms",
      "marker_control_wall_ms",
      "resolve_wall_ms",
      "kernel_host_sum_ms",
      "gpu_window_ms",
      "gpu_kernel_sum_ms",
      "gpu_kernel_measured_sum_ms",
      "gpu_kernels_measured",
      "gpu_kernels_unmeasured",
      "gpu_kernel_span_ms",
    ];
    const result = {
      mode,
      width,
      height,
      warmup,
      measured,
      points: JSON.parse(baseline).length,
      exact_points: true,
      prewarm_calls: prewarmTrace.length,
      calls_before_mode: callsBeforeMode,
      prewarm_trace_ms:
        callsBeforeMode === prewarmTrace.length ? prewarmTrace : undefined,
      cpu_clock_quantum_ms: clockQuantum,
      cross_origin_isolated: self.crossOriginIsolated,
      call_p50_ms: median(samples.map((s) => s.call_wall_ms)),
      call_p95_ms: percentile(
        samples.map((s) => s.call_wall_ms),
        0.95,
      ),
      json_parse_p50_ms: median(samples.map((s) => s.json_parse_ms)),
      profile_p50: Object.fromEntries(
        metrics.map((key) => [
          key,
          median(samples.map((s) => s.profile?.[key])),
        ]),
      ),
      timings_p50: Object.fromEntries(
        Object.keys(samples[0].timings).map((key) => [
          key,
          median(samples.map((s) => s.timings[key])),
        ]),
      ),
      api_cpu_p50_ms:
        mode === "baseline"
          ? null
          : median(
              samples.map((s) =>
                Object.values(s.apis).reduce(
                  (sum, row) => sum + row.sync_cpu_ms,
                  0,
                ),
              ),
            ),
      api_p50,
      host_kernels: groupKernels(samples, "host_kernels", "wall_ms"),
      gpu_kernels: groupKernels(samples, "gpu_kernels", "gpu_ms"),
      instrumented: probe.instrumented,
      launches: samples[0].profile?.launched ?? [],
      resolved_synchronously: samples[0].profile?.resolved_synchronously ?? 0,
      timestamp_query: samples[0].profile?.timestamp_query ?? null,
      device: samples[0].profile?.device ?? null,
      samples: samples.map((s) => ({
        call_wall_ms: s.call_wall_ms,
        profile: s.profile
          ? Object.fromEntries(metrics.map((key) => [key, s.profile[key]]))
          : null,
      })),
      representative: samples.toSorted(
        (a, b) => a.call_wall_ms - b.call_wall_ms,
      )[Math.floor(samples.length / 2)],
    };
    self.postMessage({ kind: "result", result });
  } catch (error) {
    probe.finish();
    self.postMessage({ kind: "error", message: error.stack ?? String(error) });
  }
};
