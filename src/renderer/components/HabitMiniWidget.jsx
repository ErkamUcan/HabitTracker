import React, { useState, useEffect } from 'react'

export default function HabitMiniWidget({ date, onNavigate }) {
  const [habits, setHabits] = useState([])
  const [marks, setMarks]   = useState([])

  useEffect(() => {
    Promise.all([
      window.api.habits.list(),
      window.api.habits.getMarksForDates([date])
    ]).then(([h, m]) => { setHabits(h); setMarks(m) })
  }, [date])

  const doneSet = new Set(marks.filter(m => m.done).map(m => m.habit_id))
  const done    = habits.filter(h => doneSet.has(h.id)).length
  const total   = habits.length

  return (
    <div className="habit-mini-widget">
      <div className="habit-mini-title">
        Bugünün Alışkanlıkları
        <button onClick={() => onNavigate && onNavigate('habits')}>
          Tümünü gör →
        </button>
      </div>

      {total === 0 ? (
        <p className="habit-mini-empty">Henüz alışkanlık yok — Alışkanlıklar sekmesinden ekle.</p>
      ) : (
        <>
          {habits.map(h => (
            <div key={h.id} className="habit-mini-row">
              <div className={`habit-mini-dot${doneSet.has(h.id) ? ' done' : ' undone'}`} />
              <span className="habit-mini-name">{h.name}</span>
            </div>
          ))}
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {done}/{total} tamamlandı
          </div>
        </>
      )}
    </div>
  )
}
