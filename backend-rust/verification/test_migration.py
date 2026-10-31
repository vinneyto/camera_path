import hashlib
import shutil
import sqlite3

from helpers import command, migration, running, upload


def test_populated_python_database_roundtrips_through_rust_and_back(tmp_path):
    with running(tmp_path, "python") as backend:
        b = backend
        b.login()
        p = b.project("Before migration")
        a = p.anchor("Start", [1, 0, 0])
        center = p.anchor("Axis", [0, 0, 0])
        end = p.anchor("End", [2, 2, 0])
        p.mutate(
            "POST",
            "/segments/spiral",
            201,
            json={
                "start_anchor_id": a["id"],
                "center_anchor_id": center["id"],
                "end_anchor_id": end["id"],
            },
        )
        point = p.mutate(
            "POST", "/scene-points", 201, json={"label": "Subject", "position": [1, 3, 5]}
        ).json()
        p.mutate("POST", "/motion/keyframes", 201, json={"path_position": 0.3, "speed": 2})
        p.mutate(
            "POST",
            "/camera/keyframes",
            201,
            json={
                "path_position": 0.4,
                "aim": {"kind": "look_at_point", "scene_point_id": point["id"]},
            },
        )
        p.mutate(
            "POST",
            "/camera/orientation/keyframes",
            201,
            json={"path_position": 0.5, "orientation": {"yaw_deg": 45}},
        )
        p.mutate(
            "POST",
            "/camera/depth-of-field/keyframes",
            201,
            json={
                "path_position": 0.6,
                "focus": {"kind": "scene_point", "scene_point_id": point["id"]},
            },
        )
        p.mutate("PATCH", "/camera/lidar", json={"vertical_resolution": 64})
        p.mutate("POST", "/chat/messages", json={"id": "legacy-message", "message": "Remember"})
        asset, data = upload(b)
        p.mutate("POST", "/clouds", 201, json={"library_asset_id": asset["id"]})
        b.request("PATCH", "/api/v1/profile/settings", json={"show_grid": False})
        suffixes = [
            "",
            "/anchors",
            "/scene-points",
            "/trajectory",
            "/motion",
            "/camera",
            "/camera/orientation",
            "/camera/depth-of-field",
            "/camera/lidar",
            "/chat/messages",
            "/clouds",
        ]
        before = {s: (p.get(s).json(), p.get(s).headers["etag"]) for s in suffixes}
        old_library = b.request("GET", "/api/v1/library").json()
        b.stop()
        # Migrate a COPY, preserving the original database and files for rollback.
        copied = tmp_path / "rust-copy"
        copied.mkdir()
        shutil.copy2(tmp_path / "db.sqlite3", copied / "db.sqlite3")
        shutil.copytree(tmp_path / "library", copied / "library")
        b.env["CAMERA_PATH_DATABASE_URL"] = f"sqlite+aiosqlite:///{copied / 'db.sqlite3'}"
        b.env["CAMERA_PATH_LIBRARY_DIRECTORY"] = str(copied / "library")
        result = migration(b)
        assert result.returncode == 0, result.stderr
        # Adoption is repeatable; it does not reinitialize application tables.
        assert migration(b).returncode == 0
        b.command = command(b, "rust")
        b.start()
        b.request("GET", "/api/v1/auth/session")  # Existing Python JWT and persisted session.
        for suffix, (value, etag) in before.items():
            reply = p.get(suffix)
            assert reply.json() == value, suffix
            assert reply.headers["etag"] == etag
        assert b.request("GET", "/api/v1/library").json() == old_library
        assert b.request("GET", asset["download_url"]).content == data
        assert b.request("GET", "/api/v1/profile/settings").json()["show_grid"] is False
        b.login()  # Rust verifies the existing Python Argon2 hash and sends a real SMTP code.
        p.mutate("PATCH", f"/anchors/{a['id']}", json={"label": "Edited by Rust", "lift": 0.5})
        after = p.get("/anchors").json()
        b.stop()
        b.command = command(b, "python")
        b.start()
        b.request("GET", "/api/v1/auth/session")  # Existing Rust-issued JWT.
        assert p.get("/anchors").json() == after
        assert b.request("GET", asset["download_url"]).content == data
        p.mutate("PATCH", json={"name": "Python rollback remains readable"})


def test_unknown_alembic_version_is_rejected_without_changing_data(tmp_path):
    with running(tmp_path, "python") as b:
        b.login()
        b.project("Must survive")
        b.stop()
        database = tmp_path / "db.sqlite3"
        with sqlite3.connect(database) as connection:
            connection.execute("UPDATE alembic_version SET version_num='unknown_schema'")
        before = hashlib.sha256(database.read_bytes()).digest()
        result = migration(b)
        assert result.returncode != 0
        assert "Unsupported Alembic schema" in result.stderr
        assert hashlib.sha256(database.read_bytes()).digest() == before


def test_mismatched_column_type_is_rejected_before_migration(tmp_path):
    with running(tmp_path, "python") as b:
        b.stop()
        database = tmp_path / "db.sqlite3"
        with sqlite3.connect(database) as connection:
            connection.execute("PRAGMA writable_schema=ON")
            original = connection.execute(
                "SELECT sql FROM sqlite_master WHERE name='anchors'"
            ).fetchone()[0]
            changed = original.replace("surface_position_x FLOAT", "surface_position_x TEXT")
            assert changed != original
            connection.execute("UPDATE sqlite_master SET sql=? WHERE name='anchors'", (changed,))
            connection.execute("PRAGMA writable_schema=OFF")
        before = hashlib.sha256(database.read_bytes()).digest()
        result = migration(b)
        assert result.returncode != 0 and "Unexpected type" in result.stderr
        assert hashlib.sha256(database.read_bytes()).digest() == before
