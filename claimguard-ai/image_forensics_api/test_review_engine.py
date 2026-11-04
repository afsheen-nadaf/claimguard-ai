from review_engine import generate_review

# Test 1: High Smaug score
high_score = generate_review({
    "aiGeneration": {
        "status": "COMPLETED",
        "result": {"aiGeneratedScore": 0.9916}
    }
})

assert high_score["required"] is True
print("TEST 1 PASSED: High score triggers review.")

# Test 2: Low Smaug score
low_score = generate_review({
    "aiGeneration": {
        "status": "COMPLETED",
        "result": {"aiGeneratedScore": 0.0873}
    }
})

assert low_score["required"] is False
print("TEST 2 PASSED: Low score does not trigger review.")

# Test 3: Smaug unavailable
unavailable = generate_review({
    "aiGeneration": {"status": "ERROR"}
})

assert unavailable["required"] is False
assert len(unavailable["coverageWarnings"]) > 0
print("TEST 3 PASSED: Unavailable analysis produces a coverage warning.")

print("\nAll review engine tests passed!")