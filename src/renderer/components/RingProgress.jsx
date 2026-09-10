import React from 'react'

export default function RingProgress({ value, size = 72, strokeWidth = 7, label, sub }) {
  const r = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (Math.min(value, 100) / 100) * circ
  const color = value >= 100 ? 'var(--success)' : value >= 50 ? 'var(--accent)' : 'var(--accent)'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} style={{ display: 'block' }}>
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none"
            stroke="var(--surface-2)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{
              transform: 'rotate(-90deg)',
              transformOrigin: 'center',
              transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1)'
            }}
          />
        </svg>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <span style={{
            fontSize: size * 0.21,
            fontWeight: 700,
            color: 'var(--text)',
            fontFamily: 'var(--font-mono)',
            lineHeight: 1
          }}>
            {value}%
          </span>
        </div>
      </div>
      {(label || sub) && (
        <div>
          {label && <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{label}</div>}
          {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
        </div>
      )}
    </div>
  )
}
