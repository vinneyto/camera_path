use burn::{
    backend::{Dispatch, backend_extension, tensor::FloatTensor},
    tensor::{Shape, Tensor},
};

#[backend_extension(Cube: cfg(feature = "gpu"), Fusion: cfg(feature = "gpu"), Flex: cfg(feature = "cpu"))]
pub trait SiftExtremaOps: burn::backend::Backend {
    #[fusion(dtype = volume, shape = mask_shape(volume))]
    fn sift_extrema_mask(volume: FloatTensor<Self>, threshold: f32) -> FloatTensor<Self>;
}

pub(crate) fn mask_shape(volume: &Shape) -> Shape {
    assert_eq!(volume.num_dims(), 3);
    assert!(volume.iter().all(|&size| size >= 3));
    [volume[0] - 2, volume[1] - 2, volume[2] - 2].into()
}

/// One custom operation in Burn's lazy graph; GPU outputs a float 0/1 mask.
pub(crate) fn extrema_mask(volume: &Tensor<3>, threshold: f32) -> Tensor<3> {
    Tensor::from_dispatch(Dispatch::sift_extrema_mask(
        volume.clone().into_dispatch(),
        threshold,
    ))
}

#[cfg(feature = "cpu")]
impl SiftExtremaOps for burn::backend::Flex {
    fn sift_extrema_mask(volume: FloatTensor<Self>, threshold: f32) -> FloatTensor<Self> {
        let input = Tensor::<3>::from_primitive::<Self>(volume);
        crate::extrema_mask_reference::reference_mask(&input, threshold)
            .float()
            .try_into_primitive::<Self>()
            .expect("Flex reference mask remains on Flex")
    }
}
