import math
import os

AI_GENERATION_THRESHOLD = float(
    os.environ.get("AI_GENERATION_THRESHOLD", "0.50")
)


def generate_review(analyses):
    reasons = []
    coverage_warnings = []

    smaug = analyses.get("aiGeneration", {})

    if smaug.get("status") == "COMPLETED":
        result = smaug.get("result", {})
        score = result.get("aiGeneratedScore")

        if (
            isinstance(score, (int, float))
            and math.isfinite(score)
            and 0 <= score <= 1
        ):
            if score >= AI_GENERATION_THRESHOLD:
                reasons.append(
                    "AI-generation screening score exceeded "
                    "the configured review threshold."
                )
        else:
            coverage_warnings.append(
                "AI-generation analysis returned an invalid score."
            )
    else:
        coverage_warnings.append(
            "AI-generation analysis was unavailable or incomplete."
        )

    # Only validated forensic warnings should trigger review.
    for name in ("metadata", "compression", "imageQuality"):
        analyzer = analyses.get(name, {})

        if analyzer.get("status") != "COMPLETED":
            continue

        findings = analyzer.get("result", {}).get("findings", [])

        for finding in findings:
            severity = finding.get("severity", "").lower()
            code = finding.get("code")

            if (
                severity in {"warning", "error"}
                and code not in {
                    "EXIFTOOL_ERROR",
                    "EXIFTOOL_UNAVAILABLE"
                }
            ):
                reasons.append(
                    f"{name}: {finding.get('message', 'Forensic warning detected.')}"
                )

    return {
        "required": bool(reasons),
        "priority": "NORMAL" if reasons else "NONE",
        "reasons": reasons,
        "coverageWarnings": coverage_warnings,
        "limitations": [
            "AI-generation screening may miss localized edits "
            "in otherwise genuine photographs.",
            "No flags detected does not establish image authenticity."
        ]
    }