import React, { useState, useEffect } from 'react'
import TaskList from '../components/TaskList'
import RingProgress from '../components/RingProgress'

function getWeekStart(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

function toStr(d) {
  return d.toISOString().slice(0, 10)
}

function getWeekDates(weekStart) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return toStr(d)
  })
}

function formatWeekRange(weekStart) {
  const end = new Date(weekStart)
  end.setDate(end.getDate() + 6)
  const fmt = d => d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
  return `${fmt(weekStart)} – ${fmt(end)}, ${weekStart.getFullYear()}`
}

const DAY_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

function computeCompletion(tasks) {
  const parentHasSubs = new Set(tasks.filter(t => t.parent_id !== null).map(t => t.parent_id))
  const leaves = tasks.filter(t => t.parent_id !== null || !parentHasSubs.has(t.id))
  if (leaves.length === 0) return { total: 0, done: 0, pct: 0 }
  const done = leaves.filter(t => t.done).length
  return { total: leaves.length, done, pct: Math.round((done / leaves.length) * 100) }
}

export default function Week() {
  const weekStart    = getWeekStart()
  const weekStartStr = toStr(weekStart)
  const weekDates    = getWeekDates(weekStart)
  const todayStr     = toStr(new Date())

  const [tasks, setTasks]   = useState([])
  const [habits, setHabits] = useState([])
  const [marks, setMarks]   = useState([])

  useEffect(() => {
    window.api.tasks.list('week', weekStartStr).then(setTasks)
    window.api.habits.list().then(setHabits)
    window.api.habits.getMarksForDates(weekDates).then(setMarks)
  }, [weekStartStr])

  const addTask = async (text, parentId = null) => {
    const t = await window.api.tasks.add({
      scope: 'week', week_start_date: weekStartStr, parent_id: parentId, text
    })
    setTasks(prev => [...prev, t])
  }

  const updateTask = async (id, text) => {
    const t = await window.api.tasks.update(id, text)
    setTasks(prev => prev.map(x => x.id === id ? t : x))
  }

  const deleteTask = async (id) => {
    await window.api.tasks.delete(id)
    setTasks(prev => prev.filter(x => x.id !== id && x.parent_id !== id))
  }

  const toggleTask = async (id, done) => {
    const t = await window.api.tasks.toggle(id, done)
    setTasks(prev => prev.map(x => x.id === id ? t : x))
  }

  const { total, done, pct } = computeCompletion(tasks)

  const markSet = new Set(marks.filter(m => m.done).map(m => `${m.habit_id}-${m.date}`))
  const totalPossible = habits.length * 7
  const totalDone = marks.filter(m => m.done).length
  const consistencyPct = totalPossible > 0 ? Math.round((totalDone / totalPossible) * 100) : 0

  return (
    <div className="page">
      <div className="page-header">
        <div className="week-header-info">
          <h1>Bu Hafta</h1>
          <span className="week-range mono">{formatWeekRange(weekStart)}</span>
        </div>
      </div>

      <div className="today-body">
        <div className="today-main">
          <div className="section">
            <div className="section-title">
              Haftalık Görevler
              {total > 0 && (
                <span className={`badge ${pct === 100 ? 'badge-success' : 'badge-warn'}`}>
                  {done}/{total}
                </span>
              )}
            </div>

            {total > 0 && (
              <div style={{ marginBottom: 18 }}>
                <RingProgress
                  value={pct}
                  size={72}
                  strokeWidth={7}
                  label={pct === 100 ? 'Hepsi tamam! 🎉' : `${done} / ${total} görev tamamlandı`}
                  sub={pct === 100 ? 'Mükemmel hafta!' : `${total - done} görev kaldı`}
                />
              </div>
            )}

            <TaskList
              tasks={tasks}
              onAdd={text => addTask(text)}
              onAddSub={(text, parentId) => addTask(text, parentId)}
              onUpdate={updateTask}
              onDelete={deleteTask}
              onToggle={toggleTask}
            />
          </div>
        </div>

        <aside className="today-aside">
          <div className="card" style={{ padding: '18px' }}>
            <div className="section-title" style={{ fontSize: 15, marginBottom: 14 }}>
              Habit Tutarlılığı
            </div>
            <RingProgress
              value={consistencyPct}
              size={72}
              strokeWidth={7}
              label={`${totalDone} / ${totalPossible} işaret`}
              sub={`Bu haftanın ${habits.length} habitinden`}
            />
          </div>
        </aside>
      </div>

      {habits.length > 0 && (
        <div className="section">
          <div className="section-title">Haftanın Habitleri</div>
          <div className="habit-week-summary">
            <table className="habit-week-table">
              <thead>
                <tr>
                  <th>Habit</th>
                  {weekDates.map((d, i) => (
                    <th key={d}>
                      {DAY_LABELS[i]}
                      <br />
                      <span style={{ fontWeight: 400 }}>{d.slice(8)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {habits.map(h => (
                  <tr key={h.id}>
                    <td>{h.name}</td>
                    {weekDates.map(d => {
                      const isDone = markSet.has(`${h.id}-${d}`)
                      const isToday = d === todayStr
                      return (
                        <td key={d}>
                          <span className={`week-dot${isDone ? ' done' : ' undone'}${isToday ? ' today' : ''}`} />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
