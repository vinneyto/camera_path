from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

from camera_path.trajectory_planner import QuinticPiece

Vector = NDArray[np.float64]
BezierPoints = tuple[Vector, Vector, Vector, Vector]
_ERROR_SAMPLES = np.linspace(0.0, 1.0, 17)[1:-1]


@dataclass(frozen=True)
class CubicApproximation:
    points: BezierPoints
    u0: float
    u1: float
    sampled_max_deviation: float


def _evaluate_bezier(points: BezierPoints, t: float) -> Vector:
    p0, p1, p2, p3 = points
    u = 1.0 - t
    return u**3 * p0 + 3.0 * u**2 * t * p1 + 3.0 * u * t**2 * p2 + t**3 * p3


def approximate_quintic(
    piece: QuinticPiece,
    tolerance: float,
    *,
    max_depth: int = 20,
) -> list[CubicApproximation]:
    """Adaptively approximate a quintic while preserving endpoint tangents."""
    if tolerance <= 0.0:
        raise ValueError("tolerance must be positive")
    result: list[CubicApproximation] = []

    def visit(u0: float, u1: float, depth: int) -> None:
        width = u1 - u0
        p0 = piece.evaluate(u0)
        p3 = piece.evaluate(u1)
        points = (
            p0,
            p0 + piece.evaluate(u0, 1) * width / 3.0,
            p3 - piece.evaluate(u1, 1) * width / 3.0,
            p3,
        )
        deviation = max(
            float(
                np.linalg.norm(
                    piece.evaluate(u0 + width * float(local_t))
                    - _evaluate_bezier(points, float(local_t))
                )
            )
            for local_t in _ERROR_SAMPLES
        )
        if deviation <= tolerance:
            result.append(
                CubicApproximation(
                    points=points,
                    u0=u0,
                    u1=u1,
                    sampled_max_deviation=deviation,
                )
            )
            return
        if depth >= max_depth:
            raise ValueError("quintic approximation did not converge within max_depth")
        midpoint = (u0 + u1) * 0.5
        visit(u0, midpoint, depth + 1)
        visit(midpoint, u1, depth + 1)

    visit(0.0, 1.0, 0)
    return result
