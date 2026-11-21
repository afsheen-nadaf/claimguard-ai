# ClaimGuard AI - Test Scenarios

**For jury presentation and QA testing**

---

## 🧪 Test Claim Profiles

### **Scenario 1: Clean Claim (Risk Score: 0-10)**

#### Profile
```json
{
  "policyNumber": "POL-REF-001",
  "claimType": "Auto",
  "incidentDate": "2024-11-10",
  "claimAmountINR": 45000,
  "location": "Mumbai, Maharashtra",
  "description": "Minor rear-end collision at traffic signal"
}
```

#### Documents
- `real_damage_photo.jpg` (Real photo with valid EXIF metadata)
- `police_report.pdf` (Matching details)

#### Expected Results
| Check | Status | Notes |
|-------|--------|-------|
| Policy Validation | ✅ PASS | Valid policy, active coverage |
| Duplicate Detection | ✅ PASS | No prior match |
| Outlier Detection | ✅ PASS | ₹45K within range (median: ₹50K) |
| Image Forensics | ✅ PASS | Real photo, valid metadata |
| Evidence Relevance | ✅ PASS | Documents match incident |
| Consistency | ✅ PASS | All fields align |

**Risk Score:** 0  
**Recommendation:** Fast-track approval

---

### **Scenario 2: Moderate Risk (Risk Score: 30-50)**

#### Profile
```json
{
  "policyNumber": "POL-REF-002",
  "claimType": "Property",
  "incidentDate": "2024-10-15",
  "claimAmountINR": 180000,
  "location": "Delhi",
  "description": "Water damage from pipe burst"
}
```

#### Documents
- `damage_photo.jpg` (Duplicate of earlier claim image)
- `invoice.pdf` (Legitimate)

#### Expected Results
| Check | Status | Notes |
|-------|--------|-------|
| Policy Validation | ✅ PASS | Valid policy |
| Duplicate Detection | 🚨 REVIEW | Image match: 92% similarity |
| Outlier Detection | ✅ PASS | Within range |
| Image Forensics | ✅ PASS | Real photo |
| Evidence Relevance | ✅ PASS | Relevant |
| Consistency | ✅ PASS | Consistent |

**Risk Score:** 30  
**Recommendation:** Investigate duplicate image match

---

### **Scenario 3: High Risk (Risk Score: 70-90)**

#### Profile
```json
{
  "policyNumber": "INVALID-999",
  "claimType": "Auto",
  "incidentDate": "2024-11-20",
  "claimAmountINR": 500000,
  "location": "Bangalore",
  "description": "Total vehicle loss in accident"
}
```

#### Documents
- `ai_generated_damage.jpg` (DALL-E/Midjourney generated)
- `fake_invoice.pdf` (Mismatched vendor details)

#### Expected Results
| Check | Status | Notes |
|-------|--------|-------|
| Policy Validation | 🚨 FAIL | Policy not found in database |
| Duplicate Detection | ⚠️ INCONCLUSIVE | First submission (new) |
| Outlier Detection | 🚨 REVIEW | 10x median (robust Z-score: 4.2) |
| Image Forensics | 🚨 REVIEW | AI-generated: 89% confidence |
| Evidence Relevance | 🚨 REVIEW | Vendor mismatch with claim type |
| Consistency | 🚨 REVIEW | Amount mismatch across docs |

**Risk Score:** 85  
**Recommendation:** Priority analyst review, possible fraud

---

## 📊 Testing Checklist

### **Pre-Demo Setup**
- [ ] Populate DynamoDB with reference claims
- [ ] Upload test images to S3 (or prepare local files)
- [ ] Test all 6 Lambda functions individually
- [ ] Warm up container Lambda (image forensics)
- [ ] Verify Bedrock access

### **During Demo**
- [ ] Submit Scenario 1 (clean claim) first
- [ ] Show risk score = 0, all green
- [ ] Explain each check result
- [ ] Submit Scenario 3 (high risk)
- [ ] Show risk score = 85, multiple flags
- [ ] Navigate to Analytics to show patterns

### **Edge Cases to Test**
- [ ] 0 documents uploaded → Should block submission
- [ ] Large file (>10MB) → Should reject
- [ ] Invalid date (future) → Frontend validation
- [ ] Negative amount → Should reject
- [ ] Network timeout → Error handling + retry option

---

## 🎬 Demo Flow Recommendation

**Order:** Clean → Moderate → High Risk

### Timing
- Scenario 1: 3 minutes (establish baseline)
- Scenario 3: 5 minutes (show detection capabilities)
- Analytics: 2 minutes (pattern insights)

### Key Talking Points
1. **Explainability:** "Every flag shows WHY it was triggered"
2. **No Black Box:** "Human analyst sees all evidence"
3. **Efficiency:** "Screens in 30 seconds vs. 30 minutes manual"
4. **Scalability:** "Handles 100 concurrent claims with auto-scaling"

---

## 🔧 Troubleshooting Test Cases

### **If Policy Validation Fails on Clean Claim:**
- Check: DynamoDB `ClaimGuardReferencePolicies` has POL-REF-001
- Fix: Run `scripts/seed_reference_data.py`

### **If Image Forensics Times Out:**
- Check: Container Lambda cold start (can take 20-30s first time)
- Fix: Pre-warm by submitting a test claim 5 min before demo

### **If Duplicate Detection Misses Match:**
- Check: Image hash stored in `ClaimGuardImageHashes` table
- Note: Requires previous claim with same/similar image

### **If Bedrock Returns "Throttled":**
- Check: AWS Bedrock quotas for your region
- Fix: Space out submissions by 10 seconds, or request quota increase

---

## 📈 Expected Cost per Scenario

| Scenario | Checks Run | Bedrock Calls | Lambda Time | Cost |
|----------|------------|---------------|-------------|------|
| Clean | 6 | 2 | ~5s | $0.10 |
| Moderate | 6 | 2 | ~5s | $0.10 |
| High Risk | 6 | 2 | ~5s | $0.10 |

**Total Test Run:** ~$0.30  
**10 Rehearsals:** ~$3.00  
**Jury Demo (5 claims):** ~$0.50

---

## ✅ Success Criteria

### **Jury will be impressed if:**
- [ ] All checks complete within 30 seconds
- [ ] Risk score accurately reflects fraud indicators
- [ ] UI is responsive and professional (dark theme)
- [ ] Explanations are clear and non-technical
- [ ] Analytics show meaningful patterns
- [ ] No crashes or timeouts during demo

### **Bonus Points:**
- [ ] Show architecture diagram and explain design choices
- [ ] Discuss Step Functions trade-off proactively
- [ ] Mention cost optimization strategies
- [ ] Demo retry functionality if a check fails

---

**🎓 Good luck with your presentation!**
