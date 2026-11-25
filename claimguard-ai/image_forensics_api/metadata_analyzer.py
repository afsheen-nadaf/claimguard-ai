"""
Metadata and EXIF analysis module for ClaimGuard AI.

Extracts container properties, Pillow-based EXIF header data, GPS coordinates,
orientation/software metadata, and SHA-256 fingerprint.
Missing metadata is reported as unavailable or not detected, and is never flagged
as suspicious or as an indicator of fraud.
"""

import hashlib
import re
from datetime import datetime, timezone
from pathlib import Path

from PIL import ExifTags, Image

ORIENTATION_LABELS = {
    1: "Normal (0°)",
    2: "Mirrored horizontal",
    3: "Rotated 180°",
    4: "Mirrored vertical",
    5: "Mirrored horizontal & rotated 90° CCW",
    6: "Rotated 90° CW",
    7: "Mirrored horizontal & rotated 90° CW",
    8: "Rotated 90° CCW",
}

KNOWN_EDITORS = (
    "snapseed",
    "photoshop",
    "lightroom",
    "gimp",
    "canva",
    "picsart",
    "remini",
    "facetune",
    "vsco",
    "polarr",
    "affinity",
    "pixlr",
    "after effects",
    "premiere",
)


def calculate_sha256(file_path):
    """Calculate SHA-256 cryptographic digest of the image file."""
    digest = hashlib.sha256()
    with open(file_path, "rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _rational_to_float(val):
    """Convert Pillow rational/tuple/numeric values to float safely."""
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    if hasattr(val, "numerator") and hasattr(val, "denominator"):
        return float(val.numerator) / float(val.denominator) if val.denominator else None
    if isinstance(val, (tuple, list)) and len(val) == 2:
        num, den = val
        return float(num) / float(den) if den else None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def _dms_to_decimal(dms, ref):
    """Convert EXIF DMS ((deg, min, sec), ref) to signed decimal degrees."""
    if not dms or not isinstance(dms, (tuple, list)) or len(dms) < 3:
        return None
    deg = _rational_to_float(dms[0])
    minutes = _rational_to_float(dms[1])
    seconds = _rational_to_float(dms[2])
    if deg is None or minutes is None or seconds is None:
        return None
    decimal = abs(deg) + (minutes / 60.0) + (seconds / 3600.0)
    ref_norm = str(ref or "").strip().upper()
    if ref_norm in ("S", "W"):
        decimal = -decimal
    return round(decimal, 6)


def _extract_gps_details(exif_data, gps_ifd):
    """Extract formatted GPS coordinates when latitude/longitude tags are present."""
    if not gps_ifd and not (exif_data and 34853 in exif_data):
        return {
            "gps_present": False,
            "latitude": None,
            "longitude": None,
            "coordinates_formatted": None,
        }

    gps_map = {}
    if isinstance(gps_ifd, dict):
        for tag_id, val in gps_ifd.items():
            tag_name = ExifTags.GPSTAGS.get(tag_id, str(tag_id))
            gps_map[tag_name] = val

    lat = _dms_to_decimal(gps_map.get("GPSLatitude"), gps_map.get("GPSLatitudeRef"))
    lon = _dms_to_decimal(gps_map.get("GPSLongitude"), gps_map.get("GPSLongitudeRef"))

    formatted = None
    if lat is not None and lon is not None:
        lat_dir = "N" if lat >= 0 else "S"
        lon_dir = "E" if lon >= 0 else "W"
        formatted = f"{abs(lat):.6f}° {lat_dir}, {abs(lon):.6f}° {lon_dir} ({lat}, {lon})"

    return {
        "gps_present": True,
        "latitude": lat,
        "longitude": lon,
        "coordinates_formatted": formatted,
    }


def _classify_software(software_val):
    """Distinguish known editing software (e.g., Snapseed) from device/firmware strings."""
    if not software_val or not str(software_val).strip():
        return {
            "software_present": False,
            "editing_software_detected": False,
            "matched_editor": None,
        }
    text = str(software_val).strip()
    lower = text.lower()
    for editor in KNOWN_EDITORS:
        if re.search(rf"\b{re.escape(editor)}\b", lower):
            return {
                "software_present": True,
                "editing_software_detected": True,
                "matched_editor": editor.title(),
            }
    return {
        "software_present": True,
        "editing_software_detected": False,
        "matched_editor": None,
    }


def extract_metadata(file_path):
    """
    Extract image metadata using Pillow.

    Missing metadata is represented as unavailable or not detected, not as a fraud indicator.
    """
    path = Path(file_path)
    if not path.exists() or not path.is_file():
        raise FileNotFoundError(f"Image not found: {file_path}")

    with Image.open(path) as image:
        image.verify()

    with Image.open(path) as image:
        exif_data = image.getexif()
        readable_exif = {}
        gps_ifd = None

        if exif_data:
            for tag_id, value in exif_data.items():
                tag_name = ExifTags.TAGS.get(tag_id, str(tag_id))
                if isinstance(value, bytes):
                    continue
                readable_exif[tag_name] = str(value)

            try:
                exif_ifd = exif_data.get_ifd(0x8769)
                for tag_id, value in exif_ifd.items():
                    tag_name = ExifTags.TAGS.get(tag_id, str(tag_id))
                    if isinstance(value, bytes) or tag_name in readable_exif:
                        continue
                    readable_exif[tag_name] = str(value)
            except Exception:
                pass

            try:
                gps_ifd = exif_data.get_ifd(0x8825)
            except Exception:
                gps_ifd = None

        gps_info = _extract_gps_details(exif_data, gps_ifd)
        gps_present = gps_info["gps_present"]

        camera_make = readable_exif.get("Make")
        camera_model = readable_exif.get("Model")
        capture_time = (
            readable_exif.get("DateTimeOriginal")
            or readable_exif.get("DateTime")
        )
        software = readable_exif.get("Software")
        software_info = _classify_software(software)

        raw_orientation = readable_exif.get("Orientation")
        orientation_code = None
        if raw_orientation is not None:
            try:
                orientation_code = int(float(str(raw_orientation).strip()))
            except (TypeError, ValueError):
                orientation_code = None
        orientation_label = (
            ORIENTATION_LABELS.get(orientation_code, f"Code {orientation_code}")
            if orientation_code is not None
            else None
        )

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
                "orientation": orientation_code,
                "orientation_label": orientation_label,
            },
            "camera_make": camera_make,
            "camera_model": camera_model,
            "capture_timestamp": capture_time,
            "software": software,
            "editing_software_detected": software_info["editing_software_detected"],
            "matched_editor": software_info["matched_editor"],
            "gps_metadata_present": gps_present,
            "gps_latitude": gps_info["latitude"],
            "gps_longitude": gps_info["longitude"],
            "gps_coordinates_formatted": gps_info["coordinates_formatted"],
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
                "editing_software_detected": software_info["editing_software_detected"],
                "gps_metadata_present": gps_present,
                "gps_coordinates_parsed": gps_info["coordinates_formatted"] is not None,
            },
            "findings": [],
            "analysis_timestamp": datetime.now(timezone.utc).isoformat(),
        }