import React, { useState, useEffect, useRef } from 'react'
import { COLORS, getColor } from '../utils/colors'

export default function ColorPicker({ color, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const c = getColor(color)

  useEffect(() => {
    function close(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <div
        title="Renk seç"
        onClick={e => { e.stopPropagation(); setOpen(p => !p) }}
        style={{
          width: 14, height: 14, borderRadius: 3,
          background: c.hex, cursor: 'pointer',
          border: '1.5px solid rgba(0,0,0,0.13)',
          transition: 'transform 0.1s',
        }}
      />
      {open && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute', top: 20, left: 0, zIndex: 400,
            background: 'var(--bg)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: 8,
            display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 5,
            boxShadow: 'var(--shadow-md)', width: 192,
          }}
        >
          {COLORS.map(col => {
            const isLight = ['white','silver','lightgray'].includes(col.id)
            const isSelected = color === col.id
            return (
              <div
                key={col.id}
                title={col.label}
                onClick={() => { onChange(col.id); setOpen(false) }}
                style={{
                  width: 22, height: 22, borderRadius: 4,
                  background: col.hex, cursor: 'pointer',
                  border: isSelected
                    ? '2.5px solid var(--text)'
                    : isLight
                    ? '1.5px solid var(--border-strong, #9ca3af)'
                    : '2px solid transparent',
                  transition: 'transform 0.1s',
                  boxSizing: 'border-box',
                }}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
