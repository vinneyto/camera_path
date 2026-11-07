import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from uuid import uuid4

from camera_path_generation.service import GenerationService, ImageGenerationInput

PLY = (
    b"ply\nformat ascii 1.0\nelement vertex 1\nproperty float x\n"
    b"property float y\nproperty float z\nend_header\n0 1 2\n"
)


class GenerationServiceTests(unittest.TestCase):
    def test_image_replay_conflict_and_content_integrity(self):
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp)
            image = directory / "source.png"
            image.write_bytes(b"original image bytes")
            parameters = {
                "image_path": str(image),
                "image_sha256": hashlib.sha256(image.read_bytes()).hexdigest(),
            }
            calls = []

            def generate(value, destination):
                self.assertIsInstance(value, ImageGenerationInput)
                calls.append(value)
                destination.write_bytes(PLY)

            service = GenerationService(directory / "output", generate)
            body = {"schema_version": 1, "job_id": str(uuid4()), "input": parameters}
            result = service.process(json.dumps(body).encode())
            self.assertEqual(result["status"], "succeeded")
            manifest = json.loads((directory / "output" / result["result_path"]).read_text())
            self.assertEqual(manifest["input"], parameters)
            self.assertEqual(manifest["bbox"], {"min": [0, 1, 2], "max": [0, 1, 2]})
            image.unlink()
            self.assertEqual(service.process(json.dumps(body).encode()), result)
            self.assertEqual(len(calls), 1)
            body["input"] = {**parameters, "image_sha256": "0" * 64}
            self.assertEqual(
                service.process(json.dumps(body).encode())["error"]["code"], "job_conflict"
            )
            body["job_id"] = str(uuid4())
            image.write_bytes(b"other bytes")
            self.assertEqual(service.process(json.dumps(body).encode())["status"], "failed")
            self.assertEqual(len(calls), 1)

    def test_text_request_and_manifest_remain_compatible(self):
        with tempfile.TemporaryDirectory() as temp:

            def generate(value, destination):
                self.assertEqual(value.prompt, "A chair")
                destination.write_bytes(PLY)

            service = GenerationService(Path(temp), generate)
            body = {"schema_version": 1, "job_id": str(uuid4()), "input": {"prompt": "A chair"}}
            result = service.process(json.dumps(body).encode())
            self.assertEqual(result["status"], "succeeded")
            self.assertEqual(service.process(json.dumps(body).encode()), result)
            body["input"] = {"prompt": " "}
            self.assertEqual(
                service.process(json.dumps(body).encode())["error"]["code"], "invalid_request"
            )
