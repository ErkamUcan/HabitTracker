import React, { useState, useEffect, useRef } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer
} from 'recharts'
import RingProgress from '../components/RingProgress'

const MONTH_NAMES = [
  'Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
  'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'
]

const EXAM_DATE = { year: 2026, month: 9, day: 6 }

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

function padMonth(m) {
  return String(m).padStart(2, '0')
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function daysUntilExam() {
  const now = new Date()
  const exam = new Date(`${EXAM_DATE.year}-${padMonth(EXAM_DATE.month)}-${padMonth(EXAM_DATE.day)}`)
  const diff = exam - now
  return diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : 0
}

function isExamDay(year, month, day) {
  return year === EXAM_DATE.year && month === EXAM_DATE.month && day === EXAM_DATE.day
}

function HabitNameCell({ habit, onRename, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [text, setText]       = useState(habit.name)
  const ref = useRef(null)

  function commit() {
    const t = text.trim()
    if (t && t !== habit.name) onRename(habit.id, t)
    else setText(habit.name)
    setEditing(false)
  }

  return (
    <div className="habit-row-name">
      {editing ? (
        <input
          ref={ref}
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') { setText(habit.name); setEditing(false) }
          }}
        />
      ) : (
        <>
          <span
            style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'default' }}
            onDoubleClick={() => { setText(habit.name); setEditing(true); setTimeout(() => ref.current?.focus(), 0) }}
            title={habit.name}
          >
            {habit.name}
          </span>
          <button
            className="icon-btn danger"
            style={{ opacity: 0.35, transition: 'opacity 0.1s' }}
            onMouseEnter={e => e.currentTarget.style.opacity = 1}
            onMouseLeave={e => e.currentTarget.style.opacity = 0.35}
            onClick={() => onDelete(habit.id)}
            title="Habit sil"
          >
            ✕
          </button>
        </>
      )}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 12, fontFamily: 'var(--font-mono)', boxShadow: 'var(--shadow-md)' }}>
        <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>Gün {label}</div>
        <div style={{ color: 'var(--success)', fontWeight: 600 }}>{payload[0].value} habit tamamlandı</div>
      </div>
    )
  }
  return null
}

