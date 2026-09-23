from camera_path.models import CameraAim, CameraOrientation, FollowPathAim, LookAtPointAim


def aim_columns(prefix: str, aim: CameraAim) -> dict[str, str | None]:
    return {
        f"{prefix}_kind": aim.kind,
        f"{prefix}_direction": aim.direction if isinstance(aim, FollowPathAim) else None,
        f"{prefix}_scene_point_id": (
            aim.scene_point_id if isinstance(aim, LookAtPointAim) else None
        ),
    }


def aim_from_record(record: object, prefix: str) -> CameraAim:
    if getattr(record, f"{prefix}_kind") == "follow_path":
        return FollowPathAim(direction=getattr(record, f"{prefix}_direction"))
    return LookAtPointAim(scene_point_id=getattr(record, f"{prefix}_scene_point_id"))


def orientation_columns(prefix: str, orientation: CameraOrientation) -> dict[str, float]:
    return {
        f"{prefix}yaw_deg": orientation.yaw_deg,
        f"{prefix}pitch_deg": orientation.pitch_deg,
        f"{prefix}roll_deg": orientation.roll_deg,
    }


def orientation_from_record(record: object, prefix: str) -> CameraOrientation:
    return CameraOrientation(
        yaw_deg=getattr(record, f"{prefix}yaw_deg"),
        pitch_deg=getattr(record, f"{prefix}pitch_deg"),
        roll_deg=getattr(record, f"{prefix}roll_deg"),
    )
