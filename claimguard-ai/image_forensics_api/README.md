# ClaimGuard AI Image Forensics Lambda

This folder contains a Lambda handler and three reusable analyzers:
- Pillow/ExifTool metadata and EXIF inspection
- JPEG quantization/compression inspection
- OpenCV image-quality heuristics

## API request

POST body:
```json
{
  "claimId": "CG-TEST-001",
  "imageKeys": ["incoming/example.jpg"]
}
```

The handler reads only keys under `incoming/` from the configured private S3 bucket.
It accepts JPG/JPEG/PNG and enforces a maximum of 3 images and 10 MiB per image.

## Important ExifTool note

The Windows ExifTool path from the original standalone script has been removed.
The code looks for `EXIFTOOL_PATH` or `exiftool` on PATH. If ExifTool is not packaged
in the Lambda runtime/layer, Pillow-based metadata and JPEG quantization analysis
still run, and the response clearly marks ExifTool as unavailable.

A Linux-compatible ExifTool distribution and its runtime dependencies must be
packaged in a Lambda layer or deployment artifact before ExifTool-backed fields
will be available. Do not copy the Windows ExifTool.exe into this folder.

## Build compatibility

The requirements file pins Python packages, but successful installation on a
developer machine does not prove compatibility with AWS Lambda Python 3.14.
Build dependencies in an Amazon Linux-compatible environment matching the Lambda
runtime/architecture. Verify that the selected OpenCV wheel supports the chosen
runtime. If it does not, choose a supported Lambda runtime or build a compatible
wheel/layer; do not silently omit OpenCV.

## Security and behavior

- The Lambda never makes S3 objects public.
- It returns analysis findings as informational observations, not fraud verdicts.
- It does not write forensic reports to DynamoDB or S3.
- It isolates each analyzer so a missing ExifTool does not suppress the other results.
- It returns generic internal errors to callers; inspect CloudWatch logs for debugging.
