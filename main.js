'use strict'

const { app, BrowserWindow, ipcMain, Notification, dialog, shell, Tray, Menu, nativeImage, powerMonitor } = require('electron')
const path = require('path')
const fs = require('fs')
const https = require('https')
const http = require('http')

app.setAppUserModelId('com.erkam.kpss-habit-tracker')

const isDev = !app.isPackaged

let db
let mainWindow
let tray = null
let miniWindow = null
let app_isQuitting = false

// In-memory study session state
let studyState = null
/*
studyState shape when active:
{
  segmentId: number,
  subjectId: number,
  subjectName: string,
  topicText: string,
  segmentStartAt: number,     // ms — when current segment opened
  segmentPausedMs: number,    // ms paused within current segment
  pauseStartAt: number|null,  // ms — when current pause began
  isPaused: boolean,
  priorElapsedSeconds: number, // sum of all closed segments in this session
  lastMilestoneMinutes: number,
  lastSuspendAt: number|null,
  frozenElapsedSeconds: number|null, // set on pause, cleared on resume
}
*/
let checkpointTimer = null
let idleCheckTimer = null

// ==================== Database ====================

function initDatabase() {
  const Database = require('better-sqlite3')
  const userDataPath = app.getPath('userData')
  const dbPath = path.join(userDataPath, 'tracker.db')

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS habits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      archived INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS habit_marks (
      habit_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      done INTEGER DEFAULT 1,
      PRIMARY KEY (habit_id, date),
      FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scope TEXT NOT NULL CHECK(scope IN ('day','week')),
      date TEXT,
      week_start_date TEXT,
      parent_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      done INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS kpss_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS kpss_topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL REFERENCES kpss_categories(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      done INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS kpss_video_lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS kpss_videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id INTEGER REFERENCES kpss_video_lessons(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      duration_min INTEGER DEFAULT 0,
      link TEXT DEFAULT '',
      done INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS quote_history (
      source TEXT NOT NULL,
      ref_id TEXT NOT NULL,
      shown_at TEXT DEFAULT (datetime('now','localtime')),
      PRIMARY KEY (source, ref_id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  const catCount = db.prepare('SELECT COUNT(*) as c FROM kpss_categories').get().c
  if (catCount === 0) {
    const ins = db.prepare('INSERT INTO kpss_categories (name, sort_order) VALUES (?, ?)')
    for (let i = 1; i <= 8; i++) ins.run(`Kategori ${i}`, i - 1)
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      kpss_category_id INTEGER REFERENCES kpss_categories(id) ON DELETE SET NULL,
      archived INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS study_segments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      topic_text TEXT DEFAULT '',
      start_at TEXT NOT NULL,
      end_at TEXT,
      duration_seconds INTEGER DEFAULT 0,
      source TEXT DEFAULT 'timer' CHECK(source IN ('timer','manual')),
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS study_checkpoints (
      segment_id INTEGER PRIMARY KEY REFERENCES study_segments(id) ON DELETE CASCADE,
      last_saved_at TEXT NOT NULL,
      elapsed_seconds INTEGER DEFAULT 0
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS practice_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kpss_category_id INTEGER REFERENCES kpss_categories(id) ON DELETE SET NULL,
      kpss_topic_id INTEGER REFERENCES kpss_topics(id) ON DELETE SET NULL,
      topic_text TEXT DEFAULT '',
      target_count INTEGER DEFAULT 20,
      done INTEGER DEFAULT 0,
      done_at TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS practice_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      kpss_category_id INTEGER REFERENCES kpss_categories(id) ON DELETE SET NULL,
      kpss_topic_id INTEGER REFERENCES kpss_topics(id) ON DELETE SET NULL,
      topic_text TEXT DEFAULT '',
      total_questions INTEGER DEFAULT 0,
      correct INTEGER DEFAULT 0,
      wrong INTEGER DEFAULT 0,
      blank INTEGER DEFAULT 0,
      uncertain_count INTEGER DEFAULT 0,
      uncertain_correct_count INTEGER DEFAULT 0,
      two_choice_count INTEGER DEFAULT 0,
      two_choice_correct_count INTEGER DEFAULT 0,
      queue_id INTEGER REFERENCES practice_queue(id) ON DELETE SET NULL,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS mock_exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      exam_type TEXT NOT NULL DEFAULT 'general' CHECK(exam_type IN ('general','section')),
      date TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS mock_exam_sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mock_exam_id INTEGER NOT NULL REFERENCES mock_exams(id) ON DELETE CASCADE,
      subject_label TEXT NOT NULL,
      kpss_category_id INTEGER REFERENCES kpss_categories(id) ON DELETE SET NULL,
      subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
      is_custom INTEGER DEFAULT 0,
      correct INTEGER DEFAULT 0,
      wrong INTEGER DEFAULT 0,
      blank INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS mock_exam_wrong_topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mock_exam_section_id INTEGER NOT NULL REFERENCES mock_exam_sections(id) ON DELETE CASCADE,
      kpss_topic_id INTEGER REFERENCES kpss_topics(id) ON DELETE SET NULL,
      topic_label TEXT NOT NULL,
      kpss_category_id INTEGER REFERENCES kpss_categories(id) ON DELETE SET NULL,
      category_label TEXT DEFAULT '',
      wrong_count INTEGER DEFAULT 1,
      note TEXT DEFAULT ''
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS break_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_at TEXT NOT NULL,
      end_at TEXT,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      mode TEXT NOT NULL DEFAULT 'countup'
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      goal_seconds INTEGER NOT NULL,
      actual_seconds INTEGER NOT NULL,
      completed_pct INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `)

  // Migrations
  try { db.exec('ALTER TABLE kpss_videos ADD COLUMN lesson_id INTEGER REFERENCES kpss_video_lessons(id) ON DELETE SET NULL') } catch (_) {}
  try { db.exec("ALTER TABLE kpss_video_lessons ADD COLUMN color TEXT DEFAULT 'indigo'") } catch (_) {}
  try { db.exec("ALTER TABLE kpss_categories ADD COLUMN color TEXT DEFAULT 'indigo'") } catch (_) {}
  try { db.exec('ALTER TABLE mock_exams ADD COLUMN duration_seconds INTEGER DEFAULT 0') } catch (_) {}
  try { db.exec('ALTER TABLE mock_exams ADD COLUMN started_at TEXT') } catch (_) {}
}

// ==================== Helpers ====================

function getTodayStr() {
  return new Date().toISOString().slice(0, 10)
}

function upsertSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value))
}

function getSetting(key, def = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key)
  return row ? row.value : def
}

// ==================== Streak Calculations ====================

function calcCurrentStreak(datesSortedDesc) {
  if (!datesSortedDesc || !datesSortedDesc.length) return 0
  const doneSet = new Set(datesSortedDesc)
  const todayStr = getTodayStr()

  let startDate = todayStr
  if (!doneSet.has(todayStr)) {
    const yd = new Date()
    yd.setDate(yd.getDate() - 1)
    const ydStr = yd.toISOString().slice(0, 10)
    if (!doneSet.has(ydStr)) return 0
    startDate = ydStr
  }

  let streak = 0
  const d = new Date(startDate + 'T00:00:00')
  while (true) {
    const ds = d.toISOString().slice(0, 10)
    if (!doneSet.has(ds)) break
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

function calcBestStreak(datesSortedDesc) {
  if (!datesSortedDesc || !datesSortedDesc.length) return 0
  const sorted = [...datesSortedDesc].sort()
  if (sorted.length === 1) return 1
  let best = 1, current = 1
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + 'T00:00:00')
    const curr = new Date(sorted[i] + 'T00:00:00')
    const diff = Math.round((curr - prev) / 86400000)
    if (diff === 1) { current++; if (current > best) best = current }
    else current = 1
  }
  return best
}

// ==================== Auto Backup ====================

function runAutoBackup() {
  const userDataPath = app.getPath('userData')
  const dbPath = path.join(userDataPath, 'tracker.db')
  const backupsDir = path.join(userDataPath, 'backups')

  if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true })

  const today = getTodayStr()
  if (getSetting('last_backup_date') === today) return

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  try {
    fs.copyFileSync(dbPath, path.join(backupsDir, `tracker-${ts}.db`))
    upsertSetting('last_backup_date', today)

    const files = fs.readdirSync(backupsDir)
      .filter(f => f.startsWith('tracker-') && f.endsWith('.db'))
      .sort()
    if (files.length > 365) {
      files.slice(0, files.length - 365).forEach(f =>
        fs.unlinkSync(path.join(backupsDir, f))
      )
    }
  } catch (err) {
    console.error('Backup error:', err)
  }
}

// ==================== Notifications ====================

function buildNotifBody(lang) {
  const today = getTodayStr()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yday = yesterday.toISOString().slice(0, 10)

  const taskCount = db.prepare(`
    SELECT COUNT(*) as c FROM tasks
    WHERE scope='day' AND date IN (?,?) AND done=0 AND parent_id IS NULL
  `).get(today, yday).c

  const videoCount = db.prepare('SELECT COUNT(*) as c FROM kpss_videos WHERE done=0').get().c
  const topicCount = db.prepare('SELECT COUNT(*) as c FROM kpss_topics WHERE done=0').get().c

  if (taskCount === 0 && videoCount === 0 && topicCount === 0) return null

  if (lang === 'en') {
    const parts = []
    if (taskCount > 0) parts.push(`${taskCount} task${taskCount > 1 ? 's' : ''} remaining`)
    if (videoCount > 0) parts.push(`${videoCount} video${videoCount > 1 ? 's' : ''} to watch`)
    if (topicCount > 0) parts.push(`${topicCount} KPSS topic${topicCount > 1 ? 's' : ''} left`)
    return parts.join(' · ') + '. Keep going!'
  } else {
    const parts = []
    if (taskCount > 0) parts.push(`${taskCount} görev eksik`)
    if (videoCount > 0) parts.push(`${videoCount} video bekliyor`)
    if (topicCount > 0) parts.push(`${topicCount} KPSS konusu kaldı`)
    return parts.join(' · ') + '. Hadi devam et!'
  }
}

function showStartupNotification() {
  if (getSetting('notifications_enabled', 'true') !== 'true') return
  const lang = getSetting('language', 'tr')
  const body = buildNotifBody(lang)
  if (body) {
    new Notification({ title: 'KPSS Habit Tracker', body }).show()
  }
}

function showMotivationalNotification() {
  if (getSetting('notifications_enabled', 'true') !== 'true') return
  const lang = getSetting('language', 'tr')
  const today = getTodayStr()

  const tasksDone = db.prepare("SELECT COUNT(*) as c FROM tasks WHERE scope='day' AND date=? AND done=1 AND parent_id IS NULL").get(today).c
  const tasksLeft = db.prepare("SELECT COUNT(*) as c FROM tasks WHERE scope='day' AND date=? AND done=0 AND parent_id IS NULL").get(today).c
  const habitsTotal = db.prepare('SELECT COUNT(*) as c FROM habits WHERE archived=0').get().c
  const habitsDone  = db.prepare('SELECT COUNT(DISTINCT habit_id) as c FROM habit_marks WHERE date=? AND done=1').get(today).c
  const videosLeft  = db.prepare('SELECT COUNT(*) as c FROM kpss_videos WHERE done=0').get().c

  let body
  if (lang === 'en') {
    if (tasksLeft === 0 && tasksDone > 0) body = `All ${tasksDone} tasks done today! Habits: ${habitsDone}/${habitsTotal}. Keep the momentum!`
    else if (tasksDone > 0) body = `${tasksDone} tasks done, ${tasksLeft} left. ${habitsDone}/${habitsTotal} habits done. ${videosLeft > 0 ? `${videosLeft} videos remaining.` : ''} You can do it!`
    else body = `Start strong! You have ${tasksLeft} tasks and ${videosLeft} videos waiting.`
  } else {
    if (tasksLeft === 0 && tasksDone > 0) body = `Bugün ${tasksDone} görevi bitirdin! Alışkanlıklar: ${habitsDone}/${habitsTotal}. Harika gidiyorsun!`
    else if (tasksDone > 0) body = `${tasksDone} görev tamam, ${tasksLeft} kaldı. ${habitsDone}/${habitsTotal} alışkanlık yapıldı. ${videosLeft > 0 ? `${videosLeft} video bekliyor.` : ''} Devam et!`
    else body = `Hadi başla! ${tasksLeft} görev ve ${videosLeft} video seni bekliyor.`
  }

  new Notification({ title: 'KPSS Habit Tracker', body }).show()
}

// ==================== HTTP ====================

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http
    const req = lib.get(url, { timeout: 10000 }, (res) => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(new Error('Invalid JSON')) }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')) })
  })
}

// ==================== Quotes ====================

function getRisaleQuote() {
  try {
    const risalePath = path.join(__dirname, 'data', 'risale.json')
    const risaleData = JSON.parse(fs.readFileSync(risalePath, 'utf-8'))
    const books = Object.keys(risaleData)
    const book = books[Math.floor(Math.random() * books.length)]
    const passages = risaleData[book].passages

    const shown = new Set(
      db.prepare("SELECT ref_id FROM quote_history WHERE source='risale'")
        .all().map(r => r.ref_id)
    )
    let available = passages.filter(p => !shown.has(p.id))
    if (available.length === 0) {
      db.prepare("DELETE FROM quote_history WHERE source='risale'").run()
      available = passages
    }

    const p = available[Math.floor(Math.random() * available.length)]
    db.prepare("INSERT OR IGNORE INTO quote_history (source, ref_id) VALUES ('risale', ?)").run(p.id)

    return {
      source: 'risale', label: 'Risale-i Nur',
      text: p.text,
      citation: `${p.book}, ${p.section} — Bediüzzaman Said Nursi, Diyanet asıl nüsha`
    }
  } catch (err) {
    console.error('Risale error:', err)
    return null
  }
}

async function getAyetQuote() {
  const surahId = Math.floor(Math.random() * 114) + 1
  const surahInfo = await httpGet(`https://api.acikkuran.com/surah/${surahId}`)
  if (!surahInfo?.data) throw new Error('No surah data')

  const verseCount = surahInfo.data.verse_count || 7
  const verseId = Math.floor(Math.random() * verseCount) + 1

  const verseData = await httpGet(
    `https://api.acikkuran.com/surah/${surahId}/verse/${verseId}?author=8`
  )
  if (!verseData?.data) throw new Error('No verse data')

  const v = verseData.data
  const ref = `${surahId}:${verseId}`
  db.prepare("INSERT OR IGNORE INTO quote_history (source, ref_id) VALUES ('ayet', ?)").run(ref)

  return {
    source: 'ayet', label: 'Ayet',
    text: v.translation?.text || v.transcription || '',
    arabic: v.verse || '',
    citation: `${surahInfo.data.name_turkish || surahInfo.data.name} Suresi, ${verseId}. Ayet (${ref}) — Diyanet Meali`
  }
}

async function getHadithQuote() {
  const cats = await httpGet('https://hadeethenc.com/api/v1/categories/roots/?language=tr')
  if (!Array.isArray(cats) || cats.length === 0) throw new Error('No categories')

  const cat = cats[Math.floor(Math.random() * Math.min(cats.length, 10))]
  const page = Math.floor(Math.random() * 3) + 1
  const listData = await httpGet(
    `https://hadeethenc.com/api/v1/hadeeths/list/?language=tr&category_id=${cat.id}&page=${page}&per_page=20`
  )

  const list = listData?.data || []
  if (list.length === 0) throw new Error('Empty list')

  const item = list[Math.floor(Math.random() * list.length)]
  const full = await httpGet(
    `https://hadeethenc.com/api/v1/hadeeths/one/?language=tr&id=${item.id}`
  )

  db.prepare("INSERT OR IGNORE INTO quote_history (source, ref_id) VALUES ('hadith', ?)").run(String(item.id))

  return {
    source: 'hadith', label: 'Hadith',
    text: full?.translations?.tr?.text || full?.content || item.title || '',
    citation: full?.translations?.tr?.attribution || cat.title || 'Hadis-i Şerif'
  }
}

async function fetchQuote(forceRefresh = false) {
  if (!forceRefresh) {
    const today = getTodayStr()
    const lastDate = getSetting('last_quote_date', '')
    const cached = getSetting('today_quote', '')
    if (lastDate === today && cached) {
      try { return JSON.parse(cached) } catch {}
    }
  }

  const sources = ['ayet', 'hadith', 'risale'].sort(() => Math.random() - 0.5)

  for (const source of sources) {
    try {
      let q
      if (source === 'risale') q = getRisaleQuote()
      else if (source === 'ayet') q = await getAyetQuote()
      else q = await getHadithQuote()

      if (q) {
        upsertSetting('today_quote', JSON.stringify(q))
        upsertSetting('last_quote_date', getTodayStr())
        return q
      }
    } catch (e) {
      console.error(`Quote source ${source} failed:`, e.message)
    }
  }

  const fallback = getRisaleQuote()
  if (fallback) {
    upsertSetting('today_quote', JSON.stringify(fallback))
    upsertSetting('last_quote_date', getTodayStr())
  }
  return fallback
}

// ==================== Study Helpers ====================

function computeStudyElapsed() {
  if (!studyState) return 0
  if (studyState.isPaused) return studyState.frozenElapsedSeconds || 0
  return studyState.priorElapsedSeconds +
    Math.floor((Date.now() - studyState.segmentStartAt - studyState.segmentPausedMs) / 1000)
}

function buildStudyStateForClient() {
  if (!studyState) return null
  return {
    running: true,
    isPaused: studyState.isPaused,
    segmentId: studyState.segmentId,
    subjectId: studyState.subjectId,
    subjectName: studyState.subjectName,
    topicText: studyState.topicText,
    elapsedSeconds: computeStudyElapsed(),
    frozenElapsedSeconds: studyState.frozenElapsedSeconds,
    priorElapsedSeconds: studyState.priorElapsedSeconds,
    segmentStartAt: studyState.segmentStartAt,
    segmentPausedMs: studyState.segmentPausedMs,
  }
}

function saveCheckpoint() {
  if (!studyState) return
  const elapsed = computeStudyElapsed()
  const now = new Date().toISOString()
  db.prepare(`
    INSERT OR REPLACE INTO study_checkpoints (segment_id, last_saved_at, elapsed_seconds)
    VALUES (?,?,?)
  `).run(studyState.segmentId, now, elapsed)
}

function closeCurrentSegment() {
  if (!studyState) return
  const now = Date.now()
  let dur = studyState.priorElapsedSeconds
  if (studyState.isPaused) {
    dur = studyState.frozenElapsedSeconds || 0
    // segment-level duration only (not priorElapsed)
    dur -= studyState.priorElapsedSeconds
  } else {
    dur = Math.floor((now - studyState.segmentStartAt - studyState.segmentPausedMs) / 1000)
  }
  const endAt = new Date(now).toISOString()
  db.prepare('UPDATE study_segments SET end_at=?, duration_seconds=? WHERE id=?')
    .run(endAt, Math.max(0, dur), studyState.segmentId)
  db.prepare('DELETE FROM study_checkpoints WHERE segment_id=?').run(studyState.segmentId)
}

function startCheckpointTimer() {
  stopCheckpointTimer()
  checkpointTimer = setInterval(() => {
    if (studyState && !studyState.isPaused) {
      saveCheckpoint()
      checkMilestones()
    }
  }, 20000)
}

function stopCheckpointTimer() {
  if (checkpointTimer) { clearInterval(checkpointTimer); checkpointTimer = null }
}

function startIdleTimer() {
  stopIdleTimer()
  idleCheckTimer = setInterval(() => {
    if (!studyState || studyState.isPaused) return
    const idleMinutes = parseInt(getSetting('study_idle_timeout_minutes', '8'))
    const idleSeconds = powerMonitor.getSystemIdleTime()
    if (idleSeconds >= idleMinutes * 60) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('study:event:idle', { idleSeconds })
      }
      if (miniWindow && !miniWindow.isDestroyed()) {
        miniWindow.webContents.send('study:event:idle', { idleSeconds })
      }
    }
  }, 30000)
}

function stopIdleTimer() {
  if (idleCheckTimer) { clearInterval(idleCheckTimer); idleCheckTimer = null }
}

function checkMilestones() {
  if (!studyState) return
  if (getSetting('notifications_enabled', 'true') !== 'true') return
  const elapsed = computeStudyElapsed()
  const minutes = Math.floor(elapsed / 60)
  const prev = studyState.lastMilestoneMinutes

  const milestones = [30, 60, 120]
  for (let m = 120; m <= minutes; m += 60) {
    if (!milestones.includes(m)) milestones.push(m)
  }

  const crossed = milestones.find(m => m > prev && m <= minutes)
  if (!crossed) return

  studyState.lastMilestoneMinutes = crossed
  const h = Math.floor(crossed / 60)
  const msg = h >= 1
    ? `${h} saat çalıştın — harika gidiyorsun!`
    : `${crossed} dakika tamam — devam et!`
  new Notification({ title: 'KPSS Habit Tracker', body: msg }).show()
}

function broadcastStateToAll() {
  const state = buildStudyStateForClient()
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('study:event:stateChange', state)
  }
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.webContents.send('study:event:stateChange', state)
  }
}

function updateTrayMenu() {
  if (!tray) return
  const hasSession = !!studyState
  const isPaused = studyState && studyState.isPaused

  const items = [
    { label: 'Open', click: () => { mainWindow.show(); mainWindow.focus() } },
    { type: 'separator' },
  ]

  if (hasSession && !isPaused) {
    items.push({ label: 'Pause Timer', click: () => {
      ipcMain.emit('study:session:pause-from-tray')
      const now = Date.now()
      const elapsed = studyState.priorElapsedSeconds +
        Math.floor((now - studyState.segmentStartAt - studyState.segmentPausedMs) / 1000)
      studyState.isPaused = true
      studyState.pauseStartAt = now
      studyState.frozenElapsedSeconds = elapsed
      saveCheckpoint()
      stopCheckpointTimer()
      updateTrayMenu()
      broadcastStateToAll()
    }})
  }

  if (hasSession && isPaused) {
    items.push({ label: 'Resume Timer', click: () => {
      const now = Date.now()
      studyState.segmentPausedMs += now - studyState.pauseStartAt
      studyState.pauseStartAt = null
      studyState.isPaused = false
      studyState.frozenElapsedSeconds = null
      saveCheckpoint()
      startCheckpointTimer()
      updateTrayMenu()
      broadcastStateToAll()
    }})
  }

  if (hasSession) {
    items.push({ label: 'Stop Timer', click: () => {
      closeCurrentSegment()
      studyState = null
      stopCheckpointTimer()
      stopIdleTimer()
      updateTrayMenu()
      broadcastStateToAll()
    }})
    items.push({ type: 'separator' })
  }

  items.push({ type: 'separator' })
  items.push({ label: 'Quit', click: () => { app_isQuitting = true; app.quit() } })

  tray.setContextMenu(Menu.buildFromTemplate(items))
}

// ==================== IPC Handlers ====================

function registerIpcHandlers() {
  // Tasks
  ipcMain.handle('tasks:list', (_, scope, dateKey) => {
    if (scope === 'day') {
      return db.prepare(
        "SELECT * FROM tasks WHERE scope='day' AND date=? ORDER BY sort_order, created_at"
      ).all(dateKey)
    }
    return db.prepare(
      "SELECT * FROM tasks WHERE scope='week' AND week_start_date=? ORDER BY sort_order, created_at"
    ).all(dateKey)
  })

  ipcMain.handle('tasks:add', (_, data) => {
    const { scope, date, week_start_date, parent_id, text } = data
    const d = date || null
    const w = week_start_date || null
    const maxOrder = db.prepare(
      'SELECT COALESCE(MAX(sort_order),-1) as m FROM tasks WHERE scope=? AND (date=? OR week_start_date=?)'
    ).get(scope, d, w).m

    const r = db.prepare(
      'INSERT INTO tasks (scope,date,week_start_date,parent_id,text,sort_order) VALUES (?,?,?,?,?,?)'
    ).run(scope, d, w, parent_id || null, text, maxOrder + 1)

    return db.prepare('SELECT * FROM tasks WHERE id=?').get(r.lastInsertRowid)
  })

  ipcMain.handle('tasks:update', (_, id, text) => {
    db.prepare('UPDATE tasks SET text=? WHERE id=?').run(text, id)
    return db.prepare('SELECT * FROM tasks WHERE id=?').get(id)
  })

  ipcMain.handle('tasks:delete', (_, id) => {
    db.prepare('DELETE FROM tasks WHERE id=?').run(id)
    return { ok: true }
  })

  ipcMain.handle('tasks:toggle', (_, id, done) => {
    db.prepare('UPDATE tasks SET done=? WHERE id=?').run(done ? 1 : 0, id)
    return db.prepare('SELECT * FROM tasks WHERE id=?').get(id)
  })

  // Habits
  ipcMain.handle('habits:list', () =>
    db.prepare('SELECT * FROM habits WHERE archived=0 ORDER BY id').all()
  )

  ipcMain.handle('habits:add', (_, name) => {
    const r = db.prepare('INSERT INTO habits (name) VALUES (?)').run(name)
    return db.prepare('SELECT * FROM habits WHERE id=?').get(r.lastInsertRowid)
  })

  ipcMain.handle('habits:rename', (_, id, name) => {
    db.prepare('UPDATE habits SET name=? WHERE id=?').run(name, id)
    return { ok: true }
  })

  ipcMain.handle('habits:delete', (_, id) => {
    db.prepare('DELETE FROM habits WHERE id=?').run(id)
    return { ok: true }
  })

  ipcMain.handle('habits:mark', (_, habitId, date, done) => {
    if (done) {
      db.prepare('INSERT OR REPLACE INTO habit_marks (habit_id, date, done) VALUES (?,?,1)').run(habitId, date)
    } else {
      db.prepare('DELETE FROM habit_marks WHERE habit_id=? AND date=?').run(habitId, date)
    }
    return { ok: true }
  })

  ipcMain.handle('habits:getMarks', (_, year, month) => {
    const m = String(month).padStart(2, '0')
    return db.prepare(
      'SELECT * FROM habit_marks WHERE date >= ? AND date <= ?'
    ).all(`${year}-${m}-01`, `${year}-${m}-31`)
  })

  ipcMain.handle('habits:getMarksForDates', (_, dates) => {
    if (!dates || dates.length === 0) return []
    const placeholders = dates.map(() => '?').join(',')
    return db.prepare(`SELECT * FROM habit_marks WHERE date IN (${placeholders})`).all(...dates)
  })

  // Streaks
  ipcMain.handle('streaks:get', () => {
    const habits = db.prepare('SELECT * FROM habits WHERE archived=0 ORDER BY id').all()
    if (habits.length === 0) {
      return { habitStreaks: [], perfectDay: { current: 0, best: 0, days: [] } }
    }

    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    const startDate = oneYearAgo.toISOString().slice(0, 10)

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)
    const thirtyStr = thirtyDaysAgo.toISOString().slice(0, 10)

    const allMarks = db.prepare(
      'SELECT habit_id, date FROM habit_marks WHERE done=1 AND date>=? ORDER BY date DESC'
    ).all(startDate)

    const marksByHabit = {}
    for (const m of allMarks) {
      if (!marksByHabit[m.habit_id]) marksByHabit[m.habit_id] = []
      marksByHabit[m.habit_id].push(m.date)
    }

    const habitStreaks = habits.map(h => {
      const dates = marksByHabit[h.id] || []
      const recentDone = dates.filter(d => d >= thirtyStr)
      return {
        ...h,
        current_streak: calcCurrentStreak(dates),
        best_streak: calcBestStreak(dates),
        recent_done: recentDone
      }
    })

    // Perfect days: all active habits done
    const marksByDate = {}
    for (const m of allMarks) {
      if (!marksByDate[m.date]) marksByDate[m.date] = new Set()
      marksByDate[m.date].add(m.habit_id)
    }

    const perfectDays = Object.entries(marksByDate)
      .filter(([, habitIds]) => habits.every(h => habitIds.has(h.id)))
      .map(([date]) => date)
      .sort()
      .reverse()

    // Heatmap: per-date completion % for past year
    const heatmap = {}
    const habitCount = habits.length
    for (const [date, doneSet] of Object.entries(marksByDate)) {
      heatmap[date] = Math.round((doneSet.size / habitCount) * 100)
    }

    // Weekly pattern: avg completion % by weekday (0=Sun…6=Sat)
    const weekdayTotals = [0, 0, 0, 0, 0, 0, 0]
    const weekdayCounts = [0, 0, 0, 0, 0, 0, 0]
    for (const [date, pct] of Object.entries(heatmap)) {
      if (date >= startDate) {
        const dow = new Date(date).getDay()
        weekdayTotals[dow] += pct
        weekdayCounts[dow]++
      }
    }
    const weeklyPattern = weekdayTotals.map((total, i) =>
      weekdayCounts[i] > 0 ? Math.round(total / weekdayCounts[i]) : 0
    )

    // Momentum score: weighted avg of last 7 days (recent days weight more)
    const weights = [1, 1, 1.5, 1.5, 2, 2.5, 3]
    let wSum = 0, wTotal = 0
    for (let i = 0; i < 7; i++) {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      const ds = d.toISOString().slice(0, 10)
      const pct = heatmap[ds] || 0
      wSum += pct * weights[i]
      wTotal += weights[i]
    }
    const momentum = Math.round(wSum / wTotal)

    return {
      habitStreaks,
      habitCount,
      perfectDay: {
        current: calcCurrentStreak(perfectDays),
        best: calcBestStreak(perfectDays),
        days: perfectDays.slice(0, 30)
      },
      heatmap,
      weeklyPattern,
      momentum
    }
  })

  // KPSS Categories
  ipcMain.handle('kpss:listCategories', () =>
    db.prepare('SELECT * FROM kpss_categories ORDER BY sort_order').all()
  )

  ipcMain.handle('kpss:reorderCategories', (_, updates) => {
    const stmt = db.prepare('UPDATE kpss_categories SET sort_order=? WHERE id=?')
    for (const { id, sort_order } of updates) stmt.run(sort_order, id)
    return { ok: true }
  })

  ipcMain.handle('kpss:addCategory', (_, name) => {
    const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order),-1) as m FROM kpss_categories').get().m
    const r = db.prepare("INSERT INTO kpss_categories (name, color, sort_order) VALUES (?,?,?)").run(name, 'indigo', maxOrder + 1)
    return db.prepare('SELECT * FROM kpss_categories WHERE id=?').get(r.lastInsertRowid)
  })

  ipcMain.handle('kpss:renameCategory', (_, id, name) => {
    db.prepare('UPDATE kpss_categories SET name=? WHERE id=?').run(name, id)
    return { ok: true }
  })

  ipcMain.handle('kpss:setCategoryColor', (_, id, color) => {
    db.prepare('UPDATE kpss_categories SET color=? WHERE id=?').run(color, id)
    return { ok: true }
  })

  ipcMain.handle('kpss:deleteCategory', (_, id) => {
    db.prepare('DELETE FROM kpss_categories WHERE id=?').run(id)
    return { ok: true }
  })

  // KPSS Topics
  ipcMain.handle('kpss:listTopics', (_, categoryId) =>
    db.prepare('SELECT * FROM kpss_topics WHERE category_id=? ORDER BY sort_order, id').all(categoryId)
  )

  ipcMain.handle('kpss:addTopic', (_, categoryId, text) => {
    const maxOrder = db.prepare(
      'SELECT COALESCE(MAX(sort_order),-1) as m FROM kpss_topics WHERE category_id=?'
    ).get(categoryId).m
    const r = db.prepare(
      'INSERT INTO kpss_topics (category_id, text, sort_order) VALUES (?,?,?)'
    ).run(categoryId, text, maxOrder + 1)
    return db.prepare('SELECT * FROM kpss_topics WHERE id=?').get(r.lastInsertRowid)
  })

  ipcMain.handle('kpss:addTopicsBulk', (_, categoryId, texts) => {
    const maxOrder = db.prepare(
      'SELECT COALESCE(MAX(sort_order),-1) as m FROM kpss_topics WHERE category_id=?'
    ).get(categoryId).m
    const ins = db.prepare('INSERT INTO kpss_topics (category_id, text, sort_order) VALUES (?,?,?)')
    const results = []
    const insertAll = db.transaction(() => {
      texts.forEach((text, i) => {
        const r = ins.run(categoryId, text, maxOrder + 1 + i)
        results.push(db.prepare('SELECT * FROM kpss_topics WHERE id=?').get(r.lastInsertRowid))
      })
    })
    insertAll()
    return results
  })

  ipcMain.handle('kpss:updateTopic', (_, id, text) => {
    db.prepare('UPDATE kpss_topics SET text=? WHERE id=?').run(text, id)
    return { ok: true }
  })

  ipcMain.handle('kpss:deleteTopic', (_, id) => {
    db.prepare('DELETE FROM kpss_topics WHERE id=?').run(id)
    return { ok: true }
  })

  ipcMain.handle('kpss:deleteTopics', (_, ids) => {
    const del = db.prepare('DELETE FROM kpss_topics WHERE id=?')
    const deleteAll = db.transaction(() => ids.forEach(id => del.run(id)))
    deleteAll()
    return { ok: true }
  })

  ipcMain.handle('kpss:toggleTopic', (_, id, done) => {
    db.prepare('UPDATE kpss_topics SET done=? WHERE id=?').run(done ? 1 : 0, id)
    return { ok: true }
  })

  // Video Lessons
  ipcMain.handle('lessons:list', () =>
    db.prepare('SELECT * FROM kpss_video_lessons ORDER BY sort_order, id').all()
  )

  ipcMain.handle('lessons:add', (_, name, color) => {
    const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order),-1) as m FROM kpss_video_lessons').get().m
    const r = db.prepare('INSERT INTO kpss_video_lessons (name, color, sort_order) VALUES (?,?,?)').run(name, color || 'indigo', maxOrder + 1)
    return db.prepare('SELECT * FROM kpss_video_lessons WHERE id=?').get(r.lastInsertRowid)
  })

  ipcMain.handle('lessons:rename', (_, id, name) => {
    db.prepare('UPDATE kpss_video_lessons SET name=? WHERE id=?').run(name, id)
    return { ok: true }
  })

  ipcMain.handle('lessons:setColor', (_, id, color) => {
    db.prepare('UPDATE kpss_video_lessons SET color=? WHERE id=?').run(color, id)
    return { ok: true }
  })

  ipcMain.handle('lessons:delete', (_, id) => {
    db.prepare('DELETE FROM kpss_video_lessons WHERE id=?').run(id)
    return { ok: true }
  })

  ipcMain.handle('lessons:reorder', (_, updates) => {
    const stmt = db.prepare('UPDATE kpss_video_lessons SET sort_order=? WHERE id=?')
    for (const { id, sort_order } of updates) stmt.run(sort_order, id)
    return { ok: true }
  })

  // Videos
  ipcMain.handle('videos:list', () =>
    db.prepare('SELECT * FROM kpss_videos ORDER BY lesson_id, sort_order, id').all()
  )

  ipcMain.handle('videos:add', (_, data) => {
    const { title, duration_min, link, lesson_id } = data
    const lessonId = lesson_id || null
    const maxOrder = db.prepare(
      'SELECT COALESCE(MAX(sort_order),-1) as m FROM kpss_videos WHERE lesson_id IS ?'
    ).get(lessonId).m
    const r = db.prepare(
      'INSERT INTO kpss_videos (lesson_id, title, duration_min, link, sort_order) VALUES (?,?,?,?,?)'
    ).run(lessonId, title, duration_min || 0, link || '', maxOrder + 1)
    return db.prepare('SELECT * FROM kpss_videos WHERE id=?').get(r.lastInsertRowid)
  })

  ipcMain.handle('videos:bulkAdd', (_, items) => {
    const ins = db.prepare('INSERT INTO kpss_videos (lesson_id, title, duration_min, link, sort_order) VALUES (?,?,?,?,?)')
    const results = []
    const insertAll = db.transaction(() => {
      items.forEach((item) => {
        const lessonId = item.lesson_id || null
        const maxOrder = db.prepare(
          'SELECT COALESCE(MAX(sort_order),-1) as m FROM kpss_videos WHERE lesson_id IS ?'
        ).get(lessonId).m
        const r = ins.run(lessonId, item.title, item.duration_min || 0, item.link || '', maxOrder + 1)
        results.push(db.prepare('SELECT * FROM kpss_videos WHERE id=?').get(r.lastInsertRowid))
      })
    })
    insertAll()
    return results
  })

  ipcMain.handle('videos:update', (_, id, data) => {
    const { title, duration_min, link, lesson_id } = data
    db.prepare('UPDATE kpss_videos SET title=?, duration_min=?, link=?, lesson_id=? WHERE id=?')
      .run(title, duration_min || 0, link || '', lesson_id || null, id)
    return db.prepare('SELECT * FROM kpss_videos WHERE id=?').get(id)
  })

  ipcMain.handle('videos:delete', (_, id) => {
    db.prepare('DELETE FROM kpss_videos WHERE id=?').run(id)
    return { ok: true }
  })

  ipcMain.handle('videos:deleteMany', (_, ids) => {
    const del = db.prepare('DELETE FROM kpss_videos WHERE id=?')
    const deleteAll = db.transaction(() => ids.forEach(id => del.run(id)))
    deleteAll()
    return { ok: true }
  })

  ipcMain.handle('videos:toggle', (_, id, done) => {
    db.prepare('UPDATE kpss_videos SET done=? WHERE id=?').run(done ? 1 : 0, id)
    return db.prepare('SELECT * FROM kpss_videos WHERE id=?').get(id)
  })

  // ── Study: Subjects ─────────────────────────────────────────────────
  ipcMain.handle('study:subjects:list', () =>
    db.prepare('SELECT * FROM subjects WHERE archived=0 ORDER BY name').all()
  )

  ipcMain.handle('study:subjects:add', (_, name, kpss_category_id) => {
    const r = db.prepare('INSERT INTO subjects (name, kpss_category_id) VALUES (?,?)').run(name, kpss_category_id || null)
    return db.prepare('SELECT * FROM subjects WHERE id=?').get(r.lastInsertRowid)
  })

  ipcMain.handle('study:subjects:update', (_, id, name, kpss_category_id) => {
    db.prepare('UPDATE subjects SET name=?, kpss_category_id=? WHERE id=?').run(name, kpss_category_id || null, id)
    return db.prepare('SELECT * FROM subjects WHERE id=?').get(id)
  })

  ipcMain.handle('study:subjects:delete', (_, id) => {
    db.prepare('DELETE FROM subjects WHERE id=?').run(id)
    return { ok: true }
  })

  ipcMain.handle('study:subjects:getOrCreate', (_, kpss_category_id, name) => {
    const existing = db.prepare(
      'SELECT * FROM subjects WHERE kpss_category_id=? AND archived=0 LIMIT 1'
    ).get(kpss_category_id)
    if (existing) return existing
    const r = db.prepare('INSERT INTO subjects (name, kpss_category_id) VALUES (?,?)').run(name, kpss_category_id)
    return db.prepare('SELECT * FROM subjects WHERE id=?').get(r.lastInsertRowid)
  })

  // ── Study: Session ───────────────────────────────────────────────────
  ipcMain.handle('study:session:getState', () => buildStudyStateForClient())

  ipcMain.handle('study:session:start', (_, subjectId, topicText) => {
    const subject = db.prepare('SELECT * FROM subjects WHERE id=?').get(subjectId)
    if (!subject) return { error: 'Subject not found' }

    // If there's already an open session, stop it first
    if (studyState) closeCurrentSegment()

    const startAt = new Date().toISOString()
    const r = db.prepare(
      "INSERT INTO study_segments (subject_id, topic_text, start_at, source) VALUES (?,?,?,'timer')"
    ).run(subjectId, topicText || '', startAt)

    studyState = {
      segmentId: r.lastInsertRowid,
      subjectId,
      subjectName: subject.name,
      topicText: topicText || '',
      segmentStartAt: Date.now(),
      segmentPausedMs: 0,
      pauseStartAt: null,
      isPaused: false,
      priorElapsedSeconds: 0,
      lastMilestoneMinutes: 0,
      lastSuspendAt: null,
      frozenElapsedSeconds: null,
    }

    saveCheckpoint()
    startCheckpointTimer()
    startIdleTimer()
    updateTrayMenu()
    broadcastStateToAll()
    return buildStudyStateForClient()
  })

  ipcMain.handle('study:session:pause', () => {
    if (!studyState || studyState.isPaused) return buildStudyStateForClient()

    const now = Date.now()
    const elapsed = studyState.priorElapsedSeconds +
      Math.floor((now - studyState.segmentStartAt - studyState.segmentPausedMs) / 1000)
    studyState.isPaused = true
    studyState.pauseStartAt = now
    studyState.frozenElapsedSeconds = elapsed

    saveCheckpoint()
    stopCheckpointTimer()
    updateTrayMenu()
    broadcastStateToAll()
    return buildStudyStateForClient()
  })

  ipcMain.handle('study:session:resume', () => {
    if (!studyState || !studyState.isPaused) return buildStudyStateForClient()

    const now = Date.now()
    studyState.segmentPausedMs += now - studyState.pauseStartAt
    studyState.pauseStartAt = null
    studyState.isPaused = false
    studyState.frozenElapsedSeconds = null

    saveCheckpoint()
    startCheckpointTimer()
    updateTrayMenu()
    broadcastStateToAll()
    return buildStudyStateForClient()
  })

  ipcMain.handle('study:session:stop', () => {
    if (!studyState) return null

    closeCurrentSegment()
    studyState = null
    stopCheckpointTimer()
    stopIdleTimer()
    updateTrayMenu()
    broadcastStateToAll()
    return null
  })

  // ── Study: Delete Segments ───────────────────────────────────────────────────
  ipcMain.handle('study:segments:delete', (_, id) => {
    db.prepare('DELETE FROM study_segments WHERE id=?').run(id)
    return { ok: true }
  })

  ipcMain.handle('study:segments:deleteDay', (_, date) => {
    db.prepare(
      "DELETE FROM study_segments WHERE date(start_at,'localtime')=? AND end_at IS NOT NULL"
    ).run(date)
    return { ok: true }
  })

  ipcMain.handle('study:session:cancel', () => {
    if (!studyState) return null

    // Delete the segment entirely — do not save any duration
    db.prepare('DELETE FROM study_segments WHERE id=?').run(studyState.segmentId)
    db.prepare('DELETE FROM study_checkpoints WHERE segment_id=?').run(studyState.segmentId)
    studyState = null
    stopCheckpointTimer()
    stopIdleTimer()
    updateTrayMenu()
    broadcastStateToAll()
    return null
  })

  ipcMain.handle('study:session:switch', (_, subjectId, topicText) => {
    const subject = db.prepare('SELECT * FROM subjects WHERE id=?').get(subjectId)
    if (!subject) return { error: 'Subject not found' }

    const now = Date.now()
    let priorElapsed = studyState ? studyState.priorElapsedSeconds : 0

    if (studyState) {
      // Resume first if paused (switch implies continuing)
      if (studyState.isPaused) {
        studyState.segmentPausedMs += now - studyState.pauseStartAt
        studyState.pauseStartAt = null
        studyState.isPaused = false
      }
      const segDuration = Math.floor((now - studyState.segmentStartAt - studyState.segmentPausedMs) / 1000)
      priorElapsed += segDuration
      closeCurrentSegment()
    }

    const startAt = new Date().toISOString()
    const r = db.prepare(
      "INSERT INTO study_segments (subject_id, topic_text, start_at, source) VALUES (?,?,?,'timer')"
    ).run(subjectId, topicText || '', startAt)

    studyState = {
      segmentId: r.lastInsertRowid,
      subjectId,
      subjectName: subject.name,
      topicText: topicText || '',
      segmentStartAt: now,
      segmentPausedMs: 0,
      pauseStartAt: null,
      isPaused: false,
      priorElapsedSeconds: priorElapsed,
      lastMilestoneMinutes: studyState ? studyState.lastMilestoneMinutes : 0,
      lastSuspendAt: null,
      frozenElapsedSeconds: null,
    }

    saveCheckpoint()
    updateTrayMenu()
    broadcastStateToAll()
    return buildStudyStateForClient()
  })

  ipcMain.handle('study:session:dismissRecovery', (_, segmentId, keepTime) => {
    if (!keepTime) {
      db.prepare('DELETE FROM study_segments WHERE id=?').run(segmentId)
    } else {
      // Segment already has duration from the checkpoint — just mark it closed
      const cp = db.prepare('SELECT * FROM study_checkpoints WHERE segment_id=?').get(segmentId)
      if (cp) {
        const seg = db.prepare('SELECT * FROM study_segments WHERE id=?').get(segmentId)
        if (seg) {
          const endAt = new Date(new Date(seg.start_at).getTime() + cp.elapsed_seconds * 1000).toISOString()
          db.prepare('UPDATE study_segments SET end_at=?, duration_seconds=? WHERE id=?')
            .run(endAt, cp.elapsed_seconds, segmentId)
        }
      }
    }
    db.prepare('DELETE FROM study_checkpoints WHERE segment_id=?').run(segmentId)
    return { ok: true }
  })

  ipcMain.handle('study:session:checkRecovery', () => {
    const unfinished = db.prepare(`
      SELECT ss.*, s.name as subject_name, sc.elapsed_seconds, sc.last_saved_at
      FROM study_segments ss
      JOIN subjects s ON s.id = ss.subject_id
      LEFT JOIN study_checkpoints sc ON sc.segment_id = ss.id
      WHERE ss.end_at IS NULL
      ORDER BY ss.created_at DESC
      LIMIT 1
    `).get()
    return unfinished || null
  })

  // ── Study: Manual Entry ──────────────────────────────────────────────
  ipcMain.handle('study:manual:add', (_, data) => {
    const { subjectId, topicText, date, durationSeconds, startAt, endAt } = data
    const start = startAt || (date + 'T09:00:00')
    const end = endAt || new Date(new Date(start).getTime() + durationSeconds * 1000).toISOString()
    const dur = durationSeconds || Math.round((new Date(end) - new Date(start)) / 1000)

    const r = db.prepare(`
      INSERT INTO study_segments (subject_id, topic_text, start_at, end_at, duration_seconds, source)
      VALUES (?,?,?,?,?,'manual')
    `).run(subjectId, topicText || '', start, end, dur)
    return db.prepare('SELECT * FROM study_segments WHERE id=?').get(r.lastInsertRowid)
  })

  // ── Study: Stats ─────────────────────────────────────────────────────
  ipcMain.handle('study:stats:get', (_, rangeStart) => {
    const today = getTodayStr()
    const yday = (() => { const d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10) })()
    const from = rangeStart || '2020-01-01'

    const todayTotal = db.prepare(
      "SELECT COALESCE(SUM(duration_seconds),0) as t FROM study_segments WHERE date(start_at,'localtime')=? AND end_at IS NOT NULL"
    ).get(today).t

    const ydayTotal = db.prepare(
      "SELECT COALESCE(SUM(duration_seconds),0) as t FROM study_segments WHERE date(start_at,'localtime')=? AND end_at IS NOT NULL"
    ).get(yday).t

    const dailyTotals = db.prepare(`
      SELECT date(start_at,'localtime') as day, SUM(duration_seconds) as total_seconds
      FROM study_segments WHERE start_at >= ? AND end_at IS NOT NULL
      GROUP BY date(start_at,'localtime') ORDER BY day
    `).all(from)

    // Subject breakdown with category color
    const subjectBreakdown = db.prepare(`
      SELECT s.id, s.name, s.kpss_category_id,
             k.color as category_color, k.name as category_name,
             SUM(ss.duration_seconds) as total_seconds
      FROM study_segments ss
      JOIN subjects s ON s.id = ss.subject_id
      LEFT JOIN kpss_categories k ON k.id = s.kpss_category_id
      WHERE ss.start_at >= ? AND ss.end_at IS NOT NULL
      GROUP BY s.id, s.name ORDER BY total_seconds DESC
    `).all(from)

    // Topic breakdown per subject for the range
    const topicRows = db.prepare(`
      SELECT ss.subject_id, ss.topic_text, SUM(ss.duration_seconds) as total_seconds
      FROM study_segments ss
      WHERE ss.start_at >= ? AND ss.end_at IS NOT NULL AND ss.topic_text != ''
      GROUP BY ss.subject_id, ss.topic_text ORDER BY total_seconds DESC
    `).all(from)
    const topicsBySubject = {}
    for (const r of topicRows) {
      if (!topicsBySubject[r.subject_id]) topicsBySubject[r.subject_id] = []
      topicsBySubject[r.subject_id].push({ topic: r.topic_text, total_seconds: r.total_seconds })
    }

    // Session history for range (most recent first)
    const sessions = db.prepare(`
      SELECT ss.id, ss.subject_id, s.name as subject_name,
             k.name as category_name, k.color as category_color,
             ss.topic_text, ss.start_at, ss.end_at, ss.duration_seconds, ss.source
      FROM study_segments ss
      JOIN subjects s ON s.id = ss.subject_id
      LEFT JOIN kpss_categories k ON k.id = s.kpss_category_id
      WHERE ss.start_at >= ? AND ss.end_at IS NOT NULL
      ORDER BY ss.start_at DESC LIMIT 200
    `).all(from)

    const longestSession = db.prepare(
      'SELECT MAX(duration_seconds) as v FROM study_segments WHERE end_at IS NOT NULL'
    ).get().v || 0

    const avgSession = db.prepare(
      'SELECT COALESCE(AVG(duration_seconds),0) as v FROM study_segments WHERE end_at IS NOT NULL AND duration_seconds > 0'
    ).get().v || 0

    const sessionCount = db.prepare(
      'SELECT COUNT(*) as c FROM study_segments WHERE start_at >= ? AND end_at IS NOT NULL'
    ).get(from).c

    const dailyGoalSeconds = parseInt(getSetting('study_daily_goal_minutes', '120')) * 60
    const goalDays = db.prepare(`
      SELECT date(start_at,'localtime') as day
      FROM study_segments WHERE end_at IS NOT NULL
      GROUP BY date(start_at,'localtime')
      HAVING SUM(duration_seconds) >= ?
    `).all(dailyGoalSeconds).map(r => r.day).sort().reverse()

    const topSubjectToday = db.prepare(`
      SELECT s.name, SUM(ss.duration_seconds) as t
      FROM study_segments ss JOIN subjects s ON s.id=ss.subject_id
      WHERE date(ss.start_at,'localtime')=? AND ss.end_at IS NOT NULL
      GROUP BY s.id ORDER BY t DESC LIMIT 1
    `).get(today)

    return {
      todayTotal, ydayTotal,
      todayVsYday: todayTotal - ydayTotal,
      dailyTotals,
      subjectBreakdown,
      topicsBySubject,
      sessions,
      longestSession,
      avgSession: Math.round(avgSession),
      sessionCount,
      studyStreak: {
        current: calcCurrentStreak(goalDays),
        best: calcBestStreak(goalDays),
        days: goalDays.slice(0, 30),
      },
      topSubjectToday: topSubjectToday ? topSubjectToday.name : null,
      dailyGoalSeconds,
    }
  })

  ipcMain.handle('study:stats:heatmap', () => {
    const yearAgo = new Date(); yearAgo.setFullYear(yearAgo.getFullYear()-1)
    const rows = db.prepare(`
      SELECT date(start_at,'localtime') as day, SUM(duration_seconds) as total_seconds
      FROM study_segments WHERE start_at >= ? AND end_at IS NOT NULL
      GROUP BY date(start_at,'localtime')
    `).all(yearAgo.toISOString().slice(0,10))
    const map = {}
    for (const r of rows) map[r.day] = r.total_seconds
    return map
  })

  // ── Study: Mini Window ───────────────────────────────────────────────
  ipcMain.handle('study:widget:open', () => {
    if (miniWindow && !miniWindow.isDestroyed()) {
      miniWindow.show(); miniWindow.focus(); return
    }
    createMiniWindow()
  })

  ipcMain.handle('study:widget:close', () => {
    if (miniWindow && !miniWindow.isDestroyed()) miniWindow.close()
  })

  // ── Practice: Sessions ───────────────────────────────────────────────
  const practiceSessionSelect = `
    SELECT ps.*, k.name as category_name, t.text as topic_name
    FROM practice_sessions ps
    LEFT JOIN kpss_categories k ON k.id = ps.kpss_category_id
    LEFT JOIN kpss_topics t ON t.id = ps.kpss_topic_id
  `

  ipcMain.handle('practice:sessions:list', () =>
    db.prepare(practiceSessionSelect + ' ORDER BY ps.date DESC, ps.created_at DESC LIMIT 300').all()
  )

  ipcMain.handle('practice:sessions:add', (_, data) => {
    const { date, kpss_category_id, kpss_topic_id, topic_text, total_questions, correct, wrong, blank,
            uncertain_count, uncertain_correct_count, two_choice_count, two_choice_correct_count, queue_id } = data
    const r = db.prepare(`
      INSERT INTO practice_sessions (date, kpss_category_id, kpss_topic_id, topic_text,
        total_questions, correct, wrong, blank,
        uncertain_count, uncertain_correct_count, two_choice_count, two_choice_correct_count, queue_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(date, kpss_category_id || null, kpss_topic_id || null, topic_text || '',
           total_questions || 0, correct || 0, wrong || 0, blank || 0,
           uncertain_count || 0, uncertain_correct_count || 0,
           two_choice_count || 0, two_choice_correct_count || 0, queue_id || null)
    return db.prepare(practiceSessionSelect + ' WHERE ps.id=?').get(r.lastInsertRowid)
  })

  ipcMain.handle('practice:sessions:update', (_, id, data) => {
    const { date, kpss_category_id, kpss_topic_id, topic_text, total_questions, correct, wrong, blank,
            uncertain_count, uncertain_correct_count, two_choice_count, two_choice_correct_count } = data
    db.prepare(`
      UPDATE practice_sessions SET date=?, kpss_category_id=?, kpss_topic_id=?, topic_text=?,
        total_questions=?, correct=?, wrong=?, blank=?,
        uncertain_count=?, uncertain_correct_count=?, two_choice_count=?, two_choice_correct_count=?
      WHERE id=?
    `).run(date, kpss_category_id || null, kpss_topic_id || null, topic_text || '',
           total_questions || 0, correct || 0, wrong || 0, blank || 0,
           uncertain_count || 0, uncertain_correct_count || 0,
           two_choice_count || 0, two_choice_correct_count || 0, id)
    return db.prepare(practiceSessionSelect + ' WHERE ps.id=?').get(id)
  })

  ipcMain.handle('practice:sessions:delete', (_, id) => {
    db.prepare('DELETE FROM practice_sessions WHERE id=?').run(id)
    return { ok: true }
  })

  // ── Practice: Queue ───────────────────────────────────────────────────
  const practiceQueueSelect = `
    SELECT pq.*, k.name as category_name, t.text as topic_name
    FROM practice_queue pq
    LEFT JOIN kpss_categories k ON k.id = pq.kpss_category_id
    LEFT JOIN kpss_topics t ON t.id = pq.kpss_topic_id
  `

  ipcMain.handle('practice:queue:list', () =>
    db.prepare(practiceQueueSelect + ' ORDER BY pq.done ASC, pq.created_at DESC').all()
  )

  ipcMain.handle('practice:queue:add', (_, data) => {
    const { kpss_category_id, kpss_topic_id, topic_text, target_count } = data
    const r = db.prepare(`
      INSERT INTO practice_queue (kpss_category_id, kpss_topic_id, topic_text, target_count)
      VALUES (?,?,?,?)
    `).run(kpss_category_id || null, kpss_topic_id || null, topic_text || '', target_count || 20)
    return db.prepare(practiceQueueSelect + ' WHERE pq.id=?').get(r.lastInsertRowid)
  })

  ipcMain.handle('practice:queue:update', (_, id, data) => {
    const { kpss_category_id, kpss_topic_id, topic_text, target_count } = data
    db.prepare(`
      UPDATE practice_queue SET kpss_category_id=?, kpss_topic_id=?, topic_text=?, target_count=?
      WHERE id=?
    `).run(kpss_category_id || null, kpss_topic_id || null, topic_text || '', target_count || 20, id)
    return db.prepare(practiceQueueSelect + ' WHERE pq.id=?').get(id)
  })

  ipcMain.handle('practice:queue:delete', (_, id) => {
    db.prepare('DELETE FROM practice_queue WHERE id=?').run(id)
    return { ok: true }
  })

  ipcMain.handle('practice:queue:markDone', (_, id, done) => {
    const now = done ? new Date().toISOString() : null
    db.prepare('UPDATE practice_queue SET done=?, done_at=? WHERE id=?').run(done ? 1 : 0, now, id)
    return db.prepare(practiceQueueSelect + ' WHERE pq.id=?').get(id)
  })

  // ── Practice: Stats ───────────────────────────────────────────────────
  ipcMain.handle('practice:stats:get', (_, rangeStart) => {
    const from = rangeStart || '2000-01-01'

    const agg = db.prepare(`
      SELECT COUNT(*) as session_count,
        COALESCE(SUM(total_questions),0) as total_q,
        COALESCE(SUM(correct),0) as total_correct,
        COALESCE(SUM(wrong),0) as total_wrong,
        COALESCE(SUM(blank),0) as total_blank,
        COALESCE(SUM(uncertain_correct_count),0) as uncertain_correct,
        COALESCE(SUM(two_choice_correct_count),0) as two_choice_correct
      FROM practice_sessions WHERE date >= ?
    `).get(from)

    const dailyTrend = db.prepare(`
      SELECT date, SUM(correct) as correct, SUM(wrong) as wrong,
             SUM(blank) as blank, SUM(total_questions) as total
      FROM practice_sessions WHERE date >= ?
      GROUP BY date ORDER BY date
    `).all(from)

    const topicStats = db.prepare(`
      SELECT
        COALESCE(NULLIF(t.text,''), NULLIF(ps.topic_text,''), k.name, 'Genel') as topic_label,
        k.name as category_name,
        SUM(ps.correct) as correct, SUM(ps.wrong) as wrong,
        SUM(ps.blank) as blank, SUM(ps.total_questions) as total_questions
      FROM practice_sessions ps
      LEFT JOIN kpss_categories k ON k.id = ps.kpss_category_id
      LEFT JOIN kpss_topics t ON t.id = ps.kpss_topic_id
      WHERE ps.date >= ?
      GROUP BY ps.kpss_topic_id, ps.kpss_category_id, ps.topic_text
      HAVING total_questions > 0
      ORDER BY CASE WHEN correct+wrong=0 THEN 1 ELSE CAST(correct AS REAL)/(correct+wrong) END ASC
    `).all(from)

    return {
      sessionCount: agg.session_count,
      totalQ: agg.total_q,
      totalCorrect: agg.total_correct,
      totalWrong: agg.total_wrong,
      totalBlank: agg.total_blank,
      guessedCorrect: agg.uncertain_correct + agg.two_choice_correct,
      dailyTrend,
      topicStats,
    }
  })

  // ── Practice: Topic Stats ─────────────────────────────────────────────
  ipcMain.handle('practice:topic-stats:get', () =>
    db.prepare(`
      SELECT
        t.id, t.category_id, t.text, t.done, t.sort_order,
        k.name as category_name, k.sort_order as category_order,
        COALESCE(SUM(ps.correct), 0) as correct,
        COALESCE(SUM(ps.wrong), 0) as wrong,
        COALESCE(SUM(ps.blank), 0) as blank,
        COALESCE(SUM(ps.total_questions), 0) as total_questions,
        COUNT(DISTINCT ps.id) as session_count
      FROM kpss_topics t
      JOIN kpss_categories k ON k.id = t.category_id
      LEFT JOIN practice_sessions ps ON ps.kpss_topic_id = t.id
      GROUP BY t.id
      ORDER BY k.sort_order, k.id, t.sort_order, t.id
    `).all()
  )

  // ── Mock Exams ────────────────────────────────────────────────────────
  ipcMain.handle('mock:exams:listAll', () => {
    const exams = db.prepare('SELECT * FROM mock_exams ORDER BY date DESC, created_at DESC').all()
    const sections = db.prepare('SELECT * FROM mock_exam_sections ORDER BY mock_exam_id, sort_order').all()
    return { exams, sections }
  })

  ipcMain.handle('mock:exams:add', (_, data) => {
    const { name, exam_type, date, sections, duration_seconds, started_at } = data
    const insertExam = db.prepare('INSERT INTO mock_exams (name, exam_type, date, duration_seconds, started_at) VALUES (?,?,?,?,?)')
    const insertSection = db.prepare(`
      INSERT INTO mock_exam_sections (mock_exam_id, subject_label, kpss_category_id, subject_id, is_custom, correct, wrong, blank, sort_order)
      VALUES (?,?,?,?,?,?,?,?,?)
    `)
    let examId
    db.transaction(() => {
      examId = insertExam.run(name, exam_type || 'general', date, duration_seconds || 0, started_at || null).lastInsertRowid
      sections.forEach((s, i) => {
        insertSection.run(examId, s.subject_label, s.kpss_category_id || null, s.subject_id || null, s.is_custom ? 1 : 0, s.correct || 0, s.wrong || 0, s.blank || 0, i)
      })
    })()
    return {
      exam: db.prepare('SELECT * FROM mock_exams WHERE id=?').get(examId),
      sections: db.prepare('SELECT * FROM mock_exam_sections WHERE mock_exam_id=? ORDER BY sort_order').all(examId)
    }
  })

  ipcMain.handle('mock:exams:update', (_, id, data) => {
    const { name, exam_type, date, sections } = data
    const insertSection = db.prepare(`
      INSERT INTO mock_exam_sections (mock_exam_id, subject_label, kpss_category_id, subject_id, is_custom, correct, wrong, blank, sort_order)
      VALUES (?,?,?,?,?,?,?,?,?)
    `)
    db.transaction(() => {
      db.prepare('UPDATE mock_exams SET name=?, exam_type=?, date=? WHERE id=?').run(name, exam_type || 'general', date, id)
      db.prepare('DELETE FROM mock_exam_sections WHERE mock_exam_id=?').run(id)
      sections.forEach((s, i) => {
        insertSection.run(id, s.subject_label, s.kpss_category_id || null, s.subject_id || null, s.is_custom ? 1 : 0, s.correct || 0, s.wrong || 0, s.blank || 0, i)
      })
    })()
    return {
      exam: db.prepare('SELECT * FROM mock_exams WHERE id=?').get(id),
      sections: db.prepare('SELECT * FROM mock_exam_sections WHERE mock_exam_id=? ORDER BY sort_order').all(id)
    }
  })

  ipcMain.handle('mock:exams:delete', (_, id) => {
    db.prepare('DELETE FROM mock_exams WHERE id=?').run(id)
    return { ok: true }
  })

  ipcMain.handle('mock:stats:get', (_, rangeStart) => {
    const from = rangeStart || '2000-01-01'
    // Per section per general exam — builds the multi-line per-subject chart
    const generalExamSections = db.prepare(`
      SELECT mes.subject_label, me.id as exam_id, me.name as exam_name, me.date,
        mes.correct, mes.wrong, mes.blank, mes.sort_order
      FROM mock_exam_sections mes
      JOIN mock_exams me ON me.id = mes.mock_exam_id
      WHERE me.exam_type = 'general' AND me.date >= ?
      ORDER BY me.date, me.id, mes.sort_order
    `).all(from)
    // Aggregate total per general exam — overall trend line
    const generalExamAgg = db.prepare(`
      SELECT me.id as exam_id, me.name as exam_name, me.date,
        SUM(mes.correct) as correct, SUM(mes.wrong) as wrong, SUM(mes.blank) as blank
      FROM mock_exams me
      JOIN mock_exam_sections mes ON mes.mock_exam_id = me.id
      WHERE me.exam_type = 'general' AND me.date >= ?
      GROUP BY me.id ORDER BY me.date, me.id
    `).all(from)
    // Aggregate per branş exam
    const sectionExamAgg = db.prepare(`
      SELECT me.id as exam_id, me.name as exam_name, me.date,
        SUM(mes.correct) as correct, SUM(mes.wrong) as wrong, SUM(mes.blank) as blank
      FROM mock_exams me
      JOIN mock_exam_sections mes ON mes.mock_exam_id = me.id
      WHERE me.exam_type = 'section' AND me.date >= ?
      GROUP BY me.id ORDER BY me.date, me.id
    `).all(from)
    // Summary stats
    const summaryStats = db.prepare(`
      SELECT
        COUNT(*) as total_exams,
        SUM(CASE WHEN exam_type='general' THEN 1 ELSE 0 END) as general_count,
        SUM(CASE WHEN exam_type='section' THEN 1 ELSE 0 END) as section_count,
        SUM(duration_seconds) as total_seconds
      FROM mock_exams WHERE date >= ?
    `).get(from)

    // Per-category aggregates for section exams (avg net per category)
    const sectionByCat = db.prepare(`
      SELECT mes.kpss_category_id, mes.subject_label,
        COUNT(DISTINCT me.id) as exam_count,
        SUM(mes.correct) as total_correct,
        SUM(mes.wrong) as total_wrong,
        SUM(mes.blank) as total_blank,
        MAX(me.date) as last_date
      FROM mock_exams me
      JOIN mock_exam_sections mes ON mes.mock_exam_id = me.id
      WHERE me.exam_type = 'section' AND me.date >= ?
      GROUP BY mes.subject_label
      ORDER BY exam_count DESC
    `).all(from)

    return { generalExamSections, generalExamAgg, sectionExamAgg, summaryStats, sectionByCat }
  })

  ipcMain.handle('mock:wrongTopics:save', (_, sectionId, topics) => {
    const insert = db.prepare(`
      INSERT INTO mock_exam_wrong_topics (mock_exam_section_id, kpss_topic_id, topic_label, kpss_category_id, category_label, wrong_count, note)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    db.transaction(() => {
      db.prepare('DELETE FROM mock_exam_wrong_topics WHERE mock_exam_section_id=?').run(sectionId)
      for (const t of topics) {
        insert.run(sectionId, t.topicId || null, t.topicLabel, t.categoryId || null, t.categoryLabel || '', t.wrongCount || 1, t.note || '')
      }
    })()
    return { ok: true }
  })

  ipcMain.handle('mock:wrongTopics:getByExam', (_, examId) => {
    return db.prepare(`
      SELECT wt.*, mes.subject_label as section_label, mes.id as section_id
      FROM mock_exam_wrong_topics wt
      JOIN mock_exam_sections mes ON mes.id = wt.mock_exam_section_id
      WHERE mes.mock_exam_id = ?
      ORDER BY mes.sort_order, wt.id
    `).all(examId)
  })

  ipcMain.handle('mock:wrongTopics:update', (_, id, data) => {
    const { note, wrongCount } = data
    if (wrongCount !== undefined) db.prepare('UPDATE mock_exam_wrong_topics SET wrong_count=? WHERE id=?').run(wrongCount, id)
    if (note !== undefined) db.prepare('UPDATE mock_exam_wrong_topics SET note=? WHERE id=?').run(note, id)
    return { ok: true }
  })

  ipcMain.handle('mock:wrongTopics:delete', (_, id) => {
    db.prepare('DELETE FROM mock_exam_wrong_topics WHERE id=?').run(id)
    return { ok: true }
  })

  ipcMain.handle('mock:allTopics:get', () => {
    return db.prepare(`
      SELECT t.id, t.text, t.done, t.category_id,
        k.name as category_name, k.sort_order as cat_sort
      FROM kpss_topics t
      JOIN kpss_categories k ON k.id = t.category_id
      ORDER BY k.sort_order, k.id, t.sort_order, t.id
    `).all()
  })

  ipcMain.handle('mock:stats:topics', (_, rangeStart) => {
    const from = rangeStart || '2000-01-01'
    const topicWrongs = db.prepare(`
      SELECT wt.topic_label, wt.kpss_category_id, wt.category_label, wt.kpss_topic_id,
        SUM(wt.wrong_count) as total_wrong,
        COUNT(DISTINCT mes.mock_exam_id) as exam_count,
        kt.done as topic_done
      FROM mock_exam_wrong_topics wt
      JOIN mock_exam_sections mes ON mes.id = wt.mock_exam_section_id
      JOIN mock_exams me ON me.id = mes.mock_exam_id
      LEFT JOIN kpss_topics kt ON kt.id = wt.kpss_topic_id
      WHERE me.date >= ?
      GROUP BY wt.topic_label, wt.kpss_category_id
      ORDER BY total_wrong DESC
    `).all(from)
    const categoryWrongs = db.prepare(`
      SELECT wt.category_label, wt.kpss_category_id,
        SUM(wt.wrong_count) as total_wrong,
        COUNT(DISTINCT mes.mock_exam_id) as exam_count
      FROM mock_exam_wrong_topics wt
      JOIN mock_exam_sections mes ON mes.id = wt.mock_exam_section_id
      JOIN mock_exams me ON me.id = mes.mock_exam_id
      WHERE me.date >= ?
      GROUP BY wt.kpss_category_id, wt.category_label
      ORDER BY total_wrong DESC
    `).all(from)
    return { topicWrongs, categoryWrongs }
  })

  // Break sessions
  ipcMain.handle('breaks:add', (_, data) => {
    const { duration_seconds, mode, start_at } = data
    const end_at = new Date().toISOString()
    db.prepare('INSERT INTO break_sessions (start_at, end_at, duration_seconds, mode) VALUES (?, ?, ?, ?)')
      .run(start_at || end_at, end_at, duration_seconds || 0, mode || 'countup')
    return { ok: true }
  })

  ipcMain.handle('breaks:stats', (_, rangeStart) => {
    const today = getTodayStr()
    const from = rangeStart || today
    const todayTotal = db.prepare(
      "SELECT COALESCE(SUM(duration_seconds),0) as t FROM break_sessions WHERE date(start_at,'localtime')=?"
    ).get(today).t
    const rangeTotal = db.prepare(
      "SELECT COALESCE(SUM(duration_seconds),0) as t FROM break_sessions WHERE date(start_at,'localtime')>=?"
    ).get(from).t
    return { todayTotal, rangeTotal }
  })

  // Daily Goals
  ipcMain.handle('goal:add', (_, data) => {
    const { date, goalSeconds, actualSeconds, completedPct } = data
    db.prepare(
      'INSERT INTO daily_goals (date, goal_seconds, actual_seconds, completed_pct) VALUES (?, ?, ?, ?)'
    ).run(date, goalSeconds, actualSeconds, completedPct)
    return { ok: true }
  })

  ipcMain.handle('goal:list', (_, rangeStart) => {
    if (rangeStart) {
      return db.prepare('SELECT * FROM daily_goals WHERE date >= ? ORDER BY date DESC').all(rangeStart)
    }
    return db.prepare('SELECT * FROM daily_goals ORDER BY date DESC LIMIT 30').all()
  })

  // Shell
  ipcMain.handle('shell:open', (_, url) => shell.openExternal(url))

  // Quotes
  ipcMain.handle('quotes:get', async () => fetchQuote(false))
  ipcMain.handle('quotes:refresh', async () => fetchQuote(true))

  // Settings
  ipcMain.handle('settings:get', (_, key) => getSetting(key))
  ipcMain.handle('settings:set', (_, key, value) => { upsertSetting(key, value); return { ok: true } })
  ipcMain.handle('settings:getAll', () => {
    const rows = db.prepare('SELECT * FROM settings').all()
    return Object.fromEntries(rows.map(r => [r.key, r.value]))
  })

  // Export
  ipcMain.handle('export:json', async () => {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export as JSON',
      defaultPath: `kpss-tracker-${getTodayStr()}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (result.canceled) return { canceled: true }

    const data = {
      exported_at: new Date().toISOString(),
      habits: db.prepare('SELECT * FROM habits').all(),
      habit_marks: db.prepare('SELECT * FROM habit_marks ORDER BY date').all(),
      tasks_day: db.prepare("SELECT * FROM tasks WHERE scope='day' ORDER BY date").all(),
      tasks_week: db.prepare("SELECT * FROM tasks WHERE scope='week' ORDER BY week_start_date").all(),
      kpss_categories: db.prepare('SELECT * FROM kpss_categories ORDER BY sort_order').all(),
      kpss_topics: db.prepare('SELECT * FROM kpss_topics ORDER BY category_id, sort_order').all(),
      kpss_videos: db.prepare('SELECT * FROM kpss_videos ORDER BY sort_order').all(),
      subjects: db.prepare('SELECT * FROM subjects ORDER BY name').all(),
      study_segments: db.prepare('SELECT * FROM study_segments ORDER BY start_at').all(),
      practice_sessions: db.prepare('SELECT * FROM practice_sessions ORDER BY date DESC').all(),
      practice_queue: db.prepare('SELECT * FROM practice_queue ORDER BY created_at').all(),
      mock_exams: db.prepare('SELECT * FROM mock_exams ORDER BY date DESC').all(),
      mock_exam_sections: db.prepare('SELECT * FROM mock_exam_sections ORDER BY mock_exam_id, sort_order').all(),
    }
    fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf-8')
    return { ok: true, path: result.filePath }
  })

  ipcMain.handle('export:excel', async () => {
    const ExcelJS = require('exceljs')
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export as Excel',
      defaultPath: `kpss-tracker-${getTodayStr()}.xlsx`,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    })
    if (result.canceled) return { canceled: true }

    const wb = new ExcelJS.Workbook()
    wb.creator = 'KPSS Habit Tracker'

    const addSheet = (name, cols, rows) => {
      const ws = wb.addWorksheet(name)
      ws.columns = cols
      ws.addRows(rows)
      ws.getRow(1).font = { bold: true }
    }

    addSheet('Habits',
      [{ header: 'ID', key: 'id', width: 8 }, { header: 'Name', key: 'name', width: 30 }, { header: 'Created', key: 'created_at', width: 20 }],
      db.prepare('SELECT * FROM habits').all()
    )
    addSheet('Habit Marks',
      [{ header: 'Habit ID', key: 'habit_id', width: 10 }, { header: 'Date', key: 'date', width: 15 }, { header: 'Done', key: 'done', width: 8 }],
      db.prepare('SELECT * FROM habit_marks ORDER BY date').all()
    )
    addSheet('Daily Tasks',
      [{ header: 'ID', key: 'id', width: 8 }, { header: 'Date', key: 'date', width: 12 }, { header: 'Parent', key: 'parent_id', width: 8 }, { header: 'Text', key: 'text', width: 40 }, { header: 'Done', key: 'done', width: 8 }],
      db.prepare("SELECT * FROM tasks WHERE scope='day' ORDER BY date").all()
    )
    addSheet('Weekly Tasks',
      [{ header: 'ID', key: 'id', width: 8 }, { header: 'Week Start', key: 'week_start_date', width: 12 }, { header: 'Parent', key: 'parent_id', width: 8 }, { header: 'Text', key: 'text', width: 40 }, { header: 'Done', key: 'done', width: 8 }],
      db.prepare("SELECT * FROM tasks WHERE scope='week' ORDER BY week_start_date").all()
    )
    addSheet('KPSS Categories',
      [{ header: 'ID', key: 'id', width: 8 }, { header: 'Name', key: 'name', width: 30 }],
      db.prepare('SELECT * FROM kpss_categories ORDER BY sort_order').all()
    )
    addSheet('KPSS Topics',
      [{ header: 'ID', key: 'id', width: 8 }, { header: 'Category ID', key: 'category_id', width: 12 }, { header: 'Text', key: 'text', width: 50 }, { header: 'Done', key: 'done', width: 8 }],
      db.prepare('SELECT * FROM kpss_topics ORDER BY category_id, sort_order').all()
    )
    addSheet('KPSS Videos',
      [{ header: 'ID', key: 'id', width: 8 }, { header: 'Title', key: 'title', width: 50 }, { header: 'Duration (min)', key: 'duration_min', width: 15 }, { header: 'Link', key: 'link', width: 40 }, { header: 'Watched', key: 'done', width: 10 }],
      db.prepare('SELECT * FROM kpss_videos ORDER BY sort_order').all()
    )
    addSheet('Study Subjects',
      [{ header: 'ID', key: 'id', width: 8 }, { header: 'Name', key: 'name', width: 30 }, { header: 'KPSS Category ID', key: 'kpss_category_id', width: 18 }],
      db.prepare('SELECT * FROM subjects ORDER BY name').all()
    )
    addSheet('Study Sessions',
      [
        { header: 'ID', key: 'id', width: 8 },
        { header: 'Subject', key: 'subject_id', width: 10 },
        { header: 'Topic', key: 'topic_text', width: 30 },
        { header: 'Start', key: 'start_at', width: 22 },
        { header: 'End', key: 'end_at', width: 22 },
        { header: 'Duration (s)', key: 'duration_seconds', width: 14 },
        { header: 'Source', key: 'source', width: 10 },
      ],
      db.prepare('SELECT * FROM study_segments ORDER BY start_at').all()
    )
    addSheet('Practice Sessions',
      [
        { header: 'ID', key: 'id', width: 6 },
        { header: 'Date', key: 'date', width: 12 },
        { header: 'Topic', key: 'topic_text', width: 30 },
        { header: 'Total', key: 'total_questions', width: 8 },
        { header: 'Correct', key: 'correct', width: 9 },
        { header: 'Wrong', key: 'wrong', width: 9 },
        { header: 'Blank', key: 'blank', width: 8 },
        { header: 'Uncertain', key: 'uncertain_count', width: 10 },
        { header: 'Unc.Correct', key: 'uncertain_correct_count', width: 12 },
        { header: 'TwoChoice', key: 'two_choice_count', width: 11 },
        { header: 'TC.Correct', key: 'two_choice_correct_count', width: 12 },
        { header: 'Created', key: 'created_at', width: 20 },
      ],
      db.prepare('SELECT * FROM practice_sessions ORDER BY date DESC').all()
    )
    addSheet('Practice Queue',
      [
        { header: 'ID', key: 'id', width: 6 },
        { header: 'Topic', key: 'topic_text', width: 30 },
        { header: 'Target', key: 'target_count', width: 9 },
        { header: 'Done', key: 'done', width: 7 },
        { header: 'Done At', key: 'done_at', width: 22 },
        { header: 'Created', key: 'created_at', width: 20 },
      ],
      db.prepare('SELECT * FROM practice_queue ORDER BY created_at').all()
    )
    addSheet('Mock Exams',
      [
        { header: 'ID', key: 'id', width: 6 },
        { header: 'Name', key: 'name', width: 30 },
        { header: 'Type', key: 'exam_type', width: 10 },
        { header: 'Date', key: 'date', width: 12 },
        { header: 'Created', key: 'created_at', width: 22 },
      ],
      db.prepare('SELECT * FROM mock_exams ORDER BY date DESC').all()
    )
    addSheet('Mock Exam Sections',
      [
        { header: 'ID', key: 'id', width: 6 },
        { header: 'Exam ID', key: 'mock_exam_id', width: 8 },
        { header: 'Subject', key: 'subject_label', width: 30 },
        { header: 'Correct', key: 'correct', width: 10 },
        { header: 'Wrong', key: 'wrong', width: 10 },
        { header: 'Blank', key: 'blank', width: 10 },
        { header: 'Order', key: 'sort_order', width: 8 },
      ],
      db.prepare('SELECT * FROM mock_exam_sections ORDER BY mock_exam_id, sort_order').all()
    )

    await wb.xlsx.writeFile(result.filePath)
    return { ok: true, path: result.filePath }
  })
}

// ==================== Window ====================

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    backgroundColor: '#ffffff',
    show: false,
    titleBarStyle: 'default'
  })

  mainWindow.loadFile(path.join(__dirname, 'build', 'renderer', 'index.html'))

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    showStartupNotification()
    setTimeout(showMotivationalNotification, 40 * 60 * 1000)
  })

  mainWindow.on('close', (e) => {
    if (!app_isQuitting) {
      e.preventDefault()
      mainWindow.hide()
      updateTrayMenu()
    }
  })

  if (isDev) mainWindow.webContents.openDevTools()
}

function createTray() {
  try {
    const iconPath = path.join(__dirname, 'assets', 'icon.ico')
    const icon = fs.existsSync(iconPath)
      ? nativeImage.createFromPath(iconPath)
      : nativeImage.createEmpty()
    tray = new Tray(icon)
    tray.setToolTip('KPSS Habit Tracker')
    tray.on('click', () => { mainWindow.show(); mainWindow.focus() })
    updateTrayMenu()
  } catch (err) {
    console.error('Tray error:', err)
  }
}

function createMiniWindow() {
  if (miniWindow && !miniWindow.isDestroyed()) { miniWindow.show(); return }
  miniWindow = new BrowserWindow({
    width: 300,
    height: 100,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  miniWindow.loadFile(path.join(__dirname, 'build', 'renderer', 'index.html'), {
    query: { widget: 'true' }
  })
  miniWindow.on('closed', () => { miniWindow = null })
}

// ==================== Lifecycle ====================

app.whenReady().then(() => {
  initDatabase()
  runAutoBackup()
  registerIpcHandlers()
  createWindow()
  createTray()

  // powerMonitor: sleep/wake recovery
  powerMonitor.on('suspend', () => {
    if (studyState) studyState.lastSuspendAt = Date.now()
  })

  powerMonitor.on('resume', () => {
    if (!studyState || studyState.isPaused) return
    const suspendAt = studyState.lastSuspendAt
    if (!suspendAt) return
    const gapMs = Date.now() - suspendAt
    if (gapMs < 60000) return  // < 1 minute — ignore
    const gapSeconds = Math.floor(gapMs / 1000)
    studyState.lastSuspendAt = null
    const payload = { gapSeconds }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('study:event:sleepRecovery', payload)
    }
    if (miniWindow && !miniWindow.isDestroyed()) {
      miniWindow.webContents.send('study:event:sleepRecovery', payload)
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => { app_isQuitting = true })

app.on('window-all-closed', () => {
  // On Windows: only quit when app_isQuitting (Quit from tray) or no tray
  if (!tray || app_isQuitting) {
    if (process.platform !== 'darwin') app.quit()
  }
})
