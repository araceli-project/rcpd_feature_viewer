import asyncio
import json
import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from pydantic import TypeAdapter, ValidationError
from starlette.datastructures import UploadFile as StarletteUploadFile
from typing import Annotated

from download_models import download_models
from request_handler import process_images, train_model

download_models()
app = FastAPI()
bool_list_adapter = TypeAdapter(list[bool])


def _decode_image(content: bytes, filename: str | None) -> np.ndarray:
    image_bgr = cv2.imdecode(np.frombuffer(content, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image_bgr is None:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid image file: {filename}",
        )
    return cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)


async def _parse_images(images: list[StarletteUploadFile]) -> list[np.ndarray]:
    contents = await asyncio.gather(*(image.read() for image in images))
    loop = asyncio.get_running_loop()
    return await asyncio.gather(
        *(
            loop.run_in_executor(None, _decode_image, content, image.filename)
            for image, content in zip(images, contents)
        )
    )


@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/features")
async def features(
    images: Annotated[list[UploadFile], File(...)],
    model_name: Annotated[str, Form()] = "",
):
    if not images:
        raise HTTPException(status_code=400, detail="No images provided")

    image_arrays = await _parse_images(images)
    model_name = model_name.strip()

    try:
        features_dict, inference_results = process_images(image_arrays, model_name)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    features_json = {name: features.tolist() for name, features in features_dict.items()}

    return {
        "features": features_json,
        "inference_results": inference_results,
    }

@app.post("/train")
async def train(request: Request):
    form = await request.form(max_files=5000, max_fields=10000)
    files = form.getlist("files")
    payload = form.get("payload")

    if payload is None or not isinstance(payload, str):
        raise HTTPException(status_code=400, detail="Missing payload field")

    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    print(f"Processing uploaded {len(files)} images...")
    upload_files: list[StarletteUploadFile] = []
    for image in files:
        if not isinstance(image, StarletteUploadFile):
            raise HTTPException(status_code=400, detail="Invalid files field")
        upload_files.append(image)

    image_arrays = await _parse_images(upload_files)

    try:
        payload_obj = json.loads(payload)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON in payload") from exc

    try:
        payload_bool_list = bool_list_adapter.validate_python(payload_obj)
    except ValidationError as exc:
        raise HTTPException(
            status_code=422,
            detail="Payload must be a JSON array of booleans",
        ) from exc
    if len(payload_bool_list) != len(image_arrays):
        raise HTTPException(
            status_code=400,
            detail="Length of payload list must match number of uploaded images",
        )
    
    response = train_model(image_arrays, payload_bool_list)

    return response
    
