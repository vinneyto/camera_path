use crate::{GrayImage, Params, detect_cached};
use burn::tensor::{Device, wgpu::WgpuBackend};
use wasm_bindgen::prelude::*;
#[wasm_bindgen]
pub struct Detector {
    device: Device,
    plan: Option<crate::pyramid::PyramidPlan>,
}
#[wasm_bindgen]
impl Detector {
    /// A worker owns one WebGPU device for its entire camera session.
    pub async fn create() -> Result<Detector, JsValue> {
        let device = Device::wgpu_options()
            .graphics_api(WgpuBackend::WebGpu)
            .init_async()
            .await
            .map_err(|e| JsValue::from_str(&format!("WebGPU initialization failed: {e}")))?;
        Ok(Self { device, plan: None })
    }
    pub async fn detect_rgba(
        &mut self,
        width: usize,
        height: usize,
        rgba: Vec<u8>,
        params: String,
    ) -> Result<String, JsValue> {
        let p: Params =
            serde_json::from_str(&params).map_err(|e| JsValue::from_str(&e.to_string()))?;
        let gray_start = web_time::Instant::now();
        let image =
            GrayImage::from_rgba(width, height, &rgba).map_err(|e| JsValue::from_str(&e))?;
        let gray_ms = gray_start.elapsed().as_secs_f64() * 1000.0;
        let mut report = detect_cached(&image, &p, &self.device, &mut self.plan)
            .await
            .map_err(|e| JsValue::from_str(&e))?;
        report.timings.grayscale_ms = gray_ms;
        serde_json::to_string(&report).map_err(|e| JsValue::from_str(&e.to_string()))
    }
}
