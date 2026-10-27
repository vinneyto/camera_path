//! Strict extrema, five localization attempts and rejection before atomic append.
use crate::localization_ops::LocalizationOps;
use burn::backend::{
    cubecl::dtype_to_storage_type,
    tensor::{FloatTensor, IntTensor},
};
use burn_cubecl::{CubeBackend, tensor::CubeTensor};
use cubecl::{cube, prelude::*};

#[cube]
fn at<F: Float>(volume: &Tensor<F>, s: i32, y: i32, x: i32) -> f32 {
    f32::cast_from(
        volume[s as usize * volume.stride(0)
            + y as usize * volume.stride(1)
            + x as usize * volume.stride(2)],
    )
}

#[cube]
fn round_even(value: f32) -> f32 {
    let lower = value.floor();
    let fraction = value - lower;
    if fraction < 0.5 || (fraction == 0.5 && lower % 2.0 == 0.0) {
        lower
    } else {
        lower + 1.0
    }
}

#[cube]
fn derivatives<F: Float>(
    volume: &Tensor<F>,
    s: i32,
    y: i32,
    x: i32,
    g: &mut Array<f32>,
    h: &mut Array<f32>,
) {
    let c = at(volume, s, y, x);
    g[0] = (at(volume, s + 1, y, x) - at(volume, s - 1, y, x)) * 0.5;
    g[1] = (at(volume, s, y + 1, x) - at(volume, s, y - 1, x)) * 0.5;
    g[2] = (at(volume, s, y, x + 1) - at(volume, s, y, x - 1)) * 0.5;
    h[0] = at(volume, s - 1, y, x) - 2.0 * c + at(volume, s + 1, y, x);
    h[4] = at(volume, s, y - 1, x) - 2.0 * c + at(volume, s, y + 1, x);
    h[8] = at(volume, s, y, x - 1) - 2.0 * c + at(volume, s, y, x + 1);
    let sy =
        (at(volume, s - 1, y - 1, x) - at(volume, s - 1, y + 1, x) - at(volume, s + 1, y - 1, x)
            + at(volume, s + 1, y + 1, x))
            * 0.25;
    let sx =
        (at(volume, s - 1, y, x - 1) - at(volume, s - 1, y, x + 1) - at(volume, s + 1, y, x - 1)
            + at(volume, s + 1, y, x + 1))
            * 0.25;
    let yx =
        (at(volume, s, y - 1, x - 1) - at(volume, s, y - 1, x + 1) - at(volume, s, y + 1, x - 1)
            + at(volume, s, y + 1, x + 1))
            * 0.25;
    h[1] = sy;
    h[3] = sy;
    h[2] = sx;
    h[6] = sx;
    h[5] = yx;
    h[7] = yx;
}

#[cube]
fn solve(h: &Array<f32>, g: &Array<f32>, offset: &mut Array<f32>) {
    let mut a = Array::<f32>::new(12_usize);
    for i in 0..3 {
        for j in 0..3 {
            a[i * 4 + j] = h[i * 3 + j];
        }
        a[i * 4 + 3] = -g[i];
    }
    for k in 0..3 {
        let mut pivot = k;
        let mut largest = a[k * 4 + k].abs();
        for i in k + 1..3 {
            let candidate = a[i * 4 + k].abs();
            if candidate >= largest {
                largest = candidate;
                pivot = i;
            }
        }
        if largest == 0.0 {
            terminate!();
        }
        for j in 0..4 {
            let previous = a[k * 4 + j];
            a[k * 4 + j] = a[pivot * 4 + j];
            a[pivot * 4 + j] = previous;
        }
        for i in k + 1..3 {
            let factor = a[i * 4 + k] / a[k * 4 + k];
            for j in k + 1..4 {
                a[i * 4 + j] -= factor * a[k * 4 + j];
            }
        }
    }
    for reverse in 0..3 {
        let i = 2 - reverse;
        let mut sum = 0.0_f32;
        for j in i + 1..3 {
            sum += a[i * 4 + j] * offset[j];
        }
        offset[i] = (a[i * 4 + 3] - sum) / a[i * 4 + i];
        let finite = offset[i].abs() <= f32::MAX;
        if !finite {
            terminate!();
        }
    }
}

