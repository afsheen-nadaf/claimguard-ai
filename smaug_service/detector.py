
import sys
from pathlib import Path

from huggingface_hub import snapshot_download

MODEL_ID = "abacusai/Smaug-AI-Image-Detector"

print("Downloading or locating Smaug model...")
MODEL_PATH = snapshot_download(MODEL_ID)

sys.path.insert(0, MODEL_PATH)

from smaug_image_detect import SmaugImageDetect

print("Loading Smaug model...")
detector = SmaugImageDetect.from_pretrained(MODEL_PATH)

print("Smaug model loaded successfully!")


def analyze_image(image_path: str) -> dict:
    """
    Analyze an image and return its AI-generation score.
    Higher scores indicate the model considers the image
    more likely to be AI-generated.
    """

    path = Path(image_path)

    if not path.is_file():
        raise FileNotFoundError("Image file not found.")

    score = float(detector(str(path)))

    if not 0.0 <= score <= 1.0:
        raise ValueError("Model returned an invalid score.")

    return {
        "model": MODEL_ID,
        "aiGeneratedScore": round(score, 6),
        "aiGeneratedPercentage": round(score * 100, 2),
        "interpretation": (
            "Higher AI-generation score"
            if score >= 0.5
            else "Lower AI-generation score"
        ),
        "disclaimer": (
            "This is a model screening score, not proof of image "
            "authenticity, manipulation, or fraud."
        )
    }
