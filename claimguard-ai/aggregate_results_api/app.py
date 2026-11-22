import json
import os
import re
import time
from datetime import datetime, timezone
from decimal import Decimal

import boto3

table = boto3.resource("dynamodb").Table(os.environ["OPERATIONAL_CLAIMS_TABLE"])
bedrock = boto3.client("bedrock-runtime")
MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "amazon.nova-lite-v1:0")

CHECK_ORDER = ["policy", "outlier", "forensics", "evidence"]  # same order as the Parallel branches
MAX_RESULT_BYTES = 100_000

SKIPPED = {
    "forensics": {
        "skipped": True, "reason": "NO_IMAGES", "analysisStatus": "SKIPPED",
        "imagesSubmitted": 0, "analysesCompleted": 0, "analysesWithErrors": 0,
        "images": [],
        "message": "No JPG, JPEG or PNG images were uploaded for this claim.",
    },
    "evidence": {
        "skipped": True, "reason": "NO_EVIDENCE", "overallStatus": "SKIPPED",
        "overallVerdict": "UNCERTAIN", "requiresReview": False,
        "evidenceResults": [],
        "message": "No uploaded evidence was available for relevance validation.",
    },
}
UNAVAILABLE = {
    "duplicate": "Duplicate check unavailable. Manual review needed.",
    "policy": "Policy validation unavailable. Manual review needed.",
    "outlier": "Outlier check unavailable. Manual review needed.",
    "forensics": "Image forensics unavailable. Manual review needed.",
    "evidence": "Evidence validation unavailable. Manual review needed.",
}

ACTION_BY_CHECK = {
    "policy": "Verify policy coverage status, effective dates, and policyholder identity against underwriting records.",
    "duplicate": "Cross-check prior claim submissions and matching image hashes on the same policy or incident date.",
    "outlier": "Request itemized repair estimates or medical bills to substantiate the claimed amount against peer benchmarks.",
    "forensics": "Inspect original unedited camera files and EXIF metadata for images flagged during forensic screening.",
    "evidence": "Review uploaded supporting documents manually to confirm alignment with the reported incident narrative.",
}

FORBIDDEN_TERMS_RE = re.compile(r"\b(fraud|fraudulent|fraudster|scam|fake|forged|guilty)\b", re.IGNORECASE)


def parse(payload):
    try:
        # parse_float=Decimal because boto3 rejects Python floats
        return json.loads(payload.get("body") or "{}", parse_float=Decimal)
    except (TypeError, ValueError):
        return {}


def build(check, claim_id, payload):
    finished = int(time.time() * 1000)
    if payload.get("skipped"):
        return {"status": "done", "raw": {**SKIPPED[check], "claimId": claim_id},
                "error": None, "finishedAt": finished}
    body = parse(payload)
    if payload.get("statusCode") == 200:
        if len(json.dumps(body, default=str).encode()) > MAX_RESULT_BYTES:
            return {"status": "error", "raw": None,
                    "error": "Result too large to store.", "finishedAt": finished}
        return {"status": "done", "raw": body, "error": None, "finishedAt": finished}
    message = body.get("error") if isinstance(body, dict) else None
    return {"status": "error", "raw": body or None,
            "error": message or UNAVAILABLE[check], "finishedAt": finished}


