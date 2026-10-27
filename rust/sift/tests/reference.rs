#![cfg(feature = "cpu")]
use camera_path_sift::{GrayImage, KeyPoint, Params};
fn detect(image: &GrayImage, params: &Params) -> Result<Vec<KeyPoint>, String> {
    pollster::block_on(camera_path_sift::detect(
        image,
        params,
        &burn::tensor::Device::flex(),
    ))
}
use serde::Deserialize;
#[derive(Deserialize)]
struct Case {
    params: Params,
    points: Vec<KeyPoint>,
}
#[derive(Deserialize)]
struct Fixture {
    image: GrayImage,
    cases: Vec<Case>,
}
#[test]
fn matches_original_pytorch_pipeline() {
    check_fixture(&burn::tensor::Device::flex());
}
#[test]
#[ignore = "requires a native GPU; run explicitly for GPU parity"]
fn gpu_matches_original_pytorch_pipeline() {
    let device = burn::tensor::Device::wgpu_options().init().unwrap();
    check_fixture(&device);
}
fn check_fixture(device: &burn::tensor::Device) {
    let f: Fixture = serde_json::from_str(include_str!("fixtures/python-reference.json")).unwrap();
    for case in f.cases {
        let mut actual =
            pollster::block_on(camera_path_sift::detect(&f.image, &case.params, device)).unwrap();
        assert_eq!(actual.len(), case.points.len());
        for expected in case.points {
            let (i, point) = actual
                .iter()
                .enumerate()
                .filter(|(_, p)| p.octave == expected.octave && p.class_id == expected.class_id)
                .min_by(|(_, a), (_, b)| {
                    ((a.x - expected.x).powi(2) + (a.y - expected.y).powi(2))
                        .total_cmp(&((b.x - expected.x).powi(2) + (b.y - expected.y).powi(2)))
                })
                .unwrap();
            assert!((point.x - expected.x).abs() < 0.005);
            assert!((point.y - expected.y).abs() < 0.005);
            assert!((point.size - expected.size).abs() < 0.005);
            assert!((point.response - expected.response).abs() < 0.0002);
            actual.remove(i);
        }
    }
}
#[test]
fn flat_tiny_and_odd_images_have_no_extrema() {
    for (width, height) in [(3, 3), (17, 11), (65, 33)] {
        for value in [0.0, 0.5, 1.0] {
            assert!(
                detect(
                    &GrayImage {
                        width,
                        height,
                        pixels: vec![value; width * height]
                    },
                    &Params::default()
                )
                .unwrap()
                .is_empty()
            );
        }
    }
}
#[test]
fn rejects_invalid_input_before_processing() {
    assert!(GrayImage::from_rgba(20, 20, &[]).is_err());
    let mut image = GrayImage {
        width: 3,
        height: 3,
        pixels: vec![0.0; 9],
    };
    image.pixels[0] = f32::NAN;
    assert!(detect(&image, &Params::default()).is_err());
    image.pixels[0] = 0.0;
    for params in [
        Params {
            n_octave_layers: 0,
            ..Params::default()
        },
        Params {
            sigma: 0.0,
            ..Params::default()
        },
        Params {
            edge_threshold: 0.0,
            ..Params::default()
        },
    ] {
        assert!(detect(&image, &params).is_err());
    }
}
