use burn::backend::{Dispatch, backend_extension, tensor::FloatTensor};
use burn::tensor::{Shape, Tensor};

#[backend_extension(Cube, Fusion)]
pub trait GaussianOps: burn::backend::Backend {
    #[fusion(dtype = input, shape = blur_shape(input, weights))]
    fn sift_gaussian(
        input: FloatTensor<Self>,
        weights: FloatTensor<Self>,
        vertical: bool,
    ) -> FloatTensor<Self>;

    #[fusion(meta = dog_metadata)]
    fn sift_gaussian_dog(
        horizontal: FloatTensor<Self>,
        base: FloatTensor<Self>,
        weights: FloatTensor<Self>,
        next_layer: u32,
    ) -> (FloatTensor<Self>, FloatTensor<Self>);
}

pub(crate) fn blur_shape(input: &Shape, weights: &Shape) -> Shape {
    let n = input.num_dims();
    [weights[0], input[n - 2], input[n - 1]].into()
}

fn dog_metadata(
    horizontal: &burn::backend::fusion::custom::TensorSpec,
    base: &burn::backend::fusion::custom::TensorSpec,
    _weights: &burn::backend::fusion::custom::TensorSpec,
    _next_layer: &u32,
) -> (
    burn::backend::fusion::custom::TensorSpec,
    burn::backend::fusion::custom::TensorSpec,
) {
    let mut next = base.clone();
    next.shape = [base.shape[0].div_ceil(2), base.shape[1].div_ceil(2)].into();
    (horizontal.clone(), next)
}

pub(crate) fn horizontal(input: Tensor<2>, weights: &Tensor<2>) -> Tensor<3> {
    Tensor::from_dispatch(Dispatch::sift_gaussian(
        input.into_dispatch(),
        weights.clone().into_dispatch(),
        false,
    ))
}

pub(crate) fn vertical(input: Tensor<3>, weights: &Tensor<2>) -> Tensor<3> {
    Tensor::from_dispatch(Dispatch::sift_gaussian(
        input.into_dispatch(),
        weights.clone().into_dispatch(),
        true,
    ))
}

pub(crate) fn dog(
    horizontal: Tensor<3>,
    base: Tensor<2>,
    weights: &Tensor<2>,
    next_layer: usize,
) -> (Tensor<3>, Tensor<2>) {
    let (dog, next) = Dispatch::sift_gaussian_dog(
        horizontal.into_dispatch(),
        base.into_dispatch(),
        weights.clone().into_dispatch(),
        next_layer as u32,
    );
    (Tensor::from_dispatch(dog), Tensor::from_dispatch(next))
}
