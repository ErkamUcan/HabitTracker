KPSS Habit Tracker

  A comprehensive Windows desktop application built to manage the KPSS exam preparation process. Habit tracking, study timer, mock exam management, curriculum
  tracking, and detailed statistics — all in one app.

  ---
  Features

  Habit Tracking

  - Create, rename, and delete daily habits
  - Calendar-based visual marking system
  - Current streak and best streak calculation
  - 52-week activity heatmap
  - Weekly pattern analysis (strongest / weakest days)
  - Momentum scoring based on recent weighted performance

  Task Management

  - Daily and weekly task lists
  - Subtask hierarchy (parent-child structure)
  - Drag-and-drop sorting
  - Past day view

  Study Timer

  - Real-time timer with study session tracking
  - Subject and topic-based session logging
  - Pause / resume sessions
  - Sleep/wake detection — alerts when system resumes from sleep
  - Idle detection after 8 minutes (configurable)
  - Crash recovery via checkpoint system
  - System tray integration and floating mini widget
  - Manual historical session entry

  Mock Exam Management

  - Section exam (30 min) and full exam (130 min) support
  - Countdown timer with pause / resume / overtime tracking
  - Per-section correct / wrong / blank entry
  - Wrong topic logging with category and custom notes
  - Motivational messages at start, finish, early finish, and overtime

  Practice Question Tracking

  - Practice question target queue
  - Session-based correct / wrong / blank logging
  - Uncertain answer and two-choice problem tracking
  - Net score calculation (configurable negative marking)
  - Success rate statistics by topic and category

  KPSS Curriculum Management

  - 8 built-in categories (Tema 1–8)
  - Category color customization
  - Add, edit, and delete topics per category
  - Bulk topic paste (line-by-line)
  - Topic completion marking
  - Search and filter across all categories

  Video Lesson Library

  - Organize lessons by color-coded groups
  - Title, duration, and link entry
  - Watched / unwatched marking
  - Estimated completion time at 1x, 1.5x, 2x speed
  - Bulk video paste (Title | Duration | Link)

  Statistics & Analytics

  - Study: daily total, goal progress, subject breakdown, streaks
  - Practice: topic success rate, confidence analysis, trend charts
  - Mock exam: per-section score tracking, weak topic analysis
  - Habits: completion heatmap, streak tracking, weekly patterns

  Notifications & Motivation

  - Daily summary notification on startup
  - Study milestone notifications (30, 60, 120 min)
  - Daily quote system from Risale-i Nur, Quran, and Hadith
  - Turkish and English language support

  Data Management

  - Automatic daily backup (last 365 backups retained)
  - JSON and Excel (14 sheets) export
  - All data stored locally in SQLite database

  ---
## Tech Stack

  | Layer | Technology |
  |---|---|
  | Application framework | Electron 33 |
  | UI | React 18, Recharts |
  | Database | SQLite (better-sqlite3) |
  | Build | Webpack 5, Babel 7 |
  | Distribution | Electron Builder / NSIS |
  ---
  Installation

  Run the .exe installer from the dist/ folder and follow the setup wizard.

  ---
  Development

  npm install
  npm start        # start in development mode
  npm run build    # production build
  npm run dist     # create installer package