#[cube(launch)]
fn collect_candidates<F: Float>(
    volume: &Tensor<F>,
    count: &Tensor<Atomic<i32>>,
    candidates: &mut Tensor<i32>,
    threshold: f32,
    #[define(F)] _dtype: ElemType,
) {
    let x0 = ABSOLUTE_POS_X as usize + 1;
    let y0 = ABSOLUTE_POS_Y as usize + 1;
    let s0 = ABSOLUTE_POS_Z as usize + 1;
    let width = volume.shape(2);
    let height = volume.shape(1);
    let scales = volume.shape(0);
    if x0 >= width - 1 || y0 >= height - 1 || s0 >= scales - 1 {
        terminate!();
    }
    let center = at(volume, s0 as i32, y0 as i32, x0 as i32);
    if center.abs() <= threshold * 0.5 {
        terminate!();
    }
    let mut maximum = true;
    let mut minimum = true;
    for ds in 0..3 {
        for dy in 0..3 {
            for dx in 0..3 {
                if ds != 1 || dy != 1 || dx != 1 {
                    let neighbor = at(
                        volume,
                        (s0 + ds - 1) as i32,
                        (y0 + dy - 1) as i32,
                        (x0 + dx - 1) as i32,
                    );
                    maximum = maximum && center > neighbor;
                    minimum = minimum && center < neighbor;
                }
            }
        }
    }
    if !maximum && !minimum {
        terminate!();
    }
    let destination = count[0].fetch_add(1_i32) as usize;
    if destination < candidates.len() {
        candidates[destination] =
            (((s0 - 1) * (height - 2) + y0 - 1) * (width - 2) + x0 - 1) as i32;
    }
}

#[cube(launch)]
fn localize_points<F: Float>(
    volume: &Tensor<F>,
    count: &Tensor<Atomic<i32>>,
    candidates: &Tensor<i32>,
    points: &mut Tensor<F>,
    threshold: f32,
    edge: f32,
    sigma: f32,
    layers: u32,
    #[comptime] subpixel: bool,
    #[comptime] filter: bool,
    #[define(F)] _dtype: ElemType,
) {
    let destination = ((CUBE_POS_Y * CUBE_COUNT_X + CUBE_POS_X) * 256 + UNIT_POS) as usize;
    if destination >= points.shape(0) {
        terminate!();
    }
    points[destination * 9 + 8] = F::new(0.0_f32);
    // WGSL atomics require read_write storage. CubeCL 0.11.3 infers a read-only
    // binding for a load-only input; adding zero preserves the count and forces
    // the correct binding access mode on WebGPU.
    if destination >= count[0].fetch_add(0_i32) as usize {
        terminate!();
    }
    let width = volume.shape(2);
    let height = volume.shape(1);
    let scales = volume.shape(0);
    let order = candidates[destination] as usize;
    let x0 = order % (width - 2) + 1;
    let y0 = (order / (width - 2)) % (height - 2) + 1;
    let s0 = order / ((width - 2) * (height - 2)) + 1;
    let mut s = s0 as i32;
    let mut y = y0 as i32;
    let mut x = x0 as i32;
    let mut g = Array::<f32>::new(3_usize);
    let mut h = Array::<f32>::new(9_usize);
    let mut offset = Array::<f32>::new(3_usize);
    for iteration in 0..5 {
        derivatives(volume, s, y, x, &mut g, &mut h);
        solve(&h, &g, &mut offset);
        if offset[0].abs() >= 0.5 || offset[1].abs() >= 0.5 || offset[2].abs() >= 0.5 {
            let ns = s as f32 + round_even(offset[0]);
            let ny = y as f32 + round_even(offset[1]);
            let nx = x as f32 + round_even(offset[2]);
            if ns < 1.0
                || ns >= (scales - 1) as f32
                || ny < 1.0
                || ny >= (height - 1) as f32
                || nx < 1.0
                || nx >= (width - 1) as f32
            {
                terminate!();
            }
            s = ns as i32;
            y = ny as i32;
            x = nx as i32;
        } else {
            let response = at(volume, s, y, x)
                + 0.5 * (offset[0] * g[0] + offset[1] * g[1] + offset[2] * g[2]);
            if response.abs() <= threshold {
                terminate!();
            }
            if filter {
                let trace = h[8] + h[4];
                let det = h[8] * h[4] - h[5] * h[5];
                if det <= 0.0 || trace * trace / det > (edge + 1.0) * (edge + 1.0) / edge {
                    terminate!();
                }
            }
            if !subpixel {
                offset[0] = 0.0;
                offset[1] = 0.0;
                offset[2] = 0.0;
            }
            if destination < points.shape(0) {
                let index = destination * 9;
                points[index] = F::cast_from(x as f32 + offset[2]);
                points[index + 1] = F::cast_from(y as f32 + offset[1]);
                points[index + 2] = F::cast_from(
                    2.0 * sigma * f32::powf(2.0, (s as f32 + offset[0]) / layers as f32),
                );
                points[index + 3] = F::cast_from(s as f32);
                points[index + 4] = F::cast_from(response.abs());
                points[index + 5] = F::cast_from(iteration as f32);
                let order = ((s0 - 1) * (height - 2) + y0 - 1) * (width - 2) + x0 - 1;
                points[index + 6] = F::cast_from((order % 65536) as f32);
                points[index + 7] = F::cast_from((order / 65536) as f32);
                points[index + 8] = F::new(1.0_f32);
            }
            terminate!();
        }
    }
}

