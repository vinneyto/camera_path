import base64
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from camera_path.openai.image_generation import OpenAIImageGenerator


@pytest.mark.parametrize("source", [None, (b"source", "image/png")])
async def test_image_adapter_uses_frozen_parameters_and_never_sdk_retries(monkeypatch, source):
    images = SimpleNamespace(generate=AsyncMock(), edit=AsyncMock())
    result = SimpleNamespace(data=[SimpleNamespace(b64_json=base64.b64encode(b"PNG").decode())])
    images.generate.return_value = images.edit.return_value = result
    factory = MagicMock()
    factory.return_value.__aenter__ = AsyncMock(return_value=SimpleNamespace(images=images))
    factory.return_value.__aexit__ = AsyncMock()
    monkeypatch.setattr("camera_path.openai.image_generation.AsyncOpenAI", factory)
    assert (
        await OpenAIImageGenerator("fake").generate(
            {"model": "frozen", "prompt": "chair", "width": 1024, "height": 1024}, source
        )
        == b"PNG"
    )
    assert factory.call_args.kwargs["max_retries"] == 0
    call = images.edit if source else images.generate
    assert call.call_args.kwargs["model"] == "frozen"
    assert call.call_args.kwargs["background"] == "transparent"
    if source:
        assert call.call_args.kwargs["image"] == ("source.png", b"source", "image/png")
