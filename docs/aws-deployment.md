# LittleSteps — AWS Cloud Deployment & Cost Guide

This guide defines a realistic, cost-effective AWS architecture tailored for a student Cloud Computing capstone project while preserving clean upgrade paths to full production scale.

---

## 1. MVP vs. Optional Production Upgrades

| Layer | MVP Student Architecture (Recommended) | Why Chosen for Student Cloud Demo | Optional Production Upgrade |
| --- | --- | --- | --- |
| **Frontend Hosting** | **AWS Amplify Hosting** | Native Next.js SSR/App Router support, Git-based CI/CD, free TLS certificate (`*.amplifyapp.com`), zero server management. | Custom domain via **Route 53** + **ACM** + **S3/CloudFront** |
| **Backend API Hosting** | **AWS App Runner** + **Amazon ECR** | Pulls the FastAPI Docker image from ECR, auto-provisions HTTPS, scales to 1 instance (`0.25 vCPU / 0.5 GB RAM`) or pauses when idle, and avoids NAT Gateway costs. | **Amazon ECS Fargate** behind an ALB inside private VPC subnets |
| **Database** | **Amazon RDS for PostgreSQL 16** (`db.t4g.micro`) | Managed encrypted storage (`gp3`), 7-day automated backups, `pool_pre_ping` connection pooling, and AWS Free Tier eligibility (750 hrs/month for 12 months on new accounts). | Multi-AZ RDS deployment + Read Replica |
| **Media Storage** | **Amazon S3** (Private Bucket) | Durable object storage (`AES256` + HTTPS-only bucket policy) for lesson resources and studio artworks served via IAM-authorized pre-signed URLs. | **Amazon CloudFront** Origin Access Control (OAC) CDN in front of S3 |
| **Secrets Management** | **AWS Secrets Manager** | Injects `DATABASE_URL`, `JWT_SECRET_KEY`, `S3_BUCKET_NAME`, and `CORS_ORIGINS` at startup via `AWS_SECRETS_MANAGER_ARN` — zero secrets in container images or Git. | Automatic secret rotation Lambda |
| **Monitoring & Logs** | **Amazon CloudWatch** | Structured single-line JSON HTTP access logs (`X-Request-ID`, status, latency) plus two Free-Tier RDS CloudWatch alarms (`RDSHighCPUAlarm`, `RDSLowStorageAlarm`). | CloudWatch Dashboards + SNS email alerts |
| **Security & IAM** | **AWS IAM** (Least Privilege) + Security Groups | App Runner instance role grants access only to LittleSteps' S3 bucket (`Get/Put/Delete/ListBucket`) and its single Secrets Manager ARN; production CORS & HSTS enforced on startup. | **AWS WAF** + **Amazon Cognito** federation |

---

## 2. Estimated Monthly Student Cost (ap-southeast-1 / us-east-1)

| Service | MVP Configuration | Free Tier Estimate | Post-Free Tier Estimate |
| --- | --- | --- | --- |
| AWS Amplify Hosting | Light student demo traffic (<5 GB/mo) | **\$0.00** | ~\$1.00 – \$3.00 |
| AWS App Runner | `0.25 vCPU / 0.5 GB RAM` (1 active instance, paused when not presenting) | ~\$5.00 – \$12.00 | ~\$12.00 – \$19.00 |
| Amazon ECR | < 500 MB FastAPI container image (`ScanOnPush` + keep last 5 tags) | **\$0.00** | ~\$0.05 |
| Amazon RDS PostgreSQL | `db.t4g.micro`, Single-AZ, 20 GB gp3 encrypted | **\$0.00** (12-mo Free Tier) | ~\$12.50 |
| Amazon S3 | < 5 GB media & worksheets (HTTPS-enforced private bucket) | **\$0.00** | ~\$0.15 |
| AWS Secrets Manager | 1 secret (`littlesteps/prod/app-config`) | \$0.40 | \$0.40 |
| Amazon CloudWatch | JSON logs + 2 RDS alarms | **\$0.00** | ~\$0.50 |
| **Total Estimated Monthly** | | **~\$5 – \$13 / month** | **~\$26 – \$35 / month** |

> **Cost-Saving Tip for Academic Demos:** Use `infrastructure/aws/deploy-mvp.ps1 -Action pause` (or `./infrastructure/aws/deploy-mvp.sh pause`) between grading/presentation days to pause App Runner and stop the RDS instance, cutting ongoing compute charges by over 80%.

