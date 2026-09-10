import React, { useState, useEffect } from 'react'
import { useLang } from '../context/LangContext'

function heatColor(pct) {
  if (pct === undefined || pct === null || pct === 0) return 'var(--surface-2, #e5e7eb)'
  if (pct === 100) return '#f59e0b'
  if (pct >= 70)   return '#0d9488'
  if (pct >= 40)   return '#0891b2'
  return '#67e8f9'
}

function Heatmap({ heatmap }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().slice(0, 10)

  // Monday of the current week
  const dow = today.getDay()
  const daysSinceMon = dow === 0 ? 6 : dow - 1
  const thisMonday = new Date(today)
  thisMonday.setDate(today.getDate() - daysSinceMon)

  // 52 weeks: start from 51 weeks before this Monday
  const startMonday = new Date(thisMonday)
  startMonday.setDate(startMonday.getDate() - 51 * 7)

  const weeks = []
  const cur = new Date(startMonday)
  for (let w = 0; w < 52; w++) {
    const week = []
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cur))
      cur.setDate(cur.getDate() + 1)
    }
    weeks.push(week)
  }

  const MONTHS = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']
  const monthLabels = []
  let lastM = -1
  weeks.forEach((week, wi) => {
    const m = week[0].getMonth()
    if (m !== lastM) { monthLabels[wi] = MONTHS[m]; lastM = m }
  })

  const CELL = 12
  const GAP  = 3

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
      {/* Month labels */}
      <div style={{ display: 'flex', marginLeft: 26, marginBottom: 4 }}>
        {weeks.map((_, wi) => (
          <div key={wi} style={{
            width: CELL + GAP, flexShrink: 0,
            fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
          }}>
            {monthLabels[wi] || ''}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: GAP }}>
        {/* Weekday labels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: GAP, marginRight: 2, flexShrink: 0 }}>
          {['Pt','','Ça','','Cu','','Pz'].map((d, i) => (
            <div key={i} style={{
              width: 16, height: CELL, fontSize: 9,
              color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            }}>{d}</div>
          ))}
        </div>

        {/* Week columns */}
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
            {week.map((date, di) => {
              const ds = date.toISOString().slice(0, 10)
              const isFuture = ds > todayStr
              const pct = heatmap?.[ds]
              const isToday = ds === todayStr
              return (
                <div
                  key={di}
                  title={isFuture ? ds : `${ds} — ${pct ?? 0}%`}
                  style={{
                    width: CELL, height: CELL, borderRadius: 2, flexShrink: 0,
                    background: isFuture ? 'transparent' : heatColor(pct),
                    outline: isToday ? '1.5px solid var(--accent)' : 'none',
                    outlineOffset: 0,
                    cursor: 'default',
                  }}
                />
              )
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Az</span>
        {[0, 30, 60, 90].map(p => (
          <div key={p} title={`~${p}%`} style={{ width: 11, height: 11, borderRadius: 2, background: heatColor(p || undefined) }} />
        ))}
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Çok</span>
        <div style={{ width: 1, height: 11, background: 'var(--border)', margin: '0 4px' }} />
        <div style={{ width: 11, height: 11, borderRadius: 2, background: '#f59e0b' }} />
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Mükemmel gün</span>
      </div>
    </div>
  )
}

function WeeklyPattern({ pattern }) {
  // pattern[0]=Sun … [6]=Sat; display Mon-Sun
  const days = [
    { label: 'Pzt', i: 1 }, { label: 'Sal', i: 2 }, { label: 'Çar', i: 3 },
    { label: 'Per', i: 4 }, { label: 'Cum', i: 5 }, { label: 'Cmt', i: 6 },
    { label: 'Paz', i: 0 },
  ]
  const todayDow = new Date().getDay()
  const max = Math.max(...days.map(d => pattern[d.i] || 0), 1)
  const BAR_H = 72

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: BAR_H + 24 }}>
        {days.map(({ label, i }) => {
          const pct = pattern[i] || 0
          const h = Math.max(Math.round((pct / 100) * BAR_H), pct > 0 ? 3 : 2)
          const isToday = todayDow === i
          const barColor = pct >= 80 ? '#059669' : pct >= 50 ? '#0d9488' : pct >= 20 ? '#0891b2' : 'var(--surface-2)'
          return (
            <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
              <div style={{ fontSize: 10, color: pct > 0 ? 'var(--text-muted)' : 'var(--border)', fontFamily: 'var(--font-mono)' }}>
                {pct > 0 ? `${pct}%` : '—'}
              </div>
              <div style={{
                width: '100%', height: h,
                background: barColor,
                borderRadius: '3px 3px 0 0',
                border: isToday ? '1.5px solid var(--accent)' : 'none',
                boxSizing: 'border-box',
              }} />
              <div style={{
                fontSize: 10, color: isToday ? 'var(--accent)' : 'var(--text-muted)',
                fontFamily: 'var(--font-mono)', fontWeight: isToday ? 700 : 400,
              }}>
                {label}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MomentumRing({ score }) {
  const r    = 36
  const circ = 2 * Math.PI * r
  const dash = ((score || 0) / 100) * circ
  const color = score >= 80 ? '#059669' : score >= 50 ? '#0d9488' : score >= 25 ? '#f59e0b' : '#ef4444'
  const label = score >= 80 ? 'Harika!' : score >= 50 ? 'İyi' : score >= 25 ? 'Çaba Gerekli' : 'Başla!'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
      <div style={{ position: 'relative', width: 88, height: 88, flexShrink: 0 }}>
        <svg width={88} height={88} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={44} cy={44} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={8} />
          <circle cx={44} cy={44} r={r} fill="none"
            stroke={color} strokeWidth={8}
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 22, fontFamily: 'var(--font-heading)', color, lineHeight: 1 }}>{score ?? 0}</div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>/ 100</div>
        </div>
      </div>
      <div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
          7 Günlük Momentum
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Ağırlıklı ortalama</div>
      </div>
    </div>
  )
}

function MiniDots({ recentDone }) {
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const days = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  const doneSet = new Set(recentDone || [])

  return (
    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 10 }}>
      {days.map(d => (
        <div key={d} title={d} style={{
          width: 10, height: 10, borderRadius: 2,
          background: doneSet.has(d) ? 'var(--success)' : 'var(--surface-2)',
          outline: d === todayStr ? '1.5px solid var(--accent)' : 'none',
          outlineOffset: 1,
          border: `1px solid ${doneSet.has(d) ? 'var(--success)' : 'var(--border)'}`,
        }} />
      ))}
    </div>
  )
}

