# ClaimGuard AI frontend

React + Vite UI prototype for the ClaimGuard AI claim intake flow.

## Run locally
```bash
npm install
npm run dev
```

## Current behavior
- Claim details form with required-field validation.
- PDF/JPG/JPEG/PNG selection and drag/drop.
- Per-file 10 MB client-side size validation.
- Local file list and review step.
- Explicit demo-only submission message.

## Not connected yet
Files are **not** uploaded to AWS. The next integration step is a protected API Gateway + Lambda endpoint that issues short-lived presigned S3 URLs. Do not treat this prototype as a production upload service.
