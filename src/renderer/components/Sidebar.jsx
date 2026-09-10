import React, { useState, useEffect, useMemo } from 'react'
import { useLang } from '../context/LangContext'
import logoSrc from '../../../assets/logo.png'

const DEFAULT_EXAM_DATE  = '2026-09-06'
const DEFAULT_EXAM_LABEL = '6 Eylül KPSS sınavına'

function useCountdown(examDateStr) {
  return useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const exam = new Date(examDateStr + 'T00:00:00')
    exam.setHours(0, 0, 0, 0)
    const diffDays = Math.round((exam - today) / 86400000)
    if (diffDays <= 0) return { days: 0, passed: true }
    return { days: diffDays - 1, passed: false }   // exam günü sayılmaz
  }, [examDateStr])
}

export default function Sidebar({ currentPage, onNavigate }) {
  const { t } = useLang()
  const [examDateStr, setExamDateStr] = useState(DEFAULT_EXAM_DATE)
  const [examLabel, setExamLabel]     = useState(DEFAULT_EXAM_LABEL)
  const { days, passed } = useCountdown(examDateStr)

  useEffect(() => {
    window.api.settings.get('exam_date').then(v  => { if (v) setExamDateStr(v) })
    window.api.settings.get('exam_label').then(v => { if (v) setExamLabel(v) })
  }, [])

  const NAV = [
    { id: 'today',    label: t('nav.today'),   icon: '☀' },
    { id: 'week',     label: t('nav.week'),    icon: '▦' },
    { id: 'day',      label: t('nav.day'),     icon: '◷' },
    { id: 'habits',   label: t('nav.habits'),  icon: '◎' },
    { id: 'kpss',     label: t('nav.kpss'),    icon: '✦' },
    { id: 'videos',   label: t('nav.videos'),  icon: '▶' },
    { id: 'streaks',  label: t('nav.streaks'), icon: '◈' },
    { id: 'study',    label: t('nav.study'),    icon: '⏱' },
    { id: 'mock',     label: t('nav.mock'),     icon: '◉' },
    { id: 'practice', label: t('nav.practice'), icon: '✎' },
    { id: 'settings', label: t('nav.settings'), icon: '⚙' },
  ]

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <img
          src={logoSrc}
          alt="logo"
          style={{ width: 52, height: 52, borderRadius: '50%', display: 'block', margin: '0 auto 8px' }}
        />
        <div className="sidebar-logo-sub" style={{ textAlign: 'center' }}>KPSS 2026</div>
      </div>

      <ul className="sidebar-nav">
        {NAV.map(item => (
          <li key={item.id}>
            <button
              className={`sidebar-nav-item${currentPage === item.id ? ' active' : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              <span className="sidebar-nav-icon">{item.icon}</span>
              {item.label}
            </button>
          </li>
        ))}
      </ul>

      <div className="sidebar-countdown">
        <div className="countdown-label">{examLabel}</div>
        {passed ? (
          <div className="countdown-days" style={{ fontSize: 18, color: 'var(--success)' }}>
            {t('nav.countdown.passed')}
          </div>
        ) : (
          <>
            <div className="countdown-days">{days}</div>
            <div className="countdown-sub">{t('nav.countdown.days')}</div>
          </>
        )}
      </div>
    </nav>
  )
}
