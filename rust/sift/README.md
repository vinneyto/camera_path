# SIFT detection lab (CP-107)

This is a detection-only port of `photogrammetry/src/sift/sift.py` as used by
`sift.ipynb` on 2026-10-27. It implements Gaussian octaves, DoG, strict extrema,
five localization attempts, contrast rejection and the optional edge filter.
Orientations, descriptors and matching are outside this demo.

Like Python, detection uses a fixed `border = 5` in each octave. Initial
candidates and every relocated integer position must satisfy
`5 <= x < width - 5` and `5 <= y < height - 5` in DoG coordinates. Scale bounds
remain `1 <= s < layers - 1`. The border applies before subpixel offsets, so a
final floating-point position may extend slightly into the margin. Octaves with
either spatial dimension at most 10 contain no eligible candidates. The default
host localization and optional GPU localization enforce the same bounds.

The notebook and its source files are read-only references. The reference
configuration uses `upscale_first = False`; this port does not implement first
octave upscaling. JSON coordinates refer to the processed image, with origin at
the upper left. Fields are `x`, `y`, `size`, `octave`, `class_id`, `response`.

## Backends

Burn 0.22 dispatches custom CubeCL kernels through its backend extension and
Fusion graph. Separable Gaussian kernels load reflected tiles into workgroup
memory. The vertical octave pass also computes DoG and decimates the selected
Gaussian layer for the next octave, without materializing the full Gaussian
stack or reflection/index tensors. The same Gaussian weights are cached between
frames. A specialized extrema kernel checks absolute contrast and all 26
neighbors in one pass per octave. It preserves
strict inequalities, including rejection of equal neighbors, and handles minima
and maxima independently of their sign. The CPU reference uses equivalent pooled
groups of 18 + 6 + 2 neighbors.
The CPU reference uses Burn convolutions with cached kernels and reflection
indices. Browser WASM explicitly initializes **WebGPU**, with no CPU
fallback. All octaves register their candidate masks and DoG volumes in one
frame-level transaction, followed by one explicit flush and one asynchronous
readback. Small 3×3 localization solves run on the host for those candidates.

`gpu-localization` is an opt-in experiment. It collects extrema into a compact
GPU candidate buffer, performs the five localization attempts and contrast/edge
rejection on GPU, and reads candidate records instead of dense DoG/mask volumes.
The atomic count detects capacity overflow; the octave is retried at the exact
required capacity, so points are never silently truncated. Host sorting restores
the original convergence-iteration/scale/y/x order and preserves duplicates.
It passes native and browser parity checks, but measured slower than the default
path on this machine, so the production WASM build leaves it disabled.

The native CLI defaults to Burn's **wgpu** backend (Metal/Vulkan/DX12 as selected
by wgpu). `--backend cpu` explicitly selects Burn Flex for reproducible reference
checks and CI. These share the same detector and parameters.

## Local browser demo

Requires Rust >= 1.95, Node 24 and wasm-pack:

```sh
rustup target add wasm32-unknown-unknown
cargo install wasm-pack --version 0.15.0 --locked
cd frontend
npm ci
npm run dev -- --port 3107
```

`predev` and `prebuild` build the WASM assets into ignored `frontend/public/sift`.
To rebuild explicitly, run `npm run sift:build` in `frontend`.
On Vercel, the build script installs the stable minimal Rust toolchain and WASM
target and wasm-pack 0.15.0 inside the ephemeral build container when needed.
Open `http://localhost:3107/sift`, or choose **SIFT lab** in the desktop rail or
mobile menu. This page works without the Python backend or a project.

Choose **Start camera** and grant camera access. Rear camera is preferred on a
phone; after access is granted, the camera selector lists available devices.
**Stop**, navigation, an error or unmount stops the tracks and worker and disposes
the Three.js resources. **Open image** allows repeatable testing without a camera. **Detect again** reuses
the current image and GPU session to measure warmed execution.

