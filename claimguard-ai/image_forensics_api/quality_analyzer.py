"""
Image Quality and Usability Analysis module for ClaimGuard AI.

Evaluates evidence clarity, illumination, contrast, and resolution using Pillow and NumPy.
Assesses whether uploaded photos are technically suitable for claims inspection.
Quality observations describe photographic usability and do not detect or imply
fraud, manipulation, or AI generation.
"""

import math
import os
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

# ---------------------------------------------------------------------------
# CONFIGURATION & REASONABLE BOUNDS
# ---------------------------------------------------------------------------

# Maximum dimension (in pixels) for in-memory NumPy float32 quality analysis.
# Protects AWS Lambda from multi-gigabyte memory allocations on 50+ megapixel photos.
MAX_ANALYSIS_DIMENSION = int(
    os.environ.get("QUALITY_MAX_ANALYSIS_DIMENSION", "2048")
)


def _parse_positive_int(var_name, default_val, env):
    val_str = env.get(var_name)
    if val_str is None or val_str == "":
        return default_val
    try:
        val = int(val_str)
    except (ValueError, TypeError):
        raise ValueError(
            f"Configuration error: {var_name} must be a valid integer, got {val_str!r}"
        )
    if val <= 0:
        raise ValueError(
            f"Configuration error: {var_name} must be a positive integer (> 0), got {val}"
        )
    return val


def _parse_non_negative_float(var_name, default_val, env):
    val_str = env.get(var_name)
    if val_str is None or val_str == "":
        return default_val
    try:
        val = float(val_str)
    except (ValueError, TypeError):
        raise ValueError(
            f"Configuration error: {var_name} must be a valid number, got {val_str!r}"
        )
    if not math.isfinite(val):
        raise ValueError(
            f"Configuration error: {var_name} must be a finite number, got {val}"
        )
    if val < 0:
        raise ValueError(
            f"Configuration error: {var_name} must be non-negative (>= 0), got {val}"
        )
    return val


def get_quality_thresholds(env=None):
    """
    Load and strictly validate quality thresholds from environment variables or defaults.

    Validates:
    - Minimum width and height must be positive integers (> 0).
    - All metric thresholds must be finite, non-negative numbers (>= 0).
    - QUALITY_BRIGHT_THRESHOLD must be greater than QUALITY_DARK_THRESHOLD.
    - QUALITY_HIGH_CONTRAST_THRESHOLD must be greater than QUALITY_LOW_CONTRAST_THRESHOLD.
    """
    if env is None:
        env = os.environ

    min_width = _parse_positive_int("QUALITY_MIN_WIDTH", 640, env)
    min_height = _parse_positive_int("QUALITY_MIN_HEIGHT", 480, env)
    blur_threshold = _parse_non_negative_float("QUALITY_BLUR_THRESHOLD", 50.0, env)
    dark_threshold = _parse_non_negative_float("QUALITY_DARK_THRESHOLD", 40.0, env)
    bright_threshold = _parse_non_negative_float("QUALITY_BRIGHT_THRESHOLD", 215.0, env)
    low_contrast_threshold = _parse_non_negative_float("QUALITY_LOW_CONTRAST_THRESHOLD", 25.0, env)
    high_contrast_threshold = _parse_non_negative_float("QUALITY_HIGH_CONTRAST_THRESHOLD", 75.0, env)

    if bright_threshold <= dark_threshold:
        raise ValueError(
            f"Configuration error: QUALITY_BRIGHT_THRESHOLD ({bright_threshold}) "
            f"must be greater than QUALITY_DARK_THRESHOLD ({dark_threshold})"
        )

    if high_contrast_threshold <= low_contrast_threshold:
        raise ValueError(
            f"Configuration error: QUALITY_HIGH_CONTRAST_THRESHOLD ({high_contrast_threshold}) "
            f"must be greater than QUALITY_LOW_CONTRAST_THRESHOLD ({low_contrast_threshold})"
        )

    return {
        "min_width": min_width,
        "min_height": min_height,
        "blur_threshold": blur_threshold,
        "dark_threshold": dark_threshold,
        "bright_threshold": bright_threshold,
        "low_contrast_threshold": low_contrast_threshold,
        "high_contrast_threshold": high_contrast_threshold,
    }


