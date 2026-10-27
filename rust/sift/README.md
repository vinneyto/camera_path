# SIFT detection lab (CP-107)

This is a detection-only port of `photogrammetry/src/sift/sift.py` as used by
`sift.ipynb` on 2026-10-27. It implements Gaussian octaves, DoG, strict extrema,
five localization attempts, contrast rejection and the optional edge filter.
Orientations, descriptors and matching are outside this demo.

The notebook and its source files are read-only references. The reference
configuration uses `upscale_first = False`; this port does not implement first
octave upscaling. JSON coordinates refer to the processed image, with origin at
the upper left. Fields are `x`, `y`, `size`, `octave`, `class_id`, `response`.

## Backends

Burn 0.22 runs Gaussian convolutions, DoG and all 26-neighbor comparisons as
tensor operations. The neighbor test partitions them into 18 + 6 + 2 disjoint
groups, using two pooling passes for both signs while preserving strict inequalities.
Gaussian kernels and reflection/downsampling index tensors are cached between frames.
All sigma layers of an octave share a horizontal convolution and a grouped vertical
convolution to reduce the number of CPU-to-GPU dispatches. Browser WASM explicitly initializes **WebGPU**, with no CPU
fallback. Each octave uses an asynchronous transaction to read its candidate mask
and DoG. Small 3×3 localization solves run on the host for those candidates.

The native CLI defaults to Burn's **wgpu** backend (Metal/Vulkan/DX12 as selected
by wgpu). `--backend cpu` explicitly selects Burn Flex for reproducible reference
checks and CI. These share the same detector and parameters.

## Local browser demo

Requires Rust >= 1.95, Node 24, and wasm-pack 0.13.1:

```sh
rustup target add wasm32-unknown-unknown
cargo install wasm-pack --version 0.13.1 --locked
cd frontend
npm ci
npm run dev -- --port 3107
```

`predev` and `prebuild` build the WASM assets into ignored `frontend/public/sift`.
To rebuild explicitly, run `npm run sift:build` in `frontend`.
Open `http://localhost:3107/sift`, or choose **SIFT lab** in the desktop rail or
mobile menu. This page works without the Python backend or a project.

Choose **Start camera** and grant camera access. Rear camera is preferred on a
phone; after access is granted, the camera selector lists available devices.
**Stop**, navigation, an error or unmount stops the tracks and worker and disposes
the Three.js resources. **Open image** allows repeatable testing without a camera. **Detect again** reuses
the current image and GPU session to measure warmed execution.

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
and flat/tiny images. To compare the actual notebook image without modifying any
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
