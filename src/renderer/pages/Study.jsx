import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useStudy, fmtElapsed } from '../context/StudyContext'
import { getColor } from '../utils/colors'
import { playPause, playResume, playSwitch, playFinish, playMilestone, playGoalLow, playGoalMid, playGoalGood, playGoalExcellent } from '../utils/sounds'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'

// ─── helpers ────────────────────────────────────────────────────────────────

function getTodayStr() { return new Date().toISOString().slice(0, 10) }

function getDateNDaysAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10)
}

function fmtDuration(seconds) {
  if (!seconds) return '0 dk'
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60)
  if (h > 0 && m > 0) return `${h} saat ${m} dk`
  if (h > 0) return `${h} saat`
  return `${m} dk`
}

function fmtHHMM(seconds) {
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60)
  return `${h}:${String(m).padStart(2, '0')}`
}

function fmtTime(isoStr) {
  if (!isoStr) return ''
  return new Date(isoStr).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

function fmtDateShort(isoStr) {
  if (!isoStr) return ''
  return new Date(isoStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
}

function subjectColor(sub) {
  if (sub?.category_color) return getColor(sub.category_color).hex
  return 'var(--accent)'
}

// ─── Banners ────────────────────────────────────────────────────────────────

function RecoveryBanner() {
  const { recoveryBanner, dismissRecovery } = useStudy()
  if (!recoveryBanner) return null
  const elapsed = recoveryBanner.elapsed_seconds || 0
  const savedAt = recoveryBanner.last_saved_at
    ? new Date(recoveryBanner.last_saved_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    : '?'
  return (
    <div className="study-banner study-banner-warn">
      <div className="study-banner-icon">⚠</div>
      <div className="study-banner-body">
        <strong>Tamamlanmamış oturum bulundu</strong>
        <div className="study-banner-sub">
          {recoveryBanner.subject_name} · {fmtDuration(elapsed)} · son kayıt {savedAt}
        </div>
        <div className="study-banner-sub">Bu süreyi kayıtlara ekleyelim mi?</div>
      </div>
      <div className="study-banner-actions">
        <button className="btn btn-sm btn-primary" onClick={() => dismissRecovery(true)}>Evet, ekle</button>
        <button className="btn btn-sm btn-ghost" onClick={() => dismissRecovery(false)}>Sil</button>
      </div>
    </div>
  )
}

function AlertBanners() {
  const { idleBanner, setIdleBanner, sleepBanner, dismissSleepBanner } = useStudy()
  return (
    <>
      {idleBanner && (
        <div className="study-banner study-banner-idle">
          <div className="study-banner-icon">◔</div>
          <div className="study-banner-body">
            <strong>Hareketsizlik algılandı</strong>
            <div className="study-banner-sub">
              {Math.floor(idleBanner.idleSeconds / 60)} dakikadır aktif giriş yok. Sayaç çalışmaya devam ediyor.
            </div>
          </div>
          <div className="study-banner-actions">
            <button className="btn btn-sm btn-ghost" onClick={() => setIdleBanner(null)}>Tamam</button>
          </div>
        </div>
      )}
      {sleepBanner && (
        <div className="study-banner study-banner-warn">
          <div className="study-banner-icon">💤</div>
          <div className="study-banner-body">
            <strong>Uyku algılandı</strong>
            <div className="study-banner-sub">
              {Math.floor(sleepBanner.gapSeconds / 60)} dakika uyku modundaydı. Bu süreyi oturuma dahil et mi?
            </div>
          </div>
          <div className="study-banner-actions">
            <button className="btn btn-sm btn-primary" onClick={() => dismissSleepBanner(true)}>Dahil et</button>
            <button className="btn btn-sm btn-ghost" onClick={() => dismissSleepBanner(false)}>Çıkar</button>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Ders/Konu Selector ─────────────────────────────────────────────────────

function DersKonuSelector({ subjects, kpssCategories, value, onChange, disabled, onRefreshSubjects }) {
  const [kpssTopics, setKpssTopics] = useState([])
  const sel = subjects.find(s => s.id === value.subjectId)

  useEffect(() => {
    if (sel?.kpss_category_id) {
      window.api.kpss.listTopics(sel.kpss_category_id).then(setKpssTopics)
    } else {
      setKpssTopics([])
    }
  }, [sel?.kpss_category_id])

  async function handleSubjectChange(rawValue) {
    if (!rawValue) { onChange({ subjectId: null, topicText: '' }); return }

    if (rawValue.startsWith('c:')) {
      // KPSS category selected directly — auto-create or find linked subject
      const catId = Number(rawValue.slice(2))
      const cat = kpssCategories.find(c => c.id === catId)
      const subject = await window.api.study.subjects.getOrCreate(catId, cat.name)
      onChange({ subjectId: subject.id, topicText: '' })
      if (onRefreshSubjects) onRefreshSubjects()
    } else {
      onChange({ subjectId: Number(rawValue.slice(2)), topicText: '' })
    }
  }

  // Compute current select value
  function selectVal() {
    if (!value.subjectId) return ''
    return `s:${value.subjectId}`
  }

  // Free subjects (no KPSS link)
  const freeSubjects = subjects.filter(s => !s.kpss_category_id)
  // Subjects already linked to a KPSS category (keyed by category id)
  const linkedByCat = {}
  for (const s of subjects) {
    if (s.kpss_category_id) linkedByCat[s.kpss_category_id] = s
  }

  const hasKpss = sel?.kpss_category_id && kpssTopics.length > 0
  const topicListId = `konu-list-${sel?.id || 'none'}`

  return (
    <div className="study-derskonu">
      {/* Ders */}
      <div className="study-derskonu-row">
        <label className="study-derskonu-label">Ders</label>
        <select
          className="study-select"
          value={selectVal()}
          onChange={e => handleSubjectChange(e.target.value)}
          disabled={disabled}
          style={{ flex: 1 }}
        >
          <option value="">Ders seçin…</option>

          {freeSubjects.length > 0 && (
            <optgroup label="Serbest Dersler">
              {freeSubjects.map(s => (
                <option key={`s:${s.id}`} value={`s:${s.id}`}>{s.name}</option>
              ))}
            </optgroup>
          )}

          {kpssCategories.length > 0 && (
            <optgroup label="KPSS Kategorileri">
              {kpssCategories.map(c => {
                const linked = linkedByCat[c.id]
                const optVal = linked ? `s:${linked.id}` : `c:${c.id}`
                return <option key={`c:${c.id}`} value={optVal}>{c.name}</option>
              })}
            </optgroup>
          )}
        </select>
      </div>

      {/* Konu */}
      {value.subjectId && (
        <div className="study-derskonu-row">
          <label className="study-derskonu-label">Konu</label>
          <div style={{ flex: 1 }}>
            <input
              type="text"
              list={hasKpss ? topicListId : undefined}
              placeholder={hasKpss ? 'Konuyu seçin veya yazın…' : 'Konu (opsiyonel)…'}
              value={value.topicText}
              onChange={e => onChange({ ...value, topicText: e.target.value })}
              disabled={disabled}
              autoComplete="off"
            />
            {hasKpss && (
              <datalist id={topicListId}>
                {kpssTopics.map(t => <option key={t.id} value={t.text} />)}
              </datalist>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Timer Panel ────────────────────────────────────────────────────────────

function TimerPanel({ subjects, kpssCategories, onRefreshSubjects, onFocusMode }) {
  const { session, displayElapsed, startSession, pauseSession, resumeSession, stopSession, cancelSession, switchSubject } = useStudy()

  const [sel, setSel] = useState({ subjectId: null, topicText: '' })
  const [switchSel, setSwitchSel] = useState({ subjectId: null, topicText: '' })
  const [switching, setSwitching] = useState(false)
  const [confirmStop, setConfirmStop] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  useEffect(() => {
    if (session) setSel({ subjectId: session.subjectId, topicText: session.topicText })
  }, [session?.subjectId])

  async function handleStart() {
    if (!sel.subjectId) return
    await startSession(sel.subjectId, sel.topicText)
  }

  async function handleStop() {
    playFinish()
    await stopSession()
    setConfirmStop(false)
    setSwitching(false)
  }

  async function handleCancel() {
    await cancelSession()
    setConfirmCancel(false)
    setSwitching(false)
  }

  async function handleSwitch() {
    if (!switchSel.subjectId) return
    playSwitch()
    await switchSubject(switchSel.subjectId, switchSel.topicText)
    setSwitching(false)
    setSwitchSel({ subjectId: null, topicText: '' })
  }

  const isRunning = session && !session.isPaused
  const isPaused = session && session.isPaused
  const sessionSubject = subjects.find(s => s.id === session?.subjectId)
  const dotColor = sessionSubject ? subjectColor(sessionSubject) : 'var(--accent)'

  return (
    <div className="study-timer-panel">
      {/* Clock */}
      <div className={`study-clock${isRunning ? ' running' : isPaused ? ' paused' : ''}`}
           style={isRunning ? { '--clock-color': dotColor } : {}}>
        <div className="study-clock-display mono" style={{ color: isRunning ? dotColor : isPaused ? 'var(--gold)' : 'var(--text)' }}>
          {fmtElapsed(displayElapsed)}
        </div>
        {session && (
          <div className="study-clock-subject">
            {session.subjectName}
            {session.topicText && <span className="study-clock-topic"> · {session.topicText}</span>}
          </div>
        )}
      </div>

      {/* Start form */}
      {!session && (
        <div className="study-start-card">
          <DersKonuSelector
            subjects={subjects}
            kpssCategories={kpssCategories}
            value={sel}
            onChange={setSel}
            disabled={false}
            onRefreshSubjects={onRefreshSubjects}
          />
          <button
            className="btn btn-primary"
            style={{ marginTop: 4, alignSelf: 'flex-start' }}
            onClick={handleStart}
            disabled={!sel.subjectId}
          >
            ▶ Başla
          </button>
        </div>
      )}

      {/* Running controls */}
      {session && !switching && (
        <div className="study-running-controls">
          {isRunning
            ? <button className="btn btn-ghost" onClick={() => { playPause(); pauseSession() }}>⏸ Duraklat</button>
            : <button className="btn btn-primary" onClick={() => { playResume(); resumeSession() }}>▶ Devam et</button>
          }
          <button className="btn btn-ghost" onClick={() => { playSwitch(); setSwitching(true) }}>⇄ Ders değiştir</button>

          {!confirmStop && !confirmCancel && (
            <>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--warn)' }} onClick={() => setConfirmStop(true)}>■ Bitir</button>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--text-light)' }} onClick={() => setConfirmCancel(true)}>✕ İptal</button>
            </>
          )}
          {confirmStop && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Emin misin?</span>
              <button className="btn btn-danger btn-sm" onClick={handleStop}>Evet, bitir</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmStop(false)}>Hayır</button>
            </span>
          )}
          {confirmCancel && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--warn)' }}>Süre silinecek!</span>
              <button className="btn btn-danger btn-sm" onClick={handleCancel}>Evet, sil</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmCancel(false)}>Hayır</button>
            </span>
          )}

          <button className="btn btn-ghost btn-sm" onClick={onFocusMode} title="Odak modu">⤢</button>
          <button className="btn btn-ghost btn-sm" onClick={() => window.api.study.widget.open()} title="Mini pencere">⧉</button>
        </div>
      )}

      {/* Switch subject */}
      {session && switching && (
        <div className="study-switch-card">
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>Ders değiştir (sayaç sıfırlanmaz):</div>
          <DersKonuSelector
            subjects={subjects.filter(s => s.id !== session.subjectId)}
            kpssCategories={kpssCategories}
            value={switchSel}
            onChange={setSwitchSel}
            disabled={false}
            onRefreshSubjects={onRefreshSubjects}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={handleSwitch} disabled={!switchSel.subjectId}>
              Geçiş yap
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setSwitching(false)}>İptal</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Monthly Heatmap ─────────────────────────────────────────────────────────

const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

function MonthlyHeatmap({ heatmapData }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    const n = new Date(); n.setMonth(n.getMonth())
    if (year > n.getFullYear() || (year === n.getFullYear() && month >= n.getMonth())) return
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDow = new Date(year, month, 1).getDay() // 0=Sun
  const paddingBefore = (firstDow + 6) % 7 // Monday-start offset

  const maxSeconds = Math.max(...Object.values(heatmapData).filter(v => v > 0), 1)
  function intensity(s) {
    if (!s) return 0
    return Math.min(4, Math.ceil((s / maxSeconds) * 4))
  }

  const monthStr = new Date(year, month).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
  const todayStr = getTodayStr()

  return (
    <div className="study-monthly-heatmap">
      <div className="study-monthly-nav">
        <button className="icon-btn" onClick={prevMonth}>‹</button>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{monthStr}</span>
        <button className="icon-btn" onClick={nextMonth}>›</button>
      </div>
      <div className="study-monthly-grid">
        {WEEKDAYS.map(d => (
          <div key={d} className="study-monthly-weekday">{d}</div>
        ))}
        {Array.from({ length: paddingBefore }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const mm = String(month + 1).padStart(2, '0')
          const dd = String(day).padStart(2, '0')
          const ds = `${year}-${mm}-${dd}`
          const secs = heatmapData[ds] || 0
          const isToday = ds === todayStr
          const isFuture = ds > todayStr
          const tooltip = isFuture ? undefined : `${dd}.${mm}.${year}: ${fmtDuration(secs)}`
          return (
            <div
              key={ds}
              className={`study-monthly-cell heat-${isFuture ? 0 : intensity(secs)}${isToday ? ' today' : ''}`}
              data-tooltip={tooltip}
            >
              <span className="study-monthly-day-num">{day}</span>
            </div>
          )
        })}
      </div>
      <div className="study-heatmap-legend" style={{ marginTop: 8 }}>
        <span style={{ fontSize: 10, color: 'var(--text-light)' }}>Az</span>
        {[0, 1, 2, 3, 4].map(i => <div key={i} className={`study-heatmap-cell heat-${i}`} />)}
        <span style={{ fontSize: 10, color: 'var(--text-light)' }}>Çok</span>
      </div>
    </div>
  )
}

// ─── Custom Pie Tooltip ──────────────────────────────────────────────────────

function PieTooltip({ active, payload, topicsBySubject }) {
  if (!active || !payload || !payload.length) return null
  const d = payload[0].payload
  const topics = topicsBySubject[d.id] || []
  return (
    <div className="study-pie-tooltip">
      <div className="study-pie-tooltip-name">{d.name}</div>
      <div className="study-pie-tooltip-total">{fmtDuration(d.total_seconds)}</div>
      {topics.slice(0, 4).map((t, i) => (
        <div key={i} className="study-pie-tooltip-topic">
          <span className="study-pie-tooltip-dot">·</span>
          <span>{t.topic}</span>
          <span className="study-pie-tooltip-tdur">{fmtDuration(t.total_seconds)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Session History ─────────────────────────────────────────────────────────

function SessionHistory({ sessions, onRefresh }) {
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [confirmDeleteDay, setConfirmDeleteDay] = useState(null)

  if (!sessions || sessions.length === 0) {
    return <div style={{ color: 'var(--text-light)', fontSize: 13 }}>Bu periyotta oturum yok.</div>
  }

  async function handleDeleteSession(id) {
    await window.api.study.segments.delete(id)
    setConfirmDeleteId(null)
    onRefresh()
  }

  async function handleDeleteDay(date) {
    await window.api.study.segments.deleteDay(date)
    setConfirmDeleteDay(null)
    onRefresh()
  }

  // Group by date
  const byDate = {}
  for (const s of sessions) {
    const day = s.start_at.slice(0, 10)
    if (!byDate[day]) byDate[day] = []
    byDate[day].push(s)
  }

  return (
    <div className="study-session-history">
      {Object.entries(byDate).map(([day, daySessions]) => {
        const dayTotal = daySessions.reduce((a, b) => a + b.duration_seconds, 0)
        const [yyyy, mm, dd] = day.split('-')
        const dayLabel = new Date(day + 'T12:00:00').toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        return (
          <div key={day} className="study-session-day">
            <div className="study-session-day-header">
              <span>{dayLabel}</span>
              <span className="study-session-day-total mono">{fmtDuration(dayTotal)}</span>
              {confirmDeleteDay === day ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--warn)' }}>Günün tümü silinsin?</span>
                  <button className="btn btn-danger btn-xs" onClick={() => handleDeleteDay(day)}>Evet</button>
                  <button className="btn btn-ghost btn-xs" onClick={() => setConfirmDeleteDay(null)}>İptal</button>
                </span>
              ) : (
                <button
                  className="icon-btn danger study-session-day-del"
                  title="Günün tüm oturumlarını sil"
                  onClick={() => { setConfirmDeleteId(null); setConfirmDeleteDay(day) }}
                >🗑</button>
              )}
            </div>
            {daySessions.map(s => {
              const color = s.category_color ? getColor(s.category_color).hex : 'var(--accent)'
              return (
                <div key={s.id} className="study-session-row">
                  <div className="study-session-dot" style={{ background: color }} />
                  <div className="study-session-info">
                    <span className="study-session-subject">{s.subject_name}</span>
                    {s.topic_text && <span className="study-session-topic"> · {s.topic_text}</span>}
                    {s.source === 'manual' && <span className="badge badge-neutral" style={{ fontSize: 9, marginLeft: 6 }}>manuel</span>}
                  </div>
                  <div className="study-session-meta mono">
                    {fmtTime(s.start_at)}–{fmtTime(s.end_at)}
                  </div>
                  <div className="study-session-dur mono">{fmtDuration(s.duration_seconds)}</div>
                  {confirmDeleteId === s.id ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                      <button className="btn btn-danger btn-xs" onClick={() => handleDeleteSession(s.id)}>Sil</button>
                      <button className="btn btn-ghost btn-xs" onClick={() => setConfirmDeleteId(null)}>İptal</button>
                    </span>
                  ) : (
                    <button
                      className="icon-btn danger study-session-del-btn"
                      title="Bu oturumu sil"
                      onClick={() => { setConfirmDeleteDay(null); setConfirmDeleteId(s.id) }}
                    >✕</button>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// ─── Stats Panel ─────────────────────────────────────────────────────────────

function StatsPanel() {
  const [range, setRange] = useState('week')
  const [stats, setStats] = useState(null)
  const [heatmap, setHeatmap] = useState({})
  const [breakStats, setBreakStats] = useState(null)
  const [goalSessions, setGoalSessions] = useState([])
  const [showSessions, setShowSessions] = useState(false)
  const { session, displayElapsed } = useStudy()

  const rangeStart = range === 'day' ? getTodayStr()
    : range === 'week' ? getDateNDaysAgo(6)
    : getDateNDaysAgo(29)

  const load = useCallback(async () => {
    const [s, h, bs, gs] = await Promise.all([
      window.api.study.stats.get(rangeStart),
      window.api.study.stats.heatmap(),
      window.api.breaks.stats(rangeStart),
      window.api.goals.list(rangeStart),
    ])
    setStats(s)
    setHeatmap(h)
    setBreakStats(bs)
    setGoalSessions(gs)
  }, [range])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (!session) load() }, [session])

  if (!stats) return <div style={{ padding: 40, color: 'var(--text-muted)' }}>Yükleniyor…</div>

  const todayTotalSeconds = stats.todayTotal + (session && !session.isPaused ? displayElapsed : 0)

  // Bar chart — show DD.MM format on axis
  const barData = stats.dailyTotals.map(d => {
    const [yyyy, mm, dd] = d.day.split('-')
    return {
      day: `${dd}.${mm}`,
      fullDate: `${dd}.${mm}.${yyyy}`,
      minutes: Math.round(d.total_seconds / 60),
    }
  })

  // Pie - use category colors
  const total = stats.subjectBreakdown.reduce((a, b) => a + b.total_seconds, 0)
  let pieData = stats.subjectBreakdown.slice(0, 6)
  const others = stats.subjectBreakdown.slice(6)
  if (others.length > 0) {
    pieData = [...pieData, {
      id: -1,
      name: 'Diğer',
      total_seconds: others.reduce((a, b) => a + b.total_seconds, 0),
      category_color: null,
    }]
  }

  function pieColor(entry, idx) {
    if (entry.category_color) return getColor(entry.category_color).hex
    // Fallback palette for free subjects
    const fallbacks = ['#5a4fcf','#0b9e74','#e09320','#0891b2','#a855f7','#ef4444','#6b7280']
    return fallbacks[idx % fallbacks.length]
  }

  const goalSec = stats.dailyGoalSeconds
  const goalPct = goalSec > 0 ? Math.min(100, Math.round((todayTotalSeconds / goalSec) * 100)) : 0

  return (
    <div className="study-stats">
      {/* Top stat cards */}
      <div className="study-stats-row4">
        <div className="study-stat-card accent">
          <div className="study-stat-value">{fmtDuration(todayTotalSeconds)}</div>
          <div className="study-stat-label">Bugün</div>
          {stats.todayVsYday !== 0 && (
            <div className={`study-stat-vs ${stats.todayVsYday > 0 ? 'pos' : 'neg'}`}>
              {stats.todayVsYday > 0 ? '+' : ''}{fmtDuration(Math.abs(stats.todayVsYday))} dünden
            </div>
          )}
        </div>
        <div className="study-stat-card">
          <div className="study-stat-value mono">{stats.studyStreak.current}</div>
          <div className="study-stat-label">Mevcut seri</div>
          <div className="study-stat-vs">{fmtDuration(goalSec)}/gün hedef</div>
        </div>
        <div className="study-stat-card">
          <div className="study-stat-value">{fmtDuration(stats.longestSession)}</div>
          <div className="study-stat-label">En uzun oturum</div>
        </div>
        <div className="study-stat-card">
          <div className="study-stat-value mono">{stats.sessionCount}</div>
          <div className="study-stat-label">Oturum sayısı</div>
          <div className="study-stat-vs">Ort. {fmtDuration(stats.avgSession)}</div>
        </div>
      </div>

      {/* Mola özeti */}
      {breakStats && (breakStats.rangeTotal > 0 || breakStats.todayTotal > 0) && (
        <div className="break-stat-row">
          <span>☕</span>
          <span style={{ color: 'var(--text-muted)' }}>Mola:</span>
          <strong>{fmtDuration(breakStats.rangeTotal)}</strong>
          {breakStats.todayTotal > 0 && breakStats.rangeTotal !== breakStats.todayTotal && (
            <span style={{ fontSize: 11, color: 'var(--text-light)', fontFamily: 'var(--font-mono)' }}>
              ({fmtDuration(breakStats.todayTotal)} bugün)
            </span>
          )}
        </div>
      )}

      {/* Goal progress bar */}
      {goalSec > 0 && (
        <div className="study-goal-bar">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Günlük hedef</span>
            <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: goalPct >= 100 ? 'var(--success)' : 'var(--text-muted)' }}>
              {fmtDuration(todayTotalSeconds)} / {fmtDuration(goalSec)} ({goalPct}%)
            </span>
          </div>
          <div className="progress-track">
            <div className={`progress-fill${goalPct >= 100 ? ' full' : ''}`} style={{ width: `${goalPct}%` }} />
          </div>
        </div>
      )}

      {/* Stats tabs: Gün / Hafta / Ay */}
      <div className="study-stats-range-tabs">
        {[
          { id: 'day',   label: 'Gün' },
          { id: 'week',  label: 'Hafta' },
          { id: 'month', label: 'Ay' },
        ].map(r => (
          <button key={r.id}
            className={`study-stats-tab-btn${range === r.id ? ' active' : ''}`}
            onClick={() => setRange(r.id)}>
            {r.label}
          </button>
        ))}
      </div>

      {/* Bar chart */}
      <div className="study-section-title">Günlük Çalışma</div>
      <div style={{ height: 150, marginBottom: 24 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={barData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload
                const v = d.minutes
                const h = Math.floor(v / 60), m = v % 60
                const durStr = h > 0 ? (m > 0 ? `${h} saat ${m} dk` : `${h} saat`) : `${m} dk`
                return (
                  <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 11px', fontSize: 12, boxShadow: 'var(--shadow-md)' }}>
                    <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>{d.fullDate}</div>
                    <div style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{durStr}</div>
                  </div>
                )
              }}
            />
            <Bar dataKey="minutes" fill="var(--accent)" radius={[3, 3, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Pie + monthly heatmap side by side */}
      <div className="study-charts-row">
        {/* Donut */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="study-section-title">Ders Dağılımı</div>
          {pieData.length === 0
            ? <div style={{ color: 'var(--text-light)', fontSize: 13 }}>Veri yok</div>
            : (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <PieChart width={130} height={130}>
                  <Pie data={pieData} cx={60} cy={60} innerRadius={35} outerRadius={58}
                    dataKey="total_seconds" paddingAngle={2}>
                    {pieData.map((entry, i) => <Cell key={i} fill={pieColor(entry, i)} />)}
                  </Pie>
                  <Tooltip content={<PieTooltip topicsBySubject={stats.topicsBySubject} />} />
                </PieChart>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingTop: 4 }}>
                  {pieData.map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: pieColor(d, i), flexShrink: 0 }} />
                      <span style={{ fontSize: 12 }}>{d.name}</span>
                      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginLeft: 'auto', paddingLeft: 8 }}>
                        {total > 0 ? Math.round(d.total_seconds / total * 100) : 0}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          }
          <div style={{ fontSize: 10, color: 'var(--text-light)', marginTop: 8 }}>Fareyle üzerine gel → konu detayı</div>
        </div>

        {/* Monthly heatmap */}
        <div style={{ flex: 1, minWidth: 240 }}>
          <div className="study-section-title">Aylık Isı Haritası</div>
          <MonthlyHeatmap heatmapData={heatmap} />
        </div>
      </div>

      <div className="divider" />

      {/* Goal sessions */}
      {goalSessions.length > 0 && (
        <div className="study-goal-sessions">
          <div className="study-section-title">Hedef Oturumları</div>
          {goalSessions.map(g => {
            const clampedPct = Math.min(100, g.completed_pct)
            const color = g.completed_pct >= 91 ? 'var(--accent)' : g.completed_pct >= 61 ? 'var(--success)' : g.completed_pct >= 31 ? 'var(--gold)' : 'var(--warn)'
            const dayLabel = new Date(g.date + 'T12:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
            return (
              <div key={g.id} className="goal-session-row">
                <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 52 }}>{dayLabel}</span>
                <div className="goal-session-bar-wrap">
                  <div className="goal-session-bar-fill" style={{ width: `${clampedPct}%`, background: color }} />
                </div>
                <span className="mono" style={{ fontSize: 13, color, minWidth: 44, textAlign: 'right' }}>%{g.completed_pct}</span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-light)', marginLeft: 6 }}>
                  {fmtDuration(g.actual_seconds)}/{fmtDuration(g.goal_seconds)}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <div className="divider" />

      {/* Session history */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="study-section-title" style={{ marginBottom: 0 }}>Oturum Geçmişi</div>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowSessions(v => !v)}>
          {showSessions ? '▲ Gizle' : '▼ Göster'}
        </button>
      </div>
      {showSessions && <SessionHistory sessions={stats.sessions} onRefresh={load} />}
    </div>
  )
}

// ─── Subjects (Dersler) Panel ─────────────────────────────────────────────────

function DersleriPanel({ subjects, kpssCategories, onRefresh }) {
  const [newName, setNewName] = useState('')
  const [newCatId, setNewCatId] = useState('')
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editCatId, setEditCatId] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const addInputRef = useRef(null)

  async function addSubject() {
    const name = newName.trim()
    if (!name) return
    await window.api.study.subjects.add(name, newCatId ? Number(newCatId) : null)
    setNewName('')
    setNewCatId('')
    onRefresh()
  }

  async function saveEdit(id) {
    const name = editName.trim()
    if (!name) return
    await window.api.study.subjects.update(id, name, editCatId ? Number(editCatId) : null)
    setEditId(null)
    onRefresh()
  }

  async function doDelete(id) {
    await window.api.study.subjects.delete(id)
    setConfirmDeleteId(null)
    setEditId(null)
    onRefresh()
    // Restore focus to add input after refresh
    setTimeout(() => addInputRef.current?.focus(), 50)
  }

  return (
    <div>
      <div className="study-section-title">Derslerim</div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
        Serbest dersler her konuyu serbest yazmanızı sağlar. KPSS kategorisine bağlı dersler ise o kategorideki konuları otomatik önerir.
      </p>

      {/* Add new */}
      <div className="study-subjects-add">
        <input
          ref={addInputRef}
          type="text"
          placeholder="Yeni ders adı…"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addSubject()}
          style={{ flex: 1 }}
        />
        <select
          className="study-select"
          value={newCatId}
          onChange={e => setNewCatId(e.target.value)}
          style={{ width: 200 }}
        >
          <option value="">Serbest ders (KPSS'siz)</option>
          {kpssCategories.map(c => <option key={c.id} value={c.id}>KPSS: {c.name}</option>)}
        </select>
        <button className="btn btn-primary btn-sm" onClick={addSubject} disabled={!newName.trim()}>
          Ekle
        </button>
      </div>

      {/* List */}
      <div className="study-subjects-list" style={{ marginTop: 16 }}>
        {subjects.length === 0 && (
          <div style={{ color: 'var(--text-light)', fontSize: 13, padding: '10px 0' }}>
            Henüz ders eklenmemiş.
          </div>
        )}
        {subjects.map(s => {
          const cat = kpssCategories.find(c => c.id === s.kpss_category_id)
          const color = cat ? getColor(cat.color).hex : 'var(--text-light)'
          return (
            <div key={s.id} className="study-subject-row">
              {/* Color dot */}
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />

              {editId === s.id ? (
                <>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(s.id); if (e.key === 'Escape') setEditId(null) }}
                    style={{ flex: 1 }}
                    autoFocus
                  />
                  <select className="study-select" value={editCatId} onChange={e => setEditCatId(e.target.value)} style={{ width: 180 }}>
                    <option value="">Serbest</option>
                    {kpssCategories.map(c => <option key={c.id} value={c.id}>KPSS: {c.name}</option>)}
                  </select>
                  <button className="btn btn-primary btn-xs" onClick={() => saveEdit(s.id)}>Kaydet</button>
                  <button className="btn btn-ghost btn-xs" onClick={() => setEditId(null)}>İptal</button>
                </>
              ) : (
                <>
                  <span className="study-subject-name">{s.name}</span>
                  {cat && (
                    <span className="badge" style={{ fontSize: 10, background: getColor(cat.color).bg, color: getColor(cat.color).hex }}>
                      {cat.name}
                    </span>
                  )}
                  {confirmDeleteId === s.id ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sil?</span>
                      <button className="btn btn-danger btn-xs" onClick={() => doDelete(s.id)}>Evet</button>
                      <button className="btn btn-ghost btn-xs" onClick={() => setConfirmDeleteId(null)}>Hayır</button>
                    </span>
                  ) : (
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                      <button className="icon-btn" onClick={() => {
                        setEditId(s.id); setEditName(s.name)
                        setEditCatId(s.kpss_category_id ? String(s.kpss_category_id) : '')
                        setConfirmDeleteId(null)
                      }}>✎</button>
                      <button className="icon-btn danger" onClick={() => { setConfirmDeleteId(s.id); setEditId(null) }}>✕</button>
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Manual Entry ─────────────────────────────────────────────────────────────

function ManualEntryPanel({ subjects, kpssCategories, onRefreshSubjects }) {
  const [dersKonu, setDersKonu] = useState({ subjectId: null, topicText: '' })
  const [date, setDate] = useState(getTodayStr())
  const [mode, setMode] = useState('duration')
  const [durationH, setDurationH] = useState('0')
  const [durationM, setDurationM] = useState('30')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [saved, setSaved] = useState(false)

  async function handleAdd() {
    if (!dersKonu.subjectId) return
    let data = { subjectId: dersKonu.subjectId, topicText: dersKonu.topicText, date }
    if (mode === 'duration') {
      data.durationSeconds = (parseInt(durationH) || 0) * 3600 + (parseInt(durationM) || 0) * 60
    } else {
      data.startAt = `${date}T${startTime}:00`
      data.endAt   = `${date}T${endTime}:00`
    }
    await window.api.study.manual.add(data)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    setDersKonu(v => ({ ...v, topicText: '' }))
    setDurationH('0')
    setDurationM('30')
  }

  return (
    <div>
      <div className="study-section-title">Manuel Giriş</div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
        Uygulama dışında (kağıt, dışarıda vs.) yaptığın çalışmaları ekle.
      </p>
      <div className="card" style={{ maxWidth: 500 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <DersKonuSelector
            subjects={subjects}
            kpssCategories={kpssCategories}
            value={dersKonu}
            onChange={setDersKonu}
            disabled={false}
            onRefreshSubjects={onRefreshSubjects}
          />

          <div>
            <label className="study-field-label">Tarih</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: 'auto' }} />
          </div>

          <div>
            <label className="study-field-label">Süre türü</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className={`btn btn-sm${mode === 'duration' ? ' btn-primary' : ' btn-ghost'}`} onClick={() => setMode('duration')}>Süre gir</button>
              <button className={`btn btn-sm${mode === 'range' ? ' btn-primary' : ' btn-ghost'}`} onClick={() => setMode('range')}>Başlangıç / Bitiş</button>
            </div>
          </div>

          {mode === 'duration' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="number" min="0" max="23" value={durationH} onChange={e => setDurationH(e.target.value)} style={{ width: 64 }} />
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>saat</span>
              <input type="number" min="0" max="59" value={durationM} onChange={e => setDurationM(e.target.value)} style={{ width: 64 }} />
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>dakika</span>
            </div>
          )}

          {mode === 'range' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={{ width: 100 }} />
              <span style={{ color: 'var(--text-muted)' }}>—</span>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={{ width: 100 }} />
            </div>
          )}

          <div>
            <button className="btn btn-primary" onClick={handleAdd} disabled={!dersKonu.subjectId}>
              Kaydet
            </button>
            {saved && <span style={{ marginLeft: 12, fontSize: 12, color: 'var(--success)', fontFamily: 'var(--font-mono)' }}>✓ Kaydedildi</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Break Timer ──────────────────────────────────────────────────────────────

function BreakTimerPanel({ studyRunning }) {
  const [phase, setPhase]     = useState('idle') // idle | setup | running | paused | done
  const [mode, setMode]       = useState('countdown') // countdown | countup
  const [target, setTarget]   = useState(10 * 60) // seconds
  const [customMin, setCustomMin] = useState('10')
  const [elapsed, setElapsed] = useState(0)
  const [startAt, setStartAt] = useState(null)
  const intervalRef = useRef(null)

  useEffect(() => () => clearInterval(intervalRef.current), [])

  useEffect(() => {
    if (phase === 'running') {
      intervalRef.current = setInterval(() => {
        setElapsed(s => {
          const next = s + 1
          if (mode === 'countdown' && next >= target) {
            clearInterval(intervalRef.current)
            finishBreak(next)
            return next
          }
          return next
        })
      }, 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [phase, mode, target])

  async function finishBreak(dur) {
    const durationSec = dur ?? elapsed
    setPhase('done')
    if (startAt && durationSec > 0) {
      await window.api.breaks.add({ duration_seconds: durationSec, mode, start_at: startAt.toISOString() })
    }
    setTimeout(() => { setPhase('idle'); setElapsed(0) }, 3000)
  }

  async function stopBreak() {
    clearInterval(intervalRef.current)
    await finishBreak(elapsed)
  }

  function startBreak() {
    setElapsed(0)
    setStartAt(new Date())
    setPhase('running')
  }

  const displaySecs = mode === 'countdown' ? Math.max(0, target - elapsed) : elapsed
  const countdownPct = mode === 'countdown' && target > 0 ? Math.min(100, (elapsed / target) * 100) : 0

  if (phase === 'idle') {
    return (
      <div className="break-timer-idle">
        <button
          className="btn btn-ghost btn-sm"
          disabled={studyRunning}
          onClick={() => setPhase('setup')}
          title={studyRunning ? 'Ders sayacı çalışırken mola başlatılamaz' : undefined}
        >
          ☕ Mola Başlat
        </button>
        {studyRunning && (
          <span style={{ fontSize: 11, color: 'var(--text-light)' }}>Ders durdurulunca aktif olur</span>
        )}
      </div>
    )
  }

  if (phase === 'setup') {
    return (
      <div className="break-timer-panel">
        <div className="break-timer-title">Mola türü</div>
        <div className="break-mode-row">
          <button className={`break-mode-btn${mode === 'countdown' ? ' active' : ''}`} onClick={() => setMode('countdown')}>
            ⏱ Geri Sayım
          </button>
          <button className={`break-mode-btn${mode === 'countup' ? ' active' : ''}`} onClick={() => setMode('countup')}>
            ▶ Serbest
          </button>
        </div>
        {mode === 'countdown' && (
          <div className="break-preset-row">
            {[10, 15].map(m => (
              <button
                key={m}
                className={`btn btn-sm${target === m * 60 ? ' btn-primary' : ' btn-ghost'}`}
                onClick={() => { setTarget(m * 60); setCustomMin(String(m)) }}
              >
                {m} dk
              </button>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <input
                type="number" min="1" max="120"
                value={customMin}
                onChange={e => { setCustomMin(e.target.value); setTarget((parseInt(e.target.value) || 10) * 60) }}
                style={{ width: 54, fontSize: 13 }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>dk</span>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="btn btn-primary btn-sm" onClick={startBreak}>Başla</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setPhase('idle')}>İptal</button>
        </div>
      </div>
    )
  }

  if (phase === 'done') {
    return (
      <div className="break-timer-panel">
        <div style={{ color: 'var(--success)', fontFamily: 'var(--font-mono)', fontSize: 20, marginBottom: 4 }}>✓ Mola bitti!</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtElapsed(elapsed)} mola yapıldı</div>
      </div>
    )
  }

  return (
    <div className="break-timer-panel">
      {mode === 'countdown' && (
        <div className="break-countdown-bar">
          <div className="break-countdown-fill" style={{ width: `${countdownPct}%` }} />
        </div>
      )}
      <div className={`break-clock-display mono${phase === 'paused' ? ' paused' : ''}`}>
        {fmtElapsed(displaySecs)}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
        {mode === 'countdown' ? 'Kalan süre' : 'Mola süresi'}
        {mode === 'countdown' && <span style={{ marginLeft: 6, opacity: 0.6 }}>({Math.round(target / 60)} dk)</span>}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {phase === 'running'
          ? <button className="btn btn-ghost btn-sm" onClick={() => setPhase('paused')}>⏸ Duraklat</button>
          : <button className="btn btn-primary btn-sm" onClick={() => setPhase('running')}>▶ Devam</button>
        }
        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--warn)' }} onClick={stopBreak}>■ Bitir</button>
      </div>
    </div>
  )
}

// ─── Daily Goal Constants ────────────────────────────────────────────────────

const MOTIVATIONAL_QUOTES = [
  'Her dakika seni hedefe bir adım daha yaklaştırıyor.',
  'Bugün ekilenler, yarın hasat olur.',
  'Başarı, küçük çabaların tekrar tekrar birikmesidir.',
  'Zirveye giden yol, adım adım tırmanmaktan geçer.',
  'Beyin bir kastır; ne kadar çalışırsan o kadar güçlenir.',
  'Şu an yaptıkların, yarınını şekillendirir.',
  'Başkalarının uyuduğu saatlerde sen çalışıyorsun. Bu fark her şeydir.',
  'Hedefin var; bu yol zorlu ama imkânsız değil.',
  'KPSS bir maraton; her çalışma seansı bir adım ilerlemektir.',
  'Yarın ne olmak istediğini düşün, bugün o kişi gibi çalış.',
  'Zorluk olmadan ilerleme olmaz.',
  'Küçük adımlar, büyük mesafeler kat eder.',
  'Kendini bugün zorla; yarınki sen teşekkür edecek.',
  'Konsantrasyon bir hediyedir — onu şu an kendinle paylaşıyorsun.',
  'Kararlılık, zekâdan daha güçlüdür.',
]

const GOAL_MESSAGES = {
  t10: [
    'Neredeyse hiç çalışmamışsın! %{pct} ile bu sınav kazanılmaz — bu ciddi bir uyarı!',
    'Bu kadar mı? %{pct} — mücadele etmeden başarı olmaz. Yarın sıfırdan başla ve kendini zorla!',
    'KPSS sana izin vermez! %{pct} tamamen yetersiz. Harekete geç, vakit geçiyor!',
  ],
  t20: [
    'Çok düşük: %{pct}. Rakiplerin bu saatte çalışıyor, sen neredesin?',
    '%{pct} tamamlama... Bu tempo ile nereye varacaksın? Kendine karşı dürüst ol!',
    'Bugün kendini hayal kırıklığına uğrattın. %{pct} kabul edilemez — yarın daha iyisini yap!',
  ],
  t30: [
    'Hedefinizin yalnızca %{pct}\'ini yaptın. Bu yeterli değil — yarın daha fazlasını hedefle!',
    '%{pct} ile çok geri kaldın. KPSS af etmez; bu azimle öne çıkamazsın!',
    'Potansiyelinin çok altındasın. %{pct} bir başlangıç sayılmaz — kendini zorla!',
  ],
  t40: [
    'Ortalama bile değil: %{pct}. Biraz daha itersen çok daha ileri gidebilirsin!',
    '%{pct} — fena değil ama yeterli de değil. Yarın çıtayı biraz daha yükselt!',
    'Yarıya bile gelemedin, %{pct}. Motivasyonunu topla ve gaza bas!',
  ],
  t50: [
    'Neredeyse yarısındasın: %{pct}. Devam et, bitirmeden durma!',
    '%{pct} ile yarı yoldaydın. Ortalama çalışma ortalama sonuç getirir!',
    'İyi bir başlangıç: %{pct}. Ama KPSS\'de fark yaratmak için daha fazlası lazım!',
  ],
  t60: [
    'Yarıyı geçtin: %{pct}. Daha iyi olabilirdi ama kötü de değil — devam et!',
    '%{pct} — ne iyi ne kötü. Yarın kendine daha fazlasını hedefle!',
    'Biraz daha isteseydin %{pct}\'den çok daha yukarıda olabilirdin!',
  ],
  t70: [
    'İyi bir gün: %{pct}! Devam edersen bu azim seni zirveye taşır.',
    '%{pct} tamamlandı — güzel bir performans! Yarın daha iyisini yap!',
    'Bravo! %{pct} ile dürüst bir çalışma günü geçirdin. Bu tempo sürsün!',
  ],
  t80: [
    'Harika! %{pct} — hedefe çok yaklaştın. Bu disiplin seni ileri götürecek!',
    '%{pct} ile güçlü bir gün kapattın. KPSS\'de bu azim gerçekten fark yaratır!',
    'Süper! %{pct} tamamlandı. Biraz daha ve tam hedefe ulaşacaksın!',
  ],
  t90: [
    'Muhteşem yaklaştın: %{pct}! Neredeyse tam — son adımı da at!',
    '%{pct} — etkileyici bir performans! Bu öz disiplin sınava mutlaka yansıyacak.',
    'Tebrikler! %{pct} başarı ile günü kapattın. Yarın tam hedefe ulaşacaksın!',
  ],
  t100: [
    'MUHTEŞEM! %{pct} tamamlandı! Sen gerçek bir şampiyon adayısın, KPSS sana hazır!',
    'MÜKEMMELSİN! %{pct} ile tam hedefe ulaştın. Bu disiplin ile zirve senin!',
    'EFSANE! %{pct} — tam gaz çalıştın. Bu kararlılık başarının ta kendisidir!',
    'TAM PUAN! %{pct} tamamlandı! Bu azim seni KPSS\'de zirveye taşıyacak!',
  ],
}

function getGoalMessage(pct) {
  const key = pct <= 10 ? 't10' : pct <= 20 ? 't20' : pct <= 30 ? 't30' :
              pct <= 40 ? 't40' : pct <= 50 ? 't50' : pct <= 60 ? 't60' :
              pct <= 70 ? 't70' : pct <= 80 ? 't80' : pct <= 90 ? 't90' : 't100'
  const msgs = GOAL_MESSAGES[key]
  const msg = msgs[Math.floor(Math.random() * msgs.length)].replace('{pct}', pct)
  const tier = pct <= 30 ? 'low' : pct <= 60 ? 'mid' : pct <= 90 ? 'good' : 'excellent'
  return { tier, msg }
}

function playGoalSound(tier) {
  if (tier === 'low') playGoalLow()
  else if (tier === 'mid') playGoalMid()
  else if (tier === 'good') playGoalGood()
  else playGoalExcellent()
}

function getGoalClockColor(pct) {
  if (pct >= 100) return 'var(--success)'
  if (pct >= 75)  return '#22c55e'
  if (pct >= 50)  return 'var(--gold)'
  if (pct >= 25)  return '#0891b2'
  return 'var(--accent)'
}

function getFocusGoalClockColor(pct) {
  if (pct >= 100) return '#4ade80'
  if (pct >= 75)  return '#86efac'
  if (pct >= 50)  return '#fde68a'
  if (pct >= 25)  return '#93c5fd'
  return 'rgba(255,255,255,0.92)'
}

// ─── Goal Result Screen ───────────────────────────────────────────────────────

function GoalResultScreen({ pct, goalSec, actualSec, message, tier, onClose }) {
  const tierColors = { low: '#e04545', mid: '#e09320', good: '#0b9e74', excellent: '#5a4fcf' }
  const color = tierColors[tier]

  return (
    <div className="goal-result-overlay">
      <div className="goal-result-card">
        <div className="goal-result-pct mono" style={{ color }}>%{pct}</div>
        <div className="goal-result-completed">tamamlandı</div>
        <div className="goal-result-times">
          <span className="mono">{fmtDuration(actualSec)}</span>
          <span style={{ color: 'var(--text-muted)' }}> / </span>
          <span className="mono" style={{ color: 'var(--text-muted)' }}>{fmtDuration(goalSec)}</span>
          <span style={{ color: 'var(--text-light)', fontSize: 12, marginLeft: 4 }}>hedef</span>
        </div>
        <div className="goal-result-message" style={{ borderLeftColor: color }}>
          {message}
        </div>
        <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={onClose}>Kapat</button>
      </div>
    </div>
  )
}

// ─── Session Feedback (after each study stop when goal is set) ───────────────

function SessionFeedback({ pct, goalSec, actualSec, message, tier, onClose, onSaveDay }) {
  const tierColors = { low: '#e04545', mid: '#e09320', good: '#0b9e74', excellent: '#5a4fcf' }
  const color = tierColors[tier] || 'var(--accent)'

  useEffect(() => { playGoalSound(tier) }, [])

  return (
    <div className="goal-result-overlay">
      <div className="goal-result-card">
        <div style={{ fontSize: 11, color: 'var(--text-light)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Oturum Sonu · Günlük Durum
        </div>
        <div className="goal-result-pct mono" style={{ color }}>%{pct}</div>
        <div className="goal-result-completed">tamamlandı</div>
        <div className="goal-result-times">
          <span className="mono">{fmtDuration(actualSec)}</span>
          <span style={{ color: 'var(--text-muted)' }}> / </span>
          <span className="mono" style={{ color: 'var(--text-muted)' }}>{fmtDuration(goalSec)}</span>
          <span style={{ color: 'var(--text-light)', fontSize: 12, marginLeft: 4 }}>hedef</span>
        </div>
        <div className="goal-result-message" style={{ borderLeftColor: color }}>{message}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button className="btn btn-primary btn-sm" onClick={onSaveDay}>■ Günü Kaydet</button>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Daha sonra</button>
        </div>
      </div>
    </div>
  )
}

// ─── Daily Goal Panel ─────────────────────────────────────────────────────────

function DailyGoalPanel({ goalHours, goalMinutes, onHoursChange, onMinutesChange, todayTotal, goalSec, onFinishDay }) {
  const { session } = useStudy()
  const [confirmFinish, setConfirmFinish] = useState(false)

  const remaining = Math.max(0, goalSec - todayTotal)
  const pct = goalSec > 0 ? Math.min(100, Math.round((todayTotal / goalSec) * 100)) : 0
  const goalReached = goalSec > 0 && todayTotal >= goalSec
  const clockColor = getGoalClockColor(pct)

  return (
    <div className="daily-goal-running-card">
      <div className="daily-goal-setup-title">Günlük Çalışma Hedefi</div>

      {/* Hours + Minutes pickers */}
      <div className="daily-goal-hour-picker">
        <button className="daily-goal-hour-btn" onClick={() => onHoursChange(Math.max(0, goalHours - 1))}>−</button>
        <div className="daily-goal-hour-display">
          <span className="mono">{goalHours}</span>
          <span className="daily-goal-hour-label">saat</span>
        </div>
        <button className="daily-goal-hour-btn" onClick={() => onHoursChange(Math.min(23, goalHours + 1))}>+</button>

        <span style={{ color: 'var(--border-strong)', fontSize: 22, margin: '0 4px', lineHeight: 1 }}>:</span>

        <button className="daily-goal-hour-btn" onClick={() => onMinutesChange(goalMinutes < 5 ? 0 : goalMinutes - 5)}>−</button>
        <div className="daily-goal-hour-display">
          <span className="mono">{String(goalMinutes).padStart(2, '0')}</span>
          <span className="daily-goal-hour-label">dakika</span>
        </div>
        <button className="daily-goal-hour-btn" onClick={() => onMinutesChange(goalMinutes >= 55 ? 55 : goalMinutes + 5)}>+</button>
      </div>

      {/* Countdown clock */}
      <div className="daily-goal-clock mono" style={{ color: clockColor }}>
        {fmtElapsed(remaining)}
      </div>

      <div className="daily-goal-subtitle">
        {fmtDuration(goalSec)} hedef ·
        <span style={{ marginLeft: 6, fontFamily: 'var(--font-mono)', fontWeight: 600, color: clockColor }}>%{pct}</span>
        <span style={{ marginLeft: 4 }}>tamamlandı</span>
        {session && <span style={{ marginLeft: 10, color: 'var(--text-light)' }}>· {session.subjectName} çalışıyor</span>}
      </div>

      {/* Progress bar (fills up) */}
      <div className="daily-goal-progress" style={{ maxWidth: 420, width: '100%' }}>
        <div className="daily-goal-fill" style={{ width: `${pct}%`, background: clockColor }} />
      </div>

      {goalReached && (
        <div className="daily-goal-reached">Hedefe ulaştın! Günü kaydetmek için butona tıkla.</div>
      )}

      {!confirmFinish ? (
        <button
          className={`btn btn-sm${goalReached ? ' btn-primary' : ' btn-ghost'}`}
          style={{ marginTop: 8, ...(goalReached ? {} : { color: 'var(--text-muted)' }) }}
          onClick={() => setConfirmFinish(true)}
          disabled={goalSec === 0 || todayTotal === 0}
        >
          ■ Günü Kaydet
        </button>
      ) : (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Bugünü kaydet ve sonucu gör?</span>
          <button className="btn btn-primary btn-sm" onClick={() => { onFinishDay(); setConfirmFinish(false) }}>Evet</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setConfirmFinish(false)}>Hayır</button>
        </span>
      )}
    </div>
  )
}

// ─── Focus Mode ───────────────────────────────────────────────────────────────

function FocusMode({ onExit, focusColor, onColorChange, goalInfo }) {
  const { session, displayElapsed, pauseSession, resumeSession, stopSession } = useStudy()
  const [confirmStop, setConfirmStop] = useState(false)
  const [quoteIdx, setQuoteIdx] = useState(() => Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length))

  useEffect(() => {
    const t = setInterval(() => setQuoteIdx(i => (i + 1) % MOTIVATIONAL_QUOTES.length), 30000)
    return () => clearInterval(t)
  }, [])

  async function handleStop() {
    playFinish()
    onExit()
    await stopSession()
  }

  const bg = focusColor || '#15172e'
  const goalPct = goalInfo ? Math.min(100, Math.round((goalInfo.elapsed / goalInfo.targetSec) * 100)) : null
  const isGoalActive = !!goalInfo
  const isRunning = session && !session.isPaused

  const mainClock = isGoalActive
    ? fmtElapsed(Math.max(0, goalInfo.targetSec - goalInfo.elapsed))
    : fmtElapsed(displayElapsed)
  const mainColor = isGoalActive ? getFocusGoalClockColor(goalPct) : '#ffffff'

  return (
    <div className="study-focus-overlay" style={{ background: bg }}>

      <div className="study-focus-clock mono" style={{ color: mainColor }}>
        {mainClock}
      </div>

      {session && (
        <div className="study-focus-subject">
          {session.subjectName}
          {session.topicText && <span style={{ opacity: 0.55 }}> · {session.topicText}</span>}
        </div>
      )}
      {isGoalActive && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
          {fmtElapsed(displayElapsed)} oturum süresi
        </div>
      )}

      {isGoalActive && (
        <div className="focus-goal-progress">
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 5, fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
            %{goalPct} tamamlandı · {fmtDuration(goalInfo.targetSec)} hedef
          </div>
          <div className="focus-goal-bar">
            <div className="focus-goal-fill" style={{ width: `${goalPct}%`, background: mainColor }} />
          </div>
        </div>
      )}

      <div className="study-focus-controls">
        {isRunning
          ? <button className="btn btn-ghost" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} onClick={() => { playPause(); pauseSession() }}>⏸ Duraklat</button>
          : <button className="btn btn-ghost" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} onClick={() => { playResume(); resumeSession() }}>▶ Devam</button>
        }
        {!confirmStop ? (
          <button className="btn btn-ghost" style={{ color: '#ff9999', borderColor: 'rgba(255,100,100,0.3)' }} onClick={() => setConfirmStop(true)}>
            ■ Bitir
          </button>
        ) : (
          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-danger" onClick={handleStop}>Evet, bitir</button>
            <button className="btn btn-ghost" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} onClick={() => setConfirmStop(false)}>İptal</button>
          </span>
        )}
      </div>

      <div className="focus-quote">{MOTIVATIONAL_QUOTES[quoteIdx]}</div>

      {/* Color picker in corner */}
      <label className="focus-color-picker" title="Arka plan rengi">
        ◉
        <input type="color" value={focusColor || '#15172e'} onChange={e => onColorChange(e.target.value)}
               style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} />
      </label>

      <button className="study-focus-exit" onClick={onExit}>✕ Çıkış</button>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'timer',    label: 'Zamanlayıcı' },
  { id: 'goal',     label: 'Günlük Hedef' },
  { id: 'stats',    label: 'İstatistikler' },
  { id: 'dersler',  label: 'Derslerim' },
  { id: 'manual',   label: 'Manuel Giriş' },
]

export default function Study() {
  const { session, displayElapsed } = useStudy()
  const [tab, setTab] = useState('timer')
  const [focusMode, setFocusMode] = useState(false)
  const [subjects, setSubjects] = useState([])
  const [kpssCategories, setKpssCategories] = useState([])
  const [focusColor, setFocusColor] = useState('#15172e')
  const [goalResult, setGoalResult] = useState(null)
  const [sessionFeedback, setSessionFeedback] = useState(null)
  const [goalHours, setGoalHours] = useState(10)
  const [goalMinutes, setGoalMinutes] = useState(0)
  const [todayDbTotal, setTodayDbTotal] = useState(0)

  const milestoneRef = useRef({ played: false, sessionSubjectId: null })
  const prevSessionRef = useRef(null)
  const goalSecRef = useRef(0)

  const goalSec = goalHours * 3600 + goalMinutes * 60
  const todayLiveTotal = todayDbTotal + (session ? displayElapsed : 0)
  const goalInfo = goalSec > 0 ? { elapsed: todayLiveTotal, targetSec: goalSec } : null

  useEffect(() => { goalSecRef.current = goalSec }, [goalSec])

  // Milestone sound at 1h
  useEffect(() => {
    const subjectChanged = session?.subjectId !== milestoneRef.current.sessionSubjectId
    if (subjectChanged) {
      milestoneRef.current.played = displayElapsed >= 3600
      milestoneRef.current.sessionSubjectId = session?.subjectId ?? null
    }
    if (!session || session.isPaused) return
    if (displayElapsed >= 3600 && !milestoneRef.current.played) {
      milestoneRef.current.played = true
      playMilestone()
    }
  }, [displayElapsed, session])

  // Detect session end → show feedback
  useEffect(() => {
    if (prevSessionRef.current && !session) {
      handleSessionEnded()
    }
    prevSessionRef.current = session
  }, [session])

  async function handleSessionEnded() {
    const gs = goalSecRef.current
    const stats = await window.api.study.stats.get(getTodayStr())
    const total = stats.todayTotal || 0
    setTodayDbTotal(total)
    if (gs <= 0) return
    const pct = Math.min(100, Math.round((total / gs) * 100))
    const { tier, msg } = getGoalMessage(pct)
    setSessionFeedback({ pct, goalSec: gs, actualSec: total, message: msg, tier })
  }

  async function loadTodayTotal() {
    const stats = await window.api.study.stats.get(getTodayStr())
    setTodayDbTotal(stats.todayTotal || 0)
  }

  useEffect(() => {
    loadSubjects()
    window.api.kpss.listCategories().then(setKpssCategories)
    window.api.settings.get('focus_color').then(val => { if (val) setFocusColor(val) })
    Promise.all([
      window.api.settings.get('focus_goal_hours'),
      window.api.settings.get('focus_goal_minutes'),
    ]).then(([h, m]) => {
      if (h) setGoalHours(Number(h) || 10)
      if (m) setGoalMinutes(Number(m) || 0)
    })
    loadTodayTotal()
  }, [])

  async function loadSubjects() {
    const s = await window.api.study.subjects.list()
    setSubjects(s)
  }

  function handleGoalHoursChange(h) {
    setGoalHours(h)
    window.api.settings.set('focus_goal_hours', String(h))
  }

  function handleGoalMinutesChange(m) {
    setGoalMinutes(m)
    window.api.settings.set('focus_goal_minutes', String(m))
  }

  function handleFocusColorChange(color) {
    setFocusColor(color)
    window.api.settings.set('focus_color', color)
  }

  async function handleFinishDay() {
    const gs = goalSecRef.current
    if (gs <= 0) return
    const total = todayLiveTotal
    const pct = Math.min(100, Math.round((total / gs) * 100))
    const { tier, msg } = getGoalMessage(pct)
    await window.api.goals.add({
      date: getTodayStr(),
      goalSeconds: gs,
      actualSeconds: total,
      completedPct: pct,
    })
    setSessionFeedback(null)
    setGoalResult({ pct, goalSec: gs, actualSec: total, message: msg, tier })
  }

  // Render priority: result > session feedback > focus mode > normal page
  if (goalResult) return (
    <GoalResultScreen {...goalResult} onClose={() => setGoalResult(null)} />
  )

  if (sessionFeedback) return (
    <SessionFeedback
      {...sessionFeedback}
      onClose={() => setSessionFeedback(null)}
      onSaveDay={handleFinishDay}
    />
  )

  if (focusMode) return (
    <FocusMode
      onExit={() => setFocusMode(false)}
      focusColor={focusColor}
      onColorChange={handleFocusColorChange}
      goalInfo={goalInfo}
    />
  )

  return (
    <div className="page">
      <div className="page-header" style={{ marginBottom: 16 }}>
        <h1>Çalışma Zamanlayıcısı</h1>
      </div>

      <RecoveryBanner />
      <AlertBanners />

      <div className="study-tab-nav">
        {TABS.map(t => (
          <button key={t.id}
            className={`study-tab-btn${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}>
            {t.label}
            {t.id === 'timer' && session && (
              <span className={`study-tab-dot${session.isPaused ? ' paused' : ' running'}`} />
            )}
            {t.id === 'goal' && session && goalSec > 0 && (
              <span className={`study-tab-dot${session.isPaused ? ' paused' : ' running'}`} />
            )}
          </button>
        ))}
      </div>

      <div style={{ paddingTop: 24 }}>
        {tab === 'timer' && (
          <>
            <TimerPanel
              subjects={subjects}
              kpssCategories={kpssCategories}
              onRefreshSubjects={loadSubjects}
              onFocusMode={() => session && setFocusMode(true)}
            />
            <div className="break-timer-section">
              <div className="study-section-title" style={{ marginBottom: 8 }}>Mola Sayacı</div>
              <BreakTimerPanel studyRunning={!!(session && !session.isPaused)} />
            </div>
          </>
        )}
        {tab === 'goal' && (
          <DailyGoalPanel
            goalHours={goalHours}
            goalMinutes={goalMinutes}
            onHoursChange={handleGoalHoursChange}
            onMinutesChange={handleGoalMinutesChange}
            todayTotal={todayLiveTotal}
            goalSec={goalSec}
            onFinishDay={handleFinishDay}
          />
        )}
        {tab === 'stats' && <StatsPanel />}
        {tab === 'dersler' && (
          <DersleriPanel subjects={subjects} kpssCategories={kpssCategories} onRefresh={loadSubjects} />
        )}
        {tab === 'manual' && (
          <ManualEntryPanel
            subjects={subjects}
            kpssCategories={kpssCategories}
            onRefreshSubjects={loadSubjects}
          />
        )}
      </div>
    </div>
  )
}
