use burn::tensor::{Bool, Tensor, module::max_pool2d, ops::MaxPoolOptions};

/// Strict comparison with all 26 neighbors, using three disjoint groups (18+6+2).
/// Batch both signs so the same two pooling passes test maxima and minima.
pub(crate) fn reference_mask(volume: &Tensor<3>, threshold: f32) -> Tensor<3, Bool> {
    let [layers, h, w] = volume.dims();
    let signed: Tensor<4> = Tensor::stack(vec![volume.clone(), -volume.clone()], 0);
    let scale_neighbors = signed
        .clone()
        .slice([0..2, 0..layers - 2, 0..h, 0..w])
        .max_pair(signed.clone().slice([0..2, 2..layers, 0..h, 0..w]));
    let scale_neighbors = max_pool2d(
        scale_neighbors,
        MaxPoolOptions::new([3, 3]).with_stride([1, 1]),
    );
    let y_neighbors = signed
        .clone()
        .slice([0..2, 1..layers - 1, 0..h - 2, 0..w])
        .max_pair(signed.clone().slice([0..2, 1..layers - 1, 2..h, 0..w]));
    let y_neighbors = max_pool2d(y_neighbors, MaxPoolOptions::new([1, 3]).with_stride([1, 1]));
    let x_neighbors = signed
        .clone()
        .slice([0..2, 1..layers - 1, 1..h - 1, 0..w - 2])
        .max_pair(signed.clone().slice([0..2, 1..layers - 1, 1..h - 1, 2..w]));
    let neighbors = scale_neighbors.max_pair(y_neighbors).max_pair(x_neighbors);
    let center = signed.slice([0..2, 1..layers - 1, 1..h - 1, 1..w - 1]);
    let strict = center.greater(neighbors);
    let contrast = volume
        .clone()
        .slice([1..layers - 1, 1..h - 1, 1..w - 1])
        .abs()
        .greater_elem(threshold * 0.5);
    strict
        .clone()
        .slice([0..1, 0..layers - 2, 0..h - 2, 0..w - 2])
        .squeeze_dim::<3>(0)
        .bool_or(
            strict
                .slice([1..2, 0..layers - 2, 0..h - 2, 0..w - 2])
                .squeeze_dim::<3>(0),
        )
        .bool_and(contrast)
}

#[cfg(all(test, feature = "cpu"))]
mod tests {
    use super::*;
    use burn::tensor::{Device, TensorData};
    #[test]
    fn rejects_equal_values_in_every_neighbor_and_both_signs() {
        let device = Device::flex();
        for sign in [-1.0, 1.0] {
            let mut values = vec![0.0f32; 27];
            values[13] = sign;
            let tensor = Tensor::from_floats(TensorData::new(values.clone(), [3, 3, 3]), &device);
            assert!(
                reference_mask(&tensor, 0.01)
                    .into_data()
                    .try_to_vec_as::<bool>()
                    .unwrap()[0]
            );
            for neighbor in 0..27 {
                if neighbor == 13 {
                    continue;
                }
                let mut tied = values.clone();
                tied[neighbor] = sign;
                let tensor = Tensor::from_floats(TensorData::new(tied, [3, 3, 3]), &device);
                assert!(
                    !reference_mask(&tensor, 0.01)
                        .into_data()
                        .try_to_vec_as::<bool>()
                        .unwrap()[0]
                );
            }
        }
    }
}
