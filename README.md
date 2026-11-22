# LittleSteps — Cloud-Based Kindergarten Learning Management System

LittleSteps is a full-stack, child-first Cloud Computing Learning Management System designed for kindergarten learners (**ages 4–6**), their **parents/guardians**, **teachers**, and **school administrators**, built for cost-effective deployment on **Amazon Web Services (AWS)**.

---

## Key Capabilities (All 8 Phases Implemented)

- **Role-Based Access Control (RBAC)**: Distinct portals for **Kids Mode** (parent/teacher-controlled safe learner space), **Parents/Guardians**, **Teachers**, and **School Administrators**.
- **Phase 3 — Kids Learning Portal**:
  - **Interactive Lesson Viewer**: Voice-narrated slides, practice activity, and mini check-in quizzes with server-computed stars, local-timezone daily streaks, and automatic milestone badges.
  - **10 Playable Educational Games**: Driven by database `config_json` ([content-schemas.md](docs/content-schemas.md)) across 4 accessible, tap-friendly engines (`choice`, `sort`, `memory`, `puzzle`) with encouraging feedback and optional WebAudio chimes.
  - **Digital Art Studio**: HTML5 coloring canvas with Brush, scanline Flood Fill, Eraser, 4 starter templates, and authenticated PNG gallery storage (`POST /api/children/{child_id}/artworks`).
- **Phase 4 — Parent / Guardian Portal**:
  - **12-Week Home Learning Hub**: Screen-free household guides, materials, conversation prompts, completion toggles (`+2 ⭐`), and Parent Reflections shared with teachers.
  - **Goals, Screen Time & Notifications**: Per-child learning goals synced to daily targets, family screen-time limits (`ParentProfile`), and an interactive read/unread notification center.
  - **Printable Weekly Reports**: Personal progress comparisons (this week vs. last week, zero peer rankings), strengths, teacher observations/feedback, and `.txt` / print export.
- **Phase 5 — Teacher Portal**:
  - **Curriculum & Media Studio**: Create/edit/publish lessons with story slides, attach practice questions, upload validated media resources (PNG/JPEG/WEBP/MP3/WAV/PDF), and manage weekly themes.
  - **Classroom Operations & Analytics**: Assign lessons/games to classes or learners, record observations, send parent feedback, publish announcements, inspect student progress, and view Recharts classroom analytics.
- **Phase 6 — Admin Portal**:
  - **Overview & Cloud Analytics (`/admin`)**: Real-time DB/storage health check, user role & 7-day activity Recharts visualizations, subject content distribution, and quick governance links.
  - **Users & Roles (`/admin/users`)**: Create accounts, search/filter by role or status, toggle active access, and update multi-role assignments with self-protection guards.
  - **Classes & Enrollment (`/admin/classes`)**: Create kindergarten cohorts, assign teachers, enroll/unenroll learners, and inspect the school-wide learner directory.
  - **Subjects, Content & Storage (`/admin/content`)**: Manage curriculum subjects, govern draft/published/archived lessons & weekly themes, and audit or remove uploaded S3/local media and studio artworks safely.
  - **Settings & Security Audit Trail (`/admin/settings`)**: Interactive platform settings editor (`child_privacy_mode`, `max_upload_mb`, custom JSON configs) and filterable immutable audit logs.
