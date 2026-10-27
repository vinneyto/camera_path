//! Opt-in diagnostics. GPU timings are resolved after detection, never per launch.
use burn::backend::{
    Backend, Dispatch, DispatchDevice, ProfileDuration, ProfileOptions, ProfileToken,
};
use burn::tensor::Device;
use cubecl::logging::{Duration, LaunchObservation, LaunchObserver, TimingMethod, TimingRequest};
use serde::Serialize;
use std::sync::{Arc, Mutex};
use web_time::Instant;

static ACTIVE: Mutex<Option<Arc<Recorder>>> = Mutex::new(None);

#[derive(Serialize)]
pub struct ProfiledDetection {
    #[serde(flatten)]
    pub report: crate::DetectionReport,
    pub profile: Profile,
}

/// Native diagnostic entrypoint; the browser's persistent detector uses the
/// cached variant so warm frames do not reconstruct the pyramid plan.
pub async fn detect(
    image: &crate::GrayImage,
    params: &crate::Params,
    device: &Device,
    mode: Mode,
) -> Result<ProfiledDetection, String> {
    detect_cached(image, params, device, &mut None, mode).await
}

pub(crate) async fn detect_cached(
    image: &crate::GrayImage,
    params: &crate::Params,
    device: &Device,
    plan: &mut Option<crate::detector_plan::DetectorPlan>,
    mode: Mode,
) -> Result<ProfiledDetection, String> {
    image.validate()?;
    params.validate()?;
    let session = Session::begin(device, mode)?;
    let start = Instant::now();
    let report = crate::detect_cached(image, params, device, plan).await?;
    let detection_ms = start.elapsed().as_secs_f64() * 1000.0;
    let profile = session.finish(detection_ms).await?;
    Ok(ProfiledDetection { report, profile })
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Mode {
    Host,
    Frame,
    Kernels,
}

impl Mode {
    pub fn parse(value: &str) -> Result<Self, String> {
        match value {
            "host" => Ok(Self::Host),
            "frame" => Ok(Self::Frame),
            "kernels" => Ok(Self::Kernels),
            _ => Err("Expected profiling mode host, frame or kernels".into()),
        }
    }
}

#[derive(Serialize)]
pub struct HostKernel {
    pub name: &'static str,
    pub start_ms: f64,
    pub end_ms: f64,
    pub wall_ms: f64,
}

#[derive(Serialize)]
pub struct GpuKernel {
    pub name: String,
    pub timing_method: String,
    pub gpu_ms: Option<f64>,
    pub start_ms: Option<f64>,
    pub end_ms: Option<f64>,
}

#[derive(Serialize)]
pub struct Profile {
    pub mode: String,
    pub device: String,
    pub timestamp_query: bool,
    pub detection_wall_ms: f64,
    pub marker_control_wall_ms: f64,
    pub resolve_wall_ms: f64,
    pub kernel_host_sum_ms: f64,
    pub gpu_window_ms: Option<f64>,
    pub gpu_kernel_sum_ms: Option<f64>,
    pub gpu_kernel_measured_sum_ms: Option<f64>,
    pub gpu_kernels_measured: usize,
    pub gpu_kernels_unmeasured: usize,
    pub gpu_kernel_span_ms: Option<f64>,
    pub launched: Vec<String>,
    pub host_kernels: Vec<HostKernel>,
    pub gpu_kernels: Vec<GpuKernel>,
    pub resolved_synchronously: usize,
}

struct Recorder {
    epoch: Instant,
    mode: Mode,
    host: Mutex<Vec<HostKernel>>,
    launches: Mutex<Vec<&'static str>>,
    pending: Mutex<Vec<(&'static str, ProfileDuration)>>,
    synchronous: Mutex<Vec<(&'static str, f64, TimingMethod)>>,
}

impl LaunchObserver for Recorder {
    fn launched(&self, kernel: &'static str) {
        self.launches.lock().unwrap().push(kernel);
    }
    fn timing(&self) -> TimingRequest {
        if self.mode == Mode::Kernels {
            TimingRequest::Deferred
        } else {
            TimingRequest::None
        }
    }
    fn profiled(&self, kernel: &'static str, duration: ProfileDuration) {
        self.pending.lock().unwrap().push((kernel, duration));
    }
    fn timed(&self, kernel: &'static str, duration: Duration, method: TimingMethod) {
        self.synchronous
            .lock()
            .unwrap()
            .push((kernel, duration.as_secs_f64() * 1000.0, method));
    }
}

/// Measures synchronous backend work (allocation, launch preparation and encoding).
/// Its nested WebGPU calls and GPU execution are separate measurements, not additive.
pub(crate) struct HostSpan {
    recorder: Option<Arc<Recorder>>,
    name: &'static str,
    start: Instant,
}

impl HostSpan {
    pub(crate) fn new(name: &'static str) -> Self {
        Self {
            recorder: ACTIVE.lock().unwrap().clone(),
            name,
            start: Instant::now(),
        }
    }
}
impl Drop for HostSpan {
    fn drop(&mut self) {
        if let Some(recorder) = &self.recorder {
            let end = Instant::now();
            recorder.host.lock().unwrap().push(HostKernel {
                name: self.name,
                start_ms: (self.start - recorder.epoch).as_secs_f64() * 1000.0,
                end_ms: (end - recorder.epoch).as_secs_f64() * 1000.0,
                wall_ms: (end - self.start).as_secs_f64() * 1000.0,
            });
        }
    }
}

/// Owns the global launch observer and the backend's stream-bound profile token.
/// Drop abandons an unclosed window on every error path.
pub(crate) struct Session {
    device: Device,
    recorder: Arc<Recorder>,
    observation: Option<LaunchObservation>,
    token: Option<ProfileToken>,
    marker_wall_ms: f64,
    timestamp_query: bool,
}

impl Session {
    pub(crate) fn begin(device: &Device, mode: Mode) -> Result<Self, String> {
        let cube = match device.as_dispatch() {
            DispatchDevice::Cube(cube) => cube,
            #[allow(unreachable_patterns)]
            _ => return Err("GPU profiling requires a CubeCL device".into()),
        };
        let timestamp_query = cube.client().properties().timing_method == TimingMethod::Device;
        if mode != Mode::Host && !timestamp_query {
            return Err(
                "GPU timestamp-query is unavailable; use host mode for CPU diagnostics".into(),
            );
        }
        let recorder = Arc::new(Recorder {
            epoch: Instant::now(),
            mode,
            host: Mutex::new(Vec::new()),
            launches: Mutex::new(Vec::new()),
            pending: Mutex::new(Vec::new()),
            synchronous: Mutex::new(Vec::new()),
        });
        {
            let mut active = ACTIVE.lock().unwrap();
            if active.is_some() {
                return Err("A profiling session is already active".into());
            }
            *active = Some(recorder.clone());
        }
        let mut session = Self {
            device: device.clone(),
            recorder: recorder.clone(),
            observation: Some(LaunchObservation::new(recorder)),
            token: None,
            marker_wall_ms: 0.0,
            timestamp_query,
        };
        if mode != Mode::Host {
            let start = Instant::now();
            session.token =
                Dispatch::profile_start(device.as_dispatch()).map_err(|e| e.to_string())?;
            session.marker_wall_ms += start.elapsed().as_secs_f64() * 1000.0;
            if session.token.is_none() {
                return Err("This backend does not expose GPU profile windows".into());
            }
        }
        Ok(session)
    }

    pub(crate) async fn finish(mut self, detection_wall_ms: f64) -> Result<Profile, String> {
        let window = if let Some(token) = self.token.take() {
            let start = Instant::now();
            // Detection has already flushed and read all tensors. Do not flush
            // between kernels or otherwise change Fusion's production batching.
            let duration =
                Dispatch::profile_end(self.device.as_dispatch(), token, ProfileOptions::default())
                    .map_err(|e| e.to_string())?;
            self.marker_wall_ms += start.elapsed().as_secs_f64() * 1000.0;
            Some(duration)
        } else {
            None
        };
        self.observation.take();
        ACTIVE.lock().unwrap().take();
        let resolve_start = Instant::now();
        let gpu_window_ms = if let Some(window) = window {
            if window.timing_method() != TimingMethod::Device {
                return Err(
                    "GPU profiling fell back to a system clock; refusing to label it GPU time"
                        .into(),
                );
            }
            window
                .resolve()
                .await
                .map(|ticks| ticks.duration().as_secs_f64() * 1000.0)
        } else {
            None
        };
        let pending = std::mem::take(&mut *self.recorder.pending.lock().unwrap());
        let mut gpu_kernels = Vec::new();
        for (name, duration) in pending {
            let method = duration.timing_method();
            let ticks = duration.resolve().await;
            let device_ticks = ticks.as_ref().filter(|_| method == TimingMethod::Device);
            gpu_kernels.push(GpuKernel {
                name: name.into(),
                timing_method: method.to_string(),
                gpu_ms: device_ticks.map(|ticks| ticks.duration().as_secs_f64() * 1000.0),
                start_ms: device_ticks.map(|ticks| {
                    ticks
                        .start_duration_since(self.recorder.epoch)
                        .as_secs_f64()
                        * 1000.0
                }),
                end_ms: device_ticks.map(|ticks| {
                    ticks.end_duration_since(self.recorder.epoch).as_secs_f64() * 1000.0
                }),
            });
        }
        let synchronous = std::mem::take(&mut *self.recorder.synchronous.lock().unwrap());
        let resolved_synchronously = synchronous.len();
        for (name, duration, method) in synchronous {
            gpu_kernels.push(GpuKernel {
                name: name.into(),
                timing_method: method.to_string(),
                gpu_ms: (method == TimingMethod::Device).then_some(duration),
                start_ms: None,
                end_ms: None,
            });
        }
        // A GPU clock is not aligned with performance.now(). Keep the kernel
        // timeline relative to its first measured GPU timestamp, not host epoch.
        let first_gpu_start = gpu_kernels
            .iter()
            .filter_map(|k| k.start_ms)
            .fold(f64::INFINITY, f64::min);
        if first_gpu_start.is_finite() {
            for kernel in &mut gpu_kernels {
                kernel.start_ms = kernel.start_ms.map(|value| value - first_gpu_start);
                kernel.end_ms = kernel.end_ms.map(|value| value - first_gpu_start);
            }
        }
        let gpu_kernels_measured = gpu_kernels.iter().filter(|k| k.gpu_ms.is_some()).count();
        let gpu_kernels_unmeasured = gpu_kernels.len() - gpu_kernels_measured;
        let gpu_kernel_measured_sum_ms =
            (gpu_kernels_measured > 0).then(|| gpu_kernels.iter().filter_map(|k| k.gpu_ms).sum());
        let gpu_kernel_sum_ms =
            if gpu_kernels.is_empty() || gpu_kernels.iter().any(|k| k.gpu_ms.is_none()) {
                None
            } else {
                Some(gpu_kernels.iter().map(|k| k.gpu_ms.unwrap()).sum())
            };
        let gpu_kernel_span_ms = if resolved_synchronously == 0
            && !gpu_kernels.is_empty()
            && gpu_kernels
                .iter()
                .all(|k| k.start_ms.is_some() && k.end_ms.is_some())
        {
            let first = gpu_kernels
                .iter()
                .map(|k| k.start_ms.unwrap())
                .fold(f64::INFINITY, f64::min);
            let last = gpu_kernels
                .iter()
                .map(|k| k.end_ms.unwrap())
                .fold(0.0_f64, f64::max);
            Some(last - first)
        } else {
            None
        };
        let host_kernels = std::mem::take(&mut *self.recorder.host.lock().unwrap());
        let launched = self
            .recorder
            .launches
            .lock()
            .unwrap()
            .iter()
            .map(|s| (*s).into())
            .collect();
        Ok(Profile {
            mode: format!("{:?}", self.recorder.mode).to_lowercase(),
            device: self.device.identity().map(|id| id.name).unwrap_or_default(),
            timestamp_query: self.timestamp_query,
            detection_wall_ms,
            marker_control_wall_ms: self.marker_wall_ms,
            resolve_wall_ms: resolve_start.elapsed().as_secs_f64() * 1000.0,
            kernel_host_sum_ms: host_kernels.iter().map(|k| k.wall_ms).sum(),
            gpu_window_ms,
            gpu_kernel_sum_ms,
            gpu_kernel_measured_sum_ms,
            gpu_kernels_measured,
            gpu_kernels_unmeasured,
            gpu_kernel_span_ms,
            launched,
            host_kernels,
            gpu_kernels,
            resolved_synchronously,
        })
    }
}

impl Drop for Session {
    fn drop(&mut self) {
        if let Some(token) = self.token.take() {
            Dispatch::profile_abandon(self.device.as_dispatch(), token);
        }
        self.observation.take();
        let mut active = ACTIVE.lock().unwrap();
        if active
            .as_ref()
            .is_some_and(|recorder| Arc::ptr_eq(recorder, &self.recorder))
        {
            active.take();
        }
    }
}

#[cfg(all(test, feature = "cli"))]
mod tests {
    use super::*;
    use serde::Deserialize;

    #[test]
    fn validates_mode_and_rejects_cpu_without_leaving_a_session() {
        assert!(Mode::parse("unknown").is_err());
        for mode in ["host", "frame", "kernels"] {
            assert!(Mode::parse(mode).is_ok());
        }
        let image = crate::GrayImage {
            width: 3,
            height: 3,
            pixels: vec![0.5; 9],
        };
        let result = pollster::block_on(detect(
            &image,
            &crate::Params::default(),
            &Device::flex(),
            Mode::Host,
        ));
        assert!(result.err().unwrap().contains("CubeCL device"));
    }

    #[test]
    #[ignore = "requires GPU timestamp queries; run this filtered test with --test-threads=1"]
    fn profiles_preserve_points_and_release_observer() {
        #[derive(Deserialize)]
        struct Fixture {
            image: crate::GrayImage,
        }
        let fixture: Fixture =
            serde_json::from_str(include_str!("../tests/fixtures/python-reference.json")).unwrap();
        let device = crate::test_gpu_device();
        let params = crate::Params::default();
        let mut plan = None;
        let expected = pollster::block_on(crate::detect_cached(
            &fixture.image,
            &params,
            &device,
            &mut plan,
        ))
        .unwrap();
        let points = serde_json::to_string(&expected.points).unwrap();
        for mode in [Mode::Host, Mode::Frame, Mode::Kernels] {
            let result = pollster::block_on(detect_cached(
                &fixture.image,
                &params,
                &device,
                &mut plan,
                mode,
            ))
            .unwrap();
            assert_eq!(
                serde_json::to_string(&result.report.points).unwrap(),
                points
            );
            assert!(!result.profile.launched.is_empty());
            assert_eq!(
                result.profile.host_kernels.len(),
                result.profile.launched.len()
            );
            assert!(result.profile.kernel_host_sum_ms.is_finite());
            if mode == Mode::Host {
                assert!(result.profile.gpu_window_ms.is_none());
            } else {
                assert!(
                    result
                        .profile
                        .gpu_window_ms
                        .is_some_and(|ms| ms.is_finite() && ms > 0.0)
                );
            }
            if mode == Mode::Kernels {
                assert_eq!(
                    result.profile.gpu_kernels.len(),
                    result.profile.launched.len()
                );
                assert_eq!(
                    result.profile.gpu_kernels_measured + result.profile.gpu_kernels_unmeasured,
                    result.profile.gpu_kernels.len()
                );
            }
            assert!(ACTIVE.lock().unwrap().is_none());
        }
        let abandoned = Session::begin(&device, Mode::Frame).unwrap();
        assert!(Session::begin(&device, Mode::Host).is_err());
        drop(abandoned);
        assert!(ACTIVE.lock().unwrap().is_none());
    }
}
