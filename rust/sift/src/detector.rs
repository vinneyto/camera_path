use crate::extrema_mask::extrema_mask;
use crate::{GrayImage, KeyPoint, Octave, Params, Timings};
use burn::tensor::{Tensor, Transaction};
use web_time::Instant;
fn derivatives(o: &[GrayImage], s: usize, y: usize, x: usize) -> ([f32; 3], [[f32; 3]; 3]) {
    let at = |ds: isize, dy: isize, dx: isize| {
        let l = &o[s.checked_add_signed(ds).unwrap()];
        l.pixels[y.checked_add_signed(dy).unwrap() * l.width + x.checked_add_signed(dx).unwrap()]
    };
    let c = at(0, 0, 0);
    let g = [
        (at(1, 0, 0) - at(-1, 0, 0)) * 0.5,
        (at(0, 1, 0) - at(0, -1, 0)) * 0.5,
        (at(0, 0, 1) - at(0, 0, -1)) * 0.5,
    ];
    let sy = (at(-1, -1, 0) - at(-1, 1, 0) - at(1, -1, 0) + at(1, 1, 0)) * 0.25;
    let sx = (at(-1, 0, -1) - at(-1, 0, 1) - at(1, 0, -1) + at(1, 0, 1)) * 0.25;
    let yx = (at(0, -1, -1) - at(0, -1, 1) - at(0, 1, -1) + at(0, 1, 1)) * 0.25;
    (
        g,
        [
            [at(-1, 0, 0) - 2.0 * c + at(1, 0, 0), sy, sx],
            [sy, at(0, -1, 0) - 2.0 * c + at(0, 1, 0), yx],
            [sx, yx, at(0, 0, -1) - 2.0 * c + at(0, 0, 1)],
        ],
    )
}
fn solve(h: [[f32; 3]; 3], g: [f32; 3]) -> Option<[f32; 3]> {
    let mut a = [[0.0; 4]; 3];
    for i in 0..3 {
        a[i][..3].copy_from_slice(&h[i]);
        a[i][3] = -g[i];
    }
    for k in 0..3 {
        let pivot = (k..3).max_by(|&i, &j| a[i][k].abs().total_cmp(&a[j][k].abs()))?;
        if a[pivot][k] == 0.0 {
            return None;
        }
        a.swap(k, pivot);
        for i in k + 1..3 {
            let f = a[i][k] / a[k][k];
            let pivot_row = a[k];
            for (entry, pivot) in a[i][k + 1..].iter_mut().zip(&pivot_row[k + 1..]) {
                *entry -= f * pivot;
            }
        }
    }
    let mut v = [0.0; 3];
    for i in (0..3).rev() {
        v[i] = (a[i][3] - (i + 1..3).map(|j| a[i][j] * v[j]).sum::<f32>()) / a[i][i];
    }
    v.iter().all(|x| x.is_finite()).then_some(v)
}
pub async fn find_scale_space_extrema(dog: &[Octave], p: &Params) -> Result<Vec<KeyPoint>, String> {
    let volumes = dog
        .iter()
        .enumerate()
        .filter(|(_, octave)| octave.len() >= 3)
        .map(|(i, octave)| (i, Tensor::stack(octave.clone(), 0)))
        .collect::<Vec<_>>();
    find_profiled(&volumes, p, &mut Timings::default()).await
}
pub(crate) async fn find_profiled(
    dog: &[(usize, Tensor<3>)],
    p: &Params,
    timings: &mut Timings,
) -> Result<Vec<KeyPoint>, String> {
    #[cfg(feature = "gpu-localization")]
    if let Some((_, _first)) = dog.first() {
        #[cfg(feature = "cpu")]
        let is_gpu = _first.device() != burn::tensor::Device::flex();
        #[cfg(not(feature = "cpu"))]
        let is_gpu = true;
        if is_gpu {
            return crate::gpu_detector::find(dog, p, timings).await;
        }
    }
    let threshold = p.contrast_threshold / p.n_octave_layers as f32;
    let mut points = Vec::new();
    let mut transaction = Transaction::default();
    let mut octaves = Vec::new();
    let mut device = None;
    for (octave, volume) in dog {
        let [layers, h, w] = volume.dims();
        if layers < 3 || w < 3 || h < 3 {
            continue;
        }
        let setup_start = Instant::now();
        let mask = extrema_mask(volume, threshold);
        timings.extrema_setup_ms += setup_start.elapsed().as_secs_f64() * 1000.0;
        device.get_or_insert_with(|| volume.device());
        octaves.push((*octave, h, w));
        transaction = transaction.register(mask).register(volume.clone());
    }
    if octaves.is_empty() {
        return Ok(points);
    }
    // Queue every octave before the single frame-level synchronization/readback.
    // Data remains registered in octave order, independent of device execution order.
    let submit_start = Instant::now();
    device.unwrap().flush().map_err(|e| e.to_string())?;
    timings.gpu_submit_ms += submit_start.elapsed().as_secs_f64() * 1000.0;
    let read_start = Instant::now();
    let data = transaction
        .execute_async()
        .await
        .map_err(|e| e.to_string())?;
    timings.gpu_readback_ms += read_start.elapsed().as_secs_f64() * 1000.0;
    for ((octave, h, w), octave_data) in octaves.into_iter().zip(data.as_chunks::<2>().0) {
        let localize_start = Instant::now();
        let mask = octave_data[0]
            .try_to_vec_as::<bool>()
            .map_err(|e| e.to_string())?;
        let pixels = octave_data[1]
            .try_to_vec::<f32>()
            .map_err(|e| e.to_string())?;
        let plane = (h - 2) * (w - 2);
        let mut ready = Vec::new();
        for (i, candidate) in mask.into_iter().enumerate() {
            if candidate {
                let j = i % plane;
                ready.push([i / plane + 1, j / (w - 2) + 1, j % (w - 2) + 1]);
            }
        }
        let host: Vec<GrayImage> = pixels
            .chunks_exact(w * h)
            .map(|pixels| GrayImage {
                width: w,
                height: h,
                pixels: pixels.to_vec(),
            })
            .collect();
        let o = &host;
        // Python appends converged candidates by iteration, preserving scan order and duplicates.
        for _ in 0..5 {
            let mut moving = Vec::new();
            for pos in ready {
                let [s, y, x] = pos;
                let (g, hessian) = derivatives(o, s, y, x);
                let Some(offset) = solve(hessian, g) else {
                    continue;
                };
                if offset.iter().any(|v| v.abs() >= 0.5) {
                    let next = std::array::from_fn::<_, 3, _>(|i| {
                        pos[i] as f64 + offset[i].round_ties_even() as f64
                    });
                    if next[0] >= 1.0
                        && next[0] < (o.len() - 1) as f64
                        && next[1] >= 1.0
                        && next[1] < (h - 1) as f64
                        && next[2] >= 1.0
                        && next[2] < (w - 1) as f64
                    {
                        moving.push(next.map(|v| v as usize));
                    }
                    continue;
                }
                let response =
                    o[s].pixels[y * w + x] + 0.5 * (0..3).map(|i| offset[i] * g[i]).sum::<f32>();
                if response.abs() <= threshold {
                    continue;
                }
                if p.enable_edge_like_filtering {
                    let trace = hessian[2][2] + hessian[1][1];
                    let det = hessian[2][2] * hessian[1][1] - hessian[1][2] * hessian[1][2];
                    if det <= 0.0
                        || trace * trace / det > (p.edge_threshold + 1.0).powi(2) / p.edge_threshold
                    {
                        continue;
                    }
                }
                let offset = if p.enable_subpixel_localization {
                    offset
                } else {
                    [0.0; 3]
                };
                let scale = 2.0f32.powi(octave as i32);
                points.push(KeyPoint {
                    x: (x as f32 + offset[2]) * scale,
                    y: (y as f32 + offset[1]) * scale,
                    size: 2.0
                        * p.sigma as f32
                        * 2.0f32.powf((s as f32 + offset[0]) / p.n_octave_layers as f32)
                        * scale,
                    octave: octave as i32,
                    class_id: s,
                    response: response.abs(),
                });
            }
            ready = moving;
            if ready.is_empty() {
                break;
            }
        }
        timings.localization_ms += localize_start.elapsed().as_secs_f64() * 1000.0;
    }
    Ok(points)
}
