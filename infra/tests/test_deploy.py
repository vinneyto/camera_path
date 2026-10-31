import importlib.util
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, Mock


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).parents[1] / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


d = load("deploy", "scripts/deploy.py")


class DeploymentFixture(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        root = Path(self.temp.name)
        self.old = root / "old"
        self.new = root / "new"
        self.old.mkdir()
        self.new.mkdir()
        (self.old / ".revision").write_text("a" * 40)
        data = root / "data"
        etc = root / "etc"
        data.mkdir()
        etc.mkdir()
        database = data / "database.sqlite3"
        with sqlite3.connect(database) as db:
            db.execute("CREATE TABLE example(value TEXT)")
            db.execute("INSERT INTO example VALUES ('original')")
        (etc / "backend.env").write_text('KEY="old"\n')
        current = root / "current"
        current.symlink_to(self.old)
        self.patches = [
            patch.object(d, "ROOT", root), patch.object(d, "DATA", data),
            patch.object(d, "ETC", etc), patch.object(d, "DATABASE", database),
            patch.object(d, "CURRENT", current), patch.object(d, "own"),
            patch.object(d, "RUNTIME_OVERRIDE", etc / "runtime.conf"),
            patch.object(d, "prepare_release", return_value=self.new),
            patch.object(d, "environment", return_value={"KEY": "new"}),
            patch.object(d.boto3, "client", return_value=Mock()),
        ]
        for p in self.patches:
            p.start()
            self.addCleanup(p.stop)
        self.addCleanup(self.temp.cleanup)

    def mutate_database(self):
        with sqlite3.connect(d.DATABASE) as db:
            db.execute("UPDATE example SET value = 'migrated'")

    def value(self):
        with sqlite3.connect(d.DATABASE) as db:
            return db.execute("SELECT value FROM example").fetchone()[0]

class DeploymentTests(DeploymentFixture):
    def test_migration_failure_restores_database_code_and_env_but_fails_deploy(self):
        def migrate(*args, **kwargs):
            self.mutate_database()
            raise RuntimeError("migration failed")
        with patch.object(d, "as_user", side_effect=migrate), patch.object(d, "service") as svc, \
                patch.object(d, "wait_healthy"):
            with self.assertRaisesRegex(RuntimeError, "previous database and release restored"):
                d.deploy("b" * 40, {"region": "us-east-1", "backups_bucket": "backup"})
            self.assertEqual([call.args[0] for call in svc.call_args_list], ["stop", "stop", "start"])
        self.assertEqual(self.value(), "original")
        self.assertEqual(d.CURRENT.resolve(), self.old)
        self.assertEqual((d.ETC / "backend.env").read_text(), 'KEY="old"\n')

    def test_health_failure_restores_database_after_successful_migration(self):
        with patch.object(d, "as_user", side_effect=lambda *a, **kw: self.mutate_database()), \
                patch.object(d, "service"), \
                patch.object(d, "wait_healthy", side_effect=[RuntimeError("bad health"), None]):
            with self.assertRaisesRegex(RuntimeError, "previous database and release restored"):
                d.deploy("b" * 40, {"region": "us-east-1", "backups_bucket": "backup"})
        self.assertEqual(self.value(), "original")
        self.assertEqual(d.CURRENT.resolve(), self.old)

    def test_https_failure_restores_database_and_previous_release(self):
        with patch.object(d, "as_user", side_effect=lambda *a, **kw: self.mutate_database()), \
                patch.object(d, "service"), patch.object(d, "wait_healthy"), \
                patch.object(d, "wait_https_healthy", side_effect=RuntimeError("TLS health failed")):
            with self.assertRaisesRegex(RuntimeError, "previous database and release restored"):
                d.deploy("b" * 40, {"region": "us-east-1", "backups_bucket": "backup", "api_domain": "api.example.com"})
        self.assertEqual(self.value(), "original")
        self.assertEqual(d.CURRENT.resolve(), self.old)

    def test_failed_restore_does_not_start_old_service(self):
        with patch.object(d, "as_user", side_effect=RuntimeError("migration")), \
                patch.object(d, "service") as svc, \
                patch.object(d, "restore_database", side_effect=RuntimeError("disk error")):
            with self.assertRaisesRegex(RuntimeError, "recovery failed"):
                d.deploy("b" * 40, {"region": "us-east-1", "backups_bucket": "backup"})
            self.assertNotIn("start", [call.args[0] for call in svc.call_args_list])

    def test_backup_upload_failure_restarts_old_release_without_migration(self):
        d.boto3.client.return_value.upload_file.side_effect = RuntimeError("S3 unavailable")
        with patch.object(d, "service") as svc, patch.object(d, "as_user") as migrate:
            with self.assertRaisesRegex(RuntimeError, "S3 unavailable"):
                d.deploy("b" * 40, {"region": "us-east-1", "backups_bucket": "backup"})
            migrate.assert_not_called()
            self.assertEqual([c.args[0] for c in svc.call_args_list], ["stop", "start"])
        self.assertEqual(self.value(), "original")

    def test_success_keeps_migration_and_activates_new_release(self):
        with patch.object(d, "as_user", side_effect=lambda *a, **kw: self.mutate_database()), \
                patch.object(d, "service"), patch.object(d, "wait_healthy"):
            d.deploy("b" * 40, {"region": "us-east-1", "backups_bucket": "backup"})
        self.assertEqual(self.value(), "migrated")
        self.assertEqual(d.CURRENT.resolve(), self.new)

    def test_backup_contains_committed_wal_rows(self):
        connection = sqlite3.connect(d.DATABASE)
        self.addCleanup(connection.close)
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("INSERT INTO example VALUES ('wal-row')")
        connection.commit()
        backup = d.DATA / "wal-backup.sqlite3"
        d.sqlite_backup(d.DATABASE, backup)
        with sqlite3.connect(backup) as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM example").fetchone()[0], 2)

    def test_first_release_failure_removes_new_database_and_leaves_service_stopped(self):
        d.CURRENT.unlink()
        d.DATABASE.unlink()
        (d.ETC / "backend.env").unlink()

        def migrate(*args, **kwargs):
            with sqlite3.connect(d.DATABASE) as db:
                db.execute("CREATE TABLE partial(value TEXT)")
            raise RuntimeError("first migration failed")

        with patch.object(d, "as_user", side_effect=migrate), patch.object(d, "service") as svc:
            with self.assertRaisesRegex(RuntimeError, "previous database and release restored"):
                d.deploy("b" * 40, {"region": "us-east-1", "backups_bucket": "backup"})
            self.assertNotIn("start", [c.args[0] for c in svc.call_args_list])
        self.assertFalse(d.DATABASE.exists())
        self.assertFalse(d.CURRENT.is_symlink())


if __name__ == "__main__":
    unittest.main()

class AuthenticationEnvironmentTests(unittest.TestCase):
    def test_release_requires_ses_and_disables_forwarded_ip_trust(self):
        secrets = Mock()
        secrets.get_secret_value.return_value = {"SecretString": "x" * 40}
        with patch.object(d.boto3, "client", return_value=secrets):
            env = d.environment({"region": "us-east-1", "jwt_secret": "jwt",
                                 "openai_secret": "openai", "library_bucket": "library",
                                 "auth_email_from": "noreply@example.com"})
        self.assertEqual(env["CAMERA_PATH_ENVIRONMENT"], "production")
        self.assertEqual(env["CAMERA_PATH_AUTH_SECOND_FACTOR"], "email")
        self.assertEqual(env["CAMERA_PATH_AUTH_EMAIL_DELIVERY"], "ses")
        self.assertEqual(env["CAMERA_PATH_AUTH_EMAIL_FROM"], "noreply@example.com")
        self.assertEqual(env["FORWARDED_ALLOW_IPS"], "")


class RustRuntimeTests(DeploymentFixture):
    def test_rust_failure_restores_runtime_override_and_database(self):
        original = "[Service]\nExecStart=/previous/python\n"
        d.RUNTIME_OVERRIDE.write_text(original)
        config = {"region": "us-east-1", "backups_bucket": "backup", "backend_runtime": "rust"}
        with patch.object(d, "as_user", side_effect=lambda *a, **kw: self.mutate_database()), \
                patch.object(d, "service"), patch.object(d, "run"), \
                patch.object(d, "wait_healthy", side_effect=[RuntimeError("bad native health"), None]):
            with self.assertRaisesRegex(RuntimeError, "previous database and release restored"):
                d.deploy("b" * 40, config)
        self.assertEqual(self.value(), "original")
        self.assertEqual(d.RUNTIME_OVERRIDE.read_text(), original)
        self.assertEqual(d.CURRENT.resolve(), self.old)

    def test_rust_success_uses_native_migration_and_service_override(self):
        with patch.object(d, "as_user") as execute, patch.object(d, "service"), \
                patch.object(d, "run"), patch.object(d, "wait_healthy"):
            d.deploy("b" * 40, {"region": "us-east-1", "backups_bucket": "backup", "backend_runtime": "rust"})
        self.assertEqual(execute.call_args.args, (str(self.new / "backend-rust/bin/camera-path"), "migrate"))
        self.assertIn("backend-rust/bin/camera-path serve", d.RUNTIME_OVERRIDE.read_text())

    def test_bad_rust_checksum_is_rejected_before_extracting_or_running_code(self):
        config = {"region": "us-east-1", "backups_bucket": "backup", "rust_artifact_key": "releases/" + "b" * 40 + "/backend.tar.gz", "rust_artifact_sha256": "0" * 64}
        def download(_bucket, _key, target):
            Path(target).write_bytes(b"untrusted artifact")
        d.boto3.client.return_value.download_file.side_effect = download
        with self.assertRaisesRegex(ValueError, "SHA-256 mismatch"):
            d.install_rust_artifact(self.new, "b" * 40, config)
        self.assertFalse((self.new / "backend-rust/bin/camera-path").exists())


class RustArtifactTests(DeploymentFixture):
    def package(self, revision, target="x86_64-unknown-linux-gnu", unsafe=False):
        import hashlib
        import io
        import json
        import shutil
        import tarfile
        archive = self.new / "fixture.tar.gz"
        header = bytearray(32)
        header[:6] = b"\x7fELF\x02\x01"
        header[18:20] = (62).to_bytes(2, "little")
        with tarfile.open(archive, "w:gz") as package:
            entry = tarfile.TarInfo("camera-path")
            if unsafe:
                entry.type = tarfile.SYMTYPE
                entry.linkname = "/etc/passwd"
                package.addfile(entry)
            else:
                entry.size = len(header)
                package.addfile(entry, io.BytesIO(header))
            manifest = json.dumps({"revision": revision, "target": target}).encode()
            entry = tarfile.TarInfo("manifest.json")
            entry.size = len(manifest)
            package.addfile(entry, io.BytesIO(manifest))
        checksum = hashlib.sha256(archive.read_bytes()).hexdigest()
        d.boto3.client.return_value.download_file.side_effect = lambda _b, _k, dest: shutil.copyfile(archive, dest)
        return {"region": "us-east-1", "backups_bucket": "backup", "rust_artifact_key": "releases/" + "b" * 40 + "/backend.tar.gz", "rust_artifact_sha256": checksum}

    def test_verified_native_artifact_is_installed_with_exact_revision_and_architecture(self):
        config = self.package("b" * 40)
        with patch.object(d.platform, "machine", return_value="x86_64"):
            d.install_rust_artifact(self.new, "b" * 40, config)
        self.assertTrue((self.new / "backend-rust/bin/camera-path").read_bytes().startswith(b"\x7fELF"))
        self.assertEqual((self.new / ".artifact-sha256").read_text().strip(), config["rust_artifact_sha256"])

    def test_artifact_manifest_for_another_revision_is_rejected(self):
        config = self.package("c" * 40)
        with patch.object(d.platform, "machine", return_value="x86_64"):
            with self.assertRaisesRegex(ValueError, "revision/target mismatch"):
                d.install_rust_artifact(self.new, "b" * 40, config)

    def test_symlink_artifact_is_rejected_without_extracting_it(self):
        config = self.package("b" * 40, unsafe=True)
        with self.assertRaisesRegex(ValueError, "regular files"):
            d.install_rust_artifact(self.new, "b" * 40, config)
