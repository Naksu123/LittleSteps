# LittleSteps — Development Roadmap & MVP Scope

## 1. Eight-Phase Development Roadmap

| Phase | Name | Key Deliverables | Status |
| --- | --- | --- | --- |
| **Phase 1** | **Foundation** | Monorepo layout, Design System, 40-table SQLAlchemy schema, Alembic migrations, Docker Compose, AWS CloudFormation starter, idempotent seed script | **Completed in Foundation** |
| **Phase 2** | **Authentication & Roles** | Parent registration + RA 10173 privacy consent, JWT + rotating refresh tokens, RBAC middleware, Protected routes, Kids/Parent/Teacher/Admin portal shells | **Completed in Foundation** |
| **Phase 3** | **Kids Learning Portal** | Interactive lesson slide viewer with voice narration, server-side progress/star/streak & badge endpoints, digital Art Studio canvas with gallery, and all 10 playable games via 4 reusable engines | **Completed** |
| **Phase 4** | **Parent Portal** | Interactive 12-week Home Learning Hub (activity completion toggles + parent reflections), learning goals & screen-time controls, notifications center, and printable weekly learning reports | **Completed** |
| **Phase 5** | **Teacher Portal** | Lesson & weekly theme studio (draft/publish + resource uploads), activity assignments, classroom observations, parent feedback messaging, class announcements, and classroom analytics | **Completed** |
| **Phase 6** | **Admin Portal** | User & role CRUD, classroom & learner enrollment management, curriculum subject & content governance, cloud analytics & storage cleanup, platform settings editor, and filterable audit logs | **Completed** |
| **Phase 7** | **AWS Cloud Integration** | Secrets Manager hydration (`AWS_SECRETS_MANAGER_ARN`), production config guardrails, S3 SSE/health/presigned-upload hardening, CloudWatch JSON logging & `X-Request-ID`, RDS pooling & `/api/health/ready`, CloudFormation alarms + TLS bucket policy + conditional App Runner service, deploy scripts & GitHub Actions CI/CD | **Completed** |
| **Phase 8** | **QA & Final Delivery** | End-to-end cross-role lifecycle & penetration tests, frontend accessibility/child-safety QA tests, security hardening (refresh-token revocation on deactivation, child-update audit logs, safe artwork headers), User Guide, and QA/Security Delivery Report | **Completed** |

---

## 2. MVP Feature Checklist (Academic Cloud Project)

### Core MVP (Implemented & Required for Grading)
- Secure multi-role authentication (`parent`, `teacher`, `admin`) with `bcrypt` + JWT
- Child-safe **Kids Mode** launched by parent/teacher with Grown-Up Gate exit
- 6 preschool learning modules + 12 weekly themes seeded in the database
- Parent Dashboard showing real child progress, Recharts weekly summary, and **Home Learning Hub** ("Week 1: Colors Around Us" + "Color Hunt")
- Ability for parents to create child profiles (`POST /api/children`)
- Teacher Dashboard scoped strictly to assigned classes and enrolled students
- Admin Dashboard showing live DB/system health, user activation toggles, and audit logs
- AWS CloudFormation template + Amplify + App Runner configs

### Post-MVP Enhancements (Phases 3–6)
- Interactive drag-and-drop / tap-friendly engines for all 10 educational games
- Printable PDF weekly learning summaries for parents
- Teacher rich lesson builder with direct S3 signed media upload
- Digital canvas artwork saving to S3
