from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

Vector = NDArray[np.float64]


@dataclass(frozen=True)
class QuinticPiece:
    """One minimum-jerk polynomial, parameterized on ``u in [0, 1]``."""

    coefficients: NDArray[np.float64]
    duration: float
    start: Vector
    end: Vector

    def evaluate(self, u: float, derivative: int = 0) -> Vector:
        if derivative < 0 or derivative > 5:
            raise ValueError("derivative must be between zero and five")
        if derivative == 0 and u == 0.0:
            return self.start.copy()
        if derivative == 0 and u == 1.0:
            return self.end.copy()
        powers = np.zeros(6, dtype=np.float64)
        for degree in range(derivative, 6):
            factor = 1.0
            for value in range(derivative):
                factor *= degree - value
            powers[degree] = factor * u ** (degree - derivative)
        return powers @ self.coefficients

    def time_derivative(self, u: float, derivative: int) -> Vector:
        return self.evaluate(u, derivative) / self.duration**derivative


_JERK_GRAM = np.array(
    [
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 36, 72, 120],
        [0, 0, 0, 72, 192, 360],
        [0, 0, 0, 120, 360, 720],
    ],
    dtype=np.float64,
)


def _velocity_index(knot: int, dimension: int) -> int:
    return knot * 6 + dimension


def _acceleration_index(knot: int, dimension: int) -> int:
    return knot * 6 + 3 + dimension


def _piece_affine_map(
    point0: Vector,
    point1: Vector,
    duration: float,
    knot: int,
    knot_count: int,
) -> tuple[NDArray[np.float64], NDArray[np.float64]]:
    variable_count = knot_count * 6
    maps = np.zeros((3, 6, variable_count), dtype=np.float64)
    offsets = np.zeros((3, 6), dtype=np.float64)
    h = duration
    h2 = h * h
    for dimension in range(3):
        vi = _velocity_index(knot, dimension)
        vj = _velocity_index(knot + 1, dimension)
        ai = _acceleration_index(knot, dimension)
        aj = _acceleration_index(knot + 1, dimension)
        delta = point1[dimension] - point0[dimension]

        offsets[dimension, 0] = point0[dimension]
        maps[dimension, 1, vi] = h
        maps[dimension, 2, ai] = 0.5 * h2

        offsets[dimension, 3] = 10.0 * delta
        maps[dimension, 3, vi] = -6.0 * h
        maps[dimension, 3, vj] = -4.0 * h
        maps[dimension, 3, ai] = -1.5 * h2
        maps[dimension, 3, aj] = 0.5 * h2

        offsets[dimension, 4] = -15.0 * delta
        maps[dimension, 4, vi] = 8.0 * h
        maps[dimension, 4, vj] = 7.0 * h
        maps[dimension, 4, ai] = 1.5 * h2
        maps[dimension, 4, aj] = -h2

        offsets[dimension, 5] = 6.0 * delta
        maps[dimension, 5, vi] = -3.0 * h
        maps[dimension, 5, vj] = -3.0 * h
        maps[dimension, 5, ai] = -0.5 * h2
        maps[dimension, 5, aj] = 0.5 * h2
    return maps, offsets


def _direction_normals(direction: Vector) -> tuple[Vector, Vector]:
    unit = direction / np.linalg.norm(direction)
    axis = np.zeros(3, dtype=np.float64)
    axis[int(np.argmin(np.abs(unit)))] = 1.0
    first = np.cross(unit, axis)
    first /= np.linalg.norm(first)
    second = np.cross(unit, first)
    return first, second


def _velocity_constraint_row(variable_count: int, knot: int, values: Vector) -> Vector:
    row = np.zeros(variable_count, dtype=np.float64)
    for dimension, value in enumerate(values):
        row[_velocity_index(knot, dimension)] = value
    return row


def _durations(points: NDArray[np.float64]) -> Vector:
    chords = np.linalg.norm(np.diff(points, axis=0), axis=1)
    if np.any(chords < 1e-10):
        raise ValueError("minimum-jerk anchors must be distinct")
    # Centripetal knot spacing is substantially less prone to loops and
    # backtracking on very uneven anchor distances than uniform or chordal time.
    weights = np.sqrt(chords)
    return weights * (len(chords) / float(np.sum(weights)))