impl LocalizationOps for CubeBackend {
    fn sift_localize(
        volume: FloatTensor<Self>,
        capacity: u32,
        threshold: f32,
        edge: f32,
        sigma: f32,
        layers: u32,
        subpixel: bool,
        filter: bool,
    ) -> (IntTensor<Self>, FloatTensor<Self>) {
        let shape = volume.meta.shape();
        let count = CubeTensor::new_contiguous(
            volume.client.clone(),
            volume.device.clone(),
            [1].into(),
            volume
                .client
                .create(burn::tensor::Bytes::from_elems(vec![0_i32])),
            burn::tensor::DType::I32,
        );
        let points = CubeTensor::new_contiguous(
            volume.client.clone(),
            volume.device.clone(),
            [capacity as usize, 9].into(),
            volume
                .client
                .empty(capacity as usize * 9 * volume.dtype.size()),
            volume.dtype,
        );
        let candidates = CubeTensor::new_contiguous(
            volume.client.clone(),
            volume.device.clone(),
            [capacity as usize].into(),
            volume.client.empty(capacity as usize * 4),
            burn::tensor::DType::I32,
        );
        collect_candidates::launch(
            &volume.client,
            CubeCount::Static(
                (shape[2] - 2).div_ceil(16) as u32,
                (shape[1] - 2).div_ceil(16) as u32,
                (shape[0] - 2) as u32,
            ),
            CubeDim::new_3d(16, 16, 1),
            volume.clone().into_tensor_arg(),
            count.clone().into_tensor_arg(),
            candidates.clone().into_tensor_arg(),
            threshold,
            dtype_to_storage_type(volume.dtype),
        );
        let groups = capacity.div_ceil(256);
        let columns = groups.min(65535);
        localize_points::launch(
            &volume.client,
            CubeCount::Static(columns, groups.div_ceil(columns), 1),
            CubeDim::new_3d(256, 1, 1),
            volume.clone().into_tensor_arg(),
            count.clone().into_tensor_arg(),
            candidates.into_tensor_arg(),
            points.clone().into_tensor_arg(),
            threshold,
            edge,
            sigma,
            layers,
            subpixel,
            filter,
            dtype_to_storage_type(volume.dtype),
        );
        (count, points)
    }
}
