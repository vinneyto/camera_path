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


class DeploymentTests(unittest.TestCase):
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
