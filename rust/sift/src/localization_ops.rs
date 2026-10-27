use crate::Params;
use burn::backend::{
    Dispatch, backend_extension,
    tensor::{FloatTensor, IntTensor},
};
use burn::tensor::{Int, Tensor};

#[backend_extension(Cube, Fusion)]
pub trait LocalizationOps: burn::backend::Backend {
    #[fusion(meta = |volume, capacity, _threshold, _edge, _sigma, _layers, _subpixel, _filter| (
        burn::backend::fusion::custom::TensorSpec::new([1].into(), burn::tensor::DType::I32),
        burn::backend::fusion::custom::TensorSpec::new([*capacity as usize, 9].into(), volume.dtype)
    ))]
    // Burn extensions pass ordinary options as scalar arguments.
    #[allow(clippy::too_many_arguments)]
    fn sift_localize(
        volume: FloatTensor<Self>,
        capacity: u32,
        threshold: f32,
        edge: f32,
        sigma: f32,
        layers: u32,
        subpixel: bool,
        filter: bool,
    ) -> (IntTensor<Self>, FloatTensor<Self>);
}

pub(crate) fn localize(
    volume: &Tensor<3>,
    capacity: usize,
    params: &Params,
) -> (Tensor<1, Int>, Tensor<2>) {
    let (count, points) = Dispatch::sift_localize(
        volume.clone().into_dispatch(),
        capacity as u32,
        params.contrast_threshold / params.n_octave_layers as f32,
        params.edge_threshold,
        params.sigma as f32,
        params.n_octave_layers as u32,
        params.enable_subpixel_localization,
        params.enable_edge_like_filtering,
    );
    (Tensor::from_dispatch(count), Tensor::from_dispatch(points))
}
