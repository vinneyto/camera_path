import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from uuid import uuid4

from camera_path_painter.service import PainterService
from PIL import Image, ImageDraw


class PainterTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.calls = []

        def generate(parameters, path):
            self.calls.append(parameters)
            image = Image.new("RGBA", (16, 16))
            ImageDraw.Draw(image).rectangle((4, 4, 12, 12), fill="blue")
            image.save(path)

        self.service = PainterService(self.root / "out", generate)
        self.payload = {
            "schema_version": 1,
            "job_id": str(uuid4()),
            "input": {"prompt": "A blue chair", "seed": 42},
        }

    def process(self):
        return self.service.process(json.dumps(self.payload).encode())

    def test_atomic_result_replay_and_conflicting_input(self):
        result = self.process()
        self.assertEqual(result["status"], "succeeded")
        self.assertEqual(self.process(), result)
        self.assertEqual(len(self.calls), 1)
        manifest = json.loads((self.root / "out" / result["result_path"]).read_text())
        self.assertEqual(manifest["input"]["seed"], 42)
        self.payload["input"]["prompt"] = "Another chair"
        self.assertEqual(self.process()["error"]["code"], "job_conflict")
        self.assertEqual(len(self.calls), 1)

    def test_source_checksum_and_cached_result_integrity(self):
        source = self.root / "source.png"
        Image.new("RGB", (16, 16), "red").save(source)
        self.payload["input"].update(image_path=str(source), image_sha256="0" * 64)
        self.assertEqual(self.process()["status"], "failed")
        self.assertEqual(self.calls, [])
        self.payload["input"]["image_sha256"] = hashlib.sha256(
            source.read_bytes()
        ).hexdigest()
        result = self.process()
        self.assertEqual(result["status"], "succeeded")
        (self.root / "out" / self.payload["job_id"] / "image.png").write_bytes(
            b"corrupt"
        )
        self.assertEqual(self.process()["status"], "failed")
        self.assertEqual(len(self.calls), 1)

    def test_failure_does_not_publish_a_partial_directory(self):
        def fail(_parameters, path):
            path.write_bytes(b"partial")
            raise RuntimeError("Intentional failure")

        self.service.generate = fail
        self.assertEqual(self.process()["status"], "failed")
        self.assertEqual(list((self.root / "out").iterdir()), [])

    def test_invalid_requests_do_not_call_the_model(self):
        for body in (
            b"not json",
            b"[]",
            b"x" * (256 * 1024 + 1),
            json.dumps({**self.payload, "schema_version": True}).encode(),
        ):
            self.assertEqual(
                self.service.process(body)["error"]["code"], "invalid_request"
            )
        self.assertEqual(self.calls, [])

    def test_opaque_or_empty_png_is_rejected(self):
        for mode, color in (("RGB", "white"), ("RGBA", (0, 0, 0, 0))):
            self.service.generate = lambda _p, path, mode=mode, color=color: Image.new(
                mode, (16, 16), color
            ).save(path)
            self.assertEqual(self.process()["status"], "failed")
            self.assertEqual(list((self.root / "out").iterdir()), [])


if __name__ == "__main__":
    unittest.main()
