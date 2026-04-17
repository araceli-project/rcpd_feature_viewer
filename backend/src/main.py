from download_models import download_models
from io import BytesIO
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError
from typing import Annotated

from request_handler import process_images

download_models()
app = FastAPI()

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/features")
async def features(images: Annotated[list[UploadFile], File(...)]):
    if not images:
        raise HTTPException(status_code=400, detail="No images provided")

    image_arrays: list[np.ndarray] = []

    for image in images:
        content = await image.read()

        try:
            pil_image = Image.open(BytesIO(content)).convert("RGB")
            image_arrays.append(np.array(pil_image))
        except UnidentifiedImageError as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid image file: {image.filename}",
            ) from exc

    features_dict, inference_results = process_images(image_arrays)

    features_json = {name: features.tolist() for name, features in features_dict.items()}

    return {
        "features": features_json,
        "inference_results": inference_results,
    }
