"""Package a tested Linux binary for the existing SSM release flow. Does not upload or deploy."""

import argparse
import hashlib
import io
import json
import platform
import subprocess
import tarfile
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--binary", type=Path, required=True)
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parents[2]
if platform.system() != "Linux":
    raise SystemExit("Build/package on Linux matching the EC2 architecture")
revision = subprocess.check_output(
    ["git", "rev-parse", "HEAD"], cwd=root, text=True
).strip()
if subprocess.check_output(
    ["git", "status", "--porcelain"], cwd=root, text=True
).strip():
    raise SystemExit("Commit the exact source revision before packaging")
architecture = {
    "x86_64": "x86_64-unknown-linux-gnu",
    "aarch64": "aarch64-unknown-linux-gnu",
}
manifest = json.dumps(
    {"revision": revision, "target": architecture[platform.machine()]}
).encode()
args.output.parent.mkdir(parents=True, exist_ok=True)
with tarfile.open(args.output, "w:gz") as package:
    package.add(args.binary, arcname="camera-path")
    entry = tarfile.TarInfo("manifest.json")
    entry.size = len(manifest)
    package.addfile(entry, io.BytesIO(manifest))
with args.output.open("rb") as stream:
    digest = hashlib.file_digest(stream, "sha256").hexdigest()
print(
    f"Revision: {revision}\nSHA-256: {digest}\nSuggested S3 key: releases/{revision}/camera-path.tar.gz"
)
