# ClaimGuard AI — Synthetic Reference Dataset

All records in this package are fictional, generated for development and testing. They are not real policyholders, customers, providers, or claim records.

## Contents
- `reference_claims.json` / `.csv`: 32 synthetic claims across Auto, Property, Health, and Travel.
- `reference_policies.json` / `.csv`: 32 synthetic policy records associated with the reference claims.
- `reference_documents.json`: document metadata and expected fields for claim-form and invoice examples. These entries describe fixtures; they are not actual PDF files.
- `test_cases.json`: 12 scenarios with intended checks and expected review flags.
- `test_fixtures.json`: baseline claim data plus explicit injected anomaly details for test harnesses.

## Important design notes
- The data is intentionally small for an initial local test dataset. Expand and validate distributions before treating them as representative.
- Do not use these records to make real insurance decisions or to claim model accuracy.
- A flag is an investigation signal, not proof of fraud.
- The `reference_documents.json` S3 keys are proposed paths; no objects have been uploaded to S3 by creating this package.
- Amount-outlier thresholds should be computed by claim type and relevant context, not globally across all claim types.
- Some scenarios (for example, duplicate document checksums and image-tampering checks) require additional fixture files or computed hashes before an executable test can be run.
- Keep `incoming/` submissions separate from `reference/` data.
