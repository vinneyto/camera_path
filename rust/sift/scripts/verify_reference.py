"""Read the original Python implementation without editing it; compare a native CLI.
Run in photogrammetry's Python environment (torch, numpy, OpenCV, matplotlib).
"""
import argparse
import dataclasses
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

os.environ.setdefault('MPLCONFIGDIR', tempfile.mkdtemp(prefix='sift-mpl-'))
sys.dont_write_bytecode = True
parser = argparse.ArgumentParser()
parser.add_argument('--source', type=Path, required=True, help='photogrammetry/src/sift')
parser.add_argument('--cli', type=Path, required=True)
parser.add_argument('--backend', choices=['cpu', 'gpu'], default='cpu')
parser.add_argument('--fixture', type=Path, help='Write the deterministic reference fixture')
parser.add_argument('--image', type=Path, help='Also verify a real image resized by 8, as in notebook')
args = parser.parse_args()
sys.path.insert(0, str(args.source.resolve()))
import cv2
import numpy as np
import torch
from sift import SIFTParams, build_octaves, build_dog, find_scale_space_extrema

torch.set_num_threads(1)
y, x = np.mgrid[:97, :129]
rng = np.random.default_rng(42)
pixels = np.full(x.shape, 0.12)
for _ in range(55):
    cx, cy = rng.uniform(0, 129), rng.uniform(0, 97)
    sigma = rng.uniform(1, 8)
    pixels += rng.uniform(-0.6, 0.8) * np.exp(-((x-cx)**2+(y-cy)**2)/(2*sigma**2))
inputs = [('synthetic', np.clip(pixels, 0, 1).astype(np.float32))]
if args.image:
    im = cv2.imread(str(args.image))
    im = cv2.resize(im, (im.shape[1]//8, im.shape[0]//8), interpolation=cv2.INTER_AREA)
    inputs.append(('notebook', cv2.cvtColor(im, cv2.COLOR_BGR2GRAY).astype(np.float32)/255))
fixture = None
with tempfile.TemporaryDirectory(prefix='sift-parity-') as temp:
    temp = Path(temp)
    for name, pixels in inputs:
        gray = dict(width=pixels.shape[1], height=pixels.shape[0], pixels=pixels.ravel().tolist())
        (temp/'gray.json').write_text(json.dumps(gray))
        cases = []
        for config in ({}, {'enable_edge_like_filtering': False}, {'enable_subpixel_localization': False}, {'n_octave_layers': 2, 'contrast_threshold': 0.02}):
            p = SIFTParams()
            p.upscale_first = False
            for k, v in config.items(): setattr(p, k, v)
            expected = [dataclasses.asdict(k) for k in find_scale_space_extrema(build_dog(build_octaves(torch.from_numpy(pixels)[None], p)), p)]
            (temp/'params.json').write_text(json.dumps(config))
            subprocess.run([str(args.cli.resolve()), str(temp/'gray.json'), '--gray-json', '--backend', args.backend, '--params', str(temp/'params.json'), '-o', str(temp/'actual.json')], check=True)
            actual = json.loads((temp/'actual.json').read_text())
            assert len(actual) == len(expected), (name, config, len(actual), len(expected))
            # Match coordinates rather than convergence iteration ordering: float32 solvers can move
            # near-boundary candidates on a different iteration without changing the detections.
            remaining = actual.copy()
            maxima = dict(x=0., y=0., size=0., response=0.)
            for ref in expected:
                candidates = [(i, v) for i, v in enumerate(remaining) if v['octave'] == ref['octave'] and v['class_id'] == ref['class_id']]
                assert candidates, ref
                i, v = min(candidates, key=lambda pair: (pair[1]['x']-ref['x'])**2+(pair[1]['y']-ref['y'])**2)
                remaining.pop(i)
                for key in maxima:
                    delta = abs(v[key]-ref[key]); maxima[key] = max(maxima[key], delta)
                    assert delta < (2e-4 if key == 'response' else 0.005), (name, config, key, delta, ref, v)
            cases.append(dict(params=config, points=expected))
            print(name, config, len(actual), 'points; max absolute errors:', maxima)
        if name == 'synthetic': fixture = dict(image=gray, cases=cases)
if args.fixture: args.fixture.write_text(json.dumps(fixture, separators=(',', ':'))+'\n')