export default function MyHabits() {
  const [today, setToday]   = useState(todayStr)
  const [year, setYear]     = useState(() => new Date().getFullYear())
  const [month, setMonth]   = useState(() => new Date().getMonth() + 1)
  const [habits, setHabits] = useState([])
  const [marks, setMarks]   = useState([])
  const [addText, setAddText] = useState('')
  const addInputRef = useRef(null)

  // Gece yarısında tarihi güncelle
  useEffect(() => {
    function scheduleMidnight() {
      const now = new Date()
      const msUntilMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - now
      const timer = setTimeout(() => {
        const d = new Date()
        setToday(todayStr())
        setYear(d.getFullYear())
        setMonth(d.getMonth() + 1)
        scheduleMidnight()
      }, msUntilMidnight + 500)
      return timer
    }
    const timer = scheduleMidnight()
    return () => clearTimeout(timer)
  }, [])
  const days  = daysInMonth(year, month)
  const dayNumbers = Array.from({ length: days }, (_, i) => i + 1)

  const doneSet = new Set(marks.filter(m => m.done).map(m => `${m.habit_id}-${m.date}`))

  function isDone(habitId, day) {
    return doneSet.has(`${habitId}-${year}-${padMonth(month)}-${padMonth(day)}`)
  }

  function isToday(day) {
    return `${year}-${padMonth(month)}-${padMonth(day)}` === today
  }

  async function loadData() {
    const [h, m] = await Promise.all([
      window.api.habits.list(),
      window.api.habits.getMarks(year, month)
    ])
    setHabits(h)
    setMarks(m)
  }

  useEffect(() => { loadData() }, [year, month])

  async function toggleMark(habitId, day) {
    const date = `${year}-${padMonth(month)}-${padMonth(day)}`
    const wasDone = doneSet.has(`${habitId}-${date}`)
    await window.api.habits.mark(habitId, date, !wasDone)
    if (wasDone) {
      setMarks(prev => prev.filter(m => !(m.habit_id === habitId && m.date === date)))
    } else {
      setMarks(prev => [...prev, { habit_id: habitId, date, done: 1 }])
    }
  }

  async function addHabit() {
    const name = addText.trim()
    if (!name) return
    const h = await window.api.habits.add(name)
    setHabits(prev => [...prev, h])
    setAddText('')
  }

  async function renameHabit(id, name) {
    await window.api.habits.rename(id, name)
    setHabits(prev => prev.map(h => h.id === id ? { ...h, name } : h))
  }

  async function deleteHabit(id) {
    await window.api.habits.delete(id)
    setHabits(prev => prev.filter(h => h.id !== id))
    setMarks(prev => prev.filter(m => m.habit_id !== id))
  }

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    const now = new Date()
    if (year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1)) return
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  const habitsDone  = marks.filter(m => m.done).length
  const habitsTotal = habits.length * days
  const monthPct    = habitsTotal > 0 ? Math.round((habitsDone / habitsTotal) * 100) : 0

  const chartData = dayNumbers.map(day => ({
    day: String(day),
    completed: habits.filter(h => isDone(h.id, day)).length,
    pct: habits.length > 0 ? Math.round((habits.filter(h => isDone(h.id, day)).length / habits.length) * 100) : 0
  }))

  const showingExamMonth = year === EXAM_DATE.year && month === EXAM_DATE.month
  const examDaysLeft = daysUntilExam()

  return (
    <div className="page">
      <div className="page-header">
        <h1>My Habits</h1>
      </div>

      {/* Exam countdown banner */}
      {examDaysLeft > 0 && (
        <div className="exam-banner">
          <div className="exam-banner-icon">⭐</div>
          <div>
            <div className="exam-banner-title">6 Eylül — Büyük Gün</div>
            <div className="exam-banner-sub">{examDaysLeft} gün kaldı. Her gün sayılır!</div>
          </div>
          {habits.length > 0 && (
            <div style={{ marginLeft: 'auto' }}>
              <RingProgress value={monthPct} size={60} strokeWidth={6} />
            </div>
          )}
        </div>
      )}

      {/* Month completion ring (for non-exam months) */}
      {habits.length > 0 && examDaysLeft === 0 && (
        <div style={{ marginBottom: 20 }}>
          <RingProgress
            value={monthPct}
            size={72}
            strokeWidth={7}
            label="Aylık tamamlanma"
            sub={`${habitsDone} / ${habitsTotal} işaret`}
          />
        </div>
      )}

      {/* Month Navigation */}
      <div className="habits-nav">
        <button className="month-nav-btn" onClick={prevMonth}>‹</button>
        <span className="month-label mono">{MONTH_NAMES[month - 1]} {year}</span>
        <button
          className="month-nav-btn"
          onClick={nextMonth}
          disabled={year === new Date().getFullYear() && month >= new Date().getMonth() + 1}
          style={{ opacity: (year === new Date().getFullYear() && month >= new Date().getMonth() + 1) ? 0.3 : 1 }}
        >
          ›
        </button>
        {showingExamMonth && (
          <span style={{ fontSize: 12, color: 'var(--gold)', fontFamily: 'var(--font-mono)', marginLeft: 6 }}>
            ⭐ Sınav ayı!
          </span>
        )}
      </div>

      {/* Grid */}
      <div className="habits-grid-wrapper">
        <div className="habits-grid">
          <table className="habits-grid-table">
            <thead>
              <tr>
                <th>Habit</th>
                {dayNumbers.map(d => {
                  const exam = isExamDay(year, month, d)
                  const td = isToday(d)
                  return (
                    <th
                      key={d}
                      className={exam ? 'exam-day-header' : ''}
                      style={{ color: td && !exam ? 'var(--accent)' : undefined }}
                      title={exam ? '6 Eylül — Sınav Günü!' : undefined}
                    >
                      {d}
                      {exam && <div style={{ fontSize: 8, lineHeight: 1 }}>⭐</div>}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {habits.map(habit => (
                <tr key={habit.id}>
                  <td>
                    <HabitNameCell habit={habit} onRename={renameHabit} onDelete={deleteHabit} />
                  </td>
                  {dayNumbers.map(day => {
                    const done  = isDone(habit.id, day)
                    const today_ = isToday(day)
                    const exam  = isExamDay(year, month, day)
                    return (
                      <td key={day}>
                        <div
                          className={`grid-cell${done ? ' done' : ''}${today_ ? ' today' : ''}${exam ? ' exam-day' : ''}`}
                          onClick={() => toggleMark(habit.id, day)}
                          title={exam ? `${habit.name} — 6 Eylül Sınav Günü!` : `${habit.name} – Gün ${day}`}
                        >
                          <div className={`grid-dot${done ? ' done' : exam ? ' exam-dot' : ' undone'}`} />
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}

              {/* Add habit row */}
              <tr>
                <td colSpan={days + 1}>
                  <div className="add-habit-row">
                    <input
                      ref={addInputRef}
                      type="text"
                      placeholder="Yeni habit ekle…"
                      value={addText}
                      onChange={e => setAddText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') addHabit() }}
                      style={{ maxWidth: 260 }}
                    />
                    <button className="btn btn-primary btn-sm" onClick={addHabit}>Ekle</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly Bar Chart */}
      {habits.length > 0 && (
        <div className="section habits-chart">
          <div className="section-title">Günlük Tamamlanma — {MONTH_NAMES[month - 1]}</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
                interval={1}
              />
              <YAxis
                domain={[0, habits.length]}
                allowDecimals={false}
                tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
                ticks={habits.length <= 10 ? Array.from({ length: habits.length + 1 }, (_, i) => i) : undefined}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--surface-2)' }} />
              <ReferenceLine
                y={habits.length}
                stroke="var(--accent)"
                strokeDasharray="5 3"
                strokeWidth={1.5}
                label={{ value: 'Tam', position: 'right', fontSize: 10, fill: 'var(--accent)', fontFamily: 'var(--font-mono)' }}
              />
              {showingExamMonth && (
                <ReferenceLine
                  x={String(EXAM_DATE.day)}
                  stroke="var(--gold)"
                  strokeDasharray="4 3"
                  strokeWidth={2}
                  label={{ value: '⭐', position: 'top', fontSize: 12 }}
                />
              )}
              <Bar dataKey="completed" fill="var(--success)" radius={[3, 3, 0, 0]} maxBarSize={16} />
            </BarChart>
          </ResponsiveContainer>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, fontFamily: 'var(--font-mono)' }}>
            Kesik çizgi tam tamamlanmayı gösterir. Düşük günlerdeki hücreleri tıkla.
          </p>
        </div>
      )}

      {habits.length === 0 && (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>◎</div>
          <p style={{ fontSize: 14 }}>Henüz habit yok. Üstteki alandan ilk habitini ekle.</p>
        </div>
      )}
    </div>
  )
}
