//! Separable Gaussian tiles with reflect101 and fused vertical DoG/decimation.
use crate::gaussian_ops::{GaussianOps, blur_shape};
use burn::backend::{cubecl::dtype_to_storage_type, tensor::FloatTensor};
use burn_cubecl::{CubeBackend, tensor::CubeTensor};
use cubecl::{cube, prelude::*};

#[cube]
fn reflect(coordinate: i32, size: usize) -> usize {
    if size <= 1 {
        0_usize
    } else {
        let period = (2 * (size - 1)) as i32;
        let mapped = ((coordinate % period) + period) % period;
        if mapped < size as i32 {
            mapped as usize
        } else {
            (period - mapped) as usize
        }
    }
}

#[cube(launch)]
fn gaussian_pass<F: Float>(
    input: &Tensor<F>,
    weights: &Tensor<F>,
    output: &mut Tensor<F>,
    #[comptime] vertical: bool,
    #[comptime] radius: usize,
    #[define(F)] _dtype: ElemType,
) {
    let x = ABSOLUTE_POS_X as usize;
    let y = ABSOLUTE_POS_Y as usize;
    let layer = CUBE_POS_Z as usize;
    let width = output.shape(2);
    let height = output.shape(1);
    let length = 2 * radius + 1;
    let span = 16 + 2 * radius;
    let mut tile = Shared::<[F]>::new_slice(16 * span);
    let mut index = UNIT_POS as usize;
    while index < 16 * span {
        let sx: usize;
        let sy: usize;
        if vertical {
            sx = reflect((CUBE_POS_X as usize * 16 + index % 16) as i32, width);
            sy = reflect(
                (CUBE_POS_Y as usize * 16 + index / 16) as i32 - radius as i32,
                height,
            );
            tile[index] =
                input[layer * input.stride(0) + sy * input.stride(1) + sx * input.stride(2)];
        } else {
            sx = reflect(
                (CUBE_POS_X as usize * 16 + index % span) as i32 - radius as i32,
                width,
            );
            sy = reflect((CUBE_POS_Y as usize * 16 + index / span) as i32, height);
            tile[index] = input[sy * input.stride(0) + sx * input.stride(1)];
        }
        index += 256;
    }
    sync_cube();
    if x < width && y < height {
        let mut sum = F::new(0.0_f32);
        for k in 0..length {
            let position = if vertical {
                (UNIT_POS_Y as usize + k) * 16 + UNIT_POS_X as usize
            } else {
                UNIT_POS_Y as usize * span + UNIT_POS_X as usize + k
            };
            sum += tile[position] * weights[layer * length + k];
        }
        output[(layer * height + y) * width + x] = sum;
    }
}

#[cube(launch)]
fn vertical_dog<F: Float>(
    input: &Tensor<F>,
    base: &Tensor<F>,
    weights: &Tensor<F>,
    dog: &mut Tensor<F>,
    next: &mut Tensor<F>,
    next_layer: u32,
    #[comptime] radius: usize,
    #[define(F)] _dtype: ElemType,
) {
    let x = ABSOLUTE_POS_X as usize;
    let y = ABSOLUTE_POS_Y as usize;
    let width = dog.shape(2);
    let height = dog.shape(1);
    let length = 2 * radius + 1;
    let span = 16 + 2 * radius;
    let mut tile = Shared::<[F]>::new_slice(16 * span);
    let next_width = next.shape(1);
    let mut previous = F::new(0.0_f32);
    if x < width && y < height {
        previous = base[y * base.stride(0) + x * base.stride(1)];
    }
    for layer in 0..dog.shape(0) {
        let mut index = UNIT_POS as usize;
        while index < 16 * span {
            let sx = reflect((CUBE_POS_X as usize * 16 + index % 16) as i32, width);
            let sy = reflect(
                (CUBE_POS_Y as usize * 16 + index / 16) as i32 - radius as i32,
                height,
            );
            tile[index] =
                input[layer * input.stride(0) + sy * input.stride(1) + sx * input.stride(2)];
            index += 256;
        }
        sync_cube();
        if x < width && y < height {
            let mut sum = F::new(0.0_f32);
            for k in 0..length {
                sum += tile[(UNIT_POS_Y as usize + k) * 16 + UNIT_POS_X as usize]
                    * weights[layer * length + k];
            }
            dog[(layer * height + y) * width + x] = sum - previous;
            previous = sum;
            if layer as u32 + 1 == next_layer && (x & 1) == 0 && (y & 1) == 0 {
                next[(y / 2) * next_width + x / 2] = sum;
            }
        }
        // Every lane must finish reading the current tile before it is reused.
        sync_cube();
    }
}

fn empty_like(input: &CubeTensor, shape: burn::tensor::Shape) -> CubeTensor {
    CubeTensor::new_contiguous(
        input.client.clone(),
        input.device.clone(),
        shape.clone(),
        input
            .client
            .empty(shape.num_elements() * input.dtype.size()),
        input.dtype,
    )
}

impl GaussianOps for CubeBackend {
    fn sift_gaussian(
        input: FloatTensor<Self>,
        weights: FloatTensor<Self>,
        vertical: bool,
    ) -> FloatTensor<Self> {
        #[cfg(feature = "profiling")]
        let _host = crate::profiling::HostSpan::new(if vertical {
            "gaussian_vertical"
        } else {
            "gaussian_horizontal"
        });
        let shape = blur_shape(input.meta.shape(), weights.meta.shape());
        let output = empty_like(&input, shape.clone());
        gaussian_pass::launch(
            &output.client,
            CubeCount::Static(
                shape[2].div_ceil(16) as u32,
                shape[1].div_ceil(16) as u32,
                shape[0] as u32,
            ),
            CubeDim::new_3d(16, 16, 1),
            input.into_tensor_arg(),
            weights.clone().into_tensor_arg(),
            output.clone().into_tensor_arg(),
            vertical,
            weights.meta.shape()[1] / 2,
            dtype_to_storage_type(output.dtype),
        );
        output
    }

    fn sift_gaussian_dog(
        horizontal: FloatTensor<Self>,
        base: FloatTensor<Self>,
        weights: FloatTensor<Self>,
        next_layer: u32,
    ) -> (FloatTensor<Self>, FloatTensor<Self>) {
        #[cfg(feature = "profiling")]
        let _host = crate::profiling::HostSpan::new("gaussian_vertical_dog");
        let shape = horizontal.meta.shape().clone();
        let next_shape = [shape[1].div_ceil(2), shape[2].div_ceil(2)].into();
        let dog = empty_like(&horizontal, shape.clone());
        let next = empty_like(&horizontal, next_shape);
        vertical_dog::launch(
            &dog.client,
            CubeCount::Static(
                shape[2].div_ceil(16) as u32,
                shape[1].div_ceil(16) as u32,
                1,
            ),
            CubeDim::new_3d(16, 16, 1),
            horizontal.into_tensor_arg(),
            base.into_tensor_arg(),
            weights.clone().into_tensor_arg(),
            dog.clone().into_tensor_arg(),
            next.clone().into_tensor_arg(),
            next_layer,
            weights.meta.shape()[1] / 2,
            dtype_to_storage_type(dog.dtype),
        );
        (dog, next)
    }
}