# Initial module-level threshold defaults
_INITIAL_THRESHOLDS = get_quality_thresholds()
MIN_RECOMMENDED_WIDTH = _INITIAL_THRESHOLDS["min_width"]
MIN_RECOMMENDED_HEIGHT = _INITIAL_THRESHOLDS["min_height"]
BLUR_THRESHOLD = _INITIAL_THRESHOLDS["blur_threshold"]
DARK_THRESHOLD = _INITIAL_THRESHOLDS["dark_threshold"]
BRIGHT_THRESHOLD = _INITIAL_THRESHOLDS["bright_threshold"]
LOW_CONTRAST_THRESHOLD = _INITIAL_THRESHOLDS["low_contrast_threshold"]
HIGH_CONTRAST_THRESHOLD = _INITIAL_THRESHOLDS["high_contrast_threshold"]


def _laplacian_variance(gray):
    """Calculate a 3x3 discrete Laplacian variance using NumPy."""
    pixels = np.asarray(gray, dtype=np.float32)
    padded = np.pad(pixels, 1, mode="edge")

    laplacian = (
        padded[:-2, 1:-1]
        + padded[2:, 1:-1]
        + padded[1:-1, :-2]
        + padded[1:-1, 2:]
        - 4.0 * padded[1:-1, 1:-1]
    )

    return float(np.var(laplacian))


def _noise_estimate(gray):
    """Estimate high-frequency residual using Pillow's 3x3 median filter."""
    median_image = gray.filter(ImageFilter.MedianFilter(size=3))

    original = np.asarray(gray, dtype=np.float32)
    median = np.asarray(median_image, dtype=np.float32)

    return float(np.median(np.abs(original - median))) * 1.4826


