# ClaimGuard AI - Jury Presentation Script

**Duration:** 10-15 minutes  
**Goal:** Demonstrate technical depth + business value + visual polish

---

## 🎯 Opening (1 min)

**"ClaimGuard AI is an intelligent fraud detection system for insurance claims, built entirely on AWS serverless architecture."**

### Key Stats to Mention:
- 6 automated screening checks
- Real-time risk scoring (0-100 scale)
- $0.11 per screening vs. $10+ manual review time
- Scales automatically, pay only for use

---

## 🏗️ Architecture Overview (2 min)

**Navigate to:** How It Works page

### Points to Cover:
1. **Frontend Orchestration** *(Explain this proactively)*
   - "I chose frontend orchestration over Step Functions for this demo"
   - **Why?** Cost ($0 vs. $0.025 per 1K transitions), flexibility, real-time UI feedback
   - **Production?** "Would migrate to Step Functions for enterprise scale"

2. **AWS Services Used**
   - Lambda functions (6 independent checks)
   - DynamoDB (reference data + operational claims)
   - S3 (secure document storage with presigned URLs)
   - Amazon Bedrock (Nova Lite for document extraction + evidence validation)
   - Container Lambda (3GB for Smaug ML model)

3. **Show Architecture Diagram**
   - Point out data flow
   - Highlight parallel execution
   - Mention: "All Lambdas have proper IAM policies, tracing enabled"

---

## 💼 Business Value (2 min)

**Navigate to:** Overview page (Hero section)

### Highlight:
- **Time Savings:** Minutes vs. hours for initial screening
- **Explainable AI:** Every flag shows reasoning (not a black box)
- **Human-in-the-Loop:** System recommends, analyst decides
- **Cost Efficiency:** Serverless = no idle infrastructure costs

### Key Phrase:
*"This doesn't replace analysts—it makes them more effective by surfacing only suspicious claims."*

---

## 🎬 Live Demo (5-6 min)

### **Demo Claim 1: Legitimate** *(2 min)*

**Navigate to:** New Claim

```
Policy: POL-REF-001
Type: Auto
Date: 2024-11-10
Amount: ₹45,000
Documents: accident_photo.jpg, police_report.pdf
```

**Walk Through:**
1. "Notice the wizard interface—clean, intuitive"
2. Submit → Show toast notification
3. Navigate to results
4. **Point out Risk Score: 0** (green, low risk)
5. Expand each check result:
   - Policy: Validated ✅
   - Duplicate: No match ✅
   - Outlier: Within range (show statistical bounds)
   - Forensics: Real photo metadata ✅
   - Evidence: Relevant ✅
   - Consistency: All fields match ✅

**Key Message:** "All checks passed. Analyst can fast-track this claim."

---

### **Demo Claim 2: High Risk** *(3 min)*

**Navigate to:** New Claim

```
Policy: INVALID-123
Type: Auto
Date: 2024-11-15
Amount: ₹500,000
Documents: ai_generated.jpg, mismatched_invoice.pdf
```

**Walk Through:**
1. Submit → Results page
2. **Point out Risk Score: 85** (red, high risk)
3. Show flags:
   - Policy: NOT FOUND 🚨
   - Duplicate: (if synthetic data allows)
   - Outlier: 3.5x median (show chart) 🚨
   - Forensics: AI-generated image detected 🚨
   - Evidence: Document mismatch 🚨
   - Consistency: Field discrepancies 🚨

**Key Message:** "Multiple indicators flagged. Requires immediate analyst review."

---

## 📊 Analytics Dashboard (2 min)

**Navigate to:** Analytics page

### Show:
1. **Metrics Cards**
   - Total screened
   - Flagged for review %
   - Average risk score

2. **Pie Chart:** Outcome distribution
3. **Bar Chart:** Check-by-check performance

**Key Point:** "Real-time insights into fraud detection patterns."

---

## 🔬 Technical Deep Dive (If Time / Q&A)

### **Image Forensics** *(Most impressive)*
- Smaug model in container Lambda (explain why container: model size)
- Detects: AI-generation, compression artifacts, metadata tampering
- Show: Confidence scores + detailed breakdown

### **Bedrock Integration**
- Nova Lite model (cost-effective for this use case)
- Document extraction + evidence relevance
- Explain: "Vision + language understanding in one model"

### **DynamoDB Design**
- Reference claims table with GSI (PolicyNumber + IncidentDate)
- Image hashes table for perceptual matching
- Show: Query patterns optimized for PAY_PER_REQUEST

---

## 💡 Design Decisions Q&A Prep

### **Why no Step Functions?**
*"For a demo with 10-20 claims, frontend orchestration is more cost-effective ($0 vs. $2-5) and provides better real-time feedback. Production scale would use Step Functions for retry logic, parallel aggregation, and audit trails."*

### **Why Bedrock Nova Lite?**
*"Cost-performance sweet spot. Sonnet would be 3x more accurate but 10x more expensive. For this prototype, Lite handles 90% of cases well."*

### **Scaling concerns?**
*"DynamoDB auto-scales, Lambda concurrency handles spikes. Tested up to 100 concurrent claims. Would add SQS queue for production batch processing."*

### **Security?**
*"S3 presigned URLs (10min expiry), private buckets, CORS restrictions, IAM least-privilege policies. Production would add: KMS encryption, VPC endpoints, Cognito auth."*

---

## 🎯 Closing (1 min)

### Summary:
1. **Technical Achievement:** Full-stack serverless on AWS
2. **Business Value:** Faster screening, explainable results, cost-efficient
3. **Production-Ready Path:** Step Functions, monitoring, auth

### Final Line:
*"ClaimGuard AI demonstrates how modern cloud architecture can solve real-world fraud detection at scale, while keeping costs predictable and results transparent."*

---

## 🚨 Troubleshooting (If Something Breaks)

### **Lambda Cold Start (>5s delay)**
- **Explain:** "This is a Lambda cold start—first invocation loads the container. Production would use provisioned concurrency."

### **Bedrock Timeout**
- **Explain:** "Bedrock queues requests during high load. Production would use async invocations with SNS notifications."

### **Network Error**
- **Have screen recording ready**
- Switch to recording: "Let me show you via this pre-recorded demo..."

---

## ✅ Pre-Demo Checklist

- [ ] Warm up Lambdas (run a test claim 5 min before)
- [ ] Pre-populate DynamoDB with reference data
- [ ] Clear browser cache/localStorage
- [ ] Test all 6 checks work
- [ ] Screen recording backup ready
- [ ] Slide deck with architecture diagram (optional backup)
- [ ] Check AWS credits balance ($180 → should have $170+ left)

---

**Good luck! 🎓**
