use crate::{GrayImage, Params, pyramid::PyramidPlan};
use burn::tensor::{Device, Tensor};

pub(crate) enum DetectorPlan {
    Reference(Box<PyramidPlan>),
    #[cfg(feature = "gpu")]
    Gpu(Box<crate::gpu_pyramid::GpuPyramidPlan>),
}

impl DetectorPlan {
    pub(crate) fn new(image: &GrayImage, params: &Params, device: &Device) -> Self {
        #[cfg(feature = "gpu")]
        {
            #[cfg(feature = "cpu")]
            let is_gpu = *device != Device::flex();
            #[cfg(not(feature = "cpu"))]
            let is_gpu = true;
            if is_gpu {
                return Self::Gpu(Box::new(crate::gpu_pyramid::GpuPyramidPlan::new(
                    image, params, device,
                )));
            }
        }
        Self::Reference(Box::new(PyramidPlan::new(image, params, device)))
    }

    pub(crate) fn matches(&self, image: &GrayImage, params: &Params) -> bool {
        match self {
            Self::Reference(plan) => plan.matches(image, params),
            #[cfg(feature = "gpu")]
            Self::Gpu(plan) => plan.matches(image, params),
        }
    }

    pub(crate) fn build(&self, image: &GrayImage) -> Vec<Tensor<3>> {
        match self {
            Self::Reference(plan) => crate::build_dog(&plan.build(image))
                .into_iter()
                .map(|layers| Tensor::stack(layers, 0))
                .collect(),
            #[cfg(feature = "gpu")]
            Self::Gpu(plan) => plan.build(image),
        }
    }
}