**Open video** loads a local MOV, MP4 or another browser-decodable video without
uploading it. The first decoded frame is analyzed while paused. Use **Play/Pause**,
the keyboard-accessible seek bar and the elapsed/duration display; **Replay**
restarts an ended clip. Playback is muted. MOV/H.264 and MP4/H.264 were verified
in the local in-app browser; container support alone does not guarantee support
for its codec (for example, a phone's HEVC recording). Unsupported files show a
message suggesting MP4/H.264. There is no transcoder or server upload.

Video uses the same Three.js VideoTexture and Burn WebGPU worker as the camera.
During playback the overlay is the latest completed detection, so fast motion
can show the detector's latency. Pausing, seeking or changing settings clears the
old overlay and analyzes the selected frame. Results already in flight from a
previous position/settings are discarded. Only one detection is in flight;
paused playback does not repeatedly detect the same frame. Stop, source changes
and navigation abort loading, unload the decoder, revoke its object URL and
dispose the worker and rendering resources. The Rust detector is unchanged.

A phone must open a **trusted HTTPS origin**, rather than an HTTP LAN address.
For local HTTPS, use Next's `--experimental-https` with a certificate trusted by
the phone (for example, a local CA installed on that device). Certificate trust
and camera permissions are configured by the user. No camera data leaves the
browser. WebGPU must also be available inside the browser's workers; an unsupported
browser shows an error instead of changing the compute backend.

Three.js displays the live `VideoTexture` and GPU point geometry. A detached 2D
canvas only extracts input pixels; it never draws the point overlay. The live
preview keeps running while one detection is in flight. The overlay is the latest
completed detection, so fast motion can show detection latency. Plasma colors
follow the notebook's ranking of octaves present in the current result.

- **ms / detection** measures one awaited WASM call: grayscale conversion,
  pyramid, GPU execution/readback, localization and result conversion. Rendering
  and frame capture are excluded. The first call includes GPU shader compilation. The expandable timing breakdown
  separates grayscale, pyramid/extrema setup, submission, wait/readback and localization.
- **detector FPS** is `1000 / detection_ms`, the corresponding compute throughput.
- **processed FPS** uses the last 20 completed frame intervals, including capture,
  transfer and scheduling. Only one detection is allowed in flight.

Changing thresholds/resolution reprocesses an image and updates the next camera
frame without requesting camera access or reinitializing the GPU.

## Native CLI

```sh
cargo run --release --manifest-path rust/sift/Cargo.toml -- \
  input.jpg --output points.json
cargo run --release --manifest-path rust/sift/Cargo.toml -- \
  input.png --backend cpu --params params.json --output points.json
```

CLI input is PNG/JPEG at its original dimensions (3–4096 pixels per axis).
The browser processes the selected longest-edge resolution. Use the same resized
input and parameters when comparing. The CLI prints detection time/FPS to stderr
and writes the plain keypoint array to the requested JSON file.

`--params` accepts a JSON object overriding defaults:

```json
{
  "n_octave_layers": 3,
  "contrast_threshold": 0.04,
  "edge_threshold": 10.0,
  "sigma": 1.6,
  "enable_subpixel_localization": true,
  "enable_edge_like_filtering": true
}
```

`--gray-json` reads `{ "width": 129, "height": 97, "pixels": [...] }` with
normalized float32 grayscale samples in row-major order. It bypasses color/image
conversion for exact numerical comparisons with Python.

## Verification

```sh
cargo test --manifest-path rust/sift/Cargo.toml --locked
cargo clippy --manifest-path rust/sift/Cargo.toml --locked -- -D warnings
```

The committed fixture was generated by the original Python functions, and covers
odd dimensions and four parameter combinations. Tests also cover invalid inputs
and flat/tiny images. Border tests cover all four edges, inclusive/exclusive
bounds, relocation across the margin, subpixel positions and the smallest
eligible octave. With `border = 5`, the Python fixture contains 21/23/21/24 points;
the 384×512 notebook image contains 191/231/191/215 for the same four configurations.
The archived performance measurements below predate this border change and
retain their original 192-point input results.
To compare the actual notebook image without modifying any
reference source, run in photogrammetry's Python environment:

```sh
PYTHONDONTWRITEBYTECODE=1 /path/to/photogrammetry/.venv/bin/python \
  rust/sift/scripts/verify_reference.py \
  --source /path/to/photogrammetry/src/sift \
  --cli rust/sift/target/release/sift \
  --backend cpu \
  --image /path/to/photogrammetry/src/sift/data/mysh1.jpg
```

Repeat with `--backend gpu` to compare native GPU execution. The checker matches
points within octave/layer, preserving multiplicity, and rejects count or position
changes. Float32 convolution/solve ordering can cause small numeric differences;
this is not a bitwise-equivalence claim. Browser resampling/grayscale can differ
from OpenCV's resize and integer grayscale conversion.

Run the GPU fixture and specialized-kernel tests explicitly on a GPU machine:

```sh
cargo test --release --manifest-path rust/sift/Cargo.toml --locked -- --include-ignored
```

The kernel test covers all 26 equal-neighbor positions, both signs, negative
maxima and positive minima, exact contrast equality, odd dispatch dimensions and
transposed input strides. Gaussian tests compare tiny and odd images at the
supported sigma/layer limits, including halos wider than an image. To also run
compact GPU localization, ordering and forced-overflow tests:

```sh
cargo test --release --manifest-path rust/sift/Cargo.toml --locked \
  --features gpu-localization -- --include-ignored
```

## Reproducing the browser performance comparison

On this Mac / in-app browser, the fixed 384×512 notebook frame (192 points)
measured as follows on 2026-10-27:

| Backend / implementation          |      p50 |      p95 |
| --------------------------------- | -------: | -------: |
| Original WebGPU (`66c4983`)       | 165.9 ms | 174.4 ms |
| Default optimized WebGPU          |  53.4 ms |  56.4 ms |
| GPU localization experiment       |  72.5 ms |  75.1 ms |
| CPU / Flex, same current detector |  68.7 ms |  69.7 ms |

The default GPU result is bitwise identical to the original serialized point
array. The GPU localization experiment differs by at most 0.00001 px; CPU differs
by at most 0.0003 px. The default therefore remains the faster hybrid path. Full
samples, parameters, hashes and the earlier readback/extrema-only comparison are
saved in [`benchmarks/webgpu-2026-10-27.json`](benchmarks/webgpu-2026-10-27.json).
These warmed measurements describe this input/browser/device, not phone FPS.

The follow-up profile below found that 12 warm-up calls were insufficient for
steady-state runtime performance. Keep the table above as an early-warm-up
snapshot; do not compare its CPU row with the longer-warmed GPU figures below.

`scripts/benchmark-webgpu.mjs` serves a fixed PNG and three saved release WASM
packages. Prepare a directory with `frame.png` and `before/`, `batch/`, `after/`, `gaussian/`, `sparse/`, `cpu/`,
each containing `camera_path_sift.js` and `camera_path_sift_bg.wasm`. Build each
revision with `npm run sift:build`, then copy those two generated files before
building the next revision. `before` is commit `66c4983`; `batch` is the optional
frame-level-transaction-only intermediate; `after` is commit `5b1e95c` with the
custom extrema kernel; `gaussian` is the current default optimized GPU build.
For the same current source, build `sparse` and `cpu` as follows (all variants
use release optimization level 2):

```sh
CARGO_PROFILE_RELEASE_OPT_LEVEL=2 wasm-pack build rust/sift --target web --release \
  --out-dir /absolute/benchmark-directory/sparse --out-name camera_path_sift \
  --no-default-features --features wasm,gpu-localization --locked
CARGO_PROFILE_RELEASE_OPT_LEVEL=2 wasm-pack build rust/sift --target web --release \
  --out-dir /absolute/benchmark-directory/cpu --out-name camera_path_sift \
  --no-default-features --features wasm-cpu --locked
```

`wasm-cpu` exists only for explicit benchmark builds. The application's build
script always selects `wasm` / WebGPU; there is no automatic CPU fallback.

```sh
node rust/sift/scripts/benchmark-webgpu.mjs /absolute/benchmark-directory 3110
```

Open `http://localhost:3110`, run **Before** first and then the other variants.
Each run uses 12 warm-up detections and 30 measured detections with default
parameters, reusing the detector and GPU session. It reports p50/p95 of the
awaited WASM call, excludes camera/capture/rendering, checks deterministic output
on every call and compares the complete serialized point array with Before.
It also verifies count, octave/layer and nearest-point numerical tolerance
(0.005 px/size, 0.0002 response), preserving multiplicity for CPU/GPU float32
differences.
Expand **Raw measurements** to save the full results. Repeating a variant reuses
its existing detector; reload the page for a fresh session. Stage timings include
lazy Burn work and should not be interpreted as GPU timestamp measurements.

## Separating CPU/WASM, WebGPU submission and GPU execution

The optional `profiling` feature adds `Detector.profile_rgba` and the native
`profiling::detect` diagnostic entrypoint. Normal frontend builds use only
`wasm`, so they install no launch observers, host spans or WebGPU API wrappers.
The detector algorithm and normal batching are unchanged.

Reuse the fixed `frame.png` from the comparison above. Prepare an artifact
directory containing that PNG and build a diagnostic package into `pkg/`:

```sh
CARGO_PROFILE_RELEASE_OPT_LEVEL=2 wasm-pack build rust/sift --target web --release \
  --out-dir /absolute/profile-directory/pkg --out-name camera_path_sift \
  --no-default-features --features wasm,profiling --locked
node rust/sift/scripts/profile-webgpu.mjs /absolute/profile-directory 3111
```

Open `http://localhost:3111` and choose **Run all modes**. One persistent worker
first performs 120 unprofiled detections. Each mode then gets 12 warm-up calls
and 30 measurements, followed by another unprofiled baseline. Every call must
produce exactly the same serialized point array. **Save JSON** exports samples,
representative timelines, API counts/bytes and the warm-up curve. Camera capture,
Three.js rendering and worker message transfer are outside the measured call.

The 384×512 / 192-point run on 2026-10-27 produced:

| Mode                          | Call p50 / p95 |          GPU timestamp interval | Queue submissions / frame |
| ----------------------------- | -------------: | ------------------------------: | ------------------------: |
| Baseline after 120 calls      | 24.6 / 26.6 ms |                    Not measured |                Not probed |
| WebGPU API probe              | 25.6 / 28.5 ms |                    Not measured |                         2 |
| Host kernel spans + API probe | 25.1 / 26.3 ms |                    Not measured |                         2 |
| One outer GPU window          | 26.7 / 31.4 ms |                         5.44 ms |                         4 |
| Per-kernel GPU windows        | 55.8 / 58.5 ms | 36.90 ms including induced gaps |                        63 |
| Final baseline control        | 24.7 / 25.2 ms |                    Not measured |                Not probed |

`gpu_submit_ms` is the host wall time of `Device.flush()`, not a GPU duration.
It fell from about 31 ms in the earlier short warm-up to about 11.8 ms after
longer warm-up. In host mode, synchronous custom-kernel handlers total about
1.5 ms and the nested synchronous WebGPU API calls about 0.3 ms (the browser's
CPU clock quantum was about 0.1 ms). These are nested measurements, not separate
pieces to add or subtract from medians. Much of the host runtime work happens
outside our kernel handlers; this profile does not identify the exact Fusion,
CubeCL or wgpu function responsible for that residual cost.

The minimally instrumented GPU window contains 20 dispatches: 7 horizontal
Gaussian passes, 1 initial vertical pass, 6 fused vertical/DoG/decimation passes
and 6 extrema passes. Ordinary warmed frames create no GPU buffers, shader
modules or compute pipelines. They upload 786,432 bytes and copy 8,344,512 bytes
back across 12 mapped buffers. The roughly 8.5 ms readback/wait phase includes
GPU execution, copy/map and host processing, so it must not be added to the GPU
interval as an independent cost.

Per-kernel timing is deliberately a separate experiment: CubeCL's deferred
timers preserve asynchronous reads but split compute passes and submit work for
their queries. The 36.90 ms interval therefore includes profiler-induced gaps.
Short kernels sometimes have no resolved measurement; these remain `null`, and
the partial sum reports its coverage. System-clock fallbacks are never labeled
GPU time. GPU-relative timelines are normalized to the first measured GPU event
and are not aligned to the CPU clock. Without timestamp-query support, use
`host` mode; GPU modes return a clear error.

Full data: [`benchmarks/profile-webgpu-2026-10-27.json`](benchmarks/profile-webgpu-2026-10-27.json).
The next investigation should focus on host queue/runtime processing and dense
readback, while retaining the same warm-up protocol. The historical CPU and
GPU-localization comparisons also need that protocol before drawing new
steady-state conclusions.

```sh
cargo test --release --manifest-path rust/sift/Cargo.toml --features profiling \
  profiles_preserve_points_and_release_observer -- --ignored --test-threads=1
```

GPU profiling tests run serially because the launch observer is process-wide.
