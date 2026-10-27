//! A single threshold + strict 26-neighbor comparison kernel per octave.
use crate::extrema_mask::{SiftExtremaOps, mask_shape};
use burn::backend::{cubecl::dtype_to_storage_type, tensor::FloatTensor};
use burn_cubecl::{CubeBackend, tensor::CubeTensor};
use cubecl::{cube, prelude::*};

#[cube(launch)]
fn strict_extrema<F: Float>(
    volume: &Tensor<F>,
    output: &mut Tensor<F>,
    half_threshold: f32,
    #[define(F)] _dtype: ElemType,
) {
    let x = ABSOLUTE_POS_X as usize;
    let y = ABSOLUTE_POS_Y as usize;
    let s = ABSOLUTE_POS_Z as usize;
    let width = output.shape(2);
    let height = output.shape(1);
    if x >= width || y >= height || s >= output.shape(0) {
        terminate!();
    }
    let index = (s * height + y) * width + x;
    output[index] = F::new(0.0_f32);
    let stride_s = volume.stride(0);
    let stride_y = volume.stride(1);
    let stride_x = volume.stride(2);
    let center = volume[(s + 1) * stride_s + (y + 1) * stride_y + (x + 1) * stride_x];
    if center.abs() > F::cast_from(half_threshold) {
        let mut maximum = true;
        let mut minimum = true;
        for ds in 0..3 {
            for dy in 0..3 {
                for dx in 0..3 {
                    if ds != 1 || dy != 1 || dx != 1 {
                        let neighbor =
                            volume[(s + ds) * stride_s + (y + dy) * stride_y + (x + dx) * stride_x];
                        maximum = maximum && center > neighbor;
                        minimum = minimum && center < neighbor;
                    }
                }
            }
        }
        if maximum || minimum {
            output[index] = F::new(1.0_f32);
        }
    }
}

impl SiftExtremaOps for CubeBackend {
    fn sift_extrema_mask(volume: FloatTensor<Self>, threshold: f32) -> FloatTensor<Self> {
        let shape = mask_shape(volume.meta.shape());
        let dtype = volume.dtype;
        let output = CubeTensor::new_contiguous(
            volume.client.clone(),
            volume.device.clone(),
            shape.clone(),
            volume.client.empty(shape.num_elements() * dtype.size()),
            dtype,
        );
        // Two-dimensional workgroups keep adjacent x coordinates coalesced and
        // avoid a large 1-D dispatch exceeding WebGPU's workgroup-count limit.
        strict_extrema::launch(
            &output.client,
            CubeCount::Static(
                shape[2].div_ceil(16) as u32,
                shape[1].div_ceil(16) as u32,
                shape[0] as u32,
            ),
            CubeDim::new_3d(16, 16, 1),
            volume.into_tensor_arg(),
            output.clone().into_tensor_arg(),
            threshold * 0.5,
            dtype_to_storage_type(dtype),
        );
        output
    }
}

#[cfg(all(test, feature = "cli"))]
mod tests {
    use crate::extrema_mask::extrema_mask;
    use burn::tensor::{Tensor, TensorData};

    fn check(volume: Tensor<3>, expected: Vec<f32>, shape: [usize; 3], threshold: f32) {
        let actual = extrema_mask(&volume, threshold);
        assert_eq!(actual.dims(), shape);
        let actual = pollster::block_on(actual.into_data_async())
            .unwrap()
            .try_to_vec::<f32>()
            .unwrap();
        assert_eq!(actual, expected);
    }

    #[test]
    #[ignore = "requires a native GPU; run explicitly for GPU kernel parity"]
    fn strict_kernel_handles_ties_signs_threshold_strides_and_dispatch_tails() {
        let device = crate::test_gpu_device();
        // A maximum may be negative, and a minimum may be positive. Absolute
        // contrast is independent of which extremum comparison succeeds.
        for (center, background) in [(1.0, 0.0), (-1.0, 0.0), (-1.0, -2.0), (1.0, 2.0)] {
            let mut values = vec![background; 27];
            values[13] = center;
            let tensor = Tensor::from_floats(TensorData::new(values.clone(), [3, 3, 3]), &device);
            check(tensor, vec![1.0], [1, 1, 1], 0.25);
            for neighbor in 0..27 {
                if neighbor == 13 {
                    continue;
                }
                let mut tied = values.clone();
                tied[neighbor] = center;
                let tensor = Tensor::from_floats(TensorData::new(tied, [3, 3, 3]), &device);
                check(tensor, vec![0.0], [1, 1, 1], 0.25);
            }
            let tensor = Tensor::from_floats(TensorData::new(values, [3, 3, 3]), &device);
            check(tensor, vec![0.0], [1, 1, 1], 2.0);
        }

        // Odd output dimensions exercise both partial workgroups. Transposing
        // spatial axes also exercises input strides without a contiguous copy.
        let [layers, height, width] = [5, 19, 23];
        let values: Vec<f32> = (0..layers * height * width)
            .map(|i| ((i * 73 + i * i * 17) % 101) as f32 / 50.0 - 1.0)
            .collect();
        let mut expected = Vec::new();
        for s in 1..layers - 1 {
            for x in 1..width - 1 {
                for y in 1..height - 1 {
                    let center = values[(s * height + y) * width + x];
                    let mut maximum = true;
                    let mut minimum = true;
                    for ds in 0..3 {
                        for dy in 0..3 {
                            for dx in 0..3 {
                                if (ds, dy, dx) == (1, 1, 1) {
                                    continue;
                                }
                                let neighbor = values
                                    [((s + ds - 1) * height + y + dy - 1) * width + x + dx - 1];
                                maximum &= center > neighbor;
                                minimum &= center < neighbor;
                            }
                        }
                    }
                    expected.push(f32::from(center.abs() > 0.125 && (maximum || minimum)));
                }
            }
        }
        let volume = Tensor::from_floats(TensorData::new(values, [layers, height, width]), &device)
            .swap_dims(1, 2);
        check(volume, expected, [layers - 2, width - 2, height - 2], 0.25);
    }
}
