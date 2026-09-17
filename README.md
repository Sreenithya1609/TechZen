# FlashLearn

FlashLearn is a Flask and SQLite flashcard learning platform with separate teacher and student workflows. Users can create or join classrooms, create flashcard decks, practice cards, view progress, and maintain a daily study streak.

## Clone From GitHub

```bash
git clone https://github.com/Ponvarsha/Techzen.git
cd Techzen
```

## Requirements

- Python 3.8 or newer
- Git

## Setup

### Windows PowerShell

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Copy `.env.example` to `.env`, replace the Google OAuth placeholders with values from Google Cloud Console, and restart Flask after changing `.env`.

Configure Gemini before starting the server. In PowerShell, set the replacement API key in the current terminal session:

```powershell
$env:GEMINI_API_KEY = "your-gemini-api-key"
$env:GEMINI_MODEL = "gemini-2.5-flash"

# Optional production email delivery
$env:SMTP_HOST = "smtp.example.com"
$env:SMTP_PORT = "587"
$env:SMTP_USERNAME = "your-smtp-user"
$env:SMTP_PASSWORD = "your-smtp-password"
$env:SMTP_FROM = "FlashLearn <no-reply@example.com>"

# Optional Google OAuth
$env:GOOGLE_CLIENT_ID = "your-google-client-id"
$env:GOOGLE_CLIENT_SECRET = "your-google-client-secret"
```

The key is used only by the Flask backend and is never sent to the browser. Do not commit it to the repository.

If PowerShell blocks virtual-environment activation, run the commands from Command Prompt instead:

```bat
.venv\Scripts\activate.bat
```

### macOS/Linux

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

The project creates and seeds `flashlearn.db` automatically when the application starts. You do not need to create the database manually.

## Run the Application

With the virtual environment activated:

```bash
python app.py
```

Open the application in a browser at:

```text
http://localhost:5000
```

The Flask server listens on all interfaces at port `5000` and runs with debug mode enabled.

## Test the Backend

Run the included backend tests from the project root:

```bash
python -m unittest verify_backend.py -v
```

The tests use a temporary SQLite database and remove it when they finish.

## Seeded Accounts

The initial database includes these default accounts:

| Role | Email | Password | Teacher Status |
|---|---|---|---|
| System Admin | `revathi@gmail.com` | `Techzen_123` | `approved` |
| Student | `student@gmail.com` | `Password123!` | `none` |

### Role Architecture & Teacher Approval Workflow

TechZen implements a 3-tier Role-Based Access Control (RBAC) model:
1. **Admin (`admin`)**: Full system access. Reviews and approves/rejects teacher access requests, manages platform classrooms, and inspects academic progress reports.
2. **Teacher (`teacher`)**: Verified faculty. Can create classrooms, author curriculum decks, delete own classrooms and decks, view enrolled student analytics, and generate AI flashcards from topics.
3. **Student (`student`)**: Default role for all public registrations. Can enroll in classrooms via access codes, study flashcards, author personal custom decks, track study streaks, and apply to become a teacher.

#### Public Registration Rule
Public registrations via `/api/auth/register` validate input types, name, email format, password complexity, and role. If a user registers with `role = 'teacher'`, the account is created with `role = 'student'` and `teacher_status = 'pending'`, automatically routing the applicant to the Admin review portal. Public registrations cannot directly escalate to `admin` or unapproved `teacher`.

#### Teacher Approval Flow
1. An applicant selects **Teacher** during registration (or submits via `POST /api/teacher/request`). Their status becomes `pending`.
2. The administrator navigates to the **Administration > Teacher Requests** portal (`GET /api/admin/teacher-requests`).
3. The administrator reviews applicant details and either:
   - **Approves** (`POST /api/admin/teacher-requests/<user_id>/approve`): Sets `role = 'teacher'` and `teacher_status = 'approved'`. The user instantly gains instructor privileges upon login/refresh.
   - **Rejects** (`POST /api/admin/teacher-requests/<user_id>/reject`): Sets `role = 'student'` and `teacher_status = 'rejected'`. The user is notified on their dashboard with the option to re-apply.

## Main Features

### Administrator

- View and filter instructor access applications (`pending`, `approved`, `rejected`, `all`)
- Approve student applications to grant `teacher` role
- Reject applications or revoke instructor access
- Access teacher dashboards and classroom oversight

### Teacher

- View classroom and student performance analytics
- Create classrooms and share access codes
- Create, edit, and delete curriculum decks (verified by `creator_id`)
- View individual student progress reports
- Generate flashcards from subject topics using Google Gemini

### Student

- Join classrooms with an access code
- View classroom decks
- Create and edit personal decks (verified by database `creator_id`)
- Practice cards with flip, shuffle, known, and review actions
- Track daily study streaks
- Apply for instructor privileges via the **"Become a Teacher"** portal
- Update profile and theme settings

## Project Structure

```text
app.py                    Flask application entry point & AI endpoints
index.html                Frontend shell that loads the page fragments
pages/landing.html        Landing page fragment
pages/auth.html           Authentication page fragment
pages/dashboard.html      Dashboard and workspace panels
pages/modals.html         Shared modal dialogs and study overlays
css/styles.css            Application styling & themes
js/app.js                 Global state, authentication, admin request handlers
js/landing.js             Landing page carousel
js/student.js             Student dashboard, study actions, teacher application widget
js/study.js               Flashcard study engine
js/teacher.js             Teacher classroom and deck authoring
routes/admin_routes.py    Admin teacher request review & approval endpoints
routes/user_routes.py     Auth, profile, teacher requests, student performance
routes/classroom_routes.py Classroom authoring & enrollment (ID-based ownership)
routes/deck_routes.py     Deck management (ID-based creator ownership)
services/auth_middleware.py Reusable RBAC @require_role decorator
services/user_service.py  User registration, teacher request & approval logic
services/classroom_service.py Classroom CRUD & ID ownership
services/deck_service.py  Deck CRUD & ID ownership
database/init_db.py       SQLite schema, migrations, and idempotent admin seeding
verify_backend.py         Backend unit tests and RBAC verification suite
images/                   Static image assets
```

## API Areas

- `/api/auth/*` - registration, login, logout, profile, and theme
- `/api/teacher/request` - student application for teacher privileges
- `/api/admin/teacher-requests` - admin listing of teacher applications (`?status=pending|approved|rejected|all`)
- `/api/admin/teacher-requests/<id>/approve` - admin approval endpoint
- `/api/admin/teacher-requests/<id>/reject` - admin rejection endpoint
- `/api/classrooms` - classroom creation and enrollment (protected by role and `teacher_id`)
- `/api/decks` - deck creation and management (protected by `creator_id`)
- `/api/progress` - study activity and progress
- `/api/streak` - daily clue and mystery-word actions
- `/api/state` - current role-filtered application state

## Notes

- The application uses Flask sessions for login state.
- Passwords are stored with Werkzeug password hashes. Email verification and password-reset tokens are stored only as SHA-256 hashes and expire after use or timeout.
- For Google OAuth, register this callback URL in Google Cloud Console: `http://localhost:5000/api/auth/google/callback` (use your HTTPS production URL in deployment). Google passwords are never stored.
- Configure `SMTP_*` variables to send verification and reset emails. Without SMTP, development responses include a one-time link for local testing; production responses never expose tokens.
- Set `FLASK_SECRET_KEY` to a long random value and set `FLASK_SESSION_COOKIE_SECURE=1` when serving over HTTPS.
- The teacher flashcard generator uses Google Gemini through the server-side `/api/ai/generate` endpoint. It requires `GEMINI_API_KEY` to be configured.

