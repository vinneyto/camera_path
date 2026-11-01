use camera_path_core::{
    geometry,
    models::{Compiled, Project},
};
use serde::Deserialize;
#[derive(Deserialize)]
struct Case {
    name: String,
    project: Project,
    compiled: Compiled,
}
#[test]
fn matches_python_compiler_golden_cases() {
    let cases: Vec<Case> =
        serde_json::from_str(include_str!("fixtures/trajectory_golden.json")).unwrap();
    for case in cases {
        let actual = geometry::compile(&case.project, 1e-3).unwrap();
        let expected = case.compiled;
        assert!(
            (actual.total_length - expected.total_length).abs() < 1e-5,
            "{} total length: {} != {}",
            case.name,
            actual.total_length,
            expected.total_length
        );
        assert!(
            (actual.duration_seconds - expected.duration_seconds).abs() < 1e-5,
            "{} duration",
            case.name
        );
        assert_eq!(
            actual.position_segments.len(),
            expected.position_segments.len(),
            "{} adaptive subdivision",
            case.name
        );
        for (a, b) in actual
            .position_segments
            .iter()
            .zip(&expected.position_segments)
        {
            assert_eq!(a.source_segment_id, b.source_segment_id);
            for (left, right) in [a.p0, a.p1, a.p2, a.p3]
                .iter()
                .zip([b.p0, b.p1, b.p2, b.p3])
            {
                for (x, y) in left.iter().zip(right) {
                    assert!(
                        (x - y).abs() < 1e-5,
                        "{} cubic coefficient {x} != {y}",
                        case.name
                    );
                }
            }
        }
        assert_eq!(actual.warnings, expected.warnings, "{} warnings", case.name);
        assert_eq!(
            actual.camera_track, expected.camera_track,
            "{} resolved camera",
            case.name
        );
        assert_eq!(
            actual.motion_profile, expected.motion_profile,
            "{} motion",
            case.name
        );
    }
}