def _to_plain(obj):
    if isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    if isinstance(obj, dict):
        return {k: _to_plain(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_to_plain(v) for v in obj]
    return obj


def extract_ground_truth_facts(claim_id, built):
    """Deterministically extract verified signals without any LLM math or status guessing."""
    checks_summary = {}
    triggered = []

    # 1. Policy
    p_entry = built["policy"]
    p_raw = _to_plain(p_entry.get("raw") or {})
    if p_entry["status"] != "done":
        checks_summary["policy"] = {"state": "ERROR", "reason": p_entry.get("error")}
        triggered.append("policy")
    else:
        issues = p_raw.get("issues") or p_raw.get("flags") or []
        valid = p_raw.get("valid", len(issues) == 0)
        state = "PASS" if (valid and not issues) else "REVIEW"
        checks_summary["policy"] = {
            "state": state,
            "policyStatus": p_raw.get("status", "UNKNOWN"),
            "issues": issues,
        }
        if state != "PASS":
            triggered.append("policy")

    # 2. Duplicate
    d_entry = built["duplicate"]
    d_raw = _to_plain(d_entry.get("raw") or {})
    if d_entry["status"] != "done":
        checks_summary["duplicate"] = {"state": "ERROR", "reason": d_entry.get("error")}
        triggered.append("duplicate")
    else:
        claim_matches = int(d_raw.get("matchCount") or len(d_raw.get("matches") or []))
        image_matches = int(d_raw.get("imageMatchCount") or len(d_raw.get("imageMatches") or []))
        is_dup = bool(d_raw.get("isDuplicate")) or claim_matches > 0 or image_matches > 0
        state = "REVIEW" if is_dup else "PASS"
        checks_summary["duplicate"] = {
            "state": state,
            "claimMatchCount": claim_matches,
            "imageMatchCount": image_matches,
        }
        if state != "PASS":
            triggered.append("duplicate")

    # 3. Outlier
    o_entry = built["outlier"]
    o_raw = _to_plain(o_entry.get("raw") or {})
    if o_entry["status"] != "done":
        checks_summary["outlier"] = {"state": "ERROR", "reason": o_entry.get("error")}
        triggered.append("outlier")
    else:
        is_outlier = bool(o_raw.get("isOutlier") or o_raw.get("flagged"))
        state = "REVIEW" if is_outlier else "PASS"
        checks_summary["outlier"] = {
            "state": state,
            "zScore": o_raw.get("robustZScore", o_raw.get("zScore")),
            "severity": o_raw.get("severity", "NORMAL"),
        }
        if state != "PASS":
            triggered.append("outlier")

    # 4. Forensics
    f_entry = built["forensics"]
    f_raw = _to_plain(f_entry.get("raw") or {})
    if f_entry["status"] != "done":
        checks_summary["forensics"] = {"state": "ERROR", "reason": f_entry.get("error")}
        triggered.append("forensics")
    elif f_raw.get("skipped"):
        checks_summary["forensics"] = {"state": "SKIPPED", "reason": "NO_IMAGES"}
    else:
        images = f_raw.get("images") or []
        flagged_imgs = [
            img for img in images
            if img.get("riskLevel") in ("HIGH", "MEDIUM")
            or img.get("aiGenerated") is True
            or img.get("exifMissing") is True
        ]
        state = "REVIEW" if (flagged_imgs or int(f_raw.get("analysesWithErrors") or 0) > 0) else "PASS"
        checks_summary["forensics"] = {
            "state": state,
            "imagesSubmitted": int(f_raw.get("imagesSubmitted") or len(images)),
            "flaggedImageCount": len(flagged_imgs),
        }
        if state != "PASS":
            triggered.append("forensics")

    # 5. Evidence
    e_entry = built["evidence"]
    e_raw = _to_plain(e_entry.get("raw") or {})
    if e_entry["status"] != "done":
        checks_summary["evidence"] = {"state": "ERROR", "reason": e_entry.get("error")}
        triggered.append("evidence")
    elif e_raw.get("skipped"):
        checks_summary["evidence"] = {"state": "SKIPPED", "reason": "NO_EVIDENCE"}
    else:
        verdict = str(e_raw.get("overallVerdict") or "UNCERTAIN").upper()
        requires_review = bool(e_raw.get("requiresReview")) or verdict not in ("RELEVANT", "PASS", "SUPPORTED")
        state = "REVIEW" if requires_review else "PASS"
        checks_summary["evidence"] = {
            "state": state,
            "overallVerdict": verdict,
        }
        if state != "PASS":
            triggered.append("evidence")

    if len(triggered) == 0:
        posture = "CLEAR_SIGNALS"
    elif len(triggered) == 1:
        posture = "SINGLE_INDICATOR"
    else:
        posture = "MULTI_SIGNAL_REVIEW"

    return {
        "claimId": claim_id,
        "posture": posture,
        "triggeredChecks": triggered,
        "checks": checks_summary,
    }


def deterministic_fallback_brief(facts, generated_at, mode="deterministic-fallback"):
    triggered = facts["triggeredChecks"]
    if not triggered:
        summary = (
            f"All executed automated screening checks for claim {facts['claimId']} completed "
            "without policy, duplicate, statistical outlier, image forensic, or evidence anomalies."
        )
        observations = []
        actions = ["Proceed with standard adjuster verification and settlement workflow."]
    else:
        summary = (
            f"Automated screening for claim {facts['claimId']} identified {len(triggered)} "
            f"area(s) requiring adjuster attention ({', '.join(triggered)}). "
            "Human verification of the underlying records is recommended before disposition."
        )
        observations = [
            {
                "check": chk,
                "finding": f"{chk.capitalize()} check returned state {facts['checks'][chk]['state']} ({json.dumps(facts['checks'][chk])}).",
            }
            for chk in triggered
        ]
        actions = [ACTION_BY_CHECK[chk] for chk in triggered if chk in ACTION_BY_CHECK][:3]

    return {
        "posture": facts["posture"],
        "triggeredChecks": triggered,
        "executiveSummary": summary,
        "groundedObservations": observations,
        "recommendedAdjusterActions": actions,
        "disclaimer": "Decision-support summary grounded strictly in automated screening outputs. Final claim determinations require human adjuster review.",
        "modelId": MODEL_ID,
        "generationMode": mode,
        "generatedAt": generated_at,
    }


def _sanitize_text(text):
    return FORBIDDEN_TERMS_RE.sub("anomaly", str(text or "")).strip()


def generate_grounded_brief(facts, generated_at):
    system_prompt = (
        "You are an insurance claim screening assistant producing an objective adjuster decision brief. "
        "STRICT RULES:\n"
        "1. Rely ONLY on the exact keys, values, counts, and states inside the provided GROUND_TRUTH_FACTS JSON.\n"
        "2. Do NOT invent numbers, dates, names, policies, or findings not explicitly present in GROUND_TRUTH_FACTS.\n"
        "3. Never use accusatory words such as fraud, fraudulent, scam, fake, or guilty; describe findings neutrally as screening indicators.\n"
        "4. Return ONLY valid JSON with exact keys: executiveSummary (string, 2-3 neutral sentences), "
        "groundedObservations (array of objects with keys 'check' and 'finding', containing ONLY checks listed in triggeredChecks; use [] if triggeredChecks is empty), "
        "recommendedAdjusterActions (array of 1 to 3 concise verification steps mapped directly to triggeredChecks)."
    )

    user_message = f"GROUND_TRUTH_FACTS:\n{json.dumps(facts, sort_keys=True)}"

    try:
        response = bedrock.converse(
            modelId=MODEL_ID,
            system=[{"text": system_prompt}],
            messages=[{"role": "user", "content": [{"text": user_message}]}],
            inferenceConfig={
                "temperature": 0.0,
                "topP": 1.0,
                "maxTokens": 450,
            },
        )
        raw_text = response["output"]["message"]["content"][0]["text"].strip()
        # Strip optional markdown code fences if emitted
        if raw_text.startswith("```"):
            raw_text = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw_text, flags=re.DOTALL).strip()

        parsed = json.loads(raw_text)
        if not isinstance(parsed, dict):
            raise ValueError("Model output is not a JSON object")

        exec_summary = _sanitize_text(parsed.get("executiveSummary"))
        if not exec_summary:
            raise ValueError("Missing executiveSummary")

        allowed_checks = set(facts["triggeredChecks"])
        raw_obs = parsed.get("groundedObservations")
        if not isinstance(raw_obs, list):
            raise ValueError("groundedObservations must be a list")

        verified_obs = []
        for item in raw_obs:
            if not isinstance(item, dict):
                continue
            chk = str(item.get("check") or "").strip().lower()
            finding = _sanitize_text(item.get("finding"))
            if chk in allowed_checks and finding:
                verified_obs.append({"check": chk, "finding": finding})

        raw_actions = parsed.get("recommendedAdjusterActions")
        if not isinstance(raw_actions, list) or not raw_actions:
            actions = [ACTION_BY_CHECK[c] for c in facts["triggeredChecks"] if c in ACTION_BY_CHECK][:3] or [
                "Proceed with standard adjuster verification."
            ]
        else:
            actions = [_sanitize_text(a) for a in raw_actions if _sanitize_text(a)][:3]

        return {
            "posture": facts["posture"],
            "triggeredChecks": facts["triggeredChecks"],
            "executiveSummary": exec_summary,
            "groundedObservations": verified_obs,
            "recommendedAdjusterActions": actions,
            "disclaimer": "Decision-support summary grounded strictly in automated screening outputs. Final claim determinations require human adjuster review.",
            "modelId": MODEL_ID,
            "generationMode": "bedrock-nova-lite-grounded",
            "generatedAt": generated_at,
        }
    except Exception as exc:
        print(f"[AggregateResults] Falling back to deterministic brief for {facts['claimId']}: {exc}")
        return deterministic_fallback_brief(facts, generated_at)