---

## 3. Two-Pass Deployment Workflow

Because CloudFormation provisions the ECR repository and RDS database before the Docker image exists in ECR, LittleSteps supports a clean **two-pass deployment**:

### Pass 1 — Provision Core AWS Infrastructure
Using PowerShell (`infrastructure/aws/deploy-mvp.ps1`):
```powershell
.\infrastructure\aws\deploy-mvp.ps1 -Action deploy-infra `
  -DBPassword "<STRONG_12+_CHAR_PASSWORD>" `
  -JWTSecretKey "<RANDOM_64_CHAR_SECRET>" `
  -FrontendOrigin "https://<your-branch>.<app-id>.amplifyapp.com"
```
Or Bash (`infrastructure/aws/deploy-mvp.sh`):
```bash
DB_PASSWORD="<STRONG_12+_CHAR_PASSWORD>" \
JWT_SECRET_KEY="<RANDOM_64_CHAR_SECRET>" \
FRONTEND_ORIGIN="https://<your-branch>.<app-id>.amplifyapp.com" \
./infrastructure/aws/deploy-mvp.sh deploy-infra
```

### Pass 2 — Build & Push Backend Container, then Launch App Runner
```powershell
.\infrastructure\aws\deploy-mvp.ps1 -Action push-image
.\infrastructure\aws\deploy-mvp.ps1 -Action deploy-app `
  -DBPassword "<STRONG_12+_CHAR_PASSWORD>" `
  -JWTSecretKey "<RANDOM_64_CHAR_SECRET>" `
  -FrontendOrigin "https://<your-branch>.<app-id>.amplifyapp.com"
```
When `AppRunnerImageUri` is passed, CloudFormation automatically creates `AppRunnerService` wired to `AppSecrets` (`AWS_SECRETS_MANAGER_ARN`), `MediaBucket`, `AppRunnerECRAccessRole`, and `AppRunnerInstanceRole`. On boot, `backend/scripts/entrypoint.sh` runs `alembic upgrade head` automatically.

Verify API and cloud dependencies:
- Liveness check: `GET https://<apprunner-url>/api/health` -> `200 OK` (`database: "connected"`, `storage_status: "connected"`)
- Readiness probe: `GET https://<apprunner-url>/api/health/ready` -> `200 OK` (`status: "ready"`)

### Deploy Frontend on AWS Amplify Hosting
1. Connect your repository in **AWS Amplify Console** pointing build settings to `infrastructure/aws/amplify.yml` (`appRoot: frontend`).
2. Configure environment variable `NEXT_PUBLIC_API_URL=https://<apprunner-url>`.
3. Update `FrontendOrigin` to your final `https://*.amplifyapp.com` URL so strict production CORS matches.

---

## 4. CloudWatch Logs Insights & Operational Monitoring

Every FastAPI response returns an `X-Request-ID` header and writes a structured JSON line (excluding child PII, headers, and tokens) to stdout / CloudWatch Logs (`/littlesteps/<env>/backend`):

```sql
fields timestamp, level, method, path, status_code, duration_ms, request_id
| filter status_code >= 400 or duration_ms > 500
| sort timestamp desc
| limit 50
```

Two CloudWatch Alarms are provisioned automatically:
- `littlesteps-<env>-rds-high-cpu`: fires if RDS `CPUUtilization > 80%` across two 5-minute windows.
- `littlesteps-<env>-rds-low-storage`: fires if RDS `FreeStorageSpace < 2 GB`.

---

## 5. GitHub Actions CI/CD (`.github/workflows/ci-cd.yml`)

Every push or pull request to `main` automatically runs:
1. **`backend-ci`**: Alembic migrations + SQLite demo seed + `pytest -v`.
2. **`frontend-ci`**: Jest unit tests + TypeScript typecheck + ESLint + production Next.js build.
3. **`infra-validate`**: Parses `cloudformation-mvp.yaml`, `apprunner.yaml`, `amplify.yml`, and `docker-compose.yml`.
4. **`deploy-backend`** *(runs on `main` pushes when configured)*: Add GitHub repository secret `AWS_DEPLOY_ROLE_ARN` (IAM OIDC role with ECR push + `apprunner:StartDeployment`) and variables `AWS_REGION`, `ECR_REPOSITORY`, `APPRUNNER_SERVICE_ARN`.

