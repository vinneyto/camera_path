import base64

from openai import AsyncOpenAI, OpenAIError

from camera_path.services.library import MAX_IMAGE_BYTES


class OpenAIImageGenerator:
    def __init__(self, api_key):
        self.api_key = api_key

    async def generate(self, parameters, source=None):
        if not self.api_key:
            raise ValueError("OpenAI image generation is not configured")
        common = dict(
            model=parameters["model"],
            prompt=parameters["prompt"],
            background="transparent",
            output_format="png",
            size=f"{parameters['width']}x{parameters['height']}",
            quality="medium",
            n=1,
        )
        try:
            async with AsyncOpenAI(api_key=self.api_key, max_retries=0, timeout=300) as client:
                if source:
                    raw, media_type = source
                    extension = media_type.split("/")[-1]
                    result = await client.images.edit(
                        image=(f"source.{extension}", raw, media_type), **common
                    )
                else:
                    result = await client.images.generate(**common)
        except OpenAIError as error:
            raise ValueError("Image provider request failed") from error
        encoded = result.data[0].b64_json if result.data else None
        if not encoded or len(encoded) > 4 * (MAX_IMAGE_BYTES + 2) // 3 + 4:
            raise ValueError("Image provider returned no image or an oversized image")
        return base64.b64decode(encoded, validate=True)
