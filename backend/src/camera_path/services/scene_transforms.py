"""Local scene transforms and conversion of the library's existing placement defaults."""

import math


def normalize_quaternion(value: tuple[float, float, float, float]):
    # Scaling first also handles finite inputs whose unscaled norm would overflow.
    largest = max(abs(component) for component in value)
    if largest == 0:
        raise ValueError("Quaternion must be nonzero")
    scaled = tuple(component / largest for component in value)
    length = math.hypot(*scaled)
    return tuple(component / length for component in scaled)


def quaternion_from_euler_xyz(degrees: tuple[float, float, float]):
    x, y, z = (math.radians(angle) / 2 for angle in degrees)
    cx, cy, cz = math.cos(x), math.cos(y), math.cos(z)
    sx, sy, sz = math.sin(x), math.sin(y), math.sin(z)
    return normalize_quaternion(
        (
            sx * cy * cz + cx * sy * sz,
            cx * sy * cz - sx * cy * sz,
            cx * cy * sz + sx * sy * cz,
            cx * cy * cz - sx * sy * sz,
        )
    )


def transformed_offset(quaternion, scale, offset):
    """R(q) S offset, without computing or storing any scene world matrices."""
    x, y, z, w = quaternion
    vx, vy, vz = (offset[i] * scale[i] for i in range(3))
    return (
        (1 - 2 * (y * y + z * z)) * vx + 2 * (x * y - z * w) * vy + 2 * (x * z + y * w) * vz,
        2 * (x * y + z * w) * vx + (1 - 2 * (x * x + z * z)) * vy + 2 * (y * z - x * w) * vz,
        2 * (x * z - y * w) * vx + 2 * (y * z + x * w) * vy + (1 - 2 * (x * x + y * y)) * vz,
    )