def analyze_image_quality(image_path, thresholds=None):
    """
    Analyze image evidence quality and technical usability.

    Calculates:
    - Dimensions and megapixels (resolution)
    - Laplacian variance (focus/sharpness)
    - Mean luminance (exposure/brightness)
    - Luminance standard deviation (contrast spread)
    - High-frequency residual median estimate (noise)

    Generates objective usability descriptions. Does not flag photographic
    imperfections as fraud or manipulation.

    Memory Safety:
    - If dimensions exceed MAX_ANALYSIS_DIMENSION (default 2048 px), creates a downscaled
      grayscale proxy for Laplacian, brightness, contrast, and noise calculations.
    - Preserves original image file and reports original dimensions for resolution checks.
    """
    path = Path(image_path)

    if not path.exists() or not path.is_file():
        raise FileNotFoundError(f"Image not found: {image_path}")

    try:
        with Image.open(path) as source:
            source.load()
            width, height = source.size
            gray = source.convert("L")

    except Exception as exc:
        raise ValueError(f"Unable to read image: {exc}") from exc

    if width < 1 or height < 1:
        raise ValueError("Image has invalid dimensions.")

    if thresholds is None:
        thresholds = get_quality_thresholds()

    min_width = thresholds["min_width"]
    min_height = thresholds["min_height"]
    blur_threshold = thresholds["blur_threshold"]
    dark_threshold = thresholds["dark_threshold"]
    bright_threshold = thresholds["bright_threshold"]
    low_contrast_threshold = thresholds["low_contrast_threshold"]
    high_contrast_threshold = thresholds["high_contrast_threshold"]

    # -------------------------------------------------------------
    # MEMORY OPTIMIZATION: PROXY DOWNSCALING
    # -------------------------------------------------------------
    max_dim = max(width, height)
    if max_dim > MAX_ANALYSIS_DIMENSION:
        scale = MAX_ANALYSIS_DIMENSION / max_dim
        analyzed_width = max(1, round(width * scale))
        analyzed_height = max(1, round(height * scale))
        gray_analysis = gray.resize((analyzed_width, analyzed_height), Image.Resampling.BILINEAR)
        downscaled = True
    else:
        gray_analysis = gray
        analyzed_width, analyzed_height = width, height
        downscaled = False

    blur_score = round(_laplacian_variance(gray_analysis), 2)

    gray_array = np.asarray(gray_analysis, dtype=np.float32)
    brightness = round(float(gray_array.mean()), 2)
    contrast = round(float(gray_array.std()), 2)
    noise = round(_noise_estimate(gray_analysis), 2)

    # Descriptive evidence-quality assessments
    sharpness_label = "Sharp" if blur_score >= blur_threshold else "Blurry"

    if brightness < dark_threshold:
        exposure_label = "Underexposed"
    elif brightness > bright_threshold:
        exposure_label = "Overexposed"
    else:
        exposure_label = "Balanced"

    if contrast < low_contrast_threshold:
        contrast_label = "Low contrast"
    elif contrast > high_contrast_threshold:
        contrast_label = "High contrast"
    else:
        contrast_label = "Adequate contrast"

    # Orientation-independent resolution check comparing longer and shorter dimensions
    # Evaluated on original image dimensions
    min_long = max(min_width, min_height)
    min_short = min(min_width, min_height)
    img_long = max(width, height)
    img_short = min(width, height)

    resolution_sufficient = img_long >= min_long and img_short >= min_short
    resolution_label = "Sufficient" if resolution_sufficient else "Low resolution"

    usable_for_inspection = bool(
        resolution_sufficient
        and blur_score >= blur_threshold
        and dark_threshold <= brightness <= bright_threshold
        and contrast >= low_contrast_threshold
    )

    findings = []

    if downscaled:
        findings.append({
            "code": "ANALYSIS_RESOLUTION_DOWNSCALED",
            "severity": "informational",
            "category": "evidence_quality",
            "message": (
                f"Image dimensions ({width}×{height}) exceeded the maximum analysis resolution "
                f"({MAX_ANALYSIS_DIMENSION} px); quality inspection was performed on a "
                f"{analyzed_width}×{analyzed_height} proxy to optimize memory and processing time."
            ),
        })

    if not resolution_sufficient:
        findings.append({
            "code": "LOW_RESOLUTION",
            "severity": "informational",
            "category": "evidence_quality",
            "message": (
                f"Image dimensions ({width}×{height}) are under recommended {min_width}×{min_height} px; "
                "fine damage details may be difficult to inspect. A clearer photo may be requested if needed."
            ),
        })

    if blur_score < blur_threshold:
        findings.append({
            "code": "POSSIBLY_BLURRY",
            "severity": "informational",
            "category": "evidence_quality",
            "message": (
                f"Image has low edge variance ({blur_score} < {blur_threshold} Laplacian variance), indicating soft focus or motion blur. "
                "A sharper replacement photo may be needed for damage assessment."
            ),
        })

    if brightness < dark_threshold:
        findings.append({
            "code": "LOW_BRIGHTNESS",
            "severity": "informational",
            "category": "evidence_quality",
            "message": (
                f"Image has low mean luminance ({brightness} < {dark_threshold}), indicating underexposure or low-light capture. "
                "Damage details in shadowed areas may be obscured."
            ),
        })
    elif brightness > bright_threshold:
        findings.append({
            "code": "HIGH_BRIGHTNESS",
            "severity": "informational",
            "category": "evidence_quality",
            "message": (
                f"Image has elevated mean luminance ({brightness} > {bright_threshold}), indicating overexposure or glare. "
                "Surface details in washed-out areas may be obscured."
            ),
        })

    if contrast < low_contrast_threshold:
        findings.append({
            "code": "LOW_CONTRAST",
            "severity": "informational",
            "category": "evidence_quality",
            "message": (
                f"Image has low luminance contrast ({contrast} < {low_contrast_threshold} std dev), indicating flat lighting or haze. "
                "Damage delineation may be reduced."
            ),
        })

    return {
        "file_name": path.name,
        "image_quality": {
            "width": width,
            "height": height,
            "megapixels": round((width * height) / 1_000_000, 2),
            "analyzed_width": analyzed_width,
            "analyzed_height": analyzed_height,
            "analysis_downscaled": downscaled,
            "blur_score": blur_score,
            "brightness_score": brightness,
            "contrast_score": contrast,
            "noise_estimate": noise,
            "sharpness_label": sharpness_label,
            "exposure_label": exposure_label,
            "contrast_label": contrast_label,
            "resolution_label": resolution_label,
        },
        "quality_assessment": {
            "sharpness": sharpness_label,
            "exposure": exposure_label,
            "contrast": contrast_label,
            "resolution": resolution_label,
            "usable_for_inspection": usable_for_inspection,
        },
        "findings": findings,
        "analysis_timestamp": datetime.now(timezone.utc).isoformat(),
        "disclaimer": (
            "Image quality metrics assess technical suitability for claims inspection "
            "(focus, lighting, resolution); they do not detect manipulation, AI generation, or fraud."
        ),
        "implementation": "Pillow + NumPy discrete Laplacian variance and median filter residual",
    }
