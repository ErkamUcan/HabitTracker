import React from 'react'
import { useStudy, fmtElapsed } from '../context/StudyContext'

export default function StudyMiniWidget({ onNavigateStudy }) {
  const { session, displayElapsed, pauseSession, resumeSession } = useStudy()
  if (!session) return null

  return (
    <div className="study-mini-widget" onClick={onNavigateStudy} title="Çalışma oturumuna git">
      <div className={`study-mini-dot${session.isPaused ? ' paused' : ' running'}`} />
      <span className="study-mini-subject">{session.subjectName}</span>
      <span className="study-mini-time mono">{fmtElapsed(displayElapsed)}</span>
      <button
        className="study-mini-btn"
        onClick={e => { e.stopPropagation(); session.isPaused ? resumeSession() : pauseSession() }}
        title={session.isPaused ? 'Devam et' : 'Duraklat'}
      >
        {session.isPaused ? '▶' : '⏸'}
      </button>
    </div>
  )
}
