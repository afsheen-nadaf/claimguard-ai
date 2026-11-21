"""
Local Smaug AI-Image-Detector inference module.

Replaces the external gradio_client call with direct in-process model
inference. The model is loaded once (on first call / cold start) and
reused across warm Lambda invocations.

The model (abacusai/Smaug-AI-Image-Detector, 439M params) runs on CPU
and takes ~1-3 seconds per image for inference.
"""

import os
import sys
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Path where the model is pre-downloaded during Docker build.
MODEL_CACHE_DIR = os.environ.get(
    "SMAUG_MODEL_CACHE_DIR",
    "/var/task/smaug-model",
)

MODEL_ID = "abacusai/Smaug-AI-Image-Detector"

_detector = None


def get_detector():
    """
    Load the Smaug model on first call, then reuse it.
    In a warm Lambda, this returns immediately (the model stays in memory).
    On a cold start, this takes ~5-10 seconds to load weights.
    """
    global _detector

    if _detector is not None:
        return _detector

    logger.info("Loading Smaug model (this happens once per cold start)...")

    # snapshot_download finds the cached model immediately (pre-downloaded
    # during Docker build) and returns the path to the snapshot directory.
    from huggingface_hub import snapshot_download

    model_path = snapshot_download(
        MODEL_ID,
        cache_dir=MODEL_CACHE_DIR,
    )

    logger.info(f"Model path: {model_path}")

    # The model repo includes a custom Python module (smaug_image_detect.py)
    # that must be importable. Add its directory to sys.path.
    if str(model_path) not in sys.path:
        sys.path.insert(0, str(model_path))

    from smaug_image_detect import SmaugImageDetect
    _detector = SmaugImageDetect.from_pretrained(model_path)

    logger.info("Smaug model loaded successfully (CPU backend)")
    return _detector


def analyze_image(local_path):
    """
    Analyze an image for AI-generation probability using the local model.

    Args:
        local_path: Path to the image file on the local filesystem.

    Returns:
        dict with the same structure as the previous gradio_client response:
            - model: str
            - aiGeneratedScore: float (0-1)
            - aiGeneratedPercentage: float (0-100)
            - interpretation: str
            - disclaimer: str

    Raises:
        ValueError if the model returns an invalid score.
        Exception if the model fails to load or infer.
    """
    detector = get_detector()
    score = float(detector(str(local_path)))

    # Clamp to [0, 1] — the model should return this range, but be defensive.
    if not (0.0 <= score <= 1.0):
        raise ValueError(
            f"Smaug returned an out-of-range score: {score}"
        )

    pct = round(score * 100, 2)

    if score >= 0.5:
        interpretation = (
            f"Image shows a high probability ({pct}%) "
            f"of being AI-generated."
        )
    elif score >= 0.2:
        interpretation = (
            f"Image shows a moderate probability ({pct}%) "
            f"of being AI-generated."
        )
    else:
        interpretation = (
            f"Image shows a low probability ({pct}%) "
            f"of being AI-generated."
        )

    return {
        "model": MODEL_ID,
        "aiGeneratedScore": round(score, 6),
        "aiGeneratedPercentage": pct,
        "interpretation": interpretation,
        "disclaimer": (
            "This is an AI-generation screening score, "
            "not proof of image authenticity, manipulation, "
            "or fraud. Localized AI edits in otherwise "
            "genuine photographs may not be detected."
        ),
    }
