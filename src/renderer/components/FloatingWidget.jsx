import React, { useState, useEffect } from 'react'
import { useStudy, fmtElapsed } from '../context/StudyContext'

export default function FloatingWidget() {
  const { session, displayElapsed, pauseSession, resumeSession, stopSession } = useStudy()

  async function handleStop() {
    await stopSession()
  }

  if (!session) {
    return (
      <div className="fw-root fw-empty">
        <span style={{ color:'rgba(255,255,255,0.5)', fontSize:12 }}>Oturum yok</span>
        <button className="fw-close" onClick={() => window.api.study.widget.close()}>✕</button>
      </div>
    )
  }

  return (
    <div className="fw-root">
      <div className="fw-drag" />
      <div className="fw-subject" title={session.subjectName}>
        {session.subjectName}
        {session.topicText ? <span className="fw-topic"> · {session.topicText}</span> : null}
      </div>
      <div className={`fw-clock mono${session.isPaused ? ' paused' : ''}`}>
        {fmtElapsed(displayElapsed)}
      </div>
      <div className="fw-controls">
        {!session.isPaused
          ? <button className="fw-btn" onClick={pauseSession}>⏸</button>
          : <button className="fw-btn" onClick={resumeSession}>▶</button>
        }
        <button className="fw-btn fw-stop" onClick={handleStop}>■</button>
        <button className="fw-btn fw-x" onClick={() => window.api.study.widget.close()}>✕</button>
      </div>
    </div>
  )
}
