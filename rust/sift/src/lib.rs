//! Port of photogrammetry/src/sift/sift.py (2026-10-27), detection only.
mod detector;
mod detector_plan;
#[cfg(feature = "gpu")]
mod extrema_kernel;
mod extrema_mask;
#[cfg(any(feature = "cpu", test))]
mod extrema_mask_reference;
#[cfg(feature = "gpu")]
mod gaussian_kernel;
#[cfg(feature = "gpu")]
mod gaussian_ops;
#[cfg(feature = "gpu-localization")]
mod gpu_detector;
#[cfg(feature = "gpu")]
mod gpu_pyramid;
#[cfg(feature = "gpu-localization")]
mod localization_kernel;
#[cfg(feature = "gpu-localization")]
mod localization_ops;
mod pyramid;
#[cfg(any(feature = "wasm", feature = "wasm-cpu"))]
mod wasm;
pub use detector::find_scale_space_extrema;
pub use pyramid::{build_dog, build_octaves};
use serde::{Deserialize, Serialize};

#[cfg(all(test, feature = "cli"))]
fn test_gpu_device() -> burn::tensor::Device {
    static DEVICE: std::sync::OnceLock<burn::tensor::Device> = std::sync::OnceLock::new();
    DEVICE
        .get_or_init(|| burn::tensor::Device::wgpu_options().init().unwrap())
        .clone()
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct Params {
    pub n_octave_layers: usize,
    pub contrast_threshold: f32,
    pub edge_threshold: f32,
    pub sigma: f64,
    pub enable_subpixel_localization: bool,
    pub enable_edge_like_filtering: bool,
}
impl Default for Params {
    fn default() -> Self {
        Self {
            n_octave_layers: 3,
            contrast_threshold: 0.04,
            edge_threshold: 10.0,
            sigma: 1.6,
            enable_subpixel_localization: true,
            enable_edge_like_filtering: true,
        }
    }
}
impl Params {
    pub fn validate(&self) -> Result<(), String> {
        if !(1..=8).contains(&self.n_octave_layers)
            || !self.contrast_threshold.is_finite()
            || self.contrast_threshold <= 0.0
            || !self.edge_threshold.is_finite()
            || self.edge_threshold <= 0.0
            || !self.sigma.is_finite()
            || !(0.6..=3.0).contains(&self.sigma)
        {
            return Err(
                "Expected 1–8 layers, positive finite thresholds and sigma between 0.6 and 3"
                    .into(),
            );
        }
        Ok(())
    }
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GrayImage {
    pub width: usize,
    pub height: usize,
    pub pixels: Vec<f32>,
}
impl GrayImage {
    pub fn validate(&self) -> Result<(), String> {
        if self.width < 3
            || self.height < 3
            || self.width > 4096
            || self.height > 4096
            || self.width.checked_mul(self.height) != Some(self.pixels.len())
            || self
                .pixels
                .iter()
                .any(|v| !v.is_finite() || !(0.0..=1.0).contains(v))
        {
            return Err(
                "Expected a 3–4096 px image with width × height finite grayscale samples in [0, 1]"
                    .into(),
            );
        }
        Ok(())
    }
    pub fn from_rgba(width: usize, height: usize, rgba: &[u8]) -> Result<Self, String> {
        if width.checked_mul(height).and_then(|n| n.checked_mul(4)) != Some(rgba.len()) {
            return Err("RGBA buffer length does not match image dimensions".into());
        }
        let image = Self {
            width,
            height,
            pixels: rgba
                .as_chunks::<4>()
                .0
                .iter()
                .map(|p| (0.299 * p[0] as f32 + 0.587 * p[1] as f32 + 0.114 * p[2] as f32) / 255.0)
                .collect(),
        };
        image.validate()?;
        Ok(image)
    }
}
pub type Octave = Vec<burn::tensor::Tensor<2>>;
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct KeyPoint {
    pub x: f32,
    pub y: f32,
    pub size: f32,
    pub octave: i32,
    pub class_id: usize,
    pub response: f32,
}
#[derive(Default, Debug, Serialize)]
pub struct Timings {
    pub grayscale_ms: f64,
    pub pyramid_setup_ms: f64,
    pub extrema_setup_ms: f64,
    pub gpu_submit_ms: f64,
    pub gpu_readback_ms: f64,
    pub localization_ms: f64,
    pub cleanup_ms: f64,
}
#[derive(Serialize)]
pub struct DetectionReport {
    pub points: Vec<KeyPoint>,
    pub timings: Timings,
}
pub async fn detect(
    image: &GrayImage,
    params: &Params,
    device: &burn::tensor::Device,
) -> Result<Vec<KeyPoint>, String> {
    Ok(detect_profiled(image, params, device).await?.points)
}
pub async fn detect_profiled(
    image: &GrayImage,
    params: &Params,
    device: &burn::tensor::Device,
) -> Result<DetectionReport, String> {
    detect_cached(image, params, device, &mut None).await
}
pub(crate) async fn detect_cached(
    image: &GrayImage,
    params: &Params,
    device: &burn::tensor::Device,
    plan: &mut Option<detector_plan::DetectorPlan>,
) -> Result<DetectionReport, String> {
    image.validate()?;
    params.validate()?;
    let start = web_time::Instant::now();
    if plan.as_ref().is_none_or(|p| !p.matches(image, params)) {
        *plan = Some(detector_plan::DetectorPlan::new(image, params, device));
    }
    let dog = plan
        .as_ref()
        .unwrap()
        .build(image)
        .into_iter()
        .enumerate()
        .collect::<Vec<_>>();
    let mut timings = Timings {
        pyramid_setup_ms: start.elapsed().as_secs_f64() * 1000.0,
        ..Timings::default()
    };
    let points = detector::find_profiled(&dog, params, &mut timings).await?;
    let cleanup_start = web_time::Instant::now();
    drop(dog);
    timings.cleanup_ms = cleanup_start.elapsed().as_secs_f64() * 1000.0;
    Ok(DetectionReport { points, timings })
}
