use crate::{GrayImage, Octave, Params};
use burn::tensor::{Device, Int, Tensor, TensorData, module::conv2d, ops::ConvOptions};

fn reflect_indices(size: usize, radius: usize, device: &Device) -> Tensor<1, Int> {
    let indices: Vec<i32> = (0..size + 2 * radius)
        .map(|i| {
            let mut x = i as isize - radius as isize;
            if size == 1 {
                return 0;
            }
            while x < 0 || x >= size as isize {
                x = if x < 0 { -x } else { 2 * size as isize - x - 2 };
            }
            x as i32
        })
        .collect();
    Tensor::from_ints(TensorData::new(indices, [size + 2 * radius]), device)
}
struct BlurPlan {
    radius: usize,
    filters: usize,
    horizontal: Tensor<4>,
    vertical: Tensor<4>,
    xs: Tensor<1, Int>,
    ys: Tensor<1, Int>,
}
pub(crate) fn gaussian_weights(sigmas: &[f64]) -> (usize, Vec<f32>) {
    let radii: Vec<usize> = sigmas
        .iter()
        .map(|sigma| (((sigma * 8.0 + 1.0).round_ties_even() as usize) | 1) / 2)
        .collect();
    let radius = *radii.iter().max().unwrap();
    let length = radius * 2 + 1;
    let filters = sigmas.len();
    let mut kernel = vec![0.0f32; filters * length];
    for (i, (&sigma, &r)) in sigmas.iter().zip(&radii).enumerate() {
        let weights: Vec<f64> = (0..r * 2 + 1)
            .map(|j| {
                let x = j as f64 - r as f64;
                (-x * x / (2.0 * sigma * sigma)).exp()
            })
            .collect();
        let total: f64 = weights.iter().sum();
        for (j, weight) in weights.iter().enumerate() {
            kernel[i * length + radius - r + j] = (weight / total) as f32;
        }
    }
    (radius, kernel)
}
impl BlurPlan {
    fn new(h: usize, w: usize, sigmas: &[f64], device: &Device) -> Self {
        let (radius, kernel) = gaussian_weights(sigmas);
        let length = radius * 2 + 1;
        let filters = sigmas.len();
        Self {
            radius,
            filters,
            horizontal: Tensor::from_floats(
                TensorData::new(kernel.clone(), [filters, 1, 1, length]),
                device,
            ),
            vertical: Tensor::from_floats(TensorData::new(kernel, [filters, 1, length, 1]), device),
            xs: reflect_indices(w, radius, device),
            ys: reflect_indices(h, radius, device),
        }
    }
    fn apply(&self, image: Tensor<2>) -> Tensor<4> {
        let [h, w] = image.dims();
        let input = image
            .select(1, self.xs.clone())
            .reshape([1, 1, h, w + 2 * self.radius]);
        // All layer sigmas share one horizontal pass. A grouped vertical pass
        // keeps each output channel paired with its own Gaussian kernel.
        let horizontal = conv2d(
            input,
            self.horizontal.clone(),
            None,
            ConvOptions::new([1, 1], [0, 0], [1, 1], 1),
        );
        let input = horizontal.select(2, self.ys.clone());
        conv2d(
            input,
            self.vertical.clone(),
            None,
            ConvOptions::new([1, 1], [0, 0], [1, 1], self.filters),
        )
    }
}
struct OctavePlan {
    blur: BlurPlan,
    down: Option<(Tensor<1, Int>, Tensor<1, Int>)>,
}
pub(crate) struct PyramidPlan {
    width: usize,
    height: usize,
    sigma: f64,
    layers: usize,
    device: Device,
    first: BlurPlan,
    octaves: Vec<OctavePlan>,
}
impl PyramidPlan {
    pub(crate) fn matches(&self, image: &GrayImage, p: &Params) -> bool {
        self.width == image.width
            && self.height == image.height
            && self.sigma == p.sigma
            && self.layers == p.n_octave_layers
    }
    pub(crate) fn new(image: &GrayImage, p: &Params, device: &Device) -> Self {
        let count = ((image.width.min(image.height) as f64)
            .log2()
            .round_ties_even() as isize
            - 3)
        .max(1) as usize;
        let first = BlurPlan::new(
            image.height,
            image.width,
            &[(p.sigma * p.sigma - 0.25).sqrt()],
            device,
        );
        let (mut h, mut w) = (image.height, image.width);
        let mut octaves = Vec::with_capacity(count);
        for index in 0..count {
            let sigmas: Vec<f64> = (1..p.n_octave_layers + 3)
                .map(|i| {
                    let sigma = p.sigma * 2.0f64.powf(i as f64 / p.n_octave_layers as f64);
                    (sigma * sigma - p.sigma * p.sigma).sqrt()
                })
                .collect();
            let blur = BlurPlan::new(h, w, &sigmas, device);
            let down = if index + 1 < count {
                let ys: Vec<i32> = (0..h).step_by(2).map(|i| i as i32).collect();
                let xs: Vec<i32> = (0..w).step_by(2).map(|i| i as i32).collect();
                Some((
                    Tensor::from_ints(TensorData::new(ys, [h.div_ceil(2)]), device),
                    Tensor::from_ints(TensorData::new(xs, [w.div_ceil(2)]), device),
                ))
            } else {
                None
            };
            octaves.push(OctavePlan { blur, down });
            h = h.div_ceil(2);
            w = w.div_ceil(2);
        }
        Self {
            width: image.width,
            height: image.height,
            sigma: p.sigma,
            layers: p.n_octave_layers,
            device: device.clone(),
            first,
            octaves,
        }
    }
    pub(crate) fn build(&self, image: &GrayImage) -> Vec<Octave> {
        let input = Tensor::from_floats(
            TensorData::new(image.pixels.clone(), [image.height, image.width]),
            &self.device,
        );
        let mut base = self.first.apply(input).reshape([image.height, image.width]);
        let mut octaves = Vec::with_capacity(self.octaves.len());
        for plan in &self.octaves {
            let mut layers = vec![base.clone()];
            let [h, w] = base.dims();
            let blurred = plan.blur.apply(layers[0].clone());
            for i in 0..plan.blur.filters {
                layers.push(
                    blurred
                        .clone()
                        .slice([0..1, i..i + 1, 0..h, 0..w])
                        .reshape([h, w]),
                );
            }
            if let Some((ys, xs)) = &plan.down {
                base = layers[self.layers]
                    .clone()
                    .select(0, ys.clone())
                    .select(1, xs.clone());
            }
            octaves.push(layers);
        }
        octaves
    }
}
/// The notebook uses upscale_first=False, including sigma_nominal=0.5.
pub fn build_octaves(image: &GrayImage, p: &Params, device: &Device) -> Vec<Octave> {
    PyramidPlan::new(image, p, device).build(image)
}
pub fn build_dog(octaves: &[Octave]) -> Vec<Octave> {
    octaves
        .iter()
        .map(|layers| {
            layers
                .windows(2)
                .map(|p| p[1].clone() - p[0].clone())
                .collect()
        })
        .collect()
}
