import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine, ComposedChart
} from 'recharts'
import { playExamStart, playExamEnd, playPause, playResume } from '../utils/sounds'

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcNet(c, w) { return c - w / 4 }

function fmtDate(s) {
  if (!s) return ''
  const [y, m, d] = s.split('-')
  return `${d}.${m}.${y.slice(2)}`
}

function todayStr() { return new Date().toISOString().slice(0, 10) }

function fmtSecs(s) {
  if (!s) return '—'
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}s ${m}dk`
  if (m > 0) return `${m}dk ${s % 60}sn`
  return `${s}sn`
}

function fmtTimer(s) {
  const abs = Math.abs(s)
  const h = Math.floor(abs / 3600), m = Math.floor((abs % 3600) / 60), sec = abs % 60
  const sign = s < 0 ? '+' : ''
  const base = `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return h > 0 ? `${sign}${h}:${base}` : `${sign}${base}`
}

const MOTIV = {
  start: [
    'Hazır ol, bu sefer fark yaratacaksın!',
    'Odaklan — her soru bir fırsat.',
    'Dikkat, azim, başarı. Hepsi seninle.',
    'Başarıya giden yol denemelerden geçer.',
  ],
  end: [
    'Tebrikler! Her deneme seni hedefe yaklaştırıyor.',
    'Harikasın. Şimdi yanlışlarını analiz et.',
    'Bravo! Devam et, başarı yolundasın.',
    'Çalışman karşılığını mutlaka verecek.',
  ],
  early: [
    'Hızlısın — erken bitirdin! Kontrol et.',
    'Süreyi verimli kullandın.',
    'Hız güzel ama doğruluktan emin ol.',
  ],
  overtime: [
    'Süre aştı ama pes etmiyorsun — işte azim!',
    'Emek ve kararlılık seni başarıya taşır.',
    'Her ekstra saniye sana katkı sağlıyor.',
  ],
}
function pickM(type) { const a = MOTIV[type] || MOTIV.end; return a[Math.floor(Math.random() * a.length)] }

let _uid = 0
function uid() { return `r${++_uid}` }
function emptyRow(label = '', catId = null) {
  return { _uid: uid(), subject_label: label, kpss_category_id: catId, correct: 0, wrong: 0, blank: 0 }
}

const ACCENT = '#5a4fcf'
const BAR_COLORS = ['#5a4fcf', '#0b9e74', '#e09320', '#e04545', '#7c6fe0', '#2db895']

// ── ExamTimer ─────────────────────────────────────────────────────────────────

