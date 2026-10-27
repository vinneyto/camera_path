use crate::{GrayImage, Params, gaussian_ops, pyramid::gaussian_weights};
use burn::tensor::{Device, Tensor, TensorData};

pub(crate) struct GpuPyramidPlan {
    width: usize,
    height: usize,
    sigma: f64,
    layers: usize,
    count: usize,
    device: Device,
    first: Tensor<2>,
    weights: Tensor<2>,
}

impl GpuPyramidPlan {
    pub(crate) fn matches(&self, image: &GrayImage, params: &Params) -> bool {
        self.width == image.width
            && self.height == image.height
            && self.sigma == params.sigma
            && self.layers == params.n_octave_layers
    }

    pub(crate) fn new(image: &GrayImage, params: &Params, device: &Device) -> Self {
        let count = ((image.width.min(image.height) as f64)
            .log2()
            .round_ties_even() as isize
            - 3)
        .max(1) as usize;
        let weights = |sigmas: &[f64]| {
            let (radius, values) = gaussian_weights(sigmas);
            Tensor::from_floats(
                TensorData::new(values, [sigmas.len(), radius * 2 + 1]),
                device,
            )
        };
        let sigmas: Vec<f64> = (1..params.n_octave_layers + 3)
            .map(|i| {
                let sigma = params.sigma * 2.0_f64.powf(i as f64 / params.n_octave_layers as f64);
                (sigma * sigma - params.sigma * params.sigma).sqrt()
            })
            .collect();
        Self {
            width: image.width,
            height: image.height,
            sigma: params.sigma,
            layers: params.n_octave_layers,
            count,
            device: device.clone(),
            first: weights(&[(params.sigma * params.sigma - 0.25).sqrt()]),
            weights: weights(&sigmas),
        }
    }

    pub(crate) fn build(&self, image: &GrayImage) -> Vec<Tensor<3>> {
        let input = Tensor::from_floats(
            TensorData::new(image.pixels.clone(), [image.height, image.width]),
            &self.device,
        );
        let mut base =
            gaussian_ops::vertical(gaussian_ops::horizontal(input, &self.first), &self.first)
                .reshape([image.height, image.width]);
        let mut octaves = Vec::with_capacity(self.count);
        for _ in 0..self.count {
            let horizontal = gaussian_ops::horizontal(base.clone(), &self.weights);
            let (dog, next) = gaussian_ops::dog(horizontal, base, &self.weights, self.layers);
            octaves.push(dog);
            base = next;
        }
        octaves
    }
}

#[cfg(all(test, feature = "cli"))]
mod tests {
    use super::*;

    #[test]
    #[ignore = "requires a native GPU; run explicitly for Gaussian kernel parity"]
    fn tiled_dog_matches_cpu_for_tiny_odd_images_and_parameter_limits() {
        let gpu = crate::test_gpu_device();
        let cpu = Device::flex();
        for (width, height) in [(3, 3), (17, 11), (65, 33), (129, 97)] {
            let image = GrayImage {
                width,
                height,
                pixels: (0..width * height)
                    .map(|i| ((i * 17 + i * i * 7) % 251) as f32 / 250.0)
                    .collect(),
            };
            for (layers, sigma) in [(1, 0.6), (1, 3.0), (8, 0.6), (8, 3.0)] {
                let params = Params {
                    n_octave_layers: layers,
                    sigma,
                    ..Params::default()
                };
                let actual = GpuPyramidPlan::new(&image, &params, &gpu).build(&image);
                let expected = crate::build_dog(&crate::build_octaves(&image, &params, &cpu));
                assert_eq!(actual.len(), expected.len());
                for (actual, expected) in actual.into_iter().zip(expected) {
                    let expected: Tensor<3> = Tensor::stack(expected, 0);
                    assert_eq!(actual.dims(), expected.dims());
                    let actual = pollster::block_on(actual.into_data_async())
                        .unwrap()
                        .try_to_vec::<f32>()
                        .unwrap();
                    let expected = expected.into_data().try_to_vec::<f32>().unwrap();
                    let error = actual
                        .iter()
                        .zip(expected)
                        .map(|(a, b)| (a - b).abs())
                        .fold(0.0_f32, f32::max);
                    assert!(
                        error < 0.00001,
                        "{width}x{height}, layers={layers}, sigma={sigma}: {error}"
                    );
                }
            }
        }
    }
}
