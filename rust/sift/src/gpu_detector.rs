use crate::{KeyPoint, Params, Timings, localization_ops};
use burn::tensor::{Tensor, Transaction};
use web_time::Instant;

pub(crate) async fn find(
    dog: &[(usize, Tensor<3>)],
    params: &Params,
    timings: &mut Timings,
) -> Result<Vec<KeyPoint>, String> {
    find_with_capacity(dog, params, timings, None).await
}

async fn find_with_capacity(
    dog: &[(usize, Tensor<3>)],
    params: &Params,
    timings: &mut Timings,
    initial_capacity: Option<usize>,
) -> Result<Vec<KeyPoint>, String> {
    let mut pending = Vec::new();
    for (octave, volume) in dog {
        let [layers, height, width] = volume.dims();
        if layers < 3 || height < 3 || width < 3 {
            continue;
        }
        let positions = (layers - 2) * (height - 2) * (width - 2);
        let capacity = initial_capacity
            .unwrap_or((positions / 256).clamp(256, 65536))
            .clamp(1, positions);
        pending.push((*octave, volume.clone(), capacity, positions));
    }
    let mut completed = Vec::new();
    while !pending.is_empty() {
        let mut transaction = Transaction::default();
        let start = Instant::now();
        for (_, volume, capacity, _) in &pending {
            let (count, points) = localization_ops::localize(volume, *capacity, params);
            transaction = transaction.register(count).register(points);
        }
        timings.extrema_setup_ms += start.elapsed().as_secs_f64() * 1000.0;
        let start = Instant::now();
        pending[0].1.device().flush().map_err(|e| e.to_string())?;
        timings.gpu_submit_ms += start.elapsed().as_secs_f64() * 1000.0;
        let start = Instant::now();
        let data = transaction
            .execute_async()
            .await
            .map_err(|e| e.to_string())?;
        timings.gpu_readback_ms += start.elapsed().as_secs_f64() * 1000.0;
        let start = Instant::now();
        let mut retry = Vec::new();
        for ((octave, volume, capacity, positions), data) in
            pending.into_iter().zip(data.as_chunks::<2>().0)
        {
            let count = data[0].try_to_vec::<i32>().map_err(|e| e.to_string())?[0];
            if count < 0 || count as usize > positions {
                return Err("Invalid GPU candidate count".into());
            }
            let count = count as usize;
            if count > capacity {
                // The atomic count includes every candidate even when the
                // output buffer fills. Retry the whole octave at the exact size;
                // never silently truncate or splice nondeterministic append order.
                retry.push((octave, volume, count, positions));
                continue;
            }
            let values = data[1].try_to_vec::<f32>().map_err(|e| e.to_string())?;
            let mut rows: Vec<&[f32; 9]> = values
                .as_chunks::<9>()
                .0
                .iter()
                .take(count)
                .filter(|row| row[8] > 0.5)
                .collect();
            // Atomic scheduling is arbitrary. Restore Python's convergence-step
            // order and original scale/y/x scan order, including duplicate points.
            rows.sort_by_key(|row| (row[5] as u32, row[7] as u32, row[6] as u32));
            let scale = 2.0_f32.powi(octave as i32);
            let points = rows
                .into_iter()
                .map(|row| KeyPoint {
                    x: row[0] * scale,
                    y: row[1] * scale,
                    size: row[2] * scale,
                    octave: octave as i32,
                    class_id: row[3] as usize,
                    response: row[4],
                })
                .collect::<Vec<_>>();
            completed.push((octave, points));
        }
        pending = retry;
        timings.localization_ms += start.elapsed().as_secs_f64() * 1000.0;
    }
    completed.sort_by_key(|(octave, _)| *octave);
    Ok(completed
        .into_iter()
        .flat_map(|(_, points)| points)
        .collect())
}

#[cfg(all(test, feature = "cli"))]
mod tests {
    use super::*;
    use burn::tensor::{Device, TensorData};
    use serde::Deserialize;
    #[derive(Deserialize)]
    struct Fixture {
        image: crate::GrayImage,
        cases: Vec<Case>,
    }
    #[derive(Deserialize)]
    struct Case {
        params: Params,
    }

    #[test]
    #[ignore = "requires a native GPU; run explicitly for compact readback parity"]
    fn overflow_retry_preserves_all_points_duplicates_and_cpu_order() {
        let gpu = crate::test_gpu_device();
        let cpu = Device::flex();
        let fixture: Fixture =
            serde_json::from_str(include_str!("../tests/fixtures/python-reference.json")).unwrap();
        for case in fixture.cases {
            let dog = crate::build_dog(&crate::build_octaves(&fixture.image, &case.params, &cpu));
            let expected =
                pollster::block_on(crate::find_scale_space_extrema(&dog, &case.params)).unwrap();
            assert!(expected.len() > 1);
            let volumes: Vec<_> = dog
                .into_iter()
                .enumerate()
                .map(|(i, layers)| {
                    let volume: Tensor<3> = Tensor::stack(layers, 0);
                    let shape = volume.dims();
                    let values = volume.into_data().try_to_vec::<f32>().unwrap();
                    (i, Tensor::from_floats(TensorData::new(values, shape), &gpu))
                })
                .collect();
            let mut previous = None;
            for capacity in [1, 4096, 1] {
                let actual = pollster::block_on(find_with_capacity(
                    &volumes,
                    &case.params,
                    &mut Timings::default(),
                    Some(capacity),
                ))
                .unwrap();
                assert_eq!(actual.len(), expected.len());
                for (a, e) in actual.iter().zip(&expected) {
                    assert_eq!((a.octave, a.class_id), (e.octave, e.class_id));
                    assert!((a.x - e.x).abs() < 0.005 && (a.y - e.y).abs() < 0.005);
                    assert!(
                        (a.size - e.size).abs() < 0.005 && (a.response - e.response).abs() < 0.0002
                    );
                }
                let serialized = serde_json::to_string(&actual).unwrap();
                if let Some(previous) = &previous {
                    assert_eq!(&serialized, previous);
                }
                previous = Some(serialized);
            }
        }
    }
}