def lambda_handler(event, context):
    claim_id, user_id = event["claimId"], event["userId"]
    now = datetime.now(timezone.utc).isoformat()

    built = {"duplicate": build("duplicate", claim_id, event["duplicate"])}
    for check, payload in zip(CHECK_ORDER, event["checks"]):
        built[check] = build(check, claim_id, payload)
    results = {k: {"source": "system-pipeline", "submittedAt": now, "check": v}
               for k, v in built.items()}

    ground_truth = extract_ground_truth_facts(claim_id, built)
    ai_assessment = generate_grounded_brief(ground_truth, now)

    key = {"claimId": claim_id}
    condition = "attribute_exists(claimId) AND userId = :userId"
    table.update_item(
        Key=key,
        UpdateExpression="SET screeningResults = if_not_exists(screeningResults, :empty)",
        ConditionExpression=condition,
        ExpressionAttributeValues={":empty": {}, ":userId": user_id},
    )
    sets = [f"screeningResults.#{k} = :{k}" for k in results]
    sets += [
        "screeningStatus = :status",
        "screeningUpdatedAt = :now",
        "aiAssessment = :aiAssessment",
    ]
    values = {f":{k}": v for k, v in results.items()}
    values.update({
        ":status": "COMPLETE",
        ":now": now,
        ":userId": user_id,
        ":aiAssessment": ai_assessment,
    })
    table.update_item(
        Key=key,
        UpdateExpression="SET " + ", ".join(sets),
        ConditionExpression=condition,
        ExpressionAttributeNames={f"#{k}": k for k in results},
        ExpressionAttributeValues=values,
    )
    return {"claimId": claim_id, "stored": sorted(results), "posture": ai_assessment["posture"]}