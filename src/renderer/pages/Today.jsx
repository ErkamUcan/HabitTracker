import React, { useState, useEffect } from 'react'
import QuoteWidget from '../components/QuoteWidget'
import TaskList from '../components/TaskList'
import HabitMiniWidget from '../components/HabitMiniWidget'
import RingProgress from '../components/RingProgress'
import { useLang } from '../context/LangContext'
import { useStudy, fmtElapsed } from '../context/StudyContext'

function fmtDur(s) {
  if (!s) return '0 dk'
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60)
  if (h > 0 && m > 0) return `${h} saat ${m} dk`
  if (h > 0) return `${h} saat`
  return `${m} dk`
}

function StudyTodayCard({ onNavigate }) {
  const { session, displayElapsed } = useStudy()
  const [todayStats, setTodayStats] = useState(null)

  useEffect(() => {
    const today = new Date().toISOString().slice(0,10)
    window.api.study.stats.get(today).then(s => setTodayStats(s)).catch(() => {})
  }, [session])

  const todayTotal = (todayStats?.todayTotal || 0) + (session && !session.isPaused ? displayElapsed : 0)
  if (!todayStats && !session) return null

  return (
    <div
      className="study-today-card"
      onClick={() => onNavigate('study')}
      title="Çalışma sekmesine git"
      style={{ cursor:'pointer' }}
    >
      <div className="study-today-card-title">⏱ Bugün çalışma</div>
      <div className="study-today-card-time mono">{fmtDur(todayTotal)}</div>
      {todayStats?.topSubjectToday && (
        <div className="study-today-card-sub">{todayStats.topSubjectToday}</div>
      )}
      {session && (
        <div className={`study-today-card-live${session.isPaused ? ' paused' : ''}`}>
          {session.isPaused ? '⏸' : '●'} {fmtElapsed(displayElapsed)}
        </div>
      )}
    </div>
  )
}

function getGreeting(t) {
  const h = new Date().getHours()
  if (h < 12) return t('today.greet.morning')
  if (h < 17) return t('today.greet.afternoon')
  return t('today.greet.evening')
}

function formatDate(d, lang) {
  return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'tr-TR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function computeCompletion(tasks) {
  const parentHasSubs = new Set(tasks.filter(t => t.parent_id !== null).map(t => t.parent_id))
  const leaves = tasks.filter(t => t.parent_id !== null || !parentHasSubs.has(t.id))
  if (leaves.length === 0) return { total: 0, done: 0, pct: 0 }
  const done = leaves.filter(t => t.done).length
  return { total: leaves.length, done, pct: Math.round((done / leaves.length) * 100) }
}

export default function Today({ onNavigate }) {
  const { t, lang } = useLang()
  const today = todayStr()
  const [tasks, setTasks] = useState([])

  useEffect(() => {
    window.api.tasks.list('day', today).then(setTasks)
  }, [today])

  const addTask = async (text, parentId = null) => {
    const task = await window.api.tasks.add({ scope: 'day', date: today, parent_id: parentId, text })
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

  const { total, done, pct } = computeCompletion(tasks)

  return (
    <div className="page">
      <div className="page-header">
        <p className="today-greeting">{getGreeting(t)}</p>
        <h1>{formatDate(new Date(), lang)}</h1>
      </div>

      <QuoteWidget />

      <div className="today-body">
        <div className="today-main">
          <div className="section">
            <div className="section-title">
              {t('today.tasks')}
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
                  label={pct === 100 ? t('today.done_all') : t('today.completed', { done, total })}
                  sub={pct === 100 ? t('today.great_job') : t('today.n_left', { n: total - done })}
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
          <HabitMiniWidget date={today} onNavigate={onNavigate} />
          <div style={{ marginTop: 14 }}>
            <StudyTodayCard onNavigate={onNavigate} />
          </div>
        </aside>
      </div>
    </div>
  )
}
