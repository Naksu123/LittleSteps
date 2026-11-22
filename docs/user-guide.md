# LittleSteps — User & Operations Guide

Welcome to **LittleSteps**, a child-first, cloud-based Kindergarten Learning Management System built for learners aged **4–6**, their **parents/guardians**, **teachers**, and **school administrators**.

---

## 1. Portal Sign-In & Access Separation

LittleSteps separates public family sign-in from private school staff access:

| Portal | Route | Who Can Sign In | Protection |
| --- | --- | --- | --- |
| **Public Family Sign-In** | `/login` | Parents / Guardians | Email + password (`POST /api/auth/login` rejects teacher/admin accounts) |
| **Parent Registration** | `/register` | New Parents / Guardians | Creates a `parent` account with RA 10173 privacy consent |
| **Private Staff Gate** | `/staff-gate` | Teachers & School Admins | Unlinked route, blocked in `robots.txt` / `noindex`, requires Email + Password + private `STAFF_ACCESS_CODE` (`POST /api/auth/staff-login`) |
| **Kids Learning Mode** | `/kids` | Enrolled learners (via Parent/Teacher session) | Grown-Up Math Gate exit + zero external URLs |

> **Security Note:** No credentials or quick-fill buttons are shown on the public UI. Change `STAFF_ACCESS_CODE` and seeded passwords via `backend/.env` or AWS Secrets Manager before deploying.

For quick local setup instructions, see the [README](../README.md#quick-start).

---

## 2. Kids Learning Portal (`/kids`)

Designed exclusively for young learners aged 4–6 under parent or teacher supervision:

- **Launch Kids Mode**: From `/parent` or `/teacher`, click **Kids Mode** / **Kids Preview** in the sidebar, select a learner avatar, and explore safely.
- **Navigation Tabs** (`Home`, `Learn`, `Play`, `Stories`, `My Rewards`):
  - **Lessons (`/kids/lesson/[lessonId]`)**: Read-aloud Web Speech API narration, large illustrated slides, practice questions, and check-in quizzes with encouraging feedback (zero punitive scores).
  - **Educational Games (`/kids/play/[gameId]`)**: 16 playable kindergarten games with **12-question/item weekly-rotating question banks** across 4 accessible touch-friendly engines (*Choice*, *Sort*, *Memory*, *Puzzle*) and **Normal** (Age 4), **Medium** (Age 5), and **Hard** (Age 6) adaptive difficulty modes, awarding up to a healthy daily star cap.
  - **Digital Art Studio (`/kids/art`)**: Color starter preschool templates (sunflower, friendly butterfly, rocket, rainbow house) using Brush, Flood Fill, and Eraser tools, and save drawings to a private gallery.
- **Grown-Up Gate Exit**: Clicking **Grown-Up Exit** presents a dynamically generated arithmetic challenge (e.g., `What is 14 + 8?` or `6 × 4?`, with a button to request a new question) before returning to the Parent or Teacher dashboard. Zero ads, zero external links, and zero peer leaderboards appear in Kids Mode.

---

## 3. Parent / Guardian Portal (`/parent`)

1. **Overview (`/parent`)**: Switch between children, add a child profile (display name, birth year, age group, avatar, daily goal), edit child profiles, view Recharts weekly activity, assigned lessons/games, notifications, and start Kids Mode.
2. **Home Learning Hub (`/parent/home-learning`)**: Browse all **12 weekly themes** with *What Your Child Learns*, household material lists, conversation prompts, printable worksheets, completion toggles (`+2 ⭐` per activity), and **Parent Reflections** shared directly with your child's teacher.
3. **Weekly Reports (`/parent/reports`)**: View a personal 7-day comparison (this week vs. last week), strengths, gentle practice areas, teacher observations, teacher notes, and print or download a `.txt` summary.
4. **Goals & Settings (`/parent/settings`)**: Manage per-child daily minute & weekly lesson goals alongside family language (`en` / `fil`) and daily screen-time limits.

---

## 4. Teacher Portal (`/teacher`)

1. **Class Overview (`/teacher`)**: Filter students by assigned class, inspect individual learner progress & parent reflections, and post quick observations or parent feedback.
2. **Lessons & Content Studio (`/teacher/lessons`)**: Author multi-slide lessons with narration text, create new practice activities, upload validated classroom media (`PNG/JPEG/WEBP/MP3/WAV/PDF`), and publish or draft weekly themes.
3. **Assignments & Notes (`/teacher/assignments`)**: Assign lessons or games to a class or individual learner, record classroom observations, send direct parent messages, and post class/school announcements.
4. **Class Analytics (`/teacher/analytics`)**: View class performance charts, subject mastery averages, and gentle support indicators identifying students who benefit from extra encouragement.

---

## 5. School Admin Portal (`/admin`)

1. **Overview & Cloud Health (`/admin`)**: Monitor database connectivity, S3/local storage backend status, live entity counts, Recharts 7-day learning trends, and subject content distribution.
2. **Users & Roles (`/admin/users`)**: Provision new parent, teacher, or admin accounts, search/filter directories, activate/deactivate users (revoking active refresh tokens automatically), and manage multi-role assignments.
3. **Classes & Enrollment (`/admin/classes`)**: Create kindergarten cohorts, toggle active status, assign lead/assistant teachers, enroll or remove children, and browse the school-wide learner directory.
4. **Subjects, Content & Cloud Storage (`/admin/content`)**: Add or toggle learning modules, set lesson/theme `draft`/`published`/`archived` states, and inspect or remove uploaded media assets safely.
5. **Settings & Security Audit Logs (`/admin/settings`)**: Toggle `child_privacy_mode` and `max_upload_mb`, manage custom JSON settings, and filter non-PII security audit logs by action or resource type.
