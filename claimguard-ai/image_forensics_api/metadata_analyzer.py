"""
Metadata and EXIF analysis module for ClaimGuard AI.

Extracts container properties, Pillow-based EXIF header data, and SHA-256 fingerprint.
Missing metadata is reported as unavailable or not detected, and is never flagged
as suspicious or as an indicator of fraud.
"""

import hashlib
from datetime import datetime, timezone
from pathlib import Path

from PIL import ExifTags, Image


def calculate_sha256(file_path):
    """Calculate SHA-256 cryptographic digest of the image file."""
    digest = hashlib.sha256()
    with open(file_path, "rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def extract_metadata(file_path):
    """
    Extract image metadata using Pillow.

    Extracts:
    1. Image format
    2. Image dimensions (width, height, megapixels)
    3. Image file size
    4. Original capture timestamp (if available)
    5. Camera manufacturer (if available)
    6. Camera model (if available)
    7. GPS metadata availability (boolean)
    8. Editing software metadata (if available)
    9. SHA-256 image fingerprint

    Missing metadata is represented as unavailable or not detected, not as a fraud indicator.
    """
    path = Path(file_path)
    if not path.exists() or not path.is_file():
        raise FileNotFoundError(f"Image not found: {file_path}")

    # Verify image integrity
    with Image.open(path) as image:
        image.verify()

    with Image.open(path) as image:
        exif_data = image.getexif()
        readable_exif = {}
        gps_present = False

        if exif_data:
            # Parse top-level IFD tags
            for tag_id, value in exif_data.items():
                tag_name = ExifTags.TAGS.get(tag_id, str(tag_id))
                if isinstance(value, bytes):
                    continue
                readable_exif[tag_name] = str(value)

            # Parse Exif sub-IFD (tag 0x8769 / 34665) for DateTimeOriginal
            try:
                exif_ifd = exif_data.get_ifd(0x8769)
                for tag_id, value in exif_ifd.items():
                    tag_name = ExifTags.TAGS.get(tag_id, str(tag_id))
                    if isinstance(value, bytes) or tag_name in readable_exif:
                        continue
                    readable_exif[tag_name] = str(value)
            except Exception:
                pass

            # Check GPS sub-IFD (tag 0x8825 / 34853)
            gps_ifd = None
            try:
                gps_ifd = exif_data.get_ifd(0x8825)
            except Exception:
                pass

            gps_present = bool(34853 in exif_data or gps_ifd)

        camera_make = readable_exif.get("Make")
        camera_model = readable_exif.get("Model")
        capture_time = (
            readable_exif.get("DateTimeOriginal")
            or readable_exif.get("DateTime")
        )
        software = readable_exif.get("Software")

        return {
            "file_name": path.name,
            "file_size_bytes": path.stat().st_size,
            "file_extension": path.suffix.lower(),
            "sha256": calculate_sha256(path),
            "image_properties": {
                "format": image.format,
                "width": image.width,
                "height": image.height,
                "mode": image.mode,
                "megapixels": round((image.width * image.height) / 1_000_000, 2),
            },
            "camera_make": camera_make,
            "camera_model": camera_model,
            "capture_timestamp": capture_time,
            "software": software,
            "gps_metadata_present": gps_present,
            "pillow_exif_metadata": readable_exif,
            "exiftool_metadata": {},
            "exiftool_status": "UNAVAILABLE",
            "exiftool_warning": None,
            "file_timestamps": {
                "file_created": None,
                "file_modified": None,
                "note": "Local filesystem timestamps are not treated as original capture timestamps in this Lambda workflow.",
            },
            "metadata_indicators": {
                "exif_present": bool(readable_exif),
                "camera_make_present": bool(camera_make),
                "camera_model_present": bool(camera_model),
                "datetime_present": bool(capture_time),
                "software_field_present": bool(software),
                "gps_metadata_present": gps_present,
            },
            "findings": [],
            "analysis_timestamp": datetime.now(timezone.utc).isoformat(),
        }