function ExamTimer({ categories, onDone }) {
  const [mode, setMode] = useState('section')
  const [catId, setCatId] = useState('')
  const [durationMin, setDurationMin] = useState(30)
  const [phase, setPhase] = useState('idle')
  const [remaining, setRemaining] = useState(0)
  const [extraSec, setExtraSec] = useState(0)
  const [startedAt, setStartedAt] = useState(null)
  const [motiv, setMotiv] = useState('')
  const tickRef = useRef(null)
  const overtimeFiredRef = useRef(false)

  const totalSecs = durationMin * 60

  useEffect(() => { setDurationMin(mode === 'section' ? 30 : 130) }, [mode])
  useEffect(() => () => clearInterval(tickRef.current), [])

  function startTick() {
    clearInterval(tickRef.current)
    tickRef.current = setInterval(() => {
      setRemaining(prev => {
        const next = prev - 1
        if (next <= 0 && !overtimeFiredRef.current) {
          overtimeFiredRef.current = true
          setPhase('overtime')
          playExamEnd()
          setMotiv(pickM('end'))
        }
        if (next < 0) setExtraSec(e => e + 1)
        return next
      })
    }, 1000)
  }

  function handleStart() {
    if (mode === 'section' && !catId) { alert('Lütfen bir ders seçin.'); return }
    setStartedAt(new Date().toISOString())
    setRemaining(totalSecs)
    setExtraSec(0)
    overtimeFiredRef.current = false
    setPhase('running')
    setMotiv(pickM('start'))
    playExamStart()
    startTick()
  }

  function handlePause() { clearInterval(tickRef.current); setPhase('paused'); playPause() }
  function handleResume() { setPhase(remaining <= 0 ? 'overtime' : 'running'); playResume(); startTick() }

  function handleStop() {
    clearInterval(tickRef.current)
    const elapsed = totalSecs - Math.max(remaining, 0) + extraSec
    const cat = categories.find(c => c.id === parseInt(catId))
    onDone({ mode, catId: catId ? parseInt(catId) : null, catName: cat?.name || '', durationMin, elapsedSeconds: elapsed, startedAt })
  }

  const pct = phase !== 'idle' ? Math.max(0, (remaining / totalSecs) * 100) : 100
  const isOver = phase === 'overtime'

  // ── Idle state ──────────────────────────────────────────────────────────────
  if (phase === 'idle') {
    return (
      <div className="exam-timer-panel">
        <div className="exam-seg-ctrl">
          <button className={`exam-seg-btn${mode === 'section' ? ' active' : ''}`} onClick={() => setMode('section')}>
            📚 Bölüm Denemesi
          </button>
          <button className={`exam-seg-btn${mode === 'general' ? ' active' : ''}`} onClick={() => setMode('general')}>
            📋 Genel Deneme
          </button>
        </div>

        <div className="exam-timer-fields">
          {mode === 'section' && (
            <div className="exam-field-group">
              <label className="exam-field-label">Ders</label>
              <select value={catId} onChange={e => setCatId(e.target.value)}>
                <option value="">Ders seçin…</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          <div className="exam-field-group">
            <label className="exam-field-label">Süre</label>
            <div className="exam-duration-row">
              <button className="exam-dur-btn" onClick={() => setDurationMin(m => Math.max(5, m - 5))}>−</button>
              <input
                type="number" min="1" max="360" value={durationMin}
                onChange={e => setDurationMin(Math.max(1, parseInt(e.target.value) || 1))}
                style={{ width: 60, textAlign: 'center' }}
              />
              <span className="exam-dur-unit">dakika</span>
              <button className="exam-dur-btn" onClick={() => setDurationMin(m => Math.min(360, m + 5))}>+</button>
              <span className="exam-dur-hint">varsayılan {mode === 'section' ? '30' : '130'} dk</span>
            </div>
          </div>
        </div>

        <button className="btn btn-primary exam-start-btn" onClick={handleStart}>
          Denemeyi Başlat
        </button>
      </div>
    )
  }

  // ── Running / Paused / Overtime ─────────────────────────────────────────────
  const cat = categories.find(c => c.id === parseInt(catId))
  const label = mode === 'section' ? (cat?.name || 'Bölüm Denemesi') : 'Genel Deneme'
  const minsLeft = Math.ceil(Math.max(remaining, 0) / 60)

  return (
    <div className={`exam-timer-panel${isOver ? ' exam-overtime-mode' : ''}`}>
      {isOver && (
        <div className="exam-overtime-banner">
          <div className="exam-overtime-title">DENEME BİTTİ</div>
          <div className="exam-overtime-sub">{label}</div>
        </div>
      )}

      <div className="exam-running-header">
        <span className={`mock-type-badge ${mode === 'section' ? 'section' : 'general'}`}>
          {mode === 'section' ? 'Bölüm' : 'Genel'}
        </span>
        <span className="exam-subject-name">{label}</span>
        {phase === 'paused' && <span className="exam-paused-label">⏸ Duraklıyor</span>}
      </div>

      <div className="exam-clock-wrap">
        {isOver ? (
          <>
            <div className="exam-clock-done">✓ {fmtTimer(totalSecs)}</div>
            <div className="exam-extra-time">+{fmtTimer(extraSec)}</div>
            <div className="exam-extra-label">ekstra süre</div>
          </>
        ) : (
          <>
            <div className={`exam-clock${phase === 'paused' ? ' paused' : ''}`}>{fmtTimer(remaining)}</div>
            <div className="exam-time-left">
              {remaining > 60 ? `${minsLeft} dakika kaldı` : remaining > 0 ? `${remaining} saniye kaldı` : ''}
            </div>
          </>
        )}
      </div>

      {!isOver && (
        <div className="exam-prog-bar">
          <div
            className="exam-prog-fill"
            style={{ width: `${pct}%`, background: pct < 15 ? 'var(--warn)' : pct < 30 ? 'var(--gold)' : ACCENT }}
          />
        </div>
      )}

      {motiv && (
        <div className={`exam-motiv${isOver ? ' overtime' : ''}`}>"{motiv}"</div>
      )}

      <div className="exam-ctrl-row">
        {phase === 'running' && (
          <button className="btn btn-ghost" onClick={handlePause}>⏸ Duraklat</button>
        )}
        {phase === 'paused' && (
          <button className="btn btn-primary" onClick={handleResume}>▶ Devam Et</button>
        )}
        {isOver && (
          <button className="btn btn-primary exam-finish-btn" onClick={handleStop}>Kaydet ve Bitir</button>
        )}
        {(phase === 'running' || phase === 'paused') && (
          <button className="btn btn-ghost" onClick={() => {
            if (window.confirm('Denemeyi bitirmek istediğinize emin misiniz?')) handleStop()
          }}>⏹ Bitir</button>
        )}
      </div>
    </div>
  )
}

// ── WrongTopicsPanel ──────────────────────────────────────────────────────────

function WrongTopicsPanel({ sections, allTopics, savedSectionIds, onSave }) {
  const topicsByCat = useMemo(() => {
    const map = {}
    for (const t of allTopics) {
      if (!map[t.category_id]) map[t.category_id] = { name: t.category_name, topics: [] }
      map[t.category_id].topics.push(t)
    }
    return map
  }, [allTopics])

  const [wrongsBySec, setWrongsBySec] = useState({})
  const [pickerBySec, setPickerBySec] = useState({})
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  const sectionsWithWrong = sections.filter(s => (s.wrong || 0) > 0)

  function getPicker(k) { return pickerBySec[k] || { topicId: '', topicLabel: '', catId: '', catLabel: '', wrongCount: 1 } }
  function setPicker(k, v) { setPickerBySec(p => ({ ...p, [k]: v })) }

  function handleTopicSelect(k, val) {
    if (!val) { setPicker(k, { ...getPicker(k), topicId: '', topicLabel: '', catId: '', catLabel: '' }); return }
    const t = allTopics.find(t => t.id === parseInt(val))
    if (t) setPicker(k, { ...getPicker(k), topicId: t.id, topicLabel: t.text, catId: t.category_id, catLabel: t.category_name })
  }

  function addWrong(k) {
    const p = getPicker(k)
    if (!p.topicLabel.trim()) { alert('Konu seçin.'); return }
    setWrongsBySec(prev => {
      const list = prev[k] || []
      const idx = list.findIndex(w => w.topicLabel === p.topicLabel)
      if (idx >= 0) {
        const upd = [...list]; upd[idx] = { ...upd[idx], wrongCount: upd[idx].wrongCount + (p.wrongCount || 1) }
        return { ...prev, [k]: upd }
      }
      return { ...prev, [k]: [...list, { topicId: p.topicId || null, topicLabel: p.topicLabel, categoryId: p.catId || null, categoryLabel: p.catLabel || '', wrongCount: p.wrongCount || 1, note: '' }] }
    })
    setPicker(k, { topicId: '', topicLabel: '', catId: '', catLabel: '', wrongCount: 1 })
  }

  function updateNote(k, i, note) {
    setWrongsBySec(prev => { const l = [...(prev[k] || [])]; l[i] = { ...l[i], note }; return { ...prev, [k]: l } })
  }

  function removeWrong(k, i) {
    setWrongsBySec(prev => ({ ...prev, [k]: (prev[k] || []).filter((_, j) => j !== i) }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      for (const s of sectionsWithWrong) {
        const secId = savedSectionIds[s._uid]
        if (!secId) continue
        await window.api.mockExams.wrongTopics.save(secId, wrongsBySec[s._uid] || [])
      }
      setSavedMsg('Yanlış analizi kaydedildi.')
      if (onSave) onSave()
    } finally { setSaving(false) }
  }

  if (sectionsWithWrong.length === 0) return (
    <div className="wrong-topics-empty">Yanlış yoksa analiz gerekmez.</div>
  )

  return (
    <div className="wrong-topics-panel">
      <div className="wrong-topics-header">
        <span style={{ fontSize: 15 }}>📊</span>
        <div>
          <div style={{ fontWeight: 700 }}>Yanlış Analizi</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>Yanlışlarını konularla eşleştir — opsiyonel</div>
        </div>
      </div>

      {sectionsWithWrong.map(sec => {
        const wrongs = wrongsBySec[sec._uid] || []
        const p = getPicker(sec._uid)
        const usedCount = wrongs.reduce((s, w) => s + w.wrongCount, 0)
        const remaining = (sec.wrong || 0) - usedCount

        return (
          <div key={sec._uid} className="wrong-section-block">
            <div className="wrong-section-title">
              <span className="wrong-count-badge">{sec.wrong}❌</span>
              <span style={{ fontWeight: 600 }}>{sec.subject_label || '—'}</span>
              {remaining > 0 && <span className="wrong-remaining">{remaining} eşleştirilmedi</span>}
            </div>

            <div className="wrong-picker-row">
              <select
                value={p.topicId ? `${p.topicId}` : ''}
                onChange={e => handleTopicSelect(sec._uid, e.target.value)}
                style={{ flex: 1 }}
              >
                <option value="">Konu seçin…</option>
                {Object.entries(topicsByCat).map(([catId, cat]) => (
                  <optgroup key={catId} label={cat.name}>
                    {cat.topics.map(t => (
                      <option key={t.id} value={t.id}>{t.text}{!t.done ? ' ⚠' : ''}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <input
                type="number" min="1" max="99" value={p.wrongCount}
                onChange={e => setPicker(sec._uid, { ...p, wrongCount: Math.max(1, parseInt(e.target.value) || 1) })}
                style={{ width: 50 }} title="Bu konudan kaç yanlış"
              />
              <button className="btn btn-ghost btn-sm" onClick={() => addWrong(sec._uid)}>+ Ekle</button>
            </div>

            {wrongs.length > 0 && (
              <div className="wrong-list">
                {wrongs.map((w, i) => {
                  const topic = allTopics.find(t => t.id === w.topicId)
                  return (
                    <div key={i} className="wrong-item">
                      <div className="wrong-item-top">
                        <span className="wrong-count-badge">{w.wrongCount}❌</span>
                        <span className="wrong-topic-label">{w.topicLabel}</span>
                        {w.categoryLabel && <span className="wrong-cat-badge">{w.categoryLabel}</span>}
                        {topic && !topic.done && <span className="wrong-undone-warn">⚠ Tamamlanmadı</span>}
                        <button className="btn-icon" style={{ marginLeft: 'auto' }} onClick={() => removeWrong(sec._uid, i)}>✕</button>
                      </div>
                      <input
                        type="text"
                        placeholder="Not ekle… (örn: Bu konuyu tekrar çalışmalıyım)"
                        value={w.note || ''}
                        onChange={e => updateNote(sec._uid, i, e.target.value)}
                        className="wrong-note-input"
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {savedMsg ? (
        <div className="wrong-saved-msg">✓ {savedMsg}</div>
      ) : (
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving} style={{ marginTop: 12 }}>
          {saving ? 'Kaydediliyor…' : 'Yanlış Analizini Kaydet'}
        </button>
      )}
    </div>
  )
}

// ── PostExamSaveForm ──────────────────────────────────────────────────────────

function PostExamSaveForm({ timerData, categories, allTopics, onSaved, onCancel }) {
  const defaultName = timerData
    ? `${timerData.catName || 'Genel'} ${timerData.mode === 'section' ? 'Bölüm' : 'Genel'} ${fmtDate(todayStr())}`
    : ''

  const [name, setName] = useState(defaultName)
  const [date, setDate] = useState(todayStr())
  const [rows, setRows] = useState(() =>
    timerData?.mode === 'section' && timerData.catId
      ? [emptyRow(timerData.catName, timerData.catId)]
      : [emptyRow()]
  )
  const [saving, setSaving] = useState(false)
  const [savedSectionIds, setSavedSectionIds] = useState({})
  const [phase, setPhase] = useState('form') // form | wrongs

  const totals = useMemo(() => {
    const c = rows.reduce((s, r) => s + (r.correct || 0), 0)
    const w = rows.reduce((s, r) => s + (r.wrong || 0), 0)
    const b = rows.reduce((s, r) => s + (r.blank || 0), 0)
    return { c, w, b, net: calcNet(c, w) }
  }, [rows])

  function numInput(uid, field, e) {
    const v = Math.max(0, parseInt(e.target.value) || 0)
    setRows(prev => prev.map(r => r._uid === uid ? { ...r, [field]: v } : r))
  }

  function selectSubject(uid, e) {
    const v = e.target.value
    const cat = categories.find(c => c.id === parseInt(v))
    setRows(prev => prev.map(r => r._uid === uid ? { ...r, subject_label: cat?.name || '', kpss_category_id: parseInt(v) || null } : r))
  }

  async function handleSave() {
    if (!name.trim()) { alert('Sınav adı girin.'); return }
    const valid = rows.filter(r => r.subject_label.trim())
    if (valid.length === 0) { alert('En az bir ders seçin.'); return }
    setSaving(true)
    try {
      const examType = timerData?.mode === 'section' ? 'section' : 'general'
      const result = await window.api.mockExams.add({
        name: name.trim(), exam_type: examType, date, sections: valid,
        duration_seconds: timerData?.elapsedSeconds || 0, started_at: timerData?.startedAt || null,
      })
      const idMap = {}
      result.sections.forEach((s, i) => { if (valid[i]) idMap[valid[i]._uid] = s.id })
      setSavedSectionIds(idMap)
      setPhase('wrongs')
      onSaved()
    } finally { setSaving(false) }
  }

  const isSectionLocked = timerData?.mode === 'section'
  const examType = timerData?.mode === 'section' ? 'section' : 'general'

  if (phase === 'wrongs') {
    const valid = rows.filter(r => r.subject_label.trim())
    return (
      <div>
        <div className="exam-save-success">
          <div className="exam-save-success-icon">✓</div>
          <div>
            <div style={{ fontWeight: 600 }}>{name} kaydedildi</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              D:{totals.c} Y:{totals.w} B:{totals.b} Net:{totals.net.toFixed(2)}
              {timerData?.elapsedSeconds ? ` • ${fmtSecs(timerData.elapsedSeconds)}` : ''}
            </div>
          </div>
        </div>
        <WrongTopicsPanel sections={valid} allTopics={allTopics} savedSectionIds={savedSectionIds} onSave={onCancel} />
        <button className="btn btn-ghost btn-sm" onClick={onCancel} style={{ marginTop: 12 }}>Analiz olmadan geç →</button>
      </div>
    )
  }

  return (
    <div>
      {timerData && (
        <div className="exam-timer-result-info">
          <span className={`mock-type-badge ${examType === 'section' ? 'section' : 'general'}`}>
            {examType === 'section' ? 'Bölüm' : 'Genel'}
          </span>
          {timerData.elapsedSeconds > 0 && <span>⏱ {fmtSecs(timerData.elapsedSeconds)}</span>}
          {timerData.elapsedSeconds > timerData.durationMin * 60 && (
            <span style={{ color: 'var(--gold)', fontSize: 12 }}>
              +{fmtSecs(timerData.elapsedSeconds - timerData.durationMin * 60)} ekstra
            </span>
          )}
        </div>
      )}

      <div className="mock-form-header">
        <div style={{ flex: 1 }}>
          <div className="mock-field-label">Sınav Adı</div>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="ör. Türkçe Bölüm 1" style={{ width: '100%' }} />
        </div>
        <div>
          <div className="mock-field-label">Tarih</div>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: 'auto' }} />
        </div>
      </div>

      <div className="mock-section-table">
        <div className="mock-section-header">
          <div className="mock-col-subject">Ders</div>
          <div className="mock-col-num">D</div>
          <div className="mock-col-num">Y</div>
          <div className="mock-col-num">B</div>
          <div className="mock-col-net">Net</div>
          <div className="mock-col-del" />
        </div>
        {rows.map(row => (
          <div key={row._uid} className="mock-section-row">
            <div className="mock-col-subject">
              {isSectionLocked && rows.length === 1
                ? <span style={{ fontSize: 13, fontWeight: 500 }}>{row.subject_label}</span>
                : (
                  <select value={row.kpss_category_id || ''} onChange={e => selectSubject(row._uid, e)}>
                    <option value="">— Seçin —</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )
              }
            </div>
            {['correct','wrong','blank'].map(f => (
              <div key={f} className="mock-col-num">
                <input type="number" min="0" value={row[f]} onChange={e => numInput(row._uid, f, e)} />
              </div>
            ))}
            <div className="mock-col-net">{calcNet(row.correct, row.wrong).toFixed(2)}</div>
            <div className="mock-col-del">
              {rows.length > 1 && <button className="btn-icon" onClick={() => setRows(p => p.filter(r => r._uid !== row._uid))}>✕</button>}
            </div>
          </div>
        ))}
        {rows.length > 1 && (
          <div className="mock-section-row mock-total-row">
            <div className="mock-col-subject" style={{ fontWeight: 700, fontSize: 12 }}>Toplam</div>
            <div className="mock-col-num" style={{ fontWeight: 700 }}>{totals.c}</div>
            <div className="mock-col-num" style={{ fontWeight: 700 }}>{totals.w}</div>
            <div className="mock-col-num" style={{ fontWeight: 700 }}>{totals.b}</div>
            <div className="mock-col-net" style={{ fontWeight: 700 }}>{totals.net.toFixed(2)}</div>
            <div className="mock-col-del" />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'center' }}>
        {!isSectionLocked && <button className="btn btn-ghost btn-sm" onClick={() => setRows(p => [...p, emptyRow()])}>+ Ders Ekle</button>}
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</button>
        {onCancel && <button className="btn btn-ghost btn-sm" onClick={onCancel}>İptal</button>}
      </div>
    </div>
  )
}

// ── ManualExamForm ────────────────────────────────────────────────────────────

function ManualExamForm({ categories, allTopics, onSaved }) {
  const [examType, setExamType] = useState('section')
  const [name, setName] = useState('')
  const [date, setDate] = useState(todayStr())
  const [durationMin, setDurationMin] = useState('')
  const [rows, setRows] = useState([emptyRow()])
  const [saving, setSaving] = useState(false)
  const [savedSectionIds, setSavedSectionIds] = useState({})
  const [phase, setPhase] = useState('form')

  const totals = useMemo(() => {
    const c = rows.reduce((s, r) => s + (r.correct || 0), 0)
    const w = rows.reduce((s, r) => s + (r.wrong || 0), 0)
    const b = rows.reduce((s, r) => s + (r.blank || 0), 0)
    return { c, w, b, net: calcNet(c, w) }
  }, [rows])

  function numInput(uid, field, e) {
    const v = Math.max(0, parseInt(e.target.value) || 0)
    setRows(prev => prev.map(r => r._uid === uid ? { ...r, [field]: v } : r))
  }

  function selectSubject(uid, e) {
    const cat = categories.find(c => c.id === parseInt(e.target.value))
    setRows(prev => prev.map(r => r._uid === uid ? { ...r, subject_label: cat?.name || '', kpss_category_id: parseInt(e.target.value) || null } : r))
  }

  async function handleSave() {
    if (!name.trim()) { alert('Sınav adı girin.'); return }
    const valid = rows.filter(r => r.subject_label.trim())
    if (valid.length === 0) { alert('En az bir ders seçin.'); return }
    setSaving(true)
    try {
      const result = await window.api.mockExams.add({
        name: name.trim(), exam_type: examType, date, sections: valid,
        duration_seconds: durationMin ? parseInt(durationMin) * 60 : 0, started_at: null,
      })
      const idMap = {}
      result.sections.forEach((s, i) => { if (valid[i]) idMap[valid[i]._uid] = s.id })
      setSavedSectionIds(idMap)
      setPhase('wrongs')
      onSaved()
    } finally { setSaving(false) }
  }

  function reset() { setPhase('form'); setName(''); setDate(todayStr()); setRows([emptyRow()]); setDurationMin('') }

  if (phase === 'wrongs') {
    const valid = rows.filter(r => r.subject_label.trim())
    return (
      <div>
        <div className="exam-save-success">
          <div className="exam-save-success-icon">✓</div>
          <div>
            <div style={{ fontWeight: 600 }}>{name} kaydedildi</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>D:{totals.c} Y:{totals.w} B:{totals.b} Net:{totals.net.toFixed(2)}</div>
          </div>
        </div>
        <WrongTopicsPanel sections={valid} allTopics={allTopics} savedSectionIds={savedSectionIds} onSave={reset} />
        <button className="btn btn-ghost btn-sm" onClick={reset} style={{ marginTop: 12 }}>Analiz olmadan geç →</button>
      </div>
    )
  }

  return (
    <div>
      <div className="exam-seg-ctrl" style={{ maxWidth: 360, marginBottom: 20 }}>
        <button className={`exam-seg-btn${examType === 'section' ? ' active' : ''}`} onClick={() => setExamType('section')}>📚 Bölüm</button>
        <button className={`exam-seg-btn${examType === 'general' ? ' active' : ''}`} onClick={() => setExamType('general')}>📋 Genel</button>
      </div>

      <div className="mock-form-header">
        <div style={{ flex: 1 }}>
          <div className="mock-field-label">Sınav Adı</div>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder={examType === 'section' ? 'ör. Türkçe Bölüm 3' : 'ör. KPSS Genel Deneme 2'}
            style={{ width: '100%' }} />
        </div>
        <div>
          <div className="mock-field-label">Tarih</div>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: 'auto' }} />
        </div>
        <div>
          <div className="mock-field-label">Süre (dk)</div>
          <input type="number" min="1" max="360" value={durationMin}
            onChange={e => setDurationMin(e.target.value)} placeholder="—" style={{ width: 72 }} />
        </div>
      </div>

      <div className="mock-section-table">
        <div className="mock-section-header">
          <div className="mock-col-subject">Ders</div>
          <div className="mock-col-num">D</div>
          <div className="mock-col-num">Y</div>
          <div className="mock-col-num">B</div>
          <div className="mock-col-net">Net</div>
          <div className="mock-col-del" />
        </div>
        {rows.map(row => (
          <div key={row._uid} className="mock-section-row">
            <div className="mock-col-subject">
              <select value={row.kpss_category_id || ''} onChange={e => selectSubject(row._uid, e)}>
                <option value="">— Seçin —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {['correct','wrong','blank'].map(f => (
              <div key={f} className="mock-col-num">
                <input type="number" min="0" value={row[f]} onChange={e => numInput(row._uid, f, e)} />
              </div>
            ))}
            <div className="mock-col-net">{calcNet(row.correct, row.wrong).toFixed(2)}</div>
            <div className="mock-col-del">
              {rows.length > 1 && <button className="btn-icon" onClick={() => setRows(p => p.filter(r => r._uid !== row._uid))}>✕</button>}
            </div>
          </div>
        ))}
        {rows.length > 1 && (
          <div className="mock-section-row mock-total-row">
            <div className="mock-col-subject" style={{ fontWeight: 700, fontSize: 12 }}>Toplam</div>
            <div className="mock-col-num" style={{ fontWeight: 700 }}>{totals.c}</div>
            <div className="mock-col-num" style={{ fontWeight: 700 }}>{totals.w}</div>
            <div className="mock-col-num" style={{ fontWeight: 700 }}>{totals.b}</div>
            <div className="mock-col-net" style={{ fontWeight: 700 }}>{totals.net.toFixed(2)}</div>
            <div className="mock-col-del" />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setRows(p => [...p, emptyRow()])}>+ Ders Ekle</button>
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</button>
      </div>
    </div>
  )
}

// ── ExamHistory ────────────────────────────────────────────────────────────────

function ExamHistoryDetail({ exam, sections, allTopics }) {
  const [wrongTopics, setWrongTopics] = useState(null)
  const [localNotes, setLocalNotes] = useState({})
  const [editingId, setEditingId] = useState(null)

  useEffect(() => {
    window.api.mockExams.wrongTopics.getByExam(exam.id).then(data => {
      setWrongTopics(data)
      const n = {}; data.forEach(w => { n[w.id] = w.note || '' }); setLocalNotes(n)
    })
  }, [exam.id])

  const secs = sections.filter(s => s.mock_exam_id === exam.id)
  const c = secs.reduce((s, r) => s + r.correct, 0)
  const w = secs.reduce((s, r) => s + r.wrong, 0)
  const b = secs.reduce((s, r) => s + r.blank, 0)
  const n = calcNet(c, w)

  const wtBySec = useMemo(() => {
    if (!wrongTopics) return {}
    const map = {}
    for (const wt of wrongTopics) {
      if (!map[wt.section_id]) map[wt.section_id] = []
      map[wt.section_id].push(wt)
    }
    return map
  }, [wrongTopics])

  async function saveNote(id) {
    await window.api.mockExams.wrongTopics.update(id, { note: localNotes[id] || '' })
    setEditingId(null)
  }

  return (
    <div className="mock-history-detail">
      <div className="history-detail-summary">
        <span className="mock-badge-d">D:{c}</span>
        <span className="mock-badge-y">Y:{w}</span>
        <span className="mock-badge-b">B:{b}</span>
        <span className="mock-badge-net">{n.toFixed(2)} net</span>
        {exam.duration_seconds > 0 && <span className="mock-badge-b">⏱ {fmtSecs(exam.duration_seconds)}</span>}
      </div>

      <div className="mock-section-table">
        <div className="mock-section-header">
          <div className="mock-col-subject">Ders</div>
          <div className="mock-col-num">D</div>
          <div className="mock-col-num">Y</div>
          <div className="mock-col-num">B</div>
          <div className="mock-col-net">Net</div>
          <div className="mock-col-del" />
        </div>
        {secs.map(s => (
          <React.Fragment key={s.id}>
            <div className="mock-section-row">
              <div className="mock-col-subject" style={{ fontWeight: 500 }}>{s.subject_label}</div>
              <div className="mock-col-num">{s.correct}</div>
              <div className="mock-col-num">{s.wrong}</div>
              <div className="mock-col-num">{s.blank}</div>
              <div className="mock-col-net">{calcNet(s.correct, s.wrong).toFixed(2)}</div>
              <div className="mock-col-del" />
            </div>
            {wtBySec[s.id]?.length > 0 && (
              <div className="wrong-history-sec">
                {wtBySec[s.id].map(wt => {
                  const topic = allTopics.find(t => t.id === wt.kpss_topic_id)
                  return (
                    <div key={wt.id} className="wrong-history-item">
                      <div className="wrong-history-top">
                        <span className="wrong-count-badge">{wt.wrong_count}❌</span>
                        <span>{wt.topic_label}</span>
                        {wt.category_label && <span className="wrong-cat-badge">{wt.category_label}</span>}
                        {topic && !topic.done && <span className="wrong-undone-warn">⚠ Tamamlanmadı</span>}
                        <button className="btn-icon" style={{ marginLeft: 'auto', fontSize: 11 }} onClick={() => setEditingId(wt.id)}>✏</button>
                      </div>
                      {editingId === wt.id ? (
                        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                          <input type="text" value={localNotes[wt.id] || ''} onChange={e => setLocalNotes(p => ({ ...p, [wt.id]: e.target.value }))} className="wrong-note-input" placeholder="Not…" />
                          <button className="btn btn-primary btn-sm" onClick={() => saveNote(wt.id)}>Kaydet</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>İptal</button>
                        </div>
                      ) : wt.note ? <div className="wrong-note-display">📝 {wt.note}</div> : null}
                    </div>
                  )
                })}
              </div>
            )}
          </React.Fragment>
        ))}
        {secs.length > 1 && (
          <div className="mock-section-row mock-total-row">
            <div className="mock-col-subject" style={{ fontWeight: 700, fontSize: 12 }}>Toplam</div>
            <div className="mock-col-num" style={{ fontWeight: 700 }}>{c}</div>
            <div className="mock-col-num" style={{ fontWeight: 700 }}>{w}</div>
            <div className="mock-col-num" style={{ fontWeight: 700 }}>{b}</div>
            <div className="mock-col-net" style={{ fontWeight: 700 }}>{n.toFixed(2)}</div>
            <div className="mock-col-del" />
          </div>
        )}
      </div>
    </div>
  )
}

function ExamHistory({ exams, sections, onDeleted, allTopics }) {
  const [expanded, setExpanded] = useState(new Set())
  const [confirmDel, setConfirmDel] = useState(null)
  const [filter, setFilter] = useState('all')

  const filtered = filter === 'all' ? exams : exams.filter(e => e.exam_type === filter)

  function toggle(id) { setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }) }

  async function handleDelete(id) {
    await window.api.mockExams.delete(id)
    setConfirmDel(null)
    onDeleted()
  }

  if (exams.length === 0) {
    return <div className="empty-state">Henüz deneme kaydı yok.</div>
  }

  return (
    <div>
      <div className="history-filter-row">
        {[['all','Tümü'], ['section','Bölüm'], ['general','Genel']].map(([v, l]) => (
          <button key={v} className={`btn btn-sm ${filter === v ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter(v)}>{l}</button>
        ))}
        <span className="history-count">{filtered.length} deneme</span>
      </div>

      <div className="mock-history-list">
        {filtered.map(exam => {
          const secs = sections.filter(s => s.mock_exam_id === exam.id)
          const c = secs.reduce((s, r) => s + r.correct, 0)
          const w = secs.reduce((s, r) => s + r.wrong, 0)
          const b = secs.reduce((s, r) => s + r.blank, 0)
          const n = calcNet(c, w)
          const total = c + w + b
          const isOpen = expanded.has(exam.id)

          return (
            <div key={exam.id} className="mock-history-item">
              <div className="mock-history-row" onClick={() => toggle(exam.id)}>
                <div className="mock-history-left">
                  <span className={`mock-type-badge ${exam.exam_type === 'general' ? 'general' : 'section'}`}>
                    {exam.exam_type === 'general' ? 'Genel' : 'Bölüm'}
                  </span>
                  <span className="mock-history-name">{exam.name}</span>
                  <span className="mock-history-date">{fmtDate(exam.date)}</span>
                  {exam.duration_seconds > 0 && <span className="history-duration">⏱ {fmtSecs(exam.duration_seconds)}</span>}
                </div>
                <div className="mock-history-agg">
                  <span className="mock-badge-d">D:{c}</span>
                  <span className="mock-badge-y">Y:{w}</span>
                  <span className="mock-badge-b">B:{b}</span>
                  <span className="mock-badge-net">{n.toFixed(2)}</span>
                  {total > 0 && <span className="mock-badge-pct">{(c / total * 100).toFixed(0)}%</span>}
                </div>
                <div className="mock-history-actions" onClick={e => e.stopPropagation()}>
                  {confirmDel === exam.id ? (
                    <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Emin misin?</span>
                      <button className="btn btn-sm" style={{ color: 'var(--warn)' }} onClick={() => handleDelete(exam.id)}>Evet</button>
                      <button className="btn btn-sm btn-ghost" onClick={() => setConfirmDel(null)}>Hayır</button>
                    </span>
                  ) : (
                    <button className="btn-icon" onClick={() => setConfirmDel(exam.id)} title="Sil">✕</button>
                  )}
                </div>
                <span className="mock-expand-icon">{isOpen ? '▲' : '▼'}</span>
              </div>
              {isOpen && (
                <div className="mock-history-sections">
                  <ExamHistoryDetail exam={exam} sections={sections} allTopics={allTopics} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── MockStats ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }) {
  return (
    <div className="stat-card">
      <div className="stat-card-value" style={color ? { color } : {}}>{value}</div>
      <div className="stat-card-label">{label}</div>
      {sub && <div className="stat-card-sub">{sub}</div>}
    </div>
  )
}

const LP = [
  { op: 1.0, dash: '' }, { op: 0.7, dash: '5 3' }, { op: 0.5, dash: '' },
  { op: 0.85, dash: '2 2' }, { op: 0.6, dash: '8 3 2 3' }, { op: 0.4, dash: '' },
]

// Ders Detayı sub-component
function SubjectDetail({ subjectLabel, exams, sections, allTopics }) {
  const [expandedExam, setExpandedExam] = useState(null)
  const [wrongsByExam, setWrongsByExam] = useState({})

  // Filter exams for this subject
  const subjectExams = useMemo(() => {
    return exams
      .filter(e => e.exam_type === 'section')
      .filter(e => sections.some(s => s.mock_exam_id === e.id && s.subject_label === subjectLabel))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [exams, sections, subjectLabel])

  const chartData = subjectExams.map(e => {
    const sec = sections.find(s => s.mock_exam_id === e.id && s.subject_label === subjectLabel)
    return {
      _x: fmtDate(e.date),
      _label: `${e.name} (${fmtDate(e.date)})`,
      net: sec ? parseFloat(calcNet(sec.correct, sec.wrong).toFixed(2)) : 0,
    }
  })

  const nets = chartData.map(d => d.net)
  const avgNet = nets.length > 0 ? (nets.reduce((a, b) => a + b, 0) / nets.length).toFixed(2) : '—'
  const bestNet = nets.length > 0 ? Math.max(...nets).toFixed(2) : '—'
  const worstNet = nets.length > 0 ? Math.min(...nets).toFixed(2) : '—'

  async function toggleExam(examId) {
    if (expandedExam === examId) { setExpandedExam(null); return }
    setExpandedExam(examId)
    if (!wrongsByExam[examId]) {
      const data = await window.api.mockExams.wrongTopics.getByExam(examId)
      setWrongsByExam(p => ({ ...p, [examId]: data }))
    }
  }

  if (subjectExams.length === 0) {
    return <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>Bu ders için bölüm denemesi kaydı yok.</div>
  }

  return (
    <div>
      <div className="stats-card-row" style={{ marginBottom: 16 }}>
        <StatCard label="Deneme Sayısı" value={subjectExams.length} color={ACCENT} />
        <StatCard label="Ortalama Net" value={avgNet} color={ACCENT} />
        <StatCard label="En İyi Net" value={bestNet} color="#0b9e74" />
        <StatCard label="En Kötü Net" value={worstNet} color="var(--warn)" />
      </div>

      {chartData.length >= 1 && (
        <div className="mock-chart-section">
          <div className="mock-chart-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            Deneme Başına Net — {subjectLabel}
            <span style={{ fontSize: 11, fontWeight: 400, color: ACCENT, background: 'var(--accent-light)', borderRadius: 99, padding: '1px 8px' }}>
              ort. {avgNet}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={chartData} margin={{ top: 12, right: 48, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="_x" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} width={36} />
              <Tooltip
                contentStyle={{ background: 'var(--bg)', border: '1px solid var(--border)', fontSize: 12, borderRadius: 8 }}
                labelFormatter={(_, p) => p?.[0]?.payload?._label || _}
                formatter={(v, name) => name === 'net' ? [`${v} net`, 'Net'] : [v]}
              />
              <Bar dataKey="net" radius={[5, 5, 0, 0]} maxBarSize={56} name="net">
                {chartData.map((d, i) => (
                  <Cell
                    key={i}
                    fill={parseFloat(d.net) >= parseFloat(avgNet) ? '#0b9e74' : 'var(--warn)'}
                    fillOpacity={0.82}
                  />
                ))}
              </Bar>
              {chartData.length > 1 && (
                <Line
                  type="monotone" dataKey="net" stroke={ACCENT} strokeWidth={2}
                  dot={{ r: 3, fill: ACCENT, strokeWidth: 0 }} activeDot={{ r: 5 }}
                  name="net" legendType="none"
                />
              )}
              <ReferenceLine
                y={parseFloat(avgNet)}
                stroke={ACCENT} strokeDasharray="6 3" strokeWidth={1.5}
                label={{ value: `Ort. ${avgNet}`, position: 'right', fontSize: 10, fill: ACCENT, fontFamily: 'var(--font-mono)' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="subj-chart-legend">
            <span className="subj-legend-dot" style={{ background: '#0b9e74' }} /> Ortalamanın üstü
            <span className="subj-legend-dot" style={{ background: 'var(--warn)', marginLeft: 12 }} /> Ortalamanın altı
          </div>
        </div>
      )}

      <div className="subj-exam-list">
        {subjectExams.map(exam => {
          const sec = sections.find(s => s.mock_exam_id === exam.id && s.subject_label === subjectLabel)
          if (!sec) return null
          const n = calcNet(sec.correct, sec.wrong)
          const total = sec.correct + sec.wrong + sec.blank
          const isExp = expandedExam === exam.id
          const wts = wrongsByExam[exam.id] || []

          return (
            <div key={exam.id} className="subj-exam-card">
              <div className="subj-exam-row" onClick={() => toggleExam(exam.id)}>
                <div className="subj-exam-date">{fmtDate(exam.date)}</div>
                <div className="subj-exam-name">{exam.name}</div>
                {exam.duration_seconds > 0 && <span className="history-duration">⏱{fmtSecs(exam.duration_seconds)}</span>}
                <div className="subj-exam-scores">
                  <span className="mock-badge-d">D:{sec.correct}</span>
                  <span className="mock-badge-y">Y:{sec.wrong}</span>
                  <span className="mock-badge-b">B:{sec.blank}</span>
                  <span className="mock-badge-net">{n.toFixed(2)}</span>
                  {total > 0 && <span className="mock-badge-pct">{(sec.correct/total*100).toFixed(0)}%</span>}
                </div>
                <span className="mock-expand-icon" style={{ fontSize: 10 }}>{isExp ? '▲' : '▼'}</span>
              </div>

              {isExp && (
                <div className="subj-exam-detail">
                  {wts.length > 0 ? (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Yanlış Konular</div>
                      {wts.map(wt => {
                        const topic = allTopics.find(t => t.id === wt.kpss_topic_id)
                        return (
                          <div key={wt.id} className="wrong-history-item">
                            <div className="wrong-history-top">
                              <span className="wrong-count-badge">{wt.wrong_count}❌</span>
                              <span>{wt.topic_label}</span>
                              {topic && !topic.done && <span className="wrong-undone-warn">⚠ Tamamlanmadı</span>}
                            </div>
                            {wt.note && <div className="wrong-note-display">📝 {wt.note}</div>}
                          </div>
                        )
                      })}
                    </>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Bu deneme için yanlış analizi yok.</div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MockStats({ exams, sections, allTopics }) {
  const [range, setRange] = useState('all')
  const [stats, setStats] = useState(null)
  const [topicStats, setTopicStats] = useState(null)
  const [subTab, setSubTab] = useState('genel')
  const [selectedSubject, setSelectedSubject] = useState('')

  function rangeStart() {
    const d = new Date()
    if (range === 'week')    { d.setDate(d.getDate() - 7);   return d.toISOString().slice(0, 10) }
    if (range === 'month')   { d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 10) }
    if (range === 'quarter') { d.setMonth(d.getMonth() - 3); return d.toISOString().slice(0, 10) }
    return '2000-01-01'
  }

  useEffect(() => {
    const from = rangeStart()
    setStats(null); setTopicStats(null)
    Promise.all([
      window.api.mockExams.stats.get(from),
      window.api.mockExams.topicStats.get(from),
    ]).then(([s, t]) => { setStats(s); setTopicStats(t) })
  }, [range])

  // All unique subjects from section exams
  const allSubjects = useMemo(() => {
    const seen = new Set()
    const list = []
    for (const s of sections) {
      const exam = exams.find(e => e.id === s.mock_exam_id)
      if (exam?.exam_type === 'section' && s.subject_label && !seen.has(s.subject_label)) {
        seen.add(s.subject_label)
        list.push(s.subject_label)
      }
    }
    return list
  }, [exams, sections])

  useEffect(() => {
    if (subTab === 'ders' && !selectedSubject && allSubjects.length > 0) {
      setSelectedSubject(allSubjects[0])
    }
  }, [subTab, allSubjects])

  if (!stats || !topicStats) {
    return <div style={{ color: 'var(--text-muted)', padding: 20, fontSize: 13 }}>Yükleniyor…</div>
  }

  const { generalExamAgg, sectionExamAgg, generalExamSections, sectionByCat, summaryStats } = stats
  const hasData = generalExamAgg.length > 0 || sectionExamAgg.length > 0

  const allAgg = [...generalExamAgg, ...sectionExamAgg].map(e => ({ ...e, netVal: calcNet(e.correct, e.wrong) }))
  const avgNet = allAgg.length > 0 ? (allAgg.reduce((s, e) => s + e.netVal, 0) / allAgg.length).toFixed(2) : '—'
  const bestExam = allAgg.length > 0 ? allAgg.reduce((b, e) => e.netVal > b.netVal ? e : b) : null

  const genAggData = generalExamAgg.map(e => ({
    _x: fmtDate(e.date), _label: `${e.exam_name} (${fmtDate(e.date)})`,
    net: parseFloat(calcNet(e.correct, e.wrong).toFixed(2)),
  }))

  const genSubjects = [...new Set(generalExamSections.map(r => r.subject_label))]
  const gSecLookup = {}
  for (const r of generalExamSections) {
    if (!gSecLookup[r.exam_id]) gSecLookup[r.exam_id] = {}
    gSecLookup[r.exam_id][r.subject_label] = r
  }
  const genSubjectData = generalExamAgg.map(exam => {
    const pt = { _x: fmtDate(exam.date), _label: `${exam.exam_name} (${fmtDate(exam.date)})` }
    for (const sub of genSubjects) {
      const s = (gSecLookup[exam.exam_id] || {})[sub]
      if (s) pt[sub] = parseFloat(calcNet(s.correct, s.wrong).toFixed(2))
    }
    return pt
  })

  const secAggData = sectionExamAgg.map(e => ({
    _x: fmtDate(e.date), _label: `${e.exam_name} (${fmtDate(e.date)})`,
    net: parseFloat(calcNet(e.correct, e.wrong).toFixed(2)),
  }))

  const catBarData = (sectionByCat || []).map(row => ({
    name: row.subject_label.length > 9 ? row.subject_label.slice(0, 9) + '…' : row.subject_label,
    fullName: row.subject_label,
    avgNet: row.exam_count > 0 ? parseFloat((calcNet(row.total_correct, row.total_wrong) / row.exam_count).toFixed(2)) : 0,
    examCount: row.exam_count,
    totalWrong: row.total_wrong,
  })).sort((a, b) => b.avgNet - a.avgNet)

  let insight = ''
  if (topicStats.topicWrongs.length > 0) {
    const top = topicStats.topicWrongs[0]
    insight = `En çok yanlışın "${top.topic_label}" konusundan (${top.total_wrong} yanlış). Bu konuya odaklan!`
  } else if (hasData) {
    insight = 'Deneme sonrası yanlış analizi yaparsan hangi konulara odaklanman gerektiğini görürsün.'
  }

  const SUB_TABS = [
    ['genel', 'Genel Denemeler'],
    ['bolum', 'Bölüm Denemeleri'],
    ['ders', 'Ders Detayı'],
    ['konular', 'Konu Yanlışları'],
  ]

  return (
    <div>
      {/* Range filter */}
      <div className="stats-range-row">
        {[['week','Bu Hafta'], ['month','Bu Ay'], ['quarter','3 Ay'], ['all','Tümü']].map(([v, l]) => (
          <button key={v} className={`btn btn-sm ${range === v ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setRange(v)}>{l}</button>
        ))}
      </div>

      {!hasData && (
        <div className="empty-state">Bu aralıkta deneme verisi yok.</div>
      )}

      {hasData && (
        <>
          <div className="stats-card-row">
            <StatCard label="Toplam" value={summaryStats?.total_exams || allAgg.length} />
            <StatCard label="Bölüm" value={summaryStats?.section_count || sectionExamAgg.length} color={ACCENT} />
            <StatCard label="Genel" value={summaryStats?.general_count || generalExamAgg.length} color="#0b9e74" />
            <StatCard label="Ort. Net" value={avgNet} color={ACCENT} />
            {summaryStats?.total_seconds > 0 && <StatCard label="Toplam Süre" value={fmtSecs(summaryStats.total_seconds)} />}
            {bestExam && <StatCard label="En İyi" value={`${bestExam.netVal.toFixed(2)} net`} sub={bestExam.exam_name} color="#0b9e74" />}
          </div>

          {insight && <div className="stats-insight-box">💡 {insight}</div>}

          {/* Sub-tabs */}
          <div className="tabs" style={{ marginTop: 24, marginBottom: 20 }}>
            {SUB_TABS.map(([v, l]) => (
              <button key={v} className={`tab-btn${subTab === v ? ' active' : ''}`} onClick={() => setSubTab(v)}>{l}</button>
            ))}
          </div>

          {/* Genel Denemeler */}
          {subTab === 'genel' && (
            generalExamAgg.length === 0
              ? <div className="empty-state">Genel deneme kaydı yok.</div>
              : (
                <>
                  <div className="mock-chart-section">
                    <div className="mock-chart-title">Toplam Net (Denemeye Göre)</div>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={genAggData} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="_x" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                        <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} width={36} />
                        <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: 12 }}
                          labelFormatter={(_, p) => p?.[0]?.payload?._label || _} formatter={v => [`${v} net`]} />
                        <Line type="monotone" dataKey="net" stroke={ACCENT} strokeWidth={2} dot={{ r: 4, fill: ACCENT }} activeDot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  {genSubjects.length > 0 && (
                    <div className="mock-chart-section">
                      <div className="mock-chart-title">Derse Göre Net (Genel Denemeler)</div>
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={genSubjectData} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis dataKey="_x" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                          <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} width={36} />
                          <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: 12 }}
                            labelFormatter={(_, p) => p?.[0]?.payload?._label || _} />
                          {genSubjects.map((sub, i) => {
                            const p = LP[i % LP.length]
                            return (
                              <Line key={sub} type="monotone" dataKey={sub} name={sub}
                                stroke={`rgba(90,79,207,${p.op})`} strokeWidth={1.5} strokeDasharray={p.dash}
                                dot={{ r: 3, fill: `rgba(90,79,207,${p.op})` }} activeDot={{ r: 4 }} connectNulls />
                            )
                          })}
                        </LineChart>
                      </ResponsiveContainer>
                      <div className="stats-subject-legend">
                        {genSubjects.map((sub, i) => {
                          const p = LP[i % LP.length]
                          return <span key={sub} className="stats-legend-pill" style={{ borderColor: `rgba(90,79,207,${p.op})`, color: `rgba(90,79,207,${p.op})` }}>{sub}</span>
                        })}
                      </div>
                    </div>
                  )}
                </>
              )
          )}

          {/* Bölüm Denemeleri */}
          {subTab === 'bolum' && (
            sectionExamAgg.length === 0
              ? <div className="empty-state">Bölüm denemesi kaydı yok.</div>
              : (
                <>
                  <div className="mock-chart-section">
                    <div className="mock-chart-title">Net Trendi (Bölüm Denemeleri)</div>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={secAggData} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="_x" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                        <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} width={36} />
                        <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: 12 }}
                          labelFormatter={(_, p) => p?.[0]?.payload?._label || _} formatter={v => [`${v} net`]} />
                        <Line type="monotone" dataKey="net" stroke={ACCENT} strokeWidth={2} dot={{ r: 4, fill: ACCENT }} activeDot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  {catBarData.length > 0 && (
                    <div className="mock-chart-section">
                      <div className="mock-chart-title">Ders Başına Ortalama Net</div>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={catBarData} margin={{ top: 4, right: 12, bottom: 28, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} angle={-20} textAnchor="end" interval={0} />
                          <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} width={36} />
                          <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: 12 }}
                            labelFormatter={(_, p) => p?.[0]?.payload?.fullName || _} formatter={v => [`${v} avg net`]} />
                          <Bar dataKey="avgNet" radius={[4, 4, 0, 0]}>
                            {catBarData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="stats-cat-table">
                        {catBarData.map((row, i) => (
                          <div key={i} className="stats-cat-row">
                            <span className="stats-cat-rank" style={{ color: i === 0 ? '#0b9e74' : i === catBarData.length - 1 ? 'var(--warn)' : 'var(--text-muted)' }}>
                              {i === 0 ? '🥇' : i === catBarData.length - 1 ? '⚠️' : `${i + 1}.`}
                            </span>
                            <span className="stats-cat-name">{row.fullName}</span>
                            <span className="stats-cat-exams">{row.examCount} deneme</span>
                            <span className="mock-badge-net" style={{ fontSize: 12 }}>{row.avgNet.toFixed(2)} net</span>
                            <span className="mock-badge-y" style={{ fontSize: 11 }}>{row.totalWrong}Y</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )
          )}

          {/* Ders Detayı */}
          {subTab === 'ders' && (
            allSubjects.length === 0
              ? <div className="empty-state">Bölüm denemesi kaydı yok.</div>
              : (
                <div>
                  <div className="ders-detail-picker">
                    <div className="mock-field-label" style={{ marginBottom: 6 }}>Ders Seç</div>
                    <div className="ders-pill-row">
                      {allSubjects.map(sub => (
                        <button
                          key={sub}
                          className={`ders-pill${selectedSubject === sub ? ' active' : ''}`}
                          onClick={() => setSelectedSubject(sub)}
                        >{sub}</button>
                      ))}
                    </div>
                  </div>
                  {selectedSubject && (
                    <SubjectDetail
                      key={selectedSubject}
                      subjectLabel={selectedSubject}
                      exams={exams}
                      sections={sections}
                      allTopics={allTopics}
                    />
                  )}
                </div>
              )
          )}

          {/* Konu Yanlışları */}
          {subTab === 'konular' && (
            topicStats.topicWrongs.length === 0
              ? <div className="empty-state">Henüz konu bazlı yanlış verisi yok. Denemelerini kaydederken "Yanlış Analizi" yap.</div>
              : (
                <>
                  {topicStats.categoryWrongs.length > 1 && (
                    <div className="mock-chart-section">
                      <div className="mock-chart-title">Derse Göre Toplam Yanlış</div>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart
                          data={topicStats.categoryWrongs.map(r => ({ name: r.category_label?.slice(0, 9) || '?', full: r.category_label, wrong: r.total_wrong }))}
                          margin={{ top: 4, right: 12, bottom: 24, left: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} angle={-15} textAnchor="end" interval={0} />
                          <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} width={28} />
                          <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: 12 }}
                            labelFormatter={(_, p) => p?.[0]?.payload?.full || _} formatter={v => [`${v} yanlış`]} />
                          <Bar dataKey="wrong" radius={[4, 4, 0, 0]}>
                            {topicStats.categoryWrongs.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  <div className="mock-chart-section">
                    <div className="mock-chart-title">En Çok Yanlış Yapılan Konular</div>
                    <div className="stats-topic-list">
                      {topicStats.topicWrongs.map((t, i) => (
                        <div key={i} className="stats-topic-row">
                          <span className="stats-topic-rank" style={{ color: i < 3 ? 'var(--warn)' : 'var(--text-muted)' }}>{i + 1}</span>
                          <div className="stats-topic-info">
                            <span className="stats-topic-name">{t.topic_label}</span>
                            {t.category_label && <span className="wrong-cat-badge">{t.category_label}</span>}
                            {t.topic_done === 0 && <span className="wrong-undone-warn">⚠ Tamamlanmadı</span>}
                          </div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                            <span className="mock-badge-y">{t.total_wrong}❌</span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.exam_count} denemede</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )
          )}
        </>
      )}
    </div>
  )
}

// ── MockExams (main) ──────────────────────────────────────────────────────────

export default function MockExams() {
  const [tab, setTab] = useState('timer')
  const [exams, setExams] = useState([])
  const [sections, setSections] = useState([])
  const [categories, setCategories] = useState([])
  const [allTopics, setAllTopics] = useState([])
  const [timerDone, setTimerDone] = useState(null)
  const [showPostForm, setShowPostForm] = useState(false)

  const load = useCallback(async () => {
    const [{ exams: e, sections: s }, cats, topics] = await Promise.all([
      window.api.mockExams.listAll(),
      window.api.kpss.listCategories(),
      window.api.mockExams.allTopics.get(),
    ])
    setExams(e); setSections(s); setCategories(cats); setAllTopics(topics)
  }, [])

  useEffect(() => { load() }, [load])

  function handleTimerDone(data) { setTimerDone(data); setShowPostForm(true) }
  function handlePostCancel() { setTimerDone(null); setShowPostForm(false) }

  return (
    <div className="page">
      <div className="page-header"><h1>Deneme Sınavları</h1></div>

      <div className="tabs">
        {[['timer','🎯 Deneme Yap'], ['manual','✏ Manuel Ekle'], ['history','📋 Geçmişim'], ['stats','📊 İstatistikler']].map(([id, label]) => (
          <button key={id} className={`tab-btn${tab === id ? ' active' : ''}`} onClick={() => {
            setTab(id)
            if (id !== 'timer') { setTimerDone(null); setShowPostForm(false) }
          }}>{label}</button>
        ))}
      </div>

      <div style={{ marginTop: 24 }}>
        {tab === 'timer' && (
          showPostForm ? (
            <div>
              <div className="mock-stats-section-title" style={{ marginBottom: 16 }}>Deneme Sonuçları</div>
              <PostExamSaveForm timerData={timerDone} categories={categories} allTopics={allTopics} onSaved={load} onCancel={handlePostCancel} />
            </div>
          ) : (
            <ExamTimer categories={categories} onDone={handleTimerDone} />
          )
        )}
        {tab === 'manual' && <ManualExamForm categories={categories} allTopics={allTopics} onSaved={load} />}
        {tab === 'history' && <ExamHistory exams={exams} sections={sections} onDeleted={load} allTopics={allTopics} />}
        {tab === 'stats' && <MockStats exams={exams} sections={sections} allTopics={allTopics} />}
      </div>
    </div>
  )
}
