import numpy as np

from camera_path.bezier_compile import approximate_quintic
from camera_path.trajectory_planner import plan_minimum_jerk


def _curvature(first: np.ndarray, second: np.ndarray) -> float:
    return float(
        np.linalg.norm(np.cross(first, second)) / max(np.linalg.norm(first) ** 3, 1e-15)
    )


def test_planner_hits_anchors_and_is_c2() -> None:
    points = np.array(
        [[0.0, 0.0, 0.0], [1.0, 0.3, 0.0], [2.0, 2.0, -1.0], [5.0, 2.5, 1.0]]
    )
    pieces = plan_minimum_jerk(points)

    for index, piece in enumerate(pieces):
        np.testing.assert_array_equal(piece.evaluate(0.0), points[index])
        np.testing.assert_array_equal(piece.evaluate(1.0), points[index + 1])
    for left, right in zip(pieces, pieces[1:], strict=False):
        np.testing.assert_allclose(
            left.time_derivative(1.0, 1), right.time_derivative(0.0, 1), atol=1e-10
        )
        np.testing.assert_allclose(
            left.time_derivative(1.0, 2), right.time_derivative(0.0, 2), atol=1e-10
        )
    np.testing.assert_allclose(pieces[0].time_derivative(0.0, 3), 0.0, atol=1e-10)
    np.testing.assert_allclose(pieces[0].time_derivative(0.0, 4), 0.0, atol=1e-10)
    np.testing.assert_allclose(pieces[-1].time_derivative(1.0, 3), 0.0, atol=1e-10)
    np.testing.assert_allclose(pieces[-1].time_derivative(1.0, 4), 0.0, atol=1e-10)
    assert np.linalg.norm(pieces[0].time_derivative(0.0, 1)) > 0.0
    assert np.linalg.norm(pieces[-1].time_derivative(1.0, 1)) > 0.0


def test_tangent_constraints_preserve_direction_with_free_speed() -> None:
    points = np.array([[0.0, 0.0, 0.0], [1.0, 1.0, 0.0], [3.0, 1.0, 1.0]])
    start_tangent = np.array([0.0, 0.0, -2.0])
    end_tangent = np.array([1.0, 0.0, 0.0])

    pieces = plan_minimum_jerk(
        points, start_tangent=start_tangent, end_tangent=end_tangent
    )

    for actual, expected in (
        (pieces[0].time_derivative(0.0, 1), start_tangent),
        (pieces[-1].time_derivative(1.0, 1), end_tangent),
    ):
        assert np.dot(actual, expected) > 0.0
        cosine = np.dot(actual, expected) / (np.linalg.norm(actual) * np.linalg.norm(expected))
        np.testing.assert_allclose(cosine, 1.0, atol=1e-10)


def test_planner_is_scale_invariant() -> None:
    points = np.array([[0.0, 0.0, 0.0], [0.01, 2.0, 0.0], [4.0, 2.2, -1.0]])
    reference = plan_minimum_jerk(points)
    scale = 1e5
    scaled = plan_minimum_jerk(points * scale)

    for left, right in zip(reference, scaled, strict=True):
        for u in np.linspace(0.0, 1.0, 21):
            np.testing.assert_allclose(right.evaluate(float(u)), left.evaluate(float(u)) * scale)


def test_adaptive_cubic_approximation_stays_within_tolerance() -> None:
    points = np.array([[0.0, 0.0, 0.0], [1.0, 3.0, 0.0], [3.0, -1.0, 2.0]])
    tolerance = 1e-4

    for piece in plan_minimum_jerk(points):
        approximations = approximate_quintic(piece, tolerance)
        assert approximations
        for approximation in approximations:
            p0, p1, p2, p3 = approximation.points
            for local_t in np.linspace(0.0, 1.0, 101):
                u = approximation.u0 + (approximation.u1 - approximation.u0) * local_t
                expected = piece.evaluate(float(u))
                v = 1.0 - local_t
                actual = (
                    v**3 * p0
                    + 3.0 * v**2 * local_t * p1
                    + 3.0 * v * local_t**2 * p2
                    + local_t**3 * p3
                )
                assert np.linalg.norm(expected - actual) <= tolerance * 1.01


def test_uneven_short_segments_do_not_backtrack_or_stop() -> None:
    points = np.array(
        [[0.0, 0.0, 0.0], [1.0, 0.0, 0.0], [1.01, 5.0, 0.0], [10.0, 5.0, 0.0]]
    )

    for index, piece in enumerate(plan_minimum_jerk(points)):
        chord = points[index + 1] - points[index]
        for u in np.linspace(0.0, 1.0, 101):
            velocity = piece.time_derivative(float(u), 1)
            assert np.linalg.norm(velocity) > 1e-8
            assert np.dot(velocity, chord) > 0.0


def test_sparse_path_spreads_curvature_beyond_short_anchor_peaks() -> None:
    points = np.array(
        [
            [-6.0, 1.0, -1.0],
            [-2.0, 1.2, -0.8],
            [1.0, 3.8, 2.5],
            [4.5, 2.0, -1.5],
            [8.0, 2.2, -1.0],
        ]
    )
    minimum_jerk_curvature = np.array(
        [
            _curvature(piece.time_derivative(float(u), 1), piece.time_derivative(float(u), 2))
            for piece in plan_minimum_jerk(points)
            for u in np.linspace(0.0, 1.0, 401)
        ]
    )

    old_curvature: list[float] = []
    for index in range(len(points) - 1):
        p0, p3 = points[index], points[index + 1]
        previous = points[index - 1] if index else p0
        following = points[index + 2] if index + 2 < len(points) else p3
        before = max(float(np.linalg.norm(p0 - previous)) ** 0.5, 1e-9)
        after = max(float(np.linalg.norm(following - p0)) ** 0.5, 1e-9)
        m0 = (p3 - previous) / (before + after)
        before = max(float(np.linalg.norm(p3 - p0)) ** 0.5, 1e-9)
        after = max(float(np.linalg.norm(following - p3)) ** 0.5, 1e-9)
        m1 = (following - p0) / (before + after)
        scale = max(float(np.linalg.norm(p3 - p0)) ** 0.5, 1e-9)
        curve = np.array([p0, p0 + m0 * scale / 3.0, p3 - m1 * scale / 3.0, p3])
        for t in np.linspace(0.0, 1.0, 401):
            first = 3.0 * (
                (1.0 - t) ** 2 * (curve[1] - curve[0])
                + 2.0 * (1.0 - t) * t * (curve[2] - curve[1])
                + t**2 * (curve[3] - curve[2])
            )
            second = 6.0 * (
                (1.0 - t) * (curve[2] - 2.0 * curve[1] + curve[0])
                + t * (curve[3] - 2.0 * curve[2] + curve[1])
            )
            old_curvature.append(_curvature(first, second))

    old = np.asarray(old_curvature)
    old_broad_fraction = np.mean(old > 0.25 * np.max(old))
    new_broad_fraction = np.mean(
        minimum_jerk_curvature > 0.25 * np.max(minimum_jerk_curvature)
    )
    assert new_broad_fraction > old_broad_fraction * 1.5
    assert np.max(minimum_jerk_curvature) < np.max(old)
