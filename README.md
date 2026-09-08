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

The initial database includes these example accounts:

| Role | Email | Password |
|---|---|---|
| Teacher | `revathi@gmail.com` | `123` |
| Student | `student@gmail.com` | `123` |

New accounts are assigned the student role. The special email `revathi@gmail.com` is assigned the teacher role.

## Main Features

### Teacher

- View classroom and student performance analytics
- Create classrooms and share access codes
- Create, edit, and delete classroom decks
- View individual student progress reports
- Generate flashcards from a topic using Google Gemini

### Student

- Join classrooms with an access code
- View classroom decks
- Create personal decks manually or from study notes
- Practice cards with flip, shuffle, known, and review actions
- Track daily study streaks
- Update profile and theme settings

## Project Structure

```text
app.py                    Flask application entry point
index.html                Single-page frontend shell
css/styles.css            Application styling
js/app.js                 Global state, authentication, and navigation
js/landing.js             Landing page carousel
js/student.js             Student features
js/study.js               Flashcard study engine
js/teacher.js             Teacher features
routes/                   Flask API blueprints
services/                 Database-backed business logic
database/                 SQLite connection and schema initialization
verify_backend.py         Backend tests
images/                   Static image assets
```

## API Areas

- `/api/auth/*` - registration, login, logout, profile, and theme
- `/api/classrooms` - classroom creation and enrollment
- `/api/decks` - deck creation and management
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
