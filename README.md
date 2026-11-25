# ClaimGuard AI

**AI-Powered Insurance Claims Fraud Detection System**

Multi-layered fraud detection combining rule-based validation, statistical analysis, and AI-powered forensics. Built with AWS serverless architecture for scalability and cost-efficiency.

![Dark Theme UI](https://img.shields.io/badge/Theme-Dark-black?style=flat-square)
![AWS](https://img.shields.io/badge/AWS-Serverless-orange?style=flat-square)
![React](https://img.shields.io/badge/React-19.3-blue?style=flat-square)
![Python](https://img.shields.io/badge/Python-3.14-green?style=flat-square)

---

## 🎯 Features

### 🔍 **6 Screening Checks**
1. **Policy Validation** - Rule-based verification against policy database
2. **Duplicate Detection** - Perceptual hashing + claim comparison
3. **Outlier Detection** - Statistical analysis using MAD (Median Absolute Deviation)
4. **Image Forensics** - AI-generation detection, metadata analysis, compression artifacts
5. **Evidence Relevance** - Bedrock-powered document-incident matching
6. **Document & Image Consistency** - Compares extracted document fields and checks uploaded photos for visual consistency

### 📊 **Risk Scoring**
- Weighted algorithm: 0-100 scale
- Color-coded visualization (Low/Medium/High)
- Real-time calculation on results page

### 📈 **Analytics Dashboard**
- Interactive charts (Recharts)
- Outcome distribution (Pie chart)
- Check performance (Bar chart)
- Session statistics

### 🎨 **Professional UI**
- Dark theme optimized for extended use
- Toast notifications for feedback
- Skeleton loaders for smooth UX
- Responsive architecture diagram

---

## 🏗️ Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   React     │─────▶│ API Gateway  │─────▶│   Lambda    │
│  Frontend   │      │              │      │  Functions  │
└─────────────┘      └──────────────┘      └─────────────┘
                                                   │
                           ┌───────────────────────┼────────────┐
                           │                       │            │
                      ┌────▼────┐          ┌──────▼─────┐  ┌──▼───┐
                      │DynamoDB │          │  Bedrock   │  │  S3  │
                      │ Tables  │          │Nova Lite   │  │Bucket│
                      └─────────┘          └────────────┘  └──────┘
```

### **Tech Stack**
- **Frontend**: React 19 + Vite, Recharts, Lucide Icons
- **Backend**: AWS Lambda (Python 3.14), SAM
- **Storage**: S3 (documents), DynamoDB (claims/policies)
- **AI**: Amazon Bedrock (Nova Lite), Smaug (image forensics)
- **Orchestration**: Frontend-driven (demo); Step Functions (production-ready)

---

## 🚀 Quick Start

### **Prerequisites**
- Node.js 18+
- Python 3.14+
- AWS SAM CLI
- AWS Account with credits

### **Backend Deployment**
```bash
cd claimguard-ai
sam build --use-container
sam deploy --guided
```

### **Frontend Setup**
```bash
cd frontend
npm install
npm run dev
```

Copy `frontend/.env.example` to `frontend/.env.local` and fill in the values from the SAM outputs. Do not commit `.env.local`.

### **Cognito authentication**
- Deploy the SAM stack with a globally unique `CognitoDomainPrefix`. The default callback/logout origin is `http://localhost:5173`.
- For a deployed frontend, pass its exact origin as the `FrontendOrigin` parameter and add the same origin to the frontend redirect/logout environment values before rebuilding and redeploying.
- Run `bash scripts/seed_demo_users.sh <user-pool-id>` and enter separate permanent passwords when prompted. The script creates the adjuster and claimant users without sending invitations.
- Existing operational claims do not have an owner. Backfill `userId` only where ownership is known before claimants can see those records; claims without an owner remain adjuster-only.
- Screening outputs are persisted as an authenticated browser-submitted snapshot. They are review signals, not an authoritative or tamper-proof decision; adjusters must verify source evidence.

---

## 💰 Cost Analysis

### **Per Screening (~6 checks)**
| Service | Cost | Notes |
|---------|------|-------|
| Bedrock Nova Lite | $0.02 | Document extraction + evidence validation |
| Image Forensics Lambda | $0.08 | Container Lambda, 3GB/300s |
| Other Lambdas | $0.01 | Policy, duplicate, outlier |
| **Total** | **~$0.11** | Per full screening |

### **Free Tier Coverage**
- Lambda: 1M requests/month
- DynamoDB: 25GB + 200M requests
- S3: 5GB storage
- **Expected jury demo cost**: $5-10

---

## 📊 Risk Score Calculation

```python
score = 0
if policy_fails: score += 40
if duplicate_found: score += 30
if outlier_detected: score += 25
if image_forensics_flagged: score += 35
if evidence_mismatch: score += 30
if cross_doc_inconsistent: score += 20

return min(score, 100)
```

**Thresholds:**
- 0-30: Low Risk (Green)
- 31-60: Review Recommended (Yellow)
- 61-100: High Risk (Red)

---

## 🧪 Test Scenarios

### **Scenario 1: Legitimate Claim**
```json
{
  "policyNumber": "POL-REF-001",
  "claimType": "Auto",
  "incidentDate": "2024-11-15",
  "claimAmountINR": 45000,
  "documents": ["accident_photo.jpg", "police_report.pdf"]
}
```
**Expected**: All checks pass, Risk Score: 0

### **Scenario 2: Duplicate Detected**
```json
{
  "policyNumber": "POL-REF-001",
  "claimType": "Auto",
  "incidentDate": "2024-11-15",
  "claimAmountINR": 45000,
  "documents": ["damage_photo.jpg"]
}
```
**Expected**: Duplicate flag, Risk Score: 30

### **Scenario 3: High-Risk Fraud**
```json
{
  "policyNumber": "INVALID",
  "claimType": "Auto",
  "incidentDate": "2024-11-15",
  "claimAmountINR": 500000,
  "documents": ["ai_generated.jpg", "mismatched_doc.pdf"]
}
```
**Expected**: Multiple flags, Risk Score: 85+

---

## 📸 Screenshots

### Risk Score Meter
Professional circular gauge with color-coded risk levels.

### Analytics Dashboard
Interactive Recharts visualizations showing detection patterns.

### Architecture Diagram
SVG system flow with AWS services highlighted.

---

## 🎬 Demo Tips

1. **Pre-warm Lambdas**: Submit a test claim 5 min before presentation
2. **Use Synthetic Data**: Avoid real PII
3. **Highlight Features**:
   - Real-time risk scoring
   - Explainable AI (every flag has a reason)
   - Cost efficiency vs. production systems
4. **Backup Plan**: Screen recording ready

---

## 🔐 Security Notes

- CORS limited to `localhost:5173` (update for production)
- S3 presigned URLs (short-lived, 10min expiry)
- Private document storage
- No public buckets

---

## 📝 Future Enhancements

- [ ] Step Functions orchestration
- [ ] CloudWatch dashboards
- [ ] SNS notifications for high-risk claims
- [ ] Multi-region deployment
- [ ] Batch processing mode

---

## 🤝 Contributing

This is a final semester project. Not accepting contributions, but feedback is welcome!

---

## 📄 License

Educational use only. Not for production deployment.

---

**Built with ❤️ for Claims Fraud Detection**
