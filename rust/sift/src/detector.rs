use crate::extrema_mask::extrema_mask;
use crate::{GrayImage, KeyPoint, Octave, Params, Timings};
use burn::tensor::{Tensor, Transaction};
use web_time::Instant;

pub(crate) const BORDER: usize = 5;

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
        if layers < 3 || w <= 2 * BORDER || h <= 2 * BORDER {
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
                // Python bounds use the derivative volume, whose coordinates
                // are one pixel smaller than the original DoG coordinates.
                let y = j / (w - 2) + 1;
                let x = j % (w - 2) + 1;
                if (BORDER..h - BORDER).contains(&y) && (BORDER..w - BORDER).contains(&x) {
                    ready.push([i / plane + 1, y, x]);
                }
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
                        && next[1] >= BORDER as f64
                        && next[1] < (h - BORDER) as f64
                        && next[2] >= BORDER as f64
                        && next[2] < (w - BORDER) as f64
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

#[cfg(all(test, feature = "cli"))]
mod tests {
    use super::*;
    use burn::tensor::{Device, TensorData};

    fn check_border(device: &Device) {
        let params = Params {
            enable_edge_like_filtering: false,
            ..Params::default()
        };
        // A quadratic DoG has an exact, known extremum and localization offset.
        let check = |shape: [usize; 3], peak: [f32; 3], coupling: f32, accepted: bool| {
            let [layers, height, width] = shape;
            let mut values = Vec::with_capacity(layers * height * width);
            for s in 0..layers {
                for y in 0..height {
                    for x in 0..width {
                        let ds = s as f32 - peak[0];
                        let dy = y as f32 - peak[1];
                        let dx = x as f32 - peak[2];
                        values.push(
                            2.0 - 0.5 * (ds * ds + dy * dy + dx * dx + 2.0 * coupling * dy * dx),
                        );
                    }
                }
            }
            let volume = Tensor::from_floats(TensorData::new(values, shape), device);
            let points = pollster::block_on(find_profiled(
                &[(0, volume)],
                &params,
                &mut Timings::default(),
            ))
            .unwrap();
            assert_eq!(points.len(), usize::from(accepted), "{shape:?}, {peak:?}");
            if accepted {
                assert!((points[0].x - peak[2]).abs() < 0.001);
                assert!((points[0].y - peak[1]).abs() < 0.001);
                assert_eq!(points[0].class_id, peak[0] as usize);
            }
        };
        // Lower bounds are inclusive and upper bounds exclusive, on both axes.
        // First/last interior scale layers retain their existing bounds.
        for (y, x, accepted) in [
            (10.0, 4.0, false),
            (10.0, 5.0, true),
            (10.0, 15.0, true),
            (10.0, 16.0, false),
            (4.0, 10.0, false),
            (5.0, 10.0, true),
            (15.0, 10.0, true),
            (16.0, 10.0, false),
        ] {
            for s in [1.0, 3.0] {
                check([5, 21, 21], [s, y, x], 0.0, accepted);
            }
        }
        // Bounds constrain integer positions, not the final subpixel location.
        for (y, x) in [(10.0, 4.75), (10.0, 15.25), (4.75, 10.0), (15.25, 10.0)] {
            check([5, 21, 21], [2.0, y, x], 0.0, true);
        }
        // Coupled axes make an initial strict extremum move across the border.
        // Filtering only initial candidates (or final coordinates) is insufficient.
        for (y, x) in [(10.35, 4.4), (9.65, 15.6), (4.4, 10.35), (15.6, 9.65)] {
            check([5, 21, 21], [2.0, y, x], 0.8, false);
        }
        check([5, 11, 11], [2.0, 5.0, 5.0], 0.0, true);
        for shape in [[5, 10, 21], [5, 21, 10], [5, 3, 3]] {
            check(shape, [2.0, 5.0, 5.0], 0.0, false);
        }
    }

    #[test]
    fn border_five_applies_before_and_during_host_localization() {
        check_border(&Device::flex());
    }

    #[test]
    #[ignore = "requires a native GPU; run explicitly for border parity"]
    fn border_five_applies_before_and_during_gpu_detection() {
        check_border(&crate::test_gpu_device());
    }
}