- **40-Table Normalized Database Schema**: Covering users, learner profiles, classes, curriculum subjects, 12 weekly themes, lessons, 10 game templates, quizzes, progress tracking, parent Home Learning Hub reflections, teacher observations, notifications, and security audit logs.
- **FastAPI REST API**: Pydantic v2 validation, SQLAlchemy 2.0 ORM, Alembic migrations, `bcrypt` password hashing, JWT access + rotating refresh tokens, security headers, and rate limiting.
- **Next.js App Router Frontend**: Tailwind CSS v4 preschool-meets-SaaS design system (`Fredoka` + `Nunito`), animated Pip the Owl mascot, Web Speech API narration, Recharts progress analytics, and React Hook Form + Zod validation.
- **AWS Cloud-Ready Infrastructure (Phase 7 Hardened)**:
  - **Runtime Cloud Wiring**: AWS Secrets Manager hydration (`backend/app/core/secrets.py`), production startup guardrails (`validate_production_config`), RDS connection pooling, S3 `AES256` encryption + bucket health checks (`head_bucket`), `/api/health/ready` probe, HSTS security header, and structured CloudWatch JSON request logging (`X-Request-ID`).
  - **IaC, Containers & CI/CD**: Two-pass `infrastructure/aws/cloudformation-mvp.yaml` (Private HTTPS-only S3 bucket, ECR, RDS PostgreSQL 16 + CloudWatch alarms, Secrets Manager, least-privilege IAM, optional App Runner service), hardened `Dockerfile`s with `HEALTHCHECK` + LF `entrypoint.sh`, `deploy-mvp.ps1` / `deploy-mvp.sh` cost-control scripts, and `.github/workflows/ci-cd.yml`.

---

## Project Structure

```text
Cloud Computing LMS/
├── backend/                # FastAPI REST API, SQLAlchemy models, Alembic, pytest
├── frontend/               # Next.js 15 App Router, Tailwind v4, Jest
├── infrastructure/aws/     # CloudFormation MVP template, App Runner & Amplify configs
├── docs/                   # Architecture, AWS Guide, ERD, Roadmap, Design System
├── docker-compose.yml      # PostgreSQL 16 + FastAPI + Next.js local stack
└── .env.example            # Environment configuration template
```

---

## Quick Start

### Option A — Docker Compose (PostgreSQL 16 + FastAPI + Next.js)

```bash
cp .env.example .env
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API & OpenAPI Docs: http://localhost:8000/docs

### Option B — Local Development without Docker (`uv` + `npm`)

When Docker or PostgreSQL is not installed locally, the backend defaults automatically to `sqlite:///./littlesteps_dev.db` with foreign-key enforcement enabled, using the exact same SQLAlchemy models and Alembic migrations as PostgreSQL 16.

**1. Backend (from `backend/`):**

```powershell
cd backend
uv venv --python 3.12
uv pip install -r requirements.txt
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m app.db.seed
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

**2. Frontend (from `frontend/`):**

```powershell
cd frontend
npm install
npm run dev
```

---

## Demo Accounts (Seeded Data)

All seeded accounts share the password **`LittleSteps2026!`**:

| Role | Email | Portal | Notes |
| --- | --- | --- | --- |
| **Parent** | `parent@littlesteps.edu` | `/parent` & `/kids` | Manages **Mia** (age 5) & **Leo** (age 6) |
| **Parent 2** | `parent2@littlesteps.edu` | `/parent` & `/kids` | Manages **Sofia** (age 4) — isolated from Parent 1 |
| **Teacher** | `teacher@littlesteps.edu` | `/teacher` & `/kids` | Assigned to Sunshine Kinders & Rainbow Explorers |
| **Admin** | `admin@littlesteps.edu` | `/admin` | Principal Elena Santos — full system governance |

---

## Running Automated Tests

**Backend (`pytest`):**
```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -v
```

**Frontend (`Jest` & Next.js production build):**
```powershell
cd frontend
npm test
npm run build
```

---

## Documentation

- [System Architecture](docs/architecture.md)
- [User & Operations Guide](docs/user-guide.md)
- [QA & Security Verification Report](docs/qa-security-report.md)
- [AWS Deployment & Cost Guide](docs/aws-deployment.md)
- [Database ERD & Schema Dictionary](docs/database-erd.md)
- [Development Roadmap & MVP Scope](docs/roadmap-and-mvp.md)
- [UI/UX Design System](docs/design-system.md)
- [Content JSON Schemas](docs/content-schemas.md)
