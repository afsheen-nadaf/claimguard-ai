
import tempfile
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException
from detector import analyze_image

app = FastAPI(
    title="ClaimGuard AI - Smaug Detection Service",
    description="AI-generated image screening service",
    version="1.0.0"
)

MAX_IMAGE_BYTES = 10 * 1024 * 1024
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}


@app.get("/")
def health_check():
    return {
        "service": "ClaimGuard AI Smaug Detection",
        "status": "running",
        "model": "Smaug AI Image Detector"
    }


@app.post("/analyze")
async def analyze_uploaded_image(image: UploadFile = File(...)):

    suffix = Path(image.filename or "").suffix.lower()

    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Only JPG, JPEG and PNG images are supported."
        )

    content = await image.read(MAX_IMAGE_BYTES + 1)

    if not content or len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=400,
            detail="Image must be between 1 byte and 10 MB."
        )

    temp_path = None

    try:
        with tempfile.NamedTemporaryFile(
            suffix=suffix,
            delete=False
        ) as temp:
            temp.write(content)
            temp_path = Path(temp.name)

        result = analyze_image(str(temp_path))

        return {
            "status": "COMPLETED",
            "fileName": image.filename,
            "analysis": result
        }

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Image analysis failed."
        )

    finally:
        if temp_path:
            temp_path.unlink(missing_ok=True)
