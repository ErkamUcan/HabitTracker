import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'

const StudyContext = createContext(null)

export function StudyProvider({ children }) {
  const [session, setSession] = useState(null)
  // session: { running, isPaused, segmentId, subjectId, subjectName, topicText,
  //            priorElapsedSeconds, segmentStartAt, segmentPausedMs } | null

  const [displayElapsed, setDisplayElapsed] = useState(0)
  const [idleBanner, setIdleBanner] = useState(null)       // { idleSeconds }
  const [sleepBanner, setSleepBanner] = useState(null)     // { gapSeconds, segmentId }
  const [recoveryBanner, setRecoveryBanner] = useState(null) // crash recovery
  const tickRef = useRef(null)

  const computeElapsed = useCallback((s) => {
    if (!s) return 0
    if (s.isPaused) return s.frozenElapsedSeconds ?? s.elapsedSeconds ?? 0
    const now = Date.now()
    return s.priorElapsedSeconds +
      Math.floor((now - s.segmentStartAt - s.segmentPausedMs) / 1000)
  }, [])

  function startTick(s) {
    stopTick()
    if (!s || s.isPaused) return
    tickRef.current = setInterval(() => {
      setDisplayElapsed(computeElapsed(s))
    }, 1000)
  }

  function stopTick() {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null }
  }

  function applySession(s) {
    setSession(s)
    const el = computeElapsed(s)
    setDisplayElapsed(el)
    startTick(s)
  }

  // Initial load + crash recovery check
  useEffect(() => {
    window.api.study.session.getState().then(applySession)
    window.api.study.session.checkRecovery().then(r => {
      if (r) setRecoveryBanner(r)
    })

    window.api.study.on.stateChange(applySession)
    window.api.study.on.idle((d) => setIdleBanner(d))
    window.api.study.on.sleepRecovery((d) => setSleepBanner(d))

    return () => {
      window.api.study.off.stateChange()
      window.api.study.off.idle()
      window.api.study.off.sleepRecovery()
      stopTick()
    }
  }, [])

  useEffect(() => {
    if (session && !session.isPaused) {
      startTick(session)
    } else {
      stopTick()
      if (session) setDisplayElapsed(computeElapsed(session))
    }
    return stopTick
  }, [session?.segmentId, session?.isPaused])

  async function startSession(subjectId, topicText) {
    const s = await window.api.study.session.start(subjectId, topicText)
    applySession(s)
    playSound('start')
  }

  async function pauseSession() {
    const s = await window.api.study.session.pause()
    applySession(s)
  }

  async function resumeSession() {
    const s = await window.api.study.session.resume()
    applySession(s)
  }

  async function stopSession() {
    await window.api.study.session.stop()
    applySession(null)
    playSound('stop')
  }

  async function cancelSession() {
    await window.api.study.session.cancel()
    applySession(null)
  }

  async function switchSubject(subjectId, topicText) {
    const s = await window.api.study.session.switch(subjectId, topicText)
    applySession(s)
  }

  async function dismissSleepBanner(keep) {
    if (sleepBanner && session) {
      if (!keep) {
        // Subtract the gap from segmentPausedMs by re-fetching state
        // The simplest approach: stop session (it's already been running with the gap)
        // For now, we just dismiss — main process doesn't auto-pause, user decides
      }
    }
    setSleepBanner(null)
  }

  async function dismissRecovery(keepTime) {
    if (!recoveryBanner) return
    await window.api.study.session.dismissRecovery(recoveryBanner.id, keepTime)
    setRecoveryBanner(null)
  }

  return (
    <StudyContext.Provider value={{
      session,
      displayElapsed,
      idleBanner, setIdleBanner,
      sleepBanner, dismissSleepBanner,
      recoveryBanner, dismissRecovery,
      startSession, pauseSession, resumeSession, stopSession, cancelSession, switchSubject,
    }}>
      {children}
    </StudyContext.Provider>
  )
}

export function useStudy() {
  return useContext(StudyContext)
}

export function fmtElapsed(seconds) {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
}

function playSound(type) {
  try {
    const ctx = new AudioContext()
    if (type === 'start') {
      beep(ctx, 660, 0, 0.15)
      beep(ctx, 880, 0.18, 0.12)
    } else {
      beep(ctx, 440, 0, 0.15)
      beep(ctx, 330, 0.18, 0.25)
    }
    setTimeout(() => ctx.close(), 800)
  } catch {}
}

function beep(ctx, freq, delayS, durS) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain); gain.connect(ctx.destination)
  osc.frequency.value = freq
  osc.type = 'sine'
  gain.gain.setValueAtTime(0.25, ctx.currentTime + delayS)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delayS + durS)
  osc.start(ctx.currentTime + delayS)
  osc.stop(ctx.currentTime + delayS + durS)
}