function HabitStreakCard({ habit, t }) {
  const { current_streak, best_streak, recent_done } = habit
  const isRecord      = current_streak > 0 && current_streak >= best_streak && current_streak > 1
  const doneCount     = (recent_done || []).length
  const consistency   = Math.round((doneCount / 30) * 100)
  const accentColor   = current_streak > 0 ? 'var(--accent)' : 'var(--border)'

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 'var(--radius)',
      padding: '16px 18px',
      background: current_streak > 0 ? 'var(--surface)' : 'var(--bg)',
      borderLeft: `3px solid ${accentColor}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{habit.name}</span>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          {consistency >= 80 && (
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#059669', background: 'rgba(5,150,105,0.1)', padding: '2px 7px', borderRadius: 99 }}>
              {consistency}% tutarlı
            </span>
          )}
          {isRecord && (
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--gold)', background: 'var(--gold-bg)', padding: '2px 7px', borderRadius: 99 }}>
              {t('streaks.record')}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {t('streaks.current')}
          </div>
          <div style={{ fontSize: 26, fontFamily: 'var(--font-heading)', color: current_streak > 0 ? 'var(--accent)' : 'var(--text-light)', lineHeight: 1 }}>
            {current_streak}<span style={{ fontSize: 11, marginLeft: 3, color: 'var(--text-muted)' }}>{t('streaks.days')}</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {t('streaks.best')}
          </div>
          <div style={{ fontSize: 26, fontFamily: 'var(--font-heading)', color: best_streak > 0 ? 'var(--gold)' : 'var(--text-light)', lineHeight: 1 }}>
            {best_streak}<span style={{ fontSize: 11, marginLeft: 3, color: 'var(--text-muted)' }}>{t('streaks.days')}</span>
          </div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            30 gün
          </div>
          <div style={{ fontSize: 26, fontFamily: 'var(--font-heading)', color: consistency > 0 ? 'var(--text)' : 'var(--text-light)', lineHeight: 1 }}>
            {consistency}<span style={{ fontSize: 11, color: 'var(--text-muted)' }}>%</span>
          </div>
        </div>
      </div>

      <MiniDots recentDone={recent_done} />
    </div>
  )
}

export default function Streaks() {
  const { t }               = useLang()
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.streaks.get().then(d => { setData(d); setLoading(false) })
  }, [])

  if (loading) {
    return <div className="page"><p style={{ color: 'var(--text-muted)' }}>{t('common.loading')}</p></div>
  }

  const { habitStreaks, perfectDay, heatmap, weeklyPattern, momentum } = data
  const longestActive = habitStreaks.reduce((m, h) => h.current_streak > m ? h.current_streak : m, 0)

  return (
    <div className="page">
      <div className="page-header">
        <h1>{t('streaks.title')}</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>{t('streaks.subtitle')}</p>
      </div>

      {/* Hero stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 14, marginBottom: 24 }}>
        <div style={{ padding: '20px 24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <MomentumRing score={momentum ?? 0} />
        </div>

        <div style={{ padding: '20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
            {t('streaks.perfect')}
          </div>
          <div style={{ fontSize: 48, fontFamily: 'var(--font-heading)', color: perfectDay.current > 0 ? 'var(--accent)' : 'var(--text-light)', lineHeight: 1 }}>
            {perfectDay.current}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
            En iyi: {perfectDay.best} gün
          </div>
        </div>

        <div style={{ padding: '20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
            En Uzun Aktif
          </div>
          <div style={{ fontSize: 48, fontFamily: 'var(--font-heading)', color: longestActive > 0 ? '#059669' : 'var(--text-light)', lineHeight: 1 }}>
            {longestActive}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{t('streaks.days')}</div>
        </div>
      </div>

      {/* Year heatmap */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px 24px', marginBottom: 20 }}>
        <div className="section-title" style={{ marginBottom: 14 }}>Yıllık Aktivite</div>
        <Heatmap heatmap={heatmap} />
      </div>

      {/* Weekly pattern */}
      {weeklyPattern && weeklyPattern.some(v => v > 0) && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px 24px', marginBottom: 20 }}>
          <div className="section-title" style={{ marginBottom: 14 }}>Haftalık Düzen</div>
          <WeeklyPattern pattern={weeklyPattern} />
        </div>
      )}

      {/* Per-habit streaks */}
      {habitStreaks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>◈</div>
          <p style={{ fontSize: 14 }}>{t('streaks.no_habits')}</p>
        </div>
      ) : (
        <div style={{ marginBottom: 20 }}>
          <div className="section-title" style={{ marginBottom: 12 }}>{t('streaks.per_habit')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {habitStreaks
              .sort((a, b) => b.current_streak - a.current_streak)
              .map(h => <HabitStreakCard key={h.id} habit={h} t={t} />)}
          </div>
        </div>
      )}

      {/* Recent perfect days */}
      {perfectDay.days?.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 20px' }}>
          <div className="section-title" style={{ marginBottom: 10 }}>{t('streaks.recent_perfect')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {perfectDay.days.slice(0, 30).map(d => (
              <div key={d} style={{
                padding: '4px 10px', background: 'var(--success-bg)',
                border: '1px solid var(--success-light)', borderRadius: 'var(--radius-sm)',
                fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--success)',
              }}>
                {d}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