def plan_minimum_jerk(
    points: NDArray[np.float64],
    *,
    start_tangent: Vector | None = None,
    end_tangent: Vector | None = None,
) -> list[QuinticPiece]:
    """Interpolate all points with a globally optimized, C2 minimum-jerk spline.

    Knot velocities and accelerations are selected together. Natural endpoint
    conditions set jerk and snap to zero while leaving velocity and acceleration free.
    Optional endpoint tangents constrain direction only; their magnitude remains free.
    """
    points = np.asarray(points, dtype=np.float64)
    if points.ndim != 2 or points.shape[1] != 3 or len(points) < 2:
        raise ValueError("points must have shape (n, 3) with n >= 2")
    durations = _durations(points)
    knot_count = len(points)
    variable_count = knot_count * 6
    hessian = np.zeros((variable_count, variable_count), dtype=np.float64)
    gradient = np.zeros(variable_count, dtype=np.float64)
    affine_maps: list[tuple[NDArray[np.float64], NDArray[np.float64]]] = []

    for knot, duration in enumerate(durations):
        maps, offsets = _piece_affine_map(
            points[knot], points[knot + 1], float(duration), knot, knot_count
        )
        affine_maps.append((maps, offsets))
        weight = float(duration) ** -5
        for dimension in range(3):
            mapping = maps[dimension]
            offset = offsets[dimension]
            hessian += weight * mapping.T @ _JERK_GRAM @ mapping
            gradient += weight * mapping.T @ _JERK_GRAM @ offset

    constraints: list[Vector] = []
    targets: list[float] = []
    start_maps, start_offsets = affine_maps[0]
    end_maps, end_offsets = affine_maps[-1]
    start_jerk = np.array([0.0, 0.0, 0.0, 6.0, 0.0, 0.0])
    start_snap = np.array([0.0, 0.0, 0.0, 0.0, 24.0, 0.0])
    end_jerk = np.array([0.0, 0.0, 0.0, 6.0, 24.0, 60.0])
    end_snap = np.array([0.0, 0.0, 0.0, 0.0, 24.0, 120.0])
    for dimension in range(3):
        for weights, mapping, offset in (
            (start_jerk, start_maps[dimension], start_offsets[dimension]),
            (start_snap, start_maps[dimension], start_offsets[dimension]),
            (end_jerk, end_maps[dimension], end_offsets[dimension]),
            (end_snap, end_maps[dimension], end_offsets[dimension]),
        ):
            constraints.append(weights @ mapping)
            targets.append(float(-(weights @ offset)))

    for knot, tangent in ((0, start_tangent), (knot_count - 1, end_tangent)):
        if tangent is None:
            continue
        tangent = np.asarray(tangent, dtype=np.float64)
        if np.linalg.norm(tangent) < 1e-12:
            raise ValueError("tangent constraints must be non-zero")
        for normal in _direction_normals(tangent):
            constraints.append(_velocity_constraint_row(variable_count, knot, normal))
            targets.append(0.0)

    constraint_matrix = np.vstack(constraints)
    target_vector = np.asarray(targets, dtype=np.float64)
    system = np.block(
        [
            [hessian, constraint_matrix.T],
            [constraint_matrix, np.zeros((len(constraints), len(constraints)))],
        ]
    )
    rhs = np.concatenate((-gradient, target_vector))
    solution = np.linalg.lstsq(system, rhs, rcond=1e-12)[0][:variable_count]

    # Direction constraints describe a ray, not an unoriented line. Degenerate or
    # reversed solutions are pinned to a scale-neutral nominal speed and re-solved.
    extra_constraints: list[tuple[int, Vector]] = []
    for knot, tangent in ((0, start_tangent), (knot_count - 1, end_tangent)):
        if tangent is None:
            continue
        unit = np.asarray(tangent, dtype=np.float64)
        unit /= np.linalg.norm(unit)
        velocity = np.array(
            [solution[_velocity_index(knot, dimension)] for dimension in range(3)]
        )
        if float(np.dot(velocity, unit)) <= 1e-9:
            extra_constraints.append((knot, unit))
    if extra_constraints:
        nominal_speed = float(np.sum(np.linalg.norm(np.diff(points, axis=0), axis=1))) / len(
            durations
        )
        for knot, unit in extra_constraints:
            constraints.append(_velocity_constraint_row(variable_count, knot, unit))
            targets.append(nominal_speed)
        constraint_matrix = np.vstack(constraints)
        target_vector = np.asarray(targets, dtype=np.float64)
        system = np.block(
            [
                [hessian, constraint_matrix.T],
                [constraint_matrix, np.zeros((len(constraints), len(constraints)))],
            ]
        )
        rhs = np.concatenate((-gradient, target_vector))
        solution = np.linalg.lstsq(system, rhs, rcond=1e-12)[0][:variable_count]

    pieces: list[QuinticPiece] = []
    for duration, (maps, offsets) in zip(durations, affine_maps, strict=True):
        coefficients = np.column_stack(
            [maps[dimension] @ solution + offsets[dimension] for dimension in range(3)]
        )
        pieces.append(
            QuinticPiece(
                coefficients=coefficients,
                duration=float(duration),
                start=points[len(pieces)].copy(),
                end=points[len(pieces) + 1].copy(),
            )
        )
    return pieces
