import React, { useState, useEffect } from 'react'
import TaskList from '../components/TaskList'
import { useLang } from '../context/LangContext'

function dateStr(d) {
  return d.toISOString().slice(0, 10)
}

function addDays(d, n) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function formatDate(d, lang) {
  return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'tr-TR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })
}

function computeCompletion(tasks) {
  const parentHasSubs = new Set(tasks.filter(t => t.parent_id !== null).map(t => t.parent_id))
  const leaves = tasks.filter(t => t.parent_id !== null || !parentHasSubs.has(t.id))
  if (leaves.length === 0) return { total: 0, done: 0, pct: 0 }
  const done = leaves.filter(t => t.done).length
  return { total: leaves.length, done, pct: Math.round((done / leaves.length) * 100) }
}

export default function DayView() {
  const { t, lang } = useLang()
  const [date, setDate]   = useState(new Date())
  const [tasks, setTasks] = useState([])
  const [habits, setHabits] = useState([])
  const [marks, setMarks]   = useState([])

  const ds    = dateStr(date)
  const today = dateStr(new Date())
  const isFuture = ds > today
  const isToday  = ds === today

  useEffect(() => {
    window.api.tasks.list('day', ds).then(setTasks)
    Promise.all([
      window.api.habits.list(),
      window.api.habits.getMarksForDates([ds])
    ]).then(([h, m]) => { setHabits(h); setMarks(m) })
  }, [ds])

  const addTask = async (text, parentId = null) => {
    if (isFuture) return
    const task = await window.api.tasks.add({ scope: 'day', date: ds, parent_id: parentId, text })
    setTasks(prev => [...prev, task])
  }

  const updateTask = async (id, text) => {
    const task = await window.api.tasks.update(id, text)
    setTasks(prev => prev.map(x => x.id === id ? task : x))
  }

  const deleteTask = async (id) => {
    await window.api.tasks.delete(id)
    setTasks(prev => prev.filter(x => x.id !== id && x.parent_id !== id))
  }

  const toggleTask = async (id, done) => {
    const task = await window.api.tasks.toggle(id, done)
    setTasks(prev => prev.map(x => x.id === id ? task : x))
  }

  async function toggleHabit(habitId, currentDone) {
    await window.api.habits.mark(habitId, ds, !currentDone)
    setMarks(prev => {
      const filtered = prev.filter(m => !(m.habit_id === habitId && m.date === ds))
      if (!currentDone) return [...filtered, { habit_id: habitId, date: ds, done: 1 }]
      return filtered
    })
  }

  const doneSet = new Set(marks.filter(m => m.done).map(m => m.habit_id))
  const { total, done, pct } = computeCompletion(tasks)

  return (
    <div className="page">
      {/* Date navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <button className="month-nav-btn" onClick={() => setDate(d => addDays(d, -1))}>‹</button>
        <div style={{ flex: 1 }}>
          {isToday && <p style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginBottom: 3 }}>{t('day.today_label')}</p>}
          <h1 style={{ fontSize: 22 }}>{formatDate(date, lang)}</h1>
        </div>
        <button className="month-nav-btn" onClick={() => setDate(d => addDays(d, 1))}>›</button>
        {!isToday && (
          <button className="btn btn-ghost btn-sm" onClick={() => setDate(new Date())}>
            {t('day.go_today')}
          </button>
        )}
      </div>

      {/* Task progress */}
      {total > 0 && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, height: 6, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? 'var(--success)' : pct >= 60 ? 'var(--accent)' : pct >= 30 ? 'var(--gold)' : 'var(--warn)', borderRadius: 99, transition: 'width 0.4s' }} />
          </div>
          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {done}/{total}
          </span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start' }}>
        {/* Tasks */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="section-title">{t('day.tasks')}</div>
          {isFuture ? (
            <p style={{ color: 'var(--text-light)', fontSize: 13, fontStyle: 'italic' }}>
              {t('day.future_hint')}
            </p>
          ) : (
            <TaskList
              tasks={tasks}
              onAdd={text => addTask(text)}
              onAddSub={(text, parentId) => addTask(text, parentId)}
              onUpdate={updateTask}
              onDelete={deleteTask}
              onToggle={toggleTask}
            />
          )}
        </div>

        {/* Habits */}
        <div style={{ width: 220, flexShrink: 0 }}>
          <div className="section-title">{t('day.habits')}</div>
          {habits.length === 0 ? (
            <p style={{ color: 'var(--text-light)', fontSize: 12, fontStyle: 'italic' }}>{t('day.no_habits')}</p>
          ) : (
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              {habits.map((h, i) => {
                const done = doneSet.has(h.id)
                return (
                  <div key={h.id}
                    onClick={() => !isFuture && toggleHabit(h.id, done)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                      borderBottom: i < habits.length - 1 ? '1px solid var(--border)' : 'none',
                      cursor: isFuture ? 'default' : 'pointer',
                      background: done ? 'var(--success-bg)' : 'var(--bg)',
                      transition: 'background 0.15s',
                    }}
                  >
                    <div className={`cb${done ? ' checked' : ''}`} style={{ pointerEvents: 'none' }} />
                    <span style={{ fontSize: 13, flex: 1 }}>{h.name}</span>
                  </div>
                )
              })}
            </div>
          )}
          {habits.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {[...doneSet].filter(id => habits.some(h => h.id === id)).length}/{habits.length} tamamlandı
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
